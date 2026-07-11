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
 * The Haunted Mansion v2 — the red-brick antebellum manor: a six-column
 * white portico with capitals and entablature, upper balustrade, cupola,
 * dormers, and a wrought-iron roof crest. Cold green window glow at night.
 * Faces south (+Z, toward the river promenade).
 *
 * Collider contract: box halfW 12 × halfD 9.5 at (−301.8, 120.2).
 */
export function buildHauntedMansion(scene: Scene, x: number, z: number): void {
  const g = new Group();

  const brick = new MeshStandardMaterial({
    color: 0x9c5a48,
    roughness: 0.95,
    emissive: new Color(0xb8d4c8),
    emissiveIntensity: 0,
  });
  registerEmissive(brick, 0.18); // faint cold floodlight — spooky, not black
  const white = new MeshStandardMaterial({ color: 0xf0eee6, roughness: 0.85 });
  const roof = new MeshStandardMaterial({ color: 0x3a3d3a, roughness: 0.75 });
  const iron = new MeshStandardMaterial({ color: 0x1f2220, roughness: 0.6 });

  const ghostGlow = new MeshStandardMaterial({
    color: 0x2a3430,
    emissive: new Color(0xa8ffd0),
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  registerEmissive(ghostGlow, 1.6);

  // Main brick block.
  const main = new Mesh(new BoxGeometry(22, 12, 16), brick);
  main.position.y = 6;
  main.castShadow = true;
  main.receiveShadow = true;
  g.add(main);

  // Hip roof (rotation baked so scaling stays axis-aligned).
  const roofGeo = new ConeGeometry(Math.SQRT2 * 0.5, 1, 4);
  roofGeo.rotateY(Math.PI / 4);
  const hip = new Mesh(roofGeo, roof);
  hip.scale.set(23, 4.5, 17);
  hip.position.y = 12 + 2.25;
  hip.castShadow = true;
  g.add(hip);

  // Wrought-iron crest along the ridge.
  const crest = new Mesh(new BoxGeometry(14, 0.9, 0.12), iron);
  crest.position.y = 12 + 4.4;
  g.add(crest);

  // Cupola.
  const cupola = new Mesh(new BoxGeometry(3, 2.6, 3), white);
  cupola.position.y = 12 + 4.4 + 1.3;
  cupola.castShadow = true;
  g.add(cupola);
  const cupolaRoof = new Mesh(new ConeGeometry(2.4, 1.8, 8), roof);
  cupolaRoof.position.y = 12 + 4.4 + 2.6 + 0.9;
  g.add(cupolaRoof);

  // Six-column portico with capitals + entablature + balustrade.
  const entablature = new Mesh(new BoxGeometry(14, 1.1, 4.6), white);
  entablature.position.set(0, 10.4, 9.4);
  entablature.castShadow = true;
  g.add(entablature);
  for (let i = 0; i < 6; i++) {
    const cx = -5.5 + i * 2.2;
    const column = new Mesh(new CylinderGeometry(0.34, 0.4, 9.6, 10), white);
    column.position.set(cx, 5, 9.8);
    column.castShadow = true;
    g.add(column);
    const capital = new Mesh(new BoxGeometry(0.95, 0.4, 0.95), white);
    capital.position.set(cx, 9.85, 9.8);
    g.add(capital);
  }
  // Balustrade above the portico.
  for (let i = 0; i < 13; i++) {
    const post = new Mesh(new BoxGeometry(0.18, 0.8, 0.18), white);
    post.position.set(-6 + i * 1.0, 11.4, 9.4);
    g.add(post);
  }
  const rail = new Mesh(new BoxGeometry(13.4, 0.2, 0.3), white);
  rail.position.set(0, 11.9, 9.4);
  g.add(rail);

  // Dormers on the south roof face.
  for (const dx of [-6.5, 0, 6.5]) {
    const dormer = new Mesh(new BoxGeometry(2.2, 2, 2), brick);
    dormer.position.set(dx, 13.4, 7.2);
    g.add(dormer);
    const dormerRoof = new Mesh(new ConeGeometry(1.6, 1.2, 4), roof);
    dormerRoof.rotation.y = Math.PI / 4;
    dormerRoof.position.set(dx, 14.9, 7.2);
    g.add(dormerRoof);
  }

  // Eerie windows: two stories, white-framed, green-glowing at night.
  for (const wx of [-8.2, -4.4, 4.4, 8.2]) {
    for (const wy of [4, 8.6]) {
      const frame = new Mesh(new BoxGeometry(1.7, 2.3, 0.12), white);
      frame.position.set(wx, wy, 8.04);
      g.add(frame);
      const win = new Mesh(new BoxGeometry(1.3, 1.9, 0.15), ghostGlow);
      win.position.set(wx, wy, 8.1);
      g.add(win);
    }
  }
  // Front door beneath the portico.
  const door = new Mesh(new BoxGeometry(2.2, 3.4, 0.2), iron);
  door.position.set(0, 1.7, 8.06);
  g.add(door);

  g.position.set(x, 0, z);
  scene.add(g);
}
