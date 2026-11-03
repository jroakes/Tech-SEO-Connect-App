// Stands in for @clerk/astro/client in the browser tests' build (FAKE_AUTH=1;
// see astro.config.mjs): the signed-in fake account, loaded as the page
// opens, as Clerk's script loads the real one.
type FakeUser = { id: string; publicMetadata: { role?: string | null } } | null;

let user: FakeUser | undefined; // undefined until it's loaded, like Clerk's
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  fetch("/__test/user")
    .then((res) => res.json() as Promise<FakeUser>)
    .then((loaded) => {
      user = loaded;
      for (const listener of listeners) listener();
    })
    .catch(() => {});
}

export const $userStore = {
  get: () => user,
  listen(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
