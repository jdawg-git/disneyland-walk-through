import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { registerEmissive } from "../../engine/emissive";

/**
 * Space Mountain — the white ribbed dome of Tomorrowland. Squashed
 * hemisphere + radial rib cones + a base concourse ring with a cool
 * emissive band at night.
 */
export function buildSpaceMountain(scene: Scene, x: number, z: number): void {
  const white = new MeshStandardMaterial({ color: 0xe6eaf0, roughness: 0.55 });
  const rib = new MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.5 });

  const dome = new Mesh(new SphereGeometry(30, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), white);
  dome.scale.set(1, 0.72, 1);
  dome.position.set(x, 6, z);
  dome.castShadow = true;
  scene.add(dome);

  // Radial ribs from apex over the shell.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spoke = new Mesh(new ConeGeometry(0.8, 32, 6), rib);
    spoke.position.set(x + Math.cos(a) * 15, 6 + 16.5, z + Math.sin(a) * 15);
    spoke.rotation.z = Math.cos(a) * 1.05;
    spoke.rotation.x = -Math.sin(a) * 1.05;
    spoke.castShadow = true;
    scene.add(spoke);
  }

  const spire = new Mesh(new ConeGeometry(1.1, 10, 8), rib);
  spire.position.set(x, 6 + 22 + 4, z);
  scene.add(spire);

  // Concourse base + night glow band.
  const base = new Mesh(new CylinderGeometry(31, 32, 7, 24), white);
  base.position.set(x, 3.5, z);
  base.receiveShadow = true;
  scene.add(base);

  const bandMaterial = new MeshStandardMaterial({
    color: 0x30506a,
    emissive: new Color(0x66d8ff),
    emissiveIntensity: 0.15,
    roughness: 0.4,
  });
  registerEmissive(bandMaterial, 1.8, 0.15);
  const band = new Mesh(new TorusGeometry(31.2, 0.5, 6, 40), bandMaterial);
  band.rotation.x = Math.PI / 2;
  band.position.set(x, 7.2, z);
  scene.add(band);
}
