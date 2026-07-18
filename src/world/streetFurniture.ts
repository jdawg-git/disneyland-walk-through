import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { registerEmissive } from "../engine/emissive";
import { mulberry32 } from "../engine/random";
import { landAt } from "../config/lands";
import { PARK_LAYOUT, type Pt } from "../data/parkLayout";

/**
 * Street furniture v2, placed from the real OSM amenity nodes: benches,
 * drinking fountains and decorative fountains where they actually are in
 * the park, plus themed trash cans beside benches, hand-placed popcorn
 * carts, balloon vendors, and the Partners statue at the hub. Everything
 * is instanced — the whole layer costs ~20 draw calls.
 */
export function buildStreetFurniture(scene: Scene, seed: number): void {
  const rng = mulberry32(seed ^ 0x5f375a86);

  const benches: Pt[] = [];
  const drinking: Pt[] = [];
  const fountains: Pt[] = [];
  for (const a of PARK_LAYOUT.amenities) {
    // OSM puts one bench INSIDE the castle walk-through corridor
    // (x 3.2..8.4) — mid-path furniture reads as an obstacle, skip it.
    if (a.at[0] > 2.5 && a.at[0] < 9 && a.at[1] > -23 && a.at[1] < 2) continue;
    if (a.kind === "bench") benches.push(a.at);
    else if (a.kind === "drinking_water") drinking.push(a.at);
    else if (a.kind === "fountain") fountains.push(a.at);
  }

  buildBenches(scene, benches, rng);
  buildTrashCans(scene, benches, rng);
  buildDrinkingFountains(scene, drinking);
  buildFountains(scene, fountains);
  buildPopcornCarts(scene);
  buildBalloonVendors(scene, rng);
  buildPartnersStatue(scene);
}

