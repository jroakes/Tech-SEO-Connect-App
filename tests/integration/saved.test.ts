// My Conference for a signed-in attendee: saving and removing talks and places.
import { describe, expect, it } from "vitest";
import { GET, POST } from "@/pages/api/saved";
import { call } from "./helpers";

describe("/api/saved", () => {
  it("needs sign-in", async () => {
    expect((await call(GET, { path: "/api/saved?kind=session" })).status).toBe(401);
    expect((await call(POST, { method: "POST", body: { kind: "session", add: ["a"] } })).status).toBe(401);
  });

  it("saves and removes talks and places, separately per user", async () => {
    const save = (user: string, body: unknown) => call(POST, { method: "POST", body, user });
    expect((await save("ann", { kind: "session", add: ["talk-1", "talk-2"] })).data.ids).toEqual(["talk-1", "talk-2"]);
    expect((await save("ann", { kind: "place", add: ["cafe"] })).data.ids).toEqual(["cafe"]);
    expect((await save("ann", { kind: "session", remove: ["talk-1"] })).data.ids).toEqual(["talk-2"]);
    // Saving twice is harmless.
    expect((await save("ann", { kind: "session", add: ["talk-2"] })).data.ids).toEqual(["talk-2"]);

    expect((await call(GET, { path: "/api/saved?kind=session", user: "ann" })).data.ids).toEqual(["talk-2"]);
    expect((await call(GET, { path: "/api/saved?kind=place", user: "ann" })).data.ids).toEqual(["cafe"]);
    expect((await call(GET, { path: "/api/saved?kind=session", user: "bob" })).data.ids).toEqual([]);
  });

  it("rejects bad requests", async () => {
    expect((await call(GET, { path: "/api/saved?kind=nope", user: "ann" })).status).toBe(400);
    expect((await call(POST, { method: "POST", body: "not json", user: "ann" })).status).toBe(400);
    expect((await call(POST, { method: "POST", body: { kind: "hotel", add: ["x"] }, user: "ann" })).status).toBe(400);
  });
});
