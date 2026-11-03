import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, UserMinus, Users } from "lucide-react";
import { SignInButton } from "@clerk/astro/react";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "./meet/ProfileForm";
import { Avatar, PersonRow } from "./meet/PersonRow";
import { TopicCircles, TopicCirclesKey } from "./meet/TopicCircles";
import { useAuthState } from "@/lib/auth-client";
import { logEvent, logToGa } from "@/lib/analytics";
import { peopleIn, type Profile, type TopicCount } from "@/lib/matching";
import { topicLabel } from "@/data/topics";

type State =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "signed-out" }
  | { status: "form"; profile: Profile | null; suggestedName: string; lockedTopics: string[] | null }
  | { status: "left"; suggestedName: string; lockedTopics: string[] }
  | { status: "ready"; me: Profile; others: Profile[]; counts: TopicCount[] };

/** Meet: pick your topics, then browse every topic and the people in it. */
export default function Matchmaking() {
  const auth = useAuthState();
  const [state, setState] = useState<State>({ status: "loading" });

  const loadMatches = async () => {
    const res = await fetch("/api/matches").catch(() => null);
    if (!res) return setState({ status: "offline" });
    if (res.ok) {
      const data = (await res.json()) as { me: Profile; others: Profile[]; counts: TopicCount[] };
      setState({ status: "ready", ...data });
    }
  };

  useEffect(() => {
    if (!auth.isLoaded) return;
    if (!auth.isSignedIn) {
      setState({ status: "signed-out" });
      return;
    }
    (async () => {
      const res = await fetch("/api/profile").catch(() => null);
      // Meet needs a connection; the rest of the app works offline.
      if (!res) return setState({ status: "offline" });
      if (!res.ok) return setState({ status: "signed-out" });
      const data = (await res.json()) as { profile: Profile | null; suggestedName: string; lockedTopics: string[] | null };
      if (data.profile) await loadMatches();
      // Topics kept without a profile: they joined once and left.
      else if (data.lockedTopics) setState({ status: "left", suggestedName: data.suggestedName, lockedTopics: data.lockedTopics });
      else setState({ status: "form", profile: null, suggestedName: data.suggestedName, lockedTopics: data.lockedTopics });
    })();
  }, [auth.isLoaded, auth.isSignedIn]);

  const leave = async () => {
    if (!confirm("Leave Meet? Your answers will be deleted and other attendees won't see you. If you join again, your topics stay the same.")) return;
    await fetch("/api/profile", { method: "DELETE" });
    // The server logs Meet's events; GA4 gets them from here.
    logToGa("match_leave");
    const me = state.status === "ready" ? state.me : null;
    setState({ status: "left", suggestedName: me?.name ?? "", lockedTopics: me?.topics ?? [] });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold text-foreground md:text-4xl" data-testid="text-page-title">
          Meet people
        </h1>
        <p className="text-muted-foreground">
          Pick the topics you're interested in and see who else is. Message them on LinkedIn to meet up at the conference.
        </p>
      </div>

      {state.status === "offline" && (
        <p className="rounded-md border border-border bg-card p-8 text-center text-foreground" data-testid="panel-meet-offline">
          Meet needs an internet connection. Try again when you're back online.
        </p>
      )}

      {state.status === "loading" && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {state.status === "signed-out" && (
        <div className="rounded-md border border-border bg-card p-8 text-center" data-testid="panel-meet-sign-in">
          <Users className="mx-auto mb-3 h-8 w-8 text-primary" />
          <p className="mx-auto mb-5 max-w-md text-foreground">Sign in to pick your topics and see who else at Tech SEO Connect is into them.</p>
          {auth.enabled && (
            <SignInButton mode="modal">
              <Button className="min-h-11 min-w-32">Sign in</Button>
            </SignInButton>
          )}
        </div>
      )}

      {state.status === "left" && (
        <div className="rounded-md border border-border bg-card p-8 text-center" data-testid="panel-meet-left">
          <UserMinus className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold text-foreground">You've left Meet.</p>
          <p className="mx-auto mb-5 mt-1 max-w-md text-muted-foreground">Your answers are deleted, and other attendees can't see you.</p>
          <Button
            className="min-h-11 min-w-32"
            onClick={() => setState({ status: "form", profile: null, suggestedName: state.suggestedName, lockedTopics: state.lockedTopics })}
            data-testid="button-rejoin-meet"
          >
            Rejoin
          </Button>
        </div>
      )}

      {state.status === "form" && (
        <ProfileForm
          initial={state.profile}
          suggestedName={state.suggestedName}
          lockedTopics={state.lockedTopics}
          onSaved={async (profile) => {
            logToGa(state.profile ? "match_update" : "match_join", { topics: profile.topics.join(","), topic_count: profile.topics.length, linkedin: !!profile.linkedin });
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
          counts={state.counts}
          onEdit={() => setState({ status: "form", profile: state.me, suggestedName: state.me.name, lockedTopics: state.me.topics })}
          onLeave={leave}
        />
      )}
    </div>
  );
}

// The open topic lives in the URL (/meet#bigquery), so Back returns to the
// circles. Only your own topics open.
const topicFromHash = (mine: string[]) => {
  const id = decodeURIComponent(location.hash.slice(1));
  return mine.includes(id) ? id : null;
};

interface MatchesProps {
  me: Profile;
  others: Profile[];
  counts: TopicCount[];
  onEdit: () => void;
  onLeave: () => void;
}

function Matches({ me, others, counts, onEdit, onLeave }: MatchesProps) {
  const everyone = useMemo(() => [me, ...others], [me, others]);
  const [topic, setTopic] = useState(() => topicFromHash(me.topics));
  const openedHere = useRef(false);

  useEffect(() => {
    // A link to someone else's topic just shows the circles.
    if (location.hash && !topicFromHash(me.topics)) history.replaceState(null, "", location.pathname);
    const onHashChange = () => {
      setTopic(topicFromHash(me.topics));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [me.topics]);

  const open = (id: string) => {
    logEvent("match_topic_open", { topic: id, people: counts.find((c) => c.topic === id)?.count ?? 0 });
    openedHere.current = true;
    location.hash = id;
  };
  const back = () => {
    if (openedHere.current) return history.back();
    history.replaceState(null, "", location.pathname);
    setTopic(null);
  };

  if (topic) {
    const people = peopleIn(topic, everyone);
    return (
      <section aria-labelledby="group-title" data-testid="panel-group">
        <button type="button" onClick={back} className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline" data-testid="button-all-topics">
          <ArrowLeft className="h-4 w-4" />
          All topics
        </button>
        <h2 id="group-title" className="text-2xl font-bold text-foreground">
          {topicLabel(topic)}
        </h2>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          {people.length > 1
            ? `${people.length} people, including you. Tap someone with a LinkedIn to message them and meet up.`
            : "Just you so far. Check back as more attendees join."}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <PersonRow key={p.userId} person={p} topic={topic} isMe={p.userId === me.userId} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar profile={me} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">{me.name}</div>
            {me.title && <div className="truncate text-sm text-muted-foreground">{me.title}</div>}
            {!me.linkedin && <div className="text-sm text-muted-foreground">Add your LinkedIn so people can message you.</div>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" className="min-h-11" onClick={onEdit} data-testid="button-edit-profile">
            Edit
          </Button>
          <Button variant="ghost" className="min-h-11 text-muted-foreground" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </section>

      <section aria-label="Topics" className="space-y-4">
        <TopicCircles topics={counts} mine={me.topics} onOpen={open} />
        <TopicCirclesKey />
      </section>
    </div>
  );
}
