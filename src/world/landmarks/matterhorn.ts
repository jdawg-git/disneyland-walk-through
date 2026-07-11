import { BufferAttribute, Color, ConeGeometry, Mesh, MeshStandardMaterial, Scene } from "three";
import { createNoise2D } from "../../engine/noise";

/**
 * The Matterhorn v2 — craggy snow-capped peak, tallest silhouette in
 * Fantasyland. High-segment cone displaced by ridged fractal noise, with
 * vertex-colored strata: blue-grey rock shading into snowfields above the
 * snow line, with extra snow settling on flatter ledges (slope-based).
 */

const HEIGHT = 52;
const BASE_RADIUS = 24;
const SNOW_LINE = 0.4; // normalized height where snow begins

const ROCK = new Color(0x939caa);
const ROCK_DARK = new Color(0x776f64);
const SNOW = new Color(0xffffff);

export function buildMatterhorn(scene: Scene, x: number, z: number): void {
  const noise = createNoise2D(107280556);

  const geo = new ConeGeometry(BASE_RADIUS, HEIGHT, 30, 18);
  const pos = geo.getAttribute("position");

  // --- Displace: ridged crags, damped at the apex and the ground line ---
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const t = (vy + HEIGHT / 2) / HEIGHT; // 0 base → 1 apex
    const radius = Math.hypot(vx, vz);
    if (radius < 0.01) continue; // apex point stays

    const theta = Math.atan2(vz, vx);
    // Fold theta into noise space with cos/sin so the seam wraps cleanly.
    const nx = Math.cos(theta) * 2.1 + 8;
    const ny = Math.sin(theta) * 2.1 + 8;
    const base = noise.fbm(nx + t * 1.2, ny + t * 5.2, 3);
    const ridge = 1 - Math.abs(noise.fbm(nx * 0.7 + 21, ny * 0.7 + t * 3.1, 2)) * 2;

    // Damp near apex (keep the summit sharp) and near the ground.
    const damp = Math.min(1, (1 - t) * 3.2) * Math.min(1, t * 6 + 0.15);
    const mult = 1 + (base * 0.34 + ridge * 0.14) * damp;
    pos.setX(i, vx * mult);
    pos.setZ(i, vz * mult);
    // Slight vertical jitter for ledge steps (not on the base ring).
    if (t > 0.04) pos.setY(i, vy + noise.sample(nx * 3 + 40, ny * 3) * 1.4 * damp);
  }
  geo.computeVertexNormals();

  // --- Vertex colors: rock shading + snow by height and slope ---
  const normal = geo.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const vy = pos.getY(i);
    const t = (vy + HEIGHT / 2) / HEIGHT;
    const theta = Math.atan2(pos.getZ(i), pos.getX(i));
    const jitter = noise.sample(Math.cos(theta) * 4 + 60, t * 9 + 60) * 0.09;

    // Rock varies between light and dark for crevice depth.
    const shade = 0.5 + noise.fbm(Math.cos(theta) * 3 + 30, t * 7, 2) * 0.5;
    c.copy(ROCK_DARK).lerp(ROCK, Math.max(0, Math.min(1, shade)));

    // Snow: above the (jittered) snow line, plus settling on flat ledges.
    const heightSnow = smoothstep(SNOW_LINE + jitter, SNOW_LINE + jitter + 0.12, t);
    const ledgeSnow = t > 0.22 ? Math.max(0, normal.getY(i) - 0.45) * 1.8 : 0;
    const snowAmount = Math.min(1, heightSnow + ledgeSnow);
    c.lerp(SNOW, snowAmount);

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new BufferAttribute(colors, 3));

  const mountain = new Mesh(
    geo,
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, flatShading: true }),
  );
  mountain.position.set(x, HEIGHT / 2 - 1, z);
  mountain.castShadow = true;
  mountain.receiveShadow = true;
  scene.add(mountain);
}

function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
