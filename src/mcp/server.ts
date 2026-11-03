import { env } from "cloudflare:workers";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import placesData from "@/data/places.json";
import { sponsors } from "@/data/sponsors";
import { event } from "@/data/event";
import { TOPICS, topicLabel } from "@/data/topics";
import { getSavedIds, getSchedule, insertEvents, updateSaved } from "@/lib/db";
import { peopleIn, sharingATopic, topicCounts, type Profile } from "@/lib/matching";
import { googleMapsUrl } from "@/lib/maps";
import { listProfiles } from "@/lib/profiles";
import { fold } from "@/lib/utils";
import { formatDuration, getScheduleDays } from "@/lib/sessions";
import type { Place, Session } from "@/lib/types";

const places = placesData as Place[];
const categories = [...new Set(places.map((p) => p.category))].sort();

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const SAVES = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function sessionSummary(s: Session) {
  return {
    id: s.id,
    ...(s.date ? { date: s.date } : { day: s.day }),
    time: s.time,
    ...(s.duration ? { duration: formatDuration(s.duration) } : {}),
    title: s.title,
    ...(s.speaker ? { speaker: s.speaker } : {}),
    ...(s.description ? { description: s.description } : {}),
    ...(s.isBreak ? { break: true } : {}),
  };
}

function placeSummary(p: Place) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    ...(p.narrative ? { about: p.narrative } : {}),
    ...(p.address ? { address: p.address } : {}),
    googleMaps: googleMapsUrl(p),
    ...(p.isVenue ? { conferenceVenue: true } : {}),
  };
}

// What Meet shows of someone: no account IDs or photos.
function personSummary(p: Profile, sharedTopics: string[]) {
  return {
    name: p.name,
    ...(p.title ? { title: p.title } : {}),
    ...(p.linkedin ? { linkedin: p.linkedin } : {}),
    sharedTopics: sharedTopics.map(topicLabel),
  };
}

const NOT_ON_MEET = `This attendee hasn't joined Meet yet. They can pick up to three topics at ${event.appUrl}/meet, and then see who else picked them.`;

async function logToolCall(userId: string, tool: string, props: Record<string, unknown> = {}) {
  try {
    await insertEvents(env.DB, [{ type: "mcp_tool_call", ts: Date.now(), userId, path: "/mcp", props: { tool, ...props } }]);
  } catch (err) {
    console.error("Failed to log MCP tool call", err);
  }
}

