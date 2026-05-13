'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}

export default function NewTemplateForm() {
  const router = useRouter();
  const [name, setName] = React.useState('Standard IT Audit');
  const [slug, setSlug] = React.useState('standard-it-audit');
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch('/api/engagements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug, name,
          clientName: 'Template',
          fiscalYear: '',
          description,
          isTemplate: true,
        }),
      });
      const body = await r.json();
      if (!r.ok) { setError(body.error || 'Failed to create template'); return; }
      // Switch into the new template so the user can upload Excel right away.
      await fetch(`/api/engagements/${body.slug}/switch`, { method: 'POST' });
      router.push('/settings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg p-6 space-y-4">
      <Field label="Template name" hint="What you'll see in the 'Use template' dropdown when creating a new audit.">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-9 px-3 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
        />
      </Field>

      <Field label="URL slug" hint="Used in the template's internal URL. Lowercase, alphanumeric and hyphens, 3-32 chars.">
        <input
          type="text"
          required
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
          pattern="^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$"
          className="w-full h-9 px-3 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950 font-mono"
        />
      </Field>

      <Field label="Description" hint="Optional. Notes for yourself or other platform admins.">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
        />
      </Field>

      {error && (
        <div className="text-[12.5px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded p-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || !name || !slug}
          className="px-4 h-9 inline-flex items-center rounded bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create template'}
        </button>
        <p className="text-[11.5px] text-ink-500 dark:text-slate-400">
          You&apos;ll land on Settings inside the new template. Upload your Excel via Re-sync.
        </p>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11.5px] text-ink-500 dark:text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
