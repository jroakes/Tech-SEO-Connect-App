import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOPICS } from "@/data/topics";
import type { Profile } from "@/lib/matching";

const MAX_TOPICS = 6;

type Answers = Omit<Profile, "userId" | "imageUrl">;

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

function TopicPicker({ label, hint, value, onChange }: { label: string; hint: string; value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((t) => t !== id) : value.length < MAX_TOPICS ? [...value, id] : value);
  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {hint} Pick up to {MAX_TOPICS}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {TOPICS.map((t) => {
          const on = value.includes(t.id);
          const full = !on && value.length >= MAX_TOPICS;
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
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The matchmaking questionnaire, for joining or editing answers. */
export function ProfileForm({ initial, suggestedName, onSaved, onCancel }: ProfileFormProps) {
  const [answers, setAnswers] = useState<Answers>({
    name: initial?.name ?? suggestedName,
    role: initial?.role ?? "",
    workingOn: initial?.workingOn ?? "",
    wantToLearn: initial?.wantToLearn ?? "",
    canHelp: initial?.canHelp ?? "",
    learnTopics: initial?.learnTopics ?? [],
    helpTopics: initial?.helpTopics ?? [],
    contact: initial?.contact ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setAnswers((a) => ({ ...a, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answers.learnTopics.length && !answers.helpTopics.length) {
      setError("Pick at least one topic so we can find your people.");
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
      <section className={section}>
        <h2 className="mb-4 text-base font-semibold text-foreground">About you</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input required maxLength={80} value={answers.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </Field>
          <Field label="What you do">
            <input maxLength={120} value={answers.role ?? ""} onChange={(e) => set("role", e.target.value)} placeholder="Technical SEO lead at Acme" className={inputClass} />
          </Field>
        </div>
      </section>

      <section className={section}>
        <h2 className="mb-4 text-base font-semibold text-foreground">Right now</h2>
        <div className="space-y-4">
          <Field label="What are you working on?">
            <textarea
              rows={2}
              maxLength={400}
              value={answers.workingOn ?? ""}
              onChange={(e) => set("workingOn", e.target.value)}
              placeholder="Migrating a 2M-page site to a new CMS"
              className={inputClass}
            />
          </Field>
          <Field label="What do you want to learn or figure out here?">
            <textarea
              rows={2}
              maxLength={400}
              value={answers.wantToLearn ?? ""}
              onChange={(e) => set("wantToLearn", e.target.value)}
              placeholder="How other teams use BigQuery for log file analysis"
              className={inputClass}
            />
          </Field>
          <Field label="What could you help someone with?">
            <textarea
              rows={2}
              maxLength={400}
              value={answers.canHelp ?? ""}
              onChange={(e) => set("canHelp", e.target.value)}
              placeholder="Structured data, Python scripts for audits"
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className={`${section} space-y-6`}>
        <TopicPicker label="I want to learn about" hint="We'll match you with people who can help." value={answers.learnTopics} onChange={(v) => set("learnTopics", v)} />
        <TopicPicker label="I can help with" hint="We'll point people who are learning these to you." value={answers.helpTopics} onChange={(v) => set("helpTopics", v)} />
      </section>

      <section className={section}>
        <Field label="How can your matches find you?" hint="Optional. Shown to people you match with.">
          <input
            maxLength={160}
            value={answers.contact ?? ""}
            onChange={(e) => set("contact", e.target.value)}
            placeholder="Find me at lunch · @handle · linkedin.com/in/you"
            className={inputClass}
          />
        </Field>
      </section>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Your answers are shown to other attendees who join matchmaking. You can leave anytime.</p>
        <div className="flex shrink-0 gap-2">
          {onCancel && (
            <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" className="min-h-11 min-w-40" disabled={saving} data-testid="button-save-profile">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? "Save my answers" : "Find my people"}
          </Button>
        </div>
      </div>
    </form>
  );
}
