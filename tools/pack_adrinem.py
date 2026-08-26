#!/usr/bin/env python3
"""
pack_adrinem.py — fold the Adrinem exports into one script the browser can read.

The sheet has no build step and has to open from file://, so it cannot fetch
cells.csv at runtime. This turns the exports into js/adrinem-data.js, a single
global with the cell table held column-wise as comma-joined strings — about a
third the size of the equivalent JSON and parsed in one pass on load.

Usage:  python3 tools/pack_adrinem.py [outfile]
"""

import csv
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "js", "adrinem-data.js")


def src(name):
    return os.path.join(ROOT, name)


def num(s, cast=float, default=0):
    if s is None or s == "":
        return default
    try:
        return cast(s)
    except ValueError:
        return default


def trim(v):
    """Shortest round-trip form: 12.0 -> 12, 12.30 -> 12.3."""
    if isinstance(v, float):
        if v == int(v):
            return str(int(v))
        return repr(round(v, 2)).rstrip("0").rstrip(".")
    return str(v)


def col(values):
    return ",".join(trim(v) for v in values)


def fit(rows, xkey, ykey):
    """Recover the linear map-frame -> lon/lat transform from two far apart rows."""
    lo = min(rows, key=lambda r: num(r[xkey]))
    hi = max(rows, key=lambda r: num(r[xkey]))
    per = (num(hi[ykey]) - num(lo[ykey])) / (num(hi[xkey]) - num(lo[xkey]))
    base = num(lo[ykey]) - per * num(lo[xkey])
    worst = max(abs(base + per * num(r[xkey]) - num(r[ykey])) for r in rows)
    if worst > 0.01:
        raise SystemExit("%s/%s is not linear (worst %.4f)" % (xkey, ykey, worst))
    return round(base, 6), round(per, 9)


