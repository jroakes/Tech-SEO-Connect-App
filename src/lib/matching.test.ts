import { describe, expect, it } from "vitest";
import { describeReason, rankMatches, reasonsToMeet, search, topicGroups, type Profile } from "./matching";

const person = (userId: string, learnTopics: string[], helpTopics: string[], extra: Partial<Profile> = {}): Profile => ({
  userId,
  name: userId,
  learnTopics,
  helpTopics,
  ...extra,
});

const me = person("me", ["bigquery", "log-files"], ["python"]);
const helper = person("helper", [], ["bigquery"]);
const learner = person("learner", ["python"], []);
const peer = person("peer", ["log-files"], []);
const stranger = person("stranger", ["local"], ["agency"]);

describe("reasonsToMeet", () => {
  it("finds every overlap, strongest first", () => {
    expect(reasonsToMeet(me, person("x", ["log-files", "python"], ["bigquery"]))).toEqual([
      { kind: "can_help", topic: "bigquery" },
      { kind: "wants_your_help", topic: "python" },
      { kind: "also_learning", topic: "log-files" },
    ]);
  });

  it("counts someone who can help as a helper, not a fellow learner", () => {
    expect(reasonsToMeet(me, person("x", ["bigquery"], ["bigquery"]))).toEqual([{ kind: "can_help", topic: "bigquery" }]);
  });
});

describe("rankMatches", () => {
  it("ranks helpers above people who want your help, above fellow learners", () => {
    const ranked = rankMatches(me, [peer, stranger, learner, helper, me]);
    expect(ranked.map((m) => m.person.userId)).toEqual(["helper", "learner", "peer"]);
  });

  it("leaves out people with nothing in common, and yourself", () => {
    const ranked = rankMatches(me, [stranger, me]);
    expect(ranked).toEqual([]);
  });

  it("respects the limit", () => {
    expect(rankMatches(me, [helper, learner, peer], 2)).toHaveLength(2);
  });
});

describe("topicGroups", () => {
  it("groups people by topic, biggest first, without counting anyone twice", () => {
    const groups = topicGroups([helper, peer, person("both", ["bigquery"], ["bigquery"]), person("x", ["bigquery"], [])]);
    expect(groups[0]).toMatchObject({ topic: "bigquery", size: 3 });
    expect(groups[0].helpers.map((p) => p.userId)).toEqual(["helper", "both"]);
    expect(groups[0].learners.map((p) => p.userId)).toEqual(["x"]);
    expect(groups.map((g) => g.topic)).toEqual(["bigquery", "log-files"]);
  });
});

describe("search", () => {
  const people = [helper, peer, person("writer", [], [], { workingOn: "Moving our sitemaps to the edge with Cloudflare Workers" })];

  it("finds a topic by name and the people in it", () => {
    expect(search("BigQuery", people)).toEqual({ topic: "bigquery", people: [helper] });
    expect(search("log file analysis", people).topic).toBe("log-files");
  });

  it("finds people who mention the words in their answers", () => {
    const result = search("cloudflare workers", people);
    expect(result.people.map((p) => p.userId)).toEqual(["writer"]);
  });

  it("finds nothing for an empty query", () => {
    expect(search("  ", people)).toEqual({ topic: null, people: [] });
  });
});

describe("describeReason", () => {
  it("reads naturally", () => {
    expect(describeReason({ kind: "can_help", topic: "bigquery" })).toBe("Can help you with BigQuery");
    expect(describeReason({ kind: "wants_your_help", topic: "python" })).toBe("Wants help with Python & automation");
    expect(describeReason({ kind: "also_learning", topic: "log-files" })).toBe("Also learning Log files");
  });
});
