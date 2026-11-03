// The fake account for tests/fake-auth/client.ts, at /__test/user in the
// browser tests' build only (see astro.config.mjs).
import type { APIRoute } from "astro";
import { createClerkClient } from "./backend";
import { TEST_USER_COOKIE } from "./server";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Fake sign-in is only for local tests.");
  const id = cookies.get(TEST_USER_COOKIE)?.value;
  const user = id ? await createClerkClient().users.getUser(id) : null;
  const body = user && !user.banned ? { id: user.id, publicMetadata: user.publicMetadata } : null;
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};
