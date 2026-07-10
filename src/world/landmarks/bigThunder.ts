import { ConeGeometry, Mesh, MeshStandardMaterial, Scene } from "three";
import { mulberry32 } from "../../engine/random";

/**
 * Big Thunder Mountain — cluster of red-rock buttes over the ride's
 * footprint. Jittered flat-shaded cones in Bryce-Canyon orange.
 */
export function buildBigThunder(scene: Scene, x: number, z: number): void {
  const rng = mulberry32(266074156);
  const rockMaterial = new MeshStandardMaterial({
    color: 0xb4643c,
    roughness: 1,
    flatShading: true,
  });
  const capMaterial = new MeshStandardMaterial({
    color: 0xc8825a,
    roughness: 1,
    flatShading: true,
  });

  const buttes: readonly (readonly [number, number, number, number])[] = [
    // [dx, dz, radius, height]
    [0, 0, 16, 30],
    [-18, 12, 11, 20],
    [14, -14, 12, 24],
    [18, 10, 8, 14],
    [-12, -18, 8, 16],
  ];

  for (const [dx, dz, radius, height] of buttes) {
    const geo = new ConeGeometry(radius, height, 8, 4);
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > height / 2 - 1 || y < -height / 2 + 0.5) continue;
      const jitter = 0.7 + rng() * 0.55;
      pos.setX(i, pos.getX(i) * jitter);
      pos.setZ(i, pos.getZ(i) * jitter);
    }
    geo.computeVertexNormals();
    const butte = new Mesh(geo, rng() > 0.5 ? rockMaterial : capMaterial);
    butte.position.set(x + dx, height / 2, z + dz);
    butte.castShadow = true;
    butte.receiveShadow = true;
    scene.add(butte);
  }
}
