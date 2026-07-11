import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

/**
 * Procedural CanvasTexture factory — no image assets anywhere in the
 * project. Pass 1 ships the castle's stained glass; the Pass-5 style kit
 * adds the tiling wall/ground materials (brick, clapboard, shingle…).
 * Textures are created once and shared; keep sizes ≤512px.
 */

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [canvas, ctx];
}

let rippleCache: CanvasTexture | null = null;

/** Subtle water ripple sheen: soft light streaks on transparent-ish blue. */
export function rippleTexture(): CanvasTexture {
  if (rippleCache) return rippleCache;
  const [canvas, ctx] = makeCanvas(256);
  // Near-white base so it multiplies gently over the water color.
  ctx.fillStyle = "#e8ecf0";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  let rand = 12345;
  const rng = (): number => {
    rand = (rand * 1103515245 + 12345) & 0x7fffffff;
    return rand / 0x7fffffff;
  };
  for (let i = 0; i < 40; i++) {
    const y = rng() * 256;
    const x = rng() * 256;
    const len = 18 + rng() * 46;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len / 2, y + (rng() - 0.5) * 7, x + len, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(140,170,200,0.4)";
  for (let i = 0; i < 30; i++) {
    const y = rng() * 256;
    const x = rng() * 256;
    const len = 14 + rng() * 36;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len / 2, y + (rng() - 0.5) * 6, x + len, y);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  rippleCache = texture;
  return texture;
}

let stainedGlassCache: CanvasTexture | null = null;

/** Rose-window stained glass: leaded segments in jewel tones on a dark field. */
export function stainedGlassTexture(): CanvasTexture {
  if (stainedGlassCache) return stainedGlassCache;
  const [canvas, ctx] = makeCanvas(256);

  ctx.fillStyle = "#141024";
  ctx.fillRect(0, 0, 256, 256);

  const cx = 128;
  const cy = 128;
  const jewel = ["#3557c0", "#b03a68", "#c8a02c", "#2e7d52", "#7a3fa0", "#c05a2c"];
  // Radial petals.
  for (let ring = 0; ring < 3; ring++) {
    const r0 = 24 + ring * 34;
    const r1 = r0 + 30;
    const petals = 8 + ring * 4;
    for (let i = 0; i < petals; i++) {
      const a0 = (i / petals) * Math.PI * 2;
      const a1 = ((i + 0.92) / petals) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r1, a0, a1);
      ctx.arc(cx, cy, r0, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = jewel[(i + ring * 2) % jewel.length] ?? "#3557c0";
      ctx.fill();
      ctx.strokeStyle = "#0c0a18";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  // Center medallion.
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = "#e8c84a";
  ctx.fill();
  ctx.strokeStyle = "#0c0a18";
  ctx.lineWidth = 4;
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  stainedGlassCache = texture;
  return texture;
}
