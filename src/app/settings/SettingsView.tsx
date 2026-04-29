'use client';
import * as React from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EngagementSettings } from '@/types';
import { SavedFlash, useSaveIndicator } from '@/components/tables/SavedIndicator';
import { Upload, Sun, Moon, ExternalLink, Database } from 'lucide-react';

export default function SettingsView() {
  const [settings, setSettings] = React.useState<EngagementSettings | null>(null);
  const { savedKey, flash } = useSaveIndicator();
  const [importStatus, setImportStatus] = React.useState<string | null>(null);
  const [importBusy, setImportBusy] = React.useState(false);
  const [dark, setDark] = React.useState(false);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  async function patch(p: Partial<EngagementSettings>) {
    if (!settings) return;
    const next = { ...settings, ...p };
    setSettings(next);
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    flash();
  }

  async function uploadExcel(file: File) {
    setImportBusy(true);
    setImportStatus(`Importing ${file.name}…`);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const data = await res.json();
    setImportBusy(false);
    if (data.ok) {
      const s = data.summary;
      setImportStatus(`Done · PBC ${s.pbc.added} added / ${s.pbc.updatedStatic} static fields refreshed · Access ${s.access.added} added · Walkthroughs ${s.walkthroughs.added} added · Entities ${s.entities.added} added · Sampling ${s.sampling.added} added.`);
    } else {
      setImportStatus(`Failed: ${data.error}`);
    }
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    if (next) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }

  if (!settings) return <div className="p-6"><div className="h-32 skeleton" /></div>;

  return (
    <div className="px-6 py-8 max-w-[900px] mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-[20px] font-semibold tracking-tight">Settings</h1>
        <SavedFlash savedKey={savedKey} />
      </div>

      <Card>
        <CardHeader><CardTitle>Engagement details</CardTitle></CardHeader>
        <CardBody>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Project title">
              <Input value={settings.projectTitle} onChange={e => patch({ projectTitle: e.target.value })} />
            </Field>
            <Field label="Client name">
              <Input value={settings.clientName} onChange={e => patch({ clientName: e.target.value })} />
            </Field>
            <Field label="Audit period">
              <Input value={settings.auditPeriod} onChange={e => patch({ auditPeriod: e.target.value })} />
            </Field>
            <Field label="Lead auditor">
              <Input value={settings.leadAuditor} onChange={e => patch({ leadAuditor: e.target.value })} />
            </Field>
            <Field label="Sponsor">
              <Input value={settings.sponsor} onChange={e => patch({ sponsor: e.target.value })} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data import</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium">Re-sync from Excel (PBC tracker)</div>
              <p className="text-[12px] text-ink-500 mt-0.5">
                Upload <code className="text-[11px]">IT_Audit_PBC_Tracker_v2.xlsx</code> (or a newer version). Adds new rows from the workbook and refreshes static fields (Item Requested, Why, Format, Priority, Category). Never overwrites status, owner, dates, notes, or evidence on existing items.
              </p>
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                uploadExcel(f);
                e.target.value = '';
              }}
            />
            <Button variant="primary" size="md" disabled={importBusy} onClick={() => importInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> {importBusy ? 'Importing…' : 'Upload Excel'}
            </Button>
          </div>
          {importStatus && <p className="text-[12px] text-ink-700 dark:text-slate-300 bg-canvas dark:bg-navy-800 px-3 py-1.5 rounded mt-3">{importStatus}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Backups</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-start gap-3">
            <Database className="w-4 h-4 text-ink-500 mt-1 shrink-0" />
            <div className="flex-1">
              <div className="text-[13px] font-medium">Managed by Azure</div>
              <p className="text-[12px] text-ink-500 mt-0.5 leading-relaxed">
                The engagement database (Azure Database for PostgreSQL Flexible Server) has automated daily backups
                with 7-day point-in-time restore by default, and geo-redundant storage for cross-region recovery.
                Evidence files are stored in Azure Blob Storage with versioning + soft-delete + (in production)
                immutability for legal-hold periods.
              </p>
              <p className="text-[12px] text-ink-500 mt-2">
                To restore the database to an earlier point in time, use the Azure portal:
                <span className="block mt-1">
                  <code className="text-[11px]">Azure portal → your Resource Group → Postgres Flexible Server → Restore</code>
                </span>
              </p>
              <p className="text-[12px] text-ink-500 mt-2">
                For evidence-blob recovery (delete or overwrite mistakes): the storage container has versioning
                enabled — open the blob in the portal and select an earlier version to restore.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <UsersAndRoles />

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium">Theme</div>
              <p className="text-[12px] text-ink-500">Light is the default for client meetings.</p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

interface UserRow {
  id: number; email: string; displayName: string | null; role: string;
  isActive: boolean; createdAt: string; lastSeenAt: string | null;
}
const ROLE_OPTIONS = [
  { v: 'auditor_lead',    l: 'Lead auditor' },
  { v: 'auditor',         l: 'Auditor' },
  { v: 'client_owner',    l: 'Client owner' },
  { v: 'client_reviewer', l: 'Client reviewer' },
];

function UsersAndRoles() {
  const [rows, setRows] = React.useState<UserRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/users').then(async r => {
      if (r.status === 401 || r.status === 403) {
        setRows([]); setError(null); return;
      }
      if (!r.ok) { setError('Could not load users.'); return; }
      setRows(await r.json());
    });
  }, []);

  async function setRole(id: number, role: string) {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const updated: UserRow = await res.json();
      setRows(prev => (prev ?? []).map(r => r.id === id ? updated : r));
    }
  }
  async function setActive(id: number, isActive: boolean) {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }),
    });
    if (res.ok) {
      const updated: UserRow = await res.json();
      setRows(prev => (prev ?? []).map(r => r.id === id ? updated : r));
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Users &amp; roles</CardTitle></CardHeader>
      <CardBody>
        <p className="text-[12.5px] text-ink-700 dark:text-slate-300 leading-relaxed mb-3">
          Users sign in with Microsoft Entra ID. To invite a client user, add them as a B2B Guest in your
          Entra tenant (Identity → Users → Invite external user); they'll receive a sign-in email and land
          here as <code className="text-[11px]">client_reviewer</code>. Promote them once verified.
        </p>
        <a
          href="https://entra.microsoft.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-navy-700 dark:text-navy-300 hover:underline mb-4"
        >
          Open Entra portal <ExternalLink className="w-3 h-3" />
        </a>

        {error && <p className="text-[12px] text-danger">{error}</p>}
        {rows === null && <div className="h-20 skeleton" />}
        {rows && rows.length === 0 && (
          <p className="text-[12px] text-ink-500 italic">No users yet, or you don't have permission to view this list.</p>
        )}
        {rows && rows.length > 0 && (
          <div className="rounded border border-rule dark:border-navy-700 overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th className="w-[160px]">Role</th>
                  <th className="w-[100px]">Active</th>
                  <th className="w-[140px]">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="text-[12.5px]">{u.email}</div>
                      <div className="text-[11px] text-ink-500">{u.displayName || '—'}</div>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={e => setRole(u.id, e.target.value)}
                        className="h-7 rounded border border-rule dark:border-navy-700 bg-white dark:bg-navy-900 px-1.5 text-[12px]"
                      >
                        {ROLE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </td>
                    <td>
                      <label className="inline-flex items-center gap-1.5 text-[12px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={u.isActive}
                          onChange={e => setActive(u.id, e.target.checked)}
                        />
                        {u.isActive ? 'Active' : 'Disabled'}
                      </label>
                    </td>
                    <td className="text-[11.5px] tabular text-ink-500">
                      {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
