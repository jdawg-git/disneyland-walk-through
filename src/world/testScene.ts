import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from "three";
import { registerEmissive } from "../engine/emissive";
import { mulberry32, type Rng } from "../engine/random";

/**
 * STAGE 1 ONLY — a throwaway lighting calibration scene: ground plane, a few
 * building-scale boxes with emissive windows, and lamp posts. It exists so
 * day/night, shadows, bloom, and AO can be tuned before real park geometry
 * arrives in stage 2. Replaced by world/parkBuilder in the vertical slice.
 */
export function buildTestScene(scene: Scene, seed: number): void {
  const rng = mulberry32(seed);

  const ground = new Mesh(
    new PlaneGeometry(600, 600),
    new MeshStandardMaterial({ color: 0x9aa08b, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const windowMaterial = new MeshStandardMaterial({
    color: 0x1c2230,
    emissive: new Color(0xffc266),
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  registerEmissive(windowMaterial, 2.6);

  const palettes = [0xc9695a, 0xd9a066, 0x8fae6a, 0x7a93b8, 0xb886a8];
  const buildings = new Group();
  for (let i = 0; i < 14; i++) {
    const w = 8 + rng() * 10;
    const h = 7 + rng() * 9;
    const d = 8 + rng() * 8;
    const colorIndex = Math.floor(rng() * palettes.length);
    const body = new Mesh(
      new BoxGeometry(w, h, d),
      new MeshStandardMaterial({ color: palettes[colorIndex] ?? 0xc9695a, roughness: 0.9 }),
    );
    const x = (rng() - 0.5) * 180;
    const z = -20 - rng() * 160;
    body.position.set(x, h / 2, z);
    body.castShadow = true;
    body.receiveShadow = true;
    buildings.add(body);

    // Emissive window quads on the front face — what bloom feeds on at night.
    const rows = Math.max(1, Math.floor(h / 3.4));
    const cols = Math.max(2, Math.floor(w / 2.6));
    const windows = new InstancedMesh(new PlaneGeometry(1.1, 1.5), windowMaterial, rows * cols);
    const m = new Matrix4();
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x - w / 2 + (c + 0.5) * (w / cols);
        const wy = 1.8 + r * 3.4;
        m.makeTranslation(wx, wy, z + d / 2 + 0.02);
        windows.setMatrixAt(idx++, m);
      }
    }
    buildings.add(windows);
  }
  scene.add(buildings);

  // Lamp posts lining a "street" up the middle.
  const postMaterial = new MeshStandardMaterial({ color: 0x2e3138, roughness: 0.7 });
  const globeMaterial = new MeshStandardMaterial({
    color: 0x2a2418,
    emissive: new Color(0xffe0a3),
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  registerEmissive(globeMaterial, 3.2);
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -6 : 6;
    const lamp = new Group();
    const post = new Mesh(new CylinderGeometry(0.09, 0.12, 3.4, 8), postMaterial);
    post.position.y = 1.7;
    post.castShadow = true;
    const globe = new Mesh(new ConeGeometry(0.35, 0.6, 10), globeMaterial);
    globe.position.y = 3.6;
    lamp.add(post, globe);
    lamp.position.set(side, 0, -12 - Math.floor(i / 2) * 22);
    scene.add(lamp);
  }

  // A castle-ish landmark placeholder to frame the street.
  const castle = new Group();
  const castleMaterial = new MeshStandardMaterial({ color: 0xd8c5da, roughness: 0.85 });
  const roofMaterial = new MeshStandardMaterial({ color: 0x4a5fa8, roughness: 0.6 });
  const keep = new Mesh(new BoxGeometry(16, 14, 12), castleMaterial);
  keep.position.y = 7;
  keep.castShadow = true;
  castle.add(keep);
  addTower(castle, castleMaterial, roofMaterial, -9, 0, 11, rngHeight(rng));
  addTower(castle, castleMaterial, roofMaterial, 9, 0, 11, rngHeight(rng));
  addTower(castle, castleMaterial, roofMaterial, 0, -7, 18, 22);
  castle.position.set(0, 0, -150);
  scene.add(castle);
}

function rngHeight(rng: Rng): number {
  return 14 + rng() * 4;
}

function addTower(
  parent: Group,
  wall: MeshStandardMaterial,
  roof: MeshStandardMaterial,
  x: number,
  z: number,
  _offset: number,
  height: number,
): void {
  const tower = new Mesh(new CylinderGeometry(2.2, 2.5, height, 12), wall);
  tower.position.set(x, height / 2, z);
  tower.castShadow = true;
  const cap = new Mesh(new ConeGeometry(2.9, 5, 12), roof);
  cap.position.set(x, height + 2.5, z);
  cap.castShadow = true;
  parent.add(tower, cap);
}
