import {
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
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
 * Instanced street furniture: Victorian lamp posts (emissive globes — the
 * signature night sparkle) and simple two-tone trees. Everything is one
 * InstancedMesh per part.
 */

export interface PropPlacements {
  readonly lamps: readonly Pt[];
  readonly trees: readonly Pt[];
}

export function buildProps(scene: Scene, placements: PropPlacements, seed: number): void {
  const rng = mulberry32(seed);

  // --- Lamp posts ---
  if (placements.lamps.length > 0) {
    const postMaterial = new MeshStandardMaterial({ color: 0x2c3037, roughness: 0.6 });
    const globeMaterial = new MeshStandardMaterial({
      color: 0x3a3020,
      emissive: new Color(0xffe0a0),
      emissiveIntensity: 0,
      roughness: 0.3,
    });
    registerEmissive(globeMaterial, 3.4);

    const posts = new InstancedMesh(
      new CylinderGeometry(0.07, 0.11, 3.2, 8),
      postMaterial,
      placements.lamps.length,
    );
    const globes = new InstancedMesh(
      new SphereGeometry(0.3, 10, 10),
      globeMaterial,
      placements.lamps.length,
    );
    const m = new Matrix4();
    placements.lamps.forEach((p, i) => {
      m.makeTranslation(p[0], 1.6, p[1]);
      posts.setMatrixAt(i, m);
      m.makeTranslation(p[0], 3.5, p[1]);
      globes.setMatrixAt(i, m);
    });
    posts.instanceMatrix.needsUpdate = true;
    globes.instanceMatrix.needsUpdate = true;
    posts.castShadow = true;
    scene.add(posts, globes);
  }

  // --- Trees ---
  if (placements.trees.length > 0) {
    const trunkMaterial = new MeshStandardMaterial({ color: 0x5c4632, roughness: 1 });
    const leafMaterial = new MeshStandardMaterial({ color: 0x4f7c3a, roughness: 1 });

    const trunks = new InstancedMesh(
      new CylinderGeometry(0.14, 0.2, 2.2, 7),
      trunkMaterial,
      placements.trees.length,
    );
    const crowns = new InstancedMesh(
      new DodecahedronGeometry(1.6, 0),
      leafMaterial,
      placements.trees.length,
    );
    const m = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scale = new Vector3();
    placements.trees.forEach((p, i) => {
      const s = 0.85 + rng() * 0.5;
      pos.set(p[0], 1.1 * s, p[1]);
      scale.set(s, s, s);
      q.setFromAxisAngle(new Vector3(0, 1, 0), rng() * Math.PI * 2);
      m.compose(pos, q, scale);
      trunks.setMatrixAt(i, m);
      pos.set(p[0], (2.2 + 1.1) * s, p[1]);
      m.compose(pos, q, scale);
      crowns.setMatrixAt(i, m);
    });
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    crowns.castShadow = true;
    scene.add(trunks, crowns);
  }
}
