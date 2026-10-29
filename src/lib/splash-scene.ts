// Three.js scene for the splash screen. The Tech SEO Connect mark is eight
// people (a body and a head each) forming a wheel. They burst out from the
// middle of the screen, come back together into the wheel in the logo's
// spot, and the wheel keeps turning beside the wordmark.
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Points,
  PointsMaterial,
  Scene,
  type ShapePath,
  Vector3,
  WebGLRenderer,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import markSvg from "@/assets/logo-mark.svg?raw";

const MARK_UNITS = 101; // the mark's viewBox is 101 x 101, centered on 50.5
const DEPTH = 8; // extrusion depth, in viewBox units
const WEDGE = Math.PI / 8; // half the angle each person takes up
const START_SIZE = 3; // wheel width when it first appears, in scene units
const BURST = 1.6; // how far people fly out, in wheel widths
const OUT = 0.75; // seconds to burst out
const BACK = 1.15; // seconds to come back together
const DUST = 400;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => {
  const c = clamp01(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

// Extruded and scaled so the whole mark is 1 unit wide, centered on the origin.
function extrude(path: ShapePath) {
  const geometry = new ExtrudeGeometry(path.toShapes(), { depth: DEPTH, bevelEnabled: false });
  geometry.translate(-MARK_UNITS / 2, -MARK_UNITS / 2, -DEPTH / 2);
  geometry.scale(1 / MARK_UNITS, -1 / MARK_UNITS, 1 / MARK_UNITS); // SVG y points down
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

  // Where the wheel ends up (the logo's mark), and its size at the start.
  const target = { x: 0, y: 0, size: 1 };
  let startSize = START_SIZE;
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
    startSize = Math.min(START_SIZE, halfWidth);
  };
  resize();
  window.addEventListener("resize", resize);

  // Particles that stream past the camera.
  const dustPositions = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 30;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    dustPositions[i * 3 + 2] = -Math.random() * 40;
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute("position", new BufferAttribute(dustPositions, 3));
  const dustMaterial = new PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.7 });
  const dust = new Points(dustGeometry, dustMaterial);
  scene.add(dust);

  // The body outline is one shape, so each person is the whole body clipped
  // to its own wedge, plus its head.
  const nodeOf = (p: ShapePath) => p.userData?.node as Element | undefined;
  const paths = new SVGLoader().parse(markSvg).paths;
  const bodyPath = paths.find((p) => nodeOf(p)?.nodeName === "path");
  const headPaths = paths.filter((p) => nodeOf(p)?.nodeName === "circle");
  if (!bodyPath) throw new Error("Logo mark has no body path");
  const body = extrude(bodyPath);
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
    // Flat white faces with pale mint edges, so each piece reads as solid.
    const faces = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, clippingPlanes });
    const edges = new MeshBasicMaterial({ color: 0xb8ecd9, side: DoubleSide, clippingPlanes });
    const head = extrude(headPath);
    disposables.push(faces, edges, head);

    const person = new Group();
    person.add(new Mesh(body, [faces, edges]), new Mesh(head, [faces, edges]));
    wheel.add(person);
    return {
      person,
      wedge,
      clippingPlanes,
      direction: new Vector3(Math.cos(angle), Math.sin(angle), 0),
      drift: new Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.3) * 3),
      tumble: new Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3),
    };
  });

  const startTime = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = (now - startTime) / 1000;
    dust.position.z = t * 8;

    // 0 when the wheel is whole, 1 when the people are furthest apart.
    const back = easeInOut((t - OUT) / BACK);
    const spread = t < OUT ? easeOut(t / OUT) : 1 - back;

    // The wheel moves from the middle of the screen to the logo's spot,
    // shrinking to fit, and turns the whole time.
    wheel.position.set(target.x * back, target.y * back, 0);
    wheel.scale.setScalar((startSize + (target.size - startSize) * back) * easeOut(t / 0.25));
    wheel.rotation.z = -t * 1.2;

    for (const p of people) {
      p.person.position.copy(p.direction).multiplyScalar(BURST).add(p.drift).multiplyScalar(spread);
      p.person.rotation.set(p.tumble.x * spread, p.tumble.y * spread, p.tumble.z * spread);
    }

    // Clipping planes are in world space, so move each wedge with its person.
    scene.updateMatrixWorld();
    for (const p of people) p.wedge.forEach((plane, i) => p.clippingPlanes[i].copy(plane).applyMatrix4(p.person.matrixWorld));

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
