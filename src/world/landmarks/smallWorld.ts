import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
} from "three";
import { registerEmissive } from "../../engine/emissive";
import { registerUpdatable } from "../../engine/updatables";

/**
 * "it's a small world" v2 — the white ceremonial facade: an abstract
 * geometric skyline of stacked shapes across the parapet, gold accents,
 * and the great central clock tower with WORKING hour/minute hands
 * (60x speed so guests actually see them move). Faces south (+Z).
 *
 * Collider contract: box halfW 51 × halfD 4 at (114.3, −247.7) in
 * walkable.ts — all geometry stays within that footprint.
 */
export function buildSmallWorld(scene: Scene, x: number, z: number): void {
  const g = new Group();

  const white = new MeshStandardMaterial({
    color: 0xf4f2ec,
    roughness: 0.85,
    emissive: new Color(0xcfd4ff),
    emissiveIntensity: 0,
  });
  registerEmissive(white, 0.3);

  const gold = new MeshStandardMaterial({
    color: 0xd4a63c,
    emissive: new Color(0xffd980),
    emissiveIntensity: 0.25,
    roughness: 0.4,
    metalness: 0.35,
  });
  registerEmissive(gold, 2.0, 0.25);

  const blue = new MeshStandardMaterial({
    color: 0x7ea8d8,
    roughness: 0.7,
    emissive: new Color(0x9ec8f8),
    emissiveIntensity: 0,
  });
  registerEmissive(blue, 0.5);

  // Base facade wall + stepped side wings.
  const wall = new Mesh(new BoxGeometry(64, 12, 3), white);
  wall.position.y = 6;
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);
  for (const side of [-1, 1]) {
    const wing = new Mesh(new BoxGeometry(18, 8.5, 3), white);
    wing.position.set(side * 38, 4.25, 0);
    wing.castShadow = true;
    g.add(wing);
  }

  // Abstract geometric skyline along the parapet — the facade's signature.
  const skyline: readonly (readonly [number, "box" | "cyl" | "cone" | "sphere", number, number])[] = [
    // [x offset, shape, width/radius, height]
    [-29, "cone", 2.2, 5.5],
    [-24, "box", 3.2, 3.4],
    [-19.5, "cyl", 1.6, 4.6],
    [-14.5, "box", 2.6, 6.2],
    [-9.5, "cone", 1.8, 4.2],
    [9.5, "cone", 1.8, 4.2],
    [14.5, "box", 2.6, 6.2],
    [19.5, "cyl", 1.6, 4.6],
    [24, "box", 3.2, 3.4],
    [29, "cone", 2.2, 5.5],
  ];
  for (const [sx, kind, size, h] of skyline) {
    let mesh: Mesh;
    if (kind === "box") mesh = new Mesh(new BoxGeometry(size, h, 2.2), white);
    else if (kind === "cyl") mesh = new Mesh(new CylinderGeometry(size, size, h, 12), white);
    else if (kind === "cone") mesh = new Mesh(new ConeGeometry(size, h, 10), blue);
    else mesh = new Mesh(new SphereGeometry(size, 10, 8), white);
    mesh.position.set(sx, 12 + h / 2, 0);
    mesh.castShadow = true;
    g.add(mesh);
    // Gold tip on every skyline element.
    const tip = new Mesh(new SphereGeometry(0.28, 8, 6), gold);
    tip.position.set(sx, 12 + h + 0.3, 0);
    g.add(tip);
  }

  // Central clock tower.
  const tower = new Mesh(new BoxGeometry(10, 24, 4), white);
  tower.position.y = 12;
  tower.castShadow = true;
  g.add(tower);
  const towerCap = new Mesh(new ConeGeometry(5.6, 6, 4), blue);
  towerCap.rotation.y = Math.PI / 4;
  towerCap.position.y = 24 + 3;
  towerCap.castShadow = true;
  g.add(towerCap);
  const finial = new Mesh(new ConeGeometry(0.8, 4, 8), gold);
  finial.position.y = 27 + 2.8;
  g.add(finial);

  // The great clock: glowing dial + working hands.
  const dialMaterial = new MeshStandardMaterial({
    color: 0xf8f0d8,
    emissive: new Color(0xffe8a0),
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  registerEmissive(dialMaterial, 2.4, 0.35);
  const dial = new Mesh(new CylinderGeometry(3.1, 3.1, 0.3, 24), dialMaterial);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 16, 2.2);
  g.add(dial);
  const bezel = new Mesh(new CylinderGeometry(3.4, 3.4, 0.24, 24), gold);
  bezel.rotation.x = Math.PI / 2;
  bezel.position.set(0, 16, 2.1);
  g.add(bezel);

  const handMaterial = new MeshStandardMaterial({ color: 0x2a2438, roughness: 0.5 });
  const hourHand = new Mesh(new BoxGeometry(0.34, 1.7, 0.1), handMaterial);
  hourHand.geometry.translate(0, 0.85, 0); // pivot at the base
  hourHand.position.set(0, 16, 2.42);
  g.add(hourHand);
  const minuteHand = new Mesh(new BoxGeometry(0.22, 2.5, 0.1), handMaterial);
  minuteHand.geometry.translate(0, 1.25, 0);
  minuteHand.position.set(0, 16, 2.46);
  g.add(minuteHand);
  registerUpdatable((_dt, time) => {
    // 60x park time: a full "hour" sweep every minute of play.
    const minutes = (time / 60) * 60;
    minuteHand.rotation.z = -(minutes % 60) * ((Math.PI * 2) / 60);
    hourHand.rotation.z = -((minutes / 60) % 12) * ((Math.PI * 2) / 12);
  });

  // Topiary row along the entrance promenade.
  const leaf = new MeshStandardMaterial({ color: 0x4f7c3a, roughness: 1 });
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const topiary = new Mesh(
      i % 2 === 0 ? new SphereGeometry(1.1, 8, 6) : new ConeGeometry(0.9, 2.4, 8),
      leaf,
    );
    topiary.position.set(i * 8, i % 2 === 0 ? 1.1 : 1.2, 5.4);
    topiary.castShadow = true;
    g.add(topiary);
  }

  g.position.set(x, 0, z);
  scene.add(g);
}
