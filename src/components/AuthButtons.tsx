import { useEffect, useState } from "react";
import { Show, SignInButton, UserButton, useAuth } from "@clerk/astro/react";
import { Button } from "@/components/ui/button";

// lucide's "shield" icon, for the Admin link in the account menu.
const SHIELD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>';

export default function AuthButtons() {
  const { isSignedIn } = useAuth();
  const [admin, setAdmin] = useState(false);

  // Admins get a link to the admin pages in their account menu.
  useEffect(() => {
    if (!isSignedIn) return setAdmin(false);
    fetch("/api/me")
      .then((res) => (res.ok ? (res.json() as Promise<{ admin: boolean }>) : null))
      .then((data) => setAdmin(!!data?.admin))
      .catch(() => {});
  }, [isSignedIn]);

  return (
    <>
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
                  {
                    label: "Admin",
                    href: "/admin",
                    mountIcon: (el) => (el.innerHTML = SHIELD_ICON),
                    unmountIcon: (el) => el && (el.innerHTML = ""),
                  },
                ]
              : undefined
          }
        />
      </Show>
    </>
  );
}
