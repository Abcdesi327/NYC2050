#!/usr/bin/env python3
"""
adrinem_infra.py — turn an Azgaar Fantasy Map Generator export into an
infrastructure layer: a cell table, a least-cost road network between
market centers, market catchments, and a travel-cost surface.

Usage:
    python3 adrinem_infra.py <export.json> [outdir]

Outputs (in outdir):
    cells.csv               flattened per-cell table + derived supply metrics
    roads.geojson           trunk network, LineStrings, classed by usage
    catchments.geojson      per-cell nearest-market assignment (points)
    markets.geojson         the 17 market centers
    ports.csv               harbor-capable burgs (none are flagged in-file)
    network_report.json     pair matrix, unreachable pairs, summary stats

Cost model
----------
Edge cost between adjacent land cells a -> b, in "effective miles":

    cost = dist_mi * terrain_factor(b) * slope_factor(a,b) + river_penalty(b)

    terrain_factor = biome.cost / BASE_COST      (Azgaar's own biome costs)
    slope_factor   = 1 + max(0, h_b - h_a) / SLOPE_DIVISOR
    river_penalty  = RIVER_CROSS_MI if b sits on a river and a does not

Water is impassable in this pass. Sea routes are a separate mode; see
the ports.csv output for where they would have to attach.
"""

import csv
import heapq
import json
import math
import os
import sys
from collections import Counter, defaultdict

# ---------------------------------------------------------------- tunables

BASE_COST = 50.0        # Azgaar's grassland cost; the "1.0x terrain" baseline
SLOPE_DIVISOR = 40.0    # height units of climb that double the cost
RIVER_CROSS_MI = 12.0   # effective miles added for an unbridged crossing
SEA_LEVEL = 20          # Azgaar convention: h >= 20 is land

# usage thresholds for classing a road segment (share of market pairs)
TRUNK_MIN = 0.15
ROAD_MIN = 0.05


# ---------------------------------------------------------------- loading

def load(path):
    with open(path) as fh:
        return json.load(fh)


def real_records(seq):
    """Azgaar pads index 0 (and removed entries) with ints or {removed:true}."""
    return [x for x in seq if isinstance(x, dict) and not x.get("removed")]


def build_context(doc):
    pack = doc["pack"]
    info = doc["info"]
    settings = doc["settings"]
    coords = doc["mapCoordinates"]

    ctx = {
        "cells": pack["cells"],
        "biomes": {b["i"]: b for b in pack["biomes"] if isinstance(b, dict)},
        "states": {s["i"]: s for s in pack["states"] if isinstance(s, dict)},
        "provinces": {p["i"]: p for p in pack["provinces"] if isinstance(p, dict)},
        "cultures": {c["i"]: c for c in pack["cultures"] if isinstance(c, dict)},
        "burgs": {b["i"]: b for b in pack["burgs"] if isinstance(b, dict)},
        "markets": real_records(pack.get("markets", [])),
        "goods": {g["i"]: g for g in pack["goods"] if isinstance(g, dict)},
        "deals": [d for d in pack.get("deals", []) if isinstance(d, dict)],
        "rivers": [r for r in pack["rivers"] if isinstance(r, dict)],
        "scale": float(settings.get("distanceScale", 1)),
        "pop_rate": float(settings.get("populationRate", 1000)),
        "width": info["width"],
        "height": info["height"],
        "coords": coords,
        "name": info.get("mapName", "map"),
    }
    return ctx


def to_lonlat(ctx, x, y):
    c = ctx["coords"]
    lon = c["lonW"] + (x / ctx["width"]) * c["lonT"]
    lat = c["latN"] - (y / ctx["height"]) * c["latT"]
    return [round(lon, 4), round(lat, 4)]


# ---------------------------------------------------------------- graph

def cell_xy(cell):
    p = cell.get("p") or [0, 0]
    return float(p[0]), float(p[1])


