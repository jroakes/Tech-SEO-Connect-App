// A stand-in for Luma's API for the browser tests (LUMA_API_URL in
// playwright.config.ts): a few fictional guests, so the check-in desk never
// reads the real guest list.
import { createServer } from "node:http";

const PORT = 8799;

const guest = (id, first, last, ticket = "General Admission") => ({
  id,
  user_name: `${first} ${last}`,
  user_first_name: first,
  user_last_name: last,
  user_email: `${first}.${last}@example.test`.toLowerCase(),
  approval_status: "approved",
  event_tickets: [{ name: ticket, checked_in_at: null }],
});

// Oldest registration first.
const guests = [
  guest("g-ann", "Ann", "Lee"),
  guest("g-ben", "Ben", "Ortiz"),
  guest("g-cara", "Cara", "Diaz"),
  guest("g-dev", "Dev", "Patel"),
  guest("g-lara", "Lara", "Stream", "Livestream"),
];

// Ticket QR code keys (https://luma.com/check-in/<event>?pk=<key>).
const TICKET_KEYS ={ "g-benkey": "g-ben", "g-larakey": "g-lara" };

const send = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  if (url.pathname === "/v1/events/guests/list") {
    const newestFirst = url.searchParams.get("sort_column") === "registered_at";
    return send(res, 200, { entries: newestFirst ? [...guests].reverse() : guests, has_more: false });
  }
  if (url.pathname === "/v1/events/guests/get") {
    const found = guests.find((g) => g.id === TICKET_KEYS[url.searchParams.get("id")]);
    return found ? send(res, 200, found) : send(res, 404, { message: "Guest not found" });
  }
  // Demo mode never adds guests to Luma; this is in case it ever tries.
  if (url.pathname === "/v1/events/guests/add") return send(res, 200, { skipped: [] });
  send(res, 404, { message: `Not in the fake Luma: ${url.pathname}` });
}).listen(PORT, "127.0.0.1");
