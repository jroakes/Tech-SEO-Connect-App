// Stands in for src/lib/clerk.ts in tests: the signed-in user comes from
// `locals` (see helpers.ts), and users whose ID starts with "admin" are admins.
import { getUserId } from "@/lib/auth-server";
import type { User } from "@/lib/clerk";

const userFor = (id: string) =>
  ({
    id,
    firstName: "Test",
    lastName: id,
    username: null,
    imageUrl: `https://img.test/${id}.png`,
    emailAddresses: [{ id: "email", emailAddress: `${id}@example.com`, verification: { status: "verified" } }],
    primaryEmailAddressId: "email",
    publicMetadata: id.startsWith("admin") ? { role: "admin" } : {},
  }) as unknown as User;

export const clerk = () => {
  throw new Error("Clerk's API isn't available in tests.");
};
export const isAdmin = (user: User) => user.publicMetadata?.role === "admin";
export const isOrganizer = () => false;
export const displayName = (user: User) => `${user.firstName} ${user.lastName}`;
export const primaryEmail = (user: User) => user.emailAddresses[0]?.emailAddress ?? null;
export const currentUser = async (locals: App.Locals) => {
  const id = getUserId(locals);
  return id ? userFor(id) : null;
};
export const currentAdmin = async (locals: App.Locals) => {
  const user = await currentUser(locals);
  return user && isAdmin(user) ? user : null;
};
export const isRecentAdmin = async (locals: App.Locals) => !!(await currentAdmin(locals));
export const recentAdmin = async (locals: App.Locals) => ((await isRecentAdmin(locals)) ? { id: getUserId(locals)! } : null);
