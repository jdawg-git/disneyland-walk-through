import type { Scene } from "three";
import { mulberry32, type Rng } from "../engine/random";
import { landAt, type LandId } from "../config/lands";
import { LANDMARKS, type LandmarkKey } from "../config/landmarks";
import { PARK_LAYOUT, pointInPolygon, polygonCentroid, type Pt } from "../data/parkLayout";
import { buildBuildings } from "./buildings";
import { buildBigThunder } from "./landmarks/bigThunder";
import { buildCastle } from "./landmarks/castle";
import { buildHauntedMansion } from "./landmarks/hauntedMansion";
import { buildMatterhorn } from "./landmarks/matterhorn";
import { buildPiratesFacade } from "./landmarks/piratesFacade";
import { buildSmallWorld } from "./landmarks/smallWorld";
import { buildSpaceMountain } from "./landmarks/spaceMountain";
import { buildSplashMountain } from "./landmarks/splashMountain";
import { buildTikiRoom } from "./landmarks/tikiRoom";
import { buildTrainStation } from "./landmarks/trainStation";
import { buildProps, type PropPlacements } from "./props";
import { buildRailroad } from "./railroad";
import { buildTerrain } from "./terrain";

const LANDMARK_BUILDERS: Record<LandmarkKey, (scene: Scene, x: number, z: number) => void> = {
  castle: buildCastle,
  trainStation: buildTrainStation,
  matterhorn: buildMatterhorn,
  spaceMountain: buildSpaceMountain,
  tikiRoom: buildTikiRoom,
  piratesFacade: buildPiratesFacade,
  hauntedMansion: buildHauntedMansion,
  bigThunder: buildBigThunder,
  smallWorld: buildSmallWorld,
  splashMountain: buildSplashMountain,
};

/** Which tree species each land grows. */
const TREE_SPECIES: Partial<Record<LandId, "round" | "palm" | "pine">> = {
  mainStreet: "round",
  hub: "round",
  adventureland: "palm",
  neworleans: "round",
  frontierland: "pine",
  critterCountry: "pine",
  fantasyland: "round",
  toontown: "round",
  tomorrowland: "round",
};

/** Lands that get lamp posts along their walkways. */
const LAMP_LANDS: ReadonlySet<LandId> = new Set([
  "mainStreet",
  "hub",
  "neworleans",
  "fantasyland",
  "tomorrowland",
  "toontown",
  "adventureland",
  "frontierland",
  "critterCountry",
]);

/**
 * Orchestrates park construction from the baked OSM layout: terrain, berm,
 * generic buildings (per-land palettes), bespoke landmarks, and props
 * scattered from the real greens/walkway data.
 */
export function buildPark(scene: Scene, seed: number): void {
  buildTerrain(scene);
  buildRailroad(scene);

  const skipIds = new Set<number>(LANDMARKS.flatMap((l) => [...l.osmIds]));
  buildBuildings(scene, {
    skipIds,
    include: () => true,
  });

  for (const landmark of LANDMARKS) {
    const [x, z] = landmark.position;
    LANDMARK_BUILDERS[landmark.key](scene, x, z);
  }

  buildProps(scene, generatePropPlacements(seed), seed);
}

/** Scatter trees on real planter polygons; march lamps along real paths. */
function generatePropPlacements(seed: number): PropPlacements {
  const rng = mulberry32(seed + 7);
  const round: Pt[] = [];
  const palm: Pt[] = [];
  const pine: Pt[] = [];
  const lamps: Pt[] = [];

  // --- Trees on greens ---
  for (const green of PARK_LAYOUT.greens) {
    const center = polygonCentroid(green.outer);
    const land = landAt(center[0], center[1]);
    if (!land) continue;
    const species = TREE_SPECIES[land.id] ?? "round";
    const area = Math.abs(shoelace(green.outer));
    const count = Math.min(10, Math.max(1, Math.floor(area / 60)));
    const bucket = species === "palm" ? palm : species === "pine" ? pine : round;
    for (const p of samplePolygon(green.outer, count, rng)) bucket.push(p);
  }

  // --- Lamps along walkways (every ~24 m, capped) ---
  const LAMP_CAP = 360;
  for (const path of PARK_LAYOUT.paths) {
    if (lamps.length >= LAMP_CAP) break;
    if (path.kind !== "footway" && path.kind !== "pedestrian") continue;
    let sinceLast = 12; // place the first lamp quickly
    for (let i = 0; i < path.points.length - 1 && lamps.length < LAMP_CAP; i++) {
      const a = path.points[i];
      const b = path.points[i + 1];
      if (!a || !b) continue;
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let d = 24 - sinceLast;
      while (d < segLen) {
        const t = d / segLen;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        const land = landAt(x, z);
        if (land && LAMP_LANDS.has(land.id) && rng() > 0.35) lamps.push([x, z]);
        d += 24;
        if (lamps.length >= LAMP_CAP) break;
      }
      sinceLast = (sinceLast + segLen) % 24;
    }
  }

  // Hand-placed Main Street double row — the signature promenade.
  // (Street corridor is only x ≈ −4..11; curbs sit at −3 and 10.)
  for (let z = 130; z <= 260; z += 18) {
    lamps.push([-3, z], [10, z]);
  }

  return { lamps, round, palm, pine };
}

function shoelace(poly: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const b = poly[i];
    if (!a || !b) continue;
    sum += (a[0] * b[1] - b[0] * a[1]) / 2;
  }
  return sum;
}

/** Rejection-sample `count` interior points of a polygon. */
function samplePolygon(poly: readonly Pt[], count: number, rng: Rng): Pt[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[1]);
    maxZ = Math.max(maxZ, p[1]);
  }
  const out: Pt[] = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 30) {
    attempts += 1;
    const x = minX + rng() * (maxX - minX);
    const z = minZ + rng() * (maxZ - minZ);
    if (pointInPolygon(x, z, poly)) out.push([x, z]);
  }
  return out;
}
