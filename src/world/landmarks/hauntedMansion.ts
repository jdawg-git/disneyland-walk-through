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
 * The Haunted Mansion v3, matched to the Anaheim reference photo: a CREAM
 * antebellum manor (not red brick — that's Florida), tall white four-column
 * portico under a triangular pediment with a fan window, two-story verandas
 * wrapped in sage-green wrought-iron filigree, dark-green shutters, red
 * brick base, and a widow's-walk roof with weathervane. Cold green window
 * glow at night. Faces south (+Z, toward the river promenade).
 *
 * Collider contract: box halfW 12 × halfD 9.5 at (−301.8, 120.2).
 */
export function buildHauntedMansion(scene: Scene, x: number, z: number): void {
  const g = new Group();

  const cream = new MeshStandardMaterial({
    color: 0xf2ecda,
    roughness: 0.9,
    emissive: new Color(0xb8d4c8),
    emissiveIntensity: 0,
  });
  registerEmissive(cream, 0.22); // faint cold floodlight — spooky, not black
  const white = new MeshStandardMaterial({ color: 0xfdf9ec, roughness: 0.85 });
  const sage = new MeshStandardMaterial({ color: 0x93ac8a, roughness: 0.75 });
  const shutter = new MeshStandardMaterial({ color: 0x2f4a38, roughness: 0.8 });
  const brick = new MeshStandardMaterial({ color: 0x9c5a48, roughness: 0.95 });
  const roof = new MeshStandardMaterial({ color: 0x3a3d3a, roughness: 0.75 });
  const iron = new MeshStandardMaterial({ color: 0x1f2220, roughness: 0.6 });

  const ghostGlow = new MeshStandardMaterial({
    color: 0x2a3430,
    emissive: new Color(0xa8ffd0),
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  registerEmissive(ghostGlow, 1.6);

  // Red-brick base course the manor sits on.
  const base = new Mesh(new BoxGeometry(23, 1.2, 17), brick);
  base.position.y = 0.6;
  base.receiveShadow = true;
  g.add(base);

  // Main cream block.
  const main = new Mesh(new BoxGeometry(22, 12, 16), cream);
  main.position.y = 6.6;
  main.castShadow = true;
  main.receiveShadow = true;
  g.add(main);

  // Hip roof (rotation baked so scaling stays axis-aligned).
  const roofGeo = new ConeGeometry(Math.SQRT2 * 0.5, 1, 4);
  roofGeo.rotateY(Math.PI / 4);
  const hip = new Mesh(roofGeo, roof);
  hip.scale.set(23, 4.2, 17);
  hip.position.y = 12.6 + 2.1;
  hip.castShadow = true;
  g.add(hip);

  // Wrought-iron widow's-walk crest + weathervane.
  const crest = new Mesh(new BoxGeometry(14, 0.9, 0.12), iron);
  crest.position.y = 12.6 + 4.2;
  g.add(crest);
  const vanePole = new Mesh(new CylinderGeometry(0.05, 0.05, 2.2, 6), iron);
  vanePole.position.y = 12.6 + 5.2;
  g.add(vanePole);
  const vane = new Mesh(new BoxGeometry(1.2, 0.32, 0.06), iron);
  vane.position.y = 12.6 + 6.0;
  g.add(vane);

  // Brick chimneys.
  for (const cx of [-7.5, 7.5]) {
    const chimney = new Mesh(new BoxGeometry(1.4, 3.4, 1.4), brick);
    chimney.position.set(cx, 13.8, -3);
    chimney.castShadow = true;
    g.add(chimney);
  }

  // --- Central portico: 4 grand columns + entablature + PEDIMENT ---
  const entablature = new Mesh(new BoxGeometry(11.5, 1.2, 4.8), white);
  entablature.position.set(0, 11.0, 9.4);
  entablature.castShadow = true;
  g.add(entablature);
  for (let i = 0; i < 4; i++) {
    const cx = -4.2 + i * 2.8;
    const column = new Mesh(new CylinderGeometry(0.42, 0.5, 10.0, 12), white);
    column.position.set(cx, 5.4, 10.0);
    column.castShadow = true;
    g.add(column);
    const capital = new Mesh(new BoxGeometry(1.15, 0.45, 1.15), white);
    capital.position.set(cx, 10.4, 10.0);
    g.add(capital);
  }
  // Triangular pediment (flattened 4-cone reads as the gable).
  const pedimentGeo = new ConeGeometry(Math.SQRT2 * 0.5, 1, 4);
  pedimentGeo.rotateY(Math.PI / 4);
  const pediment = new Mesh(pedimentGeo, white);
  pediment.scale.set(12.4, 2.6, 4.6);
  pediment.position.set(0, 12.9, 9.4);
  pediment.castShadow = true;
  g.add(pediment);
  // Fan window in the pediment face.
  const fan = new Mesh(new CylinderGeometry(0.9, 0.9, 0.14, 12, 1, false, 0, Math.PI), ghostGlow);
  fan.rotation.x = Math.PI / 2;
  fan.position.set(0, 12.2, 11.15);
  g.add(fan);

  // --- Two-story sage-iron verandas flanking the portico ---
  for (const side of [-1, 1]) {
    for (const level of [0, 1]) {
      const deckY = level === 0 ? 4.6 : 9.2;
      // Veranda deck slab.
      const deck = new Mesh(new BoxGeometry(7.6, 0.3, 3.4), white);
      deck.position.set(side * 7.2, deckY, 9.0);
      deck.castShadow = true;
      g.add(deck);
      // Filigree rail: a low, half-transparent-reading lattice band.
      const rail = new Mesh(new BoxGeometry(7.4, 1.0, 0.12), sage);
      rail.position.set(side * 7.2, deckY + 0.85, 10.6);
      g.add(rail);
      // Slender iron posts with a decorative mid-band.
      for (const px of [-3.4, -1.1, 1.1, 3.4]) {
        const post = new Mesh(new CylinderGeometry(0.09, 0.09, 4.4, 6), sage);
        post.position.set(side * 7.2 + px, deckY + 2.2, 10.5);
        g.add(post);
      }
      // Filigree frieze hanging below the deck above.
      const frieze = new Mesh(new BoxGeometry(7.4, 0.7, 0.1), sage);
      frieze.position.set(side * 7.2, deckY + 4.0, 10.5);
      g.add(frieze);
    }
  }

  // Windows: two stories with dark-green shutters, ghost-glow at night.
  for (const wx of [-9.4, -6.4, -3.4, 3.4, 6.4, 9.4]) {
    for (const wy of [4.4, 9.0]) {
      const win = new Mesh(new BoxGeometry(1.25, 2.1, 0.15), ghostGlow);
      win.position.set(wx, wy, 8.06);
      g.add(win);
      for (const s of [-1, 1]) {
        const sh = new Mesh(new BoxGeometry(0.5, 2.1, 0.1), shutter);
        sh.position.set(wx + s * 0.95, wy, 8.05);
        g.add(sh);
      }
    }
  }
  // Front door beneath the portico.
  const door = new Mesh(new BoxGeometry(2.4, 3.6, 0.2), shutter);
  door.position.set(0, 2.4, 8.06);
  g.add(door);
  // Brick entry steps.
  const steps = new Mesh(new BoxGeometry(6, 0.9, 3), brick);
  steps.position.set(0, 0.45, 10.6);
  g.add(steps);

  g.position.set(x, 0, z);
  scene.add(g);
}
