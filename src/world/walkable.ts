import { Vector3 } from "three";
import { PARK_LAYOUT, pointInPolygon, type Pt } from "../data/parkLayout";

const CELL = 0.5; // meters per grid cell
const PLAYER_RADIUS_CELLS = 1; // obstacle dilation ≈ 0.5 m
const PATH_HALF_WIDTH = 1.4; // carved walkway ribbon half-width (m)

/** The castle mesh has a real gate opening — its footprint stays carved. */
const WALKTHROUGH_BUILDING_IDS: ReadonlySet<number> = new Set([331440228]);

/**
 * Baked 2D walkable bitmap. Rasterization order matters:
 *   1. park boundary  → walkable
 *   2. water + greens + buildings → blocked
 *   3. real OSM footway/pedestrian polylines → carved walkable ribbons
 *      (this is what restores bridges over water and the castle corridor)
 *   4. generic buildings re-blocked (walk-through landmarks excluded) so
 *      the ribbons can't tunnel through shops
 * then obstacles dilate by the player radius so runtime collision is a
 * single point lookup. Movement resolves with axis-separated sliding.
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

    // 1. Boundary interior is walkable.
    this.fillPolygon(boundary, 1);
    // 2. Obstacles.
    for (const b of PARK_LAYOUT.buildings) this.fillPolygon(b.outer, 0);
    for (const w of PARK_LAYOUT.water) this.fillPolygon(w.outer, 0);
    for (const g of PARK_LAYOUT.greens) this.fillPolygon(g.outer, 0);
    // 3. Carve real walkways back in — bridges + castle corridor.
    for (const path of PARK_LAYOUT.paths) {
      if (path.kind !== "footway" && path.kind !== "pedestrian" && path.kind !== "steps") continue;
      this.carvePolyline(path.points, PATH_HALF_WIDTH);
    }
    // 4. Buildings win over ribbons — except walk-through landmarks.
    for (const b of PARK_LAYOUT.buildings) {
      if (WALKTHROUGH_BUILDING_IDS.has(b.id)) continue;
      this.fillPolygon(b.outer, 0);
    }

    this.dilateBlocked(PLAYER_RADIUS_CELLS);
  }

  isWalkable(x: number, z: number): boolean {
    const c = Math.floor((x - this.minX) / CELL);
    const r = Math.floor((z - this.minZ) / CELL);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
    return this.grid[r * this.cols + c] === 1;
  }

  /** Axis-separated slide: full move, then X-only, then Z-only, else stay. */
  resolve(from: Vector3, to: Vector3): Vector3 {
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
