import { useState } from "react";
import { Clock, Heart } from "lucide-react";
import type { Session } from "@/lib/types";
import { formatDuration } from "@/lib/sessions";

interface ScheduleCardProps {
  session: Session;
  saved: boolean;
  onToggle: (session: Session) => boolean;
}

export function ScheduleCard({ session, saved, onToggle }: ScheduleCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSaveClick = () => {
    const nowSaved = onToggle(session);
    if (nowSaved) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  return (
    <div
      className={`flex items-start gap-4 p-4 border-l-4 transition-all ${
        session.isBreak ? "border-l-chart-4 bg-muted/30" : "border-l-primary bg-card"
      }`}
      data-testid={`schedule-session-${session.id}`}
    >
      <div className="flex-shrink-0 w-20">
        <div className={`text-sm font-semibold ${session.isBreak ? "text-chart-4" : "text-foreground"}`} data-testid="text-session-time">
          {session.time}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Clock className="h-3 w-3" />
          <span data-testid="text-session-duration">{formatDuration(session.duration)}</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className={`text-base font-semibold ${session.isBreak ? "text-chart-4" : "text-foreground"}`} data-testid="text-session-title">
          {session.title}
        </h3>
        {!session.isBreak && session.speaker && (
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-session-speaker">
            {session.speaker}
          </p>
        )}
        {session.description && (
          <p className="text-sm text-muted-foreground mt-1 font-serif leading-relaxed" data-testid="text-session-description">
            {session.description}
          </p>
        )}
      </div>

      {!session.isBreak && (
        <div className="relative flex-shrink-0">
          <button
            onClick={handleSaveClick}
            className="p-2 min-h-11 min-w-11 flex items-center justify-center rounded-md transition-all hover:bg-muted cursor-pointer"
            aria-pressed={saved}
            aria-label={saved ? `Remove ${session.title} from My Schedule` : `Save ${session.title} to My Schedule`}
            data-testid={`button-save-${session.id}`}
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                saved ? "fill-pink-500 text-pink-500" : "text-muted-foreground hover:text-pink-400"
              }`}
            />
          </button>

          {isAnimating && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Heart className="h-5 w-5 fill-pink-500 text-pink-500 animate-heart-rise" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
