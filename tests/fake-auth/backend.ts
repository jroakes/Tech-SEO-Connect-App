// Stands in for @clerk/backend in the browser tests' build (FAKE_AUTH=1; see
// astro.config.mjs). Fake accounts live in a test_users table in the tests'
// local D1, made here and never in production.
//
// An account's ID says who it is: "<kind>_<First>_<Last>_<run>", e.g.
// "user_Ann_Lee_lx3k". It's made the first time it's seen; "admin" accounts
// start as admins, like organizers.
import { env } from "cloudflare:workers";

interface FakeUser {
  id: string;
  firstName: string;
  lastName: string;
  username: null;
  imageUrl: string;
  emailAddresses: { id: string; emailAddress: string; verification: { status: string } }[];
  primaryEmailAddressId: string;
  publicMetadata: { role?: string | null };
  createdAt: number;
  lastSignInAt: number;
  lastActiveAt: number;
  banned: boolean;
}

let ready: Promise<unknown> | null = null;
const table = () =>
  (ready ??= env.DB.prepare("CREATE TABLE IF NOT EXISTS test_users (id TEXT PRIMARY KEY, user TEXT NOT NULL, created_at INTEGER NOT NULL)").run());

function newUser(id: string): FakeUser {
  const [kind, first = "Test", last = "User"] = id.split("_");
  const now = Date.now();
  return {
    id,
    firstName: first,
    lastName: last,
    username: null,
    imageUrl: "",
    emailAddresses: [{ id: "email", emailAddress: `${id.toLowerCase()}@example.test`, verification: { status: "verified" } }],
    primaryEmailAddressId: "email",
    publicMetadata: kind === "admin" ? { role: "admin" } : {},
    createdAt: now,
    lastSignInAt: now,
    lastActiveAt: now,
    banned: false,
  };
}

async function find(id: string): Promise<FakeUser | null> {
  await table();
  const row = await env.DB.prepare("SELECT user FROM test_users WHERE id = ?").bind(id).first<{ user: string }>();
  return row ? (JSON.parse(row.user) as FakeUser) : null;
}

async function save(user: FakeUser): Promise<FakeUser> {
  await table();
  await env.DB.prepare("INSERT INTO test_users (id, user, created_at) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET user = excluded.user")
    .bind(user.id, JSON.stringify(user), user.createdAt)
    .run();
  return user;
}

async function getUser(id: string): Promise<FakeUser> {
  return (await find(id)) ?? save(newUser(id));
}

async function change(id: string, update: Partial<FakeUser>): Promise<FakeUser> {
  return save({ ...(await getUser(id)), ...update });
}

/** Whether a fake account is blocked; blocked accounts can't be signed in. */
export async function isBanned(id: string): Promise<boolean> {
  return (await find(id))?.banned ?? false;
}

export function createClerkClient(_options?: unknown) {
  return {
    users: {
      getUser,
      async getUserList({ limit = 20, offset = 0, query }: { limit?: number; offset?: number; orderBy?: string; query?: string } = {}) {
        await table();
        const { results } = await env.DB.prepare("SELECT user FROM test_users ORDER BY created_at DESC").all<{ user: string }>();
        const q = query?.toLowerCase();
        const users = results
          .map((r) => JSON.parse(r.user) as FakeUser)
          .filter((u) => !q || `${u.firstName} ${u.lastName} ${u.emailAddresses[0].emailAddress}`.toLowerCase().includes(q));
        return { data: users.slice(offset, offset + limit), totalCount: users.length };
      },
      updateUserMetadata: async (id: string, { publicMetadata }: { publicMetadata: FakeUser["publicMetadata"] }) =>
        change(id, { publicMetadata: { ...(await getUser(id)).publicMetadata, ...publicMetadata } }),
      banUser: (id: string) => change(id, { banned: true }),
      unbanUser: (id: string) => change(id, { banned: false }),
      async deleteUser(id: string) {
        await table();
        await env.DB.prepare("DELETE FROM test_users WHERE id = ?").bind(id).run();
      },
    },
    // The MCP server's OAuth tokens: none are valid in the tests.
    authenticateRequest: async () => ({ isAuthenticated: false, toAuth: () => ({ userId: null }) }),
  };
}
