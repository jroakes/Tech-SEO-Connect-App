import { handle } from "@astrojs/cloudflare/handler";
import { mcpHandlerFor } from "./mcp/server";
import { authenticateMcp, handleOAuthDiscovery, withCors } from "./lib/mcp-auth";
import { syncSchedule } from "./lib/schedule-sync";

// The pages built from the synced schedule are the same for everyone, so each
// Cloudflare location keeps them for five minutes instead of reading the
// database on every visit. The schedule syncs hourly, so a change shows within
// five minutes of the sync.
const EDGE_CACHED = new Set(["/schedule", "/my-conference"]);
const EDGE_SECONDS = 300;

async function edgeCached(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const key = new Request(url.origin + url.pathname);
  // Cloudflare's cache for this location (the browser's CacheStorage type doesn't know it).
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(key);
  if (hit) {
    // The five minutes are for this cache only; browsers ask again each time.
    const response = new Response(hit.body, hit);
    response.headers.delete("Cache-Control");
    return response;
  }
  const response = await handle(request, env, ctx);
  if (response.status === 200) {
    const copy = new Response(response.clone().body, response);
    copy.headers.set("Cache-Control", `public, max-age=${EDGE_SECONDS}`);
    ctx.waitUntil(cache.put(key, copy));
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const discovery = await handleOAuthDiscovery(request);
    if (discovery) return discovery;

    if (new URL(request.url).pathname === "/mcp") {
      // The MCP server needs a signed-in user (Clerk OAuth), so tools can use
      // their saved talks and places.
      const auth = await authenticateMcp(request, env.CLERK_SECRET_KEY);
      if (auth instanceof Response) return auth;
      return withCors(await mcpHandlerFor(auth.userId)(request, env, ctx));
    }
    if (request.method === "GET" && EDGE_CACHED.has(new URL(request.url).pathname)) return edgeCached(request, env, ctx);
    return handle(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    // The crons in wrangler.jsonc.
    if (controller.cron === "0 * * * *") ctx.waitUntil(syncSchedule(env));
  },
} satisfies ExportedHandler<Env>;
