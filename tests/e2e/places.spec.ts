// Places: the list and the map, directions, and saving places.
import { expect, flushEvents, open, test } from "./fixtures";

test("searches and filters the list", async ({ page }) => {
  await open(page, "/locations");
  const cards = page.locator('[data-testid^="card-location-"]');
  const all = await cards.count();
  expect(all).toBeGreaterThan(20);

  await page.getByTestId("input-search").fill("Alimentari");
  await expect(cards).toHaveCount(1);
  await expect(cards.first().getByTestId("text-location-name")).toHaveText("Alimentari at Mothers & Sons");

  // Accents don't matter.
  await page.getByTestId("input-search").fill("crepes");
  await expect(cards.first().getByTestId("text-location-name")).toContainText("Crêpes");

  await page.getByTestId("input-search").fill("");
  const category = page.locator('[data-testid^="button-category-"]').nth(1);
  await category.click();
  expect(await cards.count()).toBeLessThan(all);
  await page.getByTestId("button-category-all").click();
  await expect(cards).toHaveCount(all);
});

test("opens a place, gets directions and saves it", async ({ page, events, opened }) => {
  await open(page, "/locations");
  const card = page.locator('[data-testid^="card-location-"]').first();
  const name = await card.getByTestId("text-location-name").innerText();

  await card.getByTestId("button-google-maps").click();
  await card.getByTestId("button-apple-maps").click();
  expect(opened[0]).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  expect(opened[1]).toMatch(/^https:\/\/maps\.apple\.com\/\?q=/);

  await card.getByTestId("text-location-name").click();
  const detail = page.getByTestId("dialog-location-detail");
  await expect(detail).toContainText(name);
  await detail.getByTestId("button-dialog-google-maps").click();
  await page.keyboard.press("Escape");

  await card.locator("button[aria-pressed]").first().click();
  await flushEvents(page);
  const types = events.map((e) => e.type);
  expect(types.filter((t) => t === "map_button_click")).toHaveLength(3);
  expect(types).toEqual(expect.arrayContaining(["place_view", "place_save"]));

  await open(page, "/my-conference");
  await expect(page.getByTestId("section-places")).toContainText(name);
});

test("shows the places on the map, with directions in each pin", async ({ page, events, opened }) => {
  await open(page, "/map");
  const pins = page.locator(".leaflet-marker-icon");
  await expect(pins.first()).toBeVisible({ timeout: 15_000 });
  expect(await pins.count()).toBeGreaterThan(20);
  // Every pin says which place it is.
  expect(await pins.evaluateAll((els) => els.every((el) => el.getAttribute("title")))).toBe(true);
  await pins.nth(3).click({ force: true });
  const apple = page.locator('[data-testid^="button-apple-maps-"]').first();
  await apple.click();
  expect(opened.at(-1)).toMatch(/^https:\/\/maps\.apple\.com\//);
  await flushEvents(page);
  expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["place_view", "map_button_click"]));
});
