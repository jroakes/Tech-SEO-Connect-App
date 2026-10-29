import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getUserId, json } from "@/lib/auth-server";
import { listProfiles } from "@/lib/profiles";

export const prerender = false;

/**
 * Everyone in matchmaking, for an attendee who has joined. Matchmaking works
 * both ways: only people who share their own answers can see others'.
 */
export const GET: APIRoute = async ({ locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to use matchmaking." }, 401);
  const profiles = await listProfiles(env.DB);
  const me = profiles.find((p) => p.userId === userId);
  if (!me) return json({ error: "Answer the questions first to see your matches." }, 403);
  return json({ me, others: profiles.filter((p) => p.userId !== userId) });
};
