// Service worker for the Tech SEO Connect app.
//
// Pages: network first, so schedule changes show up right away; the cached
// copy is used only when offline. Built assets under /_astro/ have hashed
// names, so they're cached forever. API, MCP, admin and other sites'
// requests are never cached.
//
// Bump VERSION whenever this file's caching rules change. The activate step
// deletes every cache from older versions, including the 2025 app's
// "techseo-connect-v1" caches on phones that installed it last year.

const VERSION = "2026-3";
const PAGE_CACHE = `tsc-pages-${VERSION}`;
const ASSET_CACHE = `tsc-assets-${VERSION}`;
const OFFLINE_PAGES = ["/schedule", "/my-conference", "/map", "/locations", "/sponsors"];

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
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== PAGE_CACHE && n !== ASSET_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
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
    event.respondWith(networkFirst(request));
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

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match("/schedule"));
    return cached || new Response("You're offline and this page isn't saved yet.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}
