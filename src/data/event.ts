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
};

export const pageDescription = `Tech SEO Connect conference in ${event.city}, ${event.dateRange}. The schedule, local restaurants, hotels and things to do, and conference sponsors.`;
