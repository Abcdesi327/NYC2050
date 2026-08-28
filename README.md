# NYC 2050

A map app for walking through a New York that has been left to the water — and,
on a second sheet, for reading the infrastructure of a high fantasy world called
**Adrinem**. The switch at the top left moves between them.

The sheet is drawn as a survey document rather than a road map: Manhattan is
banded by habitability, every logged site carries a *disposition* (flooded,
collapsed, salvage, sealed, standing, occupied), and the ground the survey never
covered is left hatched. Thirteen sites also have a **street-level plate** — a
procedurally drawn view of the place as the survey found it, with a switch to
see it as it was built — and any of six **contingency projections** can be run
across the sheet to see what a further disaster would take.

**Preview: https://abcdesi327.github.io/NYC2050/** — the Adrinem plate is at
[`/adrinem.html`](https://abcdesi327.github.io/NYC2050/adrinem.html).

Or open `index.html` (or `adrinem.html`) in a browser. There is no build step, no
server and no dependencies; `dist/nyc2050.html` and `dist/adrinem.html` are the
same two sheets inlined into single files if you want to hand someone one thing.

The preview is rebuilt and redeployed by `.github/workflows/pages.yml` on every
push to `main` or to the feature branch, and can be kicked off by hand from the
Actions tab. `build.json` at the site root records the commit it was built from. Both sheets
are built and shipped.

One setting has to be turned on by hand before the first deploy can land, since
a workflow token is not permitted to do it: **Settings → Pages → Build and
deployment → Source: GitHub Actions**. Re-run the workflow afterwards and the
link above goes live.

## What is in it

**The built fabric.** Press **BLK** to cycle it on: 5,242 city blocks, 3,461 of
them in Manhattan, generated from the thing that actually determines them — the
street grid already on the sheet. Avenues and streets bound them, the shoreline
clips them, the parks are cut out, and each block is given a use, a period of
construction, a height, a floor area and a shelter capacity from where it stands.
Colour them by use, by height, or by period; tap any block to read it. 401 million
square metres of floor in all.

This is what makes the projections infrastructural rather than anecdotal. A
hazard is applied to the fabric as well as to the logged stations, and how a
block fails depends on when it was built: an M6.8 under 15th Street puts 74 per
cent of the pre-1901 fabric out of use against 23 per cent of the 1961–99 fabric,
while a blast — which does not much care what year a wall went up — falls close
to evenly, and hits the post-2000 curtain wall hardest of all. Nothing here is
surveyed. It is a plausible city, built to the right rules.

**The sheet.** 304 logged sites across Manhattan, Brooklyn, Queens, the Bronx,
the harbour islands and the Jersey shore. Named thoroughfares are drawn with
their names riding the road: Flatbush and Atlantic and Eastern Parkway, Queens
Boulevard and Northern Boulevard, the Grand Concourse and Fordham Road, the FDR
and the Henry Hudson, Riverside Drive and St Nicholas Avenue, the pre-grid
streets below Houston, and the crosstown streets that go by name rather than
number. Drag to pan, pinch or scroll to zoom, tap anything to read its field
note.

**Street view.** Sites drawn with a ring on the sheet open a plate:

| Plate | Where |
| --- | --- |
| Soldiers' and Sailors' Memorial Arch | Grand Army Plaza, Brooklyn |
| New Museum | 235 Bowery |
| Solomon R. Guggenheim Museum | Fifth Avenue at 89th |
| Empire State Building | West 34th Street, looking east |
| Flatiron Building | Fifth, Broadway and 23rd |
| Washington Square Arch | Washington Square North |
| Grand Central Terminal | East 42nd at Park |
| Times Square | Broadway at 45th |
| Brooklyn Bridge | the Manhattan approach |
| St. Patrick's Cathedral | Fifth Avenue at 50th |
| New York Public Library | Fifth Avenue at 42nd |
| Statue of Liberty | Upper Bay, from the water |
| Apollo Theater | 125th Street, at dusk |

Plates are grouped into **walks** — Fifth Avenue from Washington Square to
Museum Mile, the Midtown crosstown, the East Side and the bridge, the edges —
and the arrows step along the walk you are on. **SHOW BEFORE** cross-fades the
same drawing back to the city as built: the glass returns to the windows, the
ivy and the rubble and the standing water go. Every plate is SVG generated at
runtime from a kit of masonry, glazing, growth, water and wreck primitives. No
photographs are used anywhere in this project.

**Structure heights.** Every site carries a roof height — the real figure for the
127 buildings anybody would recognise, and a plausible one derived from category
and district density for the rest. It shows on the info sheet with an approximate
floor count, **HGT** draws it on the sheet as a bar over each station, and the
collapse projection reads it directly: place the point near a structure and it
snaps to that building and loads its true height.

**The solid view.** Press **3D**. The same city, extruded and drawn in WebGL2 —
terrain from the elevation surface, water, roads as ribbons, the parks, and
**12,282 buildings**. Each generated block is cut along its long axis into the two
to five buildings that would stand on it, with heights varying about the block's
own and the occasional gap for the yard behind, so it reads as a city rather than
a row of walls. Colour it by use, period or height, or by what the current
projection did to it — lost blocks come down to their own rubble. Drag to orbit,
shift-drag to pan, wheel to zoom, WASD to move, click any building to read its
size, mass and material.

**Groundwork for physics.** The same world comes out of `world3d.js` twice: as
geometry for the renderer, and as `colliders()` — every building as an oriented
box in metres, with a mass, a material and the energy its fabric absorbs before
something goes through it, sorted into a uniform broadphase grid. `raycast()` and
`trace()` sit on top of that: a ballistic integrator with quadratic drag that
sweeps against the collider set, spends energy on each penetration, and returns
the flight path, every structure it went through, and where it came to rest.

**THROW** in the 3D panel drives it directly. A 950 kg steel member launched flat
at 200 m/s from ninety metres up goes through five buildings and 680 metres — 8.5
city blocks — and the solve takes 6 ms. Glazing at the same speed is stopped by
the first wall it meets. That is the seam a real physics engine slots into:
nothing else in the app depends on how `trace()` does its work, only on what it
returns, so the integrator can be replaced without touching the world it runs in.

**Routing.** Press **NAV**. Set two ends — search for them, tap them on the
sheet, or send any site straight there with ROUTE TO / ROUTE FROM on its info
sheet — and the console finds a way across. Four weightings of the same network
produce up to four different routes: **fastest**, **safest** (avoids falling
fabric, rubble and open ground), **driest** (stays out of the water at the stated
tide), and **supplied** (keeps within reach of water, food and care). Each comes
back with a distance, a walking time, a hazard index and a turn-by-turn list —
*south on Park, 2,160 m, 29 min* — with what is wrong with each leg written
against it.

The network is welded out of what was already on the sheet: the avenues, the
numbered streets, the named thoroughfares, and the two crossings that still carry
weight. 4,401 junctions and 6,378 links. Manhattan is an island again, so a route
off it goes over the Brooklyn Bridge — one at a time, on a still day — or over
the Harlem River, and the console says so.

Two things make the routes move. The **tide** — low, mean, high or spring — decides
which low ground is passable, since the elevation surface is measured against the
2050 waterline. And **PLAN AGAINST THE CURRENT PROJECTION** re-prices every link
against whatever the SIM console has just done to the city: fire is impassable,
lost blocks are rubble at a fifth of walking pace, and flooded ground is closed.
A firestorm through Midtown turns Grand Central to Columbus Circle from 2.2 km and
29 minutes into 4.4 km and 81 minutes, and the leg list says which avenues it is
climbing rubble on.

**Contingency projections.** Press **SIM**. Choose a hazard — hurricane surge,
earthquake, firestorm, uncontrolled structural collapse, a large-scale blast
event, or a deliberate infrastructure failure — set its parameters, place it on
the sheet, and run it. Twenty-four hours are simulated and the sheet recolours
to the outcome; the scrubber walks the hours, and the log says what failed when.

The point of it is the second-order effect. Every site is scored twice: what the
event breaks, and what stops working because something else broke. Fourteen
installations provide power, water, food, sanitation and overland supply across
a reach, and a projection reports only what *this* event took away — a shortage
the survey had already logged is not news. Losing the Astoria generating station
does more damage over twenty-four hours than a blast that flattens ten blocks,
and the write-up says so.

**Ejecta.** A blast or a collapse throws material, and the throw is modelled
rather than assumed. Fragments are drawn from six classes — glazing, facade
panel, masonry, structural steel, vehicles, roof plant — launched with a spread
of speeds and angles (from every floor, in a collapse) and flown as ballistic
bodies under quadratic drag. Along its line each fragment meets the city: it
passes over anything shorter than its altitude and strikes anything taller, and
a strike carrying more energy than that building's fabric absorbs goes **through**
and keeps going. That is how debris crosses blocks, and the report counts it —
fragments past one block, past three, through a structure, through two or more.

Between the logged stations the fabric is still there — a fragment's corridor is
filled in from the block layer, at each block's real height and with the
resistance its period of construction gives it; where the survey did log a
station on that block the strike is attributed to it. The console draws a **section under
the throw line**: a side elevation of everything the fragment flew over, at its
real height, with the trajectory arcing across it and the strikes marked. Pick
the deepest, longest, or heaviest fragment to change the section.

The model is about material — facade, masonry, steel, plant, vehicles. People in
the throw field are counted as exposure the way a civil-defence plate counts
them, and are not modelled further.

Underneath it is a terrain model: spot heights for sixty-five points across the
five boroughs interpolated into a surface, the made ground mapped separately
because it floods first and shakes hardest, and the shallow schist at both ends
of Manhattan distinguished from the deep till in between. Surge floods by
elevation, shaking is amplified by soil, fire spreads cell by cell with the wind
and is slowed by the avenues, and a falling structure throws debris the length
of itself.

None of it is a prediction. The fragility figures are invented to be plausible
and internally consistent, not surveyed, and the blast case is deliberately kept
abstract — an origin, a scale, and rings drawn off distance alone.

**Your own marks.** Press **PIN** and tap the sheet to drop a mark, name it and
write a note; press **BOOKMARK** on any surveyed site to keep it. **LIST** opens
the plates and your marks, and marks can be copied out and pasted back in as
JSON. Everything is held in `localStorage` — nothing leaves the browser.

Press **?** on the control rail at any time for a guided walk of everything below.

Keys: `/` search · `P` pin · `B` marks · `K` key · `S` projections · `N` navigate
· `H` heights · `F` fabric · `3` solid view · in a plate `←` `→` walk, `T` then/now, `Esc` out.


## The other sheet: Adrinem

`adrinem.html` is the same chrome pointed at a different world. It is built from an
export of the [Azgaar Fantasy Map Generator](https://azgaar.github.io/Fantasy-Map-Generator/)
that has been run through `adrinem_infra.py` — the script at the repository root,
which turns a raw map file into an infrastructure layer: a per-cell table, a
least-cost road network laid between the market centres, the catchment each cell
falls into, and the travel-cost surface behind both.

Fourteen realms, forty-eight provinces, eight peoples — humans, godlings, angels,
demons, shifters, dragon ridgers, halflings, and the wildlands nobody holds —
across 3,817 cells of which 2,429 are land. Eighty burgs, seventeen of them market
centres, twenty-eight with harbours.

**The ground.** The export carries a point per cell and no polygons, so the sheet
rebuilds the Voronoi diagram the generator made in the first place: the map frame
clipped by the perpendicular bisector to every near neighbour. Which bisectors
survive that clip *is* the cell's neighbour list, so the coastline, the realm and
province marches, the river network and the adjacency the router walks all fall out
of one pass — about 170 ms for the whole world. The 3,817 cells are then drawn as
one path per colour rather than one path per cell, so panning stays cheap, and a tap
is resolved back to a cell arithmetically, by nearest site, which is what a Voronoi
cell means anyway.

**Press GRND** to cycle what the ground is coloured by: biome, relief, realms,
peoples, market catchments, supply, population, or habitability. Two of those are
the point of the exercise. **Catchments** shows which of the seventeen markets each
piece of ground actually belongs to, and hatches the 326 land cells that lie beyond
the reach of every one of them — including the whole of Jomhor, which has no market
on it at all. **Supply** is the same surface read as distance: at twenty-five
effective miles a day, half the land is more than forty days from the market that
feeds it.

**Press WAY.** Set two ends and the console finds the least-cost way between them,
priced by the same model that laid the exported network:

    cost = miles x terrain(biome) x slope(climb) + 12 miles per unbridged crossing

The route comes back with its cost in effective miles, what that is in days of
supply, how much further it is than the straight line, and a leg list broken at
every change of biome or realm with the fords and the climb written against it.
Where no overland way exists — 44 of the 136 market pairs are like this — it says
so and names the nearest harbours, because a crossing there would have to be
sailed and no sea legs are drawn.

The browser's router is not an approximation of the Python one. Run over all 136
market pairs it reproduces `network_report.json` to within 0.006 per cent, agrees
on exactly which 44 pairs are unreachable, and assigns all 2,103 catchment cells
identically. That agreement is the test that the rebuilt Voronoi adjacency is the
generator's own.

**Press RCH** on any place to cast a reach: everything within 25, 50, 100, 200 and
400 days of it, with the cells, the people and the burgs inside each band.

**LIST** opens an index of every burg by realm, your own marks, and **the account** —
the figures out of `network_report.json` as the generator wrote them, including the
landmasses and what each one does and does not have a market on.

Marks work as they do on the survey sheet, kept in `localStorage` under their own
key so the two sheets never tread on each other.

Nothing on this sheet is invented. Every figure is either read out of the export or
derived from it by a rule written down here; where the source is silent — sea
routes, in particular, since not one burg is flagged as a working port — the sheet
says it is silent rather than filling in.

### Re-packing the world

The sheet cannot fetch `cells.csv` at runtime and still open from `file://`, so the
exports are packed into one script:

```
python3 tools/pack_adrinem.py
```

That reads `cells.csv`, `roads.geojson`, `markets.geojson`, `ports.csv` and
`network_report.json` from the repository root and writes `js/adrinem-data.js` —
the cell table held column-wise as comma-joined strings, about a third the size of
the equivalent JSON and parsed in one pass on load. Re-run it after regenerating
the exports; do not edit the output by hand.


### The city plate: Oem'rek

A market centre that is also a harbour has a **◉ CITY PLATE** on its info sheet. It
opens the ground under the dot: streets, quays, blocks, the wall and its gates, and
about thirty named places, generated at the moment you press it — a second or less for
most towns — and read block by block.

**Oem'rek** in Kel'Esta is the one it was built and checked against. Nothing on the
plate is drawn by hand. The plan follows from what the export says about cell 461, in
this order:

| What the export says | What it decides |
| --- | --- |
| Exactly one water neighbour, cell 463, bearing −63° | the sea lies north-east |
| `harbor` = 1 — one sea contact | the haven has one mouth, so it is entered and not sailed through, and one chain closes it |
| Land neighbours mean bearing 110° | the town stands on the **south-east shore**; on the other one every road out would have to cross its own harbour |
| Cell 460 next door, `harbor` = 5 | that coast is open and unsheltered — it lands fish and nothing else |
| Highest neighbour at bearing 105°, height 38 against 37 | the citadel and the conduit head go there |
| Cell 551, Wetland, bearing 112° | tanneries, dye yards, salt pans and the burial ground go there, outside the wall |
| `r` = 0 on the cell and on every neighbour | **no river** — the city drinks from cisterns and a conduit, and its grain arrives by sea and by road |
| The road to Bodmouthton, bearing 60°, 11 market pairs | the principal land gate, and the waggon yards outside it |
| The trail west, bearing −177° | a road that points straight across the harbour, so it leaves by the Pan Gate and turns outside the wall |
| Cass'tow: 561,068 people, same realm, **no overland way** | the reason the city exists |

That last line is the whole plate. Kel'Esta contains a second city of Oem'rek's own
size that cannot be reached from it by land at any price, and P'ivka and S'ven in
Dragon Coves are the same. Nearly one and a half million people are on the other side
of water. So the Cass'tow Stair gets its own berths, the Outer Berths take the rest,
and the lazaretto sits on the spit outside everything — a port that is the only sea
road into half a realm cannot afford to guess about a ship.

**How the ground is laid.** A port city is a quay with roads running back from it. The
Staple is set where the principal land road reaches the principal quay; radials leave
it for each gate and each end of the harbour; rings are thrown across them every ninety
metres or so; and the ground between rings and radials is cut into blocks. Every corner
is jittered by a value hashed from its ring and its angle, so the two blocks either
side of a street agree on where the street is — and the wander is scaled to the gap
between rings rather than to the radius, or the rings cross each other and the fabric
comes out as splinters. Minor streets are inserted wherever an arc grows past a block
frontage and carried outward from there, which is why they begin part-way out and never
at the centre.

Two things are then solved rather than chosen:

* **The wall** is drawn at the radius that encloses three-quarters of the city's people
  — so it traces the site instead of being a circle struck round the market, reaching
  further inland than it does along the water. Gates fall where the great roads cross
  it; towers every other node.
* **The size of the town** is a fixed point. A first guess sizes it as a disc at 380
  people a hectare, which is wrong, because the harbour and the far shore take most of
  that disc and the suburbs outside the wall are ribbons along the roads rather than an
  even spread. Each pass measures the density it actually built and scales the next by
  the square root of the error. It settles in two.

Oem'rek comes out at **1,768 blocks over 2,126 hectares**, 86 per cent of its people
inside a wall of about 2.8 km radius at 381 to the hectare, 93 to the hectare in the
ribbons outside, and 3.1 km of quay. Press **USE** to colour the fabric by use, by
storeys or by density; **ACCT** for those figures and the table above; tap any block
for what stands on it and how many live there.

The head count is the export's. Everything else is generated from the site by the
rules above, and where the source is silent the plate says so rather than filling in.
The generator is general — every market centre with a harbour has a plate, nine of them
in all, and they land between 308 and 409 people a hectare without being told to — but
Oem'rek is the one whose landmarks were written against the data by hand.


### The other kind of city: Rithi

A second plate, and a different plan, because Rithi is a different problem. The
generator picks which by reading the network:

> A burg with two trunk roads leaving it on nearly opposite bearings is not a town with
> roads. It is a road with a town on it, and it has to be laid out the other way round.

Exactly one market on the sheet answers to that. **Rithi's two trunks leave 175° apart**
— the Odina road east, 33 market pairs, reaching Mhekinn after 35 cells; the Borlo road
west, 29 pairs, reaching Kel'Esta by way of Cutho's other city. **38 of the 92 reachable
market pairs touch Rithi, first of all 80 burgs in Adrinem**, and 25 of them are only
passing through. The land runs out 66 miles north of it and 176 miles south, and past
the edge of the search east and west: it is a neck, and the road has nowhere else to be.

So the plan is struck from the through-way rather than from a market — except that it
is not, quite, and that is the interesting part.

**The Interdict.** The export says nothing about religion. Cutho's is the author's, set
down in one table at the top of `js/adrinem-city.js` and labelled on the plate as a
premise rather than a reading, because the two kinds of claim must not get mixed up.
It states one thing: *nothing unpurified may stand on consecrated ground, and no
stranger may sleep on it.*

Everything else on the plate is what that costs a city which has to move a third of a
continent through itself:

* **The plan is struck from the sanctuary.** The Temple Rock is the centre, quarried out
  of the volcanic ground the whole site is made of, inside an interdict wall of its own
  with three posterns and no gate a waggon could use.
* **The through-way is bent round it.** The straight line between the Borlo Gate and the
  Odina Gate runs through the middle of the precinct, so the road does not take it. It
  leaves the west gate, runs round the southern skirt of the holy hill and comes back in
  at the east gate — **1.28× the straight line, 1,830 metres of extra road on every
  crossing of Adrinem made by land.** The plate draws the straight line it cannot take
  in red, through the sanctuary, so you can see what the doctrine buys and what it costs.
  The bend goes south because the sea is north: two water cells at bearing −94, and no
  room that way.
* **The strangers sleep outside.** Two wards at the ends of the way, one for each trunk,
  holding **210,373 people — 18 per cent of the city** — on the most valuable ground in
  it, none of which they are permitted to own. They are the densest blocks on the plate
  at around 890 to the hectare.
* **The named trades are exiled** beyond the wall by doctrine rather than by wind, which
  is why the tanners and the slaughter ground are on the lesser road south and not
  downwind of anything.
* **The Unhallowed Market** sits outside the wall, where what may not be traded within
  it is traded anyway, and the city takes its cut of that too.

Rithi comes out at **3,544 blocks over 4,556 hectares**, 89 per cent of its people inside
a wall at 395 to the hectare, 561 hectares of consecrated ground and 159 on the way,
three gates and three posterns. Its harbour is value 2 — two sea contacts and no shelter
worth the name — so the sea is the lesser road here and gets a stair rather than a quay.

The two plates share every mechanism: the same polar mesh, the same jitter, the same
wall solved from a population share, the same fixed point on density. What differs is
where the plan is struck from, what the rules say may stand where, and what gets named.
Adding a third archetype is those three things and nothing else.


## Finding your way round either sheet

Both sheets carry a great deal and almost none of it announces itself, so each opens
with a short guided walk the first time you visit it, and keeps it behind the **?** at
the bottom of the control rail afterwards.

It is not a wall of text over a screenshot. Each step points at the actual control and
**works it as it explains it**: the step about the built fabric turns the fabric on, the
step about projections opens the projection console, the step about search types into
the box and shows you the results. Nothing is described that is not also shown. `→` and
`←` move, `Esc` leaves, and whatever the walk opened is closed again behind it.

* **NYC 2050** — sixteen steps: the sheet and how to move on it, search, the key, the
  coverage and thoroughfare layers, structure heights, the built fabric, the six
  contingency projections and what they report, the hour scrubber, routing with the tide
  and against a projection, the street-level plates, your own marks, and the keys.
* **Adrinem** — fourteen: the plate, search, the eight things the ground can be coloured
  by, the layers, the way-finder and what it does when there is no way, the reach, the
  index and the account, marks, and where the city plates are.
* **A city plate** — six, run the first time you open one: reading a block and a named
  place, colouring the fabric, the key, the account and its separation of what the
  export says from what an author's premise says, and why the two archetypes differ.

`localStorage` remembers that you have seen each of them. `TOUR.reset()` in the console
puts them back.

## Layout

```
index.html          the survey sheet's shell
adrinem.html        the Adrinem plate's shell
css/app.css         all styling
js/data.js          geography, thoroughfares, 304 landmarks, scene links
js/terrain.js       spot heights, made ground, rock, shaking amplification
js/heights.js       roof heights per structure, and the fallbacks
js/fabric.js        block generation, typology, and the spatial index
js/network.js       the walking graph welded out of the streets
js/route.js         edge costs, turn penalties, and the four profiles
js/route-ui.js      the route console
js/gl.js            a small hand-written WebGL2 layer — matrices, shaders, buffers
js/world3d.js       the 3D world: geometry, colliders, broadphase, raycast, trace
js/view3d.js        the solid view — camera, drawing, and the THROW panel
js/debris.js        fragment launch, ballistic flight, penetration, sections
js/map.js           projection, sheet rendering, view state, place naming
js/sim.js           hazards, fragility, the service network, the 24-hour run
js/sim-ui.js        the projection console and the hour scrubber
js/sv-kit.js        street-view drawing primitives
js/sv-scenes.js     the thirteen plates and the walks
js/pins.js          dropped marks and bookmarks (localStorage)
js/streetview.js    the plate viewer
js/app.js           wiring: sheet, drawer, search, pin tools

js/adrinem-data.js     the packed world; generated, not written
js/adrinem-palette.js  the colours the plate is washed in
js/adrinem-world.js    the cell table, the Voronoi, coast, marches, rivers
js/adrinem-route.js    the exported cost model, re-run in the browser
js/adrinem-map.js      the plate renderer and the view state
js/adrinem-app.js      wiring: plate, index, search, way-finder, marks
js/adrinem-city.js     the city generator: site, water, plan, blocks, wall, names,
                       both archetypes, and the doctrine table
js/adrinem-cityview.js the city plate viewer
js/tour.js             the guided walk, and the step scripts for both sheets
tools/pack_adrinem.py  the exports -> js/adrinem-data.js

adrinem_infra.py    the generator-side pipeline that wrote the exports
cells.csv           per-cell table, 3,817 rows
roads.geojson       the trade network, 548 segments classed by usage
markets.geojson     the 17 market centres
catchments.geojson  per-cell market assignment (also carried in cells.csv)
ports.csv           the 28 harbour-capable burgs
network_report.json the pair matrix and the summary figures

build.js            inlines each sheet into dist/
legacy/             the original single-file demo, kept for reference
```

## The coordinate frame

Everything in `data.js` is in **grid space**, the survey's working frame:

* `x` runs cross-island, **Fifth Avenue is 0**, east positive
* `y` runs along-island, **Houston Street is 0**, north positive
* one street is 8 units, one avenue about 24, and a unit is roughly 33 feet

`map.js` rotates that 29° east of north on draw, which is the angle the
Manhattan grid actually sits at. `NYC.map.describe(x, y)` turns any point back
into something a person can read — `MANHATTAN · W 34 ST nr 8 AV`,
`BROOKLYN · nr EASTERN PKWY`, `EAST RIVER`.

## World space

The 3D world is in metres, and one grid unit on the survey sheet is ten of them.

* world `x` = grid `x` × 10, east
* world `y` = metres above the 2050 waterline
* world `z` = −grid `y` × 10, so north is −z

Blocks are axis-aligned in that frame because the Manhattan grid is, which is what
makes the collider set cheap; the outer boroughs carry a yaw, stored per collider
for an engine that wants the true oriented box. `NYC.world3d.g2w()` and `w2g()`
convert either way.

## How a link is priced

Every edge carries a time and a risk, and a profile decides how much the second
one matters. The risk side reads the same sources as the rest of the sheet: the
elevation surface and the tide for water, the block layer for what might come off
a building (an old tall block over a narrow street is worse than the same block
over an avenue), the named structures for their fall lines, and the projection,
if one is up, for fire, rubble and new flooding. The search runs over directed
edges rather than nodes so that turning off a street can be made to cost
something — without that, a grid produces a staircase, because every zigzag
between two points on a lattice is exactly the same length.

## Adding a hazard

`HAZARDS` in `js/sim.js` holds the six. A hazard is a name, a blurb, a list of
slider parameters, whether it needs a point on the sheet, and a `focus` zoom.
The run loop reads `H.id` at four places — set-up, per-hour effect, overlay
geometry, and the narrative — so a seventh is four small additions and no
changes to anything else. Damage is written into `s.struct`; the service
cascade, the tally, the scrubber and the write-up all follow from that.

## Adding a plate

Draw into a 1200 × 700 box with the ground near `y = 470`, put anything caused
by the collapse in `G(..., {class:"decay"})` and anything that only existed
before it in `G(..., {class:"intact"})` — the then/now switch does the rest.
Then add the scene to `SCENES` in `js/sv-scenes.js`, list it in a walk, and
point at it from `SCENE_OF` in `js/data.js` by the landmark's name.
