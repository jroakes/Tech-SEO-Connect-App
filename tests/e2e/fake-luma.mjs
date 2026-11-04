// A stand-in for Luma's API for the browser tests (LUMA_API_URL in
// playwright.config.ts), so walk-ups never reach the real event.
import { createServer } from "node:http";

const PORT = 8799;

const guests = [{ user_name: "Ann Lee", user_email: "ann.lee@example.test", approval_status: "approved", event_tickets: [{ name: "General Admission" }] }];

const send = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  if (url.pathname === "/v1/events/guests/get") {
    const found = guests.find((g) => g.user_email === url.searchParams.get("id"));
    return found ? send(res, 200, found) : send(res, 404, { message: "Guest not found." });
  }
  if (url.pathname === "/v1/events/ticket-types/list") return send(res, 200, { entries: [{ id: "ttype-free", name: "Free" }] });
  if (url.pathname === "/v1/events/guests/add") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { guests: added } = JSON.parse(body);
    for (const g of added) guests.push({ user_name: g.name, user_email: g.email, approval_status: "approved", event_tickets: [{ name: "Free" }] });
    return send(res, 200, { skipped: [] });
  }
  send(res, 404, { message: `Not in the fake Luma: ${url.pathname}` });
}).listen(PORT, "127.0.0.1");
