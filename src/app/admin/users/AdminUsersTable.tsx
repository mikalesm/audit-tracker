'use client';
import * as React from 'react';

interface User {
  id: number;
  email: string;
  displayName: string | null;
  systemRole: 'platform_admin' | 'member';
  isActive: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

interface EntraUser {
  id: string;
  displayName: string | null;
  mail: string | null;
  userPrincipalName: string | null;
  userType: 'Member' | 'Guest' | null;
}

export default function AdminUsersTable({ initial, currentUserId }: { initial: User[]; currentUserId: number }) {
  const [users, setUsers] = React.useState<User[]>(initial);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  // Entra picker state
  const [pickerQ, setPickerQ] = React.useState('');
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [pickerResults, setPickerResults] = React.useState<EntraUser[]>([]);
  const [graphAvailable, setGraphAvailable] = React.useState<boolean | null>(null);
  const [graphReason, setGraphReason] = React.useState<string | null>(null);
  const [makeAdmin, setMakeAdmin] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  async function refresh() {
    const r = await fetch('/api/users');
    if (r.ok) setUsers(await r.json());
  }

  // Debounced Entra search.
  React.useEffect(() => {
    const term = pickerQ.trim();
    if (term.length < 2) { setPickerResults([]); setPickerOpen(false); return; }
    setPickerLoading(true);
    const handle = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/entra-users?q=${encodeURIComponent(term)}`);
        const data = await r.json() as { available: boolean; users: EntraUser[]; reason?: string };
        setGraphAvailable(data.available);
        setGraphReason(data.reason ?? null);
        setPickerResults(data.users || []);
        setPickerOpen(data.available && (data.users?.length ?? 0) > 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPickerLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [pickerQ]);

  async function addEntraUser(picked: EntraUser) {
    setError(null);
    setInfo(null);
    setAdding(true);
    try {
      const email = picked.mail || picked.userPrincipalName;
      if (!email) {
        setError('That Entra entry has no email or UPN — pick another.');
        return;
      }
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entraObjectId: picked.id,
          email,
          displayName: picked.displayName,
          systemRole: makeAdmin ? 'platform_admin' : 'member',
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error || 'Failed to add user');
        return;
      }
      setInfo(`Added ${picked.displayName || email}${makeAdmin ? ' as platform admin' : ''}.`);
      setPickerQ('');
      setPickerResults([]);
      setPickerOpen(false);
      await refresh();
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    setError(null);
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const b = await r.json();
        setError(b.error || 'Failed');
        return false;
      }
      return true;
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAdmin(u: User) {
    const next = u.systemRole === 'platform_admin' ? 'member' : 'platform_admin';
    if (next === 'member' && u.id === currentUserId) {
      setError("Can't demote yourself — ask another platform admin to do it.");
      return;
    }
    const ok = await patch(u.id, { systemRole: next });
    if (ok) refresh();
  }

  async function toggleActive(u: User) {
    if (u.id === currentUserId) {
      setError("Can't deactivate yourself.");
      return;
    }
    const ok = await patch(u.id, { isActive: !u.isActive });
    if (ok) refresh();
  }

  const filtered = query
    ? users.filter(u =>
        u.email.toLowerCase().includes(query.toLowerCase())
        || (u.displayName ?? '').toLowerCase().includes(query.toLowerCase()))
    : users;

  return (
    <>
      <div className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg p-4 mb-4">
        <div className="text-[12px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-2">
          Add user from Entra
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[280px] relative">
            <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">
              Search the firm&apos;s Entra tenant
            </label>
            <input
              type="text"
              value={pickerQ}
              onChange={e => setPickerQ(e.target.value)}
              onFocus={() => { if (pickerResults.length > 0) setPickerOpen(true); }}
              placeholder="Type a name, email, or UPN…"
              className="w-full h-9 px-3 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
              autoComplete="off"
              disabled={adding}
            />
            {pickerOpen && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-lg max-h-[280px] overflow-y-auto">
                {pickerLoading && <div className="px-3 py-2 text-[12px] text-ink-500">Searching Entra…</div>}
                {!pickerLoading && pickerResults.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addEntraUser(u)}
                    disabled={adding}
                    className="w-full text-left px-3 py-2 hover:bg-canvas dark:hover:bg-navy-800 border-b border-rule/60 dark:border-navy-800 last:border-0 disabled:opacity-50"
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
              </div>
            )}
          </div>
          <label className="inline-flex items-center gap-2 h-9 px-2 text-[12.5px] cursor-pointer">
            <input
              type="checkbox"
              checked={makeAdmin}
              onChange={e => setMakeAdmin(e.target.checked)}
              className="accent-navy-700"
              disabled={adding}
            />
            Make platform admin
          </label>
        </div>
        <p className="text-[11.5px] text-ink-500 dark:text-slate-400 mt-2">
          Pre-creates a user record in Audit Tracker. The picked Entra account can sign in immediately and lands as a regular member (or platform admin if ticked). Engagement-level access is granted on each engagement&apos;s Members page.
        </p>
        {graphAvailable === false && (
          <p className="text-[11.5px] text-amber-700 dark:text-amber-300 mt-1">
            Microsoft Graph isn&apos;t configured for this environment ({graphReason ?? 'no AZURE_AD_* env vars'}). New users self-create on first sign-in via Entra; you can promote them to platform admin from the table below afterwards.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by email or name…"
          className="h-8 px-3 border border-rule dark:border-navy-700 rounded text-[12.5px] bg-white dark:bg-navy-900 w-72"
        />
        <span className="text-[11.5px] text-ink-500 dark:text-slate-400">
          {filtered.length} of {users.length}
        </span>
      </div>
      {info && (
        <div className="text-[12.5px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 rounded p-2 mb-3">
          {info}
        </div>
      )}
      {error && (
        <div className="text-[12.5px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded p-2 mb-3">
          {error}
        </div>
      )}
      <div className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-canvas dark:bg-navy-950 text-[10.5px] uppercase tracking-wider text-ink-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Email</th>
              <th className="px-4 py-2 text-left font-semibold">Display name</th>
              <th className="px-4 py-2 text-left font-semibold">System role</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-left font-semibold">Last seen</th>
              <th className="px-4 py-2 w-0"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-t border-rule dark:border-navy-800">
                <td className="px-4 py-2.5">
                  {u.email}
                  {u.id === currentUserId && <span className="ml-2 text-[10.5px] text-ink-500 dark:text-slate-400">(you)</span>}
                </td>
                <td className="px-4 py-2.5">{u.displayName || <span className="text-ink-500">—</span>}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10.5px] uppercase tracking-wider ${
                    u.systemRole === 'platform_admin'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {u.systemRole === 'platform_admin' ? 'Platform admin' : 'Member'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={u.isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                    {u.isActive ? 'active' : 'deactivated'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink-500 dark:text-slate-400">
                  {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => toggleAdmin(u)}
                    disabled={busyId === u.id}
                    className="px-2.5 h-7 inline-flex items-center rounded border border-rule dark:border-navy-700 text-[11.5px] hover:bg-canvas dark:hover:bg-navy-800 disabled:opacity-50 mr-2"
                  >
                    {u.systemRole === 'platform_admin' ? 'Revoke admin' : 'Make admin'}
                  </button>
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={busyId === u.id || u.id === currentUserId}
                    className={`px-2.5 h-7 inline-flex items-center rounded border text-[11.5px] disabled:opacity-50 ${
                      u.isActive
                        ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950'
                        : 'border-rule dark:border-navy-700 hover:bg-canvas dark:hover:bg-navy-800'
                    }`}
                  >
                    {u.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-ink-500 dark:text-slate-400">No users match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
