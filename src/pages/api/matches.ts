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
 * Others come without their account IDs or the topics they don't share, so
 * nobody can tell who picked a topic they didn't.
 */
export const GET: APIRoute = async ({ locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to meet people." }, 401);
  const profiles = await listProfiles(env.DB);
  const me = profiles.find((p) => p.userId === userId);
  if (!me) return json({ error: "Pick your topics first to see who else picked them." }, 403);
  const others = sharingATopic(me, profiles).map((p, i) => ({
    userId: `person-${i + 1}`,
    name: p.name,
    title: p.title,
    imageUrl: p.imageUrl,
    linkedin: p.linkedin,
    topics: p.topics.filter((t) => me.topics.includes(t)),
  }));
  return json({ me, others, counts: topicCounts(profiles) });
};
