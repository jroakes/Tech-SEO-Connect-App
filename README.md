# Tech SEO Connect Conference App

The attendee companion app for Tech SEO Connect in Durham, NC, served at
[app.techseoconnect.com](https://app.techseoconnect.com). It runs entirely on
Cloudflare: one Worker built with Astro, a D1 database, and an hourly cron job.

## What it does

- **Schedule** synced every hour from the schedule on
  [www.techseoconnect.com](https://www.techseoconnect.com/).
- **My Conference**: tap the heart on a talk, hotel, restaurant, bar or
  anything else to save it. Saves stay on the device; signed-in attendees (via
  [Clerk](https://clerk.com)) keep them in their account across devices.
- **Places**: curated restaurants, bars, coffee, hotels and things to do, as a
  map (`/map`) or a list (`/locations`), with Google Maps and Apple Maps
  directions.
- **Meet** (`/meet`): signed-in attendees answer a few questions (what they're
  working on, what they want to learn, what they can help with, and topics for
  each). The app suggests people to meet and shows each topic as a bubble of
  the people there for it; tap one or search to see who can help and who's
  learning too. Answers are shown only to other attendees who join, and anyone
  can edit or leave. No intro emails.
- **Sponsors**.
- **MCP server** at `/mcp` so attendees can add the conference to Claude or
  other AI tools. They sign in through Clerk, then can ask about talks,
  speakers, sponsors and places, and see or change their My Conference list.
  The **For AI bots** button in the header shows the URL and how to connect.
- **Event logging**: page views, place views, directions clicks, saves and
  AI assistant use go to the `events` table in D1, alongside GA4.
- **Admin** at `/admin`, for admins only (see below): the users list, where
  admins can make another user an admin, block a user from signing in, or
  delete a user, and the analytics at `/admin/analytics`.
- Installable as a PWA, with the schedule available offline.

## How it fits together

```
src/worker.ts          Worker entry: /mcp -> MCP server (after the sign-in check),
                       everything else -> Astro, and the cron trigger -> schedule sync
src/pages/             Astro pages and API routes
  schedule.astro       Rendered per request from D1
  my-conference.astro  Rendered per request from D1 (/my-schedule redirects here)
  meet.astro           Matchmaking (rendered in the browser)
  admin/index.astro    Admins' users list, from Clerk
  admin/analytics.astro  Admins' analytics, rendered per request from D1
  map / locations /    Prerendered at build time (served free as static assets)
  sponsors .astro
  api/events.ts        POST batches of analytics events
  api/saved.ts         GET/POST a signed-in user's saved talks or places
  api/profile.ts       GET/PUT/DELETE the signed-in user's matchmaking answers
  api/matches.ts       GET everyone in matchmaking (only for those who joined)
  api/me.ts            GET whether the signed-in user is an admin
  api/admin/users.ts   POST admin actions on a user
src/mcp/server.ts      MCP tools for a signed-in attendee (stateless)
src/lib/mcp-auth.ts    MCP sign-in: OAuth discovery and Clerk token checks
src/lib/insights.ts    Queries behind the analytics page
src/lib/matching.ts    Who to meet and the topic groups (pure functions, tested)
src/lib/clerk.ts       Clerk Backend API client and who's an admin
src/lib/schedule-*.ts  Main-site schedule parser and the hourly sync
src/components/        React islands (map, lists, schedule) and the header
src/data/              Conference details, bundled fallback schedule, places,
                       sponsors, matchmaking topics
migrations/            D1 schema
content/               Source files for places (KML export and narratives)
```

**Data:**

- **Schedule:** the cron job fetches `SCHEDULE_SOURCE_URL`, parses it, and
  replaces the `sessions` table. If parsing finds fewer than five talks, it
  keeps the current schedule and records an error in `sync_runs`. Until the
  first sync runs, pages fall back to the bundled schedule in
  `src/data/schedule.ts`.
- **Places:** built from `content/places.kml` (a Google My Maps export) and
  `content/place-narratives.json` with `npm run import:places`, which writes
  `src/data/places.json`.
- **Session IDs:** each one is the date plus the speaker (or the time plus the
  title for breaks). A retitled talk keeps its saves.

## Development

Requires Node 22.23.4 or newer (`nvm use` reads `.nvmrc`).

```bash
npm install
cp .env.example .env              # optional: Clerk and MapTiler keys
cp .dev.vars.example .dev.vars    # optional: Clerk secret key
npm run db:migrate:local
npm run dev
```

Without Clerk keys the app runs normally, with sign-in hidden. Without a
MapTiler key, local development uses OpenStreetMap tiles.

| Command | What it does |
|---|---|
| `npm run dev` | Astro dev server running in workerd, with local D1 |
| `npm run build` | Generate Worker types and build to `dist/` |
| `npm run preview` | Build, then serve the built Worker locally with Wrangler |
| `npm test` | Unit tests (schedule parser, matching) |
| `npm run check` | Type-check Astro and TypeScript files |
| `npm run import:places` | Rebuild `src/data/places.json` from `content/` |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply D1 migrations |

To run the schedule sync locally, start `npx wrangler dev --test-scheduled`
after a build, then open `http://localhost:8787/__scheduled`.

## Deploying

1. Build with the production keys in `.env`, then run `npm run deploy`. The
   first deploy creates the D1 database.
2. Apply the schema: `npm run db:migrate:remote`.
3. Set the Clerk secret: `npx wrangler secret put CLERK_SECRET_KEY`.
4. Let AI assistants sign in: in the Clerk Dashboard, open **OAuth
   applications**, then the **Settings** tab, and under **Client onboarding**
   turn on **Publish CIMD support** (with **Client admission** set to **Any
   compatible CIMD client**) and **Publish DCR support**.
5. List the organizers in `ORGANIZER_EMAILS` in `wrangler.jsonc`
   (comma-separated; the email must be verified in their Clerk account).
   Organizers are always admins.
6. **Cutover:** remove the old `app.techseoconnect.com` DNS record, then
   uncomment the `routes` entry in `wrangler.jsonc` and deploy again. Cloudflare
   creates the DNS record and certificate. The techseoconnect.com zone must be
   in the same Cloudflare account as the Worker.

The Workers Paid plan ($5/month) is recommended for the conference month. On
the free plan, D1 queries fail once the daily row limits are reached.

## Connecting the MCP server

Add `https://app.techseoconnect.com/mcp` as a custom connector in Claude (or
any MCP client) and sign in when asked. The server answers unsigned requests
with a 401 that points to `/.well-known/oauth-protected-resource/mcp`, which
names Clerk as the authorization server; the client signs in through Clerk
and sends the OAuth access token on every request.

Tools: `get_event_info`, `get_schedule`, `search_sessions`, `find_places`,
`list_sponsors`, plus `get_my_conference`, `save_to_my_conference` and
`remove_from_my_conference` for the signed-in attendee. Tool calls are logged
as `mcp_tool_call` events, and saves made through it as save events.

## Admin

Admins are the organizers in `ORGANIZER_EMAILS`, plus anyone an admin makes an
admin (stored in Clerk as `publicMetadata.role = "admin"`). Admins get an
**Admin** link in their account menu.

**Users** (`/admin`) lists everyone who has signed in, newest first, with
search. For each user an admin can:

- **Make admin** or **Remove admin**.
- **Block**: bans them in Clerk, which signs them out and stops them signing
  in. **Unblock** reverses it. Their saves stay.
- **Delete**: deletes the Clerk user and their saved talks, saved places and
  matchmaking answers. Their past events stay, without the user ID.

Admins can't remove, block or delete organizers or themselves. Each action is
logged as an `admin_action` event.

**Analytics** (`/admin/analytics`; `/analytics` redirects there): visitors,
page views, signed-in attendees, directions taps, saves and AI assistant use,
page views over time, the places people go, the most-saved talks, and what
people ask the AI assistant.

`events` rows hold `type`, `ts`, `anon_id` (per device), `user_id` (when
signed in), `path` and JSON `props`. Event types: `page_view`, `place_view`,
`map_button_click`, `session_save`, `session_unsave`, `place_save`,
`place_unsave`, `mcp_modal_open`, `mcp_url_copy`, `mcp_tool_call`,
`match_join`, `match_search`, `admin_action`. For example:

```bash
npx wrangler d1 execute DB --remote --command \
  "SELECT json_extract(props,'$.place_name') AS place, COUNT(*) AS clicks FROM events WHERE type='map_button_click' GROUP BY place ORDER BY clicks DESC LIMIT 20"
```

GA4 (`G-QRWD85BG5Z`) still receives `map_button_click`, `speaker_like` and
`place_like` events. Run `enableAnalyticsDebug()` in the browser console to log
events as they fire.

## Roadmap

- **Amp Code shared workspace** for the organizers to work on the app
  together, once the app is built.
