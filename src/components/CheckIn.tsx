import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Search, Undo2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Freshness, GuestResult, SearchResult, WalkInResult } from "@/lib/check-in";

// Why a guest might not belong in the room, shown next to their name.
const STATUS: Record<string, string> = {
  declined: "Declined in Luma",
  waitlist: "On the waitlist",
  pending_approval: "Waiting for approval",
  invited: "Invited, not registered",
};

const time = (at: string) =>
  new Date(at).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" });

const LISTED = 5; // guests listed before "Show all"

// "just now", "4 min ago", or a time once it's been an hour.
const ago = (at: number, now: number) => {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `at ${new Date(at).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" })}`;
};

const inputClass =
  "min-h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring";

type Shown = Pick<SearchResult, "match" | "options"> & { query: string };
type WalkIn = { name: string; email: string; similar?: GuestResult[] };

async function post<T>(body: object): Promise<T> {
  const res = await fetch("/api/admin/check-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "That didn't work. Please try again.");
  return data;
}

/**
 * One guest: who they are, anything to watch for, and checking them in or
 * taking it back. `justCheckedIn` asks "Wrong person?" instead of "Undo".
 */
function GuestRow(props: { guest: GuestResult; justCheckedIn?: boolean; busy: boolean; onCheckIn: () => void; onUndo: () => void }) {
  const { guest, justCheckedIn, busy, onCheckIn, onUndo } = props;
  const notes = [STATUS[guest.status], guest.livestreamOnly && "Livestream ticket only"].filter(Boolean) as string[];
  return (
    <li
      className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${justCheckedIn ? "bg-primary/5" : ""}`}
      data-testid={`row-guest-${guest.id}`}
    >
      <div className="min-w-0">
        <div className="text-lg font-semibold text-foreground">{guest.name}</div>
        <div className="truncate text-sm text-muted-foreground">{[guest.email, guest.tickets.join(", ")].filter(Boolean).join(" · ")}</div>
        {notes.length > 0 && <div className="mt-1 text-sm font-medium text-destructive">{notes.join(" · ")}</div>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : guest.checkedInAt ? (
          <>
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">
              <Check className="h-4 w-4" />
              Checked in {time(guest.checkedInAt)}
              {!guest.checkedInHere && " in Luma"}
            </span>
            {guest.checkedInHere && (
              <Button variant="outline" size="sm" className="min-h-10 gap-1.5" onClick={onUndo} data-testid={`button-undo-${guest.id}`}>
                <Undo2 className="h-3.5 w-3.5" />
                {justCheckedIn ? "Wrong person?" : "Undo check-in"}
              </Button>
            )}
          </>
        ) : (
          <Button className="min-h-10 gap-1.5 px-5" onClick={onCheckIn} data-testid={`button-check-in-${guest.id}`}>
            <Check className="h-4 w-4" />
            Check in
          </Button>
        )}
      </div>
    </li>
  );
}

/** When the guest list last came from Luma, kept current as the minutes pass. */
function FreshnessLine({ syncedAt, guestCount }: Freshness) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="mt-2 text-xs text-muted-foreground" data-testid="text-guest-list-freshness">
      Guest list from Luma: {guestCount.toLocaleString("en-US")} guests, updated {ago(syncedAt, now)}
    </p>
  );
}

/** The check-in desk: type a name or email, check the guest in, or add a walk-in. */
export default function CheckIn({ demo, freshness: initialFreshness }: { demo: boolean; freshness: Freshness | null }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState<Shown | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [freshness, setFreshness] = useState(initialFreshness);
  // Who was checked in last, so a mistake is one tap to fix.
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState<WalkIn | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Ready for the next person.
  const next = (guest: GuestResult) => {
    setLastCheckIn(guest.id);
    setQuery("");
    input.current?.focus();
  };

  const replace = (guest: GuestResult) =>
    setShown((s) => s && { ...s, match: s.match?.id === guest.id ? guest : s.match, options: s.options.map((g) => (g.id === guest.id ? guest : g)) });

  const run = async <T,>(key: string, work: () => Promise<T>): Promise<T | null> => {
    setBusy(key);
    setError(null);
    try {
      return await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const walkInFrom = (typed: string): WalkIn => (typed.includes("@") ? { name: "", email: typed } : { name: typed, email: "" });

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    const typed = query.trim();
    if (!typed) return;
    // Clear the last results at once, so they're never mistaken for these.
    setShown(null);
    setShowAll(false);
    setNotice(null);
    setWalkIn(null);
    setLastCheckIn(null);
    const result = await run("search", () => post<SearchResult>({ action: "search", query: typed }));
    if (!result) return;
    setFreshness({ syncedAt: result.syncedAt, guestCount: result.guestCount });
    setShown({ match: result.match, options: result.options, query: typed });
    // Nobody on the list: start a walk-in with what was typed.
    if (!result.match && !result.options.length) setWalkIn(walkInFrom(typed));
  };

  const checkIn = async (guest: GuestResult) => {
    const data = await run(guest.id, () => post<{ guest: GuestResult }>({ action: "check_in", guestId: guest.id }));
    if (!data) return;
    if (walkIn?.similar?.some((g) => g.id === guest.id)) {
      // A walk-in turned out to be registered after all.
      setWalkIn(null);
      setShown({ query: data.guest.name, match: data.guest, options: [] });
    } else replace(data.guest);
    next(data.guest);
  };

  const undo = async (guest: GuestResult) => {
    const data = await run(guest.id, () => post<{ guest: GuestResult | null }>({ action: "undo", guestId: guest.id }));
    if (!data) return;
    setLastCheckIn(null);
    // Just checked in as the search's one match: show who else it could have
    // been, with the search back in the box to correct.
    if (guest.id === lastCheckIn && shown?.match?.id === guest.id) {
      const query = shown.query;
      setQuery(query);
      input.current?.focus();
      setShowAll(false);
      const result = await run("search", () => post<SearchResult>({ action: "search", query, single: false }));
      if (result) setShown({ match: result.match, options: result.options, query });
      if (result && !result.options.length) setWalkIn(walkInFrom(query));
      return;
    }
    if (data.guest) replace(data.guest);
    else setShown((s) => s && { ...s, match: s.match?.id === guest.id ? null : s.match, options: s.options.filter((g) => g.id !== guest.id) });
  };

  const addWalkIn = async (e: React.FormEvent | null, newPerson = false) => {
    e?.preventDefault();
    if (!walkIn) return;
    const { name, email } = walkIn;
    const data = await run("walk_in", () => post<WalkInResult>({ action: "walk_in", name, email, newPerson }));
    if (!data) return;
    setFreshness({ syncedAt: data.syncedAt, guestCount: data.guestCount });
    if ("similar" in data) return setWalkIn({ name, email, similar: data.similar });
    setWalkIn(null);
    setShown({ query: data.guest.name, match: data.guest, options: [] });
    setNotice(data.registered ? `${data.guest.email} is already registered, so that's who this is.` : null);
    if (!data.registered) next(data.guest);
  };

  const row = (guest: GuestResult) => (
    <GuestRow
      key={guest.id}
      guest={guest}
      justCheckedIn={guest.id === lastCheckIn}
      busy={busy === guest.id}
      onCheckIn={() => checkIn(guest)}
      onUndo={() => undo(guest)}
    />
  );
  const nobody = shown && !shown.match && !shown.options.length;

  return (
    <div className="max-w-3xl">
      {demo && (
        <p className="mb-4 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-foreground" data-testid="text-demo-mode">
          <span className="font-semibold">Demo mode.</span> Check-ins and walk-ins are saved in this app only. Nothing is sent to Luma.
        </p>
      )}

      <form onSubmit={find} className="flex gap-2" role="search">
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, last name or email"
          aria-label="Guest's name or email"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          className={inputClass}
          data-testid="input-check-in-search"
        />
        <Button type="submit" className="min-h-12 shrink-0 gap-1.5 px-5" disabled={busy === "search" || !query.trim()} data-testid="button-check-in-search">
          {busy === "search" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Find
        </Button>
      </form>
      {freshness && <FreshnessLine {...freshness} />}

      {error && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3" aria-live="polite">
        {shown?.match && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground">For “{shown.query}”</h2>
            {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
            <ul className="overflow-hidden rounded-md border border-border bg-card">{row(shown.match)}</ul>
          </>
        )}

        {shown && shown.options.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground">Who did you mean by “{shown.query}”?</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card" data-testid="list-guest-options">
              {(showAll ? shown.options : shown.options.slice(0, LISTED)).map(row)}
            </ul>
            {!showAll && shown.options.length > LISTED && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Button variant="outline" className="min-h-11" onClick={() => setShowAll(true)} data-testid="button-show-all-guests">
                  Show all {shown.options.length}
                </Button>
                <span className="text-sm text-muted-foreground">or type more of their name to narrow it down.</span>
              </div>
            )}
          </>
        )}

        {nobody && !walkIn?.similar && <p className="text-sm text-foreground">Nobody on the guest list matches “{shown.query}”.</p>}

        {shown && !shown.match && !walkIn && (
          <button
            type="button"
            onClick={() => setWalkIn(walkInFrom(shown.query))}
            className="text-sm font-medium text-primary hover:underline"
            data-testid="button-show-walk-in"
          >
            Not on the list? Add a walk-in
          </button>
        )}

        {walkIn?.similar ? (
          // Luma's latest list has someone with a similar name: check before adding a second ticket.
          <div className="space-y-3 rounded-md border border-border bg-card p-4" data-testid="panel-walk-in-similar">
            <div>
              <h2 className="font-semibold text-foreground">Already registered?</h2>
              <p className="text-sm text-muted-foreground">
                These guests have a name like “{walkIn.name}”. If it's one of them, check them in instead.
              </p>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">{walkIn.similar.map(row)}</ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-11 gap-1.5" disabled={busy === "walk_in"} onClick={() => addWalkIn(null, true)} data-testid="button-add-walk-in-anyway">
                {busy === "walk_in" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                No, add {walkIn.name} as a walk-in
              </Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setWalkIn(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          walkIn && (
            <form onSubmit={addWalkIn} className="space-y-3 rounded-md border border-border bg-card p-4" data-testid="form-walk-in">
              <div>
                <h2 className="font-semibold text-foreground">Add a walk-in</h2>
                <p className="text-sm text-muted-foreground">
                  {demo ? "They get a temporary ticket in this app and are checked in." : "Luma adds them as going and emails them a ticket, and they're checked in."}{" "}
                  First we check Luma's latest list, in case they've just registered.
                </p>
              </div>
              <input
                value={walkIn.name}
                onChange={(e) => setWalkIn({ ...walkIn, name: e.target.value })}
                placeholder="Full name"
                aria-label="Walk-in's full name"
                required
                autoComplete="off"
                className={inputClass}
                data-testid="input-walk-in-name"
              />
              <input
                type="email"
                value={walkIn.email}
                onChange={(e) => setWalkIn({ ...walkIn, email: e.target.value })}
                placeholder="Email"
                aria-label="Walk-in's email"
                required
                autoComplete="off"
                autoCapitalize="none"
                className={inputClass}
                data-testid="input-walk-in-email"
              />
              <div className="flex gap-2">
                <Button type="submit" className="min-h-11 gap-1.5" disabled={busy === "walk_in"} data-testid="button-add-walk-in">
                  {busy === "walk_in" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {busy === "walk_in" ? "Checking Luma…" : "Add and check in"}
                </Button>
                <Button type="button" variant="ghost" className="min-h-11" onClick={() => setWalkIn(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          )
        )}
      </div>
    </div>
  );
}
