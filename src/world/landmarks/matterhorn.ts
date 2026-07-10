import { ConeGeometry, Mesh, MeshStandardMaterial, Scene } from "three";
import { mulberry32 } from "../../engine/random";

/**
 * The Matterhorn — craggy snow-capped peak, tallest silhouette in
 * Fantasyland. A cone with seeded radial jitter for crags (flat-shaded),
 * plus a clean snow cap.
 */
export function buildMatterhorn(scene: Scene, x: number, z: number): void {
  const rng = mulberry32(107280556);

  const rock = new ConeGeometry(24, 52, 11, 7);
  const pos = rock.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 24 || y < -25.5) continue; // keep apex + base rings clean
    const jitter = 0.78 + rng() * 0.38;
    pos.setX(i, pos.getX(i) * jitter);
    pos.setZ(i, pos.getZ(i) * jitter);
    pos.setY(i, y + (rng() - 0.5) * 3.5);
  }
  rock.computeVertexNormals();

  const mountain = new Mesh(
    rock,
    new MeshStandardMaterial({ color: 0x9aa2b0, roughness: 0.95, flatShading: true }),
  );
  mountain.position.set(x, 26, z);
  mountain.castShadow = true;
  mountain.receiveShadow = true;
  scene.add(mountain);

  const snow = new Mesh(
    new ConeGeometry(11, 18, 11, 3),
    new MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.8, flatShading: true }),
  );
  snow.position.set(x, 52 - 8, z);
  snow.castShadow = true;
  scene.add(snow);
}
