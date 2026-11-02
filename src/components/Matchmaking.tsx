import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { SignInButton } from "@clerk/astro/react";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "./meet/ProfileForm";
import { Avatar, PersonRow } from "./meet/PersonRow";
import { TopicCircles, TopicCirclesKey } from "./meet/TopicCircles";
import { useAuthState } from "@/lib/auth-client";
import { logEvent } from "@/lib/analytics";
import { peopleIn, topicCounts, type Profile } from "@/lib/matching";
import { TOPICS, topicLabel } from "@/data/topics";

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "form"; profile: Profile | null; suggestedName: string }
  | { status: "ready"; me: Profile; others: Profile[] };

/** Meet: pick your topics, then browse every topic and the people in it. */
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
    if (!confirm("Leave Meet? Your answers will be deleted and other attendees won't see you.")) return;
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
          Pick the topics you're interested in and see who else is. Message them on LinkedIn to meet up at the conference.
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
          <p className="mx-auto mb-5 max-w-md text-foreground">Sign in to pick your topics and see who else at Tech SEO Connect is into them.</p>
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
          onSaved={async (profile) => {
            if (!state.profile) logEvent("match_join", { topics: profile.topics.length, linkedin: !!profile.linkedin });
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

// The open topic lives in the URL (/meet#bigquery), so Back returns to the circles.
const topicFromHash = () => {
  const id = decodeURIComponent(location.hash.slice(1));
  return TOPICS.some((t) => t.id === id) ? id : null;
};

function Matches({ me, others, onEdit, onLeave }: { me: Profile; others: Profile[]; onEdit: () => void; onLeave: () => void }) {
  const everyone = useMemo(() => [me, ...others], [me, others]);
  const counts = useMemo(() => topicCounts(everyone), [everyone]);
  const [topic, setTopic] = useState(topicFromHash);
  const openedHere = useRef(false);

  useEffect(() => {
    const onHashChange = () => {
      setTopic(topicFromHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const open = (id: string) => {
    logEvent("match_topic_open", { topic: id, people: counts.find((c) => c.topic === id)?.count ?? 0, mine: me.topics.includes(id) });
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
          {people.length} {people.length === 1 ? "person" : "people"}
          {me.topics.includes(topic) ? ", including you" : ""}. Tap someone with a LinkedIn to message them and meet up.
        </p>
        {people.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((p) => (
              <PersonRow key={p.userId} person={p} topic={topic} isMe={p.userId === me.userId} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nobody has picked this yet. Check back as more attendees join.
          </p>
        )}
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
            Edit my answers
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
