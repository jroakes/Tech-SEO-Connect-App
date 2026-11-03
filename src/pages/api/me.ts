import type { APIRoute } from "astro";
import { getUserId, json } from "@/lib/auth-server";
import { currentUser, isOrganizer } from "@/lib/clerk";

export const prerender = false;

/**
 * Whether the signed-in user is an organizer (ORGANIZER_EMAILS), who's always
 * an admin. The account menu asks once per sign-in; other admins it knows
 * from their account.
 */
export const GET: APIRoute = async ({ locals }) => {
  if (!getUserId(locals)) return json({ error: "Not signed in." }, 401);
  const user = await currentUser(locals);
  // Not an answer to keep: the menu asks again on the next page.
  if (!user) return json({ error: "Couldn't reach Clerk." }, 503);
  return json({ organizer: isOrganizer(user) });
};
