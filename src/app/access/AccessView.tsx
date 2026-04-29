'use client';
import * as React from 'react';
import type { AccessRequest } from '@/types';
import { ACCESS_STATUSES } from '@/lib/utils';
import { InlineDate, InlineSelect, InlineText } from '@/components/tables/InlineEdit';
import { StatusPill, Badge } from '@/components/ui/badge';
import { SavedFlash, useSaveIndicator } from '@/components/tables/SavedIndicator';

export default function AccessView() {
  const [items, setItems] = React.useState<AccessRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { savedKey, flash } = useSaveIndicator();

  React.useEffect(() => { load(); }, []);
  async function load() {
    const r = await fetch('/api/access'); setItems(await r.json()); setLoading(false);
  }
  async function patch(id: number, p: Partial<AccessRequest>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...p } : i));
    const r = await fetch(`/api/access/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    if (r.ok) {
      const updated: AccessRequest = await r.json();
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      flash();
    }
  }

  const notRequestedCount = items.filter(i => i.status === 'Not Requested').length;

  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Access Requests</h1>
          <p className="text-[12px] text-ink-500 dark:text-slate-400 mt-0.5">
            {items.length} read-only access requests · {notRequestedCount > 0 && (
              <span className="text-danger">{notRequestedCount} still not requested</span>
            )}
            {notRequestedCount === 0 && <span className="text-emerald-700">all in motion</span>}
          </p>
        </div>
        <SavedFlash savedKey={savedKey} />
      </div>

      <div className="rounded-lg border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th className="min-w-[200px]">System / Platform</th>
                <th className="min-w-[160px]">Access Type</th>
                <th className="min-w-[280px]">Role / Permissions</th>
                <th className="min-w-[160px]">Recommended Method</th>
                <th className="w-[140px]">Owner</th>
                <th className="w-[120px]">Status</th>
                <th className="w-[110px]">Provisioned</th>
                <th className="min-w-[200px]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={9} className="p-0"><div className="h-[34px] mx-3 my-1 skeleton" /></td></tr>
              ))}
              {!loading && items.map(item => (
                <tr key={item.id}>
                  <td className="text-ink-500 tabular">{item.num}</td>
                  <td className="text-[13px] font-medium">{item.system}</td>
                  <td className="text-[12.5px] text-ink-700 dark:text-slate-300">{item.accessType}</td>
                  <td className="text-[12px] text-ink-700 dark:text-slate-300 line-clamp-2 max-w-[280px]">{item.rolePermissions}</td>
                  <td className="text-[12.5px] text-ink-700 dark:text-slate-300">{item.recommendedMethod}</td>
                  <td><InlineText value={item.ownerClient} onCommit={v => patch(item.id, { ownerClient: v })} /></td>
                  <td>
                    <InlineSelect
                      value={item.status} options={[...ACCESS_STATUSES]}
                      onCommit={v => patch(item.id, { status: v as AccessRequest['status'] })}
                      renderValue={v => <StatusPill status={v} />}
                    />
                  </td>
                  <td><InlineDate value={item.provisionedDate} onCommit={v => patch(item.id, { provisionedDate: v })} /></td>
                  <td className="text-[12.5px]"><InlineText value={item.notes} onCommit={v => patch(item.id, { notes: v })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
