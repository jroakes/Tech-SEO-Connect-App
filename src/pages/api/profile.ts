import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { MAX_TOPICS, TOPIC_IDS } from "@/data/topics";
import { getUserId, json } from "@/lib/auth-server";
import { currentUser, displayName } from "@/lib/clerk";
import { linkedinUrl } from "@/lib/matching";
import { deleteProfile, getProfile, saveProfile } from "@/lib/profiles";

export const prerender = false;

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  title: z.string().trim().max(120).optional(),
  topics: z.array(z.enum(TOPIC_IDS)).max(TOPIC_IDS.length),
  linkedin: z.string().trim().max(200).optional(),
});

/** The signed-in attendee's Meet profile (or null), plus their name from their account. */
export const GET: APIRoute = async ({ locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to meet people." }, 401);
  const [profile, user] = await Promise.all([getProfile(env.DB, userId), currentUser(locals)]);
  return json({ profile, suggestedName: user ? displayName(user) : "" });
};

/** Joins the Meet page or updates the attendee's answers. */
export const PUT: APIRoute = async ({ request, locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to meet people." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Please check your answers.", issues: parsed.error.issues }, 400);
  const { name, title, topics, linkedin } = parsed.data;
  if (!topics.length) return json({ error: "Pick at least one topic so we can find your people." }, 400);
  if (new Set(topics).size > MAX_TOPICS) return json({ error: `Pick up to ${MAX_TOPICS} topics.` }, 400);
  const link = linkedin ? linkedinUrl(linkedin) : null;
  if (linkedin && !link) return json({ error: "That doesn't look like a LinkedIn profile. Try linkedin.com/in/yourname." }, 400);

  const user = await currentUser(locals);
  const profile = { userId, name, title, topics: [...new Set(topics)], linkedin: link, imageUrl: user?.imageUrl ?? null };
  await saveProfile(env.DB, profile);
  return json({ profile });
};

/** Leaves the Meet page: the attendee's answers are deleted and no longer shown. */
export const DELETE: APIRoute = async ({ locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to meet people." }, 401);
  await deleteProfile(env.DB, userId);
  return new Response(null, { status: 204 });
};
