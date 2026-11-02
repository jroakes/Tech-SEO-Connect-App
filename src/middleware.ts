import { defineMiddleware } from "astro:middleware";
import { clerkMiddleware } from "@clerk/astro/server";

const passthrough = defineMiddleware((_context, next) => next());

// Clerk's server check bounces a browser out to Clerk and back on its first
// visit, and whenever its session token has expired, which costs about a
// second before the page starts. Only the API and the admin pages read sign-in
// on the server; every other page gets it in the browser, as the prerendered
// pages always have.
const readsSignIn = (path: string) => path.startsWith("/api/") || path === "/admin" || path.startsWith("/admin/");

// Clerk is optional; see astro.config.mjs.
const clerk = import.meta.env.PUBLIC_CLERK_ENABLED ? clerkMiddleware() : passthrough;
export const onRequest = defineMiddleware((context, next) => (readsSignIn(context.url.pathname) ? clerk(context, next) : next()));
