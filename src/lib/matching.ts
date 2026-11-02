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

/** A topic and how many people picked it. */
export interface TopicCount {
  topic: string;
  label: string;
  count: number;
}

/** Every topic, in the usual topic order, with how many people picked it (zero included). */
export function topicCounts(people: Profile[]): TopicCount[] {
  return TOPICS.map(({ id, label }) => ({ topic: id, label, count: people.filter((p) => p.topics.includes(id)).length }));
}

/** Everyone who picked a topic, by name. */
export function peopleIn(topic: string, people: Profile[]): Profile[] {
  return people.filter((p) => p.topics.includes(topic)).sort((a, b) => a.name.localeCompare(b.name));
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
