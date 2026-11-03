import type { APIRoute } from "astro";
import { z } from "zod";
import { getUserId, json } from "@/lib/auth-server";
import { recentAdmin } from "@/lib/clerk";
import { addWalkIn, checkIn, CheckInError, isDemo, scan, search, setLive, undoCheckIn } from "@/lib/check-in";

export const prerender = false;

const requestSchema = z.discriminatedUnion("action", [
  // single: false lists every close guest except `exclude`, as after "Wrong person?".
  z.object({
    action: z.literal("search"),
    query: z.string().trim().min(1).max(200),
    single: z.boolean().optional(),
    exclude: z.string().min(1).max(100).optional(),
  }),
  // What a guest's Luma ticket QR code says: https://luma.com/check-in/evt-…?pk=…
  z.object({ action: z.literal("scan"), code: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal("check_in"), guestId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("undo"), guestId: z.string().min(1).max(100) }),
  // newPerson: the admin says they aren't a guest with a similar name. live:
  // the mode the admin saw, so a walk-in isn't sent to Luma by surprise.
  z.object({
    action: z.literal("walk_in"),
    name: z.string().trim().min(1).max(200),
    email: z.email().max(200),
    newPerson: z.boolean().optional(),
    live: z.boolean().optional(),
  }),
  // The live switch, for every desk.
  z.object({ action: z.literal("set_live"), live: z.boolean() }),
]);

/**
 * The check-in desk: find a guest by name or ticket QR code, check them in or
 * undo it, add a walk-in, or turn live check-in on or off (admins only). Every
 * answer says whether the desk is in demo mode, so each phone shows the switch
 * as it is.
 */
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

  const answer = async (data: object, status = 200) => json({ ...data, demo: await isDemo() }, status);
  try {
    if (req.action === "search") return answer(await search(req.query, req.single ?? true, req.exclude));
    if (req.action === "scan") return answer(await scan(req.code));
    if (req.action === "check_in") return answer({ guest: await checkIn(req.guestId, admin.id) });
    if (req.action === "undo") return answer({ guest: await undoCheckIn(req.guestId, admin.id) });
    if (req.action === "set_live") return (await setLive(req.live, admin.id), answer({}));
    return answer(await addWalkIn(req.name, req.email.toLowerCase(), admin.id, req.newPerson ?? false, req.live));
  } catch (err) {
    if (err instanceof CheckInError) return answer({ error: err.message }, 400);
    console.error(`Check-in ${req.action} failed`, err);
    return json({ error: "That didn't work. Please try again." }, 500);
  }
};
