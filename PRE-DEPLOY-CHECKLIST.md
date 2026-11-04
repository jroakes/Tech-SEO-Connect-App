# Pre-deploy checklist

Go through this before every deploy. Steps 1 to 3 are automatic and must
pass; step 5 is a few minutes of clicking on the live site afterwards.

## 1. Tests

Use Node 22.23.4 (`nvm use`).

- [ ] `npm run check`: no type errors.
- [ ] `npm test`: every unit and integration test passes (about 3 seconds).
- [ ] `npm run test:e2e`: every browser test passes (about 30 seconds after
      the build). Stop any other local server on port 8788 first, or the tests
      will use it.

The browser tests sign in as fake accounts (`tests/fake-auth`) instead of
through Clerk, and the check-in desk reads a stand-in for Luma with fictional
guests (`tests/e2e/fake-luma.mjs`), so nothing touches real accounts or the
real guest list. Together, the two test suites check:

**Several people at once** (`tests/e2e/multi-user.spec.ts`)

- [ ] An admin makes an attendee an admin. On the new admin's next page their
      account menu has the admin links, and they can open the Users,
      Analytics and Check-in pages and search the guest list right away.
      Taking admin away removes the links and locks the pages again.
- [ ] Two admins at the check-in desk, on phones: one finds a guest by name and
      checks them in, the other finds the same guest by email, sees they're
      checked in and undoes it, and the first sees the undo.
- [ ] Scanning a ticket's Luma QR code with the camera finds the guest, who's
      checked in and then undone. A livestream-only ticket is refused.
- [ ] Meet: three attendees join with their topics. People who share a topic
      see each other, and people who don't share one don't. Topics can't be
      changed once saved. Someone who leaves disappears for the others and gets
      a Rejoin button, and rejoining keeps their topics. A blocked attendee is
      signed out.
- [ ] One attendee on two devices: a talk saved on one shows on the other, and
      removing it on one keeps it removed on both.

**Everything else**

- [ ] The schedule, saving talks and places, and removing them in My
      Conference.
- [ ] Places: search, filters, directions, the map's pins.
- [ ] Sponsors' logos, the For AI bots dialog (on a small phone and over the
      map), redirects and the 404 page.
- [ ] Admin pages and APIs are locked for visitors.
- [ ] Every page logs its events and sends the same ones to GA4 (talk IDs as
      `talk_id`), and the analytics numbers add up from the event log alone:
      page views by Eastern day, saves, Meet, check-ins and the guest list's
      size.
- [ ] Check-in's name matching, the AI's judgment, newest registrations and
      walk-ins.
- [ ] Every MCP tool.

## 2. Database

- [ ] If the change adds a file to `migrations/`, run
      `npm run db:migrate:remote` **before** deploying the code that needs it.
      (On November 3, code that needed a new table went live before its
      migration ran, and Meet stopped working for signed-in attendees.)
- [ ] `npx wrangler d1 migrations list DB --remote` says there are no
      migrations to apply.

## 3. Deploy

- [ ] Deploy with `npm run deploy`, never `wrangler deploy` on its own. It
      rebuilds `dist/` first, so a build left by the browser tests (with the
      fake accounts) is never what goes live. That build would also refuse to
      sign anyone in anywhere but localhost.
- [ ] Commit and push what you deploy, so the live site matches the branch.

## 4. Secrets and settings (when they change)

- [ ] `npm run secrets` after any change to `CLERK_SECRET_KEY`,
      `OPENROUTER_API_KEY` or `LUMA_API_KEY` in `.env`.
- [ ] `wrangler.jsonc` vars: `ORGANIZER_EMAILS`, `LUMA_EVENT_ID`,
      `CHECK_IN_DEMO` (`"true"` saves check-ins only in the app; set it to
      `"false"` only when the desk should go live), and `CLERK_JWT_KEY` (the
      Clerk instance's public key; replace it if the Clerk instance changes or
      Clerk rotates its keys, or every sign-in on the server fails).

## 5. On the live site, after deploying

These use real Clerk accounts and the real Luma guest list, which the tests
don't.

- [ ] Sign in with a real account. The account menu appears, and for an admin
      it has Check-in Guests and Admin.
- [ ] Save a talk; it's in My Conference, and on another device signed in to
      the same account.
- [ ] Meet opens for a signed-in attendee (not the Sign in panel).
- [ ] Check-in desk: the demo-mode note shows (unless going live). Search a
      real guest's name, scan a real Luma ticket with a phone, then undo both.
- [ ] The Analytics page loads, and the guest list's size is there within 10
      minutes of a deploy in conference week.
- [ ] The For AI bots dialog shows the MCP URL; in conference week, connect it
      to Claude and ask about the schedule.
- [ ] Watch for errors for a few minutes: `npx wrangler tail`.

## Before the conference (once)

- [ ] Workers Paid plan, a production Clerk instance and OpenRouter credit
      (see Deploying in the README).
- [ ] The 120 demo Meet profiles are removed, so attendees only see real
      people.
- [ ] `CHECK_IN_DEMO` is `"false"` for the conference days, if the desk should
      check guests in for real.
