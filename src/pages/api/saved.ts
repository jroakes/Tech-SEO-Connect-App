import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { getSavedIds, updateSaved, type SavedKind } from "@/lib/db";
import { getUserId, json } from "@/lib/auth-server";

export const prerender = false;

const kind = z.enum(["session", "place"]);
const ids = z.array(z.string().min(1).max(120)).max(200);
const changeSchema = z.object({
  kind,
  add: ids.optional(),
  remove: ids.optional(),
});

/** The signed-in user's saved talks (?kind=session) or places (?kind=place). */
export const GET: APIRoute = async ({ locals, url }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to see what you've saved." }, 401);
  const parsed = kind.safeParse(url.searchParams.get("kind") ?? "session");
  if (!parsed.success) return json({ error: "Invalid kind." }, 400);
  return json({ ids: await getSavedIds(env.DB, parsed.data, userId) });
};

/** Adds and removes saved talks or places, then returns the full list of that kind. */
export const POST: APIRoute = async ({ request, locals }) => {
  const userId = getUserId(locals);
  if (!userId) return json({ error: "Sign in to save." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  const parsed = changeSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request." }, 400);

  const savedKind: SavedKind = parsed.data.kind;
  await updateSaved(env.DB, savedKind, userId, parsed.data.add ?? [], parsed.data.remove ?? []);
  return json({ ids: await getSavedIds(env.DB, savedKind, userId) });
};
