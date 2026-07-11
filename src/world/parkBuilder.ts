import {
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Scene,
} from "three";
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
import { buildTianasBayou } from "./landmarks/tianas";
import { buildTikiRoom } from "./landmarks/tikiRoom";
import { buildTrainStation } from "./landmarks/trainStation";
import { buildIsland } from "./island";
import { buildProps, type PropPlacements } from "./props";
import { buildRailroad } from "./railroad";
import { buildSteamboat } from "./steamboat";
import { buildStreetFurniture } from "./streetFurniture";
import { buildTerrain } from "./terrain";
import { buildTrain } from "./train";

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
  tianasBayou: buildTianasBayou,
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
  buildStreetFurniture(scene, seed);

  // The park comes alive: island scenery, circling vehicles, and tree/berm
  // screens hiding the backstage show buildings.
  buildIsland(scene, seed);
  buildTrain(scene);
  buildSteamboat(scene);
  buildScreening(scene, seed);
}

/**
 * Perimeter forest: the real park is ringed by a dense treeline that hides
 * the outside world — with the backstage lots culled from the data, the
 * horizon beyond the boundary is bare earth, so three staggered pine rows
 * just OUTSIDE the guest boundary dress every sightline at once. (The v2
 * interior "screen walls" that read as flat green slabs are gone — the
 * show buildings they hid no longer exist.) Purely visual — no collision.
 */
function buildScreening(scene: Scene, seed: number): void {
  const rng = mulberry32(seed + 900);
  const trunkMaterial = new MeshStandardMaterial({ color: 0x4f3c2c, roughness: 1 });
  const pineMaterial = new MeshStandardMaterial({ color: 0x4f8a48, roughness: 1, flatShading: true });

  // Ring centroid for outward direction.
  const ring = PARK_LAYOUT.boundary;
  let cx = 0;
  let cz = 0;
  for (const p of ring) {
    cx += p[0];
    cz += p[1];
  }
  cx /= ring.length;
  cz /= ring.length;

  const placements: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (!a || !b) continue;
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d < segLen; d += 7) {
      const t = d / segLen;
      const px = a[0] + (b[0] - a[0]) * t;
      const pz = a[1] + (b[1] - a[1]) * t;
      const ox = px - cx;
      const oz = pz - cz;
      const olen = Math.hypot(ox, oz) || 1;
      for (const row of [10, 19, 29]) {
        if (rng() < 0.25) continue; // ragged, natural spacing
        placements.push({
          x: px + (ox / olen) * row + (rng() - 0.5) * 4,
          z: pz + (oz / olen) * row + (rng() - 0.5) * 4,
          s: 1.3 + rng() * 1.1,
        });
      }
    }
  }

  const trunks = new InstancedMesh(
    new CylinderGeometry(0.18, 0.26, 2.0, 7),
    trunkMaterial,
    placements.length,
  );
  const crowns = new InstancedMesh(
    new ConeGeometry(1.7, 5.4, 8),
    pineMaterial,
    placements.length,
  );
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const pos = new Vector3();
  const scl = new Vector3();
  placements.forEach((p, i) => {
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    scl.setScalar(p.s);
    pos.set(p.x, 1.0 * p.s, p.z);
    m.compose(pos, q, scl);
    trunks.setMatrixAt(i, m);
    pos.set(p.x, (2.0 + 2.4) * p.s, p.z);
    m.compose(pos, q, scl);
    crowns.setMatrixAt(i, m);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  crowns.castShadow = true;
  scene.add(trunks, crowns);
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
    for (const p of samplePolygon(green.outer, count, rng)) {
      // Keep the hub's central planter clear: the Partners statue stands
      // there (streetFurniture.ts), and a canopy would swallow it.
      if (Math.hypot(p[0] - 1, p[1] - 55) < 8) continue;
      bucket.push(p);
    }
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
      // Lamps stand at the walkway EDGE, not on the centerline — offset
      // along the segment normal, alternating sides (footway ribbons are
      // carved at half-width 2.0 m).
      const nx = (b[1] - a[1]) / segLen;
      const nz = -(b[0] - a[0]) / segLen;
      let d = 24 - sinceLast;
      while (d < segLen) {
        const t = d / segLen;
        const side = lamps.length % 2 === 0 ? 1.8 : -1.8;
        const x = a[0] + (b[0] - a[0]) * t + nx * side;
        const z = a[1] + (b[1] - a[1]) * t + nz * side;
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
