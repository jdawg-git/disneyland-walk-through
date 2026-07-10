# Disneyland Virtual

A first-person, walkable, stylized 3D recreation of Disneyland Park (Anaheim)
that runs in a desktop browser. Low-poly diorama look carried by lighting,
fog, bloom, and color grading. Built with Three.js + TypeScript + Vite.

> **Status: under construction** — currently at the scaffold stage. This
> README fills out as the park does.

## Run it

```bash
npm install
npm run dev
```

Open the printed URL in Chrome. Click to enter the park.

**Controls**: WASD move · mouse look · Shift sprint · N day/night · H hide HUD · Esc release mouse

## Scripts

| command | what it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | typecheck + production build |
| `npm run typecheck` | TypeScript strict check |
| `npm run verify` | headless screenshot suite (day + night per viewpoint) into `verify/` |
| `npm run gen:audio` | regenerate silent placeholder MP3s |
| `npm run fetch:osm` | re-fetch the OpenStreetMap park layout (maintenance) |

## Custom audio

Drop your own MP3s into `public/audio/` using the filenames listed in
`src/config/audio.ts` (e.g. `main-street.mp3`). Silent placeholders ship by
default, so the app runs without them.

## Gemini tour guide key

Copy `.env.example` to `.env` and paste your key into
`VITE_GEMINI_API_KEY`. Without a key the guide panel shows setup
instructions instead of answering; nothing else is affected.
