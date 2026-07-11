import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  BoxGeometry,
  Vector3,
} from "three";
import { registerEmissive } from "../engine/emissive";
import { mulberry32 } from "../engine/random";
import { landAt, type LandPalette } from "../config/lands";
import { LAND_STYLES, type LandStyle } from "../config/styles";
import { storefrontTexture, wallTexture, WALL_TEX_METERS, type WallKind } from "./textures";
import { flatPolygonGeometry } from "./shapeUtil";
import {
  PARK_LAYOUT,
  pointInPolygon,
  polygonCentroid,
  type BakedBuilding,
  type Pt,
} from "../data/parkLayout";

const LEVEL_HEIGHT = 3.4;
const DEFAULT_LEVELS = 2;

const DEFAULT_STYLE: LandStyle = {
  wall: "plaster",
  storefront: false,
  cornice: false,
  mansard: false,
  awnings: [],
};

const DEFAULT_PALETTE: LandPalette = {
  walls: [0xb0a898],
  roofs: [0x6a625a],
  trim: 0xd8d0c0,
  glow: 0xffc266,
};

export interface BuildingsOptions {
  readonly include: (center: Pt, building: BakedBuilding) => boolean;
  readonly skipIds: ReadonlySet<number>;
}

/** Accumulates textured quads; one merged mesh per (texture, color) bucket. */
class QuadBucket {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];

  addQuad(
    a: Vector3,
    b: Vector3,
    c: Vector3,
    d: Vector3,
    n: Vector3,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
  ): void {
    const push = (p: Vector3, u: number, v: number): void => {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(n.x, n.y, n.z);
      this.uvs.push(u, v);
    };
    // a=bottom-left, b=bottom-right, c=top-right, d=top-left
    push(a, u0, v0);
    push(b, u1, v0);
    push(c, u1, v1);
    push(a, u0, v0);
    push(c, u1, v1);
    push(d, u0, v1);
  }

  toGeometry(): BufferGeometry | null {
    if (this.positions.length === 0) return null;
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(this.positions), 3));
    geo.setAttribute("normal", new BufferAttribute(new Float32Array(this.normals), 3));
    geo.setAttribute("uv", new BufferAttribute(new Float32Array(this.uvs), 2));
    return geo;
  }
}

interface WindowSlot {
  readonly position: Vector3;
  readonly yawY: number;
}

interface AwningSlot {
  readonly position: Vector3;
  readonly yawY: number;
  readonly color: number;
}

interface SignAnchor {
  readonly name: string;
  readonly position: Vector3;
  readonly yawY: number;
}

/**
 * The facade kit: every building wall is generated per footprint edge with
 * meter-scaled UVs over a tiling canvas texture (brick/clapboard/board/
 * panel/plaster per land style), plus storefront glass + awnings, cornice
 * strips, mansard fascia bands, instanced windows, Main Street roofline
 * bulbs, and a one-draw-call signage atlas naming the real shops.
 * Everything merges per (texture × color) bucket — a few dozen meshes for
 * the whole park.
 */
