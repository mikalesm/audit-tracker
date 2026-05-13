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

export default function AdminUsersTable({ initial, currentUserId }: { initial: User[]; currentUserId: number }) {
  const [users, setUsers] = React.useState<User[]>(initial);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  async function refresh() {
    const r = await fetch('/api/users');
    if (r.ok) setUsers(await r.json());
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
