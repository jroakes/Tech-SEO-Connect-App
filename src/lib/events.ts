import { z } from "zod";
import type { EventRecord } from "./db";

/** Event types the browser may log. MCP tool calls are logged server-side. */
export const CLIENT_EVENT_TYPES = [
  "page_view",
  "map_button_click",
  "place_view",
  "session_save",
  "session_unsave",
  "place_save",
  "place_unsave",
  "mcp_modal_open",
  "mcp_url_copy",
  "match_join",
  "match_search",
] as const;

const propValue = z.union([z.string().max(300), z.number(), z.boolean()]);

const batchSchema = z.object({
  anonId: z.string().max(64).optional(),
  events: z
    .array(
      z.object({
        type: z.enum(CLIENT_EVENT_TYPES),
        path: z.string().max(200).optional(),
        props: z
          .record(z.string().max(40), propValue)
          .refine((p) => Object.keys(p).length <= 12, "too many props")
          .optional(),
        ts: z.number().optional(),
      }),
    )
    .min(1)
    .max(25),
});

/** Parses a batch from the browser. Returns null if it isn't valid. */
export function parseEventBatch(body: unknown): Omit<EventRecord, "userId">[] | null {
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) return null;

  const now = Date.now();
  return parsed.data.events.map((e) => ({
    type: e.type,
    // Trust the client clock only within a day of the server's.
    ts: e.ts && Math.abs(now - e.ts) < 86_400_000 ? e.ts : now,
    anonId: parsed.data.anonId,
    path: e.path,
    props: e.props,
  }));
}
