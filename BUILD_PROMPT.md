# Build Prompt — Virtual Disneyland Walkthrough (Claude Code + Fable 5)

> Paste everything below the line into Claude Code running **claude-fable-5** at high effort.
> Run it from an empty project folder. Let it work autonomously; it will self-verify as it goes.

---

## ROLE & GOAL

You are building a **first-person, walkable 3D recreation of Disneyland Park (Anaheim, CA)** that runs in a desktop browser. This is a personal project to push your capabilities — not a shipped product. Prioritize an **intentional, stylized art direction** (low-poly diorama construction elevated by excellent lighting, atmosphere, and post-processing) over photorealism. It should look deliberate and beautiful, never uncanny or half-finished.

Work in a **vertical slice first, then expand** order (see BUILD ORDER). Do not attempt to build the entire park at once. Get one land feeling great — movement, audio, day/night, a collectible, the guide — then replicate the pattern land by land.

Treat the reference Fable 5 world demo (`Braffolk/fable5-world-demo`, "Laas") as the quality and architecture bar: TypeScript strict (zero `any`), clean engine/world separation, verification tooling, and working notes you maintain as you go.

## TECH STACK

- **Three.js** (WebGL2 renderer for max compatibility; you may use WebGPU only if you also provide a WebGL2 fallback).
- **TypeScript**, strict mode, no `any`.
- **Vite** for dev server + build.
- Post-processing via `postprocessing` or Three's `EffectComposer` (bloom, ambient occlusion, tone mapping, subtle color grading — this is where "stylized but gorgeous" is won).
- No game engine (no Unity/Unreal). Pure Three.js + TS.
- Pointer-lock first-person controls (WASD + mouse look, shift to sprint).

## ART DIRECTION

- Low-poly / stylized geometry, but **carry the look with lighting, fog, bloom, soft shadows, and color grading**, not polygon count.
- Distinct palette and mood per land (Main Street warm nostalgic; Tomorrowland cool metallic; Adventureland lush green; Fantasyland storybook pastel; etc.).
- Landmark buildings (Sleeping Beauty Castle, the train station, the Matterhorn, Space Mountain, the Enchanted Tiki Room, Pirates façade) get extra geometry budget and are recognizable silhouettes. Everything else can be simpler.
- The castle is the visual anchor at the end of Main Street and must read as Sleeping Beauty Castle from the hub.

## MAP ACCURACY

- Use an **up-to-date park layout**. Pull building footprints and path geometry from **OpenStreetMap** (Disneyland Park, Anaheim) as the ground-truth blockout for where lands, paths, and major structures sit. Accurate *layout* matters more than accurate building detail.
- Lands to include: **Main Street U.S.A., Adventureland, New Orleans Square, Frontierland, Critter Country, Fantasyland, Mickey's Toontown, Tomorrowland**, plus the Central Plaza (hub) and the castle.
- Represent the berm/train loop as the park's outer boundary. Player cannot leave the park.

## CORE FEATURES

### 1. First-person movement
- WASD move, mouse look (pointer lock), Shift to sprint, Space optional.
- Collision so you can't walk through buildings, water, or planters. Keep to paths and open areas.
- Comfortable walking speed tuned so crossing the park takes a believable amount of time (not instant, not tedious).

### 2. Day / night toggle
- A HUD control switches between **day** and **night** presets.
- Day: bright sky, warm sun, soft shadows.
- Night: dark blue sky, thousands of warm window/string lights, lit castle, lantern glow, stronger bloom. Night should feel magical and is the primary "wow" state — invest here.
- Smooth transition between the two, not a hard cut.

### 3. Per-land positional/zone audio
- **Zone-based crossfading**, NOT point-source positional audio. The park is divided into land polygons; detect which land the player is in and crossfade to that land's track over ~1.5s.
- Drive it entirely from a single editable config file so the user can swap MP3s without touching code:

```ts
// src/config/audio.ts
export const AUDIO_ZONES = {
  mainStreet:      { file: "/audio/main-street.mp3" },
  adventureland:   { file: "/audio/adventureland.mp3" },
  neworleans:      { file: "/audio/new-orleans-square.mp3" },
  frontierland:    { file: "/audio/frontierland.mp3" },
  critterCountry:  { file: "/audio/critter-country.mp3" },
  fantasyland:     { file: "/audio/fantasyland.mp3" },
  toontown:        { file: "/audio/toontown.mp3" },
  tomorrowland:    { file: "/audio/tomorrowland.mp3" },
  hub:             { file: "/audio/hub.mp3" },
} as const;
```

- Ship **silent placeholder MP3s** in `/public/audio/` with these exact filenames so the app runs before the user adds real audio. Document in the README that the user drops their own MP3s into `/public/audio/` using these names, or edits `audio.ts` to point elsewhere.
- Include a HUD mute toggle and volume slider. Handle the browser autoplay policy (audio starts on first user interaction / pointer-lock).

### 4. Crowd simulation from historical data
- The user picks a **date** (HUD date picker). The app computes a **crowd level 1–10** for that date and spawns NPC pedestrian density to match (level 1 ≈ nearly empty, level 10 ≈ packed walkways and clustered queues).
- Build the crowd level from an **editable model**, calibrated against **Thrill Data's 2026 Disneyland crowd calendar**:

