'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EngagementSettings } from '@/types';
import { Upload, Sun, Moon, ExternalLink, Database, Users, CheckCircle2 } from 'lucide-react';
import { useDirtyForm } from '@/lib/forms/useDirtyForm';

interface CurrentEngagement {
  slug: string;
  name: string;
}

export default function SettingsView() {
  const router = useRouter();
  const [initial, setInitial] = React.useState<EngagementSettings | null>(null);
  const [engagement, setEngagement] = React.useState<CurrentEngagement | null>(null);
  const [importStatus, setImportStatus] = React.useState<string | null>(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const [dark, setDark] = React.useState(false);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setInitial);
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.user?.currentEngagement) {
        setEngagement({
          slug: d.user.currentEngagement.slug,
          name: d.user.currentEngagement.name,
        });
      }
    });
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    if (next) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }

  if (!initial) return <div className="p-6"><div className="h-32 skeleton" /></div>;

  return (
    <div className="px-4 md:px-6 py-8 max-w-[960px] mx-auto space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight">Settings</h1>
        <p className="text-[12.5px] text-ink-500 dark:text-slate-400 mt-0.5">
          Engagement-scoped settings. Changes here only affect <strong>{engagement?.name ?? 'this engagement'}</strong>.
        </p>
      </div>

      <EngagementDetailsCard initial={initial} onSaved={(next) => { setInitial(next); router.refresh(); }} />

      <DataImportCard
        busy={importBusy}
        status={importStatus}
        onPick={() => importInputRef.current?.click()}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setImportBusy(true);
          setImportStatus(`Importing ${f.name}…`);
          const fd = new FormData();
          fd.append('file', f);
          const res = await fetch('/api/import', { method: 'POST', body: fd });
          const data = await res.json();
          setImportBusy(false);
          if (data.ok) {
            const s = data.summary;
            setImportStatus(`Done · PBC ${s.pbc.added} added / ${s.pbc.updatedStatic} static fields refreshed · Access ${s.access.added} added · Walkthroughs ${s.walkthroughs.added} added · Entities ${s.entities.added} added · Sampling ${s.sampling.added} added.`);
            router.refresh();
          } else {
            setImportStatus(`Failed: ${data.error}`);
          }
        }}
      />

      <MembersCard engagementSlug={engagement?.slug} />

      <Card>
        <CardHeader><CardTitle>Backups &amp; retention</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-start gap-3">
            <Database className="w-4 h-4 text-ink-500 mt-1 shrink-0" />
            <div className="flex-1">
              <div className="text-[13px] font-medium">Managed by Azure</div>
              <p className="text-[12px] text-ink-500 mt-0.5 leading-relaxed">
                The Postgres database has automated daily backups with 7-day point-in-time restore (geo-redundant).
                Evidence files live in a dedicated Blob Storage container per engagement, with versioning + soft-delete.
              </p>
              <p className="text-[12px] text-ink-500 mt-2">
                To restore the database: <code className="text-[11px]">Azure portal → your Resource Group → Postgres Flexible Server → Restore</code>.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium">Theme</div>
              <p className="text-[12px] text-ink-500">Light is the default for client meetings. Stored in your browser only.</p>
            </div>
            <Button variant="secondary" size="md" onClick={toggleTheme}>
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {dark ? 'Switch to light' : 'Switch to dark'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function EngagementDetailsCard({
  initial,
  onSaved,
}: {
  initial: EngagementSettings;
  onSaved: (next: EngagementSettings) => void;
}) {
  const { value, isDirty, patch, commit, reset } = useDirtyForm<EngagementSettings>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);

  async function save() {
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Save failed');
        return;
      }
      const next: EngagementSettings = await res.json();
      commit(next);
      setLastSavedAt(Date.now());
      onSaved(next);
    } finally {
      setSaving(false);
    }
  }

  if (!value) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement details</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-[12px] text-ink-500 dark:text-slate-400 mb-4">
          Names and labels shown throughout the app and in PDF reports. Visible to everyone in this engagement.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Project title" hint="Shown in the browser tab and report headers.">
            <Input value={value.projectTitle} onChange={e => patch({ projectTitle: e.target.value })} />
          </Field>
          <Field label="Client name" hint="The audited entity.">
            <Input value={value.clientName} onChange={e => patch({ clientName: e.target.value })} />
          </Field>
          <Field label="Audit period" hint='e.g. "FY2026", "Q4 2025", or a date range.'>
            <Input value={value.auditPeriod} onChange={e => patch({ auditPeriod: e.target.value })} />
          </Field>
          <Field label="Lead auditor" hint="Shown on the dashboard and reports.">
            <Input value={value.leadAuditor} onChange={e => patch({ leadAuditor: e.target.value })} />
          </Field>
          <Field label="Audit sponsor" hint="Optional. The client-side executive sponsor.">
            <Input value={value.sponsor} onChange={e => patch({ sponsor: e.target.value })} />
          </Field>
        </div>
      </CardBody>
      <CardFooter>
        <Button variant="primary" size="md" onClick={save} disabled={!isDirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {isDirty && !saving && (
          <>
            <span className="text-[12px] text-amber-700 dark:text-amber-300">Unsaved changes</span>
            <button onClick={reset} className="text-[12px] text-ink-500 hover:underline">Discard</button>
          </>
        )}
        {!isDirty && lastSavedAt && (
          <span className="text-[12px] text-ink-500 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Saved
          </span>
        )}
        {error && <span className="text-[12px] text-red-600 dark:text-red-400">{error}</span>}
      </CardFooter>
    </Card>
  );
}

