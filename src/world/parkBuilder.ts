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

/**
 * Orchestrates park construction from the baked OSM layout: terrain, berm,
 * generic buildings (per-land palettes), bespoke landmarks, and props
 * scattered from the real greens/walkway data.
 */
export function buildPark(
  scene: Scene,
  seed: number,
  isWalkable: (x: number, z: number) => boolean,
): void {
  buildTerrain(scene);
  buildRailroad(scene, isWalkable);

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
      // Never grow a tree inside a bespoke landmark (OSM gardens sit under
      // some footprints — one sprouted through the Mansion's portico).
      if (LANDMARKS.some((l) => Math.hypot(p[0] - l.position[0], p[1] - l.position[1]) < 15)) {
        continue;
      }
      bucket.push(p);
    }
  }

  // --- Tree blanket: the real park is canopy everywhere a guest can't
  // walk. Grid-sample the whole boundary interior and plant wherever we're
  // clear of paths, buildings, plazas, water, and landmarks — this is what
  // makes the aerial read like the guest map instead of bare fields. The
  // Jungle Cruise river ("Rivers of the World") deliberately KEEPS canopy
  // planted over it: the map hides that water under jungle.
  {
    // Path proximity hash: resample every path at ~6 m into 10 m cells.
    const CELL = 6;
    const pathCells = new Set<string>();
    const cellKey = (x: number, z: number): string =>
      `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    for (const path of PARK_LAYOUT.paths) {
      for (let i = 0; i < path.points.length - 1; i++) {
        const a = path.points[i];
        const b = path.points[i + 1];
        if (!a || !b) continue;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const steps = Math.max(1, Math.ceil(len / 4));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          pathCells.add(cellKey(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
        }
      }
    }
    const nearPath = (x: number, z: number): boolean => {
      const cx = Math.floor(x / CELL);
      const cz = Math.floor(z / CELL);
      for (let ix = -1; ix <= 1; ix++) {
        for (let iz = -1; iz <= 1; iz++) {
          if (pathCells.has(`${cx + ix},${cz + iz}`)) return true;
        }
      }
      return false;
    };

    // Bbox-prefiltered polygon groups to stay clear of.
    interface Blocker {
      readonly outer: readonly Pt[];
      readonly minX: number;
      readonly maxX: number;
      readonly minZ: number;
      readonly maxZ: number;
    }
    const toBlocker = (outer: readonly Pt[]): Blocker => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of outer) {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minZ = Math.min(minZ, p[1]);
        maxZ = Math.max(maxZ, p[1]);
      }
      return { outer, minX, maxX, minZ, maxZ };
    };
    const blockers: Blocker[] = [
      ...PARK_LAYOUT.buildings.map((b) => toBlocker(b.outer)),
      ...PARK_LAYOUT.plazas.map((p) => toBlocker(p.outer)),
      // All water except the Jungle Cruise river (canopy goes OVER it).
      ...PARK_LAYOUT.water
        .filter((w) => w.name !== "Rivers of the World")
        .map((w) => toBlocker(w.outer)),
    ];
    const jungleRiver = PARK_LAYOUT.water.find((w) => w.name === "Rivers of the World");
    const inBlocker = (x: number, z: number): boolean =>
      blockers.some(
        (bl) =>
          x >= bl.minX &&
          x <= bl.maxX &&
          z >= bl.minZ &&
          z <= bl.maxZ &&
          pointInPolygon(x, z, bl.outer),
      );

    // The guest map shows Tomorrowland more open; everywhere else, dense.
    const KEEP_BY_LAND: Partial<Record<LandId, number>> = {
      tomorrowland: 0.35,
      mainStreet: 0.6,
      toontown: 0.6,
      adventureland: 0.97,
      frontierland: 0.95,
      critterCountry: 0.97,
    };

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of PARK_LAYOUT.boundary) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[1]);
      maxZ = Math.max(maxZ, p[1]);
    }
    for (let gx = minX; gx <= maxX; gx += 7) {
      for (let gz = minZ; gz <= maxZ; gz += 7) {
        const x = gx + (rng() - 0.5) * 6;
        const z = gz + (rng() - 0.5) * 6;
        if (!pointInPolygon(x, z, PARK_LAYOUT.boundary)) continue;
        // Jungle canopy swallows the Jungle Cruise river even beside its
        // walkways — that's how the guest map hides the ride's water.
        const overJungle =
          jungleRiver !== undefined && pointInPolygon(x, z, jungleRiver.outer);
        if (!overJungle && nearPath(x, z)) continue;
        if (Math.hypot(x - 1, z - 55) < 10) continue; // Partners circle
        if (LANDMARKS.some((l) => Math.hypot(x - l.position[0], z - l.position[1]) < 16)) continue;
        if (inBlocker(x, z)) continue;
        const land = landAt(x, z);
        const keep = KEEP_BY_LAND[land?.id ?? "hub"] ?? 0.85;
        if (rng() > keep) continue;
        const species = land ? (TREE_SPECIES[land.id] ?? "round") : "pine";
        (species === "palm" ? palm : species === "pine" ? pine : round).push([x, z]);
      }
    }
  }

  // --- Lamps: hand-curated rows ONLY. The old auto-march along OSM path
  // centerlines scattered lamps mid-plaza (the centerlines wander across
  // open squares), which read as haphazard posts in the walking path. ---

  // Main Street double row — the signature promenade.
  // (Street corridor is only x ≈ −4..11; curbs sit at −3 and 10.)
  for (let z = 130; z <= 260; z += 18) {
    lamps.push([-3, z], [10, z]);
  }
  // Hub ring around the Partners circle (statue at (1,55)).
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    lamps.push([1 + Math.cos(a) * 22, 55 + Math.sin(a) * 22]);
  }
  // Town Square corners (station forecourt at z≈290, flag circle at (2,~285)).
  lamps.push([-16, 272], [20, 272], [-16, 296], [20, 296]);
  // New Orleans riverfront promenade (along the walk toward the Mansion).
  lamps.push([-215, 168], [-238, 158], [-262, 148], [-284, 140]);
  // Fantasyland courtyard behind the castle (carrousel at (4,−76)).
  lamps.push([-10, -62], [18, -62], [-10, -90], [18, -90]);
  // Small World mall approach.
  lamps.push([98, -226], [112, -226], [98, -240], [112, -240]);

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
