// Three.js scene for the splash screen. The Tech SEO Connect mark is eight
// people (a body and a head each) forming a wheel. They travel in from all
// sides at their own pace, fit together into the wheel, the wheel spins, and
// then it moves into the logo's spot as the wordmark slides in. Everything is
// flat, like the logo.
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Points,
  PointsMaterial,
  Scene,
  ShapeGeometry,
  type ShapePath,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import markSvg from "@/assets/logo-mark.svg?raw";

const MARK_UNITS = 101; // the mark's viewBox is 101 x 101, centered on 50.5
const WEDGE = Math.PI / 8; // half the angle each person takes up
const PERSON_CENTER = 0.3; // distance from the wheel's center to a person's middle, in wheel widths
const START_SIZE = 2.6; // wheel width while it forms, in scene units

// Timeline, in seconds.
const ARRIVE_BY = 0.45; // latest start for a traveler
const TRAVEL = 1.05; // how long each person takes to arrive
const SPIN_FROM = 1.35;
const SPIN_FOR = 1.4;
const SPIN_TURNS = 1; // whole turns, so the wheel stops lined up with the logo
const MOVE_FROM = 2.2;
const MOVE_FOR = 0.7;
const DUST = 300;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => {
  const c = clamp01(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

// Flat shape scaled so the whole mark is 1 unit wide, centered on the origin.
function flatShape(path: ShapePath) {
  const geometry = new ShapeGeometry(path.toShapes());
  geometry.translate(-MARK_UNITS / 2, -MARK_UNITS / 2, 0);
  geometry.scale(1 / MARK_UNITS, -1 / MARK_UNITS, 1); // SVG y points down
  return geometry;
}

// Starts the animation on the canvas and returns a function that stops it.
// `markRect` is where the mark sits in the logo on screen; the wheel ends there.
export function startScene(canvas: HTMLCanvasElement, markRect: () => DOMRect): () => void {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.localClippingEnabled = true;
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 10;

  // Where the wheel ends up (the logo's mark), how big it is while forming,
  // and how far off-screen the travelers start.
  const target = { x: 0, y: 0, size: 1 };
  let startSize = START_SIZE;
  let offscreen = 10;
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    renderer.setSize(box.width, box.height, false);
    camera.aspect = box.width / box.height;
    camera.updateProjectionMatrix();
    const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfWidth = halfHeight * camera.aspect;
    const mark = markRect();
    target.x = ((mark.left + mark.width / 2 - box.left) / box.width) * 2 * halfWidth - halfWidth;
    target.y = halfHeight - ((mark.top + mark.height / 2 - box.top) / box.height) * 2 * halfHeight;
    target.size = (mark.width / box.width) * 2 * halfWidth;
    startSize = Math.min(START_SIZE, halfWidth * 1.2);
    offscreen = Math.hypot(halfWidth, halfHeight) + 1;
  };
  resize();
  window.addEventListener("resize", resize);

  // Faint particles drifting toward the camera.
  const dustPositions = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 30;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    dustPositions[i * 3 + 2] = -Math.random() * 40;
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute("position", new BufferAttribute(dustPositions, 3));
  const dustMaterial = new PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.5 });
  const dust = new Points(dustGeometry, dustMaterial);
  scene.add(dust);

  // The body outline is one shape, so each person is the whole body clipped
  // to its own wedge, plus its head.
  const nodeOf = (p: ShapePath) => p.userData?.node as Element | undefined;
  const paths = new SVGLoader().parse(markSvg).paths;
  const bodyPath = paths.find((p) => nodeOf(p)?.nodeName === "path");
  const headPaths = paths.filter((p) => nodeOf(p)?.nodeName === "circle");
  if (!bodyPath) throw new Error("Logo mark has no body path");
  const body = flatShape(bodyPath);
  const disposables: { dispose(): void }[] = [dustGeometry, dustMaterial, body, renderer];

  const wheel = new Group();
  scene.add(wheel);
  const people = headPaths.map((headPath) => {
    const node = nodeOf(headPath)!;
    const angle = Math.atan2(-(Number(node.getAttribute("cy")) - 50.5), Number(node.getAttribute("cx")) - 50.5);
    const wedge = [
      new Plane(new Vector3(-Math.sin(angle - WEDGE), Math.cos(angle - WEDGE), 0), 0),
      new Plane(new Vector3(Math.sin(angle + WEDGE), -Math.cos(angle + WEDGE), 0), 0),
    ];
    const clippingPlanes = wedge.map((p) => p.clone());
    const material = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, clippingPlanes });
    const head = flatShape(headPath);
    disposables.push(material, head);

    // The person turns around its own middle while traveling, so the meshes
    // (drawn in wheel coordinates) sit offset inside a pivot at that middle.
    const home = new Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(PERSON_CENTER);
    const bodyMesh = new Mesh(body, material);
    const headMesh = new Mesh(head, material);
    for (const mesh of [bodyMesh, headMesh]) mesh.position.set(-home.x, -home.y, 0);
    const pivot = new Group();
    pivot.add(bodyMesh, headMesh);
    wheel.add(pivot);

    // Each traveler starts somewhere off-screen and curves in toward its spot.
    const from = Math.random() * Math.PI * 2;
    const bend = (Math.random() - 0.5) * 1.2;
    return { pivot, bodyMesh, wedge, clippingPlanes, home, from, bend, delay: Math.random() * ARRIVE_BY, turn: (Math.random() - 0.5) * 2 * Math.PI };
  });

  const start = new Vector2();
  const control = new Vector2();
  const startTime = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = (now - startTime) / 1000;
    dust.position.z = t * 4;

    // Forming in the middle of the screen, then moving into the logo's spot.
    const move = easeInOut((t - MOVE_FROM) / MOVE_FOR);
    wheel.position.set(target.x * move, target.y * move, 0);
    wheel.scale.setScalar(startSize + (target.size - startSize) * move);
    wheel.rotation.z = -SPIN_TURNS * 2 * Math.PI * easeInOut((t - SPIN_FROM) / SPIN_FOR);

    for (const p of people) {
      const k = easeInOut((t - p.delay) / TRAVEL);
      // Quadratic curve from off-screen to home, bent to one side.
      start.set(Math.cos(p.from), Math.sin(p.from)).multiplyScalar(offscreen / startSize);
      control.copy(start).lerp(p.home, 0.5).add(new Vector2(-start.y, start.x).multiplyScalar(p.bend));
      const a = (1 - k) * (1 - k);
      const b = 2 * (1 - k) * k;
      p.pivot.position.set(a * start.x + b * control.x + k * k * p.home.x, a * start.y + b * control.y + k * k * p.home.y, 0);
      // Arrive turned every which way, then straighten up into place.
      p.pivot.rotation.z = p.turn * (1 - easeOut((t - p.delay) / (TRAVEL + 0.15)));
    }

    // Clipping planes are in world space, so move each wedge with its person.
    scene.updateMatrixWorld();
    for (const p of people) p.wedge.forEach((plane, i) => p.clippingPlanes[i].copy(plane).applyMatrix4(p.bodyMesh.matrixWorld));

    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
    for (const d of disposables) d.dispose();
  };
}
