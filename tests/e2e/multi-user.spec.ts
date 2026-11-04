// Several people at once, as fake accounts (tests/fake-auth): an admin making
// someone else an admin, two admins at the check-in desk (name search, a
// ticket's QR code, undo), and attendees on Meet (finding each other by topic,
// leaving and rejoining, and a blocked attendee being signed out).
import QRCode from "qrcode";
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

/** Points the page's camera at a QR code of `text`, for the ticket scanner. */
async function showToCamera(page: Page, text: string) {
  const qr = await QRCode.toDataURL(text, { margin: 4, width: 360 });
  await page.evaluate((src) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 600;
      const ctx = canvas.getContext("2d")!;
      const draw = () => {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 600, 600);
        ctx.drawImage(image, 120, 120, 360, 360);
        requestAnimationFrame(draw);
      };
      draw();
      return canvas.captureStream(15);
    };
  }, qr);
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
  test.skip(info.project.name !== "desktop", "Once is enough; the phone runs the check-in desk.");
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
  // every admin page and use the check-in desk.
  await expect(await adminLinks(carolPage, "/schedule")).toHaveCount(2);
  await open(carolPage, "/admin");
  await expect(carolPage.getByTestId("list-users")).toBeVisible();
  await open(carolPage, "/admin/analytics");
  await expect(carolPage.getByTestId("section-meet")).toBeVisible();
  await open(carolPage, "/admin/check-in");
  await carolPage.getByTestId("input-check-in-search").fill("Dev Patel");
  await carolPage.getByTestId("button-check-in-search").click();
  await expect(carolPage.getByTestId("row-guest-g-dev")).toBeVisible();

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

test("two admins at the check-in desk: name search, check in, undo, and a ticket's QR code", async ({ browser }, info) => {
  test.skip(info.project.name !== "phone", "The desk is used on phones at the door.");
  const ada = await signIn(browser, person("admin", "Ada", "Door").id, info);
  const max = await signIn(browser, person("admin", "Max", "Door").id, info);
  const find = async (page: Page, query: string) => {
    await page.getByTestId("input-check-in-search").fill(query);
    await page.getByTestId("button-check-in-search").click();
  };
  // A check-in left by an earlier run (the tests' D1 keeps them) is taken back first.
  const fresh = async (page: Page, guestId: string) => {
    const row = page.getByTestId(`row-guest-${guestId}`);
    await expect(row).toBeVisible();
    if (await row.getByTestId(`button-undo-${guestId}`).isVisible()) await row.getByTestId(`button-undo-${guestId}`).click();
    await expect(row.getByTestId(`button-check-in-${guestId}`)).toBeVisible();
    return row;
  };

  // Demo mode, unless an earlier run left the live switch on (the tests' D1 keeps it).
  const live = (page: Page) => page.getByTestId("switch-live-check-in");
  const flip = async (page: Page) => {
    page.once("dialog", (dialog) => dialog.accept());
    await live(page).click();
  };
  await open(ada, "/admin/check-in");
  if ((await live(ada).getAttribute("aria-checked")) === "true") await flip(ada);
  await expect(ada.getByTestId("text-demo-mode")).toBeVisible();

  // Ada turns live check-in on; Max's desk shows it on its next answer, and Ada turns it off again.
  await flip(ada);
  await expect(ada.getByTestId("text-live-mode")).toBeVisible();
  await expect(live(ada)).toHaveAttribute("aria-checked", "true");
  await open(max, "/admin/check-in");
  await expect(max.getByTestId("text-live-mode")).toBeVisible();
  await flip(ada);
  await expect(ada.getByTestId("text-demo-mode")).toBeVisible();
  await find(max, "Dev Patel");
  await expect(max.getByTestId("text-demo-mode")).toBeVisible();

  // Ada finds Ann by name and checks her in.
  await find(ada, "Ann Lee");
  const ann = await fresh(ada, "g-ann");
  await ann.getByTestId("button-check-in-g-ann").click();
  await expect(ann).toContainText("Checked in");

  // Max, at the other door, finds her by email, sees she's checked in, and takes it back.
  await open(max, "/admin/check-in");
  await find(max, "ann.lee@example.test");
  const annForMax = max.getByTestId("row-guest-g-ann");
  await expect(annForMax).toContainText("Checked in");
  await annForMax.getByTestId("button-undo-g-ann").click();
  await expect(annForMax.getByTestId("button-check-in-g-ann")).toBeVisible();

  // Ada looks again: Ann isn't checked in any more.
  await find(ada, "Ann Lee");
  await expect(ada.getByTestId("button-check-in-g-ann")).toBeVisible();

  // Ben shows his ticket's QR code to Ada's camera.
  await showToCamera(ada, "https://luma.com/check-in/evt-test?pk=g-benkey");
  await ada.getByTestId("button-scan-ticket").click();
  await expect(ada.getByText("Scanned ticket")).toBeVisible();
  const ben = await fresh(ada, "g-ben");
  await ben.getByTestId("button-check-in-g-ben").click();
  await expect(ben).toContainText("Checked in");
  await ben.getByTestId("button-undo-g-ben").click();
  await expect(ben.getByTestId("button-check-in-g-ben")).toBeVisible();

  // A livestream-only ticket is for watching online, so it isn't checked in.
  await showToCamera(ada, "https://luma.com/check-in/evt-test?pk=g-larakey");
  await ada.getByTestId("button-scan-ticket").click();
  await expect(ada.getByText(/livestream-only ticket/)).toBeVisible();

  // Wanda isn't on the list, so Ada adds her at the door, which checks her in.
  // A name unlike earlier runs' walk-ins (the tests' D1 keeps them).
  const letters = () => Math.random().toString(36).slice(2, 10).replace(/\d/g, "x");
  const wanda = `${letters()} ${letters()}`;
  await find(ada, wanda);
  await ada.getByTestId("input-walk-in-email").fill(`wanda-${run}@example.test`);
  await ada.getByTestId("button-add-walk-in").click();
  const walkIn = ada.locator('[data-testid^="row-guest-walkin-"]');
  await expect(walkIn).toContainText("Checked in");

  // Wrong person? takes back only the check-in: she's still there to check in.
  await walkIn.getByRole("button", { name: "Wrong person?" }).click();
  await expect(walkIn.getByRole("button", { name: "Check in" })).toBeVisible();

  // Searching for her again finds her, and she can be checked in.
  await find(ada, wanda);
  await walkIn.getByRole("button", { name: "Check in" }).click();
  await expect(walkIn).toContainText("Checked in");
});

test("attendees find each other on Meet by shared topic, leave and rejoin, and a blocked one is signed out", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "Once is enough; the phone runs the check-in desk.");
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