function DataImportCard({
  busy,
  status,
  onPick,
}: {
  busy: boolean;
  status: string | null;
  onPick: () => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Re-sync from Excel</CardTitle></CardHeader>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-[13px] font-medium">Overlay your standard workbook</div>
            <p className="text-[12px] text-ink-500 mt-0.5 leading-relaxed">
              Upload <code className="text-[11px]">IT_Audit_PBC_Tracker_v2.xlsx</code> (or any equivalent workbook
              with sheets <em>PBC List</em> / <em>Access Requests</em> / <em>Walkthroughs</em> /
              <em>Entity Scope</em> / <em>Sampling &amp; Testing</em>). New rows are added; existing rows have their
              static columns refreshed (category, item description, priority). Status, owner, dates, notes, and
              evidence on existing items are never touched.
            </p>
            <p className="text-[11.5px] text-ink-500 dark:text-slate-400 mt-2">
              Tip: to set up a standard template all engagements can reuse, go to <code className="text-[11px]">/admin/templates</code> instead.
            </p>
          </div>
          <Button variant="primary" size="md" disabled={busy} onClick={onPick}>
            <Upload className="w-3.5 h-3.5" /> {busy ? 'Importing…' : 'Upload Excel'}
          </Button>
        </div>
        {status && (
          <p className="text-[12px] text-ink-700 dark:text-slate-300 bg-canvas dark:bg-navy-800 px-3 py-1.5 rounded mt-3">
            {status}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function MembersCard({ engagementSlug }: { engagementSlug?: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>Members &amp; roles</CardTitle></CardHeader>
      <CardBody>
        <p className="text-[12.5px] text-ink-700 dark:text-slate-300 leading-relaxed">
          Who can sign into this engagement and what they can do. Add the people from your tenant by email and pick a role:
          <strong> Auditor Lead</strong> (full control), <strong>Auditor</strong> (edit everything),
          <strong> Contributor</strong> (edit own items + upload evidence), <strong>Viewer</strong> (read-only).
        </p>
        <a
          href={engagementSlug ? `/engagements/${engagementSlug}/members` : '/engagements'}
          className="inline-flex items-center gap-1.5 mt-3 px-3 h-9 rounded bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800"
        >
          <Users className="w-3.5 h-3.5" /> Manage members
          <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
        </a>
      </CardBody>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-ink-500 dark:text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
