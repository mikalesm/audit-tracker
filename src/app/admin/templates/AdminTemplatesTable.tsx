'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

interface Row {
  id: number; slug: string; name: string; clientName: string;
  itemCount: number; memberCount: number;
  categories: string[];
  isMember: boolean;
  createdAt: string;
}

export default function AdminTemplatesTable({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>(initial);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function joinAndOpen(row: Row) {
    setBusyId(row.id);
    setError(null);
    try {
      if (!row.isMember) {
        const r = await fetch(`/api/admin/engagements/${row.slug}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ joinAs: 'auditor_lead' }),
        });
        if (!r.ok) {
          const b = await r.json();
          setError(b.error || 'Failed to join template');
          return;
        }
        setRows(rs => rs.map(r => r.id === row.id ? { ...r, isMember: true } : r));
      }
      const sw = await fetch(`/api/engagements/${row.slug}/switch`, { method: 'POST' });
      if (!sw.ok) { const b = await sw.json(); setError(b.error || 'Failed to switch'); return; }
      router.push('/');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTemplate(row: Row) {
    if (!confirm(
      `Permanently delete template "${row.name}"?\n\n` +
      `Engagements already created from this template are unaffected — they ` +
      `were copied at creation time. The template itself, its PBC items, ` +
      `walkthroughs, sampling, entities, and members are wiped.\n\n` +
      `Click OK to type the template name to confirm.`
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
              <th className="px-4 py-2 text-left font-semibold">Template name</th>
              <th className="px-4 py-2 text-left font-semibold">Categories</th>
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
                  {row.categories.length === 0
                    ? <span className="text-ink-500 dark:text-slate-400 italic">—</span>
                    : (
                      <span className="text-[11.5px]">
                        {row.categories.slice(0, 3).join(', ')}
                        {row.categories.length > 3 && (
                          <span className="text-ink-500 dark:text-slate-400"> +{row.categories.length - 3} more</span>
                        )}
                      </span>
                    )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.itemCount}</td>
                <td className="px-4 py-2.5 text-ink-500 dark:text-slate-400">
                  {new Date(row.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => joinAndOpen(row)}
                      disabled={busyId === row.id}
                      className="px-2.5 h-7 inline-flex items-center rounded border border-navy-700 text-navy-700 text-[11.5px] font-medium hover:bg-navy-50 dark:border-navy-300 dark:text-navy-200 dark:hover:bg-navy-800 disabled:opacity-50"
                    >
                      {row.isMember ? 'Open' : 'Open (auto-join)'}
                    </button>
                    <button
                      onClick={() => deleteTemplate(row)}
                      disabled={busyId === row.id}
                      className="px-2.5 h-7 inline-flex items-center rounded border border-red-300 text-red-700 text-[11.5px] hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-50"
                      title="Permanently delete this template"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500 dark:text-slate-400">
                No templates yet. Click <strong>+ New template</strong> to create one,
                then open it and upload your standard PBC Excel via Settings → Re-sync from Excel.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
