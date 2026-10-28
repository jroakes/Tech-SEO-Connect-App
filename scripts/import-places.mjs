// Builds src/data/places.json from a Google My Maps KML export plus a JSON
// file of narratives keyed by place name.
//
// Usage: node scripts/import-places.mjs [kml] [narratives] [out]
// Defaults: content/places.kml content/place-narratives.json src/data/places.json
//
// KML folders become categories. A place whose name contains
// "Conference Venue" is flagged as the venue (gold star on the map).

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [kmlPath = "content/places.kml", narrativesPath = "content/place-narratives.json", outPath = "src/data/places.json"] =
  process.argv.slice(2);

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

const places = [];
const usedIds = new Set();

const addPlacemark = (placemark, category) => {
  const name = firstTag(placemark, "name");
  const [lng, lat] = firstTag(placemark, "coordinates").split(",").map(Number);
  if (!name || Number.isNaN(lat) || Number.isNaN(lng)) return;

  let id = slugify(name);
  for (let n = 2; usedIds.has(id); n++) id = `${slugify(name)}-${n}`;
  usedIds.add(id);

  places.push({
    id,
    name,
    category,
    lat,
    lng,
    ...(narratives[name] ? { narrative: narratives[name] } : {}),
    ...(/conference venue/i.test(name) ? { isVenue: true } : {}),
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
console.log(`Wrote ${places.length} places to ${outPath}.`);
if (missing.length) console.log(`No narrative for ${missing.length}: ${missing.join("; ")}`);
