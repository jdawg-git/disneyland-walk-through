import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";
import { registerEmissive } from "../engine/emissive";
import { mulberry32 } from "../engine/random";
import type { Pt } from "../data/parkLayout";

/**
 * Instanced street furniture and greenery. Three tree species keyed by
 * land mood (round deciduous, tropical palm, mountain pine) and Victorian
 * lamp posts with emissive globes. One InstancedMesh per part — the whole
 * prop layer is a handful of draw calls.
 */

export interface PropPlacements {
  readonly lamps: readonly Pt[];
  readonly round: readonly Pt[];
  readonly palm: readonly Pt[];
  readonly pine: readonly Pt[];
}

export function buildProps(scene: Scene, placements: PropPlacements, seed: number): void {
  const rng = mulberry32(seed);

  buildLamps(scene, placements.lamps);
  buildRoundTrees(scene, placements.round, rng);
  buildPalms(scene, placements.palm, rng);
  buildPines(scene, placements.pine, rng);
}

function buildLamps(scene: Scene, lamps: readonly Pt[]): void {
  if (lamps.length === 0) return;
  // Reference photo (hub): olive-green fluted posts with a bronze collar
  // and milky-white opal globes — visibly WHITE by day, warm-lit at night.
  const postMaterial = new MeshStandardMaterial({ color: 0x55603c, roughness: 0.55 });
  const collarMaterial = new MeshStandardMaterial({
    color: 0x8a6f3c,
    roughness: 0.4,
    metalness: 0.45,
  });
  const globeMaterial = new MeshStandardMaterial({
    color: 0xf2efe2,
    emissive: new Color(0xffe0a0),
    emissiveIntensity: 0,
    roughness: 0.35,
  });
  registerEmissive(globeMaterial, 3.4, 0.12); // faint milkiness by day

  const posts = new InstancedMesh(new CylinderGeometry(0.08, 0.13, 3.2, 8), postMaterial, lamps.length);
  const collars = new InstancedMesh(new CylinderGeometry(0.11, 0.11, 0.22, 8), collarMaterial, lamps.length);
  const globes = new InstancedMesh(new SphereGeometry(0.3, 10, 10), globeMaterial, lamps.length);
  const m = new Matrix4();
  lamps.forEach((p, i) => {
    m.makeTranslation(p[0], 1.6, p[1]);
    posts.setMatrixAt(i, m);
    m.makeTranslation(p[0], 3.15, p[1]);
    collars.setMatrixAt(i, m);
    m.makeTranslation(p[0], 3.5, p[1]);
    globes.setMatrixAt(i, m);
  });
  posts.instanceMatrix.needsUpdate = true;
  collars.instanceMatrix.needsUpdate = true;
  globes.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  scene.add(posts, collars, globes);
}

function scatter(
  scene: Scene,
  positions: readonly Pt[],
  rng: () => number,
  parts: readonly {
    geometry: ConeGeometry | CylinderGeometry | DodecahedronGeometry | IcosahedronGeometry;
    material: MeshStandardMaterial;
    y: (s: number) => number;
    castShadow?: boolean;
  }[],
): void {
  if (positions.length === 0) return;
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const pos = new Vector3();
  const scl = new Vector3();
  const m = new Matrix4();
  const scales = positions.map(() => 0.8 + rng() * 0.55);
  const yaws = positions.map(() => rng() * Math.PI * 2);

  for (const part of parts) {
    const mesh = new InstancedMesh(part.geometry, part.material, positions.length);
    positions.forEach((p, i) => {
      const s = scales[i] ?? 1;
      q.setFromAxisAngle(up, yaws[i] ?? 0);
      pos.set(p[0], part.y(s), p[1]);
      scl.setScalar(s);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (part.castShadow !== false) mesh.castShadow = true;
    scene.add(mesh);
  }
}

function buildRoundTrees(scene: Scene, positions: readonly Pt[], rng: () => number): void {
  scatter(scene, positions, rng, [
    {
      geometry: new CylinderGeometry(0.14, 0.2, 2.2, 7),
      material: new MeshStandardMaterial({ color: 0x5c4632, roughness: 1 }),
      y: (s) => 1.1 * s,
      castShadow: false,
    },
    {
      geometry: new DodecahedronGeometry(1.7, 0),
      material: new MeshStandardMaterial({ color: 0x4f7c3a, roughness: 1, flatShading: true }),
      y: (s) => (2.2 + 1.2) * s,
    },
  ]);
}

function buildPalms(scene: Scene, positions: readonly Pt[], rng: () => number): void {
  // Frond ball: flattened icosahedron reads as a palm crown at distance.
  const crown = new IcosahedronGeometry(2.2, 0);
  crown.scale(1, 0.5, 1);
  scatter(scene, positions, rng, [
    {
      geometry: new CylinderGeometry(0.12, 0.22, 5.2, 7),
      material: new MeshStandardMaterial({ color: 0x7a6248, roughness: 1 }),
      y: (s) => 2.6 * s,
      castShadow: false,
    },
    {
      geometry: crown,
      material: new MeshStandardMaterial({ color: 0x5a8c3c, roughness: 1, flatShading: true }),
      y: (s) => 5.4 * s,
    },
  ]);
}

function buildPines(scene: Scene, positions: readonly Pt[], rng: () => number): void {
  scatter(scene, positions, rng, [
    {
      geometry: new CylinderGeometry(0.16, 0.24, 1.8, 7),
      material: new MeshStandardMaterial({ color: 0x4f3c2c, roughness: 1 }),
      y: (s) => 0.9 * s,
      castShadow: false,
    },
    {
      geometry: new ConeGeometry(1.6, 4.6, 8),
      material: new MeshStandardMaterial({ color: 0x4d8244, roughness: 1, flatShading: true }),
      y: (s) => (1.8 + 2.1) * s,
    },
  ]);
}
