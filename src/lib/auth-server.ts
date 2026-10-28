/**
 * The signed-in Clerk user ID for this request, or null. Clerk's middleware
 * adds `locals.auth()` only when Clerk is configured.
 */
export function getUserId(locals: App.Locals): string | null {
  const auth = (locals as { auth?: () => { userId: string | null } }).auth;
  if (typeof auth !== "function") return null;
  return auth().userId ?? null;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
