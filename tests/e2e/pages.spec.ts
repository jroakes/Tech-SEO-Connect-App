// Sponsors, Meet, the AI bots dialog, admin pages, redirects and page views.
import { expect, flushEvents, open, test } from "./fixtures";

test("shows every sponsor's logo", async ({ page }) => {
  await open(page, "/sponsors");
  const logos = page.locator('[data-testid^="card-sponsor-"] img');
  expect(await logos.count()).toBeGreaterThan(10);
  for (const logo of await logos.all()) {
    await logo.scrollIntoViewIfNeeded();
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
});

test("Meet asks visitors to sign in", async ({ page }) => {
  await open(page, "/meet");
  await expect(page.getByTestId("panel-meet-sign-in")).toBeVisible();
});

test("the For AI bots button shows the MCP server's URL", async ({ page, events }) => {
  await open(page, "/schedule");
  await page.getByTestId("button-ai-bots").click();
  await expect(page.getByTestId("dialog-ai-bots")).toBeVisible();
  await expect(page.getByTestId("input-mcp-url")).toHaveValue(/\/mcp$/);
  await expect(page.getByTestId("dialog-ai-bots")).toContainText("find people who share your");
  await flushEvents(page);
  expect(events.map((e) => e.type)).toContain("mcp_modal_open");
});

test("the For AI bots dialog fits a small phone and sits above the map", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await open(page, "/map");
  await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("button-ai-bots").click();
  const dialog = page.getByTestId("dialog-ai-bots");
  // Inside the screen, and nothing (like the map) on top of it.
  const clear = () =>
    dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const points = [r.left + 12, r.left + r.width / 2, r.right - 12].flatMap((x) =>
        [r.top + 12, r.top + r.height / 2, r.bottom - 12].map((y) => document.elementFromPoint(x, y)),
      );
      return r.top >= 0 && r.bottom <= innerHeight && points.every((p) => el.contains(p));
    });
  await expect.poll(clear).toBe(true);
  // The rest scrolls into view.
  const last = dialog.getByText("What's on my schedule Thursday?");
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});

for (const path of ["/admin", "/admin/analytics", "/admin/check-in"]) {
  test(`${path} is locked for visitors`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(401);
    await expect(page.getByTestId("panel-admin-locked")).toBeVisible();
  });
}

test("admin APIs refuse visitors", async ({ request }) => {
  expect((await request.post("/api/admin/check-in", { data: { action: "search", query: "x" } })).status()).toBe(401);
  expect((await request.get("/api/admin/events")).status()).toBe(401);
  expect((await request.post("/api/admin/users", { data: {} })).status()).toBe(403);
  expect((await request.get("/api/matches")).status()).toBe(401);
  expect((await request.post("/mcp", { data: {} })).status()).toBe(401);
});

test("/analytics goes to the admin analytics page", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page).toHaveURL(/\/admin\/analytics$/);
});

test("an unknown page says so", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("every page logs a page view", async ({ page, events }) => {
  // Each page's events are sent before leaving it (the test can't see what's sent as a page closes).
  for (const path of ["/schedule", "/my-conference", "/meet", "/map", "/locations", "/sponsors"]) {
    await open(page, path);
    await flushEvents(page);
  }
  const viewed = events.filter((e) => e.type === "page_view").map((e) => e.path);
  expect(viewed).toEqual(expect.arrayContaining(["/schedule", "/my-conference", "/meet", "/map", "/locations", "/sponsors"]));
});
