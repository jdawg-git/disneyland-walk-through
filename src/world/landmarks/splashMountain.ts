import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from "three";
import { createNoise2D } from "../../engine/noise";
import { registerEmissive } from "../../engine/emissive";

/**
 * Splash Mountain — Critter Country's briar-covered mountain: mossy
 * green-brown noise peaks around a bare red-earth drop face, the log-flume
 * chute running down it into a splash pool, and a gnarled stump crown on
 * the summit. Purely additive (no OSM footprint) — collider circles in
 * walkable.ts must match BUTTES below.
 */

const STRATA: readonly Color[] = [
  new Color(0x6b5138), // earth
  new Color(0x7a5f42), // clay
  new Color(0x5d7042), // moss creeping in
  new Color(0x55763e), // brush green
  new Color(0x4d6b3a), // deep green
];

const BUTTES: readonly (readonly [number, number, number, number])[] = [
  // [dx, dz, radius, height] — keep in sync with walkable.ts colliders.
  [0, 0, 14, 26],
  [-11, 8, 9, 16],
  [10, -7, 9, 18],
  [9, 9, 7, 12],
];

export function buildSplashMountain(scene: Scene, x: number, z: number): void {
  const noise = createNoise2D(777001);
  const g = new Group();

  const rockMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
  });

  BUTTES.forEach(([dx, dz, radius, height], idx) => {
    const geo = new ConeGeometry(radius, height, 14, 10);
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const r = Math.hypot(vx, vz);
      if (r < 0.01) continue;
      const t = (vy + height / 2) / height;
      const theta = Math.atan2(vz, vx);
      const crag = noise.fbm(Math.cos(theta) * 2 + idx * 9, Math.sin(theta) * 2 + t * 4, 3) * 0.24;
      const damp = Math.min(1, (1 - t) * 4) * Math.min(1, t * 8 + 0.2);
      const mult = 1 + crag * damp;
      pos.setX(i, vx * mult);
      pos.setZ(i, vz * mult);
    }
    geo.computeVertexNormals();

    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + height / 2) / height;
      const theta = Math.atan2(pos.getZ(i), pos.getX(i));
      const waver = noise.sample(Math.cos(theta) * 3 + 50, Math.sin(theta) * 3) * 0.08;
      const band = Math.max(0, Math.min(STRATA.length - 1, Math.floor((t + waver) * STRATA.length)));
      c.copy(STRATA[band] ?? STRATA[2]!);
      const shade = 0.9 + noise.sample(theta * 5 + 70, t * 9) * 0.1;
      colors[i * 3] = c.r * shade;
      colors[i * 3 + 1] = c.g * shade;
      colors[i * 3 + 2] = c.b * shade;
    }
    geo.setAttribute("color", new BufferAttribute(colors, 3));

    const butte = new Mesh(geo, rockMaterial);
    butte.position.set(dx, height / 2, dz);
    butte.castShadow = true;
    butte.receiveShadow = true;
    g.add(butte);
  });

  // Gnarled stump crown on the summit.
  const stumpMaterial = new MeshStandardMaterial({ color: 0x4f3a28, roughness: 1, flatShading: true });
  const stump = new Mesh(new CylinderGeometry(1.7, 2.4, 3.2, 9), stumpMaterial);
  stump.position.set(0, 25.2, 0);
  stump.castShadow = true;
  g.add(stump);
  const stumpTop = new Mesh(new CylinderGeometry(1.95, 1.7, 0.5, 9), stumpMaterial);
  stumpTop.position.set(0, 27, 0);
  g.add(stumpTop);

  // The flume drop: a short tan chute hugging the south face, into a pool.
  const chuteMaterial = new MeshStandardMaterial({
    color: 0xc8a878,
    roughness: 0.8,
    flatShading: true,
  });
  const chuteGroup = new Group();
  const chute = new Mesh(new BoxGeometry(2.6, 0.5, 14), chuteMaterial);
  chute.castShadow = true;
  chuteGroup.add(chute);
  for (const side of [-1, 1]) {
    const chuteRail = new Mesh(new BoxGeometry(0.35, 0.9, 14), chuteMaterial);
    chuteRail.position.set(side * 1.3, 0.35, 0);
    chuteGroup.add(chuteRail);
  }
  // Descend from mid-mountain (y≈11 at z≈4) to the pool lip (y≈1 at z≈13.5).
  chuteGroup.position.set(1.5, 6, 8.8);
  chuteGroup.rotation.x = 0.8;
  g.add(chuteGroup);

  // Splash pool at the base of the drop.
  const poolMaterial = new MeshStandardMaterial({
    color: 0x3a6a9e,
    roughness: 0.25,
    emissive: new Color(0x16304e),
    emissiveIntensity: 0,
  });
  registerEmissive(poolMaterial, 0.5);
  const pool = new Mesh(new CylinderGeometry(4.5, 4.5, 0.25, 18), poolMaterial);
  pool.scale.z = 0.7;
  pool.position.set(1.5, 0.14, 15.5);
  g.add(pool);

  g.position.set(x, 0, z);
  scene.add(g);
}
