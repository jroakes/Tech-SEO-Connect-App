// @ts-check
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import clerk from "@clerk/astro";

const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

// Sign-in is optional: without a Clerk key the app still runs, and saved
// sessions stay on the device only.
const clerkEnabled = Boolean(env.PUBLIC_CLERK_PUBLISHABLE_KEY);

export default defineConfig({
  site: "https://app.techseoconnect.com",
  output: "server",
  // No Astro sessions or Cloudflare Images: they'd provision a KV namespace
  // and an Images binding this app doesn't use.
  session: false,
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [react(), ...(clerkEnabled ? [clerk()] : [])],
  redirects: {
    "/": "/schedule",
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
  },
});