function placeAll(
  mesh: InstancedMesh,
  spots: readonly { x: number; z: number; yaw: number }[],
  y: number,
): void {
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const pos = new Vector3();
  const one = new Vector3(1, 1, 1);
  spots.forEach((s, i) => {
    q.setFromAxisAngle(up, s.yaw);
    pos.set(s.x, y, s.z);
    m.compose(pos, q, one);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function buildBenches(scene: Scene, benches: readonly Pt[], rng: () => number): void {
  if (benches.length === 0) return;
  const spots = benches.map((p) => ({ x: p[0], z: p[1], yaw: rng() * Math.PI * 2 }));
  const wood = new MeshStandardMaterial({ color: 0x6e4f34, roughness: 0.9 });
  const iron = new MeshStandardMaterial({ color: 0x2c3037, roughness: 0.6 });

  const seat = new InstancedMesh(new BoxGeometry(1.7, 0.07, 0.55), wood, spots.length);
  placeAll(seat, spots, 0.46);
  const backGeo = new BoxGeometry(1.7, 0.5, 0.06);
  backGeo.translate(0, 0, -0.28); // sits behind the seat
  const back = new InstancedMesh(backGeo, wood, spots.length);
  placeAll(back, spots, 0.75);
  const legsGeo = new BoxGeometry(1.5, 0.42, 0.45);
  const legs = new InstancedMesh(legsGeo, iron, spots.length);
  placeAll(legs, spots, 0.21);
  seat.castShadow = true;
  scene.add(seat, back, legs);
}

/** A themed trash can beside every other bench (lid tinted per land). */
function buildTrashCans(scene: Scene, benches: readonly Pt[], rng: () => number): void {
  const spots: { x: number; z: number; yaw: number; lid: number }[] = [];
  benches.forEach((p, i) => {
    if (i % 2 !== 0) return;
    const a = rng() * Math.PI * 2;
    const x = p[0] + Math.cos(a) * 1.4;
    const z = p[1] + Math.sin(a) * 1.4;
    const land = landAt(x, z);
    spots.push({ x, z, yaw: 0, lid: land?.palette.roofs[0] ?? 0x4a4440 });
  });
  if (spots.length === 0) return;

  const body = new InstancedMesh(
    new CylinderGeometry(0.32, 0.28, 0.85, 10),
    new MeshStandardMaterial({ color: 0x33512e, roughness: 0.8 }),
    spots.length,
  );
  placeAll(body, spots, 0.43);
  const lid = new InstancedMesh(
    new CylinderGeometry(0.34, 0.34, 0.16, 10),
    new MeshStandardMaterial({ roughness: 0.7 }),
    spots.length,
  );
  placeAll(lid, spots, 0.92);
  const c = new Color();
  spots.forEach((s, i) => lid.setColorAt(i, c.setHex(s.lid)));
  if (lid.instanceColor) lid.instanceColor.needsUpdate = true;
  body.castShadow = true;
  scene.add(body, lid);
}

function buildDrinkingFountains(scene: Scene, drinking: readonly Pt[]): void {
  if (drinking.length === 0) return;
  const spots = drinking.map((p) => ({ x: p[0], z: p[1], yaw: 0 }));
  const stone = new MeshStandardMaterial({ color: 0x9a948a, roughness: 0.9 });
  const pedestal = new InstancedMesh(new CylinderGeometry(0.16, 0.2, 0.85, 8), stone, spots.length);
  placeAll(pedestal, spots, 0.43);
  const bowl = new InstancedMesh(new CylinderGeometry(0.24, 0.16, 0.12, 8), stone, spots.length);
  placeAll(bowl, spots, 0.9);
  scene.add(pedestal, bowl);
}

/** Decorative fountains: stone basin, water disc, center jet. */
function buildFountains(scene: Scene, fountains: readonly Pt[]): void {
  if (fountains.length === 0) return;
  const spots = fountains.map((p) => ({ x: p[0], z: p[1], yaw: 0 }));
  const stone = new MeshStandardMaterial({ color: 0xa8a29a, roughness: 0.85 });
  const waterMaterial = new MeshStandardMaterial({
    color: 0x4a7cb0,
    roughness: 0.2,
    emissive: new Color(0x1a3050),
    emissiveIntensity: 0,
  });
  registerEmissive(waterMaterial, 0.6);

  const rim = new InstancedMesh(new TorusGeometry(1.15, 0.16, 6, 14), stone, spots.length);
  const m = new Matrix4();
  spots.forEach((s, i) => {
    m.makeRotationX(-Math.PI / 2);
    m.setPosition(s.x, 0.3, s.z);
    rim.setMatrixAt(i, m);
  });
  rim.instanceMatrix.needsUpdate = true;
  const water = new InstancedMesh(new CylinderGeometry(1.1, 1.1, 0.08, 14), waterMaterial, spots.length);
  placeAll(water, spots, 0.3);
  const jet = new InstancedMesh(new ConeGeometry(0.12, 0.9, 6), waterMaterial, spots.length);
  placeAll(jet, spots, 0.8);
  scene.add(rim, water, jet);
}

/** Hand-placed popcorn carts — red-striped canopy, glass box, spoke wheels. */
const CART_SPOTS: readonly { x: number; z: number; yaw: number }[] = [
  { x: -10, z: 262, yaw: 1.2 }, // Town Square
  { x: 12, z: 160, yaw: -0.4 }, // Main Street mid-block
  { x: -24, z: 62, yaw: 2.1 }, // hub west
  { x: 34, z: 44, yaw: -1.7 }, // hub east
  { x: -120, z: 108, yaw: 0.6 }, // Adventureland gate
  { x: -12, z: -60, yaw: 0.2 }, // Fantasyland courtyard
  { x: 96, z: 60, yaw: -2.4 }, // Tomorrowland entry
  { x: 20, z: -252, yaw: 0.9 }, // Toontown
];

function buildPopcornCarts(scene: Scene): void {
  const spots = CART_SPOTS;
  const red = new MeshStandardMaterial({ color: 0xb02c28, roughness: 0.75 });
  const cream = new MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.75 });
  const glassMaterial = new MeshStandardMaterial({
    color: 0xcfe0e8,
    roughness: 0.15,
    metalness: 0.2,
    emissive: new Color(0xffdf94),
    emissiveIntensity: 0,
  });
  registerEmissive(glassMaterial, 1.6);
  const iron = new MeshStandardMaterial({ color: 0x2c3037, roughness: 0.6 });

  const base = new InstancedMesh(new BoxGeometry(1.6, 0.75, 0.95), red, spots.length);
  placeAll(base, spots, 0.65);
  const box = new InstancedMesh(new BoxGeometry(1.45, 0.75, 0.8), glassMaterial, spots.length);
  placeAll(box, spots, 1.4);
  const canopy = new InstancedMesh(new ConeGeometry(1.25, 0.55, 8), red, spots.length);
  placeAll(canopy, spots, 2.25);
  const trim = new InstancedMesh(new BoxGeometry(1.7, 0.12, 1.05), cream, spots.length);
  placeAll(trim, spots, 1.06);
  const wheelGeo = new CylinderGeometry(0.42, 0.42, 0.08, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = new InstancedMesh(wheelGeo, iron, spots.length * 2);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const pos = new Vector3();
  const one = new Vector3(1, 1, 1);
  spots.forEach((s, i) => {
    q.setFromAxisAngle(up, s.yaw);
    const ox = Math.cos(s.yaw) * 0.55;
    const oz = -Math.sin(s.yaw) * 0.55;
    pos.set(s.x + ox, 0.42, s.z + oz);
    m.compose(pos, q, one);
    wheels.setMatrixAt(i * 2, m);
    pos.set(s.x - ox, 0.42, s.z - oz);
    m.compose(pos, q, one);
    wheels.setMatrixAt(i * 2 + 1, m);
  });
  wheels.instanceMatrix.needsUpdate = true;
  base.castShadow = true;
  scene.add(base, box, canopy, trim, wheels);
}

/** Balloon vendors: a bright cluster bobbing over a small cart. */
const VENDOR_SPOTS: readonly Pt[] = [
  [8, 278], // Town Square
  [-38, 40], // hub, castle view
  [40, -78], // Fantasyland
  [108, -232], // small world mall
  [-4, -262], // Toontown
];

const BALLOON_COLORS = [0xd02830, 0x2858c0, 0xe8a018, 0x38a048, 0x8838b0, 0xe05890] as const;

function buildBalloonVendors(scene: Scene, rng: () => number): void {
  const cartSpots = VENDOR_SPOTS.map((p) => ({ x: p[0], z: p[1], yaw: rng() * Math.PI * 2 }));
  const cart = new InstancedMesh(
    new BoxGeometry(0.8, 1.0, 0.6),
    new MeshStandardMaterial({ color: 0x4a4440, roughness: 0.8 }),
    cartSpots.length,
  );
  placeAll(cart, cartSpots, 0.5);

  interface Balloon {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly color: number;
    readonly ears: boolean;
  }
  const balloons: Balloon[] = [];
  for (const s of cartSpots) {
    const count = 8 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = 0.35 + rng() * 0.85;
      balloons.push({
        x: s.x + Math.cos(a) * r,
        y: 2.6 + rng() * 1.3,
        z: s.z + Math.sin(a) * r,
        color: BALLOON_COLORS[Math.floor(rng() * BALLOON_COLORS.length)] ?? 0xd02830,
        ears: rng() < 0.3,
      });
    }
  }
  const balloonMaterial = new MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 });
  const orbs = new InstancedMesh(new SphereGeometry(0.32, 10, 8), balloonMaterial, balloons.length);
  const earGeo = new SphereGeometry(0.13, 6, 5);
  const earList = balloons.filter((b) => b.ears);
  const ears = earList.length > 0 ? new InstancedMesh(earGeo, balloonMaterial, earList.length * 2) : null;
  const m = new Matrix4();
  const c = new Color();
  balloons.forEach((b, i) => {
    m.makeTranslation(b.x, b.y, b.z);
    orbs.setMatrixAt(i, m);
    orbs.setColorAt(i, c.setHex(b.color));
  });
  if (ears) {
    earList.forEach((b, i) => {
      m.makeTranslation(b.x - 0.2, b.y + 0.28, b.z);
      ears.setMatrixAt(i * 2, m);
      ears.setColorAt(i * 2, c.setHex(b.color));
      m.makeTranslation(b.x + 0.2, b.y + 0.28, b.z);
      ears.setMatrixAt(i * 2 + 1, m);
      ears.setColorAt(i * 2 + 1, c.setHex(b.color));
    });
    ears.instanceMatrix.needsUpdate = true;
    if (ears.instanceColor) ears.instanceColor.needsUpdate = true;
    scene.add(ears);
  }
  orbs.instanceMatrix.needsUpdate = true;
  if (orbs.instanceColor) orbs.instanceColor.needsUpdate = true;
  scene.add(cart, orbs);
}

