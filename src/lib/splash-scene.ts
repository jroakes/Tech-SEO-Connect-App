// Three.js scene for the splash screen: eight "attendees" fly in from the
// distance through drifting particles, link up into the ring from the Tech SEO
// Connect mark, then spread out and fade as the logo appears.
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

const PEOPLE = 8;
const RING_RADIUS = 2.6;
const FLY_IN = 1.3; // seconds for each attendee to reach the ring
const DUST = 400;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

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
    fit = Math.min(1, halfWidth / (RING_RADIUS + 0.5));
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

  // The attendees start scattered far away and end evenly spaced on the ring.
  const ring = new Group();
  scene.add(ring);
  const sphere = new SphereGeometry(0.28, 24, 16);
  const personMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true });
  const people = Array.from({ length: PEOPLE }, (_, i) => {
    const angle = (i / PEOPLE) * Math.PI * 2 + Math.PI / 2;
    const end = new Vector3(Math.cos(angle) * RING_RADIUS, Math.sin(angle) * RING_RADIUS, 0);
    const start = new Vector3((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 16, -25 - Math.random() * 15);
    const mesh = new Mesh(sphere, personMaterial);
    mesh.position.copy(start);
    ring.add(mesh);
    return { mesh, start, end, delay: Math.random() * 0.3 };
  });

  // Each attendee links to its neighbors and across the ring, like the mark.
  const pairs: [number, number][] = [];
  for (let i = 0; i < PEOPLE; i++) pairs.push([i, (i + 1) % PEOPLE], [i, (i + 3) % PEOPLE]);
  const linePositions = new Float32Array(pairs.length * 6);
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute("position", new BufferAttribute(linePositions, 3));
  const lineMaterial = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  ring.add(new LineSegments(lineGeometry, lineMaterial));

  const startTime = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = (now - startTime) / 1000;

    dust.position.z = t * 8;
    for (const p of people) p.mesh.position.lerpVectors(p.start, p.end, easeOut((t - p.delay) / FLY_IN));

    pairs.forEach(([a, b], i) => {
      people[a].mesh.position.toArray(linePositions, i * 6);
      people[b].mesh.position.toArray(linePositions, i * 6 + 3);
    });
    lineGeometry.attributes.position.needsUpdate = true;

    // Link up once they arrive, then spread out and fade as the logo appears.
    const fade = 1 - clamp01((t - 2) / 0.7);
    lineMaterial.opacity = clamp01((t - 1.1) / 0.4) * 0.55 * fade;
    personMaterial.opacity = fade;
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
    for (const disposable of [dustGeometry, dustMaterial, sphere, personMaterial, lineGeometry, lineMaterial, renderer]) {
      disposable.dispose();
    }
  };
}