```ts
// src/config/crowds.ts
// Calibrate these against Thrill Data 2026 monthly averages.
// Fetch https://www.thrill-data.com/trip-planning/crowd-calendar/disneyland
// during the build and populate MONTH_BASELINE with the real 2026 monthly
// average crowd level (1-10). If unreachable, seed with the documented shape
// below (summer + holidays high, mid-Jan and early-Sept low) and leave a
// clear TODO so the user can correct values.
export const MONTH_BASELINE: Record<number, number> = { /* 1-12 -> 1..10 */ };
export const DOW_MULTIPLIER: Record<number, number> = { /* Sun..Sat */ };
export const HOLIDAYS: Record<string, number> = { /* "YYYY-MM-DD" -> level override */ };
export const TIME_OF_DAY_CURVE = /* hour -> density factor, midday peak */;
```

- Final level = clamp(baseline × day-of-week × holiday × time-of-day, 1, 10). Deterministic for a given date/time — no live API dependency at runtime.
- NPCs: simple stylized low-poly pedestrians with cheap crowd-walking behavior (wander along paths, mill near attractions). Use instancing so hundreds render cheaply. They are ambiance — no collisions required beyond soft avoidance, and no faces/detail needed.
- Show the computed crowd level and a label (e.g., "Labor Day — Level 8/10") in the HUD.

### 5. Scavenger hunt
- Collectible **golden stars** hidden around the park. Finding one:
  - plays a chime + sparkle effect,
  - increments a collected counter,
  - reveals a **text clue** pointing to the next star's location.
- Stars are found in sequence (clue → next star → clue). Store the star locations + clues in an editable config so the user can rewrite the hunt:

```ts
// src/config/scavenger.ts
export const STARS = [
  { id: 1, position: [x,y,z], clue: "Where the horseless carriages begin your day..." },
  // ...
];
```

- Persist progress in `localStorage` so a refresh doesn't reset the hunt. Include a "reset hunt" button in the HUD.
- Collecting all stars triggers a small celebration (fireworks over the castle at night is a nice payoff).

### 6. LLM tour guide (Gemini)
- A HUD chat panel: the user asks questions ("Where's the Matterhorn?", "Tell me about New Orleans Square") and a **Gemini-powered** guide answers in-character as a friendly Disneyland tour guide.
- Give the guide **context**: the current land the player is in, the list of lands/attractions and their positions, day/night state, and scavenger progress — so it can actually give directions ("Head left past the castle toward Tomorrowland").
- **API key handling:** read the key from an environment variable via Vite (`import.meta.env.VITE_GEMINI_API_KEY`). Create a `.env.example` documenting the variable, and a `.gitignore` that excludes `.env` and `node_modules`. Note in the README that for local use the key can live in `.env`, and that if the user later deploys publicly they should move the call behind a proxy — but do not build a proxy now; local `.env` is fine per the user's decision.
- Gracefully handle a missing key (guide panel shows "add your Gemini key to .env to enable the guide" instead of crashing).

### 7. HUD
Single clean overlay, unobtrusive, toggle-hideable (e.g., `H` key). Contains:
- Day/Night toggle
- Date picker + current crowd level readout
- Audio mute + volume
- Scavenger progress (stars collected / total) + current clue
- Tour guide chat panel (collapsible)
- A small controls legend (WASD / mouse / sprint / hide HUD)

## PROJECT STRUCTURE (suggested)

```
/public/audio/        # placeholder + user-supplied MP3s
/src/
  main.ts
  engine/             # renderer, camera, controls, post-processing, day/night
  world/              # terrain, lands, buildings, props, NPC crowd system
  systems/            # audio zones, scavenger hunt, crowd model, guide
  config/             # audio.ts, crowds.ts, scavenger.ts, lands.ts
  ui/                 # HUD components
  data/               # OSM-derived layout, land polygons
.env.example
.gitignore
README.md
NOTES.md              # your running architecture + decisions log
```

## BUILD ORDER (do not skip the slice)

1. **Scaffold**: Vite + TS strict + Three.js, empty scene, FPS controls, pointer lock, a ground plane, post-processing pipeline, day/night toggle. Verify it runs and both lighting states look good.
2. **Vertical slice**: Build **Main Street + the hub + Sleeping Beauty Castle** to target quality. Wire in ONE audio zone, day/night, ONE scavenger star with a clue, the HUD shell, and a working (stubbed if needed) guide panel. This slice must *feel* right before expanding.
3. **Layout pass**: Pull OSM footprints; lay out all land boundaries, paths, and landmark positions across the full park as blockout.
4. **Land-by-land**: Flesh out each land to slice quality — Adventureland, New Orleans Square, Frontierland, Critter Country, Fantasyland, Toontown, Tomorrowland. Add each land's audio zone.
5. **Crowd system**: Implement the crowd model + instanced NPCs + date picker; calibrate to Thrill Data 2026.
6. **Scavenger hunt**: Place the full star sequence + clues + completion celebration.
7. **Guide**: Full Gemini integration with live context.
8. **Polish**: post-processing tuning, night lighting, performance pass (instancing, LOD, frustum culling), README.

## VERIFICATION (do this continuously, not just at the end)

- After each stage, run the dev server and **use vision to screenshot the scene in both day and night** and critique it against this spec. Fix what looks off before moving on.
- Keep TypeScript strict passing (zero `any`, zero errors) at every stage.
- Target a smooth frame rate on a typical laptop even at crowd level 10 — profile and optimize (instancing, LOD, culling) if it drops.
- Verify each interactive system independently: audio crossfades at land boundaries, day/night transitions, star collection + clue reveal + localStorage persistence, crowd density visibly changes with date, guide answers with correct directional context.
- Maintain `NOTES.md` with architecture decisions and anything the user needs to know.

## DELIVERABLE

A `npm install && npm run dev` project that opens in Chrome to a walkable, stylized Disneyland. A README covering: how to run it, where to drop MP3s, how to set the Gemini key, how to edit the scavenger hunt, and how to adjust the crowd model.
