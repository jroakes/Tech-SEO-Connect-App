import type { ConferenceDay } from "@/lib/types";

// Conference details shown across the app and returned by the MCP server.
// Still the 2025 values until the 2026 content update.
export const event = {
  name: "Tech SEO Connect",
  city: "Durham, NC",
  venueName: "The Fruit",
  dateRange: "December 4-5, 2025",
  shortDateRange: "Dec 4-5, 2025",
  timezone: "America/New_York",
  website: "https://www.techseoconnect.com",
  appUrl: "https://app.techseoconnect.com",
  mapCenter: [35.994, -78.8986] as [number, number],
  // Dates of the bundled fallback schedule. The live schedule's days come
  // from the synced data (see getScheduleDays).
  days: [
    { day: 1, date: "2025-12-04", label: "Day 1 - Dec 4" },
    { day: 2, date: "2025-12-05", label: "Day 2 - Dec 5" },
  ] satisfies ConferenceDay[],
};

export const pageDescription = `Tech SEO Connect conference in ${event.city}, ${event.dateRange}. The schedule, local restaurants, hotels and things to do, and conference sponsors.`;
