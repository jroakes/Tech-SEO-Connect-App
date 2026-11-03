import { useEffect, useRef, useState } from "react";
import { Check, Loader2, QrCode, Search, Undo2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import TicketScanner from "./TicketScanner";
import type { Freshness, GuestResult, SearchResult, WalkInResult } from "@/lib/check-in";

// Why a guest might not belong in the room, shown next to their name.
const STATUS: Record<string, string> = {
  declined: "Declined in Luma",
  waitlist: "On the waitlist",
  pending_approval: "Waiting for approval",
  invited: "Invited, not registered",
};

// "Thu 9:02 AM", at the conference.
const time = (at: string | number) =>
  new Date(at).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" });

// "just now", "4 min ago", or a time once it's been an hour.
const ago = (at: number, now: number) => {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `at ${time(at)}`;
};

const LISTED = 5; // guests listed before "Show all"

// "General Admission × 3, Free": a registration can hold several tickets.
const ticketList = (tickets: string[]) =>
  [...new Set(tickets)].map((t) => {
    const n = tickets.filter((x) => x === t).length;
    return n > 1 ? `${t} × ${n}` : t;
  }).join(", ");

const inputClass =
  "min-h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring";

// `scanned`: the guest came from their ticket's QR code rather than a search.
type Shown = Pick<SearchResult, "match" | "options"> & { query: string; scanned?: boolean };
type WalkIn = { name: string; email: string; similar?: GuestResult[] };

/** Calls the desk's API. Every answer says whether the desk is in demo mode, which `onDemo` hears. */
async function post<T>(body: object, onDemo: (demo: boolean) => void): Promise<T> {
  const res = await fetch("/api/admin/check-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; demo?: boolean };
  if (typeof data.demo === "boolean") onDemo(data.demo);
  if (!res.ok) throw new Error(data.error ?? "That didn't work. Please try again.");
  return data;
}

/**
 * One guest: who they are, anything to watch for, and checking them in or
 * taking it back. `justCheckedIn` asks "Wrong person?" instead of "Undo".
 */
function GuestRow(props: { guest: GuestResult; justCheckedIn?: boolean; busy: boolean; disabled: boolean; onCheckIn: () => void; onUndo: () => void }) {
  const { guest, justCheckedIn, busy, disabled, onCheckIn, onUndo } = props;
  const note = STATUS[guest.status];
  return (
    <li
      className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${justCheckedIn ? "bg-primary/5" : ""}`}
      data-testid={`row-guest-${guest.id}`}
    >
      <div className="min-w-0">
        <div className="text-lg font-semibold text-foreground">{guest.name}</div>
        {guest.otherName && <div className="text-sm text-muted-foreground">Luma account: {guest.otherName}</div>}
        <div className="truncate text-sm text-muted-foreground">{[guest.email, ticketList(guest.tickets)].filter(Boolean).join(" · ")}</div>
        {guest.tickets.length > 1 && (
          <div className="mt-1 text-sm font-medium text-foreground">{guest.tickets.length} tickets: checking in covers everyone on this registration.</div>
        )}
        {note && <div className="mt-1 text-sm font-medium text-destructive">{note}</div>}
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
              <Button variant="outline" size="sm" className="min-h-10 gap-1.5" disabled={disabled} onClick={onUndo} data-testid={`button-undo-${guest.id}`}>
                <Undo2 className="h-3.5 w-3.5" />
                {justCheckedIn ? "Wrong person?" : "Undo check-in"}
              </Button>
            )}
          </>
        ) : (
          <Button className="min-h-10 gap-1.5 px-5" disabled={disabled} onClick={onCheckIn} data-testid={`button-check-in-${guest.id}`}>
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

/** The check-in desk: type a name or email or scan a ticket, check the guest in, or add a walk-in. */
export default function CheckIn({ demo: initialDemo, freshness: initialFreshness }: { demo: boolean; freshness: Freshness | null }) {
  // Demo mode, from the live switch: the same for every desk, so it's kept up
  // to date from every answer.
  const [demo, setDemo] = useState(initialDemo);
  const call = <T,>(body: object) => post<T>(body, setDemo);
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
  const [scanning, setScanning] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Ready for the next person, unless they've already started typing it. After
  // a scan the keyboard stays down, ready to scan the next ticket.
  const next = (guest: GuestResult, typed: string) => {
    setLastCheckIn(guest.id);
    setQuery((q) => (q.trim() === typed ? "" : q));
    if (!shown?.scanned) input.current?.focus();
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

  const toggleLive = async () => {
    const live = demo;
    const sure = confirm(
      live
        ? "Turn on live check-in for every desk? Check-ins will count for real, and walk-ins will be added to Luma, which emails them a ticket."
        : "Turn off live check-in for every desk? Check-ins and walk-ins will be saved in this app only.",
    );
    if (sure) await run("mode", () => call({ action: "set_live", live }));
  };

  const walkInFrom = (typed: string): WalkIn => (typed.includes("@") ? { name: "", email: typed } : { name: typed, email: "" });

  // Clear the last results at once, so they're never mistaken for the next.
  const clear = () => {
    setShown(null);
    setShowAll(false);
    setNotice(null);
    setWalkIn(null);
    setLastCheckIn(null);
  };

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    const typed = query.trim();
    // One thing at a time, so answers can't arrive out of order.
    if (!typed || busy) return;
    setScanning(false);
    clear();
    const result = await run("search", () => call<SearchResult>({ action: "search", query: typed }));
    if (!result) return;
    setFreshness({ syncedAt: result.syncedAt, guestCount: result.guestCount });
    setShown({ match: result.match, options: result.options, query: typed });
    // Nobody on the list: start a walk-in with what was typed.
    if (!result.match && !result.options.length) setWalkIn(walkInFrom(typed));
  };

  const startScan = () => {
    clear();
    setError(null);
    setScanning(true);
  };

  // The guest on the scanned ticket, shown to check in like a search's one match.
  const scanned = async (code: string) => {
    setScanning(false);
    const result = await run("scan", () => call<SearchResult>({ action: "scan", code }));
    if (!result?.match) return;
    setFreshness({ syncedAt: result.syncedAt, guestCount: result.guestCount });
    setShown({ match: result.match, options: [], query: "", scanned: true });
  };

  const checkIn = async (guest: GuestResult) => {
    const typed = query.trim();
    const data = await run(guest.id, () => call<{ guest: GuestResult }>({ action: "check_in", guestId: guest.id }));
    if (!data) return;
    if (walkIn?.similar?.some((g) => g.id === guest.id)) {
      // A walk-in turned out to be registered after all.
      setWalkIn(null);
      setShown({ query: data.guest.name, match: data.guest, options: [] });
    } else replace(data.guest);
    next(data.guest, typed);
  };

  const undo = async (guest: GuestResult) => {
    const data = await run(guest.id, () => call<{ guest: GuestResult | null }>({ action: "undo", guestId: guest.id }));
    if (!data) return;
    setLastCheckIn(null);
    // Just checked in as the search's one match: show who else it could have
    // been, with the search back in the box to correct.
    if (guest.id === lastCheckIn && shown?.match?.id === guest.id && !shown.scanned) {
      const typed = shown.query;
      setShown(null);
      setShowAll(false);
      setQuery(typed);
      input.current?.focus();
      const result = await run("search", () => call<SearchResult>({ action: "search", query: typed, single: false, exclude: guest.id }));
      if (result) setShown({ match: result.match, options: result.options, query: typed });
      if (result && !result.options.length) setWalkIn(walkInFrom(typed));
      return;
    }
    if (data.guest) replace(data.guest);
    else setShown((s) => s && { ...s, match: s.match?.id === guest.id ? null : s.match, options: s.options.filter((g) => g.id !== guest.id) });
  };

  const addWalkIn = async (e: React.FormEvent | null, newPerson = false) => {
    e?.preventDefault();
    if (!walkIn) return;
    const { name, email } = walkIn;
    const typed = query.trim();
    const data = await run("walk_in", () => call<WalkInResult>({ action: "walk_in", name, email, newPerson, live: !demo }));
    if (!data) return;
    setFreshness({ syncedAt: data.syncedAt, guestCount: data.guestCount });
    if ("similar" in data) return setWalkIn({ name, email, similar: data.similar });
    setWalkIn(null);
    setShown({ query: data.guest.name, match: data.guest, options: [] });
    setNotice(data.registered ? `${data.guest.email} is already registered, so that's who this is.` : null);
    if (!data.registered) next(data.guest, typed);
  };

  const row = (guest: GuestResult) => (
    <GuestRow
      key={guest.id}
      guest={guest}
      justCheckedIn={guest.id === lastCheckIn}
      busy={busy === guest.id}
      disabled={busy !== null}
      onCheckIn={() => checkIn(guest)}
      onUndo={() => undo(guest)}
    />
  );
  const nobody = shown && !shown.match && !shown.options.length;

  return (
    <div className="max-w-3xl">
      <div
        className={`mb-4 flex items-start justify-between gap-4 rounded-md border px-4 py-3 ${demo ? "border-border bg-muted/50" : "border-primary/50 bg-primary/5"}`}
        data-testid="panel-check-in-mode"
      >
        <p className="text-sm text-foreground" data-testid={demo ? "text-demo-mode" : "text-live-mode"}>
          {demo ? (
            <>
              <span className="font-semibold">Demo mode.</span> Check-ins and walk-ins are saved in this app only. Nothing is sent to Luma.
            </>
          ) : (
            <>
              <span className="font-semibold">Live check-in.</span> Check-ins count for real, and walk-ins are added to Luma, which emails them a ticket.
            </>
          )}
          <span className="mt-1 block text-xs text-muted-foreground">The switch is the same for every check-in desk.</span>
        </p>
        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
          Live
          <button
            type="button"
            role="switch"
            aria-checked={!demo}
            aria-label="Live check-in"
            disabled={busy !== null}
            onClick={toggleLive}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${demo ? "bg-input" : "bg-primary"}`}
            data-testid="switch-live-check-in"
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${demo ? "translate-x-1" : "translate-x-6"}`} />
          </button>
        </label>
      </div>

      <form onSubmit={find} className="flex gap-2" role="search">
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or email"
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
        <Button type="submit" className="min-h-12 shrink-0 gap-1.5 px-5" disabled={busy !== null || !query.trim()} data-testid="button-check-in-search">
          {busy === "search" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Find
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-12 shrink-0 gap-1.5 px-4"
          disabled={busy !== null || scanning}
          onClick={startScan}
          aria-label="Scan a ticket's QR code"
          data-testid="button-scan-ticket"
        >
          {busy === "scan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          Scan
        </Button>
      </form>
      {freshness && <FreshnessLine {...freshness} />}
      {scanning && <TicketScanner onScan={scanned} onCancel={() => setScanning(false)} />}

      {error && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3" aria-live="polite">
        {shown?.match && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground">{shown.scanned ? "Scanned ticket" : `For “${shown.query}”`}</h2>
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
              <Button variant="outline" className="min-h-11 gap-1.5" disabled={busy !== null} onClick={() => addWalkIn(null, true)} data-testid="button-add-walk-in-anyway">
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
                <Button type="submit" className="min-h-11 gap-1.5" disabled={busy !== null} data-testid="button-add-walk-in">
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
