import { Linkedin } from "lucide-react";
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

/** One person in a topic's list. Tapping someone with a LinkedIn opens it, to message them. */
export function PersonRow({ person, topic, isMe }: { person: Profile; topic: string; isMe: boolean }) {
  const body = (
    <>
      <Avatar profile={person} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{person.name}</span>
          {isMe && <span className="shrink-0 rounded bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">You</span>}
        </div>
        {person.title && <div className="truncate text-xs text-muted-foreground">{person.title}</div>}
      </div>
      {person.linkedin && <Linkedin className="h-[18px] w-[18px] shrink-0 text-[#0A66C2]" aria-hidden="true" />}
    </>
  );
  const className = "flex min-h-14 items-center gap-3 rounded-md border border-border bg-card px-3 py-2";
  return person.linkedin ? (
    <a
      href={person.linkedin}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => logEvent("match_linkedin_click", { topic })}
      className={`${className} transition-colors hover:border-primary/60 hover:bg-primary/5`}
      aria-label={`${person.name}${person.title ? `, ${person.title}` : ""}. Message on LinkedIn`}
      data-testid={`row-person-${person.userId}`}
    >
      {body}
    </a>
  ) : (
    <div className={className} data-testid={`row-person-${person.userId}`}>
      {body}
    </div>
  );
}
