import type { ScheduleSession } from "@shared/schema";
import { Clock } from "lucide-react";

interface ScheduleCardProps {
  session: ScheduleSession;
}

export function ScheduleCard({ session }: ScheduleCardProps) {
  return (
    <div
      className={`flex items-start gap-4 p-4 border-l-4 transition-all ${
        session.isBreak
          ? "border-l-chart-4 bg-muted/30"
          : "border-l-primary bg-card"
      }`}
      data-testid={`schedule-session-${session.time.replace(/\s+/g, '-')}`}
    >
      <div className="flex-shrink-0 w-20">
        <div className={`text-sm font-semibold ${session.isBreak ? "text-chart-4" : "text-foreground"}`} data-testid="text-session-time">
          {session.time}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Clock className="h-3 w-3" />
          <span data-testid="text-session-duration">{session.duration}m</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className={`text-base font-semibold ${session.isBreak ? "text-chart-4" : "text-foreground"}`} data-testid="text-session-title">
          {session.title}
        </h3>
        {!session.isBreak && (
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-session-description">
            30-minute session
          </p>
        )}
      </div>
    </div>
  );
}
