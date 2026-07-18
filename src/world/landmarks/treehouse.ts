import {
  BoxGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector2,
} from "three";

/**
 * Adventureland Treehouse ("Disneydendron semperflorens grandis") — the
 * OSM footprint extruded to a bare green column; replaced with a proper
 * giant tree: flared banyan trunk, layered canopy blobs, and small wooden
 * platform decks with railings winding up the trunk.
 *
 * Collider contract: circle r 4.5 at (-146, 157) in walkable.ts.
 */
export function buildTreehouse(scene: Scene, x: number, z: number): void {
  const g = new Group();

  const bark = new MeshStandardMaterial({ color: 0x6a4a30, roughness: 1, flatShading: true });
  const leaf = new MeshStandardMaterial({ color: 0x3f7a34, roughness: 1, flatShading: true });
  const leafLight = new MeshStandardMaterial({ color: 0x549444, roughness: 1, flatShading: true });
  const plank = new MeshStandardMaterial({ color: 0x9a7248, roughness: 0.95 });

  // Flared trunk (banyan-style root spread → tall shaft).
  const profile = [
    new Vector2(3.4, 0),
    new Vector2(2.2, 1.2),
    new Vector2(1.5, 3.5),
    new Vector2(1.3, 8),
    new Vector2(1.1, 12),
    new Vector2(0.7, 15),
    new Vector2(0.1, 16),
  ];
  const trunk = new Mesh(new LatheGeometry(profile, 9), bark);
  trunk.castShadow = true;
  g.add(trunk);

  // Buttress roots.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const root = new Mesh(new CylinderGeometry(0.35, 0.7, 3.4, 5), bark);
    root.position.set(Math.cos(a) * 2.6, 1.1, Math.sin(a) * 2.6);
    root.rotation.z = Math.cos(a) * 0.5;
    root.rotation.x = -Math.sin(a) * 0.5;
    g.add(root);
  }

  // Canopy: overlapping blobs, tallest center — reads as ONE huge tree.
  const blobs: readonly [number, number, number, number, boolean][] = [
    [0, 17.5, 0, 6.5, false],
    [4.5, 15.5, 2, 4.6, true],
    [-4.8, 15, -1.5, 4.9, false],
    [1.5, 14.5, -4.6, 4.2, true],
    [-2, 15.8, 4.4, 4.4, true],
  ];
  for (const [bx, by, bz, r, light] of blobs) {
    const blob = new Mesh(new DodecahedronGeometry(r, 0), light ? leafLight : leaf);
    blob.position.set(bx, by, bz);
    blob.castShadow = true;
    g.add(blob);
  }

  // Platform decks winding up the trunk, with stick railings.
  for (const [py, pa] of [
    [5.5, 0.6],
    [9, 2.7],
    [12, 4.6],
  ] as const) {
    const deck = new Group();
    const floor = new Mesh(new BoxGeometry(3.2, 0.25, 2.4), plank);
    deck.add(floor);
    for (const side of [-1, 1]) {
      const rail = new Mesh(new BoxGeometry(3.2, 0.08, 0.08), plank);
      rail.position.set(0, 0.85, side * 1.15);
      deck.add(rail);
      for (const px of [-1.3, 0, 1.3]) {
        const post = new Mesh(new BoxGeometry(0.08, 0.85, 0.08), plank);
        post.position.set(px, 0.45, side * 1.15);
        deck.add(post);
      }
    }
    deck.position.set(Math.cos(pa) * 2.1, py, Math.sin(pa) * 2.1);
    deck.rotation.y = -pa;
    g.add(deck);
  }

  g.position.set(x, 0, z);
  scene.add(g);
}
