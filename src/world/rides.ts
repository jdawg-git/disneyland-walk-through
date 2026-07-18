import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from "three";

/**
 * v6 walkthrough set: small bespoke ride vignettes + land-entry gateways.
 * Everything here is dressing at real attraction anchors — Dumbo's
 * elephants, the Mad Tea Party cups, Monstro at the Storybook canal mouth,
 * Nemo submarines in the Tomorrowland lagoon, the Winnie the Pooh marquee,
 * and the Adventureland/Frontierland/Tomorrowland entrance arches.
 */

const CUP_COLORS = [0xe86a9a, 0x6ab0e8, 0xf0c04a, 0x9a6ae8, 0x62c48a, 0xe88a5a];

export function buildRideVignettes(scene: Scene): void {
  buildDumbo(scene, 8, -107);
  buildTeacups(scene, 67, -86);
  buildMonstro(scene, 43.5, -102.8);
  buildSubLagoon(scene, 181, -33);
  buildPoohMarquee(scene, -361, 0);

  buildCastleWallTurrets(scene);

  // Land gateways at the hub spoke mouths, beams spanning ACROSS the
  // walkway (yaw solved so local +X ⊥ the hub→land walk direction).
  buildGateway(scene, -34, 92, -1.07, "ADVENTURELAND", "bamboo");
  buildGateway(scene, -42, 44, 1.27, "FRONTIERLAND", "logs");
  buildGateway(scene, 46, 40, -1.3, "TOMORROWLAND", "modern");
}

/** Dumbo the Flying Elephant: gray elephants on radial arms — not Stonehenge. */
function buildDumbo(scene: Scene, x: number, z: number): void {
  const g = new Group();
  const gray = new MeshStandardMaterial({ color: 0xb8bcc8, roughness: 0.85 });
  const red = new MeshStandardMaterial({ color: 0xd84848, roughness: 0.7 });
  const gold = new MeshStandardMaterial({ color: 0xd8a838, roughness: 0.5, metalness: 0.3 });

  const base = new Mesh(new CylinderGeometry(6.2, 6.6, 0.6, 18), red);
  base.position.y = 0.3;
  base.receiveShadow = true;
  g.add(base);
  const hubPost = new Mesh(new CylinderGeometry(0.9, 1.1, 3.2, 10), gold);
  hubPost.position.y = 0.6 + 1.6;
  g.add(hubPost);
  const ball = new Mesh(new SphereGeometry(1.1, 10, 8), red);
  ball.position.y = 4.4;
  g.add(ball);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lift = i % 2 === 0 ? 1.4 : 0.6;
    // Radial arm.
    const arm = new Mesh(new BoxGeometry(4.6, 0.18, 0.4), gold);
    arm.position.set(Math.cos(a) * 2.7, 2.4 + lift * 0.45, Math.sin(a) * 2.7);
    arm.rotation.y = -a;
    arm.rotation.z = -lift * 0.18;
    g.add(arm);

    // Rough-but-readable elephant: body, head, ears, trunk, hat.
    const e = new Group();
    const body = new Mesh(new DodecahedronGeometry(0.85, 0), gray);
    body.scale.set(1.15, 0.95, 1.3);
    e.add(body);
    const head = new Mesh(new DodecahedronGeometry(0.55, 0), gray);
    head.position.set(0, 0.55, 0.95);
    e.add(head);
    for (const side of [-1, 1]) {
      const ear = new Mesh(new BoxGeometry(0.1, 0.75, 0.65), gray);
      ear.position.set(side * 0.62, 0.62, 0.8);
      ear.rotation.z = side * 0.35;
      e.add(ear);
    }
    const trunk = new Mesh(new CylinderGeometry(0.11, 0.16, 0.95, 6), gray);
    trunk.position.set(0, 0.28, 1.5);
    trunk.rotation.x = 0.9;
    e.add(trunk);
    const hat = new Mesh(new ConeGeometry(0.3, 0.4, 8), i % 2 === 0 ? red : gold);
    hat.position.set(0, 1.05, 0.9);
    e.add(hat);
    e.position.set(Math.cos(a) * 5.0, 1.9 + lift, Math.sin(a) * 5.0);
    e.rotation.y = -a + Math.PI / 2; // fly tangentially
    e.castShadow = true;
    g.add(e);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}

