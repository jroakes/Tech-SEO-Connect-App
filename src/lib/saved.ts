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

// Whose account the device's list is a copy of, once it has synced. Until
// then the list holds saves made while signed out.
const accountKey = (kind: SavedKind) => `${STORAGE_KEYS[kind]}_account`;

function readAccount(kind: SavedKind): string | null {
  try {
    return localStorage.getItem(accountKey(kind));
  } catch {
    return null;
  }
}

function writeAccount(kind: SavedKind, userId: string | null) {
  try {
    if (userId) localStorage.setItem(accountKey(kind), userId);
    else localStorage.removeItem(accountKey(kind));
  } catch {
    // Storage unavailable; the list isn't kept anyway.
  }
}

// Taps made while signed in that the account doesn't have yet (id → saved),
// say because the phone was offline. They're sent again on the next sync.
const pendingKey = (kind: SavedKind) => `${STORAGE_KEYS[kind]}_pending`;

function readPending(kind: SavedKind): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(pendingKey(kind)) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writePending(kind: SavedKind, pending: Record<string, boolean>) {
  try {
    if (Object.keys(pending).length) localStorage.setItem(pendingKey(kind), JSON.stringify(pending));
    else localStorage.removeItem(pendingKey(kind));
  } catch {
    // Storage unavailable; the list isn't kept anyway.
  }
}

/** Drops the pending taps that were sent, unless they were tapped again since. */
function settlePending(kind: SavedKind, sent: Record<string, boolean>) {
  const pending = readPending(kind);
  for (const [id, saved] of Object.entries(sent)) if (pending[id] === saved) delete pending[id];
  writePending(kind, pending);
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
 * user's account. Signing in merges the saves made while signed out into the
 * account; after that the device keeps a copy of the account's list, which
 * isn't merged again (that would undo removals made on another device).
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
      if (wasSignedIn.current || readAccount(kind)) {
        apply(new Set());
        writeAccount(kind, null);
        writePending(kind, {});
      }
      wasSignedIn.current = false;
      return;
    }

    wasSignedIn.current = true;
    let cancelled = false;
    tapsDuringSync.current = new Map();
    // Only a list made while signed out is added, not a copy of an account's,
    // along with taps the account doesn't have yet.
    const pending = readPending(kind);
    const add = [...(readAccount(kind) ? [] : readLocal(kind)), ...Object.keys(pending).filter((id) => pending[id])];
    const remove = Object.keys(pending).filter((id) => !pending[id]);
    const userId = auth.userId;
    postSaved(kind, { add, remove }).then((ids) => {
      const taps = tapsDuringSync.current ?? new Map<string, boolean>();
      tapsDuringSync.current = null;
      if (!ids || cancelled) return;
      settlePending(kind, pending);
      // The account's list, with any taps made meanwhile on top (they're on
      // their way to the account too).
      const next = new Set(ids.map(current));
      for (const [id, nowSaved] of taps) {
        if (nowSaved) next.add(id);
        else next.delete(id);
      }
      apply(next);
      writeAccount(kind, userId);
    });
    return () => {
      cancelled = true;
      tapsDuringSync.current = null;
    };
  }, [auth.isLoaded, auth.isSignedIn, auth.userId, apply, kind]);

  const toggle = useCallback(
    (id: string): boolean => {
      const next = new Set(savedRef.current);
      const nowSaved = !next.has(id);
      if (nowSaved) next.add(id);
      else next.delete(id);
      apply(next);
      tapsDuringSync.current?.set(id, nowSaved);
      if (auth.isSignedIn) {
        writePending(kind, { ...readPending(kind), [id]: nowSaved });
        postSaved(kind, nowSaved ? { add: [id] } : { remove: [id] }).then((ids) => ids && settlePending(kind, { [id]: nowSaved }));
      }
      return nowSaved;
    },
    [apply, auth.isSignedIn, kind],
  );

  return { saved, toggle, auth };
}
