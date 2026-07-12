import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { PARK_LAYOUT } from "../data/parkLayout";

/**
 * The berm + Disneyland Railroad loop — the park's visual outer edge.
 * Each track polyline segment becomes an instanced berm prism (a SLOPED
 * grass embankment, not a vertical wall) with a darker track cap on top.
 *
 * Wherever the walkable grid says guests pass under the rail line, the
 * berm SPLITS into an underpass: stone abutments + a lintel carrying the
 * track over the gap (the Toontown entrance, the Main Street tunnels…).
 * Sampling the GRID (rather than intersecting path segments) guarantees
 * the visual gaps agree exactly with where players can actually walk —
 * plaza-carved crossings included. walkable.ts blocks the same rail
 * strips, so everywhere else the berm has real collision.
 */

const BERM_HEIGHT = 2.6;
const BERM_BASE_WIDTH = 7;
const BERM_TOP_WIDTH = 2.6;
const SAMPLE_STEP = 1.5; // meters between walkability probes along the rail
const GAP_PAD = 1.6; // widen each detected gap by this much per side

export function buildRailroad(
  scene: Scene,
  isWalkable: (x: number, z: number) => boolean,
): void {
  interface Block {
    mid: Vector3;
    yaw: number;
    length: number;
  }
  const bermBlocks: Block[] = [];
  const trackBlocks: Block[] = [];
  const abutments: Block[] = [];
  const lintels: Block[] = [];

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
      const yaw = Math.atan2(dx, dz);
      const at = (t: number): Vector3 => new Vector3(a[0] + dx * t, 0, a[1] + dz * t);

      // Track is continuous — it rides the lintels over the gaps.
      trackBlocks.push({ mid: at(0.5), yaw, length: length + 0.6 });

      // Probe the centerline: walkable samples mark underpass gaps.
      const steps = Math.max(1, Math.ceil(length / SAMPLE_STEP));
      const gaps: { t0: number; t1: number }[] = [];
      let open: number | null = null;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const p = at(t);
        const walk = isWalkable(p.x, p.z);
        if (walk && open === null) open = t;
        if ((!walk || s === steps) && open !== null) {
          gaps.push({
            t0: Math.max(0, open - GAP_PAD / length),
            t1: Math.min(1, t + GAP_PAD / length),
          });
          open = null;
        }
      }

      if (gaps.length === 0) {
        bermBlocks.push({ mid: at(0.5), yaw, length: length + 0.6 });
        continue;
      }
      let cursor = 0;
      for (const g of gaps) {
        const runLen = (g.t0 - cursor) * length;
        if (runLen > 0.8) {
          bermBlocks.push({ mid: at((cursor + g.t0) / 2), yaw, length: runLen + 0.4 });
        }
        for (const t of [g.t0, g.t1]) {
          if (t > 0.01 && t < 0.99) abutments.push({ mid: at(t), yaw, length: 1.0 });
        }
        lintels.push({ mid: at((g.t0 + g.t1) / 2), yaw, length: (g.t1 - g.t0) * length });
        cursor = g.t1;
      }
      const tailLen = (1 - cursor) * length;
      if (tailLen > 0.8) {
        bermBlocks.push({ mid: at((cursor + 1) / 2), yaw, length: tailLen + 0.4 });
      }
    }
  }
  if (bermBlocks.length === 0 && trackBlocks.length === 0) return;

  const bermMaterial = new MeshStandardMaterial({ color: 0x6d905a, roughness: 1 });
  const trackMaterial = new MeshStandardMaterial({ color: 0x4a4038, roughness: 0.8 });
  const stoneMaterial = new MeshStandardMaterial({ color: 0x9a958c, roughness: 0.9 });

  const place = (mesh: InstancedMesh, blocks: readonly Block[], y: number): void => {
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const scale = new Vector3();
    const pos = new Vector3();
    blocks.forEach((s, i) => {
      q.setFromAxisAngle(up, s.yaw - Math.PI / 2);
      scale.set(s.length, 1, 1);
      pos.copy(s.mid).setY(y);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  // Sloped earthwork prism: a UNIT-LENGTH box (place() scales X by run
  // length, so local X must be exactly 1 m like every other geometry
  // here) whose top face is pinched in Z — a trapezoid cross-section
  // extruded along the track, reading as a real embankment.
  const bermGeo = new BoxGeometry(1, BERM_HEIGHT, BERM_BASE_WIDTH);
  const bermPos = bermGeo.getAttribute("position");
  for (let i = 0; i < bermPos.count; i++) {
    if (bermPos.getY(i) > 0) {
      bermPos.setZ(i, bermPos.getZ(i) * (BERM_TOP_WIDTH / BERM_BASE_WIDTH));
    }
  }
  bermGeo.computeVertexNormals();
  const berms = new InstancedMesh(bermGeo, bermMaterial, Math.max(1, bermBlocks.length));
  place(berms, bermBlocks, BERM_HEIGHT / 2);
  berms.castShadow = true;
  berms.receiveShadow = true;

  const tracks = new InstancedMesh(new BoxGeometry(1, 0.3, 2.2), trackMaterial, trackBlocks.length);
  place(tracks, trackBlocks, BERM_HEIGHT + 0.15);

  const abutmentMesh = new InstancedMesh(
    new BoxGeometry(1, BERM_HEIGHT, BERM_TOP_WIDTH + 1.6),
    stoneMaterial,
    Math.max(1, abutments.length),
  );
  place(abutmentMesh, abutments, BERM_HEIGHT / 2);
  abutmentMesh.castShadow = true;

  // Lintel carries the track across the walkway gap: ~2.1 m clearance.
  const lintelMesh = new InstancedMesh(
    new BoxGeometry(1, 0.5, BERM_TOP_WIDTH + 1.6),
    stoneMaterial,
    Math.max(1, lintels.length),
  );
  place(lintelMesh, lintels, BERM_HEIGHT - 0.25);
  lintelMesh.castShadow = true;

  scene.add(berms, tracks, abutmentMesh, lintelMesh);
}