/** Mad Tea Party: oversized cups on a pastel platter. */
function buildTeacups(scene: Scene, x: number, z: number): void {
  const g = new Group();
  const platter = new Mesh(
    new CylinderGeometry(7.0, 7.4, 0.5, 18),
    new MeshStandardMaterial({ color: 0xcfe8d8, roughness: 0.8 }),
  );
  platter.position.y = 0.25;
  platter.receiveShadow = true;
  g.add(platter);

  CUP_COLORS.forEach((color, i) => {
    const a = (i / CUP_COLORS.length) * Math.PI * 2 + 0.3;
    const cup = new Group();
    const mat = new MeshStandardMaterial({ color, roughness: 0.6 });
    const bowl = new Mesh(new CylinderGeometry(1.05, 0.7, 1.25, 14, 1, true), mat);
    bowl.position.y = 0.75;
    ((bowl.material as MeshStandardMaterial).side) = DoubleSide;
    cup.add(bowl);
    const bottom = new Mesh(new CylinderGeometry(0.7, 0.75, 0.16, 14), mat);
    bottom.position.y = 0.16;
    cup.add(bottom);
    const handle = new Mesh(new TorusGeometry(0.42, 0.09, 6, 12), mat);
    handle.position.set(1.1, 0.8, 0);
    handle.rotation.y = Math.PI / 2;
    cup.add(handle);
    const saucer = new Mesh(new CylinderGeometry(1.35, 1.5, 0.12, 14), mat);
    saucer.position.y = 0.06;
    cup.add(saucer);
    cup.position.set(Math.cos(a) * 4.6, 0.5, Math.sin(a) * 4.6);
    cup.rotation.y = a * 2.2; // scattered spin
    cup.castShadow = true;
    g.add(cup);
  });
  g.position.set(x, 0, z);
  scene.add(g);
}

/** Monstro at the Storybook canal mouth — the river sails into his jaws. */
function buildMonstro(scene: Scene, x: number, z: number): void {
  const g = new Group();
  const hide = new MeshStandardMaterial({ color: 0x7e9ab4, roughness: 0.9, flatShading: true });
  const belly = new MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.9 });
  const dark = new MeshStandardMaterial({ color: 0x101418, roughness: 1 });
  const tooth = new MeshStandardMaterial({ color: 0xf6f4ea, roughness: 0.6 });

  // Head: flattened sphere over the canal, mouth agape toward -Z (canal).
  const head = new Mesh(new SphereGeometry(4.2, 14, 10), hide);
  head.scale.set(1.15, 0.85, 1.0);
  head.position.y = 3.2;
  head.castShadow = true;
  g.add(head);

  // Open mouth: dark arch beneath the head, tall enough for the "boats".
  const mouth = new Mesh(new CylinderGeometry(2.4, 2.4, 3.4, 12, 1, false, 0, Math.PI), dark);
  mouth.rotation.z = Math.PI / 2;
  mouth.rotation.y = Math.PI / 2;
  mouth.position.set(0, 1.5, -2.6);
  g.add(mouth);
  const jaw = new Mesh(new BoxGeometry(4.2, 0.5, 1.6), belly);
  jaw.position.set(0, 0.25, -3.4);
  g.add(jaw);

  // Teeth along the upper lip.
  for (let i = -2; i <= 2; i++) {
    const t = new Mesh(new ConeGeometry(0.28, 0.8, 6), tooth);
    t.position.set(i * 0.85, 3.0, -4.05);
    t.rotation.x = Math.PI; // point down
    g.add(t);
  }
  // Eyes.
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.45, 8, 6), belly);
    eye.position.set(side * 2.4, 4.4, -2.9);
    g.add(eye);
    const pupil = new Mesh(new SphereGeometry(0.2, 6, 5), dark);
    pupil.position.set(side * 2.5, 4.4, -3.25);
    g.add(pupil);
  }
  // Tail fluke breaking ground behind.
  const fluke = new Mesh(new BoxGeometry(2.6, 0.4, 1.4), hide);
  fluke.position.set(1.5, 0.7, 4.8);
  fluke.rotation.z = 0.5;
  g.add(fluke);

  // Sits at the canal head (which is the canal's SOUTH end; the water
  // runs north behind him) facing south-southeast, so guests coming from
  // the teacups meet his open jaws and the canal reads as ending in them.
  g.rotation.y = Math.PI - 0.35;
  g.position.set(x, 0, z);
  scene.add(g);
}

