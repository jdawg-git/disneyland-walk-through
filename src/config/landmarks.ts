/**
 * OSM footprint ids that get bespoke landmark meshes instead of generic
 * extrusion, plus where to place them. Positions are footprint centroids
 * (from park-layout.json) — kept explicit here so the builders don't need
 * to search the data at runtime.
 */

export type LandmarkKey =
  | "castle"
  | "trainStation"
  | "matterhorn"
  | "spaceMountain"
  | "tikiRoom"
  | "piratesFacade"
  | "hauntedMansion"
  | "bigThunder"
  | "smallWorld"
  | "tianasBayou"
  | "carousel"
  | "treehouse"
  | "indianaJones";

export interface LandmarkDef {
  readonly key: LandmarkKey;
  /** OSM way/relation ids replaced by this bespoke mesh. */
  readonly osmIds: readonly number[];
  readonly position: readonly [number, number];
}

export const LANDMARKS: readonly LandmarkDef[] = [
  { key: "castle", osmIds: [331440228], position: [5.8, -12.2] },
  { key: "trainStation", osmIds: [153044358], position: [2.6, 300.2] },
  { key: "matterhorn", osmIds: [107280556], position: [109, -38.8] },
  { key: "spaceMountain", osmIds: [372931495], position: [151, 162] },
  { key: "tikiRoom", osmIds: [653252856], position: [-53.2, 114.3] },
  { key: "piratesFacade", osmIds: [824031784], position: [-200.2, 190.5] },
  { key: "hauntedMansion", osmIds: [178254960], position: [-301.8, 120.2] },
  { key: "bigThunder", osmIds: [266074156], position: [-124.2, 3.8] },
  { key: "smallWorld", osmIds: [499783300], position: [114.3, -247.7] },
  // Tiana's Bayou Adventure at its real OSM location (footprint 361504826
  // becomes the bespoke green mountain); clear of star 7 at (-370, 40).
  // The builder rotates the group so the flume drop faces the river.
  { key: "tianasBayou", osmIds: [361504826], position: [-348, 68] },
  // v6 walkthrough: the round OSM slab becomes a real carousel.
  { key: "carousel", osmIds: [129691054], position: [4, -76] },
  // "Disneydendron semperflorens grandis" — the Adventureland Treehouse's
  // fictional tree species; its thin extrusion read as a green column.
  { key: "treehouse", osmIds: [128480616], position: [-146, 157] },
  // Indiana Jones Adventure temple — no OSM footprint survives the cull
  // (show building 824031782 is skip-listed); bespoke facade only, placed
  // off the jungle trail near the Raiders truck prop.
  { key: "indianaJones", osmIds: [], position: [-118, 168] },
];
