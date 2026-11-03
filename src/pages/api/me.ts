import type { APIRoute } from "astro";
import { getUserId, json } from "@/lib/auth-server";
import { isRecentAdmin } from "@/lib/clerk";

export const prerender = false;

/** Whether the signed-in user is an admin, so the account menu can link to the admin page. */
export const GET: APIRoute = async ({ locals }) => {
  if (!getUserId(locals)) return json({ error: "Not signed in." }, 401);
  return json({ admin: await isRecentAdmin(locals) });
};
