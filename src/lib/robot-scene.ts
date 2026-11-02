// The little robot on the "For AI bots" button. It raises an arm, waves and
// lowers it again. Drawn with Three.js and rendered only while it moves, so it
// costs nothing between waves.
import {
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const GREEN = 0x09b07b; // the brand green
const INK = 0x2f3a2e; // the face screen, a darker take on the brand's forest
const WHITE = 0xffffff;

// The wave, in seconds: up, three waves, down.
const RAISE = 0.28;
const WAVE = 1.2;
const LOWER = 0.32;
const WAVES = 3;

// Arm angles in radians: 0 points straight up, negative swings out to the right.
const ARM_DOWN = -2.75;
const ARM_UP = -0.55;
const SWING = 0.38;

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

export function startRobot(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
  const box = canvas.getBoundingClientRect();
  renderer.setSize(box.width, box.height, false);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, box.width / box.height, 0.1, 50);
  camera.position.set(0, 0.2, 4.9);
  camera.lookAt(0, 0.08, 0);
  scene.add(new HemisphereLight(WHITE, 0x7f8f7f, 2.4));
  const key = new DirectionalLight(WHITE, 1.8);
  key.position.set(2.5, 3, 4);
  scene.add(key);

  const green = new MeshStandardMaterial({ color: GREEN, roughness: 0.5, metalness: 0.05 });
  const ink = new MeshStandardMaterial({ color: INK, roughness: 0.35 });
  const glow = new MeshBasicMaterial({ color: WHITE });
  const geometries = [
    new RoundedBoxGeometry(0.86, 0.72, 0.6, 4, 0.18), // body
    new RoundedBoxGeometry(1.15, 0.86, 0.76, 4, 0.24), // head
    new RoundedBoxGeometry(0.86, 0.54, 0.12, 3, 0.12), // face screen
    new CircleGeometry(0.09, 24), // eye
    new CircleGeometry(0.075, 24), // chest light
    new CylinderGeometry(0.035, 0.035, 0.24, 12), // antenna
    new SphereGeometry(0.09, 20, 14), // antenna ball and hands
    new CylinderGeometry(0.11, 0.11, 0.12, 20), // ear
    new CapsuleGeometry(0.085, 0.36, 6, 12), // arm
  ];
  const [bodyGeo, headGeo, faceGeo, eyeGeo, chestGeo, antennaGeo, ballGeo, earGeo, armGeo] = geometries;

  const robot = new Group();
  robot.rotation.y = -0.32; // a three-quarter turn so it reads as 3D
  scene.add(robot);

  const body = new Mesh(bodyGeo, green);
  body.position.y = -0.62;
  const chest = new Mesh(chestGeo, glow);
  chest.position.set(0, -0.56, 0.305);
  robot.add(body, chest);

  const head = new Group();
  head.position.y = 0.3;
  robot.add(head);
  const face = new Mesh(faceGeo, ink);
  face.position.z = 0.36;
  head.add(new Mesh(headGeo, green), face);
  for (const x of [-0.19, 0.19]) {
    const eye = new Mesh(eyeGeo, glow);
    eye.position.set(x, 0.02, 0.425);
    head.add(eye);
  }
  for (const x of [-0.6, 0.6]) {
    const ear = new Mesh(earGeo, ink);
    ear.rotation.z = Math.PI / 2;
    ear.position.x = x;
    head.add(ear);
  }
  const antenna = new Mesh(antennaGeo, ink);
  antenna.position.y = 0.55;
  const ball = new Mesh(ballGeo, glow);
  ball.position.y = 0.7;
  head.add(antenna, ball);

  // Each arm hangs from a shoulder pivot, drawn pointing up from it.
  const arm = (side: number) => {
    const shoulder = new Group();
    shoulder.position.set(side * 0.5, -0.36, 0);
    const limb = new Mesh(armGeo, green);
    limb.position.y = 0.26;
    const hand = new Mesh(ballGeo, ink);
    hand.scale.setScalar(1.25);
    hand.position.y = 0.52;
    shoulder.add(limb, hand);
    robot.add(shoulder);
    return shoulder;
  };
  const leftArm = arm(-1);
  leftArm.rotation.z = -ARM_DOWN;
  const rightArm = arm(1);
  rightArm.rotation.z = ARM_DOWN;

  const render = () => renderer.render(scene, camera);
  render();

  let frame = 0;
  let waving = false;

  // Sets the pose `t` seconds into a wave.
  const pose = (t: number) => {
    let angle = ARM_DOWN;
    if (t < RAISE) angle = ARM_DOWN + (ARM_UP - ARM_DOWN) * ease(t / RAISE);
    else if (t < RAISE + WAVE) angle = ARM_UP + SWING * Math.sin(((t - RAISE) / WAVE) * WAVES * 2 * Math.PI);
    else if (t < RAISE + WAVE + LOWER) angle = ARM_UP + (ARM_DOWN - ARM_UP) * ease((t - RAISE - WAVE) / LOWER);
    rightArm.rotation.z = angle;
    // A little bounce and head tilt while the arm is up.
    const up = Math.max(0, Math.min(1, (angle - ARM_DOWN) / (ARM_UP - ARM_DOWN)));
    head.rotation.z = 0.12 * up;
    robot.position.y = 0.04 * up * Math.abs(Math.sin(t * 6));
  };

  const wave = () => {
    if (waving) return;
    waving = true;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      pose(t);
      render();
      if (t < RAISE + WAVE + LOWER) frame = requestAnimationFrame(tick);
      else {
        pose(RAISE + WAVE + LOWER);
        render();
        waving = false;
      }
    };
    frame = requestAnimationFrame(tick);
  };

  /** Holds the arm up mid-wave, for people who prefer less motion. */
  const holdWave = () => {
    pose(RAISE);
    render();
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    for (const g of geometries) g.dispose();
    for (const m of [green, ink, glow]) m.dispose();
    renderer.dispose();
  };

  return { wave, holdWave, stop };
}
