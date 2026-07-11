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

/**
 * Tiling wall textures, drawn near-grayscale so `material.color` supplies
 * the land palette tint — one texture serves every color. 1 world meter =
 * WALL_TEX_METERS of texture (UVs are generated in meters by the facade
 * kit in buildings.ts).
 */
export const WALL_TEX_METERS = 4; // texture tile covers 4 m × 4 m

const tileCache = new Map<string, CanvasTexture>();

function tiled(name: string, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const hit = tileCache.get(name);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas(256);
  draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  tileCache.set(name, texture);
  return texture;
}

export type WallKind = "brick" | "clapboard" | "plaster" | "board" | "panel";

export function wallTexture(kind: WallKind): CanvasTexture {
  switch (kind) {
    case "brick":
      return tiled("brick", (ctx) => {
        ctx.fillStyle = "#cfcac4"; // mortar
        ctx.fillRect(0, 0, 256, 256);
        const bw = 32;
        const bh = 16;
        for (let row = 0; row < 16; row++) {
          const offset = row % 2 === 0 ? 0 : bw / 2;
          for (let col = -1; col < 9; col++) {
            const shade = 200 + ((row * 7 + col * 13) % 28);
            ctx.fillStyle = `rgb(${shade},${shade - 6},${shade - 10})`;
            ctx.fillRect(col * bw + offset + 1, row * bh + 1, bw - 2, bh - 2);
          }
        }
      });
    case "clapboard":
      return tiled("clapboard", (ctx) => {
        for (let row = 0; row < 16; row++) {
          const shade = 224 + ((row * 11) % 18);
          ctx.fillStyle = `rgb(${shade},${shade},${shade - 4})`;
          ctx.fillRect(0, row * 16, 256, 16);
          ctx.fillStyle = "rgba(70,70,70,0.5)";
          ctx.fillRect(0, row * 16 + 14, 256, 2);
        }
      });
    case "board":
      return tiled("board", (ctx) => {
        for (let col = 0; col < 10; col++) {
          const shade = 208 + ((col * 17) % 26);
          ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 10})`;
          ctx.fillRect(col * 26, 0, 26, 256);
          ctx.fillStyle = "rgba(60,50,40,0.55)";
          ctx.fillRect(col * 26 + 24, 0, 2, 256);
        }
      });
    case "panel":
      return tiled("panel", (ctx) => {
        ctx.fillStyle = "#dcdfe2";
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = "rgba(110,118,126,0.6)";
        ctx.lineWidth = 2;
        for (let x = 0; x <= 256; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 256);
          ctx.stroke();
        }
        for (let y = 0; y <= 256; y += 85) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(256, y);
          ctx.stroke();
        }
      });
    case "plaster":
    default:
      return tiled("plaster", (ctx) => {
        ctx.fillStyle = "#e2ded8";
        ctx.fillRect(0, 0, 256, 256);
        let rand = 777;
        const rng = (): number => {
          rand = (rand * 1103515245 + 12345) & 0x7fffffff;
          return rand / 0x7fffffff;
        };
        for (let i = 0; i < 900; i++) {
          const v = 200 + Math.floor(rng() * 40);
          ctx.fillStyle = `rgba(${v},${v - 3},${v - 6},0.35)`;
          ctx.fillRect(rng() * 256, rng() * 256, 2.5, 2.5);
        }
      });
  }
}

let storefrontCache: CanvasTexture | null = null;

/**
 * Ground-floor storefront strip: one 4 m display-window module per tile —
 * dark glass, cream frame and mullions, kick panel. The facade kit maps
 * u = meters/4 along the band so modules repeat at true scale. Drawn
 * near-grayscale-warm; the material color tints frames per land trim.
 */
export function storefrontTexture(): CanvasTexture {
  if (storefrontCache) return storefrontCache;
  const [canvas, ctx] = makeCanvas(256);
  // Frame field (cream).
  ctx.fillStyle = "#e8e0cc";
  ctx.fillRect(0, 0, 256, 256);
  // Kick panel along the bottom.
  ctx.fillStyle = "#b8a888";
  ctx.fillRect(0, 214, 256, 42);
  // Two display windows + a door slot per module.
  const glass = "#1c242e";
  ctx.fillStyle = glass;
  ctx.fillRect(14, 26, 96, 182); // left display window
  ctx.fillRect(146, 26, 96, 182); // right display window
  // Transom divider inside each window.
  ctx.fillStyle = "#e8e0cc";
  ctx.fillRect(14, 62, 96, 8);
  ctx.fillRect(146, 62, 96, 8);
  // Center mullion post between the windows.
  ctx.fillRect(110, 0, 36, 256);
  ctx.fillStyle = glass;
  ctx.fillRect(118, 40, 20, 168); // narrow door glass in the post
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  storefrontCache = texture;
  return texture;
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
