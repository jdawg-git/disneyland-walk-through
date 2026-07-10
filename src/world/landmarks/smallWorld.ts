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
 * "it's a small world" — the flat white ceremonial façade with gold
 * geometric spires and the central sun-face clock. Faces south (+Z, toward
 * the Fantasyland promenade). White + gold glows warmly at night.
 */
export function buildSmallWorld(scene: Scene, x: number, z: number): void {
  const g = new Group();

  // Faint self-emissive floodlight so the façade doesn't go black at night.
  const white = new MeshStandardMaterial({
    color: 0xf2f0ea,
    roughness: 0.85,
    emissive: new Color(0xcfd4ff),
    emissiveIntensity: 0,
  });
  registerEmissive(white, 0.3);
  const gold = new MeshStandardMaterial({
    color: 0xb08a30,
    emissive: new Color(0xffd980),
    emissiveIntensity: 0.25,
    roughness: 0.4,
    metalness: 0.35,
  });
  registerEmissive(gold, 2.0, 0.25);

  const clockFace = new MeshStandardMaterial({
    color: 0x8a7430,
    emissive: new Color(0xffe8a0),
    emissiveIntensity: 0.4,
    roughness: 0.4,
  });
  registerEmissive(clockFace, 2.6, 0.4);

  // Wide flat façade with stepped side wings.
  const wall = new Mesh(new BoxGeometry(64, 13, 3), white);
  wall.position.y = 6.5;
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);
  for (const side of [-1, 1]) {
    const wing = new Mesh(new BoxGeometry(18, 9, 3), white);
    wing.position.set(side * 38, 4.5, 0);
    wing.castShadow = true;
    g.add(wing);
  }

  // Central clock tower.
  const tower = new Mesh(new BoxGeometry(10, 22, 4), white);
  tower.position.y = 11;
  tower.castShadow = true;
  g.add(tower);
  const clock = new Mesh(new CylinderGeometry(2.6, 2.6, 0.3, 20), clockFace);
  clock.rotation.x = Math.PI / 2;
  clock.position.set(0, 14, 2.2);
  g.add(clock);

  // Gold spires along the parapet + tower finial.
  for (let i = -5; i <= 5; i++) {
    const h = i === 0 ? 0 : 2.2 + (i % 2 === 0 ? 1.6 : 0);
    if (h === 0) continue;
    const spire = new Mesh(new ConeGeometry(0.8, h * 2, 6), gold);
    spire.position.set(i * 5.6, 13 + h, 0);
    spire.castShadow = true;
    g.add(spire);
  }
  const finial = new Mesh(new ConeGeometry(1.6, 7, 8), gold);
  finial.position.y = 22 + 3.5;
  g.add(finial);

  g.position.set(x, 0, z);
  scene.add(g);
}
