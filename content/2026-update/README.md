# 2026 content update

Places, sponsors and event details for Tech SEO Connect 2026: **Bay 7, 324
Blackwell St #700, on American Tobacco Campus**, Thursday and Friday, Nov 5–6,
2026, with welcome events on Wednesday, Nov 4. Prepared 2026-10-28.

Nothing in the app reads this folder. The steps below apply it. The schedule
isn't included, because the app syncs it from techseoconnect.com.

## Files

| File | Replaces | Notes |
|---|---|---|
| `places.kml` | `content/places.kml` | Same format as the 2025 My Maps export: one folder per category. Placemarks also carry `<address>` and a `<description>`, which the importer ignores. |
| `place-narratives.json` | `content/place-narratives.json` | Narratives keyed by exact placemark name. |
| `places.json` | `src/data/places.json` | What `npm run import:places` produces from the two files above, included so you can compare. |
| `sponsors.ts` | `src/data/sponsors.ts` | 14 sponsors in the order techseoconnect.com lists them. Adds a `url` field (see step 2). |
| `sponsors.json` | Nothing | The same sponsors as JSON, in case it's useful. |

## Applying it

1. **Places.** From the repo root:

   ```bash
   cp content/2026-update/places.kml content/2026-update/place-narratives.json content/
   npm run import:places
   ```

   The result should match the included file exactly:
   `cmp src/data/places.json content/2026-update/places.json`.

2. **Sponsors.** Copy `sponsors.ts` over `src/data/sponsors.ts`. The logos are
   `.webp` files hosted on techseoconnect.com. The new `url` field is each
   sponsor's site, as linked on techseoconnect.com. `src/pages/sponsors.astro`
   doesn't use it yet: to make the logos clickable, wrap each card in
   `<a href={sponsor.url} target="_blank" rel="noopener">`. If you don't want
   links, delete the field. The MCP `list_sponsors` tool returns names only,
   so it's unaffected.

3. **Event details.** In `src/data/event.ts`, replace the 2025 values and drop
   the "Still the 2025 values" comment:

   ```ts
   venueName: "Bay 7",
   dateRange: "November 5-6, 2026",
   shortDateRange: "Nov 5-6, 2026",
   // Between Bay 7 and the downtown core. Bay 7 itself is 35.9934627, -78.9052607.
   mapCenter: [35.9955, -78.9025] as [number, number],
   days: [
     { day: 1, date: "2026-11-05", label: "Day 1 - Nov 5" },
     { day: 2, date: "2026-11-06", label: "Day 2 - Nov 6" },
   ] satisfies ConferenceDay[],
   ```

4. **Check it.** Run `npm run check` and `npm run build`. Then look at `/map`,
   `/locations` and `/sponsors`, and ask the MCP server's `find_places` and
   `get_event_info` tools a question.

5. Delete `content/2026-update/` once it's applied.

## What's in the places data

**111 places**, in the same seven categories as 2025, so the colors and filters
in `src/lib/categories.ts` work unchanged:

| Category | Places |
|---|---|
| Conference Main Locations | 6 |
| Hotels | 4 |
| Coffee | 14 |
| Lunch | 22 |
| Dinner | 21 |
| Drinks | 33 |
| Things to do | 11 |

- **The venue:** "Bay 7 - Conference Venue" is the only place flagged
  `isVenue` (the gold star).
- **Conference Main Locations** has the official events from the site's
  schedule:
  - SO/IF Bar for Welcome Drinks, Wed 5–7 PM
  - Mateo for the Welcome Party, Wed 7–10 PM. It's a full buyout, so Mateo's
    Dinner entry points people to Thursday or Friday for regular service.
  - The ATC rail car for the Happy Hour, Thu 5–7 PM
  - BOOM Club for the After Party, Thu 9 PM–2 AM
  - delafia for the Farewell Party, Fri 5 PM–midnight
- **Hotels** match the four on the site's Travel page, with Aloft as the
  conference hotel.
- **Every place was checked** for being open Wed–Fri, Nov 4–6, at the hours
  that matter for its category. For example, every lunch spot is open
  11:30 AM–1 PM on both days. Every place also has its pin and walking time
  from Bay 7 checked, and a new description.
- **A few places appear in two categories**, such as PRESS under Coffee and
  Lunch. Narratives are keyed by name, so both entries share one description.

## Before launch

- **M Nikkei** (Dinner, formerly M Pocha) opens Oct 29, 2026. Confirm it
  opened.
- **The rail car pin** is the Power Plant building, because the car itself
  isn't on any map. Move it to the car if you can check on site.
- **Fullsteam** shows "temporarily closed" on Google and Yelp, but its own site
  shows the new ATC Public House open. Check again closer to the date.
- **Queeny's** (Lunch) opens at 11:45 AM, 15 minutes into the lunch break. Its
  narrative doesn't mention this; drop it if that's a problem.

## Changing places later

Edit `content/places.kml`, either by hand or in Google My Maps and then
re-export. Keep `content/place-narratives.json` keyed by the exact placemark
name. Then rerun `npm run import:places`. A name containing "Conference Venue"
sets `isVenue`.
