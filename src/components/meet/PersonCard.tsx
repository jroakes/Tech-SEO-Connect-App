import { ExternalLink } from "lucide-react";
import { logEvent } from "@/lib/analytics";
import type { Profile } from "@/lib/matching";

export function Avatar({ profile, size = 40 }: { profile: Pick<Profile, "name" | "imageUrl">; size?: number }) {
  const initials = profile.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return profile.imageUrl ? (
    <img src={profile.imageUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials || "?"}
    </div>
  );
}

/** An attendee under one of your topics. Tapping someone with a LinkedIn opens it, to message them. */
export function PersonCard({ person, topic }: { person: Profile; topic: string }) {
  const body = (
    <>
      <Avatar profile={person} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-foreground">{person.name}</div>
        {person.title && <div className="truncate text-sm text-muted-foreground">{person.title}</div>}
        {person.linkedin && (
          <div className="mt-1 flex items-center gap-1 text-sm font-medium text-primary">
            Message on LinkedIn
            <ExternalLink className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
    </>
  );
  const className = "flex items-center gap-3 rounded-md border border-border bg-card p-4";
  return person.linkedin ? (
    <a
      href={person.linkedin}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => logEvent("match_linkedin_click", { topic })}
      className={`${className} transition-colors hover:border-primary/60`}
      aria-label={`${person.name} on LinkedIn`}
      data-testid={`card-person-${person.userId}`}
    >
      {body}
    </a>
  ) : (
    <div className={className} data-testid={`card-person-${person.userId}`}>
      {body}
    </div>
  );
}
