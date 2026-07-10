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
  TorusGeometry,
} from "three";
import { registerEmissive } from "../../engine/emissive";

/**
 * Sleeping Beauty Castle — the park's visual anchor. Bespoke stylized mesh:
 * grey stone gatehouse base, pink upper keeps, blue conical roofs stepping
 * up to a tall central spire, gold trim that glows at night. Faces south
 * (+Z) down Main Street. Position from the OSM footprint centroid.
 */

const STONE = 0x9a8f96;
const PINK = 0xe3b6c6;
const PINK_DEEP = 0xd6a2b8;
const CREAM = 0xf2e4d8;
const ROOF_BLUE = 0x3d5aa8;
const ROOF_BLUE_DEEP = 0x32488c;

export function buildCastle(scene: Scene, x: number, z: number): void {
  const castle = new Group();

  // Walls carry a faint self-emissive tint that rises at night — reads as
  // floodlighting without any real lights (the castle must not go black).
  const floodlit = (color: number, glowColor: number): MeshStandardMaterial => {
    const m = new MeshStandardMaterial({
      color,
      roughness: 0.9,
      emissive: new Color(glowColor),
      emissiveIntensity: 0,
    });
    registerEmissive(m, 0.32);
    return m;
  };
  const stone = floodlit(STONE, 0xb08cc8);
  const pink = floodlit(PINK, 0xe8a0b8);
  const pinkDeep = floodlit(PINK_DEEP, 0xd890b0);
  const cream = floodlit(CREAM, 0xe8c8a8);
  const roof = new MeshStandardMaterial({
    color: ROOF_BLUE,
    roughness: 0.55,
    emissive: new Color(0x4a68c8),
    emissiveIntensity: 0,
  });
  registerEmissive(roof, 0.22);
  const roofDeep = new MeshStandardMaterial({
    color: ROOF_BLUE_DEEP,
    roughness: 0.55,
    emissive: new Color(0x3a54a8),
    emissiveIntensity: 0,
  });
  registerEmissive(roofDeep, 0.22);

  const gold = new MeshStandardMaterial({
    color: 0x8a6a20,
    emissive: new Color(0xffd980),
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.4,
  });
  registerEmissive(gold, 2.2, 0.25);

  const windowGlow = new MeshStandardMaterial({
    color: 0x2a2438,
    emissive: new Color(0xffd28a),
    emissiveIntensity: 0,
    roughness: 0.35,
  });
  registerEmissive(windowGlow, 2.8);

  const tower = (
    tx: number,
    tz: number,
    radius: number,
    height: number,
    roofMat: MeshStandardMaterial,
    body: MeshStandardMaterial,
  ): void => {
    const shaft = new Mesh(new CylinderGeometry(radius, radius * 1.12, height, 12), body);
    shaft.position.set(tx, height / 2, tz);
    shaft.castShadow = true;
    castle.add(shaft);

    const cap = new Mesh(new ConeGeometry(radius * 1.35, radius * 3.4, 12), roofMat);
    cap.position.set(tx, height + radius * 1.7, tz);
    cap.castShadow = true;
    castle.add(cap);

    const ring = new Mesh(new TorusGeometry(radius * 1.02, 0.09, 6, 16), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(tx, height - 0.25, tz);
    castle.add(ring);

    const finial = new Mesh(new SphereGeometry(0.22, 8, 8), gold);
    finial.position.set(tx, height + radius * 3.4, tz);
    castle.add(finial);

    // A lit window near the top of the shaft.
    const win = new Mesh(new BoxGeometry(0.5, 0.9, 0.1), windowGlow);
    win.position.set(tx, height * 0.72, tz + radius + 0.02);
    castle.add(win);
  };

  // --- Stone gatehouse base (front faces +Z / the hub) ---
  const gate = new Mesh(new BoxGeometry(16, 9, 9), stone);
  gate.position.set(0, 4.5, 6);
  gate.castShadow = true;
  gate.receiveShadow = true;
  castle.add(gate);

  // Arched entry suggestion: dark inset portal.
  const portal = new Mesh(
    new BoxGeometry(4.2, 6, 0.6),
    new MeshStandardMaterial({ color: 0x1c1824, roughness: 1 }),
  );
  portal.position.set(0, 3, 10.6);
  castle.add(portal);

  tower(-8.5, 8, 1.9, 10, roof, stone);
  tower(8.5, 8, 1.9, 10, roof, stone);

  // --- Middle pink tier ---
  const mid = new Mesh(new BoxGeometry(12, 8, 9), pink);
  mid.position.set(0, 12, 0);
  mid.castShadow = true;
  castle.add(mid);

  const midGable = new Mesh(new ConeGeometry(4.6, 3.6, 4), roofDeep);
  midGable.rotation.y = Math.PI / 4;
  midGable.position.set(0, 17.8, 0);
  midGable.castShadow = true;
  castle.add(midGable);

  tower(-6, -1, 1.6, 17, roofDeep, pinkDeep);
  tower(6, -1, 1.6, 17, roofDeep, pinkDeep);
  tower(-4.2, 5.2, 1.15, 13.5, roof, cream);
  tower(4.2, 5.2, 1.15, 13.5, roof, cream);

  // --- Rear keep + central spire ---
  const keep = new Mesh(new BoxGeometry(9, 13, 7), pinkDeep);
  keep.position.set(0, 10.5, -5.5);
  keep.castShadow = true;
  castle.add(keep);

  tower(0, -5.5, 2.1, 24, roofDeep, pink); // the tall signature spire
  tower(-2.6, -7.5, 1.0, 19, roof, cream);
  tower(2.6, -7.5, 1.0, 19, roof, cream);

  // Front lit windows on the mid tier.
  for (const wx of [-3.4, 0, 3.4]) {
    const win = new Mesh(new BoxGeometry(0.7, 1.3, 0.1), windowGlow);
    win.position.set(wx, 13, 4.56);
    castle.add(win);
  }

  castle.scale.setScalar(1.15); // visual-anchor presence from the hub
  castle.position.set(x, 0, z);
  scene.add(castle);
}
