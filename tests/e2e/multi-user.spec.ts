// Several people at once, as fake accounts (tests/fake-auth): an admin making
// someone else an admin, an admin adding walk-ups, and attendees on Meet (finding
// each other by topic, leaving and rejoining, and a blocked attendee being signed
// out).
import type { Browser, Page, TestInfo } from "@playwright/test";
import { blockGa, expect, gaEvents, open, test } from "./fixtures";

// The tests' D1 keeps accounts between runs, so each run makes new ones. An
// account's ID says who it is (see tests/fake-auth/backend.ts).
const run = Date.now().toString(36);
const person = (kind: "user" | "admin", first: string, last: string) => ({ id: `${kind}_${first}_${last}-${run}`, name: `${first} ${last}-${run}` });

/** A browser of its own for someone, signed in as their fake account. */
async function signIn(browser: Browser, id: string, info: TestInfo): Promise<Page> {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = info.project.use;
  const context = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL });
  await blockGa(context);
  await context.addCookies([{ name: "tsc_test_user", value: id, domain: "localhost", path: "/" }]);
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("tsc_splash_seen", "1");
    } catch {}
  });
  return context.newPage();
}

/** Opens a page and returns its account menu's links to the admin pages, once the menu knows the account. */
async function adminLinks(page: Page, path: string) {
  const account = page.waitForResponse((res) => res.url().endsWith("/__test/user"));
  await open(page, path);
  await (await account).finished();
  // A frame for the menu to show what it learned.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  return page.getByTestId("fake-user-button").locator('a[href^="/admin"]');
}

test("an admin makes an attendee an admin, who can then use the admin pages", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "Once is enough; the phone works the door.");
  const ada = person("admin", "Ada", "Admin");
  const carol = person("user", "Carol", "Nguyen");
  const adaPage = await signIn(browser, ada.id, info);
  const carolPage = await signIn(browser, carol.id, info);

  // Carol signs in. She's an attendee: no admin links, and the admin pages are locked.
  await expect(await adminLinks(carolPage, "/schedule")).toHaveCount(0);
  await open(carolPage, "/admin");
  await expect(carolPage.getByTestId("panel-admin-locked")).toBeVisible();

  // Ada finds her on the Users page and makes her an admin.
  await open(adaPage, `/admin?q=${encodeURIComponent(carol.name)}`);
  const row = adaPage.getByTestId(`row-user-${carol.id}`);
  await row.getByRole("button", { name: "Make admin" }).click();
  await adaPage.getByTestId("button-confirm-action").click();
  await expect(row.getByRole("button", { name: "Remove admin" })).toBeVisible();

  // On her next page her account menu has the admin links, and she can open
  // every admin page.
  await expect(await adminLinks(carolPage, "/schedule")).toHaveCount(2);
  await open(carolPage, "/admin");
  await expect(carolPage.getByTestId("list-users")).toBeVisible();
  await open(carolPage, "/admin/analytics");
  await expect(carolPage.getByTestId("section-meet")).toBeVisible();
  await open(carolPage, "/admin/check-in");
  await expect(carolPage.getByTestId("form-walk-up")).toBeVisible();

  // Ada's account menu links to the admin pages.
  await expect(await adminLinks(adaPage, "/schedule")).toHaveCount(2);
  await adaPage.getByTestId("fake-user-button").click();
  await expect(adaPage.getByRole("link", { name: "Admin" })).toBeVisible();
  await expect(adaPage.getByRole("link", { name: "Check-in Guests" })).toBeVisible();

  // Ada takes it back: on Carol's next page the links are gone and the admin pages lock again.
  await open(adaPage, `/admin?q=${encodeURIComponent(carol.name)}`);
  await row.getByRole("button", { name: "Remove admin" }).click();
  await adaPage.getByTestId("button-confirm-action").click();
  await expect(row.getByRole("button", { name: "Make admin" })).toBeVisible();
  await expect(await adminLinks(carolPage, "/schedule")).toHaveCount(0);
  await open(carolPage, "/admin");
  await expect(carolPage.getByTestId("panel-admin-locked")).toBeVisible();
});

test("the door: a link to Luma's check-in page, and walk-ups added with a free ticket", async ({ browser }, info) => {
  test.skip(info.project.name !== "phone", "The door is worked on phones.");
  const ada = await signIn(browser, person("admin", "Ada", "Door").id, info);
  const add = async (name: string, email: string) => {
    await ada.getByTestId("input-walk-up-name").fill(name);
    await ada.getByTestId("input-walk-up-email").fill(email);
    await ada.getByTestId("button-add-walk-up").click();
  };
  const result = ada.getByTestId("text-walk-up-result");

  await open(ada, "/admin/check-in");
  await expect(ada.getByTestId("link-luma-check-in")).toHaveAttribute("href", /^https:\/\/luma\.com\/check-in\/evt-/);

  // Wanda has no ticket, so Ada adds her, and the form is ready for the next person.
  await add("Wanda Walkup", `wanda-${run}@example.test`);
  await expect(result).toContainText("Wanda Walkup has a free ticket");
  await expect(ada.getByTestId("input-walk-up-name")).toHaveValue("");

  // Someone already going isn't added again.
  await add("Wanda Walkup", `wanda-${run}@example.test`);
  await expect(result).toContainText("Wanda Walkup is already registered (Free)");
  await add("Ann", "ann.lee@example.test");
  await expect(result).toContainText("Ann Lee is already registered (General Admission)");
});

