// Finding a registered guest from what's typed at the check-in desk: a full
// name, a last name, or an email. This picks the likely candidates; the AI
// then judges and orders them (see src/lib/check-in.ts).

export interface Guest {
  /** Luma's guest ID, or walkin-… for someone added at the desk. */
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  /** Luma's approval status: approved, declined, waitlist, invited, pending_approval… */
  status: string;
  tickets: string[];
  /** When they were checked in in Luma itself, if they were. */
  lumaCheckedInAt: string | null;
}

/** Lowercase words without accents or punctuation: "Siân O'Neil-Ray" → ["sian", "oneil", "ray"]. */
export function words(text: string | null | undefined): string[] {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const isEmail = (query: string) => query.includes("@");
const emailUser = (email: string) => email.split("@")[0];

// Jaro-Winkler similarity, 0 to 1: forgiving of typos, and of the end of a
// word more than its start.
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aHit = new Array<boolean>(a.length).fill(false);
  const bHit = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (!bHit[j] && a[i] === b[j]) {
        aHit[i] = bHit[j] = true;
        matches++;
        break;
      }
    }
  }
  if (!matches) return 0;
  let swaps = 0;
  for (let i = 0, k = 0; i < a.length; i++) {
    if (!aHit[i]) continue;
    while (!bHit[k]) k++;
    if (a[i] !== b[k]) swaps++;
    k++;
  }
  return (matches / a.length + matches / b.length + (matches - swaps / 2) / matches) / 3;
}

export function similarity(a: string, b: string): number {
  const j = jaro(a, b);
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return j + prefix * 0.1 * (1 - j);
}

const nameWords = (g: Guest) => [...new Set([...words(g.name), ...words(g.firstName), ...words(g.lastName)])];

// How well one typed word matches the best of a guest's name words.
function wordScore(typed: string, theirs: string[]): number {
  let best = 0;
  for (const word of theirs) {
    const score = word === typed ? 1 : typed.length >= 2 && word.startsWith(typed) ? 0.92 : similarity(typed, word);
    best = Math.max(best, score);
  }
  return best;
}

/**
 * How likely a guest is the one typed, 0 to 1, from spelling alone, and
 * whether one typed word is clearly one of their names (so "Bob Smith" still
 * finds Robert Smith for the AI to judge).
 */
export function matchScore(query: string, guest: Guest): { score: number; sharesAName: boolean } {
  const email = guest.email.toLowerCase();
  if (isEmail(query)) {
    const typed = query.trim().toLowerCase();
    if (typed === email) return { score: 1, sharesAName: true };
    return { score: Math.max(similarity(typed, email), similarity(emailUser(typed), emailUser(email)) * 0.95), sharesAName: false };
  }
  const typed = words(query);
  if (!typed.length) return { score: 0, sharesAName: false };
  const theirs = nameWords(guest);
  const scores = typed.map((word) => wordScore(word, theirs));
  let score = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  // One word that's part of their email, like "jroakes".
  if (typed.length === 1 && typed[0].length >= 4 && emailUser(email).includes(typed[0])) score = Math.max(score, 0.9);
  return { score, sharesAName: typed.length > 1 && Math.max(...scores) >= 0.95 };
}

const MIN_SCORE = 0.78; // below this, a guest isn't worth showing the AI
const MAX_CANDIDATES = 25; // enough for everyone with a common name

/** The guests worth judging, closest first. */
export function candidates(query: string, guests: Guest[]): { guest: Guest; score: number }[] {
  return guests
    .map((guest) => ({ guest, ...matchScore(query, guest) }))
    .filter((c) => c.score >= MIN_SCORE || c.sharesAName)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map(({ guest, score }) => ({ guest, score }));
}

/**
 * The one guest whose email or full name is exactly what was typed, or null
 * when nobody or more than one registration is (someone who registered twice
 * gets the list, with any declined one flagged). No need to ask the AI then.
 */
export function exactMatch(query: string, guests: Guest[]): Guest | null {
  let hits: Guest[];
  if (isEmail(query)) {
    const typed = query.trim().toLowerCase();
    hits = guests.filter((g) => g.email.toLowerCase() === typed);
  } else {
    const typed = words(query).join(" ");
    hits = typed ? guests.filter((g) => words(g.name).join(" ") === typed || words(`${g.firstName ?? ""} ${g.lastName ?? ""}`).join(" ") === typed) : [];
  }
  return hits.length === 1 ? hits[0] : null;
}

/** Whether every word typed is one of the guest's names: "john" for John Murch. */
export function sharesName(query: string, guest: Guest): boolean {
  const typed = words(query);
  const theirs = nameWords(guest);
  return typed.length > 0 && typed.every((w) => theirs.includes(w));
}

/** Livestream-only guests are registered, but not for the room. */
export const livestreamOnly = (g: Guest) => g.tickets.length > 0 && g.tickets.every((t) => /livestream/i.test(t));