def build_graph(ctx):
    """Adjacency list of land cells with effective-mile edge weights."""
    cells = ctx["cells"]
    biomes = ctx["biomes"]
    scale = ctx["scale"]

    adj = defaultdict(list)
    land = set()

    for cell in cells:
        if not isinstance(cell, dict):
            continue
        if cell.get("h", 0) >= SEA_LEVEL:
            land.add(cell["i"])

    for i in land:
        a = cells[i]
        ax, ay = cell_xy(a)
        for j in a.get("c", []):
            if j not in land:
                continue
            b = cells[j]
            bx, by = cell_xy(b)
            dist_mi = math.hypot(bx - ax, by - ay) * scale

            biome = biomes.get(b.get("biome", 4))
            terrain = (biome.get("cost", BASE_COST) if biome else BASE_COST) / BASE_COST

            climb = max(0, b.get("h", 0) - a.get("h", 0))
            slope = 1.0 + climb / SLOPE_DIVISOR

            river = RIVER_CROSS_MI if (b.get("r") and not a.get("r")) else 0.0

            adj[i].append((j, dist_mi * terrain * slope + river))

    return adj, land


def components(adj, land):
    """Connected landmasses. Anything not in the same one needs a sea link."""
    seen, comps = set(), []
    for start in land:
        if start in seen:
            continue
        stack, comp = [start], {start}
        seen.add(start)
        while stack:
            u = stack.pop()
            for v, _ in adj.get(u, []):
                if v not in comp:
                    comp.add(v)
                    seen.add(v)
                    stack.append(v)
        comps.append(comp)
    comps.sort(key=len, reverse=True)
    return comps


def dijkstra(adj, source, targets=None):
    """Standard Dijkstra. Returns (dist, prev). Stops early if targets given."""
    dist = {source: 0.0}
    prev = {}
    seen = set()
    remaining = set(targets) if targets else None
    pq = [(0.0, source)]

    while pq:
        d, u = heapq.heappop(pq)
        if u in seen:
            continue
        seen.add(u)
        if remaining is not None:
            remaining.discard(u)
            if not remaining:
                break
        for v, w in adj.get(u, []):
            nd = d + w
            if nd < dist.get(v, math.inf):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))

    return dist, prev


def walk_back(prev, source, target):
    path = [target]
    while path[-1] != source:
        nxt = prev.get(path[-1])
        if nxt is None:
            return None
        path.append(nxt)
    path.reverse()
    return path


def multi_source(adj, sources):
    """Nearest-source cost surface and assignment, in one sweep."""
    dist = {s: 0.0 for s in sources}
    owner = {s: s for s in sources}
    pq = [(0.0, s) for s in sources]
    heapq.heapify(pq)
    seen = set()

    while pq:
        d, u = heapq.heappop(pq)
        if u in seen:
            continue
        seen.add(u)
        for v, w in adj.get(u, []):
            nd = d + w
            if nd < dist.get(v, math.inf):
                dist[v] = nd
                owner[v] = owner[u]
                heapq.heappush(pq, (nd, v))

    return dist, owner


# ---------------------------------------------------------------- outputs

