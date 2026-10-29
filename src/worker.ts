import { handle } from "@astrojs/cloudflare/handler";
import { mcpHandlerFor } from "./mcp/server";
import { authenticateMcp, handleOAuthDiscovery, withCors } from "./lib/mcp-auth";
import { syncSchedule } from "./lib/schedule-sync";

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
    return handle(request, env, ctx);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(syncSchedule(env));
  },
} satisfies ExportedHandler<Env>;
