import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthState } from "./auth-client";
import type { SavedKind } from "./db";

const STORAGE_KEYS: Record<SavedKind, string> = {
  session: "tsc_saved_sessions",
  place: "tsc_saved_places",
};

function readLocal(kind: SavedKind): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS[kind]);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeLocal(kind: SavedKind, ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify([...ids]));
  } catch {
    // Storage unavailable (private mode); the list lasts for this page only.
  }
}

async function postSaved(kind: SavedKind, change: { add?: string[]; remove?: string[] }): Promise<string[] | null> {
  try {
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...change }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ids: string[] };
    return data.ids;
  } catch {
    return null;
  }
}

/**
 * Saved talks or places live on the device and, once signed in, in the
 * user's account. Signing in merges the device list into the account.
 * `current` maps a saved ID to today's (a talk that moved day; see
 * currentSessionId).
 */
export function useSaved(kind: SavedKind, current: (id: string) => string = (id) => id) {
  const auth = useAuthState();
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const savedRef = useRef(saved);
  const wasSignedIn = useRef(false);
  // Taps made while the first sync with the account is on its way (id → saved).
  const tapsDuringSync = useRef<Map<string, boolean> | null>(null);

  const apply = useCallback(
    (next: Set<string>) => {
      savedRef.current = next;
      writeLocal(kind, next);
      setSaved(next);
    },
    [kind],
  );

  useEffect(() => {
    const stored = readLocal(kind);
    const local = new Set([...stored].map(current));
    if (local.size !== stored.size || [...local].some((id) => !stored.has(id))) writeLocal(kind, local);
    savedRef.current = local;
    setSaved(local);
    // `current` is the same for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

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
    tapsDuringSync.current = new Map();
    postSaved(kind, { add: [...readLocal(kind)] }).then((ids) => {
      const taps = tapsDuringSync.current ?? new Map<string, boolean>();
      tapsDuringSync.current = null;
      if (!ids || cancelled) return;
      // The account's list, with any taps made meanwhile on top (they're on
      // their way to the account too).
      const next = new Set(ids.map(current));
      for (const [id, nowSaved] of taps) {
        if (nowSaved) next.add(id);
        else next.delete(id);
      }
      apply(next);
    });
    return () => {
      cancelled = true;
      tapsDuringSync.current = null;
    };
  }, [auth.isLoaded, auth.isSignedIn, apply, kind]);

  const toggle = useCallback(
    (id: string): boolean => {
      const next = new Set(savedRef.current);
      const nowSaved = !next.has(id);
      if (nowSaved) next.add(id);
      else next.delete(id);
      apply(next);
      tapsDuringSync.current?.set(id, nowSaved);
      if (auth.isSignedIn) postSaved(kind, nowSaved ? { add: [id] } : { remove: [id] });
      return nowSaved;
    },
    [apply, auth.isSignedIn, kind],
  );

  return { saved, toggle, auth };
}
