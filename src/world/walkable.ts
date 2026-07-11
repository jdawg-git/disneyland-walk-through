import { Vector3 } from "three";
import { LANDMARKS } from "../config/landmarks";
import { PARK_LAYOUT, pointInPolygon, type Pt } from "../data/parkLayout";

const CELL = 0.5; // meters per grid cell
const PLAYER_RADIUS_CELLS = 1; // obstacle dilation ≈ 0.5 m
const PATH_HALF_WIDTH = 2.0; // carved walkway ribbon half-width (m)

/**
 * Bespoke landmarks do NOT use their OSM footprints for collision — those
 * include huge invisible show buildings (Space Mountain's is r 37-65 m vs a
 * ~32 m visible dome), and walking into an invisible wall reads as "stuck".
 * Instead each landmark blocks a shape matching its VISIBLE mesh (small
 * margin included). Applied after path carving, so queue walkways can't
 * tunnel through the mountains; gaps (castle gate, station tunnels) are
 * part of the shapes themselves.
 */
const LANDMARK_FOOTPRINT_IDS: ReadonlySet<number> = new Set(
  LANDMARKS.flatMap((l) => [...l.osmIds]),
);

interface CircleCollider { readonly kind: "circle"; readonly x: number; readonly z: number; readonly r: number; }
interface BoxCollider { readonly kind: "box"; readonly x: number; readonly z: number; readonly halfW: number; readonly halfD: number; }
type LandmarkCollider = CircleCollider | BoxCollider;

const LANDMARK_COLLIDERS: readonly LandmarkCollider[] = [
  // Castle: two blocks flanking the 5 m walk-through corridor (x 3.2..8.4).
  { kind: "box", x: -3.55, z: -10.5, halfW: 6.75, halfD: 11.5 },
  { kind: "box", x: 15.15, z: -10.5, halfW: 6.75, halfD: 11.5 },
  // Main Street Station mound (entrance tunnels stay open on both sides).
  { kind: "box", x: 2.6, z: 300.2, halfW: 15, halfD: 7.5 },
  // Partners statue pedestal at the hub center (streetFurniture.ts).
  { kind: "circle", x: 1, z: 55, r: 2.2 },
  // Space Mountain dome + concourse.
  { kind: "circle", x: 151, z: 162, r: 33.5 },
  // Matterhorn.
  { kind: "circle", x: 109, z: -38.8, r: 29.5 },
  // Big Thunder buttes (one circle per butte).
  { kind: "circle", x: -124.2, z: 3.8, r: 21 },
  { kind: "circle", x: -142.2, z: 15.8, r: 14 },
  { kind: "circle", x: -110.2, z: -10.2, r: 16 },
  { kind: "circle", x: -106.2, z: 13.8, r: 10 },
  { kind: "circle", x: -136.2, z: -14.2, r: 10 },
  // it's a small world facade (route to Toontown passes west of it).
  { kind: "box", x: 114.3, z: -247.7, halfW: 51, halfD: 4 },
  // Pirates facade + wings.
  { kind: "box", x: -200.2, z: 190.5, halfW: 26, halfD: 7.5 },
  // Haunted Mansion.
  { kind: "box", x: -301.8, z: 120.2, halfW: 12, halfD: 9.5 },
  // Enchanted Tiki Room.
  { kind: "box", x: -53.2, z: 114.3, halfW: 15.5, halfD: 8.5 },
  // Tiana's Bayou Adventure buttes (keep in sync with landmarks/tianas.ts:
  // group at (-348, 68) rotated +90°, local (dx,dz) → world (x+dz, z−dx)).
  { kind: "circle", x: -348, z: 68, r: 18 },
  { kind: "circle", x: -340, z: 79, r: 12 },
  { kind: "circle", x: -355, z: 58, r: 12 },
  { kind: "circle", x: -339, z: 59, r: 9.5 },
];

