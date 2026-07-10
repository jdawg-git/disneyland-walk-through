import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from "three";
import { registerEmissive } from "../../engine/emissive";

/**
 * Pirates of the Caribbean façade — New Orleans colonial mansion: cream
 * walls, dark mansard roofs, arched loggia along the front, warm lantern
 * glow at night. Faces north (−Z, toward the NOS promenade).
 */
export function buildPiratesFacade(scene: Scene, x: number, z: number): void {
  const g = new Group();

  const cream = new MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
  const shutter = new MeshStandardMaterial({ color: 0x3c4a42, roughness: 0.85 });
  const mansard = new MeshStandardMaterial({ color: 0x3f3a46, roughness: 0.7 });
  const arch = new MeshStandardMaterial({ color: 0x241e18, roughness: 1 });

  const lantern = new MeshStandardMaterial({
    color: 0x4a3a20,
    emissive: new Color(0xffb85a),
    emissiveIntensity: 0.3,
    roughness: 0.5,
  });
  registerEmissive(lantern, 2.8, 0.3);

  // Main block.
  const main = new Mesh(new BoxGeometry(30, 11, 14), cream);
  main.position.y = 5.5;
  main.castShadow = true;
  main.receiveShadow = true;
  g.add(main);

  const roofGeo = new ConeGeometry(Math.SQRT2 * 0.5, 1, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new Mesh(roofGeo, mansard);
  roof.scale.set(31, 5.5, 15);
  roof.position.y = 11 + 2.75;
  roof.castShadow = true;
  g.add(roof);

  // Flanking wings.
  for (const side of [-1, 1]) {
    const wing = new Mesh(new BoxGeometry(10, 8, 12), cream);
    wing.position.set(side * 20, 4, 1);
    wing.castShadow = true;
    g.add(wing);
    const wingRoof = new Mesh(roofGeo.clone(), mansard);
    wingRoof.scale.set(11, 4, 13);
    wingRoof.position.set(side * 20, 8 + 2, 1);
    wingRoof.castShadow = true;
    g.add(wingRoof);
  }

  // Arched loggia along the front face (−z).
  for (let i = -3; i <= 3; i++) {
    const opening = new Mesh(new BoxGeometry(2.4, 4.2, 0.5), arch);
    opening.position.set(i * 3.8, 2.4, -7.1);
    g.add(opening);
  }
  // Second-story shuttered windows + lanterns.
  for (let i = -3; i <= 3; i++) {
    const win = new Mesh(new BoxGeometry(1.5, 2.2, 0.25), shutter);
    win.position.set(i * 3.8, 8, -7.1);
    g.add(win);
  }
  for (const lx of [-13, 0, 13]) {
    const lamp = new Mesh(new BoxGeometry(0.5, 0.9, 0.5), lantern);
    lamp.position.set(lx, 4.6, -7.4);
    g.add(lamp);
  }

  g.position.set(x, 0, z);
  scene.add(g);
}
