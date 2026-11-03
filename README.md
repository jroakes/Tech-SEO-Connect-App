# Tech SEO Connect Conference App

The attendee companion app for Tech SEO Connect in Durham, NC, served at
[app.techseoconnect.com](https://app.techseoconnect.com). It runs entirely on
Cloudflare: one Worker built with Astro, a D1 database, Workers AI, and cron
jobs (hourly for the schedule, every 10 minutes in conference week for
check-in).

## What it does

- **Schedule** synced every hour from the schedule on
  [www.techseoconnect.com](https://www.techseoconnect.com/), with each
  party's details and links. During the conference it opens on today.
- **My Conference**: tap the heart on a talk, hotel, restaurant, bar or
  anything else to save it. Saves stay on the device; signed-in attendees (via
  [Clerk](https://clerk.com)) keep them in their account across devices.
  Signing in adds the saves made while signed out to the account; after that
  each device keeps a copy of the account's list, so removing a save on one
  device removes it everywhere. A tap the account didn't get (offline, say)
  is sent again on the next sync.
- **Places**: curated restaurants, bars, coffee, hotels and things to do, as a
  map (`/map`) or a list (`/locations`), with Google Maps and Apple Maps
  directions.
- **Meet** (`/meet`): signed-in attendees give their name and title, pick up to
  three topics they're interested in and, optionally, add their LinkedIn. Every
  topic shows as a circle sized by how many people picked it, with their own
  topics in dark green. Only their own topics open: tapping one lists everyone
  in it (`/meet#bigquery`), and tapping someone opens their LinkedIn to message
  them and meet up. Other topics show only a count, and the API sends people
  only for topics the attendee shares, without their account IDs or the
  topics they don't share. Topics are locked once saved, even after leaving
  and joining again (only the topic IDs are kept, in `meet_topics`), so
  nobody can cycle through the topics to see everyone on Meet. Answers are
  shown only to other attendees who join, and anyone can edit their name,
  title and LinkedIn or leave. After leaving, Meet says so and offers a
  Rejoin button. No intro emails.
- **Sponsors**.
- **MCP server** at `/mcp` so attendees can add the conference to Claude or
  other AI tools. They sign in through Clerk, then can ask about talks,
  speakers, sponsors and places, see or change their My Conference list, and,
  once they've joined Meet, see the topics and the people who share theirs.
  The **For AI bots** button in the header (a small robot that waves, pre-rendered from a Three.js model into `src/assets/robot-wave.webp`) shows the URL and how to connect.
- **Event logging**: page views, place views, directions clicks, saves and
  AI assistant use go to the `events` table in D1, alongside GA4.
- **Admin** at `/admin`, for admins only (see below): the users list, where
  admins can make another user an admin, block a user from signing in, or
  delete a user, the analytics at `/admin/analytics`, and guest check-in at
  `/admin/check-in`.
- Installable as a PWA, with the schedule available offline. Pages open
  straight from the phone's cache once visited and refresh in the background
  (`public/service-worker.js`); after a deploy, an open page from the old
  build reloads once.

## How it fits together

```
src/worker.ts          Worker entry: /mcp -> MCP server (after the sign-in check),
                       everything else -> Astro; crons -> schedule sync (hourly)
                       and the check-in guest list (every 10 minutes, Nov 1-7)
src/pages/             Astro pages and API routes
  schedule.astro       Rendered from D1, then kept 5 minutes at each Cloudflare
  my-conference.astro  location (see src/worker.ts)
  meet.astro           Meet people (prerendered; filled in the browser)
  admin/index.astro    Admins' users list, from Clerk
  admin/analytics.astro  Admins' analytics, rendered per request from D1
  admin/check-in.astro   Checking guests in at the door, against Luma
  map / locations /    Prerendered at build time (served free as static assets)
  sponsors .astro
  api/events.ts        POST batches of analytics events
  api/saved.ts         GET/POST a signed-in user's saved talks or places
  api/profile.ts       GET/PUT/DELETE the signed-in user's Meet answers
  api/matches.ts       GET everyone on Meet (only for those who joined)
  api/me.ts            GET whether the signed-in user is an organizer
  api/admin/users.ts   POST admin actions on a user
  api/admin/events.ts  GET every event as CSV or JSON (admins only)
  api/admin/check-in.ts  POST guest searches, check-ins and walk-ins (admins only)
src/mcp/server.ts      MCP tools for a signed-in attendee (stateless)
src/lib/mcp-auth.ts    MCP sign-in: OAuth discovery and Clerk token checks
src/lib/insights.ts    Queries behind the analytics page
src/lib/matching.ts    Topic counts, people by topic and LinkedIn links (pure, tested)
src/lib/check-in.ts    Luma guest list, the AI's judgment of matches, check-ins
tests/integration/     API, MCP, cron and analytics tests in workerd (npm test)
tests/e2e/             Browser tests (npm run test:e2e)
src/lib/guest-match.ts Likely guests for a typed name or email (pure, tested)
src/lib/topic-layout.ts  Where the Meet topic circles go (d3-force)
src/lib/clerk.ts       Clerk Backend API client and who's an admin
src/lib/schedule-*.ts  Main-site schedule parser and the hourly sync
src/components/        React islands (map, lists, schedule) and the header
src/data/              Conference details, bundled fallback schedule, places,
                       sponsors, Meet topics
migrations/            D1 schema
content/               Source files for places (KML export, narratives, Google
                       listings) and the yearly content update (PROCESS.md)
```

**Data:**

- **Schedule:** the cron job fetches `SCHEDULE_SOURCE_URL`, parses it, and
  replaces the `sessions` table. If parsing finds fewer than five talks, it
  keeps the current schedule and records an error in `sync_runs`. Until the
  first sync runs, pages fall back to the bundled schedule in
  `src/data/schedule.ts`.
- **Places:** built from `content/places.kml` (a Google My Maps export) and
  `content/place-narratives.json` with `npm run import:places`, which writes
  `src/data/places.json`. `content/google-listings.json` links each place, by
  name, to its Google Maps listing (Place ID, address and the listing's exact
  coordinates), so the Google Maps button opens the listing itself rather than
  a pin. Pins move to the listing's coordinates and keep the KML's as
  `originalLat`/`originalLng`; `npm run import:places -- --original-pins` goes
  back to the KML pins. A listing marked `closed_forever` leaves its place out.
- **Session IDs:** each one is the date plus the speaker (or the time plus the
  title for breaks). A retitled talk keeps its saves, and so does a talk that
  moves to another day: the sync points saved IDs at the speaker's new one,
  and the pages do the same for saves kept on a device.

## Development

Requires Node 22.23.4 or newer (`nvm use` reads `.nvmrc`).

```bash
npm install
cp .env.example .env    # then fill in the keys you have
npm run db:migrate:local
npm run dev
```

Every key goes in `.env` (see `.env.example`); Wrangler reads the secrets from
it too, so don't add a `.dev.vars` file, which would hide them. Without Clerk
keys the app runs normally, with sign-in hidden. Without a MapTiler key, local
development uses OpenStreetMap tiles. Without the OpenRouter and Luma keys,
check-in can't search.

| Command | What it does |
|---|---|
| `npm run dev` | Astro dev server running in workerd, with local D1 |
| `npm run build` | Generate Worker types and build to `dist/` |
| `npm run preview` | Build, then serve the built Worker locally with Wrangler |
| `npm test` | Unit and integration tests (see Testing) |
| `npm run test:e2e` | Browser tests (see Testing) |
| `npm run check` | Type-check Astro and TypeScript files |
| `npm run import:places` | Rebuild `src/data/places.json` from `content/` |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply D1 migrations |
| `npm run deploy` | Build with the keys in `.env` and deploy the Worker |
| `npm run secrets` | Upload `CLERK_SECRET_KEY`, `OPENROUTER_API_KEY` and `LUMA_API_KEY` from `.env` to the Worker |

To run the schedule sync locally, start `npx wrangler dev --test-scheduled`
after a build, then open
`http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+*+*+*+*` (or
`?cron=*/10+*+1-7+11+*` for the check-in guest list).

## Testing

| Command | What it runs |
|---|---|
| `npm test` | **Unit tests** (`src/**/*.test.ts`): the schedule parser, Meet matching and check-in's name matching. **Integration tests** (`tests/integration`), run inside workerd (Cloudflare's runtime) against a local D1 database, with Clerk, Luma and the AI stubbed: the schedule sync from the main site, My Conference saves, the event log, Meet (joining, answers, locked topics, leaving, who sees whom), check-in (search, the AI, livestream filtering, newest registrations, scanned tickets, check in and undo, walk-ins), admin (the event export, who's an admin), the analytics numbers, and every MCP tool. About 2 seconds. |
| `npm run test:e2e` | **Browser tests** (`tests/e2e`), on a phone and a desktop: the schedule, saving talks and places and removing them in My Conference, searching and filtering places, directions, the map's pins, every sponsor's logo, the For AI bots dialog, locked admin pages and APIs, redirects, the 404 page, and that each page logs its events. Several people at once, as fake accounts: an admin making someone an admin, two admins at the check-in desk (name and email search, a ticket's QR code through the camera, undo), Meet (finding each other by topic, leaving and rejoining, a blocked attendee), and one attendee's saves on two devices. They build the app with fake accounts in place of Clerk (`FAKE_AUTH=1`, `tests/fake-auth`; a test signs in by setting the `tsc_test_user` cookie, and it works only on localhost) and run it with Wrangler on port 8788 with a local D1 of their own (`.wrangler/e2e`) and a stand-in for Luma with fictional guests (`tests/e2e/fake-luma.mjs`, port 8799), in the installed Google Chrome with a fresh profile. About 30 seconds after the build. |
| `npm run test:all` | Both. |

Real Clerk sign-in and the real Luma guest list are checked by hand on the live site; see [PRE-DEPLOY-CHECKLIST.md](PRE-DEPLOY-CHECKLIST.md).

## Deploying

Before every deploy, go through [PRE-DEPLOY-CHECKLIST.md](PRE-DEPLOY-CHECKLIST.md).

To deploy to a Cloudflare account, new or existing, from a fresh download of
the repo (the `cloudflare-astro` branch) and your `.env`:

1. **Install:** `nvm use`, then `npm install`.
2. **Keys:** put your `.env` in the repo root, with the production Clerk keys
   (see `.env.example` for every key).
3. **Settings:** check the `vars` in `wrangler.jsonc`: `ORGANIZER_EMAILS` (the
   organizers, who are always admins; each email must be verified in their
   Clerk account), `LUMA_EVENT_ID` (the conference's Luma event, which must
   belong to the calendar that `LUMA_API_KEY` comes from) and `CHECK_IN_DEMO`.
4. **Sign in to Cloudflare:** `npx wrangler login`, as a user of the account
   to deploy to. `account_id` in `wrangler.jsonc` says which account that is:
   production is Techseoconnect@gmail.com's Account, which also runs the main
   site, so everything of this app's is named `tech-seo-connect-app`.
5. **Deploy:** `npm run deploy`. It builds with the `PUBLIC_` keys from `.env`,
   and the first deploy to an account creates the Worker and the D1 database
   (`tech-seo-connect-app`). The app is then at `https://app.techseoconnect.com`
   (see step 9).
6. **Database:** `npm run db:migrate:remote` creates the tables.
7. **Secrets:** `npm run secrets` uploads `CLERK_SECRET_KEY`,
   `OPENROUTER_API_KEY` and `LUMA_API_KEY` from `.env`. Run it again whenever
   one changes.
8. **Clerk:** in the Clerk Dashboard, finish the production instance for
   app.techseoconnect.com (its DNS records). For AI assistants to sign in, open
   **OAuth applications**, then the **Settings** tab, and under **Client
   onboarding** turn on **Publish CIMD support** (with **Client admission** set
   to **Any compatible CIMD client**) and **Publish DCR support**.
9. **Domain:** the app is at `app.techseoconnect.com` (`routes` in
   `wrangler.jsonc`), and Cloudflare makes its DNS record and certificate on
   deploy. The techseoconnect.com zone must be in the same Cloudflare account,
   with no other DNS record for `app`. There's no workers.dev address, since
   Clerk's production keys work only on that domain.

Nothing else needs setting up: Workers AI and the cron triggers come with the
Worker. The schedule appears from the bundled copy until the hourly sync runs,
and the check-in guest list loads from Luma the first time the page opens.

Use the Workers Paid plan ($5/month) for the conference month. On the free
plan, D1 stops answering once 5 million rows are read in a day, and each view
of the analytics page reads about 20 rows per logged event (some 1 million
rows once 50,000 events are logged); Workers AI (check-in's backup AI) also
has a small daily allowance there. Use a production Clerk instance: Clerk's
API allows 1,000 requests per 10 seconds in production but only 100 on a
development instance. OpenRouter needs credit on its account.

**Capacity.** On November 2, 2026, 200 simulated attendees on the review site
(each opening a page and logging an event every 1 to 2 seconds, far busier
than real use) made 226 requests a second for 47 seconds with no errors;
95% of pages answered within 0.25 seconds and every event was stored. Twenty
check-in searches at once all answered (median 0.1 seconds, slowest 1.8). The
account menu reads the admin role from the account Clerk's script already
loads (and asks the server about organizers once per sign-in), and the
check-in desk trusts Clerk's yes for a minute, so busy pages don't run into
Clerk's limits.

**Moving the data** from another account is optional. Saved talks, Meet
answers and check-ins belong to Clerk user IDs, so they only carry over if the
same Clerk instance is used. To copy them, sign in to the old account and run
`npx wrangler d1 export tech-seo-connect-app --remote --output=tsc.sql`; then, on
the new account, run `npx wrangler d1 execute DB --remote --file=tsc.sql`
instead of step 6.

## Connecting the MCP server

Add `https://app.techseoconnect.com/mcp` as a custom connector in Claude (or
any MCP client) and sign in when asked. The server answers unsigned requests
with a 401 that points to `/.well-known/oauth-protected-resource/mcp`, which
names Clerk as the authorization server; the client signs in through Clerk
and sends the OAuth access token on every request.

Tools: `get_event_info`, `get_schedule`, `search_sessions`, `find_places`,
`list_sponsors`, plus, for the signed-in attendee, `get_my_conference` (their
saved talks and places), `save_to_my_conference`, `remove_from_my_conference`,
and for Meet `get_meet_topics` (every topic, how many picked it, and theirs)
and `find_people_to_meet` (the people who share their topics, with LinkedIn).
The Meet tools follow the app's rules: only for attendees who've joined Meet,
and only people in topics they picked. Tool calls are logged as
`mcp_tool_call` events, and saves made through it as save events.

## Admin

Admins are the organizers in `ORGANIZER_EMAILS`, plus anyone an admin makes an
admin (stored in Clerk as `publicMetadata.role = "admin"`). Admins get an
**Admin** link in their account menu. The menu reads the role from the
account Clerk's script loads on every page, so someone made an admin, or no
longer one, sees the change on their next page; organizers are asked about
once per sign-in and kept on the device until they sign out. Each admin page
checks with Clerk when it opens; the check-in desk's actions trust a yes from
the last minute.

**Users** (`/admin`) lists everyone who has signed in, newest first, with
search. For each user an admin can:

- **Make admin** or **Remove admin**.
- **Block**: bans them in Clerk, which signs them out and stops them signing
  in, and removes their Meet answers so nobody can find them there.
  **Unblock** reverses the ban (they can join Meet again). Their saves stay.
- **Delete**: deletes the Clerk user and their saved talks, saved places and
  Meet answers. Their past events stay, without the user ID.

Admins can't remove, block or delete organizers or themselves. Each action is
logged as an `admin_action` event.

**Check-in** (`/admin/check-in`, and **Check-in Guests** in an admin's account
menu) is for the door. Type a full name, a last name or an email, or tap
**Scan** to read the QR code on the guest's Luma ticket with the phone's
camera:

- The app keeps a copy of the Luma event's guest list (`LUMA_EVENT_ID`) in D1,
  without guests whose only ticket is a livestream one (they watch online and
  are never checked in; Luma still has them). It's a copy because Luma sends 50
  guests per request (about 3 seconds for the whole list). A cron refreshes it
  every 10 minutes in conference week (November 1-7, UTC), and otherwise
  searches refresh it in the background once it's 15 minutes old. New
  registrations in between are caught by the newest-50 check below. The page
  shows when it last came from Luma.
- Likely guests are picked by spelling (`src/lib/guest-match.ts`), and Claude
  Sonnet 5.5, through OpenRouter, judges which of them was meant and orders
  them (about 1.2 seconds). If OpenRouter is busy (new accounts have a low
  rate limit) or doesn't answer in 3 seconds, Llama 3.3 70B on Workers AI
  judges instead. An exact email or full name skips the AI. The likely
  guests' names and emails go to the AI; OpenRouter is asked to use only
  providers that don't keep or train on them. Guests are found by the name
  on their Luma account too, when it differs from the name they registered.
  A registration holding several tickets says so: checking it in covers
  everyone on it.
- If it's obvious who, that one guest is shown; otherwise everyone who might
  be them, five at a time (**Show all**). A name several guests share, like
  "john", or someone registered twice, always gets the list. Nobody is checked
  in until you tap **Check in**. Guests who aren't going (declined,
  waitlisted, invited) are flagged.
- A scanned ticket (`https://luma.com/check-in/evt-…?pk=…`, with a guest key
  from the emailed ticket or a ticket key from Luma's CSV export) is looked up
  in Luma itself, so it's current, and shown like an obvious match: tap
  **Check in**. A livestream-only ticket or another event's ticket is refused.
  The camera works only over HTTPS (and on localhost).
- If nobody matches on the copy, the app checks Luma's 50 newest
  registrations (about 0.15 seconds) and looks again before saying so.
- A walk-in gets a name and email. First the app checks Luma's newest
  registrations the same way: a registered email shows that guest to check in
  instead, and a similar name is shown to confirm before anyone new is added.
- A check-in can be taken back: **Wrong person?** right after it (which then
  lists the other close guests, without the one just taken back), or **Undo
  check-in** when you search them.

`CHECK_IN_DEMO` in `wrangler.jsonc` is `"true"` for now: check-ins and walk-ins
are saved only in this app, and nothing is sent to Luma. With `"false"`,
walk-ins are added to Luma as going, with the event's default ticket type (so
check that it's the in-person one), and Luma emails them a ticket. Undoing a
walk-in's check-in doesn't remove them from Luma. Luma's API can read
check-ins but can't make them, so check-ins stay in this app's `check_ins`
table either way; demo and real ones are kept apart.

**Analytics** (`/admin/analytics`; `/analytics` redirects there): visitors,
page views (attendees', not organizers' on the admin pages), signed-in
attendees (not counting organizers' admin activity), directions taps, saves
and AI assistant use,
page views over time, Meet (who's on it, joins, changed answers, leaves,
topic opens and LinkedIn taps, by topic), check-in (checked in, walk-ins and
the size of the guest list, whose share leaves out walk-ins; demo check-ins
in demo mode), the places people
go, the most-saved talks, and the AI assistant (requests by tool, and the
searches and Meet topics people asked about). Hours and days are Eastern,
including across the change to and from daylight saving time. Every number
comes from the `events` table, the app's event log, so it can be worked out
again from the download: saves are `session_save` and `place_save` events,
who's on Meet now is everyone whose last Meet event is a join or a change of
answers (not a leave, or an admin's block or delete), and check-ins are each
guest's last check-in event unless it was undone. **Download every
event** links there give the whole `events` table as CSV or JSON
(`/api/admin/events?format=csv|json`, admins only) for another tool.

`events` rows hold `type`, `ts`, `anon_id` (per device), `user_id` (when
signed in), `path` and JSON `props`. Event types: `page_view`, `place_view`,
`map_button_click`, `session_save`, `session_unsave`, `place_save`,
`place_unsave`, `mcp_modal_open`, `mcp_url_copy`, `mcp_tool_call`,
`match_join`, `match_update`, `match_leave` (logged by the server when someone
joins Meet, changes their answers or leaves, with their topics and whether
they gave a LinkedIn), `match_topic_open`, `match_linkedin_click`,
`admin_action`, `check_in` and `check_in_undo` (logged by the check-in desk,
with `guest_id`, `demo` and `walk_in`), and `guest_list_sync` (the guest
list's size, logged when a sync with Luma changes it). For example:

```bash
npx wrangler d1 execute DB --remote --command \
  "SELECT json_extract(props,'$.place_name') AS place, COUNT(*) AS clicks FROM events WHERE type='map_button_click' GROUP BY place ORDER BY clicks DESC LIMIT 20"
```

**GA4** (`G-QRWD85BG5Z`) gets every event the browser logs, with the same
name and props (`logToGa` in `src/lib/analytics.ts`), except page views, which
the tag sends itself. GA4 uses `session_id` for its own sessions, so a talk's
ID goes as `talk_id`. Meet's joins, changes and leaves are logged by the
server, so the browser sends them to GA4 once they've worked. Events only the
server sees (MCP tool calls and saves, check-ins, the guest list's size, admin
actions) aren't in GA4. Run `enableAnalyticsDebug()` in the browser console to
log events as they fire. The browser tests block GA4, so test runs never reach
it.

## Roadmap

- **Amp Code shared workspace** for the organizers to work on the app
  together, once the app is built.
