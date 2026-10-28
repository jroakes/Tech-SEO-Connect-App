import { useAuth } from "@clerk/astro/react";

const clerkEnabled = import.meta.env.PUBLIC_CLERK_ENABLED;

export interface AuthState {
  enabled: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
}

/**
 * Clerk sign-in state for React islands. When Clerk isn't configured
 * (no publishable key), everyone is treated as signed out.
 */
export function useAuthState(): AuthState {
  if (!clerkEnabled) return { enabled: false, isLoaded: true, isSignedIn: false };
  // clerkEnabled is a build-time constant, so the hook order never changes.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isLoaded, isSignedIn } = useAuth();
  return { enabled: true, isLoaded, isSignedIn: Boolean(isSignedIn) };
}
