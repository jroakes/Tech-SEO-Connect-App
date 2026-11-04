import type { APIRoute } from "astro";
import { z } from "zod";
import { getUserId, json } from "@/lib/auth-server";
import { currentAdmin } from "@/lib/clerk";
import { addWalkUp, WalkUpError } from "@/lib/walk-ups";

export const prerender = false;

const walkUpSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(200),
});

/** Adds a walk-up to the event in Luma with a free ticket (admins only). */
export const POST: APIRoute = async ({ request, locals }) => {
  const admin = await currentAdmin(locals);
  if (!admin) return json({ error: "Only admins can add walk-ups." }, getUserId(locals) ? 403 : 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  const parsed = walkUpSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Please add their name and a valid email." }, 400);

  try {
    return json(await addWalkUp(parsed.data.name, parsed.data.email.toLowerCase(), admin.id));
  } catch (err) {
    if (err instanceof WalkUpError) return json({ error: err.message }, 400);
    console.error("Adding a walk-up failed", err);
    return json({ error: "That didn't work. Please try again." }, 500);
  }
};
