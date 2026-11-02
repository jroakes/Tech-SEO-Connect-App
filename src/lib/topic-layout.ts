// Where the topic circles go on the Meet page. Pure, so it can be tuned and
// tested outside the browser.
import { forceCollide, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import type { TopicCount } from "./matching";

const GAP = 4;

export interface Circle extends SimulationNodeDatum, TopicCount {
  r: number;
  x: number;
  y: number;
}

/**
 * Packs the topics into a cloud of circles sized by how many people picked
 * each one. Phones get a tall cloud, wider screens a wide one. The layout is
 * worked out once, up front, so nothing moves on screen.
 */
export function layoutTopicCircles(topics: TopicCount[], width: number): { circles: Circle[]; height: number } {
  const narrow = width < 640;
  // Small enough to fit the screen, big enough for the label in the smallest one.
  const [rMin, rMax] = narrow ? [40, 66] : [40, Math.min(92, Math.round(width / 10.5))];
  const most = Math.max(1, ...topics.map((t) => t.count));
  const circles: Circle[] = [...topics]
    .sort((a, b) => b.count - a.count)
    .map((t, i) => {
      // Start on a spiral, biggest in the middle, so the result is the same every time.
      // It's stretched across wide screens and down narrow ones.
      const angle = i * 2.4;
      const dist = 12 * Math.sqrt(i);
      const [sx, sy] = narrow ? [1, 2] : [4, 1];
      return { ...t, r: rMin + (rMax - rMin) * Math.sqrt(t.count / most), x: width / 2 + dist * sx * Math.cos(angle), y: dist * sy * Math.sin(angle) };
    });

  const simulation = forceSimulation(circles)
    .force("x", forceX<Circle>(width / 2).strength(narrow ? 0.2 : 0.02))
    .force("y", forceY<Circle>(0).strength(narrow ? 0.08 : 0.4))
    .force("collide", forceCollide<Circle>((c) => c.r + GAP).iterations(4))
    .stop();
  for (let i = 0; i < 400; i++) {
    simulation.tick();
    for (const c of circles) c.x = Math.min(width - c.r, Math.max(c.r, c.x));
  }

  const top = Math.min(...circles.map((c) => c.y - c.r));
  const bottom = Math.max(...circles.map((c) => c.y + c.r));
  for (const c of circles) c.y -= top;
  return { circles, height: bottom - top };
}

