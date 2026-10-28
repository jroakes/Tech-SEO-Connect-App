import { Heart } from "lucide-react";
import { SignInButton } from "@clerk/astro/react";
import { Button } from "@/components/ui/button";
import { ScheduleCard } from "./ScheduleCard";
import type { Session } from "@/lib/types";
import { useSavedSessions } from "@/lib/saved-sessions";
import { getScheduleDays } from "@/lib/sessions";
import { trackSessionSave } from "@/lib/analytics";

interface MyScheduleProps {
  sessions: Session[];
}

export default function MySchedule({ sessions }: MyScheduleProps) {
  const { saved, toggle, auth } = useSavedSessions();
  const mine = sessions.filter((s) => saved.has(s.id));

  const handleToggle = (session: Session) => {
    const nowSaved = toggle(session.id);
    trackSessionSave(session, nowSaved);
    return nowSaved;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2" data-testid="text-page-title">
            My Schedule
          </h1>
          <p className="text-sm text-muted-foreground">The sessions you've saved with the heart on the schedule.</p>
        </div>

        {auth.enabled && auth.isLoaded && !auth.isSignedIn && (
          <div className="mb-6 flex flex-col gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="panel-sign-in">
            <p className="text-sm text-foreground">Sign in to keep your list on every device.</p>
            <SignInButton mode="modal">
              <Button className="min-h-11" data-testid="button-sign-in-my-schedule">
                Sign in
              </Button>
            </SignInButton>
          </div>
        )}

        {mine.length === 0 ? (
          <div className="text-center py-12" data-testid="text-empty">
            <Heart className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">You haven't saved any sessions yet.</p>
            <Button asChild variant="outline" className="min-h-11">
              <a href="/schedule">Browse the schedule</a>
            </Button>
          </div>
        ) : (
          getScheduleDays(sessions).map((d) => {
            const daySessions = mine.filter((s) => s.day === d.day);
            if (!daySessions.length) return null;
            return (
              <section key={d.day} className="mb-8" data-testid={`section-day${d.day}`}>
                <h2 className="text-lg font-semibold text-foreground mb-3">{d.label}</h2>
                {daySessions.map((session) => (
                  <ScheduleCard key={session.id} session={session} saved onToggle={handleToggle} />
                ))}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
