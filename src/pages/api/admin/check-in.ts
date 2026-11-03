import type { APIRoute } from "astro";
import { z } from "zod";
import { getUserId, json } from "@/lib/auth-server";
import { recentAdmin } from "@/lib/clerk";
import { addWalkIn, checkIn, CheckInError, isDemo, search, undoCheckIn } from "@/lib/check-in";

export const prerender = false;

const requestSchema = z.discriminatedUnion("action", [
  // single: false always lists the closest guests, as after "Wrong person?".
  z.object({ action: z.literal("search"), query: z.string().trim().min(1).max(200), single: z.boolean().optional() }),
  z.object({ action: z.literal("check_in"), guestId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("undo"), guestId: z.string().min(1).max(100) }),
  // newPerson: the admin says they aren't a guest with a similar name.
  z.object({ action: z.literal("walk_in"), name: z.string().trim().min(1).max(200), email: z.email().max(200), newPerson: z.boolean().optional() }),
]);

/** The check-in desk: find a guest, check them in or undo it, or add a walk-in (admins only). */
export const POST: APIRoute = async ({ request, locals }) => {
  const admin = await recentAdmin(locals);
  if (!admin) return json({ error: "Only admins can check guests in." }, getUserId(locals) ? 403 : 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request." }, 400);
  const req = parsed.data;

  try {
    const demo = isDemo();
    if (req.action === "search") return json({ demo, ...(await search(req.query, req.single ?? true)) });
    if (req.action === "check_in") return json({ demo, guest: await checkIn(req.guestId, admin.id) });
    if (req.action === "undo") return json({ demo, guest: await undoCheckIn(req.guestId) });
    return json({ demo, ...(await addWalkIn(req.name, req.email.toLowerCase(), admin.id, req.newPerson ?? false)) });
  } catch (err) {
    if (err instanceof CheckInError) return json({ error: err.message }, 400);
    console.error(`Check-in ${req.action} failed`, err);
    return json({ error: "That didn't work. Please try again." }, 500);
  }
};
