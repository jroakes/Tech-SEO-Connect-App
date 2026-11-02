// Topics attendees pick on the Meet page as things they're interested in.
// IDs are stored in profiles, so keep them stable.
export const TOPICS = [
  { id: "ai-search", label: "AI search & LLMs" },
  { id: "ai-brand-visibility", label: "AI brand visibility" },
  { id: "ai-agents", label: "AI agents & the agentic web" },
  { id: "ai-bots", label: "AI bots & crawlers" },
  { id: "information-retrieval", label: "Information retrieval & ranking" },
  { id: "bigquery", label: "BigQuery" },
  { id: "log-files", label: "Log files" },
  { id: "crawling", label: "Crawling & indexing" },
  { id: "javascript", label: "JavaScript SEO" },
  { id: "structured-data", label: "Structured data" },
  { id: "video", label: "Video SEO" },
  { id: "python", label: "Python & automation" },
  { id: "building-with-ai", label: "Coding & building with AI" },
  { id: "analytics", label: "Analytics & GA4" },
  { id: "reporting", label: "Reporting & dashboards" },
  { id: "serp-data", label: "SERP data & rank tracking" },
  { id: "migrations", label: "Site migrations" },
  { id: "international", label: "International SEO" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "content-at-scale", label: "Content at scale" },
  { id: "core-web-vitals", label: "Core Web Vitals" },
  { id: "local", label: "Local SEO" },
  { id: "edge-seo", label: "Edge SEO" },
  { id: "agency", label: "Running an agency" },
  { id: "in-house", label: "In-house SEO" },
  { id: "careers", label: "Careers & hiring" },
] as const;

/** How many topics an attendee can pick. */
export const MAX_TOPICS = 3;

export type TopicId = (typeof TOPICS)[number]["id"];
export const TOPIC_IDS = TOPICS.map((t) => t.id) as [TopicId, ...TopicId[]];
export const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? id;
