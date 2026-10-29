// The splash screen's map layer, drawn in SVG under the Three.js canvas: a
// line map of the region around Durham, NC, and eight travelers converging on
// it by plane, car, train and on foot, each drawing its route as it goes.
import mapSvg from "@/assets/splash-map.svg?raw";

type Mode = "plane" | "car" | "train" | "walk";
type Point = [number, number]; // km from Durham, y pointing south

const NS = "http://www.w3.org/2000/svg";
const GREEN = "#09B07B";

// Trips, with start times and durations in seconds. Far-away flights only need
// the direction they arrive from; they enter from the edge of the screen.
interface Trip {
  mode: Mode;
  label: string;
  start: number;
  duration: number;
  via?: string[]; // places from the map file, ending at Durham
  from?: string; // a place the trip starts at, or the direction of a far flight
  heading?: Point; // direction a far flight arrives from, when not its real one
  bend?: number; // how much a flight arcs, as a share of its length
}
// Arrivals (start + duration) land one every 0.1 s, from 1.45 s to 2.15 s.
const TRIPS: Trip[] = [
  { mode: "car", label: "Fayetteville", start: 0, duration: 1.45, via: ["fayetteville", "sanford", "pittsboro", "chapelHill"] },
  { mode: "walk", label: "Raleigh", start: 0.35, duration: 1.2, from: "raleigh" },
  { mode: "train", label: "Charlotte", start: 0.05, duration: 1.6, via: ["charlotte", "salisbury", "highPoint", "greensboro", "burlington"] },
  { mode: "car", label: "Richmond", start: 0.25, duration: 1.5, via: ["richmond", "petersburg", "southHill", "henderson", "butner"] },
  { mode: "plane", label: "Orlando", start: 0.15, duration: 1.7, from: "orlando", bend: 0.25 },
  { mode: "plane", label: "Toronto", start: 0.2, duration: 1.75, from: "toronto", bend: 0.2 },
  { mode: "plane", label: "San Francisco", start: 0.1, duration: 1.95, from: "sanFrancisco", bend: -0.22 },
  // From the southwest, so it stays clear of San Francisco's route.
  { mode: "plane", label: "Sydney", start: 0.2, duration: 1.95, heading: [-0.7, 0.7], bend: -0.2 },
];

const ICONS: Record<Mode, string> = {
  // Material Design "flight" icon (Apache 2.0), turned to point along +x.
  plane: `<path transform="rotate(90) scale(0.85) translate(-12 -12)" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>`,
  car: `<rect x="-7.5" y="-4" width="15" height="8" rx="3"/><rect x="1.8" y="-3" width="2.6" height="6" rx="1" fill="${GREEN}"/><rect x="-5.3" y="-2.7" width="2" height="5.4" rx="0.9" fill="${GREEN}"/>`,
  train: `<rect x="-12.5" y="-3.2" width="10.5" height="6.4" rx="2"/><rect x="-1" y="-3.2" width="13" height="6.4" rx="3.2"/>`,
  walk: `<circle cy="-7.5" r="2.8"/><rect x="-3.4" y="-3.8" width="6.8" height="9.5" rx="3"/>`,
};
const TRAIL: Record<Mode, Record<string, string>> = {
  plane: { "stroke-width": "1.4", "stroke-dasharray": "5 5", "stroke-opacity": "0.75" },
  car: { "stroke-width": "2", "stroke-opacity": "0.6" },
  train: { "stroke-width": "2.6", "stroke-dasharray": "0.1 5", "stroke-opacity": "0.85" },
  walk: { "stroke-width": "2.2", "stroke-dasharray": "0.1 4", "stroke-opacity": "0.75" },
};

export interface Layout {
  width: number;
  height: number;
  durham: Point; // px, where Durham sits while people travel
  kmToPx: number;
  seatRadius: number; // px from Durham to each person's seat, where their traveler pulls up
  minZoom: number; // the map starts this far zoomed out
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const easeInOut = (x: number) => {
  const c = clamp01(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string> = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// Points along a smooth curve through the waypoints (Catmull-Rom).
function smoothRoute(points: Point[], steps = 12): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1].map((k) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
      ) as Point);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// Points along a flight arc from `from` to Durham.
function arc(from: Point, bend: number, steps = 60): Point[] {
  const len = Math.hypot(from[0], from[1]);
  const control: Point = [from[0] / 2 - (from[1] / len) * bend * len, from[1] / 2 + (from[0] / len) * bend * len];
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    return [a * from[0] + b * control[0], a * from[1] + b * control[1]] as Point;
  });
}

