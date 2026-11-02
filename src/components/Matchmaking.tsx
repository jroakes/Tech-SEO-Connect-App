import { useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { SignInButton } from "@clerk/astro/react";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "./meet/ProfileForm";
import { Avatar, PersonCard } from "./meet/PersonCard";
import { useAuthState } from "@/lib/auth-client";
import { logEvent } from "@/lib/analytics";
import { peopleByTopic, type Profile } from "@/lib/matching";

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "form"; profile: Profile | null; suggestedName: string }
  | { status: "ready"; me: Profile; others: Profile[] };

/** Meet: pick your topics, then see who else picked each one. */
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

function Matches({ me, others, onEdit, onLeave }: { me: Profile; others: Profile[]; onEdit: () => void; onLeave: () => void }) {
  const groups = useMemo(() => peopleByTopic(me, others), [me, others]);

  return (
    <div className="space-y-8">
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

      {groups.map((g) => (
        <section key={g.topic} aria-labelledby={`topic-${g.topic}`} data-testid={`section-topic-${g.topic}`}>
          <h2 id={`topic-${g.topic}`} className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-foreground">
            {g.label}
            <span className="text-sm font-normal text-muted-foreground">
              {g.people.length} {g.people.length === 1 ? "person" : "people"}
            </span>
          </h2>
          {g.people.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.people.map((p) => (
                <PersonCard key={p.userId} person={p} topic={g.topic} />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Nobody else yet. Check back as more attendees join.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
