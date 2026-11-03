import { Clock } from "lucide-react";
import { FavoriteButton } from "./FavoriteButton";
import type { Session } from "@/lib/types";
import { formatDuration } from "@/lib/sessions";

const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/;

/** A description from the main site: one paragraph per line, with [text](url) links. */
function Description({ text }: { text: string }) {
  return text.split("\n").map((line, i) => (
    <span key={i} className="block">
      {line.split(new RegExp(`(${LINK.source})`)).map((part, j) => {
        const link = part.match(new RegExp(`^${LINK.source}$`));
        if (link) {
          return (
            <a key={j} href={link[2]} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2">
              {link[1]}
            </a>
          );
        }
        // The pieces split() captures inside a link (its text and URL) are skipped.
        return j % 4 === 0 ? part : null;
      })}
    </span>
  ));
}

interface ScheduleCardProps {
  session: Session;
  saved: boolean;
  onToggle: (session: Session) => boolean;
}

export function ScheduleCard({ session, saved, onToggle }: ScheduleCardProps) {
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
            <Description text={session.description} />
          </p>
        )}
      </div>

      {!session.isBreak && (
        <FavoriteButton saved={saved} onToggle={() => onToggle(session)} label={session.title} testId={`button-save-${session.id}`} />
      )}
    </div>
  );
}
