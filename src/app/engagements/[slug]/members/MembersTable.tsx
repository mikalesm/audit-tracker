'use client';
import * as React from 'react';

interface Member {
  id: number;
  engagementId: number;
  userId: number;
  role: string;
  addedAt: string;
  email: string;
  displayName: string | null;
  entraObjectId: string;
  lastSeenAt: string | null;
}

interface EntraUser {
  id: string;
  displayName: string | null;
  mail: string | null;
  userPrincipalName: string | null;
  userType: 'Member' | 'Guest' | null;
}

const ROLES: { value: string; label: string; description: string }[] = [
  { value: 'auditor_lead',    label: 'Auditor Lead',    description: 'Full control. Can invite/remove members, re-import Excel, delete evidence.' },
  { value: 'auditor',         label: 'Auditor',         description: 'Edit everything, see the engagement-wide timeline, generate reports.' },
  { value: 'client_owner',    label: 'Contributor',     description: 'Edit own PBC items, upload evidence; cannot see internal comments.' },
  { value: 'client_reviewer', label: 'Viewer',          description: 'Read-only access to PBC items, walkthroughs, entities.' },
];

const isPendingOid = (oid: string) => oid.startsWith('pending::');

export default function MembersTable({
  slug,
  initialMembers,
  currentUserId,
  canManage,
}: {
  slug: string;
  initialMembers: Member[];
  currentUserId: number;
  canManage: boolean;
}) {
  const [members, setMembers] = React.useState<Member[]>(initialMembers);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  // Add-member form state
  const [mode, setMode] = React.useState<'single' | 'bulk'>('single');
  const [newEmail, setNewEmail] = React.useState('');
  const [newRole, setNewRole] = React.useState('client_owner');
  const [bulkText, setBulkText] = React.useState('');

  // Entra picker state
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [pickerError, setPickerError] = React.useState<string | null>(null);
  const [pickerResults, setPickerResults] = React.useState<EntraUser[]>([]);
  const [graphAvailable, setGraphAvailable] = React.useState<boolean | null>(null);

  async function refresh() {
    const r = await fetch(`/api/engagements/${slug}/members`);
    if (r.ok) setMembers(await r.json());
  }

  // Debounced Entra search.
  React.useEffect(() => {
    if (mode !== 'single') return;
    const term = newEmail.trim();
    if (term.length < 2) { setPickerResults([]); setPickerOpen(false); return; }
    setPickerLoading(true);
    setPickerError(null);
    const handle = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/entra-users?q=${encodeURIComponent(term)}`);
        const data = await r.json() as { available: boolean; users: EntraUser[]; reason?: string };
        setGraphAvailable(data.available);
        setPickerResults(data.users || []);
        setPickerOpen(data.available && (data.users?.length ?? 0) > 0);
        if (data.reason && !data.available) setPickerError(null); // silent — fall back to plain email
        else if (data.reason && data.available) setPickerError(data.reason);
      } catch (e) {
        setPickerError(e instanceof Error ? e.message : String(e));
      } finally {
        setPickerLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [newEmail, mode]);

  async function addOne(email: string, role: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`/api/engagements/${slug}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, error: body.error };
  }

  async function submitSingle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const email = newEmail.trim();
      if (!email) return;
      const result = await addOne(email, newRole);
      if (!result.ok) {
        setError(result.error || 'Failed to add member');
        return;
      }
      setNewEmail('');
      setPickerOpen(false);
      setPickerResults([]);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitBulk(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const emails = Array.from(new Set(
      bulkText.split(/[,\s]+/).map(s => s.trim()).filter(s => s.includes('@'))
    ));
    if (emails.length === 0) { setError('Paste at least one email address.'); return; }
    setBusy(true);
    let added = 0;
    const failures: string[] = [];
    try {
      for (const email of emails) {
        const result = await addOne(email, newRole);
        if (result.ok) added++;
        else failures.push(`${email}: ${result.error || 'failed'}`);
      }
      await refresh();
      setInfo(`Added ${added} of ${emails.length} member${emails.length === 1 ? '' : 's'}.`);
      if (failures.length > 0) setError(failures.join('\n'));
      if (added > 0) setBulkText('');
    } finally {
      setBusy(false);
    }
  }

  function pickEntraUser(u: EntraUser) {
    const email = u.mail || u.userPrincipalName || '';
    setNewEmail(email);
    setPickerOpen(false);
    setPickerResults([]);
  }

  async function changeRole(userId: number, role: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/engagements/${slug}/members`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      if (!r.ok) { const b = await r.json(); setError(b.error || 'Failed'); return; }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: number) {
    if (!confirm('Remove this member from the engagement?')) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/engagements/${slug}/members`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!r.ok) { const b = await r.json(); setError(b.error || 'Failed to remove'); return; }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">
              Add member
            </div>
            <div className="flex items-center rounded-md border border-rule dark:border-navy-700 p-0.5 text-[11.5px]">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-2 h-6 rounded ${mode === 'single' ? 'bg-canvas dark:bg-navy-800 font-medium' : 'text-ink-500'}`}
              >Single</button>
              <button
                type="button"
                onClick={() => setMode('bulk')}
                className={`px-2 h-6 rounded ${mode === 'bulk' ? 'bg-canvas dark:bg-navy-800 font-medium' : 'text-ink-500'}`}
              >Bulk</button>
            </div>
          </div>

          {mode === 'single' ? (
            <form onSubmit={submitSingle} className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[260px] relative">
                <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">
                  Email or name
                </label>
                <input
                  type="text"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onFocus={() => { if (pickerResults.length > 0) setPickerOpen(true); }}
                  placeholder="alice@yourfirm.com or 'Alice Smith'"
                  className="w-full h-9 px-3 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
                  autoComplete="off"
                />
                {pickerOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-lg max-h-[280px] overflow-y-auto">
                    {pickerLoading && <div className="px-3 py-2 text-[12px] text-ink-500">Searching Entra…</div>}
                    {!pickerLoading && pickerResults.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => pickEntraUser(u)}
                        className="w-full text-left px-3 py-2 hover:bg-canvas dark:hover:bg-navy-800 border-b border-rule/60 dark:border-navy-800 last:border-0"
                      >
                        <div className="text-[13px] font-medium flex items-center gap-2">
                          {u.displayName || u.userPrincipalName || u.mail}
                          {u.userType === 'Guest' && (
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-900">Guest</span>
                          )}
                        </div>
                        <div className="text-[11.5px] text-ink-500 dark:text-slate-400">
                          {u.mail || u.userPrincipalName}
                        </div>
                      </button>
                    ))}
                    {!pickerLoading && pickerResults.length === 0 && (
                      <div className="px-3 py-2 text-[12px] text-ink-500">No matches in your Entra tenant. You can still add this email directly.</div>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-[180px]">
                <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full h-9 px-2 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <button
                type="submit"
                disabled={busy || !newEmail.trim()}
                className="px-3 h-9 inline-flex items-center rounded bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800 disabled:opacity-50"
              >
                {busy ? 'Adding…' : 'Add member'}
              </button>
            </form>
          ) : (
            <form onSubmit={submitBulk} className="space-y-2">
              <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">
                Paste emails (comma, space, or newline separated)
              </label>
              <textarea
                required
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={4}
                placeholder="alice@firm.com, bob@firm.com&#10;carol@firm.com"
                className="w-full px-3 py-2 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950 font-mono"
              />
              <div className="flex flex-wrap gap-2 items-end">
                <div className="min-w-[180px]">
                  <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Role for everyone</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full h-9 px-2 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
                  >
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={busy || !bulkText.trim()}
                  className="px-3 h-9 inline-flex items-center rounded bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800 disabled:opacity-50"
                >
                  {busy ? 'Adding…' : 'Add all'}
                </button>
              </div>
            </form>
          )}

          <p className="text-[11.5px] text-ink-500 dark:text-slate-400 mt-2.5">
            <strong>{ROLES.find(r => r.value === newRole)?.label}:</strong>{' '}
            {ROLES.find(r => r.value === newRole)?.description}
          </p>
          {graphAvailable === false && mode === 'single' && (
            <p className="text-[11px] text-ink-500 dark:text-slate-400 mt-1.5">
              Entra directory search isn&apos;t configured for this environment — add by email.
            </p>
          )}
          {pickerError && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1.5">
              Entra search: {pickerError}. You can still add by email.
            </p>
          )}
        </div>
      )}

      {info && (
        <div className="text-[12.5px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded p-2">
          {info}
        </div>
      )}
      {error && (
        <div className="text-[12.5px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded p-2 whitespace-pre-line">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-canvas dark:bg-navy-950 text-[10.5px] uppercase tracking-wider text-ink-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Member</th>
              <th className="px-4 py-2 text-left font-semibold">Role</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-left font-semibold">Added</th>
              {canManage && <th className="px-4 py-2 w-0" />}
            </tr>
          </thead>
          <tbody>
            {members.map(m => {
              const pending = isPendingOid(m.entraObjectId);
              return (
                <tr key={m.id} className="border-t border-rule dark:border-navy-800">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">
                      {m.displayName || m.email}
                      {m.userId === currentUserId && <span className="ml-2 text-[10.5px] text-ink-500 dark:text-slate-400">(you)</span>}
                    </div>
                    {m.displayName && (
                      <div className="text-[11px] text-ink-500 dark:text-slate-400">{m.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {canManage && m.userId !== currentUserId ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value)}
                        disabled={busy}
                        className="h-7 px-2 border border-rule dark:border-navy-700 rounded text-[12.5px] bg-canvas dark:bg-navy-950"
                      >
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (
                      ROLES.find(r => r.value === m.role)?.label || m.role
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {pending ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-700 dark:text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden /> Pending sign-in
                      </span>
                    ) : m.lastSeenAt ? (
                      <span className="text-[11.5px] text-ink-500 dark:text-slate-400">
                        Last seen {new Date(m.lastSeenAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-ink-500 dark:text-slate-400">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-500 dark:text-slate-400">
                    {new Date(m.addedAt).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="px-4 py-2.5 text-right">
                      {m.userId !== currentUserId && (
                        <button
                          onClick={() => remove(m.userId)}
                          disabled={busy}
                          className="text-[11.5px] text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr><td colSpan={canManage ? 5 : 4} className="px-4 py-6 text-center text-ink-500 dark:text-slate-400">No members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
