// Service worker for the Tech SEO Connect app.
//
// Pages: shown straight from the cache once they've been saved, so opening
// one doesn't wait on the network, and refreshed in the background for next
// time. If the refresh comes from a newer deploy (its /_astro/ files are
// different), the open page is told to reload, so it isn't left running the
// old build's code. A page that isn't saved yet comes from the network, with
// the request started while this worker boots (navigation preload), and the
// cache is used when offline. Built assets under /_astro/ have hashed names,
// so they're cached forever. API, MCP, admin and other sites' requests are
// never cached.
//
// Bump VERSION whenever this file's caching rules change. The activate step
// deletes every cache from older versions.

const VERSION = "2026-4";
const PAGE_CACHE = `tsc-pages-${VERSION}`;
const ASSET_CACHE = `tsc-assets-${VERSION}`;
const OFFLINE_PAGES = ["/schedule", "/my-conference", "/meet", "/map", "/locations", "/sponsors"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(OFFLINE_PAGES))
      .catch(() => {
        // Precaching is best effort; pages are cached as they're visited.
      }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== PAGE_CACHE && n !== ASSET_CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache APIs, the MCP server or the admin pages.
  if (url.pathname.startsWith("/api/") || url.pathname === "/mcp" || url.pathname.startsWith("/admin")) return;

  if (url.pathname.startsWith("/_astro/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(cachedPage(event, url));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function cachedPage(event, url) {
  // One copy per page: the same HTML serves every query string.
  const key = url.origin + url.pathname;
  const cache = await caches.open(PAGE_CACHE);
  const cached = await cache.match(key);
  const fresh = Promise.resolve(event.preloadResponse)
    .then((preloaded) => preloaded || fetch(event.request))
    .then((response) => {
      if (response.ok && response.type === "basic") cache.put(key, response.clone());
      return response;
    });

  if (!cached) {
    try {
      return await fresh;
    } catch {
      const fallback = await cache.match(url.origin + "/schedule");
      return fallback || new Response("You're offline and this page isn't saved yet.", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  }

  const saved = cached.clone();
  event.waitUntil(
    (async () => {
      const response = await fresh;
      if (!response.ok) return;
      const [before, after] = await Promise.all([saved.text(), response.text()]);
      if (builtFiles(before) !== builtFiles(after)) await tellToReload(url.pathname);
    })().catch(() => {
      // Offline: the saved page stays as it is.
    }),
  );
  return cached;
}

// The build a page came from, as the /_astro/ files it uses.
const builtFiles = (html) => [...new Set(html.match(/\/_astro\/[\w.-]+/g) ?? [])].sort().join(" ");

// The page may not be listed yet if the refresh beat it, so look a few times.
async function tellToReload(pathname) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const open = (await self.clients.matchAll({ type: "window" })).filter((c) => new URL(c.url).pathname === pathname);
    if (open.length) return open.forEach((c) => c.postMessage({ type: "reload" }));
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}
