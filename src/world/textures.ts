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
