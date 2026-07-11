import {
  BoxGeometry,
  Color,
  ConeGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Path,
  Scene,
  Shape,
} from "three";
import { registerEmissive } from "../../engine/emissive";

/**
 * Pirates of the Caribbean v2 — the New Orleans Square mansion with the
 * signature DOUBLE GALLERY: two stacked rows of real arched openings
 * (extruded walls with arch holes), iron-lace railings, a dormered mansard
 * roof, and warm lantern glow. Faces north (−Z, toward the promenade).
 *
 * Collider contract: box halfW 26 × halfD 7.5 at (−200.2, 190.5).
 */
export function buildPiratesFacade(scene: Scene, x: number, z: number): void {
  const g = new Group();

  const cream = new MeshStandardMaterial({
    color: 0xefd4c2,
    roughness: 0.9,
    emissive: new Color(0xffd8a8),
    emissiveIntensity: 0,
  });
  registerEmissive(cream, 0.22);
  const mansard = new MeshStandardMaterial({ color: 0x3f3a46, roughness: 0.7 });
  const iron = new MeshStandardMaterial({ color: 0x51637a, roughness: 0.6 });
  const interior = new MeshStandardMaterial({ color: 0x1a1410, roughness: 1 });

  const lantern = new MeshStandardMaterial({
    color: 0x4a3a20,
    emissive: new Color(0xffb85a),
    emissiveIntensity: 0.3,
    roughness: 0.5,
  });
  registerEmissive(lantern, 2.8, 0.3);

  // Gallery wall builder: a wall slab pierced by a row of round arches.
  const galleryWall = (width: number, height: number, arches: number): Mesh => {
    const shape = new Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, height);
    shape.lineTo(-width / 2, height);
    shape.closePath();
    const pitch = width / arches;
    for (let i = 0; i < arches; i++) {
      const cx = -width / 2 + pitch * (i + 0.5);
      const hw = pitch * 0.32;
      const arch = new Path();
      arch.moveTo(cx - hw, 0);
      arch.lineTo(cx - hw, height * 0.52);
      arch.absarc(cx, height * 0.52, hw, Math.PI, 0, true);
      arch.lineTo(cx + hw, 0);
      arch.closePath();
      shape.holes.push(arch);
    }
    return new Mesh(new ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false }), cream);
  };

  // Dark interior box behind the galleries.
  const core = new Mesh(new BoxGeometry(30, 11, 12), interior);
  core.position.set(0, 5.5, 1.5);
  g.add(core);

  // Ground gallery + upper gallery on the north face.
  const lower = galleryWall(30, 5.6, 7);
  lower.position.set(0, 0, -7.2);
  lower.castShadow = true;
  lower.receiveShadow = true;
  g.add(lower);
  const upper = galleryWall(30, 4.6, 7);
  upper.position.set(0, 5.6, -7.2);
  upper.castShadow = true;
  g.add(upper);

  // Gallery floor slab + iron-lace railing along the upper gallery.
  const slab = new Mesh(new BoxGeometry(30.4, 0.35, 1.6), cream);
  slab.position.set(0, 5.6, -6.9);
  g.add(slab);
  for (let i = 0; i < 29; i++) {
    const baluster = new Mesh(new BoxGeometry(0.09, 1.0, 0.09), iron);
    baluster.position.set(-14 + i * 1.0, 6.3, -7.6);
    g.add(baluster);
  }
  const handrail = new Mesh(new BoxGeometry(29.2, 0.14, 0.2), iron);
  handrail.position.set(0, 6.85, -7.6);
  g.add(handrail);

  // Flanking wings.
  for (const side of [-1, 1]) {
    const wing = new Mesh(new BoxGeometry(11, 8.5, 11), cream);
    wing.position.set(side * 20.5, 4.25, 0.5);
    wing.castShadow = true;
    g.add(wing);
    const wingRoofGeo = new ConeGeometry(Math.SQRT2 * 0.5, 1, 4);
    wingRoofGeo.rotateY(Math.PI / 4);
    const wingRoof = new Mesh(wingRoofGeo, mansard);
    wingRoof.scale.set(12, 4, 12);
    wingRoof.position.set(side * 20.5, 8.5 + 2, 0.5);
    wingRoof.castShadow = true;
    g.add(wingRoof);
  }

  // Dormered mansard over the main block.
  const roofGeo = new ConeGeometry(Math.SQRT2 * 0.5, 1, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new Mesh(roofGeo, mansard);
  roof.scale.set(31, 5.5, 13.5);
  roof.position.set(0, 10.2 + 2.75, 1.5);
  roof.castShadow = true;
  g.add(roof);
  for (const dx of [-9, -3, 3, 9]) {
    const dormer = new Mesh(new BoxGeometry(1.9, 1.8, 1.6), cream);
    dormer.position.set(dx, 12, -4.1);
    g.add(dormer);
  }

  // Hanging lanterns along the lower gallery.
  for (const lx of [-12, -4, 4, 12]) {
    const lamp = new Mesh(new BoxGeometry(0.5, 0.9, 0.5), lantern);
    lamp.position.set(lx, 4.4, -7.9);
    g.add(lamp);
  }

  g.position.set(x, 0, z);
  scene.add(g);
}
