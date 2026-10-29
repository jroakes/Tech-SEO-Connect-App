import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { json } from "@/lib/auth-server";
import { clerk, currentAdmin, displayName, isAdmin, isOrganizer } from "@/lib/clerk";
import { deleteUserData, insertEvents } from "@/lib/db";

export const prerender = false;

const ACTIONS = ["make_admin", "remove_admin", "block", "unblock", "delete"] as const;
// Actions an admin can't take on their own account or on an organizer.
const PROTECTED: (typeof ACTIONS)[number][] = ["remove_admin", "block", "delete"];

const actionSchema = z.object({
  userId: z.string().min(1).max(100),
  action: z.enum(ACTIONS),
});

/** An admin changes another user: makes them an admin or not, blocks or unblocks them, or deletes them. */
export const POST: APIRoute = async ({ request, locals }) => {
  const admin = await currentAdmin(locals);
  if (!admin) return json({ error: "Only admins can do this." }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request." }, 400);
  const { userId, action } = parsed.data;

  const users = clerk().users;
  let target;
  try {
    target = await users.getUser(userId);
  } catch {
    return json({ error: "That user doesn't exist." }, 404);
  }
  if (PROTECTED.includes(action)) {
    if (target.id === admin.id) return json({ error: "You can't do that to your own account." }, 400);
    if (isOrganizer(target)) return json({ error: `${displayName(target)} is an organizer in the app's settings (ORGANIZER_EMAILS), so they stay an admin.` }, 400);
  }

  if (action === "make_admin") target = await users.updateUserMetadata(userId, { publicMetadata: { role: "admin" } });
  if (action === "remove_admin") target = await users.updateUserMetadata(userId, { publicMetadata: { role: null } });
  if (action === "block") target = await users.banUser(userId);
  if (action === "unblock") target = await users.unbanUser(userId);
  if (action === "delete") {
    await users.deleteUser(userId);
    await deleteUserData(env.DB, userId);
  }

  // An audit trail of admin changes, in the events table.
  await insertEvents(env.DB, [{ type: "admin_action", ts: Date.now(), userId: admin.id, path: "/admin", props: { action, target_user_id: userId } }]).catch((err) =>
    console.error("Failed to log an admin action", err),
  );

  if (action === "delete") return json({ deleted: true });
  return json({ user: { id: target.id, admin: isAdmin(target), banned: target.banned } });
};
