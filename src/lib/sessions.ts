import type { ConferenceDay, Session, SessionInput } from "./types";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Talks are keyed by date and speaker, so a retitled talk keeps its ID (and
 * everyone's saved sessions). Breaks have no speaker, so they're keyed by
 * time and title. Duplicates get a numeric suffix.
 */
export function assignSessionIds(sessions: SessionInput[]): Session[] {
  const used = new Set<string>();
  return sessions.map((session) => {
    const basis = session.isBreak || !session.speaker ? `${session.time} ${session.title}` : session.speaker;
    const base = `${session.date ?? `d${session.day}`}-${slugify(basis)}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return { ...session, id };
  });
}

// A talk's ID without its date: the speaker part, which stays when a talk moves day.
const withoutDate = (id: string) => id.replace(/^(\d{4}-\d{2}-\d{2}|d\d+)-/, "");

/**
 * A saved talk's ID in today's schedule. A talk that moved to another day has
 * a new ID (the date is part of it), so an ID that's gone is matched to the
 * one talk now with the same speaker. Otherwise the ID is returned as it is.
 */
export function currentSessionId(id: string, sessions: Session[]): string {
  if (sessions.some((s) => s.id === id)) return id;
  const moved = sessions.filter((s) => !s.isBreak && withoutDate(s.id) === withoutDate(id));
  return moved.length === 1 ? moved[0].id : id;
}

/** The day the schedule opens on: today during the conference, otherwise the first day. */
export function openingDay(days: ConferenceDay[], today: string): ConferenceDay | undefined {
  return days.find((d) => d.date === today) ?? days[0];
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "";
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

const dayLabelFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** e.g. "2026-11-05" -> "Thu, Nov 5" */
export function formatDayLabel(isoDate: string): string {
  return dayLabelFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

/** The days that appear in a schedule, in order, with tab labels. */
export function getScheduleDays(sessions: Session[]): ConferenceDay[] {
  const days = new Map<number, ConferenceDay>();
  for (const s of sessions) {
    if (!days.has(s.day)) {
      days.set(s.day, { day: s.day, date: s.date ?? "", label: s.date ? formatDayLabel(s.date) : `Day ${s.day}` });
    }
  }
  return [...days.values()].sort((a, b) => a.day - b.day);
}
