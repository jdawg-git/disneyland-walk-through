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
 * The Haunted Mansion — white antebellum manor: columned portico, dark
 * hipped roof with dormers, cold green-tinged window glow at night. Faces
 * south (+Z, toward the river promenade).
 */
export function buildHauntedMansion(scene: Scene, x: number, z: number): void {
  const g = new Group();

  // Cold faint floodlight — spooky, not black, at night.
  const white = new MeshStandardMaterial({
    color: 0xe4e2da,
    roughness: 0.9,
    emissive: new Color(0xb8d4c8),
    emissiveIntensity: 0,
  });
  registerEmissive(white, 0.22);
  const column = new MeshStandardMaterial({ color: 0xf0eee6, roughness: 0.85 });
  const roof = new MeshStandardMaterial({ color: 0x3a3d3a, roughness: 0.75 });

  const ghostGlow = new MeshStandardMaterial({
    color: 0x2a3430,
    emissive: new Color(0xa8ffd0),
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  registerEmissive(ghostGlow, 1.6);

  const main = new Mesh(new BoxGeometry(22, 12, 16), white);
  main.position.y = 6;
  main.castShadow = true;
  main.receiveShadow = true;
  g.add(main);

  const roofGeo = new ConeGeometry(Math.SQRT2 * 0.5, 1, 4);
  roofGeo.rotateY(Math.PI / 4);
  const hip = new Mesh(roofGeo, roof);
  hip.scale.set(23, 5, 17);
  hip.position.y = 12 + 2.5;
  hip.castShadow = true;
  g.add(hip);

  // Columned portico on the south face.
  const portico = new Mesh(new BoxGeometry(12, 1, 4), roof);
  portico.position.set(0, 10.5, 9);
  g.add(portico);
  for (const cx of [-4.5, -1.5, 1.5, 4.5]) {
    const col = new Mesh(new CylinderGeometry(0.45, 0.5, 10, 10), column);
    col.position.set(cx, 5, 9.5);
    col.castShadow = true;
    g.add(col);
  }

  // Dormers + eerie windows.
  for (const dx of [-6, 0, 6]) {
    const dormer = new Mesh(new BoxGeometry(2.2, 2, 2), white);
    dormer.position.set(dx, 13.4, 6.8);
    g.add(dormer);
  }
  for (const wx of [-7, -2.4, 2.4, 7]) {
    for (const wy of [4, 9]) {
      const win = new Mesh(new BoxGeometry(1.3, 1.9, 0.15), ghostGlow);
      win.position.set(wx, wy, 8.08);
      g.add(win);
    }
  }

  g.position.set(x, 0, z);
  scene.add(g);
}
