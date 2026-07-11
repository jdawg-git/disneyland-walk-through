import layoutJson from "./park-layout.json";

/** [x, z] in local meters — origin at the hub, +X east, −Z north. */
export type Pt = readonly [number, number];

export interface BakedBuilding {
  readonly id: number;
  readonly name?: string;
  readonly levels?: number;
  readonly height?: number;
  readonly outer: readonly Pt[];
  readonly inner?: readonly (readonly Pt[])[];
}

export interface BakedPath {
  readonly id: number;
  readonly kind: string;
  readonly points: readonly Pt[];
}

export interface BakedWater {
  readonly id: number;
  readonly name?: string;
  readonly outer: readonly Pt[];
  readonly inner?: readonly (readonly Pt[])[];
}

export interface BakedRail {
  readonly id: number;
  readonly name?: string;
  readonly kind: string;
  readonly points: readonly Pt[];
}

export interface BakedAttraction {
  readonly id: number;
  readonly name: string;
  readonly center: Pt;
  readonly outline?: readonly Pt[];
}

export interface BakedGreen {
  readonly id: number;
  readonly outer: readonly Pt[];
}

export interface ParkLayout {
  readonly origin: { readonly lat: number; readonly lon: number };
  readonly boundary: readonly Pt[];
  readonly buildings: readonly BakedBuilding[];
  readonly paths: readonly BakedPath[];
  readonly water: readonly BakedWater[];
  readonly railroad: readonly BakedRail[];
  readonly attractions: readonly BakedAttraction[];
  readonly greens: readonly BakedGreen[];
}

/** A ring is closed when its endpoints (nearly) meet — fillable as area. */
export function isClosedRing(points: readonly Pt[]): boolean {
  if (points.length < 4) return false;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return false;
  return Math.hypot(first[0] - last[0], first[1] - last[1]) < 1.0;
}

const rawLayout = layoutJson as unknown as ParkLayout;

/**
 * OSM maps some streams/canal banks as OPEN polylines tagged as water;
 * polygon-filling those produces phantom water sheets. Only closed rings
 * are kept — this filter feeds terrain, the walkable grid, and the debug
 * map alike.
 */
export const PARK_LAYOUT: ParkLayout = {
  ...rawLayout,
  water: rawLayout.water.filter((w) => isClosedRing(w.outer)),
};

export function polygonCentroid(points: readonly Pt[]): Pt {
  let sx = 0;
  let sz = 0;
  for (const p of points) {
    sx += p[0];
    sz += p[1];
  }
  return [sx / points.length, sz / points.length];
}

export function pointInPolygon(x: number, z: number, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (!a || !b) continue;
    if (a[1] > z !== b[1] > z) {
      const ix = ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0];
      if (x < ix) inside = !inside;
    }
  }
  return inside;
}
