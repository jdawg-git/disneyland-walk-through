import type { Pt } from "./parkLayout";

/**
 * Stitch unordered narrow-gauge rail segments into one ordered loop:
 * start from the longest segment, greedily append the nearest segment end
 * (either orientation), and drop spurs (roundhouse sidings) that never come
 * within tolerance. Pure over the input — used both by the train at runtime
 * and by scripts/filter-guest-map.ts, where the stitched ring doubles as
 * the park's guest boundary (the DLRR berm is what actually encloses the
 * guest area in Anaheim).
 */
export interface RailSegment {
  readonly kind: string;
  readonly points: readonly Pt[];
}

export function stitchNarrowGaugeRing(railroad: readonly RailSegment[]): {
  points: Pt[];
  closureGap: number;
} {
  const segs: [number, number][][] = railroad
    .filter((r) => r.kind === "narrow_gauge")
    .map((r) => r.points.map((p) => [p[0], p[1]] as [number, number]));
  if (segs.length === 0) return { points: [], closureGap: Infinity };

  segs.sort((a, b) => b.length - a.length);
  const first = segs.shift();
  if (!first) return { points: [], closureGap: Infinity };
  const chain: [number, number][] = [...first];

  while (segs.length > 0) {
    const tail = chain[chain.length - 1];
    if (!tail) break;
    let bestIndex = -1;
    let bestReversed = false;
    let bestDist = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s) continue;
      const head = s[0];
      const end = s[s.length - 1];
      if (!head || !end) continue;
      const d0 = Math.hypot(head[0] - tail[0], head[1] - tail[1]);
      const d1 = Math.hypot(end[0] - tail[0], end[1] - tail[1]);
      if (d0 < bestDist) {
        bestDist = d0;
        bestIndex = i;
        bestReversed = false;
      }
      if (d1 < bestDist) {
        bestDist = d1;
        bestIndex = i;
        bestReversed = true;
      }
    }
    const seg = segs.splice(bestIndex, 1)[0];
    if (!seg) break;
    if (bestDist > 40) continue; // spur — drop it
    chain.push(...(bestReversed ? [...seg].reverse() : seg));
  }

  // De-duplicate consecutive points (segment joints repeat their shared
  // endpoint). Zero-length curve segments make three's arc-length cache
  // divide 0/0 → NaN t → crash inside CatmullRomCurve3.getPoint.
  const deduped: [number, number][] = [];
  for (const p of chain) {
    const last = deduped[deduped.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.5) continue;
    deduped.push(p);
  }

  // Trim the tail once the chain returns to its start: greedy stitching can
  // keep appending yard spurs (the roundhouse lead doubles back to z≈-375
  // twice) AFTER the loop has already closed, which corrupts both the
  // boundary polygon and the train's path.
  const start = deduped[0];
  if (start) {
    for (let i = Math.floor(deduped.length / 2); i < deduped.length; i++) {
      const p = deduped[i];
      if (p && Math.hypot(p[0] - start[0], p[1] - start[1]) < 30) {
        deduped.length = i + 1;
        break;
      }
    }
    // Closed CatmullRom curves treat points as cyclic — an exact duplicate
    // of the head at the tail would create a zero-length cyclic segment.
    const tail = deduped[deduped.length - 1];
    if (tail && deduped.length > 1 && Math.hypot(tail[0] - start[0], tail[1] - start[1]) < 0.5) {
      deduped.pop();
    }
  }

  const head = deduped[0];
  const tail = deduped[deduped.length - 1];
  const closureGap =
    head && tail ? Math.hypot(head[0] - tail[0], head[1] - tail[1]) : Infinity;
  return { points: deduped, closureGap };
}

/**
 * Expand a closed ring outward from its centroid by `meters`. Crude
 * (radial, not a true polygon offset) but ample for a boundary buffer on a
 * ring this convex — keeps berm-edge guest buildings inside the cut.
 */
export function bufferRing(ring: readonly Pt[], meters: number): Pt[] {
  let cx = 0;
  let cz = 0;
  for (const p of ring) {
    cx += p[0];
    cz += p[1];
  }
  cx /= ring.length;
  cz /= ring.length;
  return ring.map((p) => {
    const dx = p[0] - cx;
    const dz = p[1] - cz;
    const len = Math.hypot(dx, dz) || 1;
    return [p[0] + (dx / len) * meters, p[1] + (dz / len) * meters] as Pt;
  });
}
