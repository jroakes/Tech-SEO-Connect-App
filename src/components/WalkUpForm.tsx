import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputClass =
  "min-h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring";

type Answer = { added: true } | { added: false; name: string; tickets: string[] } | { error: string };

/** Adds someone at the door to the event in Luma, with a free ticket. */
export default function WalkUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/admin/walk-ups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as Answer | null;
    setBusy(false);
    if (!data || "error" in data) return setResult({ ok: false, text: data && "error" in data ? data.error : "That didn't work. Please try again." });
    setResult(
      data.added
        ? { ok: true, text: `${name} has a free ticket, which Luma is emailing them. They'll be on Luma's check-in page in a moment.` }
        : { ok: true, text: `${data.name} is already registered${data.tickets.length ? ` (${data.tickets.join(", ")})` : ""}. Check them in on Luma.` },
    );
    setName("");
    setEmail("");
  };

  return (
    <form onSubmit={add} className="space-y-3 rounded-md border border-border bg-card p-4" data-testid="form-walk-up">
      <div>
        <h2 className="font-semibold text-foreground">Add a walk-up</h2>
        <p className="text-sm text-muted-foreground">Luma adds them as going with a free ticket and emails it to them.</p>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        aria-label="Walk-up's full name"
        required
        autoComplete="off"
        className={inputClass}
        data-testid="input-walk-up-name"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        aria-label="Walk-up's email"
        required
        autoComplete="off"
        autoCapitalize="none"
        className={inputClass}
        data-testid="input-walk-up-email"
      />
      <Button type="submit" className="min-h-11 gap-1.5" disabled={busy} data-testid="button-add-walk-up">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {busy ? "Adding…" : "Add free ticket"}
      </Button>
      {result && (
        <p className={`text-sm ${result.ok ? "text-foreground" : "text-destructive"}`} role="status" data-testid="text-walk-up-result">
          {result.text}
        </p>
      )}
    </form>
  );
}
