import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  TorusGeometry,
  Vector3,
} from "three";
import { createNoise2D } from "../../engine/noise";
import { registerEmissive } from "../../engine/emissive";
import { mulberry32 } from "../../engine/random";

/**
 * Tiana's Bayou Adventure (the rethemed Splash Mountain), matched to the
 * reference photo: a LUSH GREEN moss-and-foliage mountain draped in bushes,
 * the log-flume drop into a splash pool, a weathered mill house with a
 * turning water wheel at the base, and the landmark "TIANA'S" water tower
 * — dark tank on trestle legs crowned with a lily-pad tiara.
 *
 * The group is rotated +90° so the drop faces EAST toward the Rivers of
 * America promenade (guests view it across the water, as in the photo).
 * Purely additive (no OSM footprint rendered — the real footprint id is
 * skipped via LANDMARKS.osmIds). Collider circles in walkable.ts must
 * match BUTTES below under the group rotation: local (dx,dz) → world
 * (x + dz, z − dx).
 */

const STRATA: readonly Color[] = [
  new Color(0x6b5138), // bayou earth at the waterline
  new Color(0x5d7042), // moss creeping up
  new Color(0x4f7a40), // brush green
  new Color(0x3f7038), // lush canopy
  new Color(0x356433), // deep bayou green
];

const BUTTES: readonly (readonly [number, number, number, number])[] = [
  // [dx, dz, radius, height] — keep in sync with walkable.ts colliders.
  [0, 0, 14, 26],
  [-11, 8, 9, 16],
  [10, -7, 9, 18],
  [9, 9, 7, 12],
];

export function buildTianasBayou(scene: Scene, x: number, z: number): void {
  const noise = createNoise2D(777001);
  const rng = mulberry32(0x71a7a5);
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

  // Foliage: chunky moss bushes scattered over the slopes (instanced).
  const BUSHES = 46;
  const bushes = new InstancedMesh(
    new DodecahedronGeometry(1, 0),
    new MeshStandardMaterial({ color: 0x3f8a3f, roughness: 1, flatShading: true }),
    BUSHES,
  );
  {
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const p = new Vector3();
    const s = new Vector3();
    for (let i = 0; i < BUSHES; i++) {
      const [bdx, bdz, radius, height] = BUTTES[Math.floor(rng() * BUTTES.length)] ?? BUTTES[0]!;
      const t = 0.25 + rng() * 0.6; // band on the slope
      const theta = rng() * Math.PI * 2;
      const r = radius * (1 - t) * 0.95;
      p.set(bdx + Math.cos(theta) * r, height * t, bdz + Math.sin(theta) * r);
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      const sc = 0.9 + rng() * 1.6;
      s.set(sc, sc * 0.8, sc);
      m.compose(p, q, s);
      bushes.setMatrixAt(i, m);
    }
    bushes.instanceMatrix.needsUpdate = true;
    bushes.castShadow = true;
    g.add(bushes);
  }

  const timber = new MeshStandardMaterial({ color: 0x6e5238, roughness: 0.95, flatShading: true });
  const timberDark = new MeshStandardMaterial({ color: 0x4c3a28, roughness: 0.95 });

  // The flume drop: a wood chute hugging the face, into a pool.
  const chuteGroup = new Group();
  const chute = new Mesh(new BoxGeometry(2.6, 0.5, 14), timber);
  chute.castShadow = true;
  chuteGroup.add(chute);
  for (const side of [-1, 1]) {
    const chuteRail = new Mesh(new BoxGeometry(0.35, 0.9, 14), timber);
    chuteRail.position.set(side * 1.3, 0.35, 0);
    chuteGroup.add(chuteRail);
  }
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

  // --- Weathered mill house with water wheel, beside the drop ---
  const mill = new Group();
  const millBody = new Mesh(new BoxGeometry(6, 4.4, 5), timber);
  millBody.position.y = 2.2;
  millBody.castShadow = true;
  mill.add(millBody);
  const millRoofGeo = new ConeGeometry(Math.SQRT2 * 0.5, 1, 4);
  millRoofGeo.rotateY(Math.PI / 4);
  const millRoof = new Mesh(millRoofGeo, timberDark);
  millRoof.scale.set(7, 2.2, 6);
  millRoof.position.y = 5.5;
  millRoof.castShadow = true;
  mill.add(millRoof);
  // Water wheel (turns slowly — bayou ambiance).
  const wheel = new Mesh(new TorusGeometry(1.9, 0.32, 6, 12), timberDark);
  wheel.position.set(3.6, 1.9, 0);
  wheel.rotation.y = Math.PI / 2;
  wheel.castShadow = true;
  mill.add(wheel);
  const hubPin = new Mesh(new CylinderGeometry(0.18, 0.18, 1.0, 8), timberDark);
  hubPin.position.set(3.6, 1.9, 0);
  hubPin.rotation.z = Math.PI / 2;
  mill.add(hubPin);
  mill.position.set(-8.5, 0, 14);
  mill.rotation.y = 0.35;
  g.add(mill);

  // --- The "TIANA'S" water tower (photo: dark tank, trestle legs, tiara) ---
  const tower = new Group();
  const legMat = timberDark;
  for (const [lx, lz] of [
    [-1.6, -1.6],
    [1.6, -1.6],
    [-1.6, 1.6],
    [1.6, 1.6],
  ] as const) {
    const leg = new Mesh(new CylinderGeometry(0.16, 0.22, 9, 6), legMat);
    leg.position.set(lx * 0.8, 4.5, lz * 0.8);
    leg.rotation.z = -lx * 0.06;
    leg.rotation.x = lz * 0.06;
    leg.castShadow = true;
    tower.add(leg);
  }
  const tank = new Mesh(new CylinderGeometry(3.2, 3.2, 5.2, 14), new MeshStandardMaterial({ color: 0x3d3730, roughness: 0.85 }));
  tank.position.y = 11.4;
  tank.castShadow = true;
  tower.add(tank);
  const tankLid = new Mesh(new ConeGeometry(3.4, 1.4, 14), timberDark);
  tankLid.position.y = 14.7;
  tower.add(tankLid);
  // Sign band: warm cream band reading as the "TIANA'S FOODS" marquee.
  const signMat = new MeshStandardMaterial({
    color: 0xe8d8a8,
    emissive: new Color(0xffd890),
    emissiveIntensity: 0,
    roughness: 0.5,
  });
  registerEmissive(signMat, 1.4);
  const band = new Mesh(new CylinderGeometry(3.28, 3.28, 1.6, 14), signMat);
  band.position.y = 11.6;
  tower.add(band);
  // Lily-pad tiara crown: a ring of gold points.
  const crownMat = new MeshStandardMaterial({ color: 0xd8a838, roughness: 0.4, metalness: 0.5 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const spike = new Mesh(new ConeGeometry(0.34, 1.5, 5), crownMat);
    spike.position.set(Math.cos(a) * 2.2, 16.1, Math.sin(a) * 2.2);
    tower.add(spike);
  }
  tower.position.set(12, 0, 14);
  g.add(tower);

  // Face the drop EAST toward the river promenade.
  g.rotation.y = Math.PI / 2;
  g.position.set(x, 0, z);
  scene.add(g);
}
