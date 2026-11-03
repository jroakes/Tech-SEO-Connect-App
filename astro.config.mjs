// @ts-check
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import clerk from "@clerk/astro";

const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

// Sign-in is optional: without a Clerk key the app still runs, and saved
// sessions stay on the device only.
// The browser tests build with FAKE_AUTH=1: fake accounts (tests/fake-auth)
// stand in for Clerk, so the tests can sign in as anyone. Only on localhost.
const fakeAuth = process.env.FAKE_AUTH === "1";
const clerkEnabled = fakeAuth || Boolean(env.PUBLIC_CLERK_PUBLISHABLE_KEY);
const fake = (file) => fileURLToPath(new URL(`./tests/fake-auth/${file}`, import.meta.url));

export default defineConfig({
  site: "https://app.techseoconnect.com",
  output: "server",
  // No Astro sessions or Cloudflare Images: they'd provision a KV namespace
  // and an Images binding this app doesn't use.
  session: false,
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [react(), ...(clerkEnabled && !fakeAuth ? [clerk()] : [])],
  redirects: {
    "/": "/schedule",
    "/my-schedule": "/my-conference",
    "/analytics": "/admin/analytics",
  },
  // map.html rather than map/index.html, so /map is served without a
  // redirect to /map/ (the service worker can't cache redirected pages).
  build: {
    format: "file",
  },
  vite: {
    define: {
      "import.meta.env.PUBLIC_CLERK_ENABLED": JSON.stringify(clerkEnabled),
    },
    ...(fakeAuth && {
      resolve: {
        alias: [
          { find: /^@clerk\/astro\/react$/, replacement: fake("react.tsx") },
          { find: /^@clerk\/astro\/server$/, replacement: fake("server.ts") },
          { find: /^@clerk\/backend$/, replacement: fake("backend.ts") },
        ],
      },
    }),
  },
});
