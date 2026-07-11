import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
} from "three";
import { registerEmissive } from "../engine/emissive";
import { registerUpdatable } from "../engine/updatables";
import { PARK_LAYOUT } from "../data/parkLayout";
import { stitchNarrowGaugeRing } from "../data/railLoop";

const BERM_TOP = 2.75; // rail height above the berm blocks
const TRAIN_SPEED = 5.5; // m/s
const CAR_SPACING = 5.2; // m between car centers along the track

/**
 * The DLRR loop at berm height. Ring stitching lives in
 * src/data/railLoop.ts (shared with the guest-map filter script); the
 * closed CatmullRom curve bridges the remaining station gap.
 */
export function stitchRailLoop(): { points: Vector3[]; closureGap: number } {
  const { points, closureGap } = stitchNarrowGaugeRing(PARK_LAYOUT.railroad);
  return {
    points: points.map(([px, pz]) => new Vector3(px, BERM_TOP, pz)),
    closureGap,
  };
}

/**
 * The Disneyland Railroad — a steam engine + tender + three open excursion
 * cars circling the berm, with smoke puffing from the stack. Ambiance only
 * (no collision — it rides atop the berm, which already blocks).
 */
export function buildTrain(scene: Scene): void {
  const { points } = stitchRailLoop();
  if (points.length < 10) return;
  const curve = new CatmullRomCurve3(points, true, "catmullrom", 0.1);
  const loopLength = curve.getLength();

  const red = new MeshStandardMaterial({ color: 0x8a2c22, roughness: 0.6 });
  const dark = new MeshStandardMaterial({ color: 0x22201e, roughness: 0.7 });
  const brass = new MeshStandardMaterial({ color: 0xb08a30, roughness: 0.35, metalness: 0.5 });
  const cream = new MeshStandardMaterial({ color: 0xe8ddc0, roughness: 0.8 });
  const canopy = new MeshStandardMaterial({ color: 0x6a3c2a, roughness: 0.8 });

  const headlampMaterial = new MeshStandardMaterial({
    color: 0x3a3420,
    emissive: new Color(0xffe0a0),
    emissiveIntensity: 0.4,
    roughness: 0.4,
  });
  registerEmissive(headlampMaterial, 2.6, 0.4);

  // --- Engine (built facing +Z = direction of travel) ---
  const engine = new Group();
  const boiler = new Mesh(new CylinderGeometry(0.75, 0.75, 3.0, 12), dark);
  boiler.rotation.x = Math.PI / 2;
  boiler.position.set(0, 1.15, 0.4);
  engine.add(boiler);
  const stack = new Mesh(new ConeGeometry(0.42, 0.9, 10), dark);
  stack.position.set(0, 2.15, 1.5);
  engine.add(stack);
  const steamDome = new Mesh(new CylinderGeometry(0.3, 0.3, 0.45, 8), brass);
  steamDome.position.set(0, 1.95, 0.5);
  engine.add(steamDome);
  const cab = new Mesh(new BoxGeometry(1.7, 1.7, 1.5), red);
  cab.position.set(0, 1.55, -1.4);
  engine.add(cab);
  const cabRoof = new Mesh(new BoxGeometry(2.0, 0.18, 1.9), dark);
  cabRoof.position.set(0, 2.5, -1.4);
  engine.add(cabRoof);
  const cowcatcher = new Mesh(new ConeGeometry(0.75, 1.0, 4), red);
  cowcatcher.rotation.x = -Math.PI / 2;
  cowcatcher.rotation.z = Math.PI / 4;
  cowcatcher.position.set(0, 0.55, 2.2);
  engine.add(cowcatcher);
  const headlamp = new Mesh(new BoxGeometry(0.4, 0.4, 0.3), headlampMaterial);
  headlamp.position.set(0, 1.75, 2.0);
  engine.add(headlamp);
  const chassis = new Mesh(new BoxGeometry(1.6, 0.5, 4.4), dark);
  chassis.position.set(0, 0.55, 0);
  engine.add(chassis);
  scene.add(engine);

  // --- Tender + three open excursion cars ---
  const cars: Group[] = [];
  for (let i = 0; i < 4; i++) {
    const car = new Group();
    const isTender = i === 0;
    const body = new Mesh(new BoxGeometry(1.7, isTender ? 1.1 : 0.9, 3.6), red);
    body.position.y = isTender ? 0.85 : 0.75;
    car.add(body);
    if (!isTender) {
      // Bench rows + canopy on posts.
      for (const pz of [-1.2, 0, 1.2]) {
        const bench = new Mesh(new BoxGeometry(1.5, 0.45, 0.5), cream);
        bench.position.set(0, 1.35, pz);
        car.add(bench);
      }
      for (const [px, pz] of [
        [-0.75, -1.6],
        [0.75, -1.6],
        [-0.75, 1.6],
        [0.75, 1.6],
      ] as const) {
        const post = new Mesh(new CylinderGeometry(0.05, 0.05, 1.5, 6), dark);
        post.position.set(px, 1.95, pz);
        car.add(post);
      }
      const top = new Mesh(new BoxGeometry(1.9, 0.12, 3.9), canopy);
      top.position.y = 2.75;
      car.add(top);
    }
    scene.add(car);
    cars.push(car);
  }

  // --- Smoke: cycling particle puffs above the stack ---
  const PUFFS = 22;
  const smokePositions = new Float32Array(PUFFS * 3);
  const smokeAges = new Float32Array(PUFFS);
  for (let i = 0; i < PUFFS; i++) smokeAges[i] = (i / PUFFS) * 2.4;
  const smokeGeometry = new BufferGeometry();
  smokeGeometry.setAttribute("position", new BufferAttribute(smokePositions, 3));
  const smoke = new Points(
    smokeGeometry,
    new PointsMaterial({
      color: 0xd8d8d8,
      size: 1.1,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(smoke);

  // --- Path following ---
  let distance = 0;
  const stackWorld = new Vector3();
  const ahead = new Vector3();
  registerUpdatable((dt) => {
    distance = (distance + TRAIN_SPEED * dt) % loopLength;

    const place = (group: Group, offset: number): void => {
      const u = (((distance - offset) % loopLength) + loopLength) % loopLength / loopLength;
      const uAhead = (u + 2 / loopLength) % 1;
      curve.getPointAt(u, group.position);
      curve.getPointAt(uAhead, ahead);
      group.lookAt(ahead);
    };
    place(engine, 0);
    cars.forEach((car, i) => place(car, (i + 1) * CAR_SPACING));

    // Smoke puffs rise from the stack and drift.
    engine.localToWorld(stackWorld.set(0, 2.6, 1.5));
    for (let i = 0; i < PUFFS; i++) {
      smokeAges[i] = (smokeAges[i] ?? 0) + dt;
      if ((smokeAges[i] ?? 0) > 2.4) {
        smokeAges[i] = 0;
        smokePositions[i * 3] = stackWorld.x;
        smokePositions[i * 3 + 1] = stackWorld.y;
        smokePositions[i * 3 + 2] = stackWorld.z;
      } else {
        smokePositions[i * 3 + 1] = (smokePositions[i * 3 + 1] ?? 0) + dt * 1.6;
        smokePositions[i * 3] = (smokePositions[i * 3] ?? 0) + dt * 0.4;
      }
    }
    smokeGeometry.getAttribute("position").needsUpdate = true;
  });
}
