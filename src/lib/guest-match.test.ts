import { describe, expect, it } from "vitest";
import { candidates, exactMatch, livestreamOnly, matchScore, sharesName, words, type Guest } from "./guest-match";

const guest = (id: string, firstName: string, lastName: string, extra: Partial<Guest> = {}): Guest => ({
  id,
  name: `${firstName} ${lastName}`,
  firstName,
  lastName,
  email: `${firstName}.${lastName}@example.com`.toLowerCase(),
  status: "approved",
  tickets: ["General Admission"],
  lumaCheckedInAt: null,
  ...extra,
});

const guests = [
  guest("robert", "Robert", "Smith"),
  guest("lee", "Lee", "Smith"),
  guest("sian", "Siân", "O'Neil"),
  guest("jon", "Jonathan", "Ubri", { email: "jubri@agency.co" }),
  guest("kate-declined", "Kate", "Lopez", { status: "declined", tickets: [] }),
  guest("kate", "Kate", "Lopez", { email: "kate@lopez.dev" }),
  guest("amy-1", "Amy", "Chen", { tickets: ["Livestream"] }),
  guest("amy-2", "Amy", "Chen", { email: "amy@chen.io" }),
];
const ids = (list: { guest: Guest }[]) => list.map((c) => c.guest.id);

describe("words", () => {
  it("drops accents, apostrophes and punctuation", () => {
    expect(words("Siân O'Neil-Ray")).toEqual(["sian", "oneil", "ray"]);
  });
});

describe("exactMatch", () => {
  it("finds a full name or an email, whatever the case or accents", () => {
    expect(exactMatch("sian oneil", guests)?.id).toBe("sian");
    expect(exactMatch(" JUBRI@agency.co ", guests)?.id).toBe("jon");
  });

  it("isn't sure when two approved registrations share the name", () => {
    expect(exactMatch("Amy Chen", guests)).toBeNull();
  });

  it("isn't sure when someone registered twice, even if declined once", () => {
    expect(exactMatch("kate lopez", guests)).toBeNull();
  });

  it("needs the whole name", () => {
    expect(exactMatch("Smith", guests)).toBeNull();
  });
});

describe("candidates", () => {
  it("finds everyone with a last name", () => {
    expect(ids(candidates("smith", guests))).toEqual(expect.arrayContaining(["robert", "lee"]));
  });

  it("forgives a typo", () => {
    expect(ids(candidates("Jonathon Ubry", guests))[0]).toBe("jon");
  });

  it("keeps someone who shares a name, for the AI to judge a nickname", () => {
    expect(ids(candidates("Bob Smith", guests))).toContain("robert");
  });

  it("matches a mistyped email", () => {
    expect(ids(candidates("jubri@agncy.co", guests))[0]).toBe("jon");
  });

  it("finds nobody for nonsense", () => {
    expect(candidates("zzz qqq", guests)).toEqual([]);
  });
});

describe("matchScore", () => {
  it("counts a word from their email", () => {
    expect(matchScore("jubri", guests[3]).score).toBeGreaterThanOrEqual(0.9);
  });
});

describe("a Luma account name that differs from the registration's", () => {
  const paula = guest("paula", "Paula", "Morris", { otherName: "Matt Hill" });
  it("finds them by either name", () => {
    expect(exactMatch("Matt Hill", [paula, ...guests])?.id).toBe("paula");
    expect(exactMatch("paula morris", [paula, ...guests])?.id).toBe("paula");
    expect(candidates("Hill", [paula, ...guests])[0].guest.id).toBe("paula");
  });
});

describe("sharesName", () => {
  it("is true when every word typed is one of their names", () => {
    expect(sharesName("smith", guests[0])).toBe(true);
    expect(sharesName("Robert SMITH", guests[0])).toBe(true);
    expect(sharesName("bob smith", guests[0])).toBe(false);
  });
});

describe("livestreamOnly", () => {
  it("is true only when every ticket is a livestream", () => {
    expect(livestreamOnly(guests[6])).toBe(true);
    expect(livestreamOnly(guests[7])).toBe(false);
    expect(livestreamOnly(guests[4])).toBe(false);
  });
});
