// Sign-in for the MCP server. AI clients (Claude and others) find Clerk through
// the protected resource metadata, register and run Clerk's OAuth sign-in,
// then call /mcp with the OAuth access token, which is checked here.
import { createClerkClient } from "@clerk/backend";

export const RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource/mcp";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, mcp-session-id, mcp-protocol-version, last-event-id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id",
};

const publishableKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;

/** Clerk's sign-in server for this app, read from the publishable key. */
function clerkIssuer(): string | null {
  const encoded = publishableKey?.split("_")[2];
  if (!encoded) return null;
  try {
    return `https://${atob(encoded).replace(/\$$/, "")}`;
  } catch {
    return null;
  }
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS, ...headers } });
}

/** Answers the OAuth discovery requests MCP clients make, or returns null. */
export async function handleOAuthDiscovery(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const isResource = url.pathname === RESOURCE_METADATA_PATH || url.pathname === "/.well-known/oauth-protected-resource";
  const isAuthServer = url.pathname === "/.well-known/oauth-authorization-server";
  if (!isResource && !isAuthServer) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const issuer = clerkIssuer();
  if (!issuer) return jsonResponse({ error: "Sign-in isn't configured." }, 503);

  if (isResource) {
    return jsonResponse({
      resource: `${url.origin}/mcp`,
      authorization_servers: [issuer],
      scopes_supported: ["profile", "email"],
      bearer_methods_supported: ["header"],
      resource_name: "Tech SEO Connect",
    });
  }
  // Older MCP clients look for the authorization server's metadata here.
  const upstream = await fetch(`${issuer}/.well-known/oauth-authorization-server`);
  return jsonResponse(await upstream.json(), upstream.status);
}

/**
 * The Clerk user ID behind a request's OAuth access token, or a response to
 * send back: a 401 that points the client at the sign-in metadata.
 */
export async function authenticateMcp(request: Request, secretKey: string | undefined): Promise<{ userId: string } | Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(request.url);
  const challenge = jsonResponse({ error: "invalid_token", error_description: "Sign in to use the Tech SEO Connect MCP server." }, 401, {
    "WWW-Authenticate": `Bearer resource_metadata="${url.origin}${RESOURCE_METADATA_PATH}"`,
  });
  if (!secretKey || !publishableKey || !request.headers.get("Authorization")?.startsWith("Bearer ")) return challenge;

  try {
    const clerk = createClerkClient({ secretKey, publishableKey });
    const state = await clerk.authenticateRequest(request, { acceptsToken: "oauth_token" });
    const userId = state.isAuthenticated ? state.toAuth().userId : null;
    return userId ? { userId } : challenge;
  } catch (err) {
    console.error("MCP token check failed", err);
    return challenge;
  }
}

/** Adds the CORS headers MCP clients in a browser need to a response. */
export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
