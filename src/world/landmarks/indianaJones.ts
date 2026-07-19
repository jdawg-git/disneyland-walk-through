import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from "three";

/**
 * Indiana Jones Adventure — the Temple of the Forbidden Eye at the deep
 * end of the jungle trail: broad stone stairs between COBRA PILLARS
 * (flared-hood caps), a dark doorway, and a tall stepped tower narrowing
 * to a point (the real temple's crumbling shikhara), rubble and moss
 * draped over the tiers. Built facing −Z; the group turns to greet the
 * trail approach from the northeast.
 *
 * Collider contract: box halfW 7 × halfD 5 at (-145, 190) in walkable.ts.
 */
export function buildIndianaJones(scene: Scene, x: number, z: number): void {
  const g = new Group();

  const stone = new MeshStandardMaterial({ color: 0xa08a68, roughness: 1, flatShading: true });
  const stoneDark = new MeshStandardMaterial({ color: 0x84714f, roughness: 1 });
  const moss = new MeshStandardMaterial({ color: 0x4c6e38, roughness: 1 });
  const dark = new MeshStandardMaterial({ color: 0x14100c, roughness: 1 });
  const gold = new MeshStandardMaterial({ color: 0xc8a038, roughness: 0.5, metalness: 0.3 });

  // Broad stone stairs up to the door.
  for (let i = 0; i < 4; i++) {
    const step = new Mesh(new BoxGeometry(8.5 - i * 0.8, 0.45, 2.2 - i * 0.35), stoneDark);
    step.position.set(0, 0.22 + i * 0.45, -4.6 + i * 0.45);
    step.receiveShadow = true;
    g.add(step);
  }

  // Main temple block + doorway with a gold lintel.
  const block = new Mesh(new BoxGeometry(10, 6, 6), stone);
  block.position.y = 3;
  block.castShadow = true;
  g.add(block);
  const doorway = new Mesh(new BoxGeometry(2.6, 3.6, 0.5), dark);
  doorway.position.set(0, 3.6, -3.05);
  g.add(doorway);
  const lintel = new Mesh(new BoxGeometry(3.2, 0.4, 0.6), gold);
  lintel.position.set(0, 5.6, -3.05);
  g.add(lintel);

  // Stepped tower narrowing to a point — the temple's ruined spire.
  const tiers: readonly (readonly [number, number, number])[] = [
    // [width, height, x-lean] — slight offsets read as crumbling stone.
    [8.2, 1.6, 0.15],
    [6.9, 1.5, -0.2],
    [5.6, 1.4, 0.1],
    [4.3, 1.3, -0.15],
    [3.1, 1.2, 0.1],
    [2.0, 1.1, 0],
  ];
  let tierY = 6;
  tiers.forEach(([w, h, lean], i) => {
    const tier = new Mesh(new BoxGeometry(w, h, w * 0.72), i % 2 === 0 ? stone : stoneDark);
    tier.position.set(lean, tierY + h / 2, 0.4);
    tier.castShadow = true;
    g.add(tier);
    tierY += h;
  });
  const spire = new Mesh(new ConeGeometry(0.9, 2.4, 4), stoneDark);
  spire.rotation.y = Math.PI / 4;
  spire.position.set(0, tierY + 1.2, 0.4);
  spire.castShadow = true;
  g.add(spire);

  // Tumbled rubble blocks on the tower face and at the base.
  for (const [rx, ry, rz, s, rot] of [
    [-1.8, 7.2, -2.4, 1.1, 0.4],
    [2.2, 9.1, -1.6, 0.9, -0.3],
    [-3.9, 0.5, -3.6, 1.3, 0.7],
    [4.2, 0.4, -4.1, 1.0, -0.5],
  ] as const) {
    const rubble = new Mesh(new BoxGeometry(s, s * 0.7, s * 0.8), stoneDark);
    rubble.position.set(rx, ry, rz);
    rubble.rotation.set(rot * 0.4, rot, rot * 0.3);
    g.add(rubble);
  }

  // Cobra pillars flanking the stairs: shaft + flared hood cap.
  for (const side of [-1, 1]) {
    for (const row of [0, 1]) {
      const px = side * (3.6 + row * 1.6);
      const pz = -4.4 - row * 2.4;
      const shaft = new Mesh(new CylinderGeometry(0.5, 0.65, 4.6, 7), stoneDark);
      shaft.position.set(px, 2.3, pz);
      shaft.castShadow = true;
      g.add(shaft);
      const hood = new Mesh(new BoxGeometry(1.5, 1.3, 0.7), stone);
      hood.position.set(px, 5.1, pz);
      hood.rotation.x = -0.15; // hood flares forward like a rearing cobra
      g.add(hood);
      const head = new Mesh(new BoxGeometry(0.7, 0.55, 0.5), stoneDark);
      head.position.set(px, 4.4, pz - 0.45);
      g.add(head);
    }
  }

  // Moss and vines draped over the tiers.
  for (const [mx, my, mz, w] of [
    [-3.6, 6.1, -2.6, 2.0],
    [1.6, 7.9, -2.0, 2.4],
    [-1.2, 9.4, -1.4, 1.8],
    [3.8, 4.2, -3.05, 1.4],
    [0.4, 11.2, -0.8, 1.5],
  ] as const) {
    const patch = new Mesh(new BoxGeometry(w, 0.35, 0.6), moss);
    patch.position.set(mx, my, mz);
    g.add(patch);
  }

  // Face the trail: the loop approaches from the northeast.
  g.rotation.y = -0.95;
  g.position.set(x, 0, z);
  scene.add(g);
}
