import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TopicCount } from "@/lib/matching";
import { layoutTopicCircles } from "@/lib/topic-layout";

// Your topics, dark enough for white text.
const MINE = "#087A55";

export function TopicCircles({ topics, mine, onOpen }: { topics: TopicCount[]; mine: string[]; onOpen: (topic: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current!;
    const observer = new ResizeObserver(() => setWidth(Math.round(el.getBoundingClientRect().width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { circles, height } = useMemo(() => (width ? layoutTopicCircles(topics, width) : { circles: [], height: 0 }), [topics, width]);

  return (
    <div ref={ref} className="relative" style={{ height }} data-testid="topic-circles">
      {circles.map((c) => {
        const yours = mine.includes(c.topic);
        const size = c.r < 56 ? "text-[11px]" : c.r < 80 ? "text-xs" : "text-sm";
        const shared = {
          className: "absolute flex flex-col items-center justify-center rounded-full border px-2 text-center leading-tight",
          style: { left: c.x - c.r, top: c.y - c.r, width: c.r * 2, height: c.r * 2 },
          "aria-label": `${c.label}: ${c.count} ${c.count === 1 ? "person" : "people"}`,
          "data-testid": `circle-${c.topic}`,
        };
        const label = (
          <>
            <span className={`${size} font-semibold`} style={{ textWrap: "balance" }}>
              {c.label}
            </span>
            <span className={`mt-0.5 text-[11px] ${yours ? "text-white/80" : "text-muted-foreground"}`}>{c.count}</span>
          </>
        );
        // Only your own topics open; the rest just show how many people picked them.
        return yours ? (
          <button
            key={c.topic}
            type="button"
            onClick={() => onOpen(c.topic)}
            {...shared}
            className={`${shared.className} border-transparent text-white shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
            style={{ ...shared.style, background: MINE }}
            aria-label={`${shared["aria-label"]}, one of your topics`}
          >
            {label}
          </button>
        ) : (
          <div key={c.topic} role="img" {...shared} className={`${shared.className} border-primary/25 bg-primary/10 text-foreground`}>
            {label}
          </div>
        );
      })}
    </div>
  );
}

/** The key under the circles: what the dark ones mean. */
export function TopicCirclesKey() {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full" style={{ background: MINE }} />
        Your topics
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border border-primary/25 bg-primary/10" />
        Other topics
      </span>
      <span>Number of people in each. Tap one of yours to see who's in it.</span>
    </p>
  );
}
