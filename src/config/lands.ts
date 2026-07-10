import type { AudioZoneId } from "./audio";
import type { Pt } from "../data/parkLayout";

/**
 * Hand-authored land polygons over the OSM-derived coordinate space
 * (meters, origin at the hub, +X east, −Z north). These drive the audio
 * zones, HUD land label, guide context, and per-land building palettes.
 *
 * Authoring aid: run the dev server with ?debug=map for a top-down view of
 * the baked OSM layout with a coordinate readout.
 *
 * First polygon containing the player wins; keep `hub` last (crossroads).
 */

export type LandId =
  | "mainStreet"
  | "adventureland"
  | "neworleans"
  | "frontierland"
  | "critterCountry"
  | "fantasyland"
  | "toontown"
  | "tomorrowland"
  | "hub";

export interface LandPalette {
  /** Facade base colors cycled per building. */
  readonly walls: readonly number[];
  readonly roofs: readonly number[];
  readonly trim: number;
  /** Window glow color at night. */
  readonly glow: number;
}

export interface LandDef {
  readonly id: LandId;
  readonly name: string;
  readonly polygon: readonly Pt[];
  readonly audioZone: AudioZoneId;
  readonly palette: LandPalette;
}

const MAIN_STREET_PALETTE: LandPalette = {
  walls: [0xc9695a, 0xd9a066, 0xb8d0b2, 0x9db4d6, 0xd8b8c8, 0xe0cfa8],
  roofs: [0x71564c, 0x5c6670, 0x6b5a68],
  trim: 0xf2e7d5,
  glow: 0xffc266,
};

const HUB_PALETTE: LandPalette = {
  walls: [0xd9c9a8, 0xc9b898],
  roofs: [0x6b5a52],
  trim: 0xf2e7d5,
  glow: 0xffd28a,
};

/**
 * Stage 2 covers Main Street + the hub; remaining land polygons are
 * authored in stage 3 with the ?debug=map view.
 */
export const LANDS: readonly LandDef[] = [
  {
    id: "mainStreet",
    name: "Main Street, U.S.A.",
    audioZone: "mainStreet",
    palette: MAIN_STREET_PALETTE,
    polygon: [
      [-52, 336],
      [62, 336],
      [62, 104],
      [-52, 104],
    ],
  },
  {
    id: "hub",
    name: "Central Plaza",
    audioZone: "hub",
    palette: HUB_PALETTE,
    polygon: [
      [-78, 104],
      [80, 104],
      [80, -2],
      [-78, -2],
    ],
  },
];

export function landAt(x: number, z: number): LandDef | null {
  for (const land of LANDS) {
    let inside = false;
    const poly = land.polygon;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (!a || !b) continue;
      if (a[1] > z !== b[1] > z) {
        const ix = ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0];
        if (x < ix) inside = !inside;
      }
    }
    if (inside) return land;
  }
  return null;
}
