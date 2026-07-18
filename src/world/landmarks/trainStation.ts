import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from "three";
import { registerEmissive } from "../../engine/emissive";

/**
 * Main Street Station — Victorian depot on the berm at the park entrance.
 * Red brick base, cream upper story, dark hipped roofs, central clock
 * tower. Faces north (−Z, toward Town Square).
 */

/** 4-sided pyramid aligned to world axes (rotation baked, safe to scale). */
function hipRoofGeometry(halfWidth: number, height: number): ConeGeometry {
  const geo = new ConeGeometry(halfWidth * Math.SQRT2, height, 4);
  geo.rotateY(Math.PI / 4);
  return geo;
}

export function buildTrainStation(scene: Scene, x: number, z: number): void {
  const station = new Group();

  const brick = new MeshStandardMaterial({ color: 0xa8524a, roughness: 0.95 });
  const creamWall = new MeshStandardMaterial({ color: 0xf0e2cc, roughness: 0.9 });
  const roof = new MeshStandardMaterial({ color: 0x555061, roughness: 0.7 });
  const berm = new MeshStandardMaterial({ color: 0x71975a, roughness: 1 });

  const glow = new MeshStandardMaterial({
    color: 0x5a6a78,
    emissive: new Color(0xffcf80),
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  registerEmissive(glow, 2.6);

  const BASE = 2.4; // mound top — station floor level

  // Grass mound with SLOPED faces (a box read as a sheer "green wall" in
  // playtests) — top face pinched so all four sides bank like real earth.
  const moundGeo = new BoxGeometry(48, BASE, 16);
  const mp = moundGeo.getAttribute("position");
  for (let i = 0; i < mp.count; i++) {
    if (mp.getY(i) > 0) {
      mp.setX(i, mp.getX(i) * (44 / 48));
      mp.setZ(i, mp.getZ(i) * (9 / 16));
    }
  }
  moundGeo.computeVertexNormals();
  const mound = new Mesh(moundGeo, berm);
  mound.position.y = BASE / 2;
  mound.receiveShadow = true;
  station.add(mound);

  // Mickey floral — the first thing arriving guests see, as in Anaheim: a
  // flower bed with Mickey's face in dark plants on the slope beneath the
  // station. That slope is the DLRR berm railroad.ts runs along z≈308.3
  // (keep the profile numbers in sync with its BERM_* constants: height
  // 2.6, base half-width 3.5, crest half-width 1.3).
  station.add(buildMickeyFloral());

  // Main hall (brick) + cream upper story.
  const hall = new Mesh(new BoxGeometry(24, 6, 9), brick);
  hall.position.y = BASE + 3;
  hall.castShadow = true;
  station.add(hall);

  const upper = new Mesh(new BoxGeometry(19, 3, 7), creamWall);
  upper.position.y = BASE + 6 + 1.5;
  upper.castShadow = true;
  station.add(upper);

  const mainRoof = new Mesh(hipRoofGeometry(1, 3.2), roof);
  mainRoof.scale.set(10.5, 1, 4);
  mainRoof.position.y = BASE + 9 + 1.6;
  mainRoof.castShadow = true;
  station.add(mainRoof);

  // Clock tower.
  const towerShaft = new Mesh(new BoxGeometry(3.6, 7, 3.6), creamWall);
  towerShaft.position.y = BASE + 9 + 3.5;
  towerShaft.castShadow = true;
  station.add(towerShaft);

  const clock = new Mesh(new CylinderGeometry(1.0, 1.0, 0.2, 16), glow);
  clock.rotation.x = Math.PI / 2;
  clock.position.set(0, BASE + 9 + 4.8, -1.85);
  station.add(clock);

  const towerRoof = new Mesh(hipRoofGeometry(1, 3.0), roof);
  towerRoof.scale.set(2.4, 1, 2.4);
  towerRoof.position.y = BASE + 9 + 7 + 1.5;
  towerRoof.castShadow = true;
  station.add(towerRoof);

  // Side wings.
  for (const side of [-1, 1]) {
    const wing = new Mesh(new BoxGeometry(9, 4.5, 8), brick);
    wing.position.set(side * 16, BASE + 2.25, 0);
    wing.castShadow = true;
    station.add(wing);
    const wingRoof = new Mesh(hipRoofGeometry(1, 2.4), roof);
    wingRoof.scale.set(5.2, 1, 4.6);
    wingRoof.position.set(side * 16, BASE + 4.5 + 1.2, 0);
    wingRoof.castShadow = true;
    station.add(wingRoof);
  }

  // Victorian gingerbread: white trim strips under every eave line.
  const trim = new MeshStandardMaterial({ color: 0xfaf6ec, roughness: 0.8 });
  for (const [w, y, d] of [
    [24.4, BASE + 6, 9.4],
    [19.4, BASE + 9, 7.4],
    [4.0, BASE + 16, 4.0],
  ] as const) {
    const band = new Mesh(new BoxGeometry(w, 0.35, d), trim);
    band.position.y = y;
    station.add(band);
  }
  for (const side of [-1, 1]) {
    const wingBand = new Mesh(new BoxGeometry(9.4, 0.3, 8.4), trim);
    wingBand.position.set(side * 16, BASE + 4.5, 0);
    station.add(wingBand);
  }

  // Platform canopy toward the square + lit windows along the front.
  const canopy = new Mesh(new BoxGeometry(26, 0.3, 3), roof);
  canopy.position.set(0, BASE + 3.6, -6);
  station.add(canopy);
  for (let i = -2; i <= 2; i++) {
    const win = new Mesh(new BoxGeometry(1.1, 1.7, 0.1), glow);
    win.position.set(i * 4.2, BASE + 2.6, -4.56);
    station.add(win);
  }

  station.position.set(x, 0, z);
  scene.add(station);
}

/**
 * The entrance Mickey floral: a flower-dotted bed with Mickey's face
 * (head + ears) in dark foliage, laid flush on the south bank of the DLRR
 * berm in front of the station (station-local coords; station at
 * world (2.6, 300.2), berm centerline z≈308.3).
 */
function buildMickeyFloral(): Group {
  const g = new Group();
  // Berm bank: rises from base half-width 3.5 to crest half-width 1.3
  // over height 2.6 → slope run 2.2.
  const slope = Math.atan2(2.2, 2.6);

  const bed = new Mesh(
    new CircleGeometry(3.0, 24),
    new MeshStandardMaterial({ color: 0xd94f6a, roughness: 1 }),
  );
  g.add(bed);

  const foliage = new MeshStandardMaterial({ color: 0x2e4a2a, roughness: 1 });
  const head = new Mesh(new CircleGeometry(1.15, 20), foliage);
  head.position.set(0, -0.25, 0.02);
  g.add(head);
  for (const side of [-1, 1]) {
    const ear = new Mesh(new CircleGeometry(0.58, 16), foliage);
    ear.position.set(side * 0.95, 0.85, 0.02);
    g.add(ear);
  }

  // Flower speckles around the face — instanced, per-instance pastel color.
  const COUNT = 70;
  const flowers = new InstancedMesh(
    new DodecahedronGeometry(0.13),
    new MeshStandardMaterial({ roughness: 0.9 }),
    COUNT,
  );
  const petal = [0xfff2f6, 0xffd94f, 0xff8fb3, 0xf6f0ff];
  const m = new Matrix4();
  const c = new Color();
  let placed = 0;
  let seed = 7;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  while (placed < COUNT) {
    const r = Math.sqrt(rand()) * 2.85;
    const t = rand() * Math.PI * 2;
    const fx = Math.cos(t) * r;
    const fy = Math.sin(t) * r;
    // Keep the face silhouette clean.
    if (Math.hypot(fx, fy + 0.25) < 1.3) continue;
    if (Math.hypot(Math.abs(fx) - 0.95, fy - 0.85) < 0.72) continue;
    m.makeTranslation(fx, fy, 0.06);
    flowers.setMatrixAt(placed, m);
    flowers.setColorAt(placed, c.setHex(petal[placed % petal.length] ?? 0xffffff));
    placed += 1;
  }
  flowers.instanceMatrix.needsUpdate = true;
  g.add(flowers);

  g.rotation.x = -slope; // lay the bed flush on the berm's south bank
  // Station-local: berm face midpoint is world (2, 1.3, 310.7) →
  // local (−0.6, 1.3, 10.5); nudged along the outward normal.
  g.position.set(-0.6, 1.42, 10.62);
  return g;
}
