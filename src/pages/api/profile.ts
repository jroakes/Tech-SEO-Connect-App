import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { TOPIC_IDS } from "@/data/topics";
import { getUserId, json } from "@/lib/auth-server";
import { currentUser, displayName } from "@/lib/clerk";
import { deleteProfile, getProfile, saveProfile } from "@/lib/profiles";

export const prerender = false;

const text = (max: number) => z.string().trim().max(max).optional();
const topics = z.array(z.enum(TOPIC_IDS)).max(6);
const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: text(120),
  workingOn: text(400),
  wantToLearn: text(400),
  canHelp: text(400),
  learnTopics: topics,
  helpTopics: topics,
  contact: text(160),
});

/** The signed-in attendee's matchmaking profile (or null), plus their name from their account. */
export const GET: APIRoute = async ({ locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to use matchmaking." }, 401);
  const [profile, user] = await Promise.all([getProfile(env.DB, userId), currentUser(locals)]);
  return json({ profile, suggestedName: user ? displayName(user) : "" });
};

/** Joins matchmaking or updates the attendee's answers. */
export const PUT: APIRoute = async ({ request, locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to use matchmaking." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Please check your answers.", issues: parsed.error.issues }, 400);
  if (!parsed.data.learnTopics.length && !parsed.data.helpTopics.length) {
    return json({ error: "Pick at least one topic so we can find your people." }, 400);
  }

  const user = await currentUser(locals);
  const profile = { userId, imageUrl: user?.imageUrl ?? null, ...parsed.data };
  await saveProfile(env.DB, profile);
  return json({ profile });
};

/** Leaves matchmaking: the attendee's answers are deleted and no longer shown. */
export const DELETE: APIRoute = async ({ locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to use matchmaking." }, 401);
  await deleteProfile(env.DB, userId);
  return new Response(null, { status: 204 });
};
