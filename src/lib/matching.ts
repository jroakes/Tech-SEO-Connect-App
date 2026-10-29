// Matchmaking logic, shared by the Meet page and its tests. Everything here
// is pure: it works on profiles already loaded from the database.
import { TOPICS, topicLabel } from "../data/topics";

export interface Profile {
  userId: string;
  name: string;
  imageUrl?: string | null;
  role?: string | null;
  workingOn?: string | null;
  wantToLearn?: string | null;
  canHelp?: string | null;
  learnTopics: string[];
  helpTopics: string[];
  contact?: string | null;
}

/** Why two people should meet, from the first person's point of view. */
export interface Reason {
  kind: "can_help" | "wants_your_help" | "also_learning";
  topic: string;
}

export interface Match {
  person: Profile;
  score: number;
  reasons: Reason[];
}

// How much each kind of overlap counts toward a match.
const WEIGHTS: Record<Reason["kind"], number> = { can_help: 3, wants_your_help: 2, also_learning: 1 };

/** The reasons `me` and `them` should meet, strongest first. */
export function reasonsToMeet(me: Profile, them: Profile): Reason[] {
  const reasons: Reason[] = [];
  for (const topic of me.learnTopics) {
    if (them.helpTopics.includes(topic)) reasons.push({ kind: "can_help", topic });
    else if (them.learnTopics.includes(topic)) reasons.push({ kind: "also_learning", topic });
  }
  for (const topic of me.helpTopics) {
    if (them.learnTopics.includes(topic)) reasons.push({ kind: "wants_your_help", topic });
  }
  return reasons.sort((a, b) => WEIGHTS[b.kind] - WEIGHTS[a.kind]);
}

/** The people `me` should meet, best first, with the reasons why. */
export function rankMatches(me: Profile, others: Profile[], limit = 6): Match[] {
  return others
    .filter((p) => p.userId !== me.userId)
    .map((person) => {
      const reasons = reasonsToMeet(me, person);
      return { person, reasons, score: reasons.reduce((sum, r) => sum + WEIGHTS[r.kind], 0) };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
    .slice(0, limit);
}

/** A topic's group: who can help with it and who wants to learn it. */
export interface Group {
  topic: string;
  label: string;
  helpers: Profile[];
  learners: Profile[];
  size: number;
}

/** Every topic someone has picked, biggest group first. */
export function topicGroups(people: Profile[]): Group[] {
  return TOPICS.map(({ id, label }) => {
    const helpers = people.filter((p) => p.helpTopics.includes(id));
    const learners = people.filter((p) => p.learnTopics.includes(id) && !p.helpTopics.includes(id));
    return { topic: id, label, helpers, learners, size: helpers.length + learners.length };
  })
    .filter((g) => g.size > 0)
    .sort((a, b) => b.size - a.size || a.label.localeCompare(b.label));
}

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 1);

/**
 * What a search like "bigquery" or "log file analysis" finds: the topic it
 * names (if any) and everyone who mentions it in their answers.
 */
export function search(query: string, people: Profile[]): { topic: string | null; people: Profile[] } {
  const terms = words(query);
  if (!terms.length) return { topic: null, people: [] };
  const topic =
    TOPICS.find(({ id, label }) => {
      const topicWords = [...words(label), ...words(id.replace(/-/g, " "))];
      return terms.some((t) => topicWords.some((w) => w.startsWith(t) || t.startsWith(w)));
    })?.id ?? null;
  const matches = people.filter((p) => {
    if (topic && (p.learnTopics.includes(topic) || p.helpTopics.includes(topic))) return true;
    const text = `${p.role ?? ""} ${p.workingOn ?? ""} ${p.wantToLearn ?? ""} ${p.canHelp ?? ""}`.toLowerCase();
    return terms.every((t) => text.includes(t));
  });
  return { topic, people: matches };
}

/** A short phrase for a reason, e.g. "Can help you with BigQuery". */
export function describeReason(reason: Reason): string {
  const topic = topicLabel(reason.topic);
  if (reason.kind === "can_help") return `Can help you with ${topic}`;
  if (reason.kind === "wants_your_help") return `Wants help with ${topic}`;
  return `Also learning ${topic}`;
}