/** Finding Nemo lagoon: yellow subs + a cave-arched rock the subs dive into. */
function buildSubLagoon(scene: Scene, x: number, z: number): void {
  const g = new Group();
  const yellow = new MeshStandardMaterial({ color: 0xf0c018, roughness: 0.55 });
  const rock = new MeshStandardMaterial({ color: 0x8a8474, roughness: 1, flatShading: true });
  const dark = new MeshStandardMaterial({ color: 0x0c1418, roughness: 1 });

  for (const [sx, sz, yaw] of [
    [-8, 6, 0.5],
    [4, -2, 2.4],
    [10, 10, 4.2],
  ] as const) {
    const sub = new Group();
    const hull = new Mesh(new CapsuleGeometry(0.95, 4.4, 4, 10), yellow);
    hull.rotation.z = Math.PI / 2;
    sub.add(hull);
    const sail = new Mesh(new BoxGeometry(1.2, 0.8, 0.7), yellow);
    sail.position.y = 1.0;
    sub.add(sail);
    const scope = new Mesh(new CylinderGeometry(0.08, 0.08, 0.9, 6), dark);
    scope.position.set(0.2, 1.7, 0);
    sub.add(scope);
    for (let p = -1; p <= 1; p++) {
      const port = new Mesh(new SphereGeometry(0.16, 6, 5), dark);
      port.position.set(p * 1.3, 0.35, 0.85);
      sub.add(port);
    }
    sub.position.set(sx, 0.55, sz);
    sub.rotation.y = yaw;
    g.add(sub);
  }

  // Cave rock at the lagoon's north edge.
  const mound = new Mesh(new DodecahedronGeometry(6.5, 1), rock);
  mound.scale.set(1.3, 0.75, 1);
  mound.position.set(2, 1.5, -14);
  mound.castShadow = true;
  g.add(mound);
  for (const [cx, cw] of [
    [-2.5, 2.4],
    [3.5, 3.0],
  ] as const) {
    const cave = new Mesh(new CylinderGeometry(cw / 2, cw / 2, 1.6, 10, 1, false, 0, Math.PI), dark);
    cave.rotation.z = Math.PI / 2;
    cave.rotation.y = Math.PI / 2;
    cave.position.set(2 + cx, 0.8, -14 + 5.2);
    g.add(cave);
  }

  g.position.set(x, 0, z);
  scene.add(g);
}

/** Winnie the Pooh marquee in front of the ride's show building. */
function buildPoohMarquee(scene: Scene, x: number, z: number): void {
  const g = new Group();
  const honey = new MeshStandardMaterial({ color: 0xe8a830, roughness: 0.7 });
  const wood = new MeshStandardMaterial({ color: 0x7a5230, roughness: 0.95 });

  for (const side of [-1, 1]) {
    const post = new Mesh(new BoxGeometry(0.35, 3.4, 0.35), wood);
    post.position.set(0, 1.7, side * 2.6);
    g.add(post);
  }
  const board = new Mesh(new BoxGeometry(0.25, 1.6, 6.0), honey);
  board.position.y = 3.2;
  g.add(board);
  const sign = new Mesh(
    new PlaneGeometry(5.6, 1.3),
    signMaterial("The Many Adventures\nof Winnie the Pooh", "#5a3a14", "#f6dfa0"),
  );
  sign.position.set(0.14, 3.2, 0);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  // Honey pot on top.
  const pot = new Mesh(new CylinderGeometry(0.5, 0.38, 0.7, 10), honey);
  pot.position.y = 4.35;
  g.add(pot);

  g.position.set(x, 0, z);
  scene.add(g);
}

/**
 * The Fantasyland dark-ride block (OSM 375647636, x 6..67 z −80..−16,
 * h 6) reads as "an extension of the castle" in Anaheim — corner turrets
 * with cobalt cone roofs + crenellation caps sell that on our Tudor mega.
 */
function buildCastleWallTurrets(scene: Scene): void {
  const stone = new MeshStandardMaterial({ color: 0x8f9aac, roughness: 0.9 });
  const roofBlue = new MeshStandardMaterial({ color: 0x2f55c2, roughness: 0.6 });
  for (const [tx, tz] of [
    [7, -18],
    [7, -48],
    [7, -78],
    [36, -17],
    [66, -17],
  ] as const) {
    const turret = new Group();
    const shaft = new Mesh(new CylinderGeometry(1.6, 1.8, 8.5, 10), stone);
    shaft.position.y = 4.25;
    shaft.castShadow = true;
    turret.add(shaft);
    const collar = new Mesh(new CylinderGeometry(2.0, 2.0, 0.7, 10), stone);
    collar.position.y = 8.6;
    turret.add(collar);
    const cone = new ConeGeometry(2.0, 3.2, 10);
    const roof = new Mesh(cone, roofBlue);
    roof.position.y = 10.5;
    roof.castShadow = true;
    turret.add(roof);
    turret.position.set(tx, 0, tz);
    scene.add(turret);
  }
}

