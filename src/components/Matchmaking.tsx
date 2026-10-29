import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Sparkles, Users } from "lucide-react";
import { SignInButton } from "@clerk/astro/react";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "./meet/ProfileForm";
import { Avatar, PersonCard } from "./meet/PersonCard";
import { useAuthState } from "@/lib/auth-client";
import { logEvent } from "@/lib/analytics";
import { rankMatches, reasonsToMeet, search, topicGroups, type Group, type Profile } from "@/lib/matching";
import { topicLabel } from "@/data/topics";

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "form"; profile: Profile | null; suggestedName: string }
  | { status: "ready"; me: Profile; others: Profile[] };

const FLIGHT_MS = 750;

/** Matchmaking: join with a few answers, then find the attendees to meet. */
export default function Matchmaking() {
  const auth = useAuthState();
  const [state, setState] = useState<State>({ status: "loading" });

  const loadMatches = async () => {
    const res = await fetch("/api/matches");
    if (res.ok) {
      const data = (await res.json()) as { me: Profile; others: Profile[] };
      setState({ status: "ready", me: data.me, others: data.others });
    }
  };

  useEffect(() => {
    if (!auth.isLoaded) return;
    if (!auth.isSignedIn) {
      setState({ status: "signed-out" });
      return;
    }
    (async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) return setState({ status: "signed-out" });
      const data = (await res.json()) as { profile: Profile | null; suggestedName: string };
      if (data.profile) await loadMatches();
      else setState({ status: "form", profile: null, suggestedName: data.suggestedName });
    })();
  }, [auth.isLoaded, auth.isSignedIn]);

  const leave = async () => {
    if (!confirm("Leave matchmaking? Your answers will be deleted and other attendees won't see you.")) return;
    await fetch("/api/profile", { method: "DELETE" });
    setState({ status: "form", profile: null, suggestedName: state.status === "ready" ? state.me.name : "" });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold text-foreground md:text-4xl" data-testid="text-page-title">
          Meet people
        </h1>
        <p className="text-muted-foreground">
          Tell us what you're working on and what you want to learn. We'll point you to the attendees who can help, and the ones figuring out the same things.
        </p>
      </div>

      {state.status === "loading" && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {state.status === "signed-out" && (
        <div className="rounded-md border border-border bg-card p-8 text-center" data-testid="panel-meet-sign-in">
          <Users className="mx-auto mb-3 h-8 w-8 text-primary" />
          <p className="mx-auto mb-5 max-w-md text-foreground">Sign in to answer a few questions and see who you should meet at Tech SEO Connect.</p>
          {auth.enabled && (
            <SignInButton mode="modal">
              <Button className="min-h-11 min-w-32">Sign in</Button>
            </SignInButton>
          )}
        </div>
      )}

      {state.status === "form" && (
        <ProfileForm
          initial={state.profile}
          suggestedName={state.suggestedName}
          onSaved={async () => {
            if (!state.profile) logEvent("match_join");
            await loadMatches();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onCancel={state.profile ? () => loadMatches() : undefined}
        />
      )}

      {state.status === "ready" && (
        <Matches
          me={state.me}
          others={state.others}
          onEdit={() => setState({ status: "form", profile: state.me, suggestedName: state.me.name })}
          onLeave={leave}
        />
      )}
    </div>
  );
}

function Matches({ me, others, onEdit, onLeave }: { me: Profile; others: Profile[]; onEdit: () => void; onLeave: () => void }) {
  const groups = useMemo(() => topicGroups([me, ...others]), [me, others]);
  const best = useMemo(() => rankMatches(me, others), [me, others]);
  const mine = new Set([...me.learnTopics, ...me.helpTopics]);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ topic: string | null; query: string; people: Profile[] } | null>(null);
  const [flight, setFlight] = useState<{ from: DOMRect; to: DOMRect; moving: boolean } | null>(null);
  const [landing, setLanding] = useState<string | null>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef(new Map<string, HTMLButtonElement>());
  const resultsRef = useRef<HTMLDivElement>(null);
  // Phones get smaller bubbles so three fit in a row.
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Opens a group, after sending your bubble flying into it.
  const open = (result: { topic: string | null; query: string; people: Profile[] }) => {
    const target = result.topic ? bubbleRefs.current.get(result.topic) : null;
    const from = youRef.current?.getBoundingClientRect();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = () => {
      setSelected(result);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" }), 50);
    };
    if (!target || !from || reduceMotion) return show();
    setFlight({ from, to: target.getBoundingClientRect(), moving: false });
    requestAnimationFrame(() => requestAnimationFrame(() => setFlight((f) => f && { ...f, moving: true })));
    setTimeout(() => {
      setFlight(null);
      setLanding(result.topic);
      setTimeout(() => setLanding(null), 600);
      show();
    }, FLIGHT_MS);
  };

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const found = search(q, others);
    logEvent("match_search", { query: q.slice(0, 100), ...(found.topic ? { topic: found.topic } : {}) });
    open({ ...found, query: q });
  };

  const openTopic = (group: Group) => {
    setQuery(group.label);
    open({ topic: group.topic, query: group.label, people: others.filter((p) => p.learnTopics.includes(group.topic) || p.helpTopics.includes(group.topic)) });
  };

  const selectedHelpers = selected?.topic ? selected.people.filter((p) => p.helpTopics.includes(selected.topic!)) : [];
  const selectedLearners = selected?.topic ? selected.people.filter((p) => !p.helpTopics.includes(selected.topic!)) : selected?.people ?? [];

  return (
    <div className="space-y-10">
      <section className="rounded-md border border-border bg-card p-4 sm:p-6" aria-labelledby="find-title">
        <h2 id="find-title" className="mb-3 text-lg font-semibold text-foreground">
          What are you trying to figure out?
        </h2>
        <form onSubmit={runSearch} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <div ref={youRef} className="absolute left-2 top-1/2 -translate-y-1/2" aria-hidden="true">
              <Avatar profile={me} size={28} />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="BigQuery, log files, a site migration…"
              className="min-h-11 w-full rounded-md border border-input bg-background pl-12 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="What are you trying to figure out?"
              data-testid="input-match-search"
            />
          </div>
          <Button type="submit" className="min-h-11 shrink-0 gap-1.5" data-testid="button-match-search">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Find people</span>
          </Button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3" aria-label="Topics people are here for">
          {groups.map((g) => {
            const size = narrow ? Math.min(92, 82 + 5 * Math.sqrt(g.size)) : Math.min(140, 76 + 16 * Math.sqrt(g.size));
            const active = selected?.topic === g.topic;
            return (
              <button
                key={g.topic}
                ref={(el) => {
                  if (el) bubbleRefs.current.set(g.topic, el);
                }}
                type="button"
                onClick={() => openTopic(g)}
                className={`relative flex flex-col items-center justify-center rounded-full border px-1 text-center sm:px-2 leading-tight transition-all duration-300 ${
                  active
                    ? "border-transparent text-white shadow-lg"
                    : `${mine.has(g.topic) ? "border-2 border-primary/70" : "border-primary/25"} bg-primary/10 text-foreground hover:border-primary/60 hover:bg-primary/15`
                } ${landing === g.topic ? "scale-110" : ""}`}
                style={{ width: size, height: size, ...(active ? { background: "#0A8F64" } : {}) }}
                aria-pressed={active}
                data-testid={`bubble-${g.topic}`}
              >
                <span className="text-[11px] font-semibold sm:text-xs">{g.label.replace(/-/g, "\u2011")}</span>
                <span className={`mt-0.5 text-[11px] ${active ? "text-white/80" : "text-muted-foreground"}`}>
                  {g.size} {g.size === 1 ? "person" : "people"}
                </span>
                {landing === g.topic && <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/60" />}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">Bold outlines mark your topics. Tap a topic or search to find its people.</p>

        <div ref={resultsRef}>
          {selected && (
            <div className="mt-6 border-t border-border pt-6" data-testid="panel-group">
              <h3 className="mb-1 text-base font-semibold text-foreground">{selected.topic ? topicLabel(selected.topic) : `People who mention “${selected.query}”`}</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {selected.people.length
                  ? `${selected.people.length} ${selected.people.length === 1 ? "person" : "people"} here for this.`
                  : "Nobody yet. Check back as more attendees join."}
              </p>
              {selectedHelpers.length > 0 && (
                <>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Can help</h4>
                  <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedHelpers.map((p) => (
                      <PersonCard key={p.userId} person={p} reasons={reasonsToMeet(me, p)} />
                    ))}
                  </div>
                </>
              )}
              {selectedLearners.length > 0 && (
                <>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selected.topic ? "Also learning" : "People"}</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedLearners.map((p) => (
                      <PersonCard key={p.userId} person={p} reasons={reasonsToMeet(me, p)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="best-title">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 id="best-title" className="text-xl font-semibold text-foreground">
            Your best matches
          </h2>
        </div>
        {best.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {best.map((m) => (
              <PersonCard key={m.person.userId} person={m.person} reasons={m.reasons} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            You're one of the first here. As more attendees join, your matches will show up here.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar profile={me} />
          <div>
            <div className="font-semibold text-foreground">{me.name}</div>
            <div className="text-sm text-muted-foreground">
              Learning {me.learnTopics.map(topicLabel).join(", ") || "nothing yet"} · Helping with {me.helpTopics.map(topicLabel).join(", ") || "nothing yet"}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" className="min-h-11" onClick={onEdit} data-testid="button-edit-profile">
            Edit my answers
          </Button>
          <Button variant="ghost" className="min-h-11 text-muted-foreground" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </section>

      {flight && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: flight.from.left,
            top: flight.from.top,
            transition: `transform ${FLIGHT_MS}ms cubic-bezier(0.45, 0, 0.2, 1)`,
            transform: flight.moving
              ? `translate(${flight.to.left + flight.to.width / 2 - flight.from.left - flight.from.width / 2}px, ${flight.to.top + flight.to.height / 2 - flight.from.top - flight.from.height / 2}px) scale(1.4)`
              : "translate(0, 0) scale(1)",
          }}
          aria-hidden="true"
        >
          <div className="rounded-full shadow-lg ring-2 ring-white">
            <Avatar profile={me} size={28} />
          </div>
        </div>
      )}
    </div>
  );
}
