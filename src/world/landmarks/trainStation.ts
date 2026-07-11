import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from "three";
import { registerEmissive } from "../../engine/emissive";

/**
 * Main Street Station — Victorian depot on the berm at the park entrance.
 * Red brick base, cream upper story, dark hipped roofs, central clock
 * tower. Faces north (−Z, toward Town Square).
 */

/** 4-sided pyramid aligned to world axes (rotation baked, safe to scale). */
function hipRoofGeometry(halfWidth: number, height: number): ConeGeometry {
  const geo = new ConeGeometry(halfWidth * Math.SQRT2, height, 4);
  geo.rotateY(Math.PI / 4);
  return geo;
}

export function buildTrainStation(scene: Scene, x: number, z: number): void {
  const station = new Group();

  const brick = new MeshStandardMaterial({ color: 0xa8524a, roughness: 0.95 });
  const creamWall = new MeshStandardMaterial({ color: 0xf0e2cc, roughness: 0.9 });
  const roof = new MeshStandardMaterial({ color: 0x555061, roughness: 0.7 });
  const berm = new MeshStandardMaterial({ color: 0x71975a, roughness: 1 });

  const glow = new MeshStandardMaterial({
    color: 0x5a6a78,
    emissive: new Color(0xffcf80),
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  registerEmissive(glow, 2.6);

  const BASE = 2.4; // mound top — station floor level

  // Grass berm mound.
  const mound = new Mesh(new BoxGeometry(48, BASE, 16), berm);
  mound.position.y = BASE / 2;
  mound.receiveShadow = true;
  station.add(mound);

  // Main hall (brick) + cream upper story.
  const hall = new Mesh(new BoxGeometry(24, 6, 9), brick);
  hall.position.y = BASE + 3;
  hall.castShadow = true;
  station.add(hall);

  const upper = new Mesh(new BoxGeometry(19, 3, 7), creamWall);
  upper.position.y = BASE + 6 + 1.5;
  upper.castShadow = true;
  station.add(upper);

  const mainRoof = new Mesh(hipRoofGeometry(1, 3.2), roof);
  mainRoof.scale.set(10.5, 1, 4);
  mainRoof.position.y = BASE + 9 + 1.6;
  mainRoof.castShadow = true;
  station.add(mainRoof);

  // Clock tower.
  const towerShaft = new Mesh(new BoxGeometry(3.6, 7, 3.6), creamWall);
  towerShaft.position.y = BASE + 9 + 3.5;
  towerShaft.castShadow = true;
  station.add(towerShaft);

  const clock = new Mesh(new CylinderGeometry(1.0, 1.0, 0.2, 16), glow);
  clock.rotation.x = Math.PI / 2;
  clock.position.set(0, BASE + 9 + 4.8, -1.85);
  station.add(clock);

  const towerRoof = new Mesh(hipRoofGeometry(1, 3.0), roof);
  towerRoof.scale.set(2.4, 1, 2.4);
  towerRoof.position.y = BASE + 9 + 7 + 1.5;
  towerRoof.castShadow = true;
  station.add(towerRoof);

  // Side wings.
  for (const side of [-1, 1]) {
    const wing = new Mesh(new BoxGeometry(9, 4.5, 8), brick);
    wing.position.set(side * 16, BASE + 2.25, 0);
    wing.castShadow = true;
    station.add(wing);
    const wingRoof = new Mesh(hipRoofGeometry(1, 2.4), roof);
    wingRoof.scale.set(5.2, 1, 4.6);
    wingRoof.position.set(side * 16, BASE + 4.5 + 1.2, 0);
    wingRoof.castShadow = true;
    station.add(wingRoof);
  }

  // Victorian gingerbread: white trim strips under every eave line.
  const trim = new MeshStandardMaterial({ color: 0xfaf6ec, roughness: 0.8 });
  for (const [w, y, d] of [
    [24.4, BASE + 6, 9.4],
    [19.4, BASE + 9, 7.4],
    [4.0, BASE + 16, 4.0],
  ] as const) {
    const band = new Mesh(new BoxGeometry(w, 0.35, d), trim);
    band.position.y = y;
    station.add(band);
  }
  for (const side of [-1, 1]) {
    const wingBand = new Mesh(new BoxGeometry(9.4, 0.3, 8.4), trim);
    wingBand.position.set(side * 16, BASE + 4.5, 0);
    station.add(wingBand);
  }

  // Platform canopy toward the square + lit windows along the front.
  const canopy = new Mesh(new BoxGeometry(26, 0.3, 3), roof);
  canopy.position.set(0, BASE + 3.6, -6);
  station.add(canopy);
  for (let i = -2; i <= 2; i++) {
    const win = new Mesh(new BoxGeometry(1.1, 1.7, 0.1), glow);
    win.position.set(i * 4.2, BASE + 2.6, -4.56);
    station.add(win);
  }

  station.position.set(x, 0, z);
  scene.add(station);
}
