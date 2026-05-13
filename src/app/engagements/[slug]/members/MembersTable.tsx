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
}

const ROLES: { value: string; label: string; description: string }[] = [
  { value: 'auditor_lead',    label: 'Auditor Lead',    description: 'Full control, can invite/remove members, re-import Excel, delete evidence.' },
  { value: 'auditor',         label: 'Auditor',         description: 'Edit everything, view the engagement-wide timeline, generate reports.' },
  { value: 'client_owner',    label: 'Contributor',     description: 'Edit own PBC items, upload evidence; cannot see internal comments.' },
  { value: 'client_reviewer', label: 'Viewer',          description: 'Read-only access to PBC items, walkthroughs, entities; cannot edit.' },
];

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
  const [newEmail, setNewEmail] = React.useState('');
  const [newRole, setNewRole] = React.useState('client_owner');
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    const r = await fetch(`/api/engagements/${slug}/members`);
    if (r.ok) setMembers(await r.json());
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/engagements/${slug}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      });
      const body = await r.json();
      if (!r.ok) {
        setError(body.error || 'Failed to add member');
        return;
      }
      setNewEmail('');
      await refresh();
    } finally {
      setBusy(false);
    }
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
          <div className="text-[12px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-2">Add member</div>
          <form onSubmit={addMember} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="alice@yourfirm.com"
                className="w-full h-9 px-3 border border-rule dark:border-navy-700 rounded text-[13px] bg-canvas dark:bg-navy-950"
              />
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
              disabled={busy || !newEmail}
              className="px-3 h-9 inline-flex items-center rounded bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800 disabled:opacity-50"
            >
              {busy ? 'Adding…' : 'Add member'}
            </button>
          </form>
          <p className="text-[11.5px] text-ink-500 dark:text-slate-400 mt-2">
            {ROLES.find(r => r.value === newRole)?.description}
          </p>
        </div>
      )}

      {error && (
        <div className="text-[12.5px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded p-2">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-canvas dark:bg-navy-950 text-[10.5px] uppercase tracking-wider text-ink-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Email</th>
              <th className="px-4 py-2 text-left font-semibold">Role</th>
              <th className="px-4 py-2 text-left font-semibold">Added</th>
              {canManage && <th className="px-4 py-2 w-0" />}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-t border-rule dark:border-navy-800">
                <td className="px-4 py-2.5">
                  {m.email}
                  {m.userId === currentUserId && <span className="ml-2 text-[10.5px] text-ink-500 dark:text-slate-400">(you)</span>}
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
            ))}
            {members.length === 0 && (
              <tr><td colSpan={canManage ? 4 : 3} className="px-4 py-6 text-center text-ink-500 dark:text-slate-400">No members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
