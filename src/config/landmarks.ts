/**
 * OSM footprint ids that get bespoke landmark meshes instead of generic
 * extrusion, plus where to place them. Positions are footprint centroids
 * (from park-layout.json) — kept explicit here so the builders don't need
 * to search the data at runtime.
 */

export interface LandmarkDef {
  readonly key: string;
  /** OSM way/relation ids replaced by this bespoke mesh. */
  readonly osmIds: readonly number[];
  readonly position: readonly [number, number];
}

export const LANDMARKS: readonly LandmarkDef[] = [
  { key: "castle", osmIds: [], position: [5.8, -12.2] },
  { key: "trainStation", osmIds: [], position: [2.6, 300.2] },
];
