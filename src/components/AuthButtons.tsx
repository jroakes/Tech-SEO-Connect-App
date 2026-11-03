import { useEffect, useState, useSyncExternalStore } from "react";
import { Show, SignInButton, UserButton, useAuth } from "@clerk/astro/react";
import { $userStore } from "@clerk/astro/client";
import { Button } from "@/components/ui/button";

// lucide's "shield" and "user-check" icons, for the admin links in the account menu.
const SHIELD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>';
const USER_CHECK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 11 2 2 4-4"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>';
const ORGANIZER_KEY = "tsc_organizer_";
const icon = (svg: string) => ({ mountIcon: (el: HTMLDivElement) => (el.innerHTML = svg), unmountIcon: (el?: HTMLDivElement) => el && (el.innerHTML = "") });

export default function AuthButtons() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  // The account as Clerk's script loads it on every page, so a role given or
  // taken away on the admin page shows the next time a page opens, and
  // nothing extra is asked for.
  const user = useSyncExternalStore($userStore.listen, $userStore.get);
  const [organizer, setOrganizer] = useState(false);

  // Organizers (ORGANIZER_EMAILS, which only the server has) are always
  // admins. That changes only with a deploy, so it's asked once per sign-in
  // and kept on the device. Signing out forgets it.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !userId) {
      try {
        for (const key of Object.keys(localStorage)) if (key.startsWith(ORGANIZER_KEY)) localStorage.removeItem(key);
      } catch {}
      return setOrganizer(false);
    }
    const key = `${ORGANIZER_KEY}${userId}`;
    try {
      const known = localStorage.getItem(key);
      if (known !== null) return setOrganizer(known === "true");
    } catch {}
    fetch("/api/me")
      .then((res) => (res.ok ? (res.json() as Promise<{ organizer: boolean }>) : null))
      .then((data) => {
        if (!data) return;
        setOrganizer(data.organizer);
        try {
          localStorage.setItem(key, String(data.organizer));
        } catch {}
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn, userId]);

  // Admins get links to the admin pages in their account menu.
  const admin = organizer || user?.publicMetadata?.role === "admin";

  // A fixed-size slot, the size of the fallback in Header.astro, so the header
  // doesn't shift as the page starts up and Clerk loads.
  return (
    <div className="flex h-9 w-[4.25rem] items-center justify-end">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button variant="outline" size="sm" className="min-h-9" data-testid="button-sign-in">
            Sign in
          </Button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        {/* Clerk reads the menu items only when the button mounts, so remount it once we know. */}
        <UserButton
          key={admin ? "admin" : "attendee"}
          customMenuItems={
            admin
              ? [
                  { label: "Check-in Guests", href: "/admin/check-in", ...icon(USER_CHECK_ICON) },
                  { label: "Admin", href: "/admin", ...icon(SHIELD_ICON) },
                ]
              : undefined
          }
        />
      </Show>
    </div>
  );
}
