import type { Scene } from "three";
import { LANDS, landAt } from "../config/lands";
import { LANDMARKS } from "../config/landmarks";
import type { Pt } from "../data/parkLayout";
import { buildBuildings } from "./buildings";
import { buildCastle } from "./landmarks/castle";
import { buildTrainStation } from "./landmarks/trainStation";
import { buildProps, type PropPlacements } from "./props";
import { buildTerrain } from "./terrain";

/**
 * Orchestrates park construction from the baked OSM layout. Stage 2 scope:
 * terrain everywhere, but buildings/props only inside the authored land
 * polygons (Main Street + hub). Each later stage widens the include test as
 * new land polygons are authored.
 */
export function buildPark(scene: Scene, seed: number): void {
  buildTerrain(scene);

  const skipIds = new Set<number>(LANDMARKS.flatMap((l) => [...l.osmIds]));
  buildBuildings(scene, {
    skipIds,
    include: (center) => landAt(center[0], center[1]) !== null,
  });

  for (const landmark of LANDMARKS) {
    const [x, z] = landmark.position;
    if (landmark.key === "castle") buildCastle(scene, x, z);
    else if (landmark.key === "trainStation") buildTrainStation(scene, x, z);
  }

  buildProps(scene, slicePropPlacements(), seed);
}

/**
 * Hand-placed slice props: lamp rows flanking Main Street and around the
 * hub, trees in Town Square + hub planters. Later stages generate these
 * from land configs instead.
 */
function slicePropPlacements(): PropPlacements {
  const lamps: Pt[] = [];
  const trees: Pt[] = [];

  // Main Street runs x≈2.6→5.8, z from the station (300) to the hub (105).
  for (let z = 130; z <= 260; z += 18) {
    lamps.push([-7.5, z], [14.5, z]);
  }
  // Town Square ring (z ≈ 265–330).
  for (const p of [
    [-24, 275],
    [28, 275],
    [-24, 315],
    [28, 315],
    [2, 330],
  ] as const) {
    lamps.push(p);
  }
  // Hub ring around the plaza center (0, 55).
  const hubCenter = { x: 1, z: 55 };
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    lamps.push([hubCenter.x + Math.cos(a) * 34, hubCenter.z + Math.sin(a) * 34]);
  }

  // Trees: Town Square lawn + hub planters.
  for (const p of [
    [-30, 285],
    [-30, 305],
    [34, 285],
    [34, 305],
    [-16, 322],
    [20, 322],
  ] as const) {
    trees.push(p);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    trees.push([hubCenter.x + Math.cos(a) * 42, hubCenter.z + Math.sin(a) * 42]);
  }

  const inAuthoredLand = (p: Pt): boolean => LANDS.some((l) => landAt(p[0], p[1])?.id === l.id);
  return {
    lamps: lamps.filter(inAuthoredLand),
    trees: trees.filter(inAuthoredLand),
  };
}
