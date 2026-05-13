'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}

interface Template {
  id: number;
  slug: string;
  name: string;
  itemCount: number;
  categories: string[];
}

export default function NewEngagementForm() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [clientName, setClientName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [fiscalYear, setFiscalYear] = React.useState('FY' + (new Date().getFullYear() + 1).toString().slice(2));
  const [description, setDescription] = React.useState('');
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [fromTemplateSlug, setFromTemplateSlug] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Auto-derive slug from client name until the user manually edits the slug.
  React.useEffect(() => {
    if (!slugEdited) setSlug(slugify(clientName));
  }, [clientName, slugEdited]);

  // Load templates so the user can pick one as a seed.
  React.useEffect(() => {
    fetch('/api/admin/templates').then(async (r) => {
      if (!r.ok) return; // 403 if not a platform_admin (shouldn't happen on this page)
      const data = (await r.json()) as Template[];
      setTemplates(data);
      if (data.length === 1) setFromTemplateSlug(data[0].slug);
    }).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch('/api/engagements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug, name, clientName, fiscalYear, description,
          fromTemplateSlug: fromTemplateSlug || undefined,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        setError(body.error || 'Failed to create engagement');
        return;
      }
      // Switch into the new engagement immediately.
      await fetch(`/api/engagements/${body.slug}/switch`, { method: 'POST' });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create engagement');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg p-6 space-y-4">
      <Field label="Client name" hint="The name of the audited entity. Shown in the header and reports.">
        <input
          type="text"
          required
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Acme Corp"
          className="w-full h-9 px-3 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
        />
      </Field>

      <Field label="Engagement name" hint="Internal name. e.g. “Acme FY26 IT Audit”.">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={clientName ? `${clientName} ${fiscalYear || 'FY' + new Date().getFullYear()} IT Audit` : ''}
          className="w-full h-9 px-3 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
        />
      </Field>

      <Field label="Fiscal year" hint="Optional, shown under the client name.">
        <input
          type="text"
          value={fiscalYear}
          onChange={(e) => setFiscalYear(e.target.value)}
          placeholder="FY2026"
          className="w-full h-9 px-3 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
        />
      </Field>

      <Field label="URL slug" hint="Lowercase, alphanumeric and hyphens, 3-32 chars. Used in URLs and the blob container name.">
        <input
          type="text"
          required
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
          placeholder="acme"
          pattern="^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$"
          className="w-full h-9 px-3 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950 font-mono"
        />
      </Field>

      <Field label="Description" hint="Optional. Internal note about scope, team, special handling.">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
        />
      </Field>

      <Field
        label="Use template"
        hint={templates.length === 0
          ? 'No templates yet. Create one in /admin/templates to pre-populate new audits with your standard PBC list.'
          : 'Pre-populates the new engagement with the template\'s PBC list, walkthroughs, sampling controls, and entities. Per-client fields (status, dates, owner, notes, findings) are reset.'}
      >
        <select
          value={fromTemplateSlug}
          onChange={(e) => setFromTemplateSlug(e.target.value)}
          disabled={templates.length === 0}
          className="w-full h-9 px-2 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950 disabled:opacity-60"
        >
          <option value="">— Start from empty engagement —</option>
          {templates.map(t => (
            <option key={t.id} value={t.slug}>
              {t.name} — {t.itemCount} PBC items
              {t.categories.length > 0 && ` (${t.categories.length} categories)`}
            </option>
          ))}
        </select>
        {fromTemplateSlug && (() => {
          const t = templates.find(t => t.slug === fromTemplateSlug);
          if (!t || t.categories.length === 0) return null;
          return (
            <p className="text-[11px] text-ink-500 dark:text-slate-400 mt-1.5">
              Includes categories: <strong>{t.categories.join(', ')}</strong>
            </p>
          );
        })()}
      </Field>

      {error && (
        <div className="text-[12.5px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded p-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || !name || !clientName || !slug}
          className="px-4 h-9 inline-flex items-center rounded bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create engagement'}
        </button>
        <p className="text-[11.5px] text-ink-500 dark:text-slate-400">
          You&apos;ll be added as auditor_lead automatically. After this, add members in Settings → Users & roles.
        </p>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <div className="text-[11.5px] text-ink-500 dark:text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
