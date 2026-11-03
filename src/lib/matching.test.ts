import { describe, expect, it } from "vitest";
import { TOPICS } from "../data/topics";
import { linkedinUrl, peopleIn, sharingATopic, topicCounts, type Profile } from "./matching";

const person = (userId: string, topics: string[], extra: Partial<Profile> = {}): Profile => ({ userId, name: userId, topics, ...extra });

const people = [person("zoe", ["bigquery", "local"]), person("amy", ["bigquery"]), person("sam", ["log-files"])];

describe("topicCounts", () => {
  it("counts every topic, in the usual order, including ones nobody picked", () => {
    const counts = topicCounts(people);
    expect(counts.map((c) => c.topic)).toEqual(TOPICS.map((t) => t.id));
    expect(counts.find((c) => c.topic === "bigquery")).toEqual({ topic: "bigquery", label: "BigQuery", count: 2 });
    expect(counts.find((c) => c.topic === "careers")?.count).toBe(0);
  });
});

describe("sharingATopic", () => {
  it("keeps only other people who share one of my topics", () => {
    const me = person("me", ["bigquery", "python"]);
    expect(sharingATopic(me, [...people, me]).map((p) => p.userId)).toEqual(["zoe", "amy"]);
  });
});

describe("peopleIn", () => {
  it("lists everyone who picked a topic, by name", () => {
    expect(peopleIn("bigquery", people).map((p) => p.userId)).toEqual(["amy", "zoe"]);
    expect(peopleIn("careers", people)).toEqual([]);
  });
});

describe("linkedinUrl", () => {
  it("accepts a full link, one without https, or a handle", () => {
    expect(linkedinUrl("https://www.linkedin.com/in/jroakes/")).toBe("https://www.linkedin.com/in/jroakes");
    expect(linkedinUrl("linkedin.com/in/jroakes?utm_source=share")).toBe("https://www.linkedin.com/in/jroakes");
    expect(linkedinUrl(" jroakes ")).toBe("https://www.linkedin.com/in/jroakes");
    expect(linkedinUrl("@patrick-stox")).toBe("https://www.linkedin.com/in/patrick-stox");
  });

  it("turns down anything that isn't a LinkedIn profile", () => {
    expect(linkedinUrl("https://example.com/in/jroakes")).toBeNull();
    expect(linkedinUrl("linkedin.com.example.com/in/x")).toBeNull();
    expect(linkedinUrl("javascript:alert(1)")).toBeNull();
    expect(linkedinUrl("https://linkedin.com/")).toBeNull();
    expect(linkedinUrl("linkedin.com/feed/")).toBeNull();
    expect(linkedinUrl("https://www.linkedin.com/company/acme")).toBeNull();
    expect(linkedinUrl("find me at lunch")).toBeNull();
  });
});
