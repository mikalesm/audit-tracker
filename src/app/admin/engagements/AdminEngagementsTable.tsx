'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

interface Row {
  id: number; slug: string; name: string; clientName: string; fiscalYear: string | null;
  status: 'active' | 'closed' | 'archived';
  memberCount: number; itemCount: number;
  isMember: boolean;
  createdAt: string;
}

export default function AdminEngagementsTable({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>(initial);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    const r = await fetch('/api/admin/engagements');
    if (r.ok) {
      const fresh = (await r.json()) as Omit<Row, 'isMember'>[];
      // Preserve isMember from current state since the admin route doesn't tell us.
      setRows(fresh.map(f => ({ ...f, isMember: rows.find(r => r.id === f.id)?.isMember ?? false })));
    }
  }

  async function patch(slug: string, body: Record<string, unknown>, id: number) {
    setError(null);
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/engagements/${slug}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Failed'); return null; }
      return data;
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(row: Row, status: Row['status']) {
    const data = await patch(row.slug, { status }, row.id);
    if (data) await refresh();
  }

  async function joinAsLead(row: Row) {
    const data = await patch(row.slug, { joinAs: 'auditor_lead' }, row.id);
    if (data) {
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, isMember: true } : r));
    }
  }

  async function openEngagement(row: Row) {
    setBusyId(row.id);
    try {
      const r = await fetch(`/api/engagements/${row.slug}/switch`, { method: 'POST' });
      if (r.ok) router.push('/');
      else { const b = await r.json(); setError(b.error || 'Failed to switch'); }
    } finally {
      setBusyId(null);
    }
  }

  async function resetEng(row: Row) {
    if (!confirm(
      `Reset "${row.name}" to project start?\n\n` +
      `This wipes the activity log, all uploaded evidence (database rows + blob ` +
      `files), and PBC notes for this engagement, and resets every PBC item, ` +
      `access request, walkthrough, and sampling row back to its seeded state ` +
      `(status, dates, owner, notes cleared). The seeded structure — titles, ` +
      `categories, library template links, entity scoping — is preserved.\n\n` +
      `This cannot be undone.\n\n` +
      `Click OK to be asked to type the engagement slug to confirm.`
    )) return;
    const typed = prompt(`Type "${row.slug}" to confirm reset:`);
    if (typed !== row.slug) {
      setError('Reset cancelled — slug did not match.');
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/engagements/${row.slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reset', confirm: row.slug }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || 'Reset failed');
        return;
      }
      const c = data.reset?.counts || {};
      const summary = [
        `${c.activity_log ?? 0} activity rows`,
        `${c.evidence_files ?? 0} evidence rows`,
        `${c.blobs_deleted ?? 0} blobs`,
        `${c.pbc_notes ?? 0} notes`,
        `${c.pbc_items_reset ?? 0} PBC items reset`,
      ].join(' · ');
      alert(`Reset complete for ${row.name}.\n\n${summary}`);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteEng(row: Row) {
    if (!confirm(
      `Permanently delete "${row.name}"?\n\n` +
      `This wipes ALL PBC items, walkthroughs, sampling, entities, evidence ` +
      `metadata, members, and activity for this engagement. It cannot be undone.\n\n` +
      `Click OK to be asked to type the engagement name to confirm.`
    )) return;
    const typed = prompt(`Type "${row.name}" to confirm permanent deletion:`);
    if (typed !== row.name) {
      setError('Deletion cancelled — name did not match.');
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/engagements/${row.slug}`, { method: 'DELETE' });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        setError(b.error || 'Delete failed');
        return;
      }
      setRows(rs => rs.filter(rr => rr.id !== row.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {error && (
        <div className="text-[12.5px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded p-2 mb-3">
          {error}
        </div>
      )}
      <div className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-canvas dark:bg-navy-950 text-[10.5px] uppercase tracking-wider text-ink-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Engagement</th>
              <th className="px-4 py-2 text-left font-semibold">Client</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-right font-semibold">Members</th>
              <th className="px-4 py-2 text-right font-semibold">PBC items</th>
              <th className="px-4 py-2 text-left font-semibold">Created</th>
              <th className="px-4 py-2 w-0"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-t border-rule dark:border-navy-800">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-[10.5px] text-ink-500 dark:text-slate-400 font-mono">{row.slug}</div>
                </td>
                <td className="px-4 py-2.5">
                  {row.clientName}
                  {row.fiscalYear && <span className="text-ink-500 dark:text-slate-400"> · {row.fiscalYear}</span>}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={row.status}
                    onChange={(e) => setStatus(row, e.target.value as Row['status'])}
                    disabled={busyId === row.id}
                    className="h-7 px-2 border border-rule dark:border-navy-700 rounded text-[12px] bg-canvas dark:bg-navy-950"
                  >
                    <option value="active">active</option>
                    <option value="closed">closed</option>
                    <option value="archived">archived</option>
                  </select>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.memberCount}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.itemCount}</td>
                <td className="px-4 py-2.5 text-ink-500 dark:text-slate-400">
                  {new Date(row.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    {row.isMember ? (
                      <button
                        onClick={() => openEngagement(row)}
                        disabled={busyId === row.id}
                        className="px-2.5 h-7 inline-flex items-center rounded border border-navy-700 text-navy-700 text-[11.5px] font-medium hover:bg-navy-50 dark:border-navy-300 dark:text-navy-200 dark:hover:bg-navy-800 disabled:opacity-50"
                      >
                        Open
                      </button>
                    ) : (
                      <button
                        onClick={() => joinAsLead(row)}
                        disabled={busyId === row.id}
                        className="px-2.5 h-7 inline-flex items-center rounded border border-rule dark:border-navy-700 text-[11.5px] hover:bg-canvas dark:hover:bg-navy-800 disabled:opacity-50"
                        title="Add yourself as auditor_lead to this engagement"
                      >
                        Join as lead
                      </button>
                    )}
                    <button
                      onClick={() => resetEng(row)}
                      disabled={busyId === row.id}
                      className="px-2.5 h-7 inline-flex items-center rounded border border-amber-300 text-amber-700 text-[11.5px] hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950 disabled:opacity-50"
                      title="Wipe history + evidence and reset all rows to seeded defaults"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => deleteEng(row)}
                      disabled={busyId === row.id}
                      className="px-2.5 h-7 inline-flex items-center rounded border border-red-300 text-red-700 text-[11.5px] hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-50"
                      title="Permanently delete this engagement and all its data"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-ink-500 dark:text-slate-400">No engagements yet. Click <strong>+ New audit</strong> to start.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
