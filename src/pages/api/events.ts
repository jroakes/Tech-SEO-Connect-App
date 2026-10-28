import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { insertEvents } from "@/lib/db";
import { parseEventBatch } from "@/lib/events";
import { getUserId } from "@/lib/auth-server";

export const prerender = false;

const MAX_BODY_BYTES = 32_000;

export const POST: APIRoute = async ({ request, locals }) => {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  const events = parseEventBatch(body);
  if (!events) return new Response(null, { status: 400 });

  const userId = getUserId(locals);
  try {
    await insertEvents(
      env.DB,
      events.map((e) => ({ ...e, userId })),
    );
  } catch (err) {
    console.error("Failed to store events", err);
    return new Response(null, { status: 503 });
  }
  return new Response(null, { status: 204 });
};
