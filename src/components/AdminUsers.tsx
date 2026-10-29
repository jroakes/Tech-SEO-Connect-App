import { useState } from "react";
import { Ban, Loader2, ShieldCheck, ShieldOff, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "./meet/PersonCard";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string | null;
  imageUrl: string;
  /** Dates are formatted on the server, so the page hydrates without a mismatch. */
  joined: string;
  lastActive: string;
  banned: boolean;
  admin: boolean;
  organizer: boolean;
  self: boolean;
  talks: number;
  places: number;
  inMatchmaking: boolean;
}

type Action = "make_admin" | "remove_admin" | "block" | "unblock" | "delete";

// What each action's confirmation says. Unblocking needs no confirmation.
const CONFIRM: Record<Exclude<Action, "unblock">, { title: string; body: (name: string) => string; button: string; destructive?: boolean }> = {
  make_admin: {
    title: "Make admin?",
    body: (name) => `${name} will be able to see the analytics and manage users, including making other admins.`,
    button: "Make admin",
  },
  remove_admin: { title: "Remove admin?", body: (name) => `${name} will no longer be able to open the admin pages.`, button: "Remove admin" },
  block: {
    title: "Block this user?",
    body: (name) => `${name} will be signed out everywhere and won't be able to sign in. Their saved talks and places stay, and you can unblock them later.`,
    button: "Block",
    destructive: true,
  },
  delete: {
    title: "Delete this user?",
    body: (name) =>
      `${name}'s account, saved talks and places, and matchmaking answers will be deleted. This can't be undone. They could still sign up again with the same email.`,
    button: "Delete user",
    destructive: true,
  },
};

/** The admin users list, with actions for each user. */
export default function AdminUsers({ users: initial }: { users: AdminUserRow[] }) {
  const [users, setUsers] = useState(initial);
  const [pending, setPending] = useState<{ user: AdminUserRow; action: Action } | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const run = async (user: AdminUserRow, action: Action) => {
    setPending(null);
    setWorking(user.id);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, action }) });
      const data = (await res.json()) as { error?: string; deleted?: boolean; user?: { admin: boolean; banned: boolean } };
      if (!res.ok) throw new Error(data.error ?? "That didn't work. Please try again.");
      if (data.deleted) setUsers((list) => list.filter((u) => u.id !== user.id));
      else if (data.user) setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, ...data.user } : u)));
      const done: Record<Action, string> = {
        make_admin: "is now an admin",
        remove_admin: "is no longer an admin",
        block: "is blocked",
        unblock: "is unblocked",
        delete: "was deleted",
      };
      setNotice({ text: `${user.name} ${done[action]}.` });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "That didn't work. Please try again.", error: true });
    } finally {
      setWorking(null);
    }
  };

  const ask = (user: AdminUserRow, action: Action) => (action === "unblock" ? run(user, action) : setPending({ user, action }));
  const confirm = pending && pending.action !== "unblock" ? CONFIRM[pending.action] : null;

  return (
    <>
      {notice && (
        <p
          className={`mb-4 rounded-md border px-4 py-3 text-sm ${notice.error ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-primary/30 bg-primary/5 text-foreground"}`}
          role="status"
        >
          {notice.text}
        </p>
      )}

      {users.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No users match.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card" data-testid="list-users">
          {users.map((u) => {
            const locked = u.self || u.organizer;
            return (
              <li key={u.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:gap-6" data-testid={`row-user-${u.id}`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar profile={{ name: u.name, imageUrl: u.imageUrl }} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{u.name}</span>
                      {u.self && <span className="text-xs text-muted-foreground">(you)</span>}
                      {u.organizer ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Organizer</span>
                      ) : (
                        u.admin && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Admin</span>
                      )}
                      {u.banned && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Blocked</span>}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">{u.email ?? "No email"}</div>
                  </div>
                </div>

                <dl className="grid grid-cols-3 gap-4 text-sm lg:w-80 lg:shrink-0">
                  <div>
                    <dt className="text-xs text-muted-foreground">Joined</dt>
                    <dd className="text-foreground">{u.joined}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Last active</dt>
                    <dd className="text-foreground">{u.lastActive}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Saved</dt>
                    <dd className="text-foreground" title={u.inMatchmaking ? "In matchmaking" : undefined}>
                      {u.talks + u.places}
                      {u.inMatchmaking && <span className="ml-1.5 text-xs text-primary">· Meet</span>}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 lg:w-[21rem] lg:shrink-0 lg:flex-nowrap lg:justify-end">
                  {working === u.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      {u.admin ? (
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={locked} onClick={() => ask(u, "remove_admin")} title={locked ? "Organizers and your own account stay admins" : undefined}>
                          <ShieldOff className="h-3.5 w-3.5" />
                          Remove admin
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={u.banned} onClick={() => ask(u, "make_admin")}>
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Make admin
                        </Button>
                      )}
                      {u.banned ? (
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => ask(u, "unblock")}>
                          <Undo2 className="h-3.5 w-3.5" />
                          Unblock
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={locked} onClick={() => ask(u, "block")}>
                          <Ban className="h-3.5 w-3.5" />
                          Block
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        disabled={locked}
                        onClick={() => ask(u, "delete")}
                        aria-label={`Delete ${u.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          {pending && confirm && (
            <>
              <DialogHeader className="text-left sm:text-left">
                <DialogTitle>{confirm.title}</DialogTitle>
                <DialogDescription className="leading-relaxed">{confirm.body(pending.user.name)}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setPending(null)}>
                  Cancel
                </Button>
                <Button variant={confirm.destructive ? "destructive" : "default"} onClick={() => run(pending.user, pending.action)} data-testid="button-confirm-action">
                  {confirm.button}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
