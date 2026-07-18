import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from "three";

/**
 * Indiana Jones Adventure — the modest jungle-temple entrance the guest
 * map shows (the 131×169 m show building is culled): stepped stone base,
 * two carved columns, a dark doorway, a cracked pediment, and moss/vine
 * blocks draped over the stones. Faces north (−Z) toward the jungle trail.
 *
 * Collider contract: box halfW 6 × halfD 3.5 at (-118, 168) in walkable.ts.
 */
export function buildIndianaJones(scene: Scene, x: number, z: number): void {
  const g = new Group();

  const stone = new MeshStandardMaterial({ color: 0x9b8f74, roughness: 1, flatShading: true });
  const stoneDark = new MeshStandardMaterial({ color: 0x7d7259, roughness: 1 });
  const moss = new MeshStandardMaterial({ color: 0x4c6e38, roughness: 1 });
  const dark = new MeshStandardMaterial({ color: 0x14100c, roughness: 1 });

  // Stepped base.
  for (const [w, h, d, y] of [
    [11, 0.7, 6.4, 0.35],
    [9.6, 0.7, 5.6, 1.05],
  ] as const) {
    const step = new Mesh(new BoxGeometry(w, h, d), stoneDark);
    step.position.y = y;
    step.receiveShadow = true;
    g.add(step);
  }

  // Main temple block + doorway.
  const block = new Mesh(new BoxGeometry(8.2, 4.6, 4.4), stone);
  block.position.y = 1.4 + 2.3;
  block.castShadow = true;
  g.add(block);
  const doorway = new Mesh(new BoxGeometry(2.2, 3.0, 0.5), dark);
  doorway.position.set(0, 1.4 + 1.5, -2.25);
  g.add(doorway);

  // Carved columns flanking the door.
  for (const side of [-1, 1]) {
    const col = new Mesh(new BoxGeometry(0.9, 4.2, 0.9), stoneDark);
    col.position.set(side * 2.6, 1.4 + 2.1, -2.5);
    col.castShadow = true;
    g.add(col);
    const cap = new Mesh(new BoxGeometry(1.3, 0.5, 1.3), stone);
    cap.position.set(side * 2.6, 1.4 + 4.35, -2.5);
    g.add(cap);
  }

  // Cracked pediment — two offset slabs so the top reads ruined.
  const pedimentA = new Mesh(new BoxGeometry(6.4, 1.1, 3.6), stone);
  pedimentA.position.set(-1.1, 1.4 + 4.6 + 0.55, 0);
  pedimentA.rotation.z = 0.05;
  g.add(pedimentA);
  const pedimentB = new Mesh(new BoxGeometry(3.4, 0.9, 3.2), stoneDark);
  pedimentB.position.set(2.9, 1.4 + 4.6 + 0.4, 0.2);
  pedimentB.rotation.z = -0.08;
  g.add(pedimentB);

  // Moss and vines draped over edges.
  for (const [mx, my, mz, w] of [
    [-3.2, 4.4, -2.3, 1.6],
    [1.8, 5.4, -1.9, 2.2],
    [3.6, 3.2, -2.3, 1.2],
    [-1.2, 6.1, 0.4, 2.6],
  ] as const) {
    const patch = new Mesh(new BoxGeometry(w, 0.35, 0.5), moss);
    patch.position.set(mx, my, mz);
    g.add(patch);
  }

  g.position.set(x, 0, z);
  scene.add(g);
}
