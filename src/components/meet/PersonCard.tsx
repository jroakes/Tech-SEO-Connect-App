import { MessageCircle } from "lucide-react";
import { describeReason, type Profile, type Reason } from "@/lib/matching";

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

/** An attendee in matchmaking: who they are, why to meet, and how to find them. */
export function PersonCard({ person, reasons = [] }: { person: Profile; reasons?: Reason[] }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-md border border-border bg-card p-4" data-testid={`card-person-${person.userId}`}>
      <div className="flex items-center gap-3">
        <Avatar profile={person} />
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{person.name}</div>
          {person.role && <div className="truncate text-sm text-muted-foreground">{person.role}</div>}
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {reasons.slice(0, 3).map((r) => (
            <span key={`${r.kind}-${r.topic}`} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {describeReason(r)}
            </span>
          ))}
        </div>
      )}

      {person.workingOn && (
        <p className="line-clamp-3 text-sm leading-relaxed text-foreground">
          <span className="text-muted-foreground">Working on </span>
          {person.workingOn}
        </p>
      )}
      {person.canHelp && (
        <p className="line-clamp-2 text-sm leading-relaxed text-foreground">
          <span className="text-muted-foreground">Can help with </span>
          {person.canHelp}
        </p>
      )}

      {person.contact && (
        <div className="mt-auto flex items-start gap-2 border-t border-border pt-3 text-sm text-foreground">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="break-words">{person.contact}</span>
        </div>
      )}
    </div>
  );
}
