import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin } from "lucide-react";
import { ScheduleCard } from "./ScheduleCard";
import { event } from "@/data/event";
import type { Session } from "@/lib/types";
import { useSavedSessions } from "@/lib/saved-sessions";
import { getScheduleDays } from "@/lib/sessions";
import { trackSessionSave } from "@/lib/analytics";

interface ScheduleViewProps {
  sessions: Session[];
}

export default function ScheduleView({ sessions }: ScheduleViewProps) {
  const { saved, toggle } = useSavedSessions();
  const days = getScheduleDays(sessions);

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
            Conference Schedule
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="text-sm" data-testid="text-venue">
              {event.venueName}, {event.city}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-date-range">
            {event.dateRange}
          </p>
        </div>

        <Tabs defaultValue={`day${days[0]?.day ?? 1}`} className="w-full">
          <TabsList className="flex w-full mb-8">
            {days.map((d) => (
              <TabsTrigger key={d.day} value={`day${d.day}`} className="flex-1" data-testid={`tab-day${d.day}`}>
                {d.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {days.map((d) => (
            <TabsContent key={d.day} value={`day${d.day}`} className="space-y-0">
              {sessions
                .filter((s) => s.day === d.day)
                .map((session) => (
                  <ScheduleCard key={session.id} session={session} saved={saved.has(session.id)} onToggle={handleToggle} />
                ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
