import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getUserId, json } from "@/lib/auth-server";
import { sharingATopic, topicCounts } from "@/lib/matching";
import { listProfiles } from "@/lib/profiles";

export const prerender = false;

/**
 * For an attendee who has joined: how many people picked each topic, and the
 * people in their own topics. It works both ways: only people who share
 * their own answers can see others', and only in the topics they picked.
 */
export const GET: APIRoute = async ({ locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to meet people." }, 401);
  const profiles = await listProfiles(env.DB);
  const me = profiles.find((p) => p.userId === userId);
  if (!me) return json({ error: "Pick your topics first to see who else picked them." }, 403);
  return json({ me, others: sharingATopic(me, profiles), counts: topicCounts(profiles) });
};
