import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { getSavedSessionIds, updateSavedSessions } from "@/lib/db";
import { getUserId, json } from "@/lib/auth-server";

export const prerender = false;

const sessionIds = z.array(z.string().min(1).max(120)).max(200);
const changeSchema = z.object({
  add: sessionIds.optional(),
  remove: sessionIds.optional(),
});

export const GET: APIRoute = async ({ locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to see saved sessions." }, 401);
  return json({ sessionIds: await getSavedSessionIds(env.DB, userId) });
};

/** Adds and removes saved sessions, then returns the full list. */
export const POST: APIRoute = async ({ request, locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to save sessions." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  const parsed = changeSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request." }, 400);

  await updateSavedSessions(env.DB, userId, parsed.data.add ?? [], parsed.data.remove ?? []);
  return json({ sessionIds: await getSavedSessionIds(env.DB, userId) });
};
