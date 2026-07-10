import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from "three";
import { registerEmissive } from "../../engine/emissive";

/**
 * The Enchanted Tiki Room — steep Polynesian A-frame with a thatched
 * overhanging roof, bamboo posts, and tiki torches that flicker-glow at
 * night (static glow — cheap).
 */
export function buildTikiRoom(scene: Scene, x: number, z: number): void {
  const tiki = new Group();

  const thatch = new MeshStandardMaterial({ color: 0x8a6d3c, roughness: 1, flatShading: true });
  const wall = new MeshStandardMaterial({ color: 0x6d5638, roughness: 0.95 });
  const bamboo = new MeshStandardMaterial({ color: 0xa8895c, roughness: 0.85 });

  const flame = new MeshStandardMaterial({
    color: 0x743c14,
    emissive: new Color(0xff9c3a),
    emissiveIntensity: 0.5,
    roughness: 0.6,
  });
  registerEmissive(flame, 2.8, 0.5);

  // Steep A-frame: 4-sided cone stretched along x (rotation baked).
  const roofGeo = new ConeGeometry(Math.SQRT2 * 0.5, 1, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new Mesh(roofGeo, thatch);
  roof.scale.set(30, 13, 16);
  roof.position.y = 4 + 6.5;
  roof.castShadow = true;
  tiki.add(roof);

  const hall = new Mesh(new BoxGeometry(22, 4, 11), wall);
  hall.position.y = 2;
  hall.castShadow = true;
  hall.receiveShadow = true;
  tiki.add(hall);

  // Bamboo corner posts + entry torches.
  for (const [px, pz] of [
    [-11, 5.8],
    [11, 5.8],
    [-11, -5.8],
    [11, -5.8],
  ] as const) {
    const post = new Mesh(new CylinderGeometry(0.22, 0.26, 4.4, 7), bamboo);
    post.position.set(px, 2.2, pz);
    tiki.add(post);
  }
  for (const tx of [-6, 6]) {
    const stick = new Mesh(new CylinderGeometry(0.09, 0.12, 2.4, 6), bamboo);
    stick.position.set(tx, 1.2, 8.5);
    tiki.add(stick);
    const fire = new Mesh(new ConeGeometry(0.32, 0.8, 7), flame);
    fire.position.set(tx, 2.7, 8.5);
    tiki.add(fire);
  }

  tiki.position.set(x, 0, z);
  scene.add(tiki);
}
