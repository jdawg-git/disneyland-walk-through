import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { registerEmissive } from "../engine/emissive";
import { registerUpdatable } from "../engine/updatables";
import { LANDS, landAt } from "../config/lands";
import { PARK_LAYOUT, pointInPolygon, polygonCentroid } from "../data/parkLayout";
import { rippleTexture } from "./textures";
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

  // Per-land ground tint (Main Street red concrete, Tomorrowland cool
  // concrete, …) with the real OSM plaza surfaces rendered slightly
  // lighter on top — the walkway layout finally reads as designed streets.
  const plazaMaterials = new Map<string, MeshStandardMaterial>();
  const white = new Color(0xffffff);
  for (const land of LANDS) {
    const groundMesh = new Mesh(
      flatPolygonGeometry(land.polygon),
      new MeshStandardMaterial({ color: land.ground, roughness: 0.98 }),
    );
    groundMesh.position.y = 0.015;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const plazaColor = new Color(land.ground).lerp(white, 0.16);
    plazaMaterials.set(
      land.id,
      new MeshStandardMaterial({ color: plazaColor, roughness: 0.92 }),
    );
  }
  const defaultPlazaMaterial = new MeshStandardMaterial({ color: 0xc4b8a4, roughness: 0.92 });
  for (const plaza of PARK_LAYOUT.plazas) {
    const c = polygonCentroid(plaza.outer);
    const land = landAt(c[0], c[1]);
    const mesh = new Mesh(
      flatPolygonGeometry(plaza.outer),
      (land && plazaMaterials.get(land.id)) ?? defaultPlazaMaterial,
    );
    mesh.position.y = 0.03;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const grassMaterial = new MeshStandardMaterial({ color: 0x6f9c4e, roughness: 1 });
  for (const g of PARK_LAYOUT.greens) {
    const mesh = new Mesh(flatPolygonGeometry(g.outer), grassMaterial);
    mesh.position.y = 0.045;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Water with a slow scrolling ripple sheen.
  const waterMaterial = new MeshStandardMaterial({
    color: 0x3a6a9e,
    roughness: 0.25,
    metalness: 0.1,
    map: rippleTexture(),
    emissive: new Color(0x16304e),
    emissiveIntensity: 0,
  });
  registerEmissive(waterMaterial, 0.5); // faint moonlit sheen at night
  const ripple = waterMaterial.map;
  if (ripple) {
    ripple.repeat.set(0.045, 0.045);
    registerUpdatable((dt) => {
      ripple.offset.x += dt * 0.012;
      ripple.offset.y += dt * 0.008;
    });
  }
  for (const w of PARK_LAYOUT.water) {
    const mesh = new Mesh(flatPolygonGeometry(w.outer, w.inner), waterMaterial);
    mesh.position.y = 0.08;
    scene.add(mesh);
  }

  buildBridgeDecks(scene);
}

/**
 * Wooden decks wherever a real walkway crosses water, so bridges read as
 * bridges instead of walking on the water plane. One instanced unit box,
 * stretched per crossing segment.
 */
function buildBridgeDecks(scene: Scene): void {
  interface Deck {
    readonly mid: Vector3;
    readonly yaw: number;
    readonly length: number;
  }
  const decks: Deck[] = [];
  const overWater = (x: number, z: number): boolean =>
    PARK_LAYOUT.water.some((w) => pointInPolygon(x, z, w.outer));

  for (const path of PARK_LAYOUT.paths) {
    if (path.kind !== "footway" && path.kind !== "pedestrian" && path.kind !== "steps") continue;
    for (let i = 0; i < path.points.length - 1; i++) {
      const a = path.points[i];
      const b = path.points[i + 1];
      if (!a || !b) continue;
      const midX = (a[0] + b[0]) / 2;
      const midZ = (a[1] + b[1]) / 2;
      if (!overWater(midX, midZ) && !overWater(a[0], a[1]) && !overWater(b[0], b[1])) continue;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const length = Math.hypot(dx, dz);
      if (length < 0.5) continue;
      decks.push({
        mid: new Vector3(midX, 0.14, midZ),
        yaw: Math.atan2(-dz, dx), // unit-x box aligned along the segment
        length: length + 1.2, // overlap onto both banks
      });
    }
  }
  if (decks.length === 0) return;

  const deckMaterial = new MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 });
  const mesh = new InstancedMesh(new BoxGeometry(1, 0.12, 3.4), deckMaterial, decks.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const scale = new Vector3();
  decks.forEach((d, i) => {
    q.setFromAxisAngle(up, d.yaw);
    scale.set(d.length, 1, 1);
    m.compose(d.mid, q, scale);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
