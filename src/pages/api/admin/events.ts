import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getUserId, json } from "@/lib/auth-server";
import { currentAdmin } from "@/lib/clerk";

export const prerender = false;

const COLUMNS = ["id", "ts", "type", "anon_id", "user_id", "path", "props"] as const;
type Row = Record<(typeof COLUMNS)[number], string | number | null>;
const PAGE = 5000; // rows per database read, so a big table streams out in pieces

// RFC 4180: quote a field that has a comma, a quote or a line break.
const csvField = (value: string | number | null) => {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const parseProps = (props: string | number | null) => {
  if (typeof props !== "string") return null;
  try {
    return JSON.parse(props);
  } catch {
    return props;
  }
};

/**
 * Every logged event, oldest first, for an admin to load into another tool.
 * `?format=csv` (the default) keeps props as a JSON column; `?format=json` is
 * an array of objects with props parsed.
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const admin = await currentAdmin(locals);
  if (!admin) return json({ error: "Only admins can download events." }, getUserId(locals) ? 403 : 401);

  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        send(format === "csv" ? `${COLUMNS.join(",")}\r\n` : "[");
        let after = 0;
        let first = true;
        for (;;) {
          const { results } = await env.DB.prepare(`SELECT ${COLUMNS.join(", ")} FROM events WHERE id > ? ORDER BY id LIMIT ?`)
            .bind(after, PAGE)
            .all<Row>();
          for (const row of results) {
            if (format === "csv") send(`${COLUMNS.map((c) => csvField(row[c])).join(",")}\r\n`);
            else {
              send(`${first ? "" : ","}\n${JSON.stringify({ ...row, props: parseProps(row.props) })}`);
              first = false;
            }
          }
          if (results.length < PAGE) break;
          after = Number(results[results.length - 1].id);
        }
        if (format === "json") send("\n]\n");
        controller.close();
      } catch (err) {
        console.error("Couldn't export events", err);
        controller.error(err);
      }
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tech-seo-connect-app-events-${date}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
};
