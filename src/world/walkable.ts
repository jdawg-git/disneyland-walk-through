import { Vector3 } from "three";
import { PARK_LAYOUT, pointInPolygon, type Pt } from "../data/parkLayout";

const CELL = 0.5; // meters per grid cell
const PLAYER_RADIUS_CELLS = 1; // obstacle dilation ≈ 0.5 m

/**
 * Baked 2D walkable bitmap: park boundary filled walkable, then buildings,
 * water, and planters re-blocked, dilated by the player radius so runtime
 * collision is a single point lookup. Movement resolves with axis-separated
 * sliding (try full move → X only → Z only).
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

    this.fillPolygon(boundary, 1);
    for (const b of PARK_LAYOUT.buildings) this.fillPolygon(b.outer, 0);
    for (const w of PARK_LAYOUT.water) this.fillPolygon(w.outer, 0);
    for (const g of PARK_LAYOUT.greens) this.fillPolygon(g.outer, 0);
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
