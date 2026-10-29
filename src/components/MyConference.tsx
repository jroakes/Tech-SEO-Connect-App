import { CalendarHeart, MapPinned } from "lucide-react";
import { SignInButton } from "@clerk/astro/react";
import { Button } from "@/components/ui/button";
import { ScheduleCard } from "./ScheduleCard";
import { LocationCard } from "./LocationCard";
import type { Place, Session } from "@/lib/types";
import { useSaved } from "@/lib/saved";
import { getScheduleDays } from "@/lib/sessions";
import { trackPlaceSave, trackSessionSave } from "@/lib/analytics";

interface MyConferenceProps {
  sessions: Session[];
  places: Place[];
}

// Saved places are grouped in this order; any other category comes after.
const CATEGORY_ORDER = ["Conference Main Locations", "Hotels", "Coffee", "Lunch", "Dinner", "Drinks", "Things to do"];

function EmptyState({ icon: Icon, text, links }: { icon: typeof CalendarHeart; text: string; links: { href: string; label: string }[] }) {
  return (
    <div className="rounded-md border border-dashed border-border px-4 py-8 text-center">
      <Icon className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
      <p className="mb-4 text-sm text-muted-foreground">{text}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {links.map((link) => (
          <Button key={link.href} asChild variant="outline" className="min-h-11">
            <a href={link.href}>{link.label}</a>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function MyConference({ sessions, places }: MyConferenceProps) {
  const talks = useSaved("session");
  const spots = useSaved("place");
  const auth = talks.auth;

  const myTalks = sessions.filter((s) => talks.saved.has(s.id));
  const myPlaces = places.filter((p) => spots.saved.has(p.id));
  const categories = [...new Set(myPlaces.map((p) => p.category))].sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99),
  );

  const toggleTalk = (session: Session) => {
    const nowSaved = talks.toggle(session.id);
    trackSessionSave(session, nowSaved);
    return nowSaved;
  };
  const togglePlace = (place: Place) => {
    const nowSaved = spots.toggle(place.id);
    trackPlaceSave(place, nowSaved);
    return nowSaved;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground md:text-4xl" data-testid="text-page-title">
            My Conference
          </h1>
          <p className="text-sm text-muted-foreground">The talks and places you've saved with the heart.</p>
        </div>

        {auth.enabled && auth.isLoaded && !auth.isSignedIn && (
          <div
            className="mb-8 flex flex-col gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            data-testid="panel-sign-in"
          >
            <p className="text-sm text-foreground">Sign in to keep your list on every device and in your AI assistant.</p>
            <SignInButton mode="modal">
              <Button className="min-h-11 shrink-0" data-testid="button-sign-in-my-conference">
                Sign in
              </Button>
            </SignInButton>
          </div>
        )}

        <section className="mb-10" data-testid="section-talks">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Talks</h2>
          {myTalks.length === 0 ? (
            <EmptyState icon={CalendarHeart} text="Tap the heart on a talk to save it here." links={[{ href: "/schedule", label: "Browse the schedule" }]} />
          ) : (
            getScheduleDays(sessions).map((d) => {
              const dayTalks = myTalks.filter((s) => s.day === d.day);
              if (!dayTalks.length) return null;
              return (
                <div key={d.day} className="mb-6" data-testid={`section-day${d.day}`}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{d.label}</h3>
                  {dayTalks.map((session) => (
                    <ScheduleCard key={session.id} session={session} saved onToggle={toggleTalk} />
                  ))}
                </div>
              );
            })
          )}
        </section>

        <section data-testid="section-places">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Places</h2>
          {myPlaces.length === 0 ? (
            <EmptyState
              icon={MapPinned}
              text="Save hotels, restaurants, bars and things to do with the heart."
              links={[
                { href: "/locations", label: "Browse places" },
                { href: "/map", label: "Open the map" },
              ]}
            />
          ) : (
            categories.map((category) => (
              <div key={category} className="mb-6">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {myPlaces
                    .filter((p) => p.category === category)
                    .map((place) => (
                      <LocationCard key={place.id} location={place} saved onToggleSave={() => togglePlace(place)} />
                    ))}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
