// Meet logic, shared by the Meet page, its API and its tests. Everything here
// is pure: it works on profiles already loaded from the database.
import { TOPICS } from "../data/topics";

export interface Profile {
  userId: string;
  name: string;
  imageUrl?: string | null;
  title?: string | null;
  topics: string[];
  linkedin?: string | null;
}

/** One of your topics and the other attendees interested in it. */
export interface TopicPeople {
  topic: string;
  label: string;
  people: Profile[];
}

/** For each topic `me` picked, in the usual topic order, everyone else who picked it, by name. */
export function peopleByTopic(me: Profile, others: Profile[]): TopicPeople[] {
  return TOPICS.filter(({ id }) => me.topics.includes(id)).map(({ id, label }) => ({
    topic: id,
    label,
    people: others.filter((p) => p.userId !== me.userId && p.topics.includes(id)).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/**
 * A LinkedIn profile link from what someone typed: a full link, one without
 * https://, or just their handle. Returns null if it isn't a LinkedIn link.
 */
export function linkedinUrl(input: string): string | null {
  const value = input.trim().replace(/^@/, "");
  if (/^[\w-]+$/.test(value)) return `https://www.linkedin.com/in/${value}`;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
    const path = url.pathname.replace(/\/+$/, "");
    return path ? `https://www.linkedin.com${path}` : null;
  } catch {
    return null;
  }
}
