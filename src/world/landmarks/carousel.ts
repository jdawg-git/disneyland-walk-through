import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
} from "three";

/**
 * King Arthur Carrousel — an actual merry-go-round instead of the round
 * OSM slab: raised platform, ring of poles with jumping horses, center
 * column, and a gold-and-white striped tent canopy with a finial.
 *
 * Collider contract: circle r 8.5 at (4, -76) in walkable.ts.
 */

const HORSE_COLORS = [0xf3f3f0, 0xe8b4c8, 0x9fc4e8, 0xf0d090, 0xc9aee5, 0xf3f3f0, 0xa8d8b8, 0xe89a8a];

export function buildCarousel(scene: Scene, x: number, z: number): void {
  const g = new Group();

  const cream = new MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.85 });
  const gold = new MeshStandardMaterial({ color: 0xd8a838, roughness: 0.5, metalness: 0.3 });
  const wood = new MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 });

  // Raised deck.
  const deck = new Mesh(new CylinderGeometry(7.2, 7.6, 1.0, 20), wood);
  deck.position.y = 0.5;
  deck.receiveShadow = true;
  g.add(deck);

  // Center column.
  const column = new Mesh(new CylinderGeometry(1.1, 1.3, 4.6, 12), cream);
  column.position.y = 1 + 2.3;
  g.add(column);

  // Striped tent canopy: alternate gold/white wedges via per-face colors.
  const canopy = new ConeGeometry(8.2, 3.4, 14, 1).toNonIndexed();
  const pos = canopy.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const goldC = new Color(0xd8a838);
  const whiteC = new Color(0xf6f2e6);
  for (let f = 0; f < pos.count / 3; f++) {
    let cx = 0;
    let cz = 0;
    for (let v = 0; v < 3; v++) {
      cx += pos.getX(f * 3 + v);
      cz += pos.getZ(f * 3 + v);
    }
    const sector = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 14);
    const c = sector % 2 === 0 ? goldC : whiteC;
    for (let v = 0; v < 3; v++) {
      colors[(f * 3 + v) * 3] = c.r;
      colors[(f * 3 + v) * 3 + 1] = c.g;
      colors[(f * 3 + v) * 3 + 2] = c.b;
    }
  }
  canopy.setAttribute("color", new BufferAttribute(colors, 3));
  const canopyMesh = new Mesh(
    canopy,
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }),
  );
  canopyMesh.position.y = 1 + 4.6 + 1.7;
  canopyMesh.castShadow = true;
  g.add(canopyMesh);

  const finial = new Mesh(new SphereGeometry(0.5, 10, 8), gold);
  finial.position.y = 1 + 4.6 + 3.4 + 0.3;
  g.add(finial);

  // Poles + jumping horses around the platform.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = Math.cos(a) * 5.4;
    const pz = Math.sin(a) * 5.4;

    const pole = new Mesh(new CylinderGeometry(0.07, 0.07, 4.4, 6), gold);
    pole.position.set(px, 1 + 2.2, pz);
    g.add(pole);

    const horse = new Group();
    const bodyMat = new MeshStandardMaterial({ color: HORSE_COLORS[i] ?? 0xffffff, roughness: 0.8 });
    const body = new Mesh(new BoxGeometry(0.5, 0.55, 1.35), bodyMat);
    horse.add(body);
    const head = new Mesh(new BoxGeometry(0.34, 0.55, 0.42), bodyMat);
    head.position.set(0, 0.5, 0.72);
    head.rotation.x = -0.25;
    horse.add(head);
    const saddle = new Mesh(new BoxGeometry(0.55, 0.14, 0.6), gold);
    saddle.position.y = 0.32;
    horse.add(saddle);
    // Jumping pose: alternate heights, slight pitch.
    horse.position.set(px, 1 + 1.5 + (i % 2 === 0 ? 0.35 : -0.1), pz);
    horse.rotation.y = -a + Math.PI; // face along the ride direction
    horse.rotation.z = 0.06;
    g.add(horse);
  }

  g.position.set(x, 0, z);
  scene.add(g);
}
