// The schedule, and saving talks to My Conference.
import { expect, flushEvents, open, test } from "./fixtures";

test("shows each day's talks, with times and speakers", async ({ page }) => {
  await open(page, "/schedule");
  await expect(page.getByRole("heading", { name: "Conference Schedule" })).toBeVisible();
  const days = page.getByRole("tab");
  expect(await days.count()).toBeGreaterThanOrEqual(2);
  await page.getByRole("tab", { name: /Thu, Nov 5/ }).click();
  const talks = page.locator('[data-testid^="schedule-session-"]:visible');
  expect(await talks.count()).toBeGreaterThan(5);
  await expect(talks.first().getByTestId("text-session-time")).toHaveText(/\d{1,2}:\d{2} (AM|PM)/);
  await expect(page.locator('[data-testid="text-session-speaker"]:visible').first()).not.toBeEmpty();
});

test("saves a talk to My Conference and removes it there", async ({ page, events }) => {
  await open(page, "/schedule");
  await page.getByRole("tab", { name: /Thu, Nov 5/ }).click();
  const heart = page.locator('[data-testid^="button-save-"]:visible').first();
  const title = await heart.getAttribute("aria-label");
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await flushEvents(page);
  expect(events.map((e) => e.type)).toContain("session_save");

  await open(page, "/my-conference");
  const saved = page.getByTestId("section-talks").locator('button[aria-pressed="true"]');
  await expect(saved).toHaveCount(1);
  await expect(saved).toHaveAttribute("aria-label", title!.replace(/^Save (.*) to My Conference$/, "Remove $1 from My Conference"));
  await saved.click();
  await flushEvents(page);
  expect(events.map((e) => e.type)).toContain("session_unsave");

  await open(page, "/my-conference");
  await expect(page.getByTestId("section-talks").locator('button[aria-pressed="true"]')).toHaveCount(0);
});

test("/my-schedule goes to My Conference", async ({ page }) => {
  await page.goto("/my-schedule");
  await expect(page).toHaveURL(/\/my-conference$/);
});
