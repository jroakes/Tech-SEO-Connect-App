// Calling the app's API routes in tests, as a signed-in user or not.
import type { APIContext, APIRoute } from "astro";

const BASE = "https://app.test";

/** Calls an Astro API route the way the app does, with `user` as the signed-in Clerk user. */
export async function call(route: APIRoute, options: { method?: string; path?: string; body?: unknown; user?: string | null } = {}) {
  const url = new URL(options.path ?? "/", BASE);
  const request = new Request(url, {
    method: options.method ?? "GET",
    ...(options.body !== undefined ? { body: typeof options.body === "string" ? options.body : JSON.stringify(options.body), headers: { "Content-Type": "application/json" } } : {}),
  });
  const locals = { auth: () => ({ userId: options.user ?? null }) };
  const res = await route({ request, url, locals } as unknown as APIContext);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

/** Rows of a table, for checking what was written. */
export async function rows<T = Record<string, unknown>>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  return (await db.prepare(sql).bind(...params).all<T>()).results;
}
