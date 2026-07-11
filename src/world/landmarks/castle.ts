import {
  BoxGeometry,
  Color,
  ConeGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from "three";
import { registerEmissive } from "../../engine/emissive";
import { registerUpdatable } from "../../engine/updatables";
import { stainedGlassTexture } from "../textures";

/**
 * Sleeping Beauty Castle v2 — the park's anchor, rebuilt for recognizability:
 * stone gatehouse with a TRUE pointed-arch walk-through tunnel, crenellated
 * parapets (instanced merlons), swept lathe turrets with corbel flares under
 * blue cone roofs, gold trim + finials, a stained-glass rose window, and
 * pennant flags that wave. Faces south (+Z) down Main Street.
 *
 * Collision contract with walkable.ts: the walk-through corridor is local
 * x −2.25..2.25 (world 3.2..8.4 after the 1.15 group scale) — the arch
 * opening below matches it exactly. Keep the group position/scale fixed.
 */

const STONE = 0x8f9aac;
const PINK = 0xeabccd;
const PINK_DEEP = 0xd6a2b8;
const CREAM = 0xf2e4d8;
const ROOF_BLUE = 0x2f55c2;
const ROOF_BLUE_DEEP = 0x2743a0;

export function buildCastle(scene: Scene, x: number, z: number): void {
  const castle = new Group();

  // Walls carry a faint self-emissive tint that rises at night — reads as
  // floodlighting without any real lights (the castle must not go black).
  const floodlit = (color: number, glowColor: number, rough = 0.9): MeshStandardMaterial => {
    const m = new MeshStandardMaterial({
      color,
      roughness: rough,
      emissive: new Color(glowColor),
      emissiveIntensity: 0,
    });
    registerEmissive(m, 0.32);
    return m;
  };
  const stone = floodlit(STONE, 0xb08cc8, 0.95);
  const pink = floodlit(PINK, 0xe8a0b8);
  const pinkDeep = floodlit(PINK_DEEP, 0xd890b0);
  const cream = floodlit(CREAM, 0xe8c8a8);
  const roof = floodlit(ROOF_BLUE, 0x4a68c8, 0.55);
  const roofDeep = floodlit(ROOF_BLUE_DEEP, 0x3a54a8, 0.55);

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

  // ---------------------------------------------------------------------
  // Gatehouse: one extruded wall with a real pointed-arch tunnel through it.
  // ---------------------------------------------------------------------
  const wallShape = new Shape();
  wallShape.moveTo(-8, 0);
  wallShape.lineTo(8, 0);
  wallShape.lineTo(8, 9);
  wallShape.lineTo(-8, 9);
  wallShape.closePath();
  const arch = new Path();
  arch.moveTo(-2.25, 0);
  arch.lineTo(-2.25, 3.4);
  arch.quadraticCurveTo(-2.25, 5.2, 0, 5.8); // left sweep to the point
  arch.quadraticCurveTo(2.25, 5.2, 2.25, 3.4); // right sweep back down
  arch.lineTo(2.25, 0);
  arch.closePath();
  wallShape.holes.push(arch);

  const gatehouse = new Mesh(
    new ExtrudeGeometry(wallShape, { depth: 9, bevelEnabled: false }),
    stone,
  );
  gatehouse.position.z = 1.5; // tunnel spans local z 1.5..10.5
  gatehouse.castShadow = true;
  gatehouse.receiveShadow = true;
  castle.add(gatehouse);

  // Arch trim: gold outline following the arch mouth on the front face.
  const trimShape = new Shape();
  trimShape.moveTo(-2.65, 0);
  trimShape.lineTo(-2.65, 3.5);
  trimShape.quadraticCurveTo(-2.65, 5.55, 0, 6.25);
  trimShape.quadraticCurveTo(2.65, 5.55, 2.65, 3.5);
  trimShape.lineTo(2.65, 0);
  trimShape.lineTo(2.25, 0);
  trimShape.lineTo(2.25, 3.4);
  trimShape.quadraticCurveTo(2.25, 5.2, 0, 5.8);
  trimShape.quadraticCurveTo(-2.25, 5.2, -2.25, 3.4);
  trimShape.lineTo(-2.25, 0);
  trimShape.closePath();
  const archTrim = new Mesh(new ShapeGeometry(trimShape), gold);
  archTrim.position.z = 10.52;
  castle.add(archTrim);

  // Crenellation merlons along the gatehouse parapet (front + back edges).
  const merlonSlots: [number, number, number][] = [];
  for (let mx = -7.5; mx <= 7.5; mx += 1.5) {
    merlonSlots.push([mx, 9.45, 10.15], [mx, 9.45, 1.85]);
  }
  // And along the mid-tier parapet.
  for (let mx = -5.6; mx <= 5.6; mx += 1.4) {
    merlonSlots.push([mx, 16.45, 4.15]);
  }
  const merlons = new InstancedMesh(new BoxGeometry(0.75, 0.9, 0.7), stone, merlonSlots.length);
  const mm = new Matrix4();
  merlonSlots.forEach((slot, i) => {
    mm.makeTranslation(slot[0], slot[1], slot[2]);
    merlons.setMatrixAt(i, mm);
  });
  merlons.castShadow = true;
  castle.add(merlons);

  // ---------------------------------------------------------------------
  // Turret builder: lathe with base flare + corbel flare, cone roof, gold.
  // ---------------------------------------------------------------------
  const turret = (
    tx: number,
    tz: number,
    radius: number,
    height: number,
    body: MeshStandardMaterial,
    cap: MeshStandardMaterial,
  ): void => {
    const profile = [
      new Vector2(radius * 1.14, 0),
      new Vector2(radius, height * 0.14),
      new Vector2(radius * 0.95, height * 0.7),
      new Vector2(radius * 1.18, height * 0.78),
      new Vector2(radius * 1.18, height * 0.86),
      new Vector2(radius * 1.04, height * 0.9),
      new Vector2(radius * 1.04, height),
    ];
    const shaft = new Mesh(new LatheGeometry(profile, 14), body);
    shaft.position.set(tx, 0, tz);
    shaft.castShadow = true;
    castle.add(shaft);

    const cone = new Mesh(new ConeGeometry(radius * 1.32, radius * 3.6, 14), cap);
    cone.position.set(tx, height + radius * 1.8, tz);
    cone.castShadow = true;
    castle.add(cone);

    const ring = new Mesh(new TorusGeometry(radius * 1.06, 0.09, 6, 18), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(tx, height * 0.88, tz);
    castle.add(ring);

    const finial = new Mesh(new SphereGeometry(0.2, 8, 8), gold);
    finial.position.set(tx, height + radius * 3.6, tz);
    castle.add(finial);

    const win = new Mesh(new BoxGeometry(0.45, 0.85, 0.1), windowGlow);
    win.position.set(tx, height * 0.62, tz + radius + 0.06);
    castle.add(win);
  };

  // Gate turrets flanking the arch.
  turret(-8, 8, 2.0, 11, stone, roof);
  turret(8, 8, 2.0, 11, stone, roof);

  // ---------------------------------------------------------------------
  // Mid pink tier with parapet + rose window.
  // ---------------------------------------------------------------------
  const mid = new Mesh(new BoxGeometry(12, 8, 9), pink);
  mid.position.set(0, 12, 0);
  mid.castShadow = true;
  castle.add(mid);

  const midGable = new Mesh(new ConeGeometry(4.6, 3.6, 4), roofDeep);
  midGable.rotation.y = Math.PI / 4;
  midGable.position.set(0, 17.8, 0);
  midGable.castShadow = true;
  castle.add(midGable);

  // Stained-glass rose window on the south face, framed in gold.
  const rose = new Mesh(
    new PlaneGeometry(2.7, 2.7),
    new MeshStandardMaterial({
      map: stainedGlassTexture(),
      emissive: new Color(0xffffff),
      emissiveMap: stainedGlassTexture(),
      emissiveIntensity: 0.15,
      roughness: 0.4,
    }),
  );
  registerEmissive(rose.material as MeshStandardMaterial, 1.4, 0.15);
  rose.position.set(0, 13.2, 4.56);
  castle.add(rose);
  const roseFrame = new Mesh(new TorusGeometry(1.55, 0.12, 6, 22), gold);
  roseFrame.position.set(0, 13.2, 4.55);
  castle.add(roseFrame);

  turret(-6, -1, 1.7, 17.5, pinkDeep, roofDeep);
  turret(6, -1, 1.7, 17.5, pinkDeep, roofDeep);
  turret(-4.2, 5.2, 1.15, 13.5, cream, roof);
  turret(4.2, 5.2, 1.15, 13.5, cream, roof);

  // ---------------------------------------------------------------------
  // Rear keep: twin towers + high bridge (corridor passes beneath).
  // ---------------------------------------------------------------------
  turret(-4, -5.5, 1.9, 13.5, pinkDeep, roofDeep);
  turret(4, -5.5, 1.9, 13.5, pinkDeep, roofDeep);
  const keepBridge = new Mesh(new BoxGeometry(4.5, 5, 7), pinkDeep);
  keepBridge.position.set(0, 14.5, -5.5);
  keepBridge.castShadow = true;
  castle.add(keepBridge);

  // Central signature spire + rear pair.
  turret(0, -5.5, 2.2, 24, pink, roofDeep);
  turret(-2.6, -7.5, 1.0, 19, cream, roof);
  turret(2.6, -7.5, 1.0, 19, cream, roof);

  // ---------------------------------------------------------------------
  // Pennant flags on the three tallest spires — waving via updatable.
  // ---------------------------------------------------------------------
  const flagMaterial = new MeshStandardMaterial({
    color: 0xd8b23a,
    roughness: 0.8,
    side: 2, // DoubleSide
  });
  const flags: Group[] = [];
  const addFlag = (fx: number, fz: number, fy: number): void => {
    const holder = new Group();
    const pole = new Mesh(new BoxGeometry(0.07, 1.6, 0.07), gold);
    pole.position.y = 0.8;
    holder.add(pole);
    const pennant = new Shape();
    pennant.moveTo(0, 0);
    pennant.lineTo(1.5, 0.28);
    pennant.lineTo(0, 0.56);
    pennant.closePath();
    const cloth = new Mesh(new ShapeGeometry(pennant), flagMaterial);
    cloth.position.set(0.05, 0.9, 0);
    holder.add(cloth);
    holder.position.set(fx, fy, fz);
    castle.add(holder);
    flags.push(holder);
  };
  addFlag(0, -5.5, 24 + 2.2 * 3.6 + 0.1); // central spire
  addFlag(-6, -1, 17.5 + 1.7 * 3.6 + 0.1);
  addFlag(6, -1, 17.5 + 1.7 * 3.6 + 0.1);
  registerUpdatable((_dt, time) => {
    flags.forEach((f, i) => {
      f.rotation.y = Math.sin(time * 2.2 + i * 1.7) * 0.45 + 0.2;
    });
  });

  castle.scale.setScalar(1.15); // visual-anchor presence from the hub
  castle.position.set(x, 0, z);
  scene.add(castle);
}
