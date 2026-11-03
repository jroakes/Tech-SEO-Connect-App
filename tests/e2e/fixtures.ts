// What every browser test starts with: the opening animation already seen,
// directions links that don't open a new tab, a record of the events the page
// logs to /api/events (sent with fetch rather than sendBeacon, whose requests
// the test can't read), and GA4 kept out of it (see gaEvents).
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

interface LoggedEvent {
  type: string;
  path?: string;
  props?: Record<string, unknown>;
}

export const test = base.extend<{ events: LoggedEvent[]; opened: string[] }>({
  events: async ({ page }, use) => {
    const events: LoggedEvent[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith("/api/events") && req.method() === "POST") {
        try {
          events.push(...(JSON.parse(req.postData() ?? "{}").events ?? []));
        } catch {}
      }
    });
    await use(events);
  },
  opened: async ({ page }, use) => {
    const opened: string[] = [];
    await page.exposeFunction("__recordOpen", (url: string) => opened.push(url));
    await use(opened);
  },
  page: async ({ page }, use) => {
    await blockGa(page.context());
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("tsc_splash_seen", "1");
      } catch {}
      navigator.sendBeacon = () => false;
      window.open = (url?: string | URL) => {
        (window as unknown as { __recordOpen?: (u: string) => void }).__recordOpen?.(String(url));
        return null;
      };
    });
    await use(page);
  },
});

export { expect };

/** Keeps test runs out of GA4: gtag.js never loads, so its calls stay in window.dataLayer. */
export const blockGa = (context: BrowserContext) => context.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort());

/** The events the page has sent to GA4 so far, as name and params. */
export const gaEvents = (page: Page) =>
  page.evaluate(() =>
    ((window as unknown as { dataLayer?: IArguments[] }).dataLayer ?? [])
      .map((entry) => Array.from(entry))
      .filter(([command]) => command === "event")
      .map(([, name, params]) => ({ name: name as string, params: params as Record<string, unknown> })),
  );

/** Opens a page and waits until its interactive parts are ready. */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => [...document.querySelectorAll("astro-island")].every((island) => !island.hasAttribute("ssr")));
}

/** Sends the queued events now (the page sends them when it's hidden). */
export async function flushEvents(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
}