/** Themed land-entry archway with the land's name across the beam. */
function buildGateway(
  scene: Scene,
  x: number,
  z: number,
  yaw: number,
  text: string,
  style: "bamboo" | "logs" | "modern",
): void {
  const g = new Group();
  const SPAN = 9;

  if (style === "bamboo") {
    const bamboo = new MeshStandardMaterial({ color: 0xa89448, roughness: 0.9 });
    const thatch = new MeshStandardMaterial({ color: 0x8a6a34, roughness: 1 });
    for (const side of [-1, 1]) {
      for (const off of [-0.35, 0.35]) {
        const post = new Mesh(new CylinderGeometry(0.16, 0.2, 5.2, 8), bamboo);
        post.position.set(side * (SPAN / 2), 2.6, off);
        g.add(post);
      }
    }
    const beam = new Mesh(new BoxGeometry(SPAN + 1.4, 1.1, 0.9), thatch);
    beam.position.y = 5.1;
    beam.rotation.z = 0.02;
    g.add(beam);
    g.add(gatewaySign(text, "#f6ead0", "#4a3418", 5.1));
  } else if (style === "logs") {
    const log = new MeshStandardMaterial({ color: 0x6a4a30, roughness: 1 });
    for (const side of [-1, 1]) {
      const post = new Mesh(new CylinderGeometry(0.42, 0.5, 5.4, 8), log);
      post.position.set(side * (SPAN / 2), 2.7, 0);
      g.add(post);
      const tip = new Mesh(new ConeGeometry(0.42, 0.7, 8), log);
      tip.position.set(side * (SPAN / 2), 5.75, 0);
      g.add(tip);
    }
    const beam = new Mesh(new CylinderGeometry(0.38, 0.38, SPAN + 1.6, 8), log);
    beam.rotation.z = Math.PI / 2;
    beam.position.y = 4.9;
    g.add(beam);
    g.add(gatewaySign(text, "#e8d0a0", "#3c2a16", 4.9));
  } else {
    const white = new MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.4, metalness: 0.3 });
    const blue = new MeshStandardMaterial({ color: 0x3878c8, roughness: 0.5 });
    for (const side of [-1, 1]) {
      const post = new Mesh(new BoxGeometry(0.5, 5.6, 0.5), white);
      post.position.set(side * (SPAN / 2), 2.8, 0);
      post.rotation.x = 0.1; // slight futurist lean
      g.add(post);
    }
    const beam = new Mesh(new BoxGeometry(SPAN + 1.2, 0.7, 0.5), blue);
    beam.position.y = 5.3;
    g.add(beam);
    g.add(gatewaySign(text, "#ffffff", "#123a6e", 5.3));
  }

  g.rotation.y = yaw;
  g.position.set(x, 0, z);
  scene.add(g);
}

function gatewaySign(text: string, fg: string, bg: string, y: number): Group {
  // One correctly-oriented plane on EACH side of the beam — a single
  // double-sided plane reads mirrored from the approach direction.
  const material = signMaterial(text, fg, bg);
  const g = new Group();
  for (const side of [-1, 1]) {
    const sign = new Mesh(new PlaneGeometry(7.4, 0.95), material);
    sign.position.set(0, y, side * 0.52);
    sign.rotation.y = side === 1 ? 0 : Math.PI;
    g.add(sign);
  }
  return g;
}

/** Canvas-text sign material (double-sided, readable both ways). */
function signMaterial(text: string, fg: string, bg: string): MeshStandardMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = text.split("\n");
    let size = lines.length > 1 ? 30 : 44;
    ctx.font = `bold ${size}px Georgia, serif`;
    while (Math.max(...lines.map((l) => ctx.measureText(l).width)) > 480 && size > 16) {
      size -= 2;
      ctx.font = `bold ${size}px Georgia, serif`;
    }
    lines.forEach((line, i) => {
      ctx.fillText(line, 256, 48 + (i - (lines.length - 1) / 2) * (size + 6));
    });
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return new MeshStandardMaterial({ map: texture, roughness: 0.8, side: DoubleSide });
}