/**
 * Partners statue silhouette at the hub center: bronze Walt (hand raised
 * toward the castle) and Mickey beside him on a round stone pedestal.
 */
function buildPartnersStatue(scene: Scene): void {
  const AT: Pt = [1, 55];
  const bronze = new MeshStandardMaterial({ color: 0x4a3a26, roughness: 0.5, metalness: 0.55 });
  const stone = new MeshStandardMaterial({ color: 0x9a948a, roughness: 0.9 });

  const add = (mesh: Mesh, x: number, y: number, z: number): void => {
    mesh.position.set(AT[0] + x, y, AT[1] + z);
    mesh.castShadow = true;
    scene.add(mesh);
  };

  add(new Mesh(new CylinderGeometry(1.6, 1.8, 0.5, 14), stone), 0, 0.25, 0);
  add(new Mesh(new CylinderGeometry(0.9, 1.0, 0.9, 12), stone), 0, 0.9, 0);

  // Walt: body, head, raised arm pointing down Main Street (toward +z).
  const body = new Mesh(new CylinderGeometry(0.22, 0.3, 1.5, 8), bronze);
  add(body, -0.3, 2.1, 0);
  add(new Mesh(new SphereGeometry(0.19, 8, 7), bronze), -0.3, 3.0, 0);
  const arm = new Mesh(new CylinderGeometry(0.07, 0.07, 0.85, 6), bronze);
  arm.rotation.x = 1.15; // raised, gesturing down Main Street
  add(arm, -0.12, 2.75, 0.3);

  // Mickey: small round body, head, ears.
  add(new Mesh(new CylinderGeometry(0.15, 0.19, 0.8, 8), bronze), 0.45, 1.75, 0.05);
  add(new Mesh(new SphereGeometry(0.16, 8, 7), bronze), 0.45, 2.3, 0.05);
  add(new Mesh(new SphereGeometry(0.09, 6, 5), bronze), 0.31, 2.46, 0.05);
  add(new Mesh(new SphereGeometry(0.09, 6, 5), bronze), 0.59, 2.46, 0.05);
}
