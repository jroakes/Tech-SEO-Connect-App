// Three.js scene for the splash screen: eight 3D copies of the Tech SEO
// Connect star mark fly in from the distance through drifting particles,
// swirl into a ring while each one spins, then spread out and fade as the
// logo appears.
import {
  BufferAttribute,
  BufferGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import markSvg from "@/assets/logo-mark.svg?raw";

const MARKS = 8;
const RING_RADIUS = 2.6;
const MARK_SIZE = 1.1; // width of each mark, in scene units
const FLY_IN = 1.3; // seconds for each mark to reach the ring
const DUST = 400;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

function markGeometry() {
  const shapes = new SVGLoader().parse(markSvg).paths.flatMap((path) => SVGLoader.createShapes(path));
  const geometry = new ExtrudeGeometry(shapes, {
    depth: 8,
    bevelEnabled: false,
  });
  geometry.center();
  const scale = MARK_SIZE / 101; // the mark's viewBox is 101 units wide
  geometry.scale(scale, -scale, scale); // SVG y points down
  return geometry;
}

// Starts the animation on the canvas and returns a function that stops it.
export function startScene(canvas: HTMLCanvasElement): () => void {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 10;

  // On narrow (phone) screens, shrink the ring so it fits the width.
  let fit = 1;
  const resize = () => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    const halfWidth = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect;
    fit = Math.min(1, halfWidth / (RING_RADIUS + MARK_SIZE));
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

  // The marks start scattered far away and end evenly spaced on the ring.
  const ring = new Group();
  scene.add(ring);
  const geometry = markGeometry();
  // Flat white faces with pale mint edges, so each mark reads as a solid piece.
  const faces = new MeshBasicMaterial({ color: 0xffffff, transparent: true });
  const edges = new MeshBasicMaterial({ color: 0xb8ecd9, transparent: true });
  const material = [faces, edges];
  const marks = Array.from({ length: MARKS }, (_, i) => {
    const angle = (i / MARKS) * Math.PI * 2 + Math.PI / 2;
    const end = new Vector3(Math.cos(angle) * RING_RADIUS, Math.sin(angle) * RING_RADIUS, 0);
    const start = new Vector3((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 16, -25 - Math.random() * 15);
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(start);
    ring.add(mesh);
    return { mesh, start, end, delay: Math.random() * 0.3, spin: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random()) };
  });

  const startTime = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = (now - startTime) / 1000;

    dust.position.z = t * 8;
    for (const m of marks) {
      const arrived = easeOut((t - m.delay) / FLY_IN);
      m.mesh.position.lerpVectors(m.start, m.end, arrived);
      // Tumble on the way in, then settle into a flat spin like a gear.
      m.mesh.rotation.z = t * m.spin;
      m.mesh.rotation.x = (1 - arrived) * 1.2;
      m.mesh.rotation.y = (1 - arrived) * 0.8;
    }

    // Spread out and fade as the logo appears.
    const fade = 1 - clamp01((t - 2) / 0.7);
    faces.opacity = fade;
    edges.opacity = fade;
    dustMaterial.opacity = 0.7 * fade;
    ring.rotation.z = t * 0.5;
    ring.rotation.x = Math.sin(t * 1.5) * 0.25;
    ring.scale.setScalar(fit * (1 + easeOut((t - 1.6) / 0.9) * 0.8));

    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
    for (const disposable of [dustGeometry, dustMaterial, geometry, faces, edges, renderer]) disposable.dispose();
  };
}
