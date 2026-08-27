# NYC 2050

A map app for walking through a New York that has been left to the water.

The sheet is drawn as a survey document rather than a road map: Manhattan is
banded by habitability, every logged site carries a *disposition* (flooded,
collapsed, salvage, sealed, standing, occupied), and the ground the survey never
covered is left hatched. Thirteen sites also have a **street-level plate** — a
procedurally drawn view of the place as the survey found it, with a switch to
see it as it was built — and any of six **contingency projections** can be run
across the sheet to see what a further disaster would take.

**Preview: https://abcdesi327.github.io/NYC2050/**

Or open `index.html` in a browser. There is no build step, no server and no
dependencies; `dist/nyc2050.html` is the same app inlined into a single file if
you want to hand someone one thing.

The preview is rebuilt and redeployed by `.github/workflows/pages.yml` on every
push to `main` or to the feature branch, and can be kicked off by hand from the
Actions tab. `build.json` at the site root records the commit it was built from.

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

Keys: `/` search · `P` pin · `B` marks · `K` key · `S` projections · `N` navigate
· `H` heights · `F` fabric · `3` solid view · in a plate `←` `→` walk, `T` then/now, `Esc` out.

## Layout

```
index.html          the shell
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
build.js            inlines the above into dist/nyc2050.html
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