test("attendees find each other on Meet by shared topic, leave and rejoin, and a blocked one is signed out", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "Once is enough; the phone works the door.");
  const ann = person("user", "Ann", "Meet");
  const bea = person("user", "Bea", "Meet");
  const cy = person("user", "Cy", "Meet");
  const [annPage, beaPage, cyPage] = await Promise.all([ann, bea, cy].map((p) => signIn(browser, p.id, info)));

  const join = async (page: Page, topics: string[], linkedin?: string) => {
    await open(page, "/meet");
    const form = page.getByTestId("form-profile");
    for (const topic of topics) await form.getByTestId(`topic-${topic}`).click();
    if (linkedin) await form.getByTestId("input-linkedin").fill(linkedin);
    await form.getByTestId("button-save-profile").click();
    await expect(page.getByTestId("topic-circles")).toBeVisible();
  };
  await join(annPage, ["bigquery", "python"], `linkedin.com/in/ann-meet-${run}`);
  // GA4 hears about it from the browser (the server logs it in the event log).
  expect(await gaEvents(annPage)).toContainEqual({ name: "match_join", params: { topics: "bigquery,python", topic_count: 2, linkedin: true } });
  await join(beaPage, ["bigquery", "log-files"]);
  await join(cyPage, ["local"]);

  // Bea opens BigQuery and finds Ann, but not Cy, who didn't pick it.
  const bigquery = async () => {
    // A new address each time, so the page loads again rather than only changing its #topic.
    await open(beaPage, `/meet?at=${Date.now()}#bigquery`);
    const group = beaPage.getByTestId("panel-group");
    await expect(group).toContainText(bea.name);
    return group;
  };
  let group = await bigquery();
  await expect(group).toContainText(ann.name);
  await expect(group).not.toContainText(cy.name);

  // Topics are set once saved.
  await beaPage.getByTestId("button-all-topics").click();
  await beaPage.getByTestId("button-edit-profile").click();
  await expect(beaPage.getByTestId("text-topics-locked")).toBeVisible();

  // Ann leaves: she's told so, and Bea no longer sees her.
  annPage.once("dialog", (dialog) => dialog.accept());
  await annPage.getByRole("button", { name: "Leave" }).click();
  await expect(annPage.getByTestId("panel-meet-left")).toBeVisible();
  expect((await gaEvents(annPage)).map((e) => e.name)).toContain("match_leave");
  group = await bigquery();
  await expect(group).not.toContainText(ann.name);

  // She rejoins, with the same topics, and Bea sees her again.
  await annPage.getByTestId("button-rejoin-meet").click();
  await expect(annPage.getByTestId("text-topics-locked")).toBeVisible();
  await annPage.getByTestId("button-save-profile").click();
  await expect(annPage.getByTestId("topic-circles")).toBeVisible();
  group = await bigquery();
  await expect(group).toContainText(ann.name);

  // An admin blocks Cy: he's signed out, so Meet asks him to sign in.
  const adaPage = await signIn(browser, person("admin", "Ada", "Meet").id, info);
  await open(adaPage, `/admin?q=${encodeURIComponent(cy.name)}`);
  await adaPage.getByTestId(`row-user-${cy.id}`).getByRole("button", { name: "Block" }).click();
  await adaPage.getByTestId("button-confirm-action").click();
  await expect(adaPage.getByTestId(`row-user-${cy.id}`).getByRole("button", { name: "Unblock" })).toBeVisible();
  await open(cyPage, "/meet");
  await expect(cyPage.getByTestId("panel-meet-sign-in")).toBeVisible();
});

test("one attendee on two devices: a saved talk shows on both, and removing it on one keeps it removed", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "Once is enough.");
  const eve = person("user", "Eve", "Twodevices");
  const [laptop, phone] = await Promise.all([signIn(browser, eve.id, info), signIn(browser, eve.id, info)]);
  const saved = (page: Page) => page.getByTestId("section-talks").locator('button[aria-pressed="true"]');
  // Taps reach the account in the background; the other device looks once they have.
  const reachesAccount = (page: Page) => page.waitForResponse((r) => r.url().endsWith("/api/saved") && r.request().method() === "POST");

  // She saves a talk on her laptop, and it's on her phone too.
  await open(laptop, "/schedule");
  await laptop.getByRole("tab", { name: /Thu, Nov 5/ }).click();
  const heart = laptop.locator('[data-testid^="button-save-"]:visible').first();
  await Promise.all([reachesAccount(laptop), heart.click()]);
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await open(phone, "/my-conference");
  await expect(saved(phone)).toHaveCount(1);

  // She removes it on her phone. Her laptop, which still has its copy of the
  // list, doesn't bring it back.
  await Promise.all([reachesAccount(phone), saved(phone).click()]);
  await expect(saved(phone)).toHaveCount(0);
  await open(laptop, "/my-conference");
  await expect(saved(laptop)).toHaveCount(0);
  await open(phone, "/my-conference");
  await expect(saved(phone)).toHaveCount(0);
});
