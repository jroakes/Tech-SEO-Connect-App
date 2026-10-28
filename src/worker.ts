import { handle } from "@astrojs/cloudflare/handler";
import { mcpHandler } from "./mcp/server";
import { syncSchedule } from "./lib/schedule-sync";

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/mcp") {
      return mcpHandler(request, env, ctx);
    }
    return handle(request, env, ctx);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(syncSchedule(env));
  },
} satisfies ExportedHandler<Env>;
