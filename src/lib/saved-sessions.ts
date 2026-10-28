import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthState } from "./auth-client";

const STORAGE_KEY = "tsc_saved_sessions";

function readLocal(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeLocal(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable (private mode); the list lasts for this page only.
  }
}

async function postSaved(change: { add?: string[]; remove?: string[] }): Promise<string[] | null> {
  try {
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sessionIds: string[] };
    return data.sessionIds;
  } catch {
    return null;
  }
}

/**
 * Saved sessions live on the device and, once signed in, in the user's
 * account. Signing in merges the device list into the account.
 */
export function useSavedSessions() {
  const auth = useAuthState();
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const savedRef = useRef(saved);
  const wasSignedIn = useRef(false);

  const apply = useCallback((next: Set<string>) => {
    savedRef.current = next;
    writeLocal(next);
    setSaved(next);
  }, []);

  useEffect(() => {
    const local = readLocal();
    savedRef.current = local;
    setSaved(local);
  }, []);

  useEffect(() => {
    if (!auth.isLoaded) return;

    if (!auth.isSignedIn) {
      // Signed out on this device: drop the account's list from it.
      if (wasSignedIn.current) apply(new Set());
      wasSignedIn.current = false;
      return;
    }

    wasSignedIn.current = true;
    let cancelled = false;
    postSaved({ add: [...readLocal()] }).then((ids) => {
      if (ids && !cancelled) apply(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [auth.isLoaded, auth.isSignedIn, apply]);

  const toggle = useCallback(
    (id: string): boolean => {
      const next = new Set(savedRef.current);
      const nowSaved = !next.has(id);
      if (nowSaved) next.add(id);
      else next.delete(id);
      apply(next);
      if (auth.isSignedIn) postSaved(nowSaved ? { add: [id] } : { remove: [id] });
      return nowSaved;
    },
    [apply, auth.isSignedIn],
  );

  return { saved, toggle, auth };
}
