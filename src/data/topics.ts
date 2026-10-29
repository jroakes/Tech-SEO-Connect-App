// Topics attendees pick in matchmaking, as things they want to learn or can
// help with. IDs are stored in profiles, so keep them stable.
export const TOPICS = [
  { id: "ai-search", label: "AI search & LLMs" },
  { id: "bigquery", label: "BigQuery" },
  { id: "log-files", label: "Log files" },
  { id: "crawling", label: "Crawling & indexing" },
  { id: "javascript", label: "JavaScript SEO" },
  { id: "structured-data", label: "Structured data" },
  { id: "python", label: "Python & automation" },
  { id: "analytics", label: "Analytics & GA4" },
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

export type TopicId = (typeof TOPICS)[number]["id"];
export const TOPIC_IDS = TOPICS.map((t) => t.id) as [TopicId, ...TopicId[]];
export const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? id;