export function buildBuildings(scene: Scene, options: BuildingsOptions): void {
  const wallBuckets = new Map<string, QuadBucket>();
  const flatBuckets = new Map<string, QuadBucket>(); // cornice/fascia/glass
  const roofGeos = new Map<number, BufferGeometry[]>();
  const windowSlots: WindowSlot[] = [];
  const bulbSlots: Vector3[] = [];
  const awningSlots: AwningSlot[] = [];
  const signAnchors: SignAnchor[] = [];

  const bucket = (map: Map<string, QuadBucket>, key: string): QuadBucket => {
    let b = map.get(key);
    if (!b) {
      b = new QuadBucket();
      map.set(key, b);
    }
    return b;
  };

  for (const b of PARK_LAYOUT.buildings) {
    const center = polygonCentroid(b.outer);
    if (options.skipIds.has(b.id)) continue;
    if (!options.include(center, b)) continue;

    const land = landAt(center[0], center[1]);
    const palette = land?.palette ?? DEFAULT_PALETTE;
    const style = land ? LAND_STYLES[land.id] : DEFAULT_STYLE;

    const rng = mulberry32(b.id);
    let levels = b.levels ?? guessLevels(b, rng);
    // Main Street reads as one coherent 2-story streetscape: parapets vary
    // by a few feet, never by a whole story (no random towers over the
    // roofline). Tagged heights (Emporium, Opera House) are respected.
    if (land?.id === "mainStreet" && b.levels === undefined && levels >= 2) {
      levels = 2 + Math.floor(rng() * 3) * 0.25;
    }
    const height = b.height ?? levels * LEVEL_HEIGHT;
    const wallColor = palette.walls[Math.floor(rng() * palette.walls.length)] ?? 0xb0a898;
    const roofColor = palette.roofs[Math.floor(rng() * palette.roofs.length)] ?? 0x6a625a;

    const wallBucket = bucket(wallBuckets, `${style.wall}|${wallColor}`);
    const storefront = style.storefront && land !== null && height >= 4;

    walkEdges(b, height, rng, {
      style,
      palette,
      roofColor,
      storefront,
      wallBucket,
      flatBuckets,
      bucket,
      windowSlots,
      bulbSlots: land?.id === "mainStreet" ? bulbSlots : null,
      awningSlots,
    });

    // Flat roof cap (per roof color).
    const cap = flatPolygonGeometry(b.outer, b.inner);
    cap.translate(0, height, 0);
    let caps = roofGeos.get(roofColor);
    if (!caps) {
      caps = [];
      roofGeos.set(roofColor, caps);
    }
    caps.push(cap);

    // Signage anchor for named guest buildings.
    if (b.name !== undefined && land !== null && height >= 4 && signAnchors.length < 48) {
      const edge = longestEdge(b.outer);
      if (edge && edge.length >= 6) {
        signAnchors.push({
          name: b.name,
          position: new Vector3(
            edge.mid[0] + edge.normal[0] * 0.2,
            Math.min(height - 0.9, height * 0.8),
            edge.mid[1] + edge.normal[1] * 0.2,
          ),
          yawY: Math.atan2(edge.normal[0], edge.normal[1]),
        });
      }
    }
  }

  // --- Emit merged wall meshes (textured, tinted) ---
  for (const [key, quadBucket] of wallBuckets) {
    const geo = quadBucket.toGeometry();
    if (!geo) continue;
    const [kind, colorStr] = key.split("|");
    const mesh = new Mesh(
      geo,
      new MeshStandardMaterial({
        color: Number(colorStr),
        map: wallTexture((kind ?? "plaster") as WallKind),
        roughness: 0.9,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // --- Cornices, fascia bands, storefront glass ---
  for (const [key, quadBucket] of flatBuckets) {
    const geo = quadBucket.toGeometry();
    if (!geo) continue;
    const [kind, colorStr] = key.split("|");
    let material: MeshStandardMaterial;
    if (kind === "glass") {
      material = new MeshStandardMaterial({
        color: 0xd8ccb4,
        map: storefrontTexture(),
        emissive: new Color(0xffc880),
        emissiveIntensity: 0,
        roughness: 0.5,
        metalness: 0.1,
      });
      registerEmissive(material, 1.7); // shop windows glow at night
    } else {
      material = new MeshStandardMaterial({ color: Number(colorStr), roughness: 0.85 });
    }
    const mesh = new Mesh(geo, material);
    mesh.castShadow = kind !== "glass";
    scene.add(mesh);
  }

  // --- Merged flat roof caps per color ---
  for (const [color, geos] of roofGeos) {
    const merged = mergeBufferGeometries(geos);
    if (!merged) continue;
    const mesh = new Mesh(merged, new MeshStandardMaterial({ color, roughness: 0.85 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // --- Instanced windows ---
  if (windowSlots.length > 0) {
    const glassMaterial = new MeshStandardMaterial({
      color: 0x9fb2c0,
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

  // --- Instanced awnings (tilted, per-instance color) ---
  if (awningSlots.length > 0) {
    const awningGeo = new BoxGeometry(3.0, 0.1, 1.1);
    awningGeo.translate(0, 0, 0.55); // hinge at the wall edge
    awningGeo.rotateX(0.5); // outer edge droops down
    const awnings = new InstancedMesh(
      awningGeo,
      new MeshStandardMaterial({ roughness: 0.85 }),
      awningSlots.length,
    );
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const one = new Vector3(1, 1, 1);
    const c = new Color();
    awningSlots.forEach((slot, i) => {
      q.setFromAxisAngle(up, slot.yawY);
      m.compose(slot.position, q, one);
      awnings.setMatrixAt(i, m);
      awnings.setColorAt(i, c.setHex(slot.color));
    });
    awnings.instanceMatrix.needsUpdate = true;
    if (awnings.instanceColor) awnings.instanceColor.needsUpdate = true;
    awnings.castShadow = true;
    scene.add(awnings);
  }

  // --- Main Street roofline bulbs ---
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

  // --- Signage atlas: real shop names, one draw call ---
  buildSignage(scene, signAnchors);
}

interface EdgeContext {
  readonly style: LandStyle;
  readonly palette: LandPalette;
  readonly roofColor: number;
  readonly storefront: boolean;
  readonly wallBucket: QuadBucket;
  readonly flatBuckets: Map<string, QuadBucket>;
  readonly bucket: (map: Map<string, QuadBucket>, key: string) => QuadBucket;
  readonly windowSlots: WindowSlot[];
  readonly bulbSlots: Vector3[] | null;
  readonly awningSlots: AwningSlot[];
}

/** Generate walls + facade features along each outer edge. */
function walkEdges(
  b: BakedBuilding,
  height: number,
  rng: () => number,
  ctx: EdgeContext,
): void {
  const pts = b.outer;
  const floors = Math.max(1, Math.floor(height / LEVEL_HEIGHT));
  const a3 = new Vector3();
  const b3 = new Vector3();
  const c3 = new Vector3();
  const d3 = new Vector3();
  const n3 = new Vector3();

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const c = pts[(i + 1) % pts.length];
    if (!a || !c) continue;
    const dx = c[0] - a[0];
    const dz = c[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.4) continue;

    let nx = dz / len;
    let nz = -dx / len;
    const midX = (a[0] + c[0]) / 2;
    const midZ = (a[1] + c[1]) / 2;
    if (pointInPolygon(midX + nx * 0.4, midZ + nz * 0.4, pts)) {
      nx = -nx;
      nz = -nz;
    }
    const yaw = Math.atan2(nx, nz);
    n3.set(nx, 0, nz);

    // Wall quad with meter UVs (tile = WALL_TEX_METERS).
    const u1 = len / WALL_TEX_METERS;
    const v1 = height / WALL_TEX_METERS;
    a3.set(a[0], 0, a[1]);
    b3.set(c[0], 0, c[1]);
    c3.set(c[0], height, c[1]);
    d3.set(a[0], height, a[1]);
    ctx.wallBucket.addQuad(a3, b3, c3, d3, n3, 0, 0, u1, v1);

    // Cornice strip under the roofline.
    if (ctx.style.cornice && height >= 4 && len >= 2) {
      const off = 0.14;
      a3.set(a[0] + nx * off, height - 0.55, a[1] + nz * off);
      b3.set(c[0] + nx * off, height - 0.55, c[1] + nz * off);
      c3.set(c[0] + nx * off, height, c[1] + nz * off);
      d3.set(a[0] + nx * off, height, a[1] + nz * off);
      ctx.bucket(ctx.flatBuckets, `cornice|${ctx.palette.trim}`).addQuad(a3, b3, c3, d3, n3, 0, 0, 1, 1);
    }

    // Mansard fascia: sloped band leaning inward above the roofline.
    if (ctx.style.mansard && height >= 5 && len >= 3) {
      a3.set(a[0] + nx * 0.22, height - 0.35, a[1] + nz * 0.22);
      b3.set(c[0] + nx * 0.22, height - 0.35, c[1] + nz * 0.22);
      c3.set(c[0] - nx * 0.55, height + 1.35, c[1] - nz * 0.55);
      d3.set(a[0] - nx * 0.55, height + 1.35, a[1] - nz * 0.55);
      // Slope normal ≈ blend of outward + up.
      const slope = new Vector3(nx, 0.55, nz).normalize();
      ctx.bucket(ctx.flatBuckets, `fascia|${ctx.roofColor}`).addQuad(a3, b3, c3, d3, slope, 0, 0, 1, 1);
    }

    // Storefront: glass band + awnings on the ground floor.
    if (ctx.storefront && len >= 4) {
      const inset = 0.06;
      const margin = 0.5;
      const t0 = margin / len;
      const t1 = 1 - margin / len;
      a3.set(a[0] + dx * t0 + nx * inset, 0.35, a[1] + dz * t0 + nz * inset);
      b3.set(a[0] + dx * t1 + nx * inset, 0.35, a[1] + dz * t1 + nz * inset);
      c3.set(a[0] + dx * t1 + nx * inset, 2.95, a[1] + dz * t1 + nz * inset);
      d3.set(a[0] + dx * t0 + nx * inset, 2.95, a[1] + dz * t0 + nz * inset);
      // u = one 4 m window module per texture tile, so mullions repeat at
      // true scale along the band.
      const uGlass = (len - margin * 2) / 4;
      ctx.bucket(ctx.flatBuckets, "glass|0").addQuad(a3, b3, c3, d3, n3, 0, 0, uGlass, 1);

      const count = Math.floor(len / 4.2);
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count;
        const color =
          ctx.style.awnings[Math.floor(rng() * ctx.style.awnings.length)] ??
          ctx.palette.trim;
        ctx.awningSlots.push({
          position: new Vector3(a[0] + dx * t + nx * 0.1, 3.05, a[1] + dz * t + nz * 0.1),
          yawY: yaw,
          color,
        });
      }
    }

    // Windows: upper floors (ground floor too when there's no storefront).
    if (height >= 3) {
      const cols = Math.min(8, Math.floor(len / 3.2));
      const firstFloor = ctx.storefront ? 1 : 0;
      for (let col = 0; col < cols; col++) {
        const t = (col + 0.5) / cols;
        for (let f = firstFloor; f < floors; f++) {
          if (rng() < 0.18) continue;
          const y = 1.9 + f * LEVEL_HEIGHT;
          if (y + 0.7 > height) continue;
          ctx.windowSlots.push({
            position: new Vector3(a[0] + dx * t + nx * 0.15, y, a[1] + dz * t + nz * 0.15),
            yawY: yaw,
          });
        }
      }
    }

    // Roofline string-light bulbs (Main Street only).
    if (ctx.bulbSlots && height >= 3 && len >= 2.5) {
      const count = Math.floor(len / 1.3);
      for (let k = 0; k <= count; k++) {
        const t = count === 0 ? 0.5 : k / count;
        ctx.bulbSlots.push(
          new Vector3(a[0] + dx * t + nx * 0.18, height + 0.12, a[1] + dz * t + nz * 0.18),
        );
      }
    }
  }
}

/** Longest outward edge of a footprint (for sign placement). */
function longestEdge(
  pts: readonly Pt[],
): { mid: Pt; normal: Pt; length: number } | null {
  let best: { mid: Pt; normal: Pt; length: number } | null = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const c = pts[(i + 1) % pts.length];
    if (!a || !c) continue;
    const dx = c[0] - a[0];
    const dz = c[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < (best?.length ?? 0)) continue;
    let nx = dz / len;
    let nz = -dx / len;
    const midX = (a[0] + c[0]) / 2;
    const midZ = (a[1] + c[1]) / 2;
    if (pointInPolygon(midX + nx * 0.4, midZ + nz * 0.4, pts)) {
      nx = -nx;
      nz = -nz;
    }
    best = { mid: [midX, midZ], normal: [nx, nz], length: len };
  }
  return best;
}

/** One 2048px atlas of shop-name boards; every sign is a quad into it. */
function buildSignage(scene: Scene, anchors: readonly SignAnchor[]): void {
  if (anchors.length === 0) return;
  const CELL_W = 512;
  const CELL_H = 128;
  const COLS = 4;
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 2048;
  const c2d = canvas.getContext("2d");
  if (!c2d) return;

  anchors.forEach((anchor, i) => {
    const cx = (i % COLS) * CELL_W;
    const cy = Math.floor(i / COLS) * CELL_H;
    // Sign board.
    c2d.fillStyle = "#2a2118";
    c2d.fillRect(cx + 4, cy + 8, CELL_W - 8, CELL_H - 16);
    c2d.fillStyle = "#f0e4c8";
    c2d.fillRect(cx + 10, cy + 14, CELL_W - 20, CELL_H - 28);
    // Fitted text.
    let size = 56;
    c2d.font = `bold ${size}px Georgia, serif`;
    while (c2d.measureText(anchor.name).width > CELL_W - 44 && size > 18) {
      size -= 4;
      c2d.font = `bold ${size}px Georgia, serif`;
    }
    c2d.fillStyle = "#4a2c18";
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    c2d.fillText(anchor.name, cx + CELL_W / 2, cy + CELL_H / 2);
  });

  const atlas = new CanvasTexture(canvas);
  atlas.colorSpace = SRGBColorSpace;
  const material = new MeshStandardMaterial({ map: atlas, roughness: 0.8 });

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const W = 4.6;
  const H = 1.15;
  anchors.forEach((anchor, i) => {
    const u0 = ((i % COLS) * CELL_W) / 2048;
    const v1 = 1 - (Math.floor(i / COLS) * CELL_H) / 2048;
    const u1 = u0 + CELL_W / 2048;
    const v0 = v1 - CELL_H / 2048;
    const yaw = anchor.yawY;
    const rx = Math.cos(yaw) * (W / 2);
    const rz = -Math.sin(yaw) * (W / 2);
    const p = anchor.position;
    const corners = [
      [p.x - rx, p.y - H / 2, p.z - rz],
      [p.x + rx, p.y - H / 2, p.z + rz],
      [p.x + rx, p.y + H / 2, p.z + rz],
      [p.x - rx, p.y + H / 2, p.z - rz],
    ] as const;
    const nx = Math.sin(yaw);
    const nz = Math.cos(yaw);
    const emit = (idx: 0 | 1 | 2 | 3, u: number, v: number): void => {
      const corner = corners[idx];
      positions.push(corner[0], corner[1], corner[2]);
      normals.push(nx, 0, nz);
      uvs.push(u, v);
    };
    emit(0, u0, v0);
    emit(1, u1, v0);
    emit(2, u1, v1);
    emit(0, u0, v0);
    emit(2, u1, v1);
    emit(3, u0, v1);
  });
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  geo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  scene.add(new Mesh(geo, material));
}

/**
 * Height sanity when OSM gives no levels/height: tiny footprints are carts
 * and kiosks (one low story), small ones are single-story shops.
 */
function guessLevels(b: BakedBuilding, rng: () => number): number {
  let area = 0;
  const pts = b.outer;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j];
    const c = pts[i];
    if (!a || !c) continue;
    area += (a[0] * c[1] - c[0] * a[1]) / 2;
  }
  area = Math.abs(area);
  if (area < 25) return 0.9;
  if (area < 75) return 1.35;
  return DEFAULT_LEVELS + (rng() > 0.65 ? 1 : 0);
}

/** Local non-indexed merge (all buckets share the attribute layout). */
function mergeBufferGeometries(geos: readonly BufferGeometry[]): BufferGeometry | null {
  if (geos.length === 0) return null;
  let vertexCount = 0;
  for (const g of geos) {
    const nonIndexed = g.index ? g.toNonIndexed() : g;
    vertexCount += nonIndexed.getAttribute("position").count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  let offset = 0;
  for (const g of geos) {
    const src = g.index ? g.toNonIndexed() : g;
    const pos = src.getAttribute("position");
    const nor = src.getAttribute("normal");
    const uv = src.getAttribute("uv");
    positions.set(pos.array as Float32Array, offset * 3);
    if (nor) normals.set(nor.array as Float32Array, offset * 3);
    if (uv) uvs.set(uv.array as Float32Array, offset * 2);
    offset += pos.count;
    src.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute("position", new BufferAttribute(positions, 3));
  merged.setAttribute("normal", new BufferAttribute(normals, 3));
  merged.setAttribute("uv", new BufferAttribute(uvs, 2));
  return merged;
}
