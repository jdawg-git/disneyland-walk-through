import { Color, Mesh, MeshStandardMaterial, PlaneGeometry, Scene } from "three";
import { registerEmissive } from "../engine/emissive";
import { PARK_LAYOUT } from "../data/parkLayout";
import { flatPolygonGeometry } from "./shapeUtil";

/**
 * Ground layering (bottom to top, tiny y offsets to avoid z-fighting):
 *   earth plane (outside the berm) → park pavement (boundary polygon) →
 *   planter greens → water. The park floor is pavement-first because
 *   Disneyland is mostly paved; greens and water carve into it.
 */
export function buildTerrain(scene: Scene): void {
  const earth = new Mesh(
    new PlaneGeometry(2400, 2400),
    new MeshStandardMaterial({ color: 0x6f7a58, roughness: 1 }),
  );
  earth.rotation.x = -Math.PI / 2;
  earth.position.y = -0.05;
  earth.receiveShadow = true;
  scene.add(earth);

  const pavement = new Mesh(
    flatPolygonGeometry(PARK_LAYOUT.boundary),
    new MeshStandardMaterial({ color: 0xb5a894, roughness: 0.95 }),
  );
  pavement.receiveShadow = true;
  scene.add(pavement);

  const grassMaterial = new MeshStandardMaterial({ color: 0x6f9c4e, roughness: 1 });
  for (const g of PARK_LAYOUT.greens) {
    const mesh = new Mesh(flatPolygonGeometry(g.outer), grassMaterial);
    mesh.position.y = 0.04;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const waterMaterial = new MeshStandardMaterial({
    color: 0x3a6a9e,
    roughness: 0.25,
    metalness: 0.1,
    emissive: new Color(0x16304e),
    emissiveIntensity: 0,
  });
  registerEmissive(waterMaterial, 0.5); // faint moonlit sheen at night
  for (const w of PARK_LAYOUT.water) {
    const mesh = new Mesh(flatPolygonGeometry(w.outer, w.inner), waterMaterial);
    mesh.position.y = 0.08;
    scene.add(mesh);
  }
}