def write_cells_csv(ctx, path, adj, land, surface, owner, burg_by_cell):
    cells = ctx["cells"]
    biomes = ctx["biomes"]
    states = ctx["states"]
    provinces = ctx["provinces"]
    cultures = ctx["cultures"]

    fields = [
        "cell", "x", "y", "lon", "lat", "height", "area_sq",
        "biome", "biome_cost", "habitability", "is_land", "harbor",
        "river", "flux", "pop", "state", "state_name",
        "province", "province_name", "culture", "culture_name",
        "burg", "burg_name", "burg_pop",
        "market_cell", "cost_to_market_mi", "supply_days",
    ]

    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for cell in cells:
            if not isinstance(cell, dict):
                continue
            i = cell["i"]
            x, y = cell_xy(cell)
            lon, lat = to_lonlat(ctx, x, y)
            biome = biomes.get(cell.get("biome", 0), {})
            st = states.get(cell.get("state", 0), {})
            pv = provinces.get(cell.get("province", 0), {})
            cu = cultures.get(cell.get("culture", 0), {})
            burg = burg_by_cell.get(i)
            cost = surface.get(i)

            w.writerow({
                "cell": i,
                "x": x, "y": y, "lon": lon, "lat": lat,
                "height": cell.get("h"),
                "area_sq": cell.get("area"),
                "biome": biome.get("name"),
                "biome_cost": biome.get("cost"),
                "habitability": biome.get("habitability"),
                "is_land": int(i in land),
                "harbor": cell.get("harbor", 0),
                "river": cell.get("r", 0),
                "flux": cell.get("fl", 0),
                "pop": round(cell.get("pop", 0), 3),
                "state": cell.get("state"),
                "state_name": st.get("name"),
                "province": cell.get("province"),
                "province_name": pv.get("name"),
                "culture": cell.get("culture"),
                "culture_name": cu.get("name"),
                "burg": burg["i"] if burg else "",
                "burg_name": burg["name"] if burg else "",
                "burg_pop": round(burg["population"] * ctx["pop_rate"]) if burg else "",
                "market_cell": owner.get(i, ""),
                "cost_to_market_mi": round(cost, 1) if cost is not None else "",
                "supply_days": round(cost / 25.0, 1) if cost is not None else "",
            })


def write_roads_geojson(ctx, path, usage, pair_count):
    cells = ctx["cells"]
    features = []

    for (a, b), n in sorted(usage.items(), key=lambda kv: -kv[1]):
        share = n / pair_count if pair_count else 0
        if share >= TRUNK_MIN:
            cls = "trunk"
        elif share >= ROAD_MIN:
            cls = "road"
        else:
            cls = "trail"

        ax, ay = cell_xy(cells[a])
        bx, by = cell_xy(cells[b])
        features.append({
            "type": "Feature",
            "properties": {
                "from_cell": a, "to_cell": b,
                "uses": n, "share": round(share, 4), "class": cls,
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [to_lonlat(ctx, ax, ay), to_lonlat(ctx, bx, by)],
            },
        })

    dump_geojson(path, features)


def write_points_geojson(path, ctx, records):
    features = []
    for r in records:
        x, y = r.pop("_xy")
        features.append({
            "type": "Feature",
            "properties": r,
            "geometry": {"type": "Point", "coordinates": to_lonlat(ctx, x, y)},
        })
    dump_geojson(path, features)


def dump_geojson(path, features):
    with open(path, "w") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh, indent=1)


def write_ports_csv(ctx, path):
    cells = ctx["cells"]
    rows = []
    for b in ctx["burgs"].values():
        cell = cells[b["cell"]]
        if cell.get("harbor", 0):
            rows.append({
                "burg": b["i"],
                "name": b["name"],
                "cell": b["cell"],
                "state": ctx["states"].get(b.get("state", 0), {}).get("name"),
                "population": round(b["population"] * ctx["pop_rate"]),
                "harbor_quality": cell.get("harbor"),
                "haven_cell": cell.get("haven"),
                "port_flag_in_file": b.get("port", 0),
            })
    rows.sort(key=lambda r: -r["population"])
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return rows


