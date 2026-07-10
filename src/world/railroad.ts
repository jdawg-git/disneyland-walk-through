import { BoxGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Scene, Vector3 } from "three";
import { PARK_LAYOUT } from "../data/parkLayout";

/**
 * The berm + Disneyland Railroad loop — the park's visual outer edge.
 * Each track polyline segment becomes an instanced berm block (grass
 * embankment) with a darker track cap on top. The *collision* boundary is
 * the park polygon in the walkable grid; this is the matching visual wall.
 */
export function buildRailroad(scene: Scene): void {
  const segments: { mid: Vector3; yaw: number; length: number }[] = [];

  for (const rail of PARK_LAYOUT.railroad) {
    if (rail.name !== "Disneyland Railroad") continue;
    const pts = rail.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (!a || !b) continue;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const length = Math.hypot(dx, dz);
      if (length < 0.5) continue;
      segments.push({
        mid: new Vector3((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2),
        yaw: Math.atan2(dx, dz),
        length: length + 0.6, // slight overlap hides joints on curves
      });
    }
  }
  if (segments.length === 0) return;

  const bermMaterial = new MeshStandardMaterial({ color: 0x6d905a, roughness: 1 });
  const trackMaterial = new MeshStandardMaterial({ color: 0x4a4038, roughness: 0.8 });

  const berms = new InstancedMesh(new BoxGeometry(1, 2.6, 7), bermMaterial, segments.length);
  const tracks = new InstancedMesh(new BoxGeometry(1, 0.3, 2.2), trackMaterial, segments.length);

  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const scale = new Vector3();
  const pos = new Vector3();
  segments.forEach((s, i) => {
    // Unit-x box stretched to segment length, yawed to follow the track.
    q.setFromAxisAngle(up, s.yaw - Math.PI / 2);
    scale.set(s.length, 1, 1);
    pos.copy(s.mid).setY(1.3);
    m.compose(pos, q, scale);
    berms.setMatrixAt(i, m);
    pos.copy(s.mid).setY(2.6 + 0.15);
    m.compose(pos, q, scale);
    tracks.setMatrixAt(i, m);
  });
  berms.instanceMatrix.needsUpdate = true;
  tracks.instanceMatrix.needsUpdate = true;
  berms.castShadow = true;
  berms.receiveShadow = true;
  scene.add(berms, tracks);
}
