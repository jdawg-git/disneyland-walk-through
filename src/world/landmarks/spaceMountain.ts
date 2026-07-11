import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { registerEmissive } from "../../engine/emissive";

/**
 * Space Mountain v2 — the white mountain of Tomorrowland. A lathe with the
 * real concave-sweep profile (steep summit flattening into a wide skirt),
 * wrapped by 12 exterior ribs that run from the peak down past the base
 * rim and kick up into the signature upswept tips. Cool emissive band at
 * the concourse line glows at night.
 *
 * Ground-level footprint stays radius ~30.5 — the collider circle (33.5)
 * in walkable.ts still matches.
 */

// Profile from base (y=0) to summit — (radius, height) pairs.
const PROFILE: readonly (readonly [number, number])[] = [
  [30.4, 0],
  [30.4, 4.5],
  [30.0, 6.2],
  [28.5, 8.2],
  [26.0, 10.8],
  [22.5, 14.0],
  [18.0, 17.5],
  [13.0, 21.0],
  [8.0, 24.0],
  [3.5, 26.2],
  [0.6, 27.2],
];

// Rib path — (radius, height) from near the summit down and out past the
// rim, ending in the upswept tip.
const RIB_PATH: readonly (readonly [number, number])[] = [
  [1.2, 26.9],
  [6, 25],
  [12, 22],
  [18, 18],
  [23.5, 14],
  [27.5, 10],
  [30.8, 7.2],
  [33.6, 6.2],
  [35.0, 7.2],
];

export function buildSpaceMountain(scene: Scene, x: number, z: number): void {
  const shell = new MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.45 });
  const ribMaterial = new MeshStandardMaterial({ color: 0xf4f6f9, roughness: 0.4, metalness: 0.1 });

  const dome = new Mesh(
    new LatheGeometry(
      PROFILE.map(([r, h]) => new Vector2(r, h)),
      36,
    ),
    shell,
  );
  dome.position.set(x, 0, z);
  dome.castShadow = true;
  dome.receiveShadow = true;
  scene.add(dome);

  // Twelve ribs, each a tube following the profile and kicking out at the base.
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const curve = new CatmullRomCurve3(
      RIB_PATH.map(([r, h]) => new Vector3(x + cos * r, h, z + sin * r)),
    );
    const rib = new Mesh(new TubeGeometry(curve, 28, 0.42, 6), ribMaterial);
    rib.castShadow = true;
    scene.add(rib);
  }

  // Summit needle.
  const needle = new Mesh(new ConeGeometry(0.9, 7, 10), ribMaterial);
  needle.position.set(x, 27.2 + 3.2, z);
  scene.add(needle);

  // Entrance portal facing the west walkway (toward the hub).
  const portal = new Mesh(
    new BoxGeometry(3.5, 5.2, 10),
    new MeshStandardMaterial({ color: 0x10141e, roughness: 1 }),
  );
  portal.position.set(x - 29.2, 2.6, z);
  scene.add(portal);

  // Concourse glow band — cool blue at night.
  const bandMaterial = new MeshStandardMaterial({
    color: 0x30506a,
    emissive: new Color(0x66d8ff),
    emissiveIntensity: 0.15,
    roughness: 0.4,
  });
  registerEmissive(bandMaterial, 1.8, 0.15);
  const band = new Mesh(new TorusGeometry(30.5, 0.4, 6, 48), bandMaterial);
  band.rotation.x = Math.PI / 2;
  band.position.set(x, 5.4, z);
  scene.add(band);
}
