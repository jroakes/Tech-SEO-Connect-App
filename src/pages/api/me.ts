import type { APIRoute } from "astro";
import { json } from "@/lib/auth-server";
import { currentUser, isAdmin } from "@/lib/clerk";

export const prerender = false;

/** Whether the signed-in user is an admin, so the account menu can link to the admin page. */
export const GET: APIRoute = async ({ locals }) => {
  const user = await currentUser(locals);
  if (!user) return json({ error: "Not signed in." }, 401);
  return json({ admin: isAdmin(user) });
};
