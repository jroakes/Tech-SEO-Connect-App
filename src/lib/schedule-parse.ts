import type { SessionInput } from "./types";

// Parses the schedule section of www.techseoconnect.com. Its markup:
//
//   <section class="launch-schedule-day">
//     <header><h3>Thursday</h3><p>November 5, 2026</p></header>
//     <ol>
//       <li class="launch-schedule-row">
//         <time>9:00–9:30 AM</time>
//         <div>
//           <h4 class="launch-schedule-row__speaker">Speaker</h4>    (talks)
//           <p class="launch-schedule-row__title">Talk title</p>
//         </div>
//       </li>
//       <li class="launch-schedule-row">
//         <time>10:00–10:30 AM</time>
//         <div><h4>Networking Break</h4><p>Details…</p></div>     (everything else)
//       </li>
//
// If the main site's markup changes, update this parser and its fixture test.

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…" };

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** "November 5, 2026" -> "2026-11-05" */
export function parseLongDate(text: string): string | null {
  const m = text.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

type Meridiem = "AM" | "PM";

function parseClock(text: string, fallback?: Meridiem): { minutes: number; meridiem?: Meridiem } | null {
  const t = text.trim().toLowerCase();
  if (t === "midnight") return { minutes: 24 * 60, meridiem: "AM" };
  if (t === "noon") return { minutes: 12 * 60, meridiem: "PM" };
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  const meridiem = (m[3]?.toUpperCase() as Meridiem | undefined) ?? fallback;
  if (!meridiem) return null;
  let hour = Number(m[1]) % 12;
  if (meridiem === "PM") hour += 12;
  return { minutes: hour * 60 + Number(m[2] ?? 0), meridiem: m[3] ? meridiem : undefined };
}

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const meridiem = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(minutes % 60).padStart(2, "0")} ${meridiem}`;
}

/** "8:00–8:50 AM" -> { time: "8:00 AM", duration: 50 } */
export function parseTimeRange(text: string): { time: string; duration: number } | null {
  const [startText, endText] = text.split(/\s*[–—-]\s*/);
  if (!endText) {
    const single = parseClock(startText);
    return single ? { time: formatClock(single.minutes), duration: 0 } : null;
  }

  const end = parseClock(endText);
  if (!end) return null;
  const endMeridiem: Meridiem = end.meridiem ?? (end.minutes >= 12 * 60 ? "PM" : "AM");

  let start = parseClock(startText, endMeridiem);
  if (!start) return null;
  // "11:30–1:00 PM" means 11:30 AM: a start without AM/PM can't be after the end.
  if (!/am|pm/i.test(startText) && start.minutes > end.minutes && endMeridiem === "PM") {
    start = parseClock(startText, "AM");
    if (!start) return null;
  }

  let duration = end.minutes - start.minutes;
  if (duration <= 0) duration += 24 * 60;
  return { time: formatClock(start.minutes), duration };
}

const firstMatch = (html: string, re: RegExp) => html.match(re)?.[1] ?? "";

export interface ParsedSchedule {
  sessions: SessionInput[];
  warnings: string[];
}

export function parseMainSiteSchedule(html: string): ParsedSchedule {
  const sessions: SessionInput[] = [];
  const warnings: string[] = [];

  const sections = [...html.matchAll(/<section class="launch-schedule-day[^"]*"[^>]*>([\s\S]*?)<\/section>/g)];
  sections.forEach(([, section], index) => {
    const dateText = htmlToText(firstMatch(section, /<header[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/));
    const date = parseLongDate(dateText);
    if (!date) warnings.push(`Couldn't read the date "${dateText}" for day ${index + 1}.`);
    const day = index + 1;

    for (const [, row] of section.matchAll(/<li class="launch-schedule-row"[^>]*>([\s\S]*?)<\/li>/g)) {
      const timeText = htmlToText(firstMatch(row, /<time[^>]*>([\s\S]*?)<\/time>/));
      const time = parseTimeRange(timeText);
      const heading = row.match(/<h4(?:\s+class="([^"]*)")?[^>]*>([\s\S]*?)<\/h4>/);
      if (!time || !heading) {
        warnings.push(`Skipped a row on day ${day} with time "${timeText}".`);
        continue;
      }

      const headingText = htmlToText(heading[2]);
      const isTalk = (heading[1] ?? "").includes("launch-schedule-row__speaker");
      const paragraphs = [...row.matchAll(/<p(?:\s+class="([^"]*)")?[^>]*>([\s\S]*?)<\/p>/g)].map(([, cls = "", inner]) => ({
        isTitle: cls.includes("launch-schedule-row__title"),
        text: htmlToText(inner),
      }));
      const details = paragraphs
        .filter((p) => !p.isTitle && p.text)
        .map((p) => p.text)
        .join(" ");

      sessions.push({
        day,
        ...(date ? { date } : {}),
        time: time.time,
        duration: time.duration,
        title: isTalk ? (paragraphs.find((p) => p.isTitle)?.text || "Talk title to be announced") : headingText,
        ...(isTalk ? { speaker: headingText } : {}),
        isBreak: !isTalk,
        ...(details ? { description: details } : {}),
      });
    }
  });

  if (!sections.length) warnings.push("No schedule days found on the page.");
  return { sessions, warnings };
}
