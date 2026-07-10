import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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
 * source. All wall/roof geometry is merged into one mesh PER COLOR, so the
 * whole park's building mass renders in a few dozen draw calls. Main Street
 * facades additionally get roofline string lights (instanced bulbs).
 */
export function buildBuildings(scene: Scene, options: BuildingsOptions): void {
  const windowSlots: WindowSlot[] = [];
  const bulbSlots: Vector3[] = [];
  const wallBuckets = new Map<number, BufferGeometry[]>();
  const roofBuckets = new Map<number, BufferGeometry[]>();

  const bucket = (map: Map<number, BufferGeometry[]>, color: number): BufferGeometry[] => {
    let list = map.get(color);
    if (!list) {
      list = [];
      map.set(color, list);
    }
    return list;
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

    const { walls, roof } = buildSplitExtrusion(b, height);
    bucket(wallBuckets, wallColor).push(walls);
    bucket(roofBuckets, roofColor).push(roof);

    // Windows only inside guest areas — backstage mass stays dark.
    if (land) collectWindowSlots(b, height, rng, windowSlots);

    // String lights along Main Street rooflines — the classic night look.
    if (land?.id === "mainStreet") collectBulbSlots(b, height, bulbSlots);
  }

  for (const [color, geometries] of wallBuckets) {
    const merged = mergeGeometries(geometries);
    if (!merged) continue;
    const mesh = new Mesh(merged, new MeshStandardMaterial({ color, roughness: 0.9 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    for (const g of geometries) g.dispose();
  }
  for (const [color, geometries] of roofBuckets) {
    const merged = mergeGeometries(geometries);
    if (!merged) continue;
    const mesh = new Mesh(merged, new MeshStandardMaterial({ color, roughness: 0.85 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    for (const g of geometries) g.dispose();
  }

  if (windowSlots.length > 0) {
    const glassMaterial = new MeshStandardMaterial({
      color: 0x9fb2c0, // daytime: pale sky-reflecting glass, not black holes
      emissive: new Color(0xffc266),
      emissiveIntensity: 0,
      roughness: 0.12,
      metalness: 0.55,
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

  if (bulbSlots.length > 0) {
    const bulbMaterial = new MeshStandardMaterial({
      color: 0x4a3c22,
      emissive: new Color(0xffdf94),
      emissiveIntensity: 0,
      roughness: 0.4,
    });
    registerEmissive(bulbMaterial, 3.0);
    const bulbs = new InstancedMesh(new SphereGeometry(0.09, 6, 5), bulbMaterial, bulbSlots.length);
    const m = new Matrix4();
    bulbSlots.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      bulbs.setMatrixAt(i, m);
    });
    bulbs.instanceMatrix.needsUpdate = true;
    scene.add(bulbs);
  }
}

/**
 * Extrude a footprint and split it into wall (sides) and roof (caps)
 * geometries so each can be merged into its color bucket.
 * ExtrudeGeometry group 0 = caps, group 1 = sides.
 */
function buildSplitExtrusion(
  b: BakedBuilding,
  height: number,
): { walls: BufferGeometry; roof: BufferGeometry } {
  const geometry = new ExtrudeGeometry(polygonToShape(b.outer, b.inner), {
    depth: height,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  const caps = geometry.groups[0];
  const sides = geometry.groups[1];
  const roof = sliceGeometry(geometry, caps?.start ?? 0, caps?.count ?? 0);
  const walls = sliceGeometry(geometry, sides?.start ?? 0, sides?.count ?? Infinity);
  geometry.dispose();
  return { walls, roof };
}

/** Copy a vertex range of a non-indexed geometry into a new geometry. */
function sliceGeometry(source: ExtrudeGeometry, start: number, count: number): BufferGeometry {
  const out = new BufferGeometry();
  for (const name of ["position", "normal", "uv"] as const) {
    const attr = source.getAttribute(name);
    if (!attr) continue;
    const itemSize = attr.itemSize;
    const end = Math.min(attr.count, start + count);
    const slice = new Float32Array(Math.max(0, end - start) * itemSize);
    for (let i = start; i < end; i++) {
      for (let c = 0; c < itemSize; c++) {
        slice[(i - start) * itemSize + c] = attr.getComponent(i, c);
      }
    }
    out.setAttribute(name, new BufferAttribute(slice, itemSize));
  }
  return out;
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

/** String-light bulbs along the top edge of every facade, every ~1.3 m. */
function collectBulbSlots(b: BakedBuilding, height: number, out: Vector3[]): void {
  if (height < 3) return;
  const pts = b.outer;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const c = pts[(i + 1) % pts.length];
    if (!a || !c) continue;
    const dx = c[0] - a[0];
    const dz = c[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 2.5) continue;
    let nx = dz / len;
    let nz = -dx / len;
    if (pointInPolygon((a[0] + c[0]) / 2 + nx * 0.4, (a[1] + c[1]) / 2 + nz * 0.4, pts)) {
      nx = -nx;
      nz = -nz;
    }
    const count = Math.floor(len / 1.3);
    for (let k = 0; k <= count; k++) {
      const t = count === 0 ? 0.5 : k / count;
      out.push(
        new Vector3(a[0] + dx * t + nx * 0.18, height + 0.12, a[1] + dz * t + nz * 0.18),
      );
    }
  }
}
