import { defineMiddleware } from "astro:middleware";
import { clerkMiddleware } from "@clerk/astro/server";

const passthrough = defineMiddleware((_context, next) => next());

// Clerk is optional; see astro.config.mjs.
export const onRequest = import.meta.env.PUBLIC_CLERK_ENABLED ? clerkMiddleware() : passthrough;
