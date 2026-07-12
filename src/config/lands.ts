import type { AudioZoneId } from "./audio";
import type { Pt } from "../data/parkLayout";

/**
 * Hand-authored land polygons over the OSM-derived coordinate space
 * (meters, origin at the hub, +X east, −Z north — z grows southward).
 * These drive the audio zones, HUD land label, guide context, and per-land
 * building palettes.
 *
 * v3: re-traced against the guest-map-filtered layout (?debug=map) so each
 * land hugs its actual content — Toontown reaches its real footprint,
 * Plaza Inn sits on Main Street, the Small World mall is Fantasyland, and
 * Pirates lands in New Orleans Square. Palettes are tuned to the vibrant
 * cartoon-realism direction: luminous, high-chroma, photo-informed colors.
 *
 * Authoring aid: run the dev server with ?debug=map for a top-down view of
 * the baked layout with a coordinate readout (click logs coordinates).
 *
 * First polygon containing the player wins; keep `hub` last (crossroads).
 * Anchors (from park-layout.json): castle (6,−12), Main St Station (3,300),
 * Plaza Inn (63,112), Tiki Room (−53,114), Treehouse (−146,157), Indiana
 * Jones (−190,244), Pirates (−200,190), NOS Station (−267,160), Haunted
 * Mansion (−302,120), Winnie the Pooh (−391,−5), Tiana's (−344,73), Big
 * Thunder (−124,4), Rivers of America (−258,−36), Matterhorn (109,−39),
 * Small World (114,−248), Minnie's House (−2,−317), Runaway Railway
 * (17,−357), Space Mountain (151,162), Autopia (~230,−100), Tomorrowland
 * Theater (228,76).
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
  /** Base ground tint; plazas render slightly lighter on top. */
  readonly ground: number;
}

export const LANDS: readonly LandDef[] = [
  {
    id: "mainStreet",
    // Bright brick-red street (reference: red pavement + streetcar rails).
    ground: 0x8e5349,
    name: "Main Street, U.S.A.",
    audioZone: "mainStreet",
    palette: {
      // Victorian storefronts: cream, coral, sage, sky, rose, butter.
      walls: [0xf6ead2, 0xe8b49c, 0xd8e2c4, 0xc4d6ea, 0xf0d0da, 0xf2dca2],
      roofs: [0x4a5f7a, 0x3f6650, 0x8a4444],
      trim: 0xfff4e0,
      glow: 0xffc266,
    },
    polygon: [
      [-48, 348],
      [70, 348],
      [70, 102],
      [-48, 102],
    ],
  },
  {
    id: "adventureland",
    ground: 0xc4a05e,
    name: "Adventureland",
    audioZone: "adventureland",
    palette: {
      // Jungle trading post: terracotta, olive, bamboo tan.
      walls: [0xd8a05e, 0xa4b452, 0xc88a54, 0xb89468],
      roofs: [0x7a5a30, 0x5f6b38],
      trim: 0xe8d8a8,
      glow: 0xffd080,
    },
    polygon: [
      [-48, 95],
      [-48, 152],
      [-120, 262],
      [-195, 262],
      [-195, 152],
      [-175, 120],
      [-175, 95],
    ],
  },
  {
    id: "neworleans",
    ground: 0x9a9088,
    name: "New Orleans Square",
    audioZone: "neworleans",
    palette: {
      // Cream/tan stucco with sage + rose iron (reference photos).
      walls: [0xf0dcbe, 0xe8c8a0, 0xe0b0b8, 0xc8dcd0],
      roofs: [0x51586a, 0x475258],
      trim: 0xfaf0dc,
      glow: 0xffc890,
    },
    polygon: [
      [-175, 95],
      [-175, 120],
      [-195, 152],
      [-195, 262],
      [-310, 262],
      [-310, 95],
    ],
  },
  {
    id: "critterCountry",
    ground: 0xa08a5c,
    name: "Bayou Country",
    audioZone: "critterCountry",
    palette: {
      // Mossy bayou woods: warm timber + leafy green.
      walls: [0xb08c58, 0x94a860, 0xc09c6c],
      roofs: [0x5a4a34, 0x66744a],
      trim: 0xd8c8a0,
      glow: 0xffcf90,
    },
    polygon: [
      [-310, 130],
      [-450, 130],
      [-450, -80],
      [-310, -80],
    ],
  },
  {
    id: "frontierland",
    ground: 0xb59a6e,
    name: "Frontierland",
    audioZone: "frontierland",
    palette: {
      // Sun-baked western street: warm reds and ochres.
      walls: [0xc87848, 0xdb9c58, 0xa86038, 0xe0b070],
      roofs: [0x6a4a34, 0x7a5540],
      trim: 0xe8c890,
      glow: 0xffb860,
    },
    polygon: [
      [-48, 95],
      [-310, 95],
      [-310, -80],
      [-260, -130],
      [-100, -130],
      [-62, -2],
      [-48, 40],
    ],
  },
  {
    id: "fantasyland",
    ground: 0xb0a8a2,
    name: "Fantasyland",
    audioZone: "fantasyland",
    palette: {
      // Storybook Bavarian village: luminous pastels.
      walls: [0xf4d8e4, 0xcfe0f4, 0xf7e3b4, 0xd4ecc8, 0xf4cfc0],
      roofs: [0x7a5aa8, 0x4a72c0, 0xa85a6a],
      trim: 0xfff6e4,
      glow: 0xffd8a0,
    },
    polygon: [
      [-62, 0],
      [62, 0],
      [75, -25],
      [165, -25],
      [165, -215],
      [125, -215],
      [125, -260],
      [75, -260],
      [75, -232],
      [-62, -232],
    ],
  },
  {
    id: "toontown",
    ground: 0xd0b078,
    name: "Mickey's Toontown",
    audioZone: "toontown",
    palette: {
      // Cartoon primaries, full saturation.
      walls: [0xf05848, 0xf8b838, 0x48a8e8, 0x70cc58, 0xe888c0],
      roofs: [0xd84838, 0x3880d0, 0xf0a818],
      trim: 0xfff0d0,
      glow: 0xfff0a0,
    },
    polygon: [
      [-95, -232],
      [75, -232],
      [75, -260],
      [125, -260],
      [125, -385],
      [-95, -385],
    ],
  },
  {
    id: "tomorrowland",
    ground: 0xa4b0bc,
    name: "Tomorrowland",
    audioZone: "tomorrowland",
    palette: {
      // Clean space-age whites and cool blues (Space Mountain reference).
      walls: [0xdce8f0, 0x9fc4dc, 0xc0d4e4, 0x88aac8],
      roofs: [0xc4ccd4, 0xaeb8c2],
      trim: 0xf0f8ff,
      glow: 0x9adfff,
    },
    polygon: [
      [62, 102],
      [105, 220],
      [225, 220],
      [320, 60],
      [320, -100],
      [230, -220],
      [165, -220],
      [165, -25],
      [75, -25],
      [62, 20],
    ],
  },
  {
    id: "hub",
    ground: 0xc4b298,
    name: "Central Plaza",
    audioZone: "hub",
    palette: {
      walls: [0xf0e0c0, 0xe4d0a8],
      roofs: [0x6b5a52],
      trim: 0xfff4e0,
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
