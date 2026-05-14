'use client';
import * as React from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, relativeTime, cn } from '@/lib/utils';

interface Entry {
  id: number; ts: string; entityType: string; entityId: number;
  field: string; oldValue: string | null; newValue: string | null;
  num: number | null; title: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  pbc: 'PBC item', access: 'Access', walkthrough: 'Walkthrough',
  entity: 'Entity', sampling: 'Sampling',
};

const TYPE_HREF: Record<string, (id: number) => string> = {
  pbc: id => `/pbc?id=${id}`,
  access: () => `/access`,
  walkthrough: () => `/walkthroughs`,
  entity: () => `/entities`,
  sampling: () => `/sampling`,
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export default function ActivityView() {
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [typeFilter, setTypeFilter] = React.useState<string>('');
  const [fieldFilter, setFieldFilter] = React.useState<string>('');

  React.useEffect(() => {
    fetch('/api/timeline').then(r => r.json()).then(d => { setEntries(d); setLoading(false); });
  }, []);

  const fields = React.useMemo(() =>
    Array.from(new Set(entries.map(e => e.field))).sort(),
  [entries]);

  const filtered = React.useMemo(() => {
    return entries.filter(e =>
      (!typeFilter || e.entityType === typeFilter) &&
      (!fieldFilter || e.field === fieldFilter)
    );
  }, [entries, typeFilter, fieldFilter]);

  const grouped = React.useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of filtered) {
      const k = dayKey(e.ts);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <div className="px-6 py-7 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[21px] font-semibold tracking-tight">Engagement timeline</h1>
          <p className="text-[12.5px] text-ink-500 dark:text-slate-400 mt-1">
            {filtered.length} of {entries.length} change{entries.length === 1 ? '' : 's'} across all entities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-rule-strong dark:border-navy-700 bg-white dark:bg-navy-900 px-2.5 text-[12.5px]">
            <option value="">All types</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={fieldFilter} onChange={e => setFieldFilter(e.target.value)}
            className="h-9 rounded-md border border-rule-strong dark:border-navy-700 bg-white dark:bg-navy-900 px-2.5 text-[12.5px]">
            <option value="">All fields</option>
            {fields.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="h-[300px] skeleton" />}

      {!loading && filtered.length === 0 && (
        <Card><CardBody>
          <p className="text-[12.5px] text-ink-500 text-center py-8">No activity yet. Edits to PBC items, walkthroughs, entities, and sampling will appear here.</p>
        </CardBody></Card>
      )}

      {!loading && grouped.map(([day, entries]) => (
        <div key={day} className="mb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">
              {new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="flex-1 h-px bg-rule dark:bg-navy-800" />
            <div className="text-[11px] text-ink-500 tabular">{entries.length} change{entries.length === 1 ? '' : 's'}</div>
          </div>
          <Card>
            <CardBody className="!pt-3 !pb-3">
              <div className="space-y-1">
                {entries.map(e => {
                  const href = TYPE_HREF[e.entityType]?.(e.entityId) ?? '/';
                  return (
                    <Link key={e.id} href={href} className="grid grid-cols-12 gap-3 items-baseline px-2 -mx-2 py-1.5 rounded text-[12.5px] hover:bg-canvas dark:hover:bg-navy-800">
                      <div className="col-span-2 text-ink-500 tabular">{relativeTime(e.ts)}</div>
                      <div className="col-span-1">
                        <Badge tone="neutral">{TYPE_LABEL[e.entityType] || e.entityType}</Badge>
                      </div>
                      <div className="col-span-4 truncate">
                        {e.num !== null && <span className="text-ink-500 mr-1">#{e.num}</span>}
                        <span>{e.title || '—'}</span>
                      </div>
                      <div className="col-span-5 text-ink-700 dark:text-slate-300 truncate">
                        <span className="font-medium">{e.field}</span>
                        {e.oldValue !== null && <span className="text-ink-500 line-through ml-2">{e.oldValue}</span>}
                        {e.newValue !== null && <span className="ml-2">→ {e.newValue}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>
      ))}
    </div>
  );
}
