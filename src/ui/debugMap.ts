import { LANDS } from "../config/lands";
import { PARK_LAYOUT } from "../data/parkLayout";

/**
 * ?debug=map — top-down 2D rendering of the baked OSM layout with the
 * authored land polygons overlaid. Used to author/verify land boundaries:
 * move the mouse to read park coordinates, click to log them to the console
 * (paste into src/config/lands.ts).
 */
export function showDebugMap(): void {
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText = "position:fixed;inset:0;background:#10141c;z-index:200;";
  document.body.appendChild(canvas);

  const readout = document.createElement("div");
  readout.style.cssText =
    "position:fixed;top:10px;left:10px;color:#eee;font:13px monospace;z-index:201;" +
    "background:rgba(0,0,0,.6);padding:6px 10px;border-radius:6px;";
  readout.textContent = "debug map — click to log coords";
  document.body.appendChild(readout);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Fit the park bounds into the viewport.
  const b = PARK_LAYOUT.boundary;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of b) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[1]);
    maxZ = Math.max(maxZ, p[1]);
  }
  const pad = 20;
  const scale = Math.min(
    (canvas.width - pad * 2) / (maxX - minX),
    (canvas.height - pad * 2) / (maxZ - minZ),
  );
  const toX = (x: number): number => pad + (x - minX) * scale;
  const toY = (z: number): number => pad + (z - minZ) * scale;
  const fromScreen = (sx: number, sy: number): readonly [number, number] => [
    Math.round((sx - pad) / scale + minX),
    Math.round((sy - pad) / scale + minZ),
  ];

  const poly = (pts: ReadonlyArray<readonly [number, number]>): void => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(toX(p[0]), toY(p[1]));
      else ctx.lineTo(toX(p[0]), toY(p[1]));
    });
    ctx.closePath();
  };

  // Meter grid every 50 m.
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let x = Math.ceil(minX / 50) * 50; x <= maxX; x += 50) {
    ctx.beginPath();
    ctx.moveTo(toX(x), toY(minZ));
    ctx.lineTo(toX(x), toY(maxZ));
    ctx.stroke();
  }
  for (let z = Math.ceil(minZ / 50) * 50; z <= maxZ; z += 50) {
    ctx.beginPath();
    ctx.moveTo(toX(minX), toY(z));
    ctx.lineTo(toX(maxX), toY(z));
    ctx.stroke();
  }

  // Park boundary.
  poly(b);
  ctx.strokeStyle = "#e0b040";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Greens, water, buildings, paths, rail.
  ctx.fillStyle = "rgba(90,140,70,0.5)";
  for (const g of PARK_LAYOUT.greens) {
    poly(g.outer);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(70,120,190,0.7)";
  for (const w of PARK_LAYOUT.water) {
    poly(w.outer);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(200,200,210,0.75)";
  for (const bd of PARK_LAYOUT.buildings) {
    poly(bd.outer);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(210,180,140,0.5)";
  ctx.lineWidth = 1;
  for (const p of PARK_LAYOUT.paths) {
    ctx.beginPath();
    p.points.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(toX(pt[0]), toY(pt[1]));
      else ctx.lineTo(toX(pt[0]), toY(pt[1]));
    });
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(220,90,90,0.8)";
  for (const r of PARK_LAYOUT.railroad) {
    ctx.beginPath();
    r.points.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(toX(pt[0]), toY(pt[1]));
      else ctx.lineTo(toX(pt[0]), toY(pt[1]));
    });
    ctx.stroke();
  }

  // Land polygons + labels.
  const landColors = [
    "#e06666",
    "#6aa84f",
    "#6d9eeb",
    "#f6b26b",
    "#a64d79",
    "#46bdc6",
    "#ffd966",
    "#9966cc",
    "#cccccc",
  ];
  LANDS.forEach((land, i) => {
    poly(land.polygon);
    const color = landColors[i % landColors.length] ?? "#ffffff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "bold 13px monospace";
    let cx = 0;
    let cz = 0;
    for (const p of land.polygon) {
      cx += p[0];
      cz += p[1];
    }
    cx /= land.polygon.length;
    cz /= land.polygon.length;
    ctx.fillText(land.id, toX(cx) - 24, toY(cz));
  });

  // Attraction markers.
  ctx.fillStyle = "#ffd0f0";
  ctx.font = "10px monospace";
  for (const a of PARK_LAYOUT.attractions) {
    ctx.beginPath();
    ctx.arc(toX(a.center[0]), toY(a.center[1]), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  canvas.addEventListener("mousemove", (e: MouseEvent) => {
    const [x, z] = fromScreen(e.clientX, e.clientY);
    readout.textContent = `x=${x}  z=${z}   (click to log)`;
  });
  canvas.addEventListener("click", (e: MouseEvent) => {
    const [x, z] = fromScreen(e.clientX, e.clientY);
    console.log(`[${x}, ${z}],`);
  });
}
