import { mulberry32 } from "./random";

/**
 * Seeded 2D value noise with fractal octaves — used to displace landmark
 * geometry (Matterhorn crags, Big Thunder buttes, Splash Mountain).
 * Deterministic for a given seed so screenshots stay reproducible.
 */

const GRID = 256;

export interface Noise2D {
  /** Single octave, smooth-interpolated, output in [-1, 1]. */
  sample(x: number, y: number): number;
  /** Fractal sum of `octaves` octaves, output roughly in [-1, 1]. */
  fbm(x: number, y: number, octaves: number): number;
}

export function createNoise2D(seed: number): Noise2D {
  const rng = mulberry32(seed);
  const values = new Float32Array(GRID * GRID);
  for (let i = 0; i < values.length; i++) values[i] = rng() * 2 - 1;

  const at = (ix: number, iy: number): number =>
    values[((iy & (GRID - 1)) * GRID + (ix & (GRID - 1))) & (GRID * GRID - 1)] ?? 0;

  const smooth = (t: number): number => t * t * (3 - 2 * t);

  const sample = (x: number, y: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const a = at(ix, iy);
    const b = at(ix + 1, iy);
    const c = at(ix, iy + 1);
    const d = at(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };

  const fbm = (x: number, y: number, octaves: number): number => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < octaves; o++) {
      sum += sample(x * freq, y * freq) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum;
  };

  return { sample, fbm };
}
