import { describe, expect, it } from "vitest";
import places from "../data/places.json";
import { appleMapsUrl, googleMapsUrl } from "./maps";

const cafe = { name: "Joe's Café & Bar", lat: 35.99, lng: -78.9 };

describe("googleMapsUrl", () => {
  it("opens the place's own Google listing when we know it", () => {
    expect(googleMapsUrl({ ...cafe, googlePlaceId: "ChIJabc-123_x" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Joe's%20Caf%C3%A9%20%26%20Bar&query_place_id=ChIJabc-123_x",
    );
  });

  it("falls back to a pin at the coordinates", () => {
    expect(googleMapsUrl(cafe)).toBe("https://www.google.com/maps/search/?api=1&query=35.99,-78.9");
  });

  it("links almost every bundled place to its listing", () => {
    const unlisted = places.filter((p) => !("googlePlaceId" in p)).map((p) => p.name);
    expect(unlisted.length).toBeLessThanOrEqual(2);
  });
});

describe("appleMapsUrl", () => {
  it("searches for the name at the coordinates", () => {
    expect(appleMapsUrl(cafe)).toBe("https://maps.apple.com/?q=Joe's%20Caf%C3%A9%20%26%20Bar&ll=35.99,-78.9");
  });
});
