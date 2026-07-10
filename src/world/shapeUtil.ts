import { Shape, ShapeGeometry, Path as ThreePath } from "three";
import type { Pt } from "../data/parkLayout";

/**
 * Convert an [x, z] polygon to a THREE.Shape. Shapes live in the XY plane;
 * meshes built from them are rotated -90° about X (y → -z), so shape.y must
 * be -z for world geometry to land at the right z.
 */
export function polygonToShape(outer: readonly Pt[], inner?: readonly (readonly Pt[])[]): Shape {
  const shape = new Shape();
  outer.forEach((p, i) => {
    if (i === 0) shape.moveTo(p[0], -p[1]);
    else shape.lineTo(p[0], -p[1]);
  });
  shape.closePath();
  if (inner) {
    for (const ring of inner) {
      const hole = new ThreePath();
      ring.forEach((p, i) => {
        if (i === 0) hole.moveTo(p[0], -p[1]);
        else hole.lineTo(p[0], -p[1]);
      });
      hole.closePath();
      shape.holes.push(hole);
    }
  }
  return shape;
}

/** Flat ground-plane geometry from an [x, z] polygon (already rotated). */
export function flatPolygonGeometry(
  outer: readonly Pt[],
  inner?: readonly (readonly Pt[])[],
): ShapeGeometry {
  const geo = new ShapeGeometry(polygonToShape(outer, inner));
  geo.rotateX(-Math.PI / 2);
  return geo;
}
