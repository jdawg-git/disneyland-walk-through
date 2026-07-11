import {
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { mulberry32 } from "../engine/random";
import { PARK_LAYOUT, pointInPolygon, polygonCentroid, type Pt } from "../data/parkLayout";
import { flatPolygonGeometry } from "./shapeUtil";

/**
 * Tom Sawyer Island — built straight from the Rivers of America water
 * polygon's inner ring (the island IS the hole in the river). Terraced
 * grass landmass, dense pines, scattered rocks, and a log-stockade fort at
 * the north end. Scenery only: the river blocks the walkable grid, so the
 * island is unreachable by design (tested).
 */
export function buildIsland(scene: Scene, seed: number): void {
  const river = PARK_LAYOUT.water.find((w) => w.name === "Rivers of America");
  const ring = river?.inner?.[0];
  if (!ring || ring.length < 8) return;

  const rng = mulberry32(seed + 4242);
  const center = polygonCentroid(ring);

  const grass = new MeshStandardMaterial({ color: 0x5d8a44, roughness: 1 });
  const earth = new MeshStandardMaterial({ color: 0x7a6248, roughness: 1 });

  // Terraced landmass: shore ring at water level, raised heart of the island.
  const shore = new Mesh(flatPolygonGeometry(ring), grass);
  shore.position.y = 0.22; // just above the water plane (0.08)
  shore.receiveShadow = true;
  scene.add(shore);

  const scaleRing = (factor: number): Pt[] =>
    ring.map(([px, pz]) => [
      center[0] + (px - center[0]) * factor,
      center[1] + (pz - center[1]) * factor,
    ]);
  const bluff = new Mesh(flatPolygonGeometry(scaleRing(0.72)), earth);
  bluff.position.y = 1.5;
  scene.add(bluff);
  const bluffSkirt = new Mesh(flatPolygonGeometry(scaleRing(0.76)), earth);
  bluffSkirt.position.y = 0.8;
  scene.add(bluffSkirt);
  const crown = new Mesh(flatPolygonGeometry(scaleRing(0.55)), grass);
  crown.position.y = 2.6;
  scene.add(crown);

  // Dense pines across the island interior.
  const pinePositions: Pt[] = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of ring) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[1]);
    maxZ = Math.max(maxZ, p[1]);
  }
  let attempts = 0;
  while (pinePositions.length < 60 && attempts < 2000) {
    attempts += 1;
    const x = minX + rng() * (maxX - minX);
    const z = minZ + rng() * (maxZ - minZ);
    if (pointInPolygon(x, z, ring)) pinePositions.push([x, z]);
  }
  const trunkMaterial = new MeshStandardMaterial({ color: 0x4f3c2c, roughness: 1 });
  const pineMaterial = new MeshStandardMaterial({ color: 0x38602f, roughness: 1, flatShading: true });
  const trunks = new InstancedMesh(new CylinderGeometry(0.16, 0.24, 1.8, 7), trunkMaterial, pinePositions.length);
  const crowns = new InstancedMesh(new ConeGeometry(1.6, 4.8, 8), pineMaterial, pinePositions.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const pos = new Vector3();
  const scl = new Vector3();
  pinePositions.forEach((p, i) => {
    const s = 0.9 + rng() * 0.8;
    const baseY = 2.4; // roughly the crown terrace
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    pos.set(p[0], baseY + 0.9 * s, p[1]);
    scl.setScalar(s);
    m.compose(pos, q, scl);
    trunks.setMatrixAt(i, m);
    pos.set(p[0], baseY + (1.8 + 2.2) * s, p[1]);
    m.compose(pos, q, scl);
    crowns.setMatrixAt(i, m);
  });
  crowns.castShadow = true;
  scene.add(trunks, crowns);

  // Log-stockade fort at the island's north end.
  const fort = buildFort(rng);
  const northPoint = ring.reduce((best, p) => (p[1] < best[1] ? p : best), ring[0] ?? center);
  fort.position.set(
    center[0] + (northPoint[0] - center[0]) * 0.45,
    2.6,
    center[1] + (northPoint[1] - center[1]) * 0.45,
  );
  scene.add(fort);

  // Scattered shoreline rocks.
  const rockMaterial = new MeshStandardMaterial({ color: 0x8a8578, roughness: 1, flatShading: true });
  const rocks = new InstancedMesh(new ConeGeometry(1, 1, 5, 2), rockMaterial, 14);
  for (let i = 0; i < 14; i++) {
    const p = ring[Math.floor(rng() * ring.length)] ?? center;
    const s = 0.5 + rng() * 1.1;
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    pos.set(
      center[0] + (p[0] - center[0]) * 0.94,
      0.3 + s * 0.3,
      center[1] + (p[1] - center[1]) * 0.94,
    );
    scl.set(s, s * 0.7, s);
    m.compose(pos, q, scl);
    rocks.setMatrixAt(i, m);
  }
  scene.add(rocks);
}

/** Square log stockade with corner posts and two blockhouses. */
function buildFort(rng: () => number): Mesh {
  const logMaterial = new MeshStandardMaterial({ color: 0x5c4630, roughness: 1 });
  const SIZE = 11;
  const POSTS_PER_SIDE = 10;
  const count = POSTS_PER_SIDE * 4 + 2;
  const fort = new InstancedMesh(new CylinderGeometry(0.32, 0.36, 3.4, 6), logMaterial, count);
  const m = new Matrix4();
  const pos = new Vector3();
  const q = new Quaternion();
  const scl = new Vector3(1, 1, 1);
  let idx = 0;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < POSTS_PER_SIDE; i++) {
      const t = (i / (POSTS_PER_SIDE - 1) - 0.5) * SIZE;
      const jitterY = rng() * 0.3;
      if (side === 0) pos.set(t, 1.7 + jitterY, -SIZE / 2);
      else if (side === 1) pos.set(t, 1.7 + jitterY, SIZE / 2);
      else if (side === 2) pos.set(-SIZE / 2, 1.7 + jitterY, t);
      else pos.set(SIZE / 2, 1.7 + jitterY, t);
      m.compose(pos, q, scl);
      fort.setMatrixAt(idx++, m);
    }
  }
  // Two chunky blockhouse "towers" (scaled posts) at opposite corners.
  for (const [cx, cz] of [
    [-SIZE / 2, -SIZE / 2],
    [SIZE / 2, SIZE / 2],
  ] as const) {
    pos.set(cx, 2.3, cz);
    scl.set(3.2, 1.5, 3.2);
    m.compose(pos, q, scl);
    fort.setMatrixAt(idx++, m);
    scl.set(1, 1, 1);
  }
  fort.castShadow = true;
  return fort;
}
