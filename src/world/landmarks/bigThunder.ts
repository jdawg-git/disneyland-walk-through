import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
  TorusGeometry,
} from "three";
import { createNoise2D } from "../../engine/noise";

/**
 * Big Thunder Mountain v2 — a cluster of terraced red-rock buttes in the
 * Bryce-Canyon hoodoo style: fractal-noise displacement plus stepped
 * terraces, with horizontal strata bands painted as vertex colors
 * (rust / orange / cream). A timber mine headframe and a short trestle
 * sell "the wildest ride in the wilderness".
 *
 * Butte positions/radii must stay in sync with the collider circles in
 * src/world/walkable.ts.
 */

const STRATA: readonly Color[] = [
  new Color(0x9c5636), // dark rust
  new Color(0xb4643c), // rust
  new Color(0xc8825a), // orange
  new Color(0xd9a878), // pale tan
  new Color(0xb4643c), // rust again
  new Color(0xc08050), // sandy orange
];

const BUTTES: readonly (readonly [number, number, number, number])[] = [
  // [dx, dz, radius, height]
  [0, 0, 16, 30],
  [-18, 12, 11, 20],
  [14, -14, 12, 24],
  [18, 10, 8, 14],
  [-12, -18, 8, 16],
];

export function buildBigThunder(scene: Scene, x: number, z: number): void {
  const noise = createNoise2D(266074156);
  const group = new Group();

  const rockMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
  });

  BUTTES.forEach(([dx, dz, radius, height], butteIndex) => {
    const geo = new ConeGeometry(radius, height, 16, 12);
    const pos = geo.getAttribute("position");

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const r = Math.hypot(vx, vz);
      if (r < 0.01) continue;
      const t = (vy + height / 2) / height;
      const theta = Math.atan2(vz, vx);
      const nx = Math.cos(theta) * 1.8 + butteIndex * 13;
      const ny = Math.sin(theta) * 1.8 + butteIndex * 7;

      const crag = noise.fbm(nx + t * 0.8, ny + t * 4.5, 3) * 0.2;
      // Terraces: triangle wave over height creates stepped ledges.
      const bands = 5;
      const tri = Math.abs(((t * bands) % 1) - 0.5) * 2; // 0..1..0 per band
      const terrace = (tri - 0.5) * 0.13;
      const damp = Math.min(1, (1 - t) * 4) * Math.min(1, t * 8 + 0.2);

      const mult = 1 + (crag + terrace) * damp;
      pos.setX(i, vx * mult);
      pos.setZ(i, vz * mult);
    }
    geo.computeVertexNormals();

    // Strata bands as vertex colors, with a wavering band boundary.
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + height / 2) / height;
      const theta = Math.atan2(pos.getZ(i), pos.getX(i));
      const waver = noise.sample(Math.cos(theta) * 3 + 90, Math.sin(theta) * 3 + 90) * 0.06;
      const band = Math.max(
        0,
        Math.min(STRATA.length - 1, Math.floor((t + waver) * STRATA.length)),
      );
      c.copy(STRATA[band] ?? STRATA[1]!);
      // Slight per-face brightness variation.
      const shade = 0.92 + noise.sample(theta * 5 + 120, t * 11) * 0.08;
      colors[i * 3] = c.r * shade;
      colors[i * 3 + 1] = c.g * shade;
      colors[i * 3 + 2] = c.b * shade;
    }
    geo.setAttribute("color", new BufferAttribute(colors, 3));

    const butte = new Mesh(geo, rockMaterial);
    butte.position.set(dx, height / 2, dz);
    butte.castShadow = true;
    butte.receiveShadow = true;
    group.add(butte);
  });

  buildMineProps(group);

  group.position.set(x, 0, z);
  scene.add(group);
}

/** Timber headframe + short trestle — dark mining silhouettes. */
function buildMineProps(group: Group): void {
  const wood = new MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
  const iron = new MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.7 });

  // Headframe beside the main butte (A-frame legs, crossbeam, wheel).
  const frame = new Group();
  for (const side of [-1, 1]) {
    const leg = new Mesh(new BoxGeometry(0.5, 11, 0.5), wood);
    leg.position.set(side * 2.2, 5.5, 0);
    leg.rotation.z = side * -0.18;
    leg.castShadow = true;
    frame.add(leg);
    const backLeg = new Mesh(new BoxGeometry(0.4, 9, 0.4), wood);
    backLeg.position.set(side * 1.6, 4.5, -2.4);
    backLeg.rotation.x = 0.28;
    backLeg.rotation.z = side * -0.14;
    frame.add(backLeg);
  }
  const crossbeam = new Mesh(new BoxGeometry(4.4, 0.5, 0.6), wood);
  crossbeam.position.y = 10.6;
  frame.add(crossbeam);
  const wheel = new Mesh(new TorusGeometry(1.1, 0.14, 6, 14), iron);
  wheel.position.y = 11.6;
  frame.add(wheel);
  frame.position.set(11, 0, 8);
  frame.rotation.y = 0.6;
  group.add(frame);

  // Short trestle bridging toward the south butte.
  const trestle = new Group();
  for (let i = 0; i < 4; i++) {
    const post = new Mesh(new BoxGeometry(0.45, 5.2, 0.45), wood);
    post.position.set(i * 3.2, 2.6, 0);
    post.castShadow = true;
    trestle.add(post);
    const brace = new Mesh(new BoxGeometry(0.3, 4.4, 0.3), wood);
    brace.position.set(i * 3.2 + 1.4, 2.4, 0);
    brace.rotation.z = 0.62;
    trestle.add(brace);
  }
  const deck = new Mesh(new BoxGeometry(11.5, 0.4, 1.6), wood);
  deck.position.set(4.8, 5.3, 0);
  trestle.add(deck);
  const rails = new Mesh(new BoxGeometry(11.5, 0.1, 1.1), iron);
  rails.position.set(4.8, 5.6, 0);
  trestle.add(rails);
  trestle.position.set(2, 0, -12);
  trestle.rotation.y = -0.8;
  group.add(trestle);
}
