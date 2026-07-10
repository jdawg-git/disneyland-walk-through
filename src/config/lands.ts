import type { AudioZoneId } from "./audio";
import type { Pt } from "../data/parkLayout";

/**
 * Hand-authored land polygons over the OSM-derived coordinate space
 * (meters, origin at the hub, +X east, −Z north — z grows southward).
 * These drive the audio zones, HUD land label, guide context, and per-land
 * building palettes.
 *
 * Authoring aid: run the dev server with ?debug=map for a top-down view of
 * the baked OSM layout with a coordinate readout (click logs coordinates).
 *
 * First polygon containing the player wins; keep `hub` last (crossroads).
 * Anchors used (from park-layout.json): castle (6,−12), Main St Station
 * (3,300), Tiki Room (−53,114), Treehouse (−146,157), Pirates (−200,190),
 * NOS Station (−267,160), Haunted Mansion (−302,120), Winnie the Pooh
 * (−390,−5), Big Thunder (−124,4), Rivers of America (−258,−36), Dumbo
 * (8,−107), Matterhorn (109,−39), Small World (114,−248), Toontown Lake
 * (−22,−272), Space Mountain (139,192), Tomorrowland Lagoon (181,−33).
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

export const LANDS: readonly LandDef[] = [
  {
    id: "mainStreet",
    name: "Main Street, U.S.A.",
    audioZone: "mainStreet",
    palette: {
      walls: [0xc9695a, 0xd9a066, 0xb8d0b2, 0x9db4d6, 0xd8b8c8, 0xe0cfa8],
      roofs: [0x71564c, 0x5c6670, 0x6b5a68],
      trim: 0xf2e7d5,
      glow: 0xffc266,
    },
    polygon: [
      [-45, 336],
      [62, 336],
      [62, 105],
      [-45, 105],
    ],
  },
  {
    id: "adventureland",
    name: "Adventureland",
    audioZone: "adventureland",
    palette: {
      walls: [0xa8845a, 0x8a9a5a, 0xb09468, 0x97795c],
      roofs: [0x6b5334, 0x57603a],
      trim: 0xd8c8a0,
      glow: 0xffd080,
    },
    polygon: [
      [-45, 140],
      [-45, 95],
      [-175, 95],
      [-175, 215],
      [-90, 215],
    ],
  },
  {
    id: "neworleans",
    name: "New Orleans Square",
    audioZone: "neworleans",
    palette: {
      walls: [0xc8a8b8, 0xd8b890, 0x88a8a0, 0xbfa0c0],
      roofs: [0x474352, 0x3d4a4e],
      trim: 0xe8dcc8,
      glow: 0xffc890,
    },
    polygon: [
      [-175, 95],
      [-175, 230],
      [-340, 230],
      [-340, 95],
    ],
  },
  {
    id: "critterCountry",
    name: "Critter Country",
    audioZone: "critterCountry",
    palette: {
      walls: [0x8a7458, 0xa08a68, 0x96805e],
      roofs: [0x4f4438, 0x5c5040],
      trim: 0xc8b898,
      glow: 0xffcf90,
    },
    polygon: [
      [-330, 115],
      [-330, -60],
      [-435, -60],
      [-435, 115],
    ],
  },
  {
    id: "frontierland",
    name: "Frontierland",
    audioZone: "frontierland",
    palette: {
      walls: [0x9a6a48, 0xb08858, 0x8a5a40, 0xa87e50],
      roofs: [0x5a4638, 0x6b503c],
      trim: 0xd0b088,
      glow: 0xffb860,
    },
    polygon: [
      [-45, 95],
      [-340, 95],
      [-340, -80],
      [-100, -80],
      [-60, -10],
      [-45, 40],
    ],
  },
  {
    id: "fantasyland",
    name: "Fantasyland",
    audioZone: "fantasyland",
    palette: {
      walls: [0xd8b8d8, 0xb8cce0, 0xe8d0a8, 0xc8e0c0, 0xe0c0b0],
      roofs: [0x7a5a8a, 0x4a6a9a, 0x8a5a5a],
      trim: 0xf0e8d8,
      glow: 0xffd8a0,
    },
    polygon: [
      [-60, -2],
      [80, -2],
      [80, -25],
      [148, -25],
      [148, -270],
      [75, -270],
      [75, -232],
      [-60, -232],
    ],
  },
  {
    id: "toontown",
    name: "Mickey's Toontown",
    audioZone: "toontown",
    palette: {
      walls: [0xe86858, 0xf0b048, 0x58a8e0, 0x78c858, 0xe088b8],
      roofs: [0xd04838, 0x3878c0, 0xe8a020],
      trim: 0xfff0d0,
      glow: 0xfff0a0,
    },
    polygon: [
      [-80, -232],
      [75, -232],
      [75, -312],
      [-80, -312],
    ],
  },
  {
    id: "tomorrowland",
    name: "Tomorrowland",
    audioZone: "tomorrowland",
    palette: {
      walls: [0x9ab0c0, 0x7a92a8, 0xb8c8d8, 0x8aa4b8],
      roofs: [0x5a7288, 0x4a6078],
      trim: 0xd8e8f0,
      glow: 0x9adfff,
    },
    polygon: [
      [60, 100],
      [105, 215],
      [230, 215],
      [230, -190],
      [148, -190],
      [148, -25],
      [60, -25],
      [60, 25],
    ],
  },
  {
    id: "hub",
    name: "Central Plaza",
    audioZone: "hub",
    palette: {
      walls: [0xd9c9a8, 0xc9b898],
      roofs: [0x6b5a52],
      trim: 0xf2e7d5,
      glow: 0xffd28a,
    },
    polygon: [
      [-60, 80],
      [-30, 105],
      [35, 105],
      [60, 80],
      [60, 25],
      [35, 5],
      [-30, 5],
      [-60, 25],
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
