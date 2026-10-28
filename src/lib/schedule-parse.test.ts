import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { htmlToText, parseLongDate, parseMainSiteSchedule, parseTimeRange } from "./schedule-parse";
import { assignSessionIds, getScheduleDays } from "./sessions";

// Schedule section of www.techseoconnect.com as of 2026-10-28.
const fixture = readFileSync(new URL("./__fixtures__/main-site-schedule.html", import.meta.url), "utf8");

describe("parseTimeRange", () => {
  it.each([
    ["8:00–8:50 AM", "8:00 AM", 50],
    ["11:30 AM–1:00 PM", "11:30 AM", 90],
    ["1:00–1:30 PM", "1:00 PM", 30],
    ["11:30–1:00 PM", "11:30 AM", 90],
    ["5:00–7:00 PM", "5:00 PM", 120],
    ["9:00 PM–2:00 AM", "9:00 PM", 300],
    ["5:00 PM–Midnight", "5:00 PM", 420],
    ["12:00–1:00 PM", "12:00 PM", 60],
    ["7:30 PM", "7:30 PM", 0],
  ])("%s", (input, time, duration) => {
    expect(parseTimeRange(input)).toEqual({ time, duration });
  });

  it("rejects text that isn't a time", () => {
    expect(parseTimeRange("TBD")).toBeNull();
  });
});

describe("parseLongDate", () => {
  it("reads the main site's dates", () => {
    expect(parseLongDate("November 4, 2026")).toBe("2026-11-04");
    expect(parseLongDate("Nov 4")).toBeNull();
  });
});

describe("htmlToText", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToText(`I Can&#39;t Code. <a href="#">Here</a>&rsquo;s how &amp; why`)).toBe("I Can't Code. Here ’s how & why");
  });
});

describe("parseMainSiteSchedule", () => {
  const { sessions, warnings } = parseMainSiteSchedule(fixture);

  it("reads every row without warnings", () => {
    expect(warnings).toEqual([]);
    expect(sessions).toHaveLength(37);
  });

  it("finds the three days, including the Wednesday welcome evening", () => {
    const days = getScheduleDays(assignSessionIds(sessions));
    expect(days.map((d) => [d.date, d.label])).toEqual([
      ["2026-11-04", "Wed, Nov 4"],
      ["2026-11-05", "Thu, Nov 5"],
      ["2026-11-06", "Fri, Nov 6"],
    ]);
  });

  it("separates talks from breaks and events", () => {
    const talk = sessions.find((s) => s.speaker === "Jamie Indigo");
    expect(talk).toMatchObject({
      date: "2026-11-05",
      time: "11:00 AM",
      duration: 30,
      title: "The Philosophy Minor’s Guide to Log Files",
      isBreak: false,
    });

    const party = sessions.find((s) => s.title === "Welcome Party");
    expect(party).toMatchObject({ date: "2026-11-04", time: "7:00 PM", duration: 180, isBreak: true });
    expect(party?.speaker).toBeUndefined();
    expect(party?.description).toContain("Mateo Tapas");
  });

  it("decodes apostrophes in titles", () => {
    expect(sessions.some((s) => s.title.startsWith("I Can't Code."))).toBe(true);
  });

  it("gives every session a unique, date-based ID", () => {
    const ids = assignSessionIds(sessions).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("2026-11-05-jamie-indigo");
  });

  it("reports a page with no schedule", () => {
    expect(parseMainSiteSchedule("<html></html>").warnings).toContain("No schedule days found on the page.");
  });
});
