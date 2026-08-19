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

Between the logged stations the fabric is still there, so a corridor is filled in
with typical buildings from the density model; where the survey did log a station
on that block the strike is attributed to it. The console draws a **section under
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

Keys: `/` search · `P` pin · `B` marks · `K` key · `S` projections · `H` heights
· in a plate `←` `→` walk, `T` then/now, `Esc` out.

## Layout

```
index.html          the shell
css/app.css         all styling
js/data.js          geography, thoroughfares, 304 landmarks, scene links
js/terrain.js       spot heights, made ground, rock, shaking amplification
js/heights.js       roof heights per structure, and the fallbacks
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
