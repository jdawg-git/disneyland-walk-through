import type { LandId } from "./lands";
import type { WallKind } from "../world/textures";

/**
 * Per-land architectural style consumed by the facade kit in
 * src/world/buildings.ts: which tiling wall texture, whether ground floors
 * get storefront treatment (recessed glass + awnings), whether rooflines
 * get a cornice strip, and whether roofs get a mansard fascia band.
 */
export interface LandStyle {
  readonly wall: WallKind;
  readonly storefront: boolean;
  readonly cornice: boolean;
  /** Sloped roof-fascia band above the roofline (mansard silhouette). */
  readonly mansard: boolean;
  /** Awning colors cycled along storefronts. */
  readonly awnings: readonly number[];
}

export const LAND_STYLES: Record<LandId, LandStyle> = {
  mainStreet: {
    wall: "brick",
    storefront: true,
    cornice: true,
    mansard: true,
    awnings: [0xa03028, 0x2e6a48, 0xd9c9a0, 0x3a5a8c],
  },
  hub: { wall: "plaster", storefront: false, cornice: true, mansard: false, awnings: [] },
  adventureland: {
    wall: "board",
    storefront: false,
    cornice: false,
    mansard: false,
    awnings: [0x8a6a30],
  },
  neworleans: {
    wall: "plaster",
    storefront: true,
    cornice: true,
    mansard: true,
    awnings: [0x3c4a42, 0x6a4a5a, 0xa08a50],
  },
  frontierland: {
    wall: "board",
    storefront: true,
    cornice: false,
    mansard: false,
    awnings: [0x8a5a30, 0x6b503c],
  },
  critterCountry: {
    wall: "board",
    storefront: false,
    cornice: false,
    mansard: false,
    awnings: [],
  },
  fantasyland: {
    wall: "plaster",
    storefront: true,
    cornice: true,
    mansard: false,
    awnings: [0x7a5a8a, 0x4a6a9a, 0xc8a040],
  },
  toontown: {
    wall: "plaster",
    storefront: true,
    cornice: true,
    mansard: false,
    awnings: [0xd04838, 0x3878c0, 0xe8a020, 0x58a848],
  },
  tomorrowland: {
    wall: "panel",
    storefront: false,
    cornice: false,
    mansard: false,
    awnings: [],
  },
};
