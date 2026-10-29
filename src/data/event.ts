import type { ConferenceDay } from "@/lib/types";

// Conference details shown across the app and returned by the MCP server.
export const event = {
  name: "Tech SEO Connect",
  city: "Durham, NC",
  venueName: "Bay 7",
  dateRange: "November 5-6, 2026",
  shortDateRange: "Nov 5-6, 2026",
  timezone: "America/New_York",
  website: "https://www.techseoconnect.com",
  appUrl: "https://app.techseoconnect.com",
  // Between Bay 7 and the downtown core. Bay 7 itself is 35.9934627, -78.9052607.
  mapCenter: [35.9955, -78.9025] as [number, number],
  // Dates of the bundled fallback schedule. The live schedule's days come
  // from the synced data (see getScheduleDays).
  days: [
    { day: 1, date: "2026-11-05", label: "Day 1 - Nov 5" },
    { day: 2, date: "2026-11-06", label: "Day 2 - Nov 6" },
  ] satisfies ConferenceDay[],
};

export const pageDescription = `Tech SEO Connect conference in ${event.city}, ${event.dateRange}. The schedule, local restaurants, hotels and things to do, and conference sponsors.`;
