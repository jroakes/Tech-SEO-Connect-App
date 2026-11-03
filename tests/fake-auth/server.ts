// Stands in for @clerk/astro/server in the browser tests' build (FAKE_AUTH=1;
// see astro.config.mjs): the signed-in account is the fake one named in the
// tsc_test_user cookie, which the tests set. It works only on localhost, so a
// test build that's deployed by mistake signs nobody in.
import { defineMiddleware } from "astro:middleware";
import { isBanned } from "./backend";

export const TEST_USER_COOKIE = "tsc_test_user";

export const clerkMiddleware = () =>
  defineMiddleware(async (context, next) => {
    if (!["localhost", "127.0.0.1"].includes(context.url.hostname)) throw new Error("Fake sign-in is only for local tests.");
    const id = context.cookies.get(TEST_USER_COOKIE)?.value || null;
    const userId = id && !(await isBanned(id)) ? id : null;
    (context.locals as { auth?: () => { userId: string | null } }).auth = () => ({ userId });
    return next();
  });
