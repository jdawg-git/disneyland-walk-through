import {
  Color,
  ExtrudeGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { registerEmissive } from "../engine/emissive";
import { mulberry32 } from "../engine/random";
import { polygonToShape } from "./shapeUtil";
import { landAt, type LandPalette } from "../config/lands";
import {
  PARK_LAYOUT,
  pointInPolygon,
  polygonCentroid,
  type BakedBuilding,
  type Pt,
} from "../data/parkLayout";

const LEVEL_HEIGHT = 3.4;
const DEFAULT_LEVELS = 2;

interface WindowSlot {
  readonly position: Vector3;
  readonly yawY: number;
}

export interface BuildingsOptions {
  /** Only build footprints whose centroid passes this test. */
  readonly include: (center: Pt, building: BakedBuilding) => boolean;
  /** OSM ids that get bespoke landmark meshes instead of generic extrusion. */
  readonly skipIds: ReadonlySet<number>;
}

/**
 * Generic building pass: extrudes OSM footprints with per-land wall/roof
 * palettes and scatters emissive window quads on facades — the night glow
 * source. Bespoke landmarks (castle, stations…) are skipped here.
 */
export function buildBuildings(scene: Scene, options: BuildingsOptions): void {
  const windowSlots: WindowSlot[] = [];
  const wallMaterials = new Map<number, MeshStandardMaterial>();
  const roofMaterials = new Map<number, MeshStandardMaterial>();

  const wallMaterial = (color: number): MeshStandardMaterial => {
    let m = wallMaterials.get(color);
    if (!m) {
      m = new MeshStandardMaterial({ color, roughness: 0.9 });
      wallMaterials.set(color, m);
    }
    return m;
  };
  const roofMaterial = (color: number): MeshStandardMaterial => {
    let m = roofMaterials.get(color);
    if (!m) {
      m = new MeshStandardMaterial({ color, roughness: 0.85 });
      roofMaterials.set(color, m);
    }
    return m;
  };

  for (const b of PARK_LAYOUT.buildings) {
    const center = polygonCentroid(b.outer);
    if (options.skipIds.has(b.id)) continue;
    if (!options.include(center, b)) continue;

    const land = landAt(center[0], center[1]);
    const palette: LandPalette = land?.palette ?? {
      walls: [0xb0a898],
      roofs: [0x6a625a],
      trim: 0xd8d0c0,
      glow: 0xffc266,
    };

    const rng = mulberry32(b.id);
    const height =
      b.height ?? (b.levels ?? DEFAULT_LEVELS + (rng() > 0.65 ? 1 : 0)) * LEVEL_HEIGHT;

    const wallColor = palette.walls[Math.floor(rng() * palette.walls.length)] ?? 0xb0a898;
    const roofColor = palette.roofs[Math.floor(rng() * palette.roofs.length)] ?? 0x6a625a;

    const geometry = buildExtrusion(b, height);
    const mesh = new Mesh(geometry, [wallMaterial(wallColor), roofMaterial(roofColor)]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    collectWindowSlots(b, height, rng, windowSlots);
  }

  if (windowSlots.length > 0) {
    const glassMaterial = new MeshStandardMaterial({
      color: 0x5a6a78, // daytime: pale reflective glass, not black holes
      emissive: new Color(0xffc266),
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.25,
    });
    registerEmissive(glassMaterial, 2.4);
    const windows = new InstancedMesh(new PlaneGeometry(0.95, 1.25), glassMaterial, windowSlots.length);
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const one = new Vector3(1, 1, 1);
    windowSlots.forEach((slot, i) => {
      q.setFromAxisAngle(up, slot.yawY);
      m.compose(slot.position, q, one);
      windows.setMatrixAt(i, m);
    });
    windows.instanceMatrix.needsUpdate = true;
    scene.add(windows);
  }
}

/** Extrude footprint; material group 0 = walls (sides), 1 = roof (caps). */
function buildExtrusion(b: BakedBuilding, height: number): ExtrudeGeometry {
  // Shape lives in XY with y = -z (see shapeUtil); extrude along shape-z
  // then rotate flat so extrusion depth becomes world +Y.
  const geometry = new ExtrudeGeometry(polygonToShape(b.outer, b.inner), {
    depth: height,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  // ExtrudeGeometry group 0 = caps, group 1 = sides; swap to walls-first order.
  const groups = geometry.groups;
  if (groups.length >= 2) {
    const caps = groups[0];
    const sides = groups[1];
    if (caps && sides) {
      caps.materialIndex = 1;
      sides.materialIndex = 0;
    }
  }
  return geometry;
}

/** Windows along each sufficiently long facade edge, facing outward. */
function collectWindowSlots(
  b: BakedBuilding,
  height: number,
  rng: () => number,
  out: WindowSlot[],
): void {
  if (height < 3) return; // sheds/kiosks: no windows
  const floors = Math.max(1, Math.floor(height / LEVEL_HEIGHT));
  const pts = b.outer;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const c = pts[(i + 1) % pts.length];
    if (!a || !c) continue;
    const dx = c[0] - a[0];
    const dz = c[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 3) continue;

    // Outward normal: test candidate against the footprint interior.
    let nx = dz / len;
    let nz = -dx / len;
    const midX = (a[0] + c[0]) / 2;
    const midZ = (a[1] + c[1]) / 2;
    if (pointInPolygon(midX + nx * 0.4, midZ + nz * 0.4, pts)) {
      nx = -nx;
      nz = -nz;
    }
    const yaw = Math.atan2(nx, nz);

    const cols = Math.min(8, Math.floor(len / 3.2));
    for (let col = 0; col < cols; col++) {
      const t = (col + 0.5) / cols;
      for (let f = 0; f < floors; f++) {
        if (rng() < 0.18) continue; // some dark windows — variety
        const y = 1.9 + f * LEVEL_HEIGHT;
        if (y + 0.7 > height) continue; // don't poke through the roofline
        out.push({
          position: new Vector3(a[0] + dx * t + nx * 0.15, y, a[1] + dz * t + nz * 0.15),
          yawY: yaw,
        });
      }
    }
  }
}
