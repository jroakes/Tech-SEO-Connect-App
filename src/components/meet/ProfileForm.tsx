import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_TOPICS, TOPICS } from "@/data/topics";
import type { Profile } from "@/lib/matching";

type Answers = { name: string; title: string; topics: string[]; linkedin: string };

interface ProfileFormProps {
  initial: Profile | null;
  suggestedName: string;
  onSaved: (profile: Profile) => void;
  onCancel?: () => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring";

/** The Meet questions: name, title, topics and LinkedIn, for joining or editing. */
export function ProfileForm({ initial, suggestedName, onSaved, onCancel }: ProfileFormProps) {
  const [answers, setAnswers] = useState<Answers>({
    name: initial?.name ?? suggestedName,
    title: initial?.title ?? "",
    topics: initial?.topics ?? [],
    linkedin: initial?.linkedin ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setAnswers((a) => ({ ...a, [key]: value }));
  const toggle = (id: string) =>
    set("topics", answers.topics.includes(id) ? answers.topics.filter((t) => t !== id) : answers.topics.length < MAX_TOPICS ? [...answers.topics, id] : answers.topics);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answers.topics.length) {
      setError("Pick at least one topic so we can find your people.");
      return;
    }
    if (answers.topics.length > MAX_TOPICS) {
      setError(`Pick up to ${MAX_TOPICS} topics.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(answers) });
      const data = (await res.json()) as { profile?: Profile; error?: string };
      if (!res.ok || !data.profile) throw new Error(data.error ?? "Something went wrong. Please try again.");
      onSaved(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  const section = "rounded-md border border-border bg-card p-5 sm:p-6";
  return (
    <form onSubmit={submit} className="space-y-5" data-testid="form-profile">
      <section className={`${section} grid gap-4 sm:grid-cols-2`}>
        <Field label="Name">
          <input required maxLength={80} value={answers.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Title">
          <input maxLength={120} value={answers.title} onChange={(e) => set("title", e.target.value)} placeholder="Technical SEO Lead, Acme" className={inputClass} />
        </Field>
      </section>

      <section className={section} role="group" aria-labelledby="topics-label">
        <h2 id="topics-label" className="text-sm font-medium text-foreground">
          Topics you're interested in
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Pick up to {MAX_TOPICS}. You'll see who else picked each one.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOPICS.map((t) => {
            const on = answers.topics.includes(t.id);
            const full = !on && answers.topics.length >= MAX_TOPICS;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                aria-pressed={on}
                disabled={full}
                className={`min-h-9 rounded-full border px-3.5 text-sm transition-colors ${
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/60"
                } ${full ? "cursor-not-allowed opacity-40" : ""}`}
                data-testid={`topic-${t.id}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className={section}>
        <Field label="Your LinkedIn" hint="Optional. People can message you there to meet up.">
          <input
            maxLength={200}
            value={answers.linkedin}
            onChange={(e) => set("linkedin", e.target.value)}
            placeholder="linkedin.com/in/yourname"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            className={inputClass}
            data-testid="input-linkedin"
          />
        </Field>
      </section>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Your answers are shown to other attendees who join. You can leave anytime.</p>
        <div className="flex shrink-0 gap-2">
          {onCancel && (
            <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" className="min-h-11 min-w-40" disabled={saving} data-testid="button-save-profile">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? "Save" : "Find my people"}
          </Button>
        </div>
      </div>
    </form>
  );
}
