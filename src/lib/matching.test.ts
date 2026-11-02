import { describe, expect, it } from "vitest";
import { linkedinUrl, peopleByTopic, type Profile } from "./matching";

const person = (userId: string, topics: string[], extra: Partial<Profile> = {}): Profile => ({ userId, name: userId, topics, ...extra });

describe("peopleByTopic", () => {
  const me = person("me", ["log-files", "bigquery"]);

  it("lists each of my topics, in the usual order, with everyone else who picked it by name", () => {
    const others = [person("zoe", ["bigquery", "local"]), person("amy", ["bigquery"]), person("sam", ["log-files"]), me];
    expect(peopleByTopic(me, others).map((g) => [g.topic, g.people.map((p) => p.userId)])).toEqual([
      ["bigquery", ["amy", "zoe"]],
      ["log-files", ["sam"]],
    ]);
  });

  it("keeps a topic nobody else picked, with no people", () => {
    expect(peopleByTopic(me, [person("x", ["local"])])).toEqual([
      { topic: "bigquery", label: "BigQuery", people: [] },
      { topic: "log-files", label: "Log files", people: [] },
    ]);
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
    expect(linkedinUrl("find me at lunch")).toBeNull();
  });
});