/** The MCP server for one signed-in attendee (their Clerk user ID). */
function createServer(userId: string) {
  const log = (tool: string, props?: Record<string, unknown>) => logToolCall(userId, tool, props);

  const server = new McpServer(
    { name: "tech-seo-connect-app", version: "1.0.0" },
    {
      instructions: `Information about the ${event.name} conference in ${event.city}, ${event.dateRange}: the schedule of talks and speakers, recommended restaurants, bars, coffee, hotels and things to do near the venue, and the sponsors. Use get_event_info for dates and venue, get_schedule or search_sessions for talks, find_places for local recommendations and list_sponsors for sponsors. The attendee is signed in: get_my_conference shows the talks and places they've saved (also in the app at ${event.appUrl}), and save_to_my_conference and remove_from_my_conference change it. Meet (${event.appUrl}/meet) matches attendees by the topics they're interested in: get_meet_topics shows how many people picked each topic, and find_people_to_meet lists the people who share this attendee's topics, with LinkedIn to message them and meet up. Meet works only once the attendee has joined it in the app.`,
    },
  );

  server.registerTool(
    "get_event_info",
    {
      title: "Conference info",
      description: `Dates, city, venue, days and links for ${event.name}.`,
      annotations: READ_ONLY,
    },
    async () => {
      await log("get_event_info");
      const venue = places.find((p) => p.isVenue);
      const days = getScheduleDays(await getSchedule(env.DB));
      return text({
        name: event.name,
        dates: event.dateRange,
        city: event.city,
        venue: event.venueName,
        ...(venue ? { venueMap: placeSummary(venue).googleMaps } : {}),
        scheduleDays: days.map((d) => ({ date: d.date, label: d.label })),
        website: event.website,
        app: event.appUrl,
        timezone: event.timezone,
      });
    },
  );

  server.registerTool(
    "get_schedule",
    {
      title: "Conference schedule",
      description: "The full conference schedule in order, including breaks, receptions and parties. Optionally just one date (get_event_info lists the dates).",
      inputSchema: z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Only this date, as YYYY-MM-DD"),
      }),
      annotations: READ_ONLY,
    },
    async ({ date }) => {
      await log("get_schedule", date ? { date } : {});
      const sessions = await getSchedule(env.DB);
      return text(sessions.filter((s) => !date || s.date === date).map(sessionSummary));
    },
  );

  server.registerTool(
    "search_sessions",
    {
      title: "Search talks",
      description: "Find talks by words in the title, speaker name or description, for example 'log files', 'crawl' or a speaker's name.",
      inputSchema: z.object({
        query: z.string().min(1).max(100).describe("Words to look for"),
      }),
      annotations: READ_ONLY,
    },
    async ({ query }) => {
      await log("search_sessions", { query });
      const terms = fold(query).split(/\s+/).filter(Boolean);
      const sessions = await getSchedule(env.DB);
      const matches = sessions.filter((s) => {
        if (s.isBreak) return false;
        const haystack = fold(`${s.title} ${s.speaker ?? ""} ${s.description ?? ""}`);
        return terms.every((t) => haystack.includes(t));
      });
      return text(matches.length ? matches.map(sessionSummary) : `No talks match "${query}".`);
    },
  );

  server.registerTool(
    "find_places",
    {
      title: "Local recommendations",
      description: `Restaurants, bars, coffee, hotels and things to do the organizers recommend near the venue. Categories: ${categories.join(", ")}.`,
      inputSchema: z.object({
        category: z.string().max(60).optional().describe(`One of: ${categories.join(", ")}`),
        query: z.string().max(100).optional().describe("Words to look for in the name or description, for example 'tacos' or 'rooftop'"),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum results (default 15)"),
      }),
      annotations: READ_ONLY,
    },
    async ({ category, query, limit = 15 }) => {
      await log("find_places", { ...(category ? { category } : {}), ...(query ? { query } : {}) });
      const wantCategory = category?.toLowerCase();
      const terms = query ? fold(query).split(/\s+/).filter(Boolean) : [];
      const matches = places.filter((p) => {
        if (wantCategory && p.category.toLowerCase() !== wantCategory) return false;
        const haystack = fold(`${p.name} ${p.narrative ?? ""}`);
        return terms.every((t) => haystack.includes(t));
      });
      return text(matches.length ? matches.slice(0, limit).map(placeSummary) : "No places match. Try another category or fewer words.");
    },
  );

  server.registerTool(
    "list_sponsors",
    {
      title: "Sponsors",
      description: `Companies sponsoring ${event.name}, with their websites.`,
      annotations: READ_ONLY,
    },
    async () => {
      await log("list_sponsors");
      return text(sponsors.map((s) => ({ name: s.name, website: s.url })));
    },
  );

  server.registerTool(
    "get_my_conference",
    {
      title: "My Conference",
      description: "The talks and places (hotels, restaurants, bars, coffee, things to do) this attendee has saved, talks in schedule order.",
      annotations: READ_ONLY,
    },
    async () => {
      await log("get_my_conference");
      const [talkIds, placeIds, sessions] = await Promise.all([
        getSavedIds(env.DB, "session", userId),
        getSavedIds(env.DB, "place", userId),
        getSchedule(env.DB),
      ]);
      const saved = new Set(placeIds);
      return text({
        talks: sessions.filter((s) => talkIds.includes(s.id)).map(sessionSummary),
        places: places.filter((p) => saved.has(p.id)).map(placeSummary),
      });
    },
  );

  server.registerTool(
    "get_meet_topics",
    {
      title: "Meet topics",
      description:
        "Meet matches attendees by the topics they're interested in. Every topic with how many people picked it, which ones this attendee picked, and their own Meet answers. Only for attendees who've joined Meet in the app.",
      annotations: READ_ONLY,
    },
    async () => {
      await log("get_meet_topics");
      const profiles = await listProfiles(env.DB);
      const me = profiles.find((p) => p.userId === userId);
      if (!me) return text(NOT_ON_MEET);
      return text({
        myAnswers: { name: me.name, ...(me.title ? { title: me.title } : {}), topics: me.topics.map(topicLabel), ...(me.linkedin ? { linkedin: me.linkedin } : {}) },
        topics: topicCounts(profiles).map((t) => ({ topic: t.label, people: t.count, ...(me.topics.includes(t.topic) ? { mine: true } : {}) })),
        app: `${event.appUrl}/meet`,
      });
    },
  );

  server.registerTool(
    "find_people_to_meet",
    {
      title: "People to meet",
      description:
        "People on Meet who share this attendee's topics, by topic, with their title and LinkedIn so the attendee can message them and meet up at the conference. As in the app, only for attendees who've joined Meet, and only people in topics they picked themselves.",
      inputSchema: z.object({
        topic: z.string().max(80).optional().describe("Just one of the attendee's topics, by name (get_meet_topics lists them)"),
      }),
      annotations: READ_ONLY,
    },
    async ({ topic }) => {
      await log("find_people_to_meet", topic ? { topic } : {});
      const profiles = await listProfiles(env.DB);
      const me = profiles.find((p) => p.userId === userId);
      if (!me) return text(NOT_ON_MEET);
      let topics = me.topics;
      if (topic) {
        const wanted = topic.trim().toLowerCase();
        const found = TOPICS.find((t) => t.id === wanted || t.label.toLowerCase() === wanted);
        if (!found || !me.topics.includes(found.id)) {
          return text(`Meet shows people only in the attendee's own topics: ${me.topics.map(topicLabel).join(", ") || "none yet"}.`);
        }
        topics = [found.id];
      }
      const others = sharingATopic(me, profiles);
      return text(
        topics.map((t) => ({
          topic: topicLabel(t),
          people: peopleIn(t, others).map((p) => personSummary(p, p.topics.filter((x) => me.topics.includes(x)))),
        })),
      );
    },
  );

  const itemSchema = z.object({
    kind: z.enum(["talk", "place"]).describe("A talk (id from get_schedule or search_sessions) or a place (id from find_places)"),
    id: z.string().min(1).max(120).describe("The talk's or place's id"),
  });
  // Checks the id and returns what it refers to (with the props the app logs
  // for a save), or an error message.
  const findItem = async (kind: "talk" | "place", id: string) => {
    if (kind === "place") {
      const place = places.find((p) => p.id === id);
      if (!place) return `No place has the id "${id}". Use find_places to look it up.`;
      return { name: place.name, props: { place_id: place.id, place_name: place.name, category: place.category } };
    }
    const session = (await getSchedule(env.DB)).find((s) => s.id === id && !s.isBreak);
    if (!session) return `No talk has the id "${id}". Use search_sessions or get_schedule to look it up.`;
    return { name: session.title, props: { session_id: session.id, title: session.title, ...(session.speaker ? { speaker: session.speaker } : {}), day: session.day } };
  };
  // Saves and removals made through the assistant count in the analytics like ones made in the app.
  const logSave = (kind: "talk" | "place", saved: boolean, props: Record<string, unknown>) =>
    insertEvents(env.DB, [{ type: `${kind === "talk" ? "session" : "place"}_${saved ? "save" : "unsave"}`, ts: Date.now(), userId, path: "/mcp", props }]).catch(
      (err) => console.error("Failed to log an MCP save", err),
    );

  server.registerTool(
    "save_to_my_conference",
    {
      title: "Save to My Conference",
      description: "Saves a talk or place to this attendee's My Conference list.",
      inputSchema: itemSchema,
      annotations: SAVES,
    },
    async ({ kind, id }) => {
      await log("save_to_my_conference", { kind, id });
      const item = await findItem(kind, id);
      if (typeof item === "string") return text(item);
      const savedKind = kind === "talk" ? "session" : "place";
      if ((await getSavedIds(env.DB, savedKind, userId)).includes(id)) return text(`"${item.name}" is already in My Conference.`);
      await updateSaved(env.DB, savedKind, userId, [id], []);
      await logSave(kind, true, item.props);
      return text(`Saved "${item.name}" to My Conference.`);
    },
  );

  server.registerTool(
    "remove_from_my_conference",
    {
      title: "Remove from My Conference",
      description: "Removes a talk or place from this attendee's My Conference list.",
      inputSchema: itemSchema,
      annotations: { ...SAVES, destructiveHint: true },
    },
    async ({ kind, id }) => {
      await log("remove_from_my_conference", { kind, id });
      const item = await findItem(kind, id);
      if (typeof item === "string") return text(item);
      const savedKind = kind === "talk" ? "session" : "place";
      if (!(await getSavedIds(env.DB, savedKind, userId)).includes(id)) return text(`"${item.name}" isn't in My Conference.`);
      await updateSaved(env.DB, savedKind, userId, [], [id]);
      await logSave(kind, false, item.props);
      return text(`Removed "${item.name}" from My Conference.`);
    },
  );

  return server;
}

/** The MCP request handler for one signed-in attendee. */
export const mcpHandlerFor = (userId: string) => createMcpHandler(() => createServer(userId), { route: "/mcp" });