def main():
    rows = list(csv.DictReader(open(src("cells.csv"))))
    rows.sort(key=lambda r: int(r["cell"]))

    # cell ids are dense from 0 in an Azgaar export; assert it so the packed
    # columns can be indexed positionally instead of carrying the id.
    for want, r in enumerate(rows):
        if int(r["cell"]) != want:
            raise SystemExit("cell ids are not dense at %d" % want)

    # ---- dictionaries, so the columns can hold small ints ------------------
    biomes, states, provinces, cultures = {}, {}, {}, {}
    for r in rows:
        biomes.setdefault(r["biome"], {
            "name": r["biome"],
            "cost": num(r["biome_cost"], int, 50),
            "hab": num(r["habitability"], int, 0),
        })
        states.setdefault(num(r["state"], int), r["state_name"] or "Unclaimed")
        provinces.setdefault(num(r["province"], int), r["province_name"] or "")
        cultures.setdefault(num(r["culture"], int), r["culture_name"] or "Wildlands")

    biome_list = sorted(biomes.values(), key=lambda b: b["name"])
    biome_ix = {b["name"]: i for i, b in enumerate(biome_list)}

    def dense(d, fallback=""):
        out = [fallback] * (max(d) + 1)
        for k, v in d.items():
            out[k] = v
        return out

    # ---- burgs: one record per settled cell -------------------------------
    burgs = []
    burg_of_cell = {}
    for r in rows:
        if not r["burg_name"]:
            continue
        burg_of_cell[int(r["cell"])] = len(burgs)
        burgs.append({
            "i": num(r["burg"], int),
            "name": r["burg_name"],
            "cell": int(r["cell"]),
            "pop": num(r["burg_pop"], int),
            "state": num(r["state"], int),
        })

    ports = {}
    for p in csv.DictReader(open(src("ports.csv"))):
        ports[int(p["cell"])] = {
            "quality": num(p["harbor_quality"], int, 1),
            "haven": num(p["haven_cell"], int, -1),
        }

    markets = []
    for f in json.load(open(src("markets.geojson")))["features"]:
        p = f["properties"]
        markets.append({
            "i": p["market"], "burg": p["burg"], "name": p["name"],
            "cell": p["cell"], "state": p["state"], "pop": p["population"],
        })
    markets.sort(key=lambda m: -m["pop"])

    # ---- roads: cell pairs, so the geometry comes off the cell table -------
    cls_ix = {"trunk": 2, "road": 1, "trail": 0}
    roads_a, roads_b, roads_c, roads_u = [], [], [], []
    for f in json.load(open(src("roads.geojson")))["features"]:
        p = f["properties"]
        roads_a.append(p["from_cell"])
        roads_b.append(p["to_cell"])
        roads_c.append(cls_ix[p["class"]])
        roads_u.append(p["uses"])

    report = json.load(open(src("network_report.json")))

    # ---- the equirectangular frame, recovered from the exported lon/lat -----
    lon_w, lon_per = fit(rows, "x", "lon")
    lat_n, lat_per = fit(rows, "y", "lat")

    # ---- the cell columns --------------------------------------------------
    cols = {
        "x": col(num(r["x"]) for r in rows),
        "y": col(num(r["y"]) for r in rows),
        "h": col(num(r["height"], int) for r in rows),
        "b": col(biome_ix[r["biome"]] for r in rows),
        "st": col(num(r["state"], int) for r in rows),
        "pv": col(num(r["province"], int) for r in rows),
        "cu": col(num(r["culture"], int) for r in rows),
        "pop": col(round(num(r["pop"]) * 1000) for r in rows),   # people, not thousands
        "riv": col(num(r["river"], int) for r in rows),
        "flux": col(num(r["flux"], int) for r in rows),
        "hrb": col(num(r["harbor"], int) for r in rows),
        # -1 where no market is reachable at all: the beyond-supply ground
        "mkt": col(num(r["market_cell"], int, -1) for r in rows),
        "cost": col(round(num(r["cost_to_market_mi"], float, -1), 1) for r in rows),
    }

    data = {
        "meta": {
            "name": report.get("map", "Adrinem"),
            "scale": report.get("scale_mi_per_unit", 1),
            "width": round(max(num(r["x"]) for r in rows)) + 20,
            "height": round(max(num(r["y"]) for r in rows)) + 20,
            "cells": len(rows),
            "land": report.get("land_cells", 0),
            "supplyDivisor": 25.0,     # effective miles a day, from adrinem_infra.py
            "riverCrossMi": 12.0,
            "slopeDivisor": 40.0,
            "baseCost": 50.0,
            "seaLevel": 20,
            # lon/lat is an exact linear function of the map frame, so the two
            # columns are dropped and the transform carried instead
            "lonW": lon_w, "lonPer": lon_per, "latN": lat_n, "latPer": lat_per,
        },
        "biomes": biome_list,
        "states": dense(states, "Unclaimed"),
        "provinces": dense(provinces, ""),
        "cultures": dense(cultures, "Wildlands"),
        "cols": cols,
        "burgOfCell": burg_of_cell,
        "burgs": burgs,
        "markets": markets,
        "ports": ports,
        "roads": {"a": col(roads_a), "b": col(roads_b),
                  "cls": col(roads_c), "uses": col(roads_u)},
        "pairs": report.get("pair_costs_mi", {}),
        "report": {k: v for k, v in report.items() if k != "pair_costs_mi"},
    }

    body = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    banner = (
        "/* ===================================================================================\n"
        "   Adrinem — the packed world. Generated by tools/pack_adrinem.py from the exports at\n"
        "   the repository root (cells.csv, roads.geojson, markets.geojson, ports.csv,\n"
        "   network_report.json). Do not edit by hand; re-run the packer instead.\n"
        "   =================================================================================== */\n"
    )
    with open(OUT, "w") as fh:
        fh.write(banner + "window.ADRINEM_DATA=" + body + ";\n")

    kb = os.path.getsize(OUT) / 1024
    print("wrote %s  (%.0f KB)" % (os.path.relpath(OUT, ROOT), kb))
    print("  %d cells, %d burgs, %d markets, %d ports, %d road segments"
          % (len(rows), len(burgs), len(markets), len(ports), len(roads_a)))


if __name__ == "__main__":
    main()