# ---------------------------------------------------------------- main

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "Adrinem_Full.json"
    outdir = sys.argv[2] if len(sys.argv) > 2 else "out"
    os.makedirs(outdir, exist_ok=True)

    doc = load(src)
    ctx = build_context(doc)
    adj, land = build_graph(ctx)

    burg_by_cell = {b["cell"]: b for b in ctx["burgs"].values()}

    # market center cells
    centers = []
    for m in ctx["markets"]:
        b = ctx["burgs"].get(m.get("centerBurgId"))
        if b and b["cell"] in land:
            centers.append({
                "market": m["i"], "burg": b["i"], "name": b["name"],
                "cell": b["cell"],
                "state": ctx["states"].get(b.get("state", 0), {}).get("name"),
                "population": round(b["population"] * ctx["pop_rate"]),
            })

    center_cells = [c["cell"] for c in centers]
    print(f"{len(land)} land cells, {len(centers)} market centers")

    # all-pairs least-cost paths between market centers
    usage = Counter()
    matrix = {}
    unreachable = []
    for c in centers:
        others = [x for x in center_cells if x != c["cell"]]
        dist, prev = dijkstra(adj, c["cell"], targets=set(others))
        for t in others:
            if t not in dist:
                if c["cell"] < t:  # undirected, count once
                    unreachable.append([c["cell"], t])
                continue
            matrix[f"{c['cell']}->{t}"] = round(dist[t], 1)
            if c["cell"] < t:  # count each undirected pair once
                path = walk_back(prev, c["cell"], t)
                if path:
                    for u, v in zip(path, path[1:]):
                        usage[(min(u, v), max(u, v))] += 1

    pair_count = sum(1 for i in range(len(center_cells))
                     for j in range(i + 1, len(center_cells)))

    # travel-cost surface + catchments
    surface, owner = multi_source(adj, center_cells)

    # --- write everything
    write_cells_csv(ctx, os.path.join(outdir, "cells.csv"),
                    adj, land, surface, owner, burg_by_cell)
    write_roads_geojson(ctx, os.path.join(outdir, "roads.geojson"),
                        usage, pair_count)

    cells = ctx["cells"]
    write_points_geojson(
        os.path.join(outdir, "markets.geojson"), ctx,
        [dict(c, _xy=cell_xy(cells[c["cell"]])) for c in centers])

    catch = []
    for i in land:
        home = owner.get(i)
        if home is None:
            continue
        catch.append({
            "cell": i, "market_cell": home,
            "cost_mi": round(surface[i], 1),
            "_xy": cell_xy(cells[i]),
        })
    write_points_geojson(os.path.join(outdir, "catchments.geojson"), ctx, catch)

    ports = write_ports_csv(ctx, os.path.join(outdir, "ports.csv"))

    # --- report
    stranded = sorted(land - set(surface))
    by_market = Counter(owner[i] for i in land if i in owner)
    name_of = {c["cell"]: c["name"] for c in centers}

    classed = Counter()
    for (a, b), n in usage.items():
        share = n / pair_count
        classed["trunk" if share >= TRUNK_MIN
                else "road" if share >= ROAD_MIN else "trail"] += 1

    comps = components(adj, land)
    landmasses = []
    for comp in comps:
        if len(comp) < 3:
            continue
        landmasses.append({
            "cells": len(comp),
            "population": round(sum(cells[i].get("pop", 0) for i in comp)
                                * ctx["pop_rate"]),
            "markets": sorted(name_of[c] for c in name_of if c in comp),
            "states": sorted({ctx["states"].get(cells[i].get("state", 0), {})
                              .get("name") for i in comp} - {None}),
        })

    report = {
        "map": ctx["name"],
        "scale_mi_per_unit": ctx["scale"],
        "land_cells": len(land),
        "market_centers": len(centers),
        "market_pairs": pair_count,
        "unreachable_pairs": len(unreachable),
        "unreachable_examples": unreachable[:20],
        "landmasses": landmasses,
        "segments_by_class": dict(classed),
        "cells_beyond_reach_of_any_market": len(stranded),
        "catchment_sizes": {name_of.get(k, k): v
                            for k, v in by_market.most_common()},
        "harbor_capable_burgs": len(ports),
        "ports_flagged_in_file": sum(p["port_flag_in_file"] for p in ports),
        "pair_costs_mi": matrix,
    }
    with open(os.path.join(outdir, "network_report.json"), "w") as fh:
        json.dump(report, fh, indent=1)

    print(f"segments: {dict(classed)}")
    print(f"unreachable market pairs: {len(unreachable)}")
    print(f"land cells with no market reachable: {len(stranded)}")
    print(f"harbor-capable burgs: {len(ports)} (flagged as ports in file: "
          f"{report['ports_flagged_in_file']})")
    print(f"wrote 6 files to {outdir}/")


if __name__ == "__main__":
    main()