// Cumulative lengths, for moving along a route at an even pace.
function measure(points: Point[]) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  return lengths;
}

export function createMapLayer(canvas: HTMLCanvasElement) {
  const root = el("svg", { "aria-hidden": "true" });
  Object.assign(root.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" });
  canvas.parentElement?.insertBefore(root, canvas);

  // The map, in km, scaled into place each frame.
  const source = new DOMParser().parseFromString(mapSvg, "image/svg+xml").documentElement;
  const places = JSON.parse(source.getAttribute("data-places")!) as Record<string, Point>;
  const map = el("g");
  for (const path of Array.from(source.querySelectorAll("path"))) {
    const kind = path.getAttribute("class");
    map.appendChild(
      el("path", {
        d: path.getAttribute("d")!,
        fill: kind === "map-nc" ? "rgba(255,255,255,0.06)" : "none",
        stroke: kind === "map-nc" ? "none" : "#fff",
        "stroke-opacity": kind === "map-land" ? "0.7" : "0.3",
        "stroke-width": "1",
        "vector-effect": "non-scaling-stroke",
      }),
    );
  }
  const trails = el("g", { fill: "none", stroke: "#fff", "stroke-linecap": "round", "stroke-linejoin": "round" });
  const labels = el("g", {
    fill: "#fff",
    "font-family": "Urbanist, Inter, sans-serif",
    "font-size": "10.5",
    "font-weight": "700",
    "letter-spacing": "1.6",
    "text-anchor": "middle",
  });
  const marker = el("g");
  const pulse = el("circle", { r: "6", fill: "none", stroke: "#fff", "stroke-width": "1.5" });
  marker.appendChild(pulse);
  marker.appendChild(el("circle", { r: "3.5", fill: "#fff" }));
  const vehicles = el("g", { fill: "#fff" });
  for (const layer of [map, trails, marker, labels, vehicles]) root.appendChild(layer);

  const trips = TRIPS.map((trip) => {
    const trail = el("path", TRAIL[trip.mode]);
    const label = el("text");
    label.textContent = trip.label.toUpperCase();
    const vehicle = el("g");
    vehicle.innerHTML = ICONS[trip.mode];
    trails.appendChild(trail);
    labels.appendChild(label);
    vehicles.appendChild(vehicle);
    return { ...trip, trail, label, vehicle, route: [] as Point[], lengths: [] as number[], seat: 0, facing: 0, labelKm: [0, 0] as Point, labelF: 0 };
  });

  // Routes depend on the screen size: far flights start just off-screen, and
  // the walk from Raleigh is stretched so it clears the wheel.
  let layout: Layout;
  let here: Point = [0, 0]; // where Durham is on screen right now
  const toPx = ([x, y]: Point, kmToPx: number): Point => [here[0] + x * kmToPx, here[1] + y * kmToPx];
  const setLayout = (next: Layout) => {
    layout = next;
    here = next.durham;
    // Distance (km) from Durham to just past the screen edge, heading along (x, y).
    const offscreenKm = (x: number, y: number) => {
      const len = Math.hypot(x, y);
      const [ux, uy] = [x / len, y / len];
      const toEdge = Math.min(
        ux > 0 ? (next.width - next.durham[0]) / ux : ux < 0 ? -next.durham[0] / ux : Infinity,
        uy > 0 ? (next.height - next.durham[1]) / uy : uy < 0 ? -next.durham[1] / uy : Infinity,
      );
      return (toEdge + 60) / (next.kmToPx * next.minZoom);
    };
    for (const trip of trips) {
      if (trip.via) {
        trip.route = smoothRoute([...trip.via.map((name) => places[name]), [0, 0]]);
      } else if (trip.mode === "plane") {
        const [x, y] = trip.heading ?? places[trip.from!];
        const len = Math.hypot(x, y);
        const km = offscreenKm(x, y);
        trip.route = arc([(x / len) * km, (y / len) * km], trip.bend ?? 0.2);
      } else {
        const [x, y] = places[trip.from!];
        const len = Math.hypot(x, y);
        const km = Math.max(len, (next.seatRadius * 3.2) / next.kmToPx);
        trip.route = arc([(x / len) * km, (y / len) * km], 0.08, 20);
      }
      trip.lengths = measure(trip.route);
      // The label sits where the trip first appears on screen.
      const inset = 28;
      const onScreen = ([x, y]: Point) => x > inset && x < next.width - inset && y > inset && y < next.height - inset;
      const first = Math.max(0, trip.route.findIndex((p) => onScreen(toPx(p, next.kmToPx))));
      trip.labelKm = trip.route[first];
      trip.labelF = trip.lengths[first] / trip.lengths[trip.lengths.length - 1];
    }
  };

  // The share of a trip after which the traveler curves off the route into
  // their seat: the same distance on screen for every trip.
  const turnAt = (trip: (typeof trips)[number], kmToPx: number) =>
    Math.min(0.95, Math.max(0.35, 1 - (layout.seatRadius * 3.6) / (trip.lengths[trip.lengths.length - 1] * kmToPx)));

  // Which side of the wheel each traveler pulls up to, from the direction
  // they arrive from (angles on screen, y pointing down).
  const approachAngles = () =>
    trips.map((trip) => {
      const [x, y] = pointAt(trip, turnAt(trip, layout.kmToPx)).point;
      return Math.atan2(y, x);
    });
  const setSeats = (angles: number[]) => angles.forEach((a, i) => (trips[i].seat = a));

  const pointAt = (trip: (typeof trips)[number], f: number) => {
    const total = trip.lengths[trip.lengths.length - 1];
    const d = f * total;
    let i = trip.lengths.findIndex((l) => l >= d);
    if (i <= 0) i = 1;
    const span = trip.lengths[i] - trip.lengths[i - 1] || 1;
    const k = (d - trip.lengths[i - 1]) / span;
    const [a, b] = [trip.route[i - 1], trip.route[i]];
    return { point: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k] as Point, index: i };
  };

  // Where a traveler is on screen at fraction `f` of their trip, and the trail
  // behind them. Over the last stretch (the same distance on screen for every
  // trip) they leave the route on a curve that arrives at their seat heading
  // straight in toward the middle of the wheel.
  const locate = (trip: (typeof trips)[number], f: number, kmToPx: number) => {
    const turn = turnAt(trip, kmToPx);
    if (f <= turn) {
      const { point, index } = pointAt(trip, f);
      const at = toPx(point, kmToPx);
      return { at, drawn: [...trip.route.slice(0, index).map((p) => toPx(p, kmToPx)), at], curving: 0 };
    }
    const start = pointAt(trip, turn);
    const p0 = toPx(start.point, kmToPx);
    const ahead = toPx(pointAt(trip, Math.min(1, turn + 0.01)).point, kmToPx);
    const toward = Math.hypot(ahead[0] - p0[0], ahead[1] - p0[1]) || 1;
    const out: Point = [Math.cos(trip.seat), Math.sin(trip.seat)];
    const seat: Point = [here[0] + out[0] * layout.seatRadius, here[1] + out[1] * layout.seatRadius];
    const reach = Math.hypot(seat[0] - p0[0], seat[1] - p0[1]) * 0.45;
    const c1: Point = [p0[0] + ((ahead[0] - p0[0]) / toward) * reach, p0[1] + ((ahead[1] - p0[1]) / toward) * reach];
    const c2: Point = [seat[0] + out[0] * reach, seat[1] + out[1] * reach];
    const bezier = (u: number): Point => {
      const v = 1 - u;
      return [0, 1].map((i) => v * v * v * p0[i] + 3 * v * v * u * c1[i] + 3 * v * u * u * c2[i] + u * u * u * seat[i]) as Point;
    };
    // Move along the curve at an even pace (by length, not by parameter).
    const samples = Array.from({ length: 25 }, (_, i) => bezier(i / 24));
    const lengths = measure(samples);
    const goal = ((f - turn) / (1 - turn)) * lengths[24];
    let i = lengths.findIndex((l) => l >= goal);
    if (i <= 0) i = 1;
    const u = (i - 1 + (goal - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1)) / 24;
    const at = bezier(u);
    return {
      at,
      drawn: [...trip.route.slice(0, start.index).map((p) => toPx(p, kmToPx)), p0, ...samples.slice(1, i), at],
      curving: smooth((f - turn) / (1 - turn)),
    };
  };

  // Draws the frame at `t` seconds, with the map at `zoom` times its layout
  // scale and Durham at `durham` on screen.
  const update = (t: number, zoom: number, durham: Point, opacity: { map: number; trips: number; marker: number }) => {
    here = durham;
    const kmToPx = layout.kmToPx * zoom;
    map.setAttribute("transform", `translate(${here[0]} ${here[1]}) scale(${kmToPx})`);
    map.setAttribute("opacity", String(opacity.map));

    const phase = (t * 0.9) % 1;
    marker.setAttribute("transform", `translate(${here[0]} ${here[1]})`);
    marker.setAttribute("opacity", String(opacity.marker));
    pulse.setAttribute("r", String(5 + phase * 16));
    pulse.setAttribute("stroke-opacity", String((1 - phase) * 0.8));

    const placed: { x: number; y: number; anchor: string; width: number; visible: boolean }[] = [];
    for (const trip of trips) {
      const k = (t - trip.start) / trip.duration;
      const f = trip.mode === "walk" ? smooth(k) : easeInOut(k);
      const arrival = trip.start + trip.duration;
      const { at, drawn, curving } = locate(trip, f, kmToPx);
      const { at: next } = locate(trip, Math.min(1, f + 0.004), kmToPx);

      // Each trail and label fade once their traveler has arrived.
      const fade = (1 - smooth((t - arrival) / 0.45)) * opacity.trips;
      trip.trail.setAttribute("d", k <= 0 ? "" : `M${drawn.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}`);
      trip.trail.style.opacity = String(fade);

      // The vehicle faces the way it's moving, eases down in size as it curves
      // in, and shrinks away into its seat as its person grows from the same spot.
      const facing = trip.mode === "walk" || Math.hypot(next[0] - at[0], next[1] - at[1]) < 0.01 ? trip.facing : Math.atan2(next[1] - at[1], next[0] - at[0]);
      trip.facing = facing;
      const bob = trip.mode === "walk" ? -Math.abs(Math.sin(t * 12)) * 1.5 * (1 - curving) : 0;
      const gone = smooth((t - arrival + 0.06) / 0.18);
      const size = (1 - 0.25 * curving) * (1 - gone);
      const degrees = trip.mode === "walk" ? 0 : (facing * 180) / Math.PI;
      trip.vehicle.setAttribute("transform", `translate(${at[0].toFixed(1)} ${(at[1] + bob).toFixed(1)}) rotate(${degrees.toFixed(1)}) scale(${size.toFixed(3)})`);
      trip.vehicle.setAttribute("opacity", k <= 0 || gone >= 1 ? "0" : "1");

      const labelAt = toPx(trip.labelKm, kmToPx);
      const away = Math.atan2(labelAt[1] - here[1], labelAt[0] - here[0]);
      let [x, y, anchor] = [labelAt[0] + Math.cos(away) * 16, labelAt[1] + Math.sin(away) * 16 + 4, "middle"];
      if (x < 80) [x, y, anchor] = [14, labelAt[1] - 10, "start"];
      else if (x > layout.width - 80) [x, y, anchor] = [layout.width - 14, labelAt[1] - 10, "end"];
      const shown = k > 0 ? clamp01((f - trip.labelF + 0.02) / 0.08) : 0;
      trip.label.setAttribute("opacity", String(shown * 0.8 * fade));
      placed.push({ x, y: Math.min(layout.height - 12, Math.max(20, y)), anchor, width: trip.label.textContent!.length * 7.6, visible: shown > 0 });
    }

    // Nudge apart labels that would overlap, then place them.
    const span = (l: (typeof placed)[number]) => (l.anchor === "start" ? [l.x, l.x + l.width] : l.anchor === "end" ? [l.x - l.width, l.x] : [l.x - l.width / 2, l.x + l.width / 2]);
    placed.forEach((label, i) => {
      for (let j = 0; j < i; j++) {
        const other = placed[j];
        if (!label.visible || !other.visible) continue;
        const [a0, a1] = span(label);
        const [b0, b1] = span(other);
        if (a0 < b1 + 8 && b0 < a1 + 8 && Math.abs(label.y - other.y) < 14) label.y = other.y + (label.y >= other.y ? 15 : -15);
      }
      trips[i].label.setAttribute("x", label.x.toFixed(1));
      trips[i].label.setAttribute("y", label.y.toFixed(1));
      trips[i].label.setAttribute("text-anchor", label.anchor);
    });
  };

  const arrivals = () => trips.map((trip) => trip.start + trip.duration);

  return { setLayout, approachAngles, setSeats, update, arrivals, remove: () => root.remove() };
}
