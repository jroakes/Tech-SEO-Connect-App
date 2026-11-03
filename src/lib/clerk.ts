// Server-side Clerk: the Backend API client, the signed-in user, and who's an
// admin. Admins are organizers listed in ORGANIZER_EMAILS (always) plus anyone
// an admin has promoted, which is stored as publicMetadata.role = "admin".
import { env } from "cloudflare:workers";
import { createClerkClient, type User } from "@clerk/backend";
import { getUserId } from "./auth-server";

export type { User };

export function clerk() {
  return createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
}

/** The signed-in user's full Clerk record, or null. */
export async function currentUser(locals: App.Locals): Promise<User | null> {
  const userId = getUserId(locals);
  if (!userId) return null;
  try {
    return await clerk().users.getUser(userId);
  } catch (err) {
    console.error("Couldn't load the signed-in user from Clerk", err);
    return null;
  }
}

const verifiedEmails = (user: User) =>
  user.emailAddresses.filter((e) => e.verification?.status === "verified").map((e) => e.emailAddress.toLowerCase());

/** Organizers are set in the app's settings and can't be demoted, blocked or deleted from the admin page. */
export function isOrganizer(user: User): boolean {
  const organizers = (env.ORGANIZER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return verifiedEmails(user).some((e) => organizers.includes(e));
}

export function isAdmin(user: User): boolean {
  return user.publicMetadata?.role === "admin" || isOrganizer(user);
}

/** The signed-in user if they're an admin, otherwise null. */
export async function currentAdmin(locals: App.Locals): Promise<User | null> {
  const user = await currentUser(locals);
  return user && isAdmin(user) ? user : null;
}

const adminChecks = new Map<string, { admin: boolean; at: number }>(); // user ID → Clerk's last answer

/**
 * Whether the signed-in user is an admin, trusting Clerk's answer from the
 * last minute, so requests that come often (the account menu on every page,
 * check-in) don't each wait on Clerk. Its API allows 100 requests per 10
 * seconds on a development instance and 1,000 in production.
 */
export async function isRecentAdmin(locals: App.Locals): Promise<boolean> {
  const userId = getUserId(locals);
  if (!userId) return false;
  const known = adminChecks.get(userId);
  if (known && Date.now() - known.at < 60_000) return known.admin;
  const user = await currentUser(locals);
  if (!user) return false; // Clerk didn't answer: ask again next time
  const admin = isAdmin(user);
  adminChecks.set(userId, { admin, at: Date.now() });
  return admin;
}

/** The signed-in admin's ID, from `isRecentAdmin`, or null. */
export async function recentAdmin(locals: App.Locals): Promise<{ id: string } | null> {
  return (await isRecentAdmin(locals)) ? { id: getUserId(locals)! } : null;
}

export function displayName(user: User): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.emailAddresses[0]?.emailAddress || "Attendee";
}

export function primaryEmail(user: User): string | null {
  return user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}
