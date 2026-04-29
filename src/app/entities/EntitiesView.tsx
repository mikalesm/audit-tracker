'use client';
import * as React from 'react';
import type { Entity } from '@/types';
import { InlineSelect, InlineText } from '@/components/tables/InlineEdit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SavedFlash, useSaveIndicator } from '@/components/tables/SavedIndicator';
import { Plus, Trash2 } from 'lucide-react';

export default function EntitiesView() {
  const [items, setItems] = React.useState<Entity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { savedKey, flash } = useSaveIndicator();

  React.useEffect(() => { load(); }, []);
  async function load() { setItems(await (await fetch('/api/entities')).json()); setLoading(false); }
  async function patch(id: number, p: Partial<Entity>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...p } : i));
    const r = await fetch(`/api/entities/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    if (r.ok) {
      const updated: Entity = await r.json();
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      flash();
    }
  }
  async function add() {
    const r = await fetch('/api/entities', { method: 'POST' });
    const e: Entity = await r.json();
    setItems(prev => [...prev, e]);
  }
  async function del(id: number) {
    if (!confirm('Delete this entity row?')) return;
    await fetch(`/api/entities/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const inScope = items.filter(i => i.inScope === 'Y').length;
  const populated = items.filter(i => i.legalEntity).length;

  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Entity Scope</h1>
          <p className="text-[12px] text-ink-500 dark:text-slate-400 mt-0.5">
            {populated} entities · {inScope} in scope
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SavedFlash savedKey={savedKey} />
          <Button variant="primary" size="sm" onClick={add}><Plus className="w-3 h-3" /> Add entity</Button>
        </div>
      </div>

      <div className="rounded-lg border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th className="min-w-[200px]">Legal Entity</th>
              <th className="min-w-[160px]">Country / Location</th>
              <th className="min-w-[160px]">IT Model</th>
              <th className="min-w-[200px]">Key Applications</th>
              <th className="min-w-[140px]">Hosting</th>
              <th className="w-[100px]">Headcount</th>
              <th className="w-[100px]">In Scope</th>
              <th className="min-w-[200px]">Rationale</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={10} className="p-0"><div className="h-[34px] mx-3 my-1 skeleton" /></td></tr>)}
            {!loading && items.map(e => (
              <tr key={e.id}>
                <td className="text-ink-500 tabular">{e.num}</td>
                <td><InlineText value={e.legalEntity} onCommit={v => patch(e.id, { legalEntity: v })} placeholder="Add entity name…" /></td>
                <td><InlineText value={e.countryLocation} onCommit={v => patch(e.id, { countryLocation: v })} /></td>
                <td>
                  <InlineSelect
                    value={e.itModel || 'Centralized'}
                    options={['Centralized', 'Hybrid', 'Standalone']}
                    onCommit={v => patch(e.id, { itModel: v })}
                    renderValue={v => <span className="text-[12.5px]">{e.itModel || '—'}</span>}
                  />
                </td>
                <td><InlineText value={e.keyApplications} onCommit={v => patch(e.id, { keyApplications: v })} /></td>
                <td>
                  <InlineSelect
                    value={e.hosting || 'Cloud'}
                    options={['Cloud', 'On-Prem', 'Hybrid']}
                    onCommit={v => patch(e.id, { hosting: v })}
                    renderValue={() => <span className="text-[12.5px]">{e.hosting || '—'}</span>}
                  />
                </td>
                <td className="tabular text-[12.5px]">
                  <InlineText
                    value={e.headcount === null ? null : String(e.headcount)}
                    onCommit={v => patch(e.id, { headcount: v ? parseInt(v, 10) || null : null })}
                  />
                </td>
                <td>
                  <InlineSelect
                    value={e.inScope || ''}
                    options={['', 'Y', 'N']}
                    onCommit={v => patch(e.id, { inScope: (v as 'Y' | 'N') || null })}
                    renderValue={v => v === 'Y' ? <Badge tone="success">In scope</Badge> : v === 'N' ? <Badge tone="neutral">Out</Badge> : <span className="text-ink-300">—</span>}
                  />
                </td>
                <td className="text-[12.5px]"><InlineText value={e.rationale} onCommit={v => patch(e.id, { rationale: v })} /></td>
                <td>
                  <button onClick={() => del(e.id)} className="p-1 rounded text-ink-500 hover:text-danger hover:bg-canvas dark:hover:bg-navy-800">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
