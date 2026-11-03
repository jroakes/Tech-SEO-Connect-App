// Stands in for @clerk/astro/react in the browser tests' build (FAKE_AUTH=1;
// see astro.config.mjs): the signed-in account is the fake one named in the
// tsc_test_user cookie, which the tests set. Like Clerk's, the hooks don't
// know who's signed in until the page has started up.
import { useEffect, useState, type ReactNode } from "react";

const COOKIE = "tsc_test_user";

const signedInAs = () =>
  decodeURIComponent(
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1) ?? "",
  ) || null;

export function useAuth() {
  const [state, setState] = useState<{ isLoaded: boolean; isSignedIn: boolean; userId: string | null }>({ isLoaded: false, isSignedIn: false, userId: null });
  useEffect(() => {
    const userId = signedInAs();
    setState({ isLoaded: true, isSignedIn: !!userId, userId });
  }, []);
  return state;
}

export function Show({ when, children }: { when: "signed-in" | "signed-out"; children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  return isLoaded && isSignedIn === (when === "signed-in") ? <>{children}</> : null;
}

// Tests sign in by setting the cookie, so the button only shows.
export function SignInButton({ children }: { mode?: string; children: ReactNode }) {
  return <>{children}</>;
}

export function UserButton({ customMenuItems }: { customMenuItems?: { label: string; href: string }[] }) {
  return (
    <details className="relative" data-testid="fake-user-button">
      <summary className="cursor-pointer text-sm">Account</summary>
      <div className="absolute right-0 z-50 mt-1 flex flex-col gap-1 rounded border bg-background p-2 text-sm shadow">
        {customMenuItems?.map((item) => (
          <a key={item.href} href={item.href} className="whitespace-nowrap hover:underline">
            {item.label}
          </a>
        ))}
        <button
          type="button"
          className="text-left hover:underline"
          onClick={() => {
            document.cookie = `${COOKIE}=; path=/; max-age=0`;
            location.reload();
          }}
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
