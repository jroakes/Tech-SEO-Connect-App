// Three.js scene for the splash screen. Travelers converge on Durham, NC by
// plane, car, train and on foot (drawn by the SVG map layer underneath). As
// each one pulls into their seat, their vehicle shrinks away as a person from
// the logo's mark grows in its place. Once all eight are seated the wheel spins, the view pans so it
// lands in the logo's spot, the map recedes, and the wordmark slides in.
// Everything is flat, like the logo.
import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Scene,
  ShapeGeometry,
  type ShapePath,
  Vector3,
  WebGLRenderer,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import markSvg from "@/assets/logo-mark.svg?raw";
import { createMapLayer } from "./splash-map";

const MARK_UNITS = 101; // the mark's viewBox is 101 x 101, centered on 50.5
const WEDGE = Math.PI / 8; // half the angle each person takes up
const PERSON_CENTER = 0.3; // distance from the wheel's center to a person's middle, in wheel widths
const KM_TO_PX = 1.45 / 1000; // map scale, per px of the screen's size (square root of its area)

// Timeline, in seconds. Arrival times come from the trips in splash-map.ts;
// the closing steps follow the last arrival.
const ZOOM_FROM = 0.85; // the map eases in from slightly zoomed out
const ZOOM_FOR = 2.4;
const APPEAR = 0.38; // a person growing into their seat as their vehicle shrinks away
const SPIN_AFTER = 0.25; // pause between the last arrival and the spin
const SPIN_FOR = 1.3;
const MOVE_AFTER = 0.45; // the pan into the logo's spot starts this far into the spin
const MOVE_FOR = 0.8;
const HOLD = 0.9; // how long the finished logo stays before the splash fades

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
// Eases out with a slight settle past the end (about 4%).
const easeOutSettle = (x: number) => {
  const c = clamp01(x) - 1;
  return 1 + 2.4 * c * c * c + 1.4 * c * c;
};
const easeInOut = (x: number) => {
  const c = clamp01(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// Flat shape scaled so the whole mark is 1 unit wide, centered on the origin.
function flatShape(path: ShapePath) {
  const geometry = new ShapeGeometry(path.toShapes());
  geometry.translate(-MARK_UNITS / 2, -MARK_UNITS / 2, 0);
  geometry.scale(1 / MARK_UNITS, -1 / MARK_UNITS, 1); // SVG y points down
  return geometry;
}

// Starts the animation on the canvas. `markRect` is where the mark sits in the
// logo on screen; the wheel lands there. Returns when (in ms) the wordmark
// should slide in and the splash end, and a function that stops the animation.
export function startScene(canvas: HTMLCanvasElement, markRect: () => DOMRect) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.localClippingEnabled = true;
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 10;
  const mapLayer = createMapLayer(canvas);

  // People gather in the middle of the screen, where there's room on every
  // side; then the view pans so the wheel lands on the logo's mark.
  const gather = { x: 0, y: 0, px: [0, 0] as [number, number] };
  const target = { x: 0, y: 0, size: 1, px: [0, 0] as [number, number] };
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    renderer.setSize(box.width, box.height, false);
    camera.aspect = box.width / box.height;
    camera.updateProjectionMatrix();
    const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfWidth = halfHeight * camera.aspect;
    const mark = markRect();
    const markX = mark.left + mark.width / 2 - box.left;
    const markY = mark.top + mark.height / 2 - box.top;
    target.x = (markX / box.width) * 2 * halfWidth - halfWidth;
    target.y = halfHeight - (markY / box.height) * 2 * halfHeight;
    target.size = (mark.width / box.width) * 2 * halfWidth;
    target.px = [markX, markY];
    gather.px = [box.width / 2, markY];
    gather.x = 0;
    gather.y = target.y;
    mapLayer.setLayout({
      width: box.width,
      height: box.height,
      durham: gather.px,
      kmToPx: KM_TO_PX * Math.sqrt(box.width * box.height),
      seatRadius: mark.width * PERSON_CENTER,
      minZoom: ZOOM_FROM,
    });
  };
  resize();
  window.addEventListener("resize", resize);

  // The body outline is one shape, so each person is the whole body clipped
  // to its own wedge, plus its head.
  const nodeOf = (p: ShapePath) => p.userData?.node as Element | undefined;
  const paths = new SVGLoader().parse(markSvg).paths;
  const bodyPath = paths.find((p) => nodeOf(p)?.nodeName === "path");
  const headPaths = paths.filter((p) => nodeOf(p)?.nodeName === "circle");
  if (!bodyPath) throw new Error("Logo mark has no body path");
  const body = flatShape(bodyPath);
  const disposables: { dispose(): void }[] = [body, renderer];

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
    const material = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, clippingPlanes, transparent: true, opacity: 0 });
    const head = flatShape(headPath);
    disposables.push(material, head);

    // A person scales from their own middle (their seat), so the meshes,
    // drawn in wheel coordinates, sit offset inside a pivot there.
    const seatX = Math.cos(angle) * PERSON_CENTER;
    const seatY = Math.sin(angle) * PERSON_CENTER;
    const bodyMesh = new Mesh(body, material);
    const headMesh = new Mesh(head, material);
    for (const mesh of [bodyMesh, headMesh]) mesh.position.set(-seatX, -seatY, 0);
    const pivot = new Group();
    pivot.position.set(seatX, seatY, 0);
    pivot.add(bodyMesh, headMesh);
    wheel.add(pivot);
    // On screen y points down, so a seat's screen angle is the negative.
    return { pivot, bodyMesh, material, wedge, clippingPlanes, screenAngle: -angle, arrives: Infinity };
  });

  // Seat each traveler on the side they arrive from. Pair travelers and seats
  // in order around the circle, then turn the whole wheel so the seats face
  // their travelers as closely as possible.
  const approach = mapLayer.approachAngles();
  const arrivals = mapLayer.arrivals();
  const tripOrder = approach.map((_, i) => i).sort((a, b) => approach[a] - approach[b]);
  const seatOrder = people.map((_, i) => i).sort((a, b) => people[a].screenAngle - people[b].screenAngle);
  const pairsFor = (shift: number) => tripOrder.map((trip, i) => ({ trip, person: people[seatOrder[(i + shift) % seatOrder.length]] }));
  const turnFor = (pairs: ReturnType<typeof pairsFor>) => {
    // The average angle between each seat and its traveler (on screen).
    const [s, c] = pairs.reduce(([s, c], { trip, person }) => {
      const d = person.screenAngle - approach[trip];
      return [s + Math.sin(d), c + Math.cos(d)];
    }, [0, 0]);
    return Math.atan2(s, c);
  };
  const costFor = (pairs: ReturnType<typeof pairsFor>, turn: number) =>
    pairs.reduce((sum, { trip, person }) => sum + Math.abs(wrap(person.screenAngle - turn - approach[trip])), 0);
  let best = { pairs: pairsFor(0), turn: 0, cost: Infinity };
  for (let shift = 0; shift < seatOrder.length; shift++) {
    const pairs = pairsFor(shift);
    const turn = turnFor(pairs);
    const cost = costFor(pairs, turn);
    if (cost < best.cost) best = { pairs, turn, cost };
  }
  // Turning the wheel by `rho` (counterclockwise in Three.js) moves every seat
  // by -rho on screen.
  const rho = best.turn;
  const seatAngles: number[] = [];
  for (const { trip, person } of best.pairs) {
    person.arrives = arrivals[trip];
    seatAngles[trip] = person.screenAngle - rho;
  }
  mapLayer.setSeats(seatAngles);

  // The spin is about one clockwise turn, ending where the mark looks exactly
  // like the logo (it repeats every eighth of a turn).
  const eighth = Math.PI / 4;
  const spinTo = Math.round((rho - 2 * Math.PI) / eighth) * eighth;
  const firstArrival = Math.min(...arrivals);
  const lastArrival = Math.max(...arrivals);
  const spinFrom = lastArrival + SPIN_AFTER;
  const moveFrom = spinFrom + MOVE_AFTER;
  const wordmarkAt = moveFrom + MOVE_FOR * 0.55;
  const endAt = moveFrom + MOVE_FOR + HOLD;

  const startTime = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = (now - startTime) / 1000;

    const move = easeInOut((t - moveFrom) / MOVE_FOR);
    const durham: [number, number] = [gather.px[0] + (target.px[0] - gather.px[0]) * move, gather.px[1] + (target.px[1] - gather.px[1]) * move];
    mapLayer.update(t, ZOOM_FROM + (1 - ZOOM_FROM) * easeOut(t / ZOOM_FOR), durham, {
      map: clamp01(t / 0.5) * (1 - 0.75 * easeInOut((t - moveFrom) / (MOVE_FOR + 0.3))),
      trips: 1,
      marker: clamp01((t - 0.2) / 0.3) * (1 - clamp01((t - firstArrival + 0.5) / 0.3)),
    });

    wheel.position.set(gather.x + (target.x - gather.x) * move, gather.y + (target.y - gather.y) * move, 0);
    wheel.scale.setScalar(target.size);
    wheel.rotation.z = rho + (spinTo - rho) * easeInOut((t - spinFrom) / SPIN_FOR);

    // Each person grows from the spot where their vehicle pulls up, settling
    // into their seat as the vehicle shrinks away beneath them.
    for (const p of people) {
      const k = (t - p.arrives + 0.06) / APPEAR;
      p.pivot.visible = k > 0;
      p.material.opacity = clamp01(k * 4);
      p.pivot.scale.setScalar(Math.max(0.001, easeOutSettle(k)));
    }

    // Clipping planes are in world space, so move each wedge with its person.
    scene.updateMatrixWorld();
    for (const p of people) p.wedge.forEach((plane, i) => p.clippingPlanes[i].copy(plane).applyMatrix4(p.bodyMesh.matrixWorld));

    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    wordmarkAt: wordmarkAt * 1000,
    endAt: endAt * 1000,
    stop: () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      mapLayer.remove();
      for (const d of disposables) d.dispose();
    },
  };
}
