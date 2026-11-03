// Builds src/data/places.json from a Google My Maps KML export plus a JSON
// file of narratives keyed by place name.
//
// Usage: node scripts/import-places.mjs [--original-pins] [kml] [narratives] [out]
// Defaults: content/places.kml content/place-narratives.json src/data/places.json
//
// KML folders become categories. A place whose name contains
// "Conference Venue" is flagged as the venue (gold star on the map).
//
// Each place is linked to its Google Maps listing from
// content/google-listings.json (keyed by place name), so the Google Maps
// button opens the listing itself. Its pin moves to the listing's
// coordinates, keeping the KML's as originalLat/originalLng;
// --original-pins keeps the KML pins instead. A place whose listing is
// permanently closed is left out.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const originalPins = args.includes("--original-pins");
const [kmlPath = "content/places.kml", narrativesPath = "content/place-narratives.json", outPath = "src/data/places.json"] =
  args.filter((a) => !a.startsWith("--"));
const listingsPath = "content/google-listings.json";

const decode = (s) =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

const firstTag = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : "";
};

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const kml = readFileSync(kmlPath, "utf8");
const narratives = existsSync(narrativesPath) ? JSON.parse(readFileSync(narrativesPath, "utf8")) : {};
const listings = existsSync(listingsPath) ? JSON.parse(readFileSync(listingsPath, "utf8")) : {};

const places = [];
const usedIds = new Set();
const closed = [];

const addPlacemark = (placemark, category) => {
  const name = firstTag(placemark, "name");
  const [lng, lat] = firstTag(placemark, "coordinates").split(",").map(Number);
  if (!name || Number.isNaN(lat) || Number.isNaN(lng)) return;
  const listing = listings[name];
  if (listing?.status === "closed_forever") return void closed.push(name);
  const moved = listing && !originalPins && (listing.lat !== lat || listing.lng !== lng);
  const address = listing?.address || firstTag(placemark, "address");

  let id = slugify(name);
  for (let n = 2; usedIds.has(id); n++) id = `${slugify(name)}-${n}`;
  usedIds.add(id);

  places.push({
    id,
    name,
    category,
    lat: moved ? listing.lat : lat,
    lng: moved ? listing.lng : lng,
    ...(narratives[name] ? { narrative: narratives[name] } : {}),
    ...(/conference venue/i.test(name) ? { isVenue: true } : {}),
    ...(listing ? { googlePlaceId: listing.placeId } : {}),
    ...(address ? { address } : {}),
    ...(moved ? { originalLat: lat, originalLng: lng } : {}),
  });
};

const folders = kml.match(/<Folder>[\s\S]*?<\/Folder>/g) ?? [];
for (const folder of folders) {
  const category = firstTag(folder.split("<Placemark>")[0], "name") || "Other";
  for (const placemark of folder.match(/<Placemark>[\s\S]*?<\/Placemark>/g) ?? []) {
    addPlacemark(placemark, category);
  }
}

const outsideFolders = kml.replace(/<Folder>[\s\S]*?<\/Folder>/g, "");
for (const placemark of outsideFolders.match(/<Placemark>[\s\S]*?<\/Placemark>/g) ?? []) {
  addPlacemark(placemark, "Other");
}

writeFileSync(outPath, JSON.stringify(places, null, 2) + "\n");

const missing = places.filter((p) => !p.narrative).map((p) => p.name);
const unlisted = [...new Set(places.filter((p) => !p.googlePlaceId).map((p) => p.name))];
console.log(`Wrote ${places.length} places to ${outPath}${originalPins ? ", with the original KML pins" : ""}.`);
if (missing.length) console.log(`No narrative for ${missing.length}: ${missing.join("; ")}`);
if (unlisted.length) console.log(`No Google listing for ${unlisted.length}: ${unlisted.join("; ")}`);
if (closed.length) console.log(`Left out ${closed.length} permanently closed: ${closed.join("; ")}`);
