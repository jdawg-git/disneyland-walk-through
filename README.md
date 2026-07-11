# Disneyland Walk Through

A first-person, walkable, stylized 3D recreation of Disneyland Park (Anaheim)
that runs in a desktop browser. Low-poly diorama look carried by lighting,
fog, bloom, and color grading — night is the showcase. Built with Three.js +
strict TypeScript + Vite; the park layout is derived from real OpenStreetMap
data.

## Run it

```bash
npm install
npm run dev
```

Open the printed URL in Chrome and click to enter the park. You spawn in
Town Square looking up Main Street at Sleeping Beauty Castle.

**Controls**: WASD move · mouse look · hold **Shift** to run · **N** day/night ·
**H** hide HUD · **Esc** frees the cursor for the HUD (click the view to keep walking)

## What's inside

- **The whole park**: Main Street U.S.A., Adventureland, New Orleans Square,
  Frontierland, Critter Country, Fantasyland, Mickey's Toontown,
  Tomorrowland, and the Central Plaza, laid out from real OSM footprints,
  ringed by the railroad berm (you can't leave the park).
- **Landmarks**: bespoke Sleeping Beauty Castle, Main Street Station, the
  Matterhorn, Space Mountain, the Enchanted Tiki Room, Pirates of the
  Caribbean, the Haunted Mansion, Big Thunder buttes, and it's a small world.
- **Day/night toggle** with a smooth 4-second transition. At night thousands
  of emissive windows, string lights, and lamp globes bloom to life and the
  castle is floodlit.
- **Per-land music zones** that crossfade as you cross land boundaries.
- **Ambient crowds**: wandering guests fill the walkways at a typical-day
  density, with a quiet crowd-murmur audio bed under the land music.
- **Scavenger hunt**: 12 golden stars found in sequence, clue by clue, ending
  with fireworks over the castle.
- **AI tour guide**: a Gemini-powered guide who knows where you are and gives
  real directions.

## Custom audio

Silent placeholders ship in `public/audio/` so the app runs as-is. Drop your
own MP3s into that folder using the exact filenames listed in
[src/config/audio.ts](src/config/audio.ts) (e.g. `main-street.mp3`,
`fantasyland.mp3`), or edit that file to point at different paths. Volume and
mute live in the HUD; audio starts after your first click (browser autoplay
policy).

## Gemini tour guide key

```bash
cp .env.example .env
# paste your key from https://aistudio.google.com/apikey into .env
```

Restart the dev server. Without a key the guide panel shows setup
instructions instead of answering; everything else works normally.

> **Security note**: the guide's prompt is hardened against chat misuse —
> it refuses off-topic/jailbreak requests, caps input length, rate-limits
> questions, and scrubs key-like strings from anything it displays. But the
> key itself is embedded in the client bundle (visible in browser devtools),
> so prompt hardening protects your quota from mischief *through the chat
> only*. Sharing with trusted colleagues is fine; set a spending cap in
> Google AI Studio as a backstop, and move the call behind a server-side
> proxy before any public deployment.

## Editing the scavenger hunt

Stars and clues live in [src/config/scavenger.ts](src/config/scavenger.ts):
`position` is `[x, y, z]` in park meters (origin at the hub, +x east,
−z north), `clue` is the text that points TO that star. Progress persists in
localStorage; the HUD has a reset button. A unit test
(`npm test`) validates every star is reachable — run it after editing.
To find coordinates, open the dev server with `?debug=map` for a top-down
park map: the cursor readout shows park coordinates and clicking logs them
to the console.

## Adjusting the crowds

The park always shows a typical average day (level 5/10, set as
`AVERAGE_LEVEL` in [src/main.ts](src/main.ts)). The full historical crowd
model still lives in [src/config/crowds.ts](src/config/crowds.ts) and backs
the dev URL params — `?date=2026-12-28&hour=14` reproduces any date's
density (Christmas week is packed; a September Wednesday is empty).
`MAX_NPCS` caps rendered guests.

## Scripts

| command | what it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | typecheck + production build |
| `npm run typecheck` | TypeScript strict check (zero `any`) |
| `npm test` | unit tests (crowd model, star placement, guide bearings) |
| `npm run verify` | headless screenshot suite — every viewpoint in day + night into `verify/` |
| `npm run gen:audio` | regenerate silent placeholder MP3s |
| `npm run fetch:osm` | re-fetch the OpenStreetMap layout bake (maintenance) |

## Dev URL parameters

`?cam=x,y,z,yaw,pitch` fixed camera (no pointer lock) · `&time=day|night` ·
`&date=YYYY-MM-DD&hour=H` crowd state · `&seed=N` deterministic scatter ·
`&freeze=1` halt animation · `&hud=0` hide HUD · `?debug=map` top-down
layout view.

See [NOTES.md](NOTES.md) for architecture decisions.
