import {
  BufferAttribute,
  BufferGeometry,
  Shape,
  ShapeGeometry,
  Path as ThreePath,
} from "three";
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

/**
 * Merge many flat polygon geometries into one draw call. Handles indexed
 * input (ShapeGeometry) by de-indexing; preserves position/normal/uv.
 * Hundreds of OSM plaza/green/water rings each cost a draw call otherwise.
 */
export function mergeFlatGeometries(geos: readonly BufferGeometry[]): BufferGeometry | null {
  if (geos.length === 0) return null;
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let vertexCount = 0;
  for (const g of parts) vertexCount += g.attributes.position?.count ?? 0;
  if (vertexCount === 0) return null;

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  let offset = 0;
  for (const g of parts) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    if (!pos) continue;
    positions.set(pos.array as Float32Array, offset * 3);
    if (nor) normals.set(nor.array as Float32Array, offset * 3);
    if (uv) uvs.set(uv.array as Float32Array, offset * 2);
    offset += pos.count;
  }
  const merged = new BufferGeometry();
  merged.setAttribute("position", new BufferAttribute(positions, 3));
  merged.setAttribute("normal", new BufferAttribute(normals, 3));
  merged.setAttribute("uv", new BufferAttribute(uvs, 2));
  return merged;
}