/**
 * Baked 2D walkable bitmap. Rasterization order matters:
 *   1. park boundary  → walkable  (grass/planters do NOT block — walk the
 *      lawns freely; only water and buildings are obstacles)
 *   2. water + buildings → blocked, then dilated by the player radius
 *   3. real OSM footway/pedestrian polylines → carved walkable ribbons at
 *      FULL width (carving after dilation keeps walkways from being nibbled
 *      into dead-end pockets — this is what restores bridges over water and
 *      the castle corridor)
 *   4. generic buildings re-blocked, undilated (walk-through landmarks
 *      excluded) so the ribbons can't tunnel through shops
 * Movement resolves with axis-separated sliding, with an escape hatch: if
 * the player is ever inside a blocked cell, movement is unrestricted until
 * they're back on walkable ground — you can never be permanently stuck.
 */
export class WalkableGrid {
  private readonly grid: Uint8Array;
  private readonly cols: number;
  private readonly rows: number;
  private readonly minX: number;
  private readonly minZ: number;

  constructor() {
    const boundary = PARK_LAYOUT.boundary;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of boundary) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[1]);
      maxZ = Math.max(maxZ, p[1]);
    }
    this.minX = minX - 4;
    this.minZ = minZ - 4;
    this.cols = Math.ceil((maxX - minX + 8) / CELL);
    this.rows = Math.ceil((maxZ - minZ + 8) / CELL);
    this.grid = new Uint8Array(this.cols * this.rows); // 0 = blocked, 1 = walkable

    // 1. Boundary interior is walkable (lawns included).
    this.fillPolygon(boundary, 1);
    // 2. Obstacles: water + generic buildings (landmark footprints excluded
    //    — they get visual-matched colliders in step 5), dilated.
    for (const b of PARK_LAYOUT.buildings) {
      if (LANDMARK_FOOTPRINT_IDS.has(b.id)) continue;
      this.fillPolygon(b.outer, 0);
    }
    for (const w of PARK_LAYOUT.water) this.fillPolygon(w.outer, 0);
    this.dilateBlocked(PLAYER_RADIUS_CELLS);
    // 3. Carve real walkways at full width — bridges + castle corridor —
    //    and pedestrian AREA polygons (plazas/street surfaces).
    for (const path of PARK_LAYOUT.paths) {
      if (path.kind !== "footway" && path.kind !== "pedestrian" && path.kind !== "steps") continue;
      this.carvePolyline(path.points, PATH_HALF_WIDTH);
    }
    for (const plaza of PARK_LAYOUT.plazas) this.fillPolygon(plaza.outer, 1);
    // 4. Generic buildings win over ribbons.
    for (const b of PARK_LAYOUT.buildings) {
      if (LANDMARK_FOOTPRINT_IDS.has(b.id)) continue;
      this.fillPolygon(b.outer, 0);
    }
    // 5. Landmark colliders — solid, match the visible meshes.
    for (const c of LANDMARK_COLLIDERS) {
      if (c.kind === "circle") this.fillCircle(c.x, c.z, c.r);
      else this.fillBox(c.x, c.z, c.halfW, c.halfD);
    }
  }

  isWalkable(x: number, z: number): boolean {
    const c = Math.floor((x - this.minX) / CELL);
    const r = Math.floor((z - this.minZ) / CELL);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
    return this.grid[r * this.cols + c] === 1;
  }

  /** Axis-separated slide: full move, then X-only, then Z-only, else stay. */
  resolve(from: Vector3, to: Vector3): Vector3 {
    // Escape hatch: if the player is somehow inside a blocked cell (grid
    // pocket, config edit, teleport), let them move freely until they reach
    // walkable ground — never freeze in place.
    if (!this.isWalkable(from.x, from.z)) return to;
    if (this.isWalkable(to.x, to.z)) return to;
    if (this.isWalkable(to.x, from.z)) return new Vector3(to.x, to.y, from.z);
    if (this.isWalkable(from.x, to.z)) return new Vector3(from.x, to.y, to.z);
    return from.clone();
  }

  /** Flood-fill reachability from a point — used by connectivity tests. */
  reachableFrom(startX: number, startZ: number): (x: number, z: number) => boolean {
    const startC = Math.floor((startX - this.minX) / CELL);
    const startR = Math.floor((startZ - this.minZ) / CELL);
    const visited = new Uint8Array(this.cols * this.rows);
    const queue: number[] = [];
    const idx = (r: number, c: number): number => r * this.cols + c;
    if (this.grid[idx(startR, startC)] === 1) {
      visited[idx(startR, startC)] = 1;
      queue.push(idx(startR, startC));
    }
    while (queue.length > 0) {
      const i = queue.pop();
      if (i === undefined) break;
      const r = Math.floor(i / this.cols);
      const c = i % this.cols;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= this.rows || cc >= this.cols) continue;
        const j = idx(rr, cc);
        if (visited[j] === 0 && this.grid[j] === 1) {
          visited[j] = 1;
          queue.push(j);
        }
      }
    }
    return (x: number, z: number): boolean => {
      const c = Math.floor((x - this.minX) / CELL);
      const r = Math.floor((z - this.minZ) / CELL);
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
      return visited[idx(r, c)] === 1;
    };
  }

  private fillPolygon(poly: readonly Pt[], value: 0 | 1): void {
    if (poly.length < 3) return;
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
    const c0 = Math.max(0, Math.floor((minX - this.minX) / CELL));
    const c1 = Math.min(this.cols - 1, Math.ceil((maxX - this.minX) / CELL));
    const r0 = Math.max(0, Math.floor((minZ - this.minZ) / CELL));
    const r1 = Math.min(this.rows - 1, Math.ceil((maxZ - this.minZ) / CELL));
    for (let r = r0; r <= r1; r++) {
      const z = this.minZ + (r + 0.5) * CELL;
      for (let c = c0; c <= c1; c++) {
        const x = this.minX + (c + 0.5) * CELL;
        if (pointInPolygon(x, z, poly)) this.grid[r * this.cols + c] = value;
      }
    }
  }

  private fillCircle(x: number, z: number, r: number): void {
    const c0 = Math.max(0, Math.floor((x - r - this.minX) / CELL));
    const c1 = Math.min(this.cols - 1, Math.ceil((x + r - this.minX) / CELL));
    const r0 = Math.max(0, Math.floor((z - r - this.minZ) / CELL));
    const r1 = Math.min(this.rows - 1, Math.ceil((z + r - this.minZ) / CELL));
    for (let row = r0; row <= r1; row++) {
      const cz = this.minZ + (row + 0.5) * CELL;
      for (let col = c0; col <= c1; col++) {
        const cx = this.minX + (col + 0.5) * CELL;
        if (Math.hypot(cx - x, cz - z) <= r) this.grid[row * this.cols + col] = 0;
      }
    }
  }

  private fillBox(x: number, z: number, halfW: number, halfD: number): void {
    const c0 = Math.max(0, Math.floor((x - halfW - this.minX) / CELL));
    const c1 = Math.min(this.cols - 1, Math.ceil((x + halfW - this.minX) / CELL));
    const r0 = Math.max(0, Math.floor((z - halfD - this.minZ) / CELL));
    const r1 = Math.min(this.rows - 1, Math.ceil((z + halfD - this.minZ) / CELL));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        this.grid[row * this.cols + col] = 0;
      }
    }
  }

  /** Mark a ribbon around a polyline walkable (bridges, corridors). */
  private carvePolyline(points: readonly Pt[], halfWidth: number): void {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (!a || !b) continue;
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.ceil(segLen / (CELL * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        const c0 = Math.max(0, Math.floor((x - halfWidth - this.minX) / CELL));
        const c1 = Math.min(this.cols - 1, Math.floor((x + halfWidth - this.minX) / CELL));
        const r0 = Math.max(0, Math.floor((z - halfWidth - this.minZ) / CELL));
        const r1 = Math.min(this.rows - 1, Math.floor((z + halfWidth - this.minZ) / CELL));
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            this.grid[r * this.cols + c] = 1;
          }
        }
      }
    }
  }

  private dilateBlocked(cells: number): void {
    for (let pass = 0; pass < cells; pass++) {
      const snapshot = this.grid.slice();
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (snapshot[r * this.cols + c] !== 0) continue;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const rr = r + dr;
              const cc = c + dc;
              if (rr < 0 || cc < 0 || rr >= this.rows || cc >= this.cols) continue;
              this.grid[rr * this.cols + cc] = 0;
            }
          }
        }
      }
    }
  }
}
