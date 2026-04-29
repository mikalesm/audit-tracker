'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

const STATUS_COLORS: Record<string, string> = {
  'Received': '#548235',
  'Reviewed': '#3a5c25',
  'In Progress': '#BF8F00',
  'Requested': '#5687b0',
  'Not Started': '#cbd5e1',
  'N/A': '#94a3b8',
};

const STATUS_ORDER = ['Reviewed', 'Received', 'In Progress', 'Requested', 'Not Started', 'N/A'];

export default function CategoryBars({ data }: {
  data: { category: string; status: string; count: number }[];
}) {
  const router = useRouter();
  function go(category: string, status?: string) {
    const qs = new URLSearchParams();
    qs.set('category', category);
    if (status) qs.set('status', status);
    router.push(`/pbc?${qs.toString()}`);
  }
  const grouped = React.useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const r of data) {
      if (!map.has(r.category)) map.set(r.category, {});
      map.get(r.category)![r.status] = r.count;
    }
    const arr = Array.from(map.entries()).map(([cat, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const received = (counts['Received'] || 0) + (counts['Reviewed'] || 0);
      const outstanding = total - received - (counts['N/A'] || 0);
      const pctOutstanding = total === 0 ? 0 : outstanding / Math.max(total - (counts['N/A'] || 0), 1);
      return { category: cat, counts, total, received, outstanding, pctOutstanding };
    });
    arr.sort((a, b) => b.pctOutstanding - a.pctOutstanding);
    return arr;
  }, [data]);

  if (grouped.length === 0) {
    return <p className="text-[12.5px] text-ink-500">No data yet.</p>;
  }

  return (
    <div className="space-y-2">
      {grouped.map(g => (
        <div key={g.category} className="grid grid-cols-12 gap-3 items-center text-[12.5px]">
          <div className="col-span-4 truncate text-ink-700 dark:text-slate-300">
            <button onClick={() => go(g.category)} className="hover:text-navy-700 dark:hover:text-navy-300 text-left truncate w-full">
              {g.category}
            </button>
          </div>
          <div className="col-span-7">
            <div className="flex h-[18px] rounded overflow-hidden bg-canvas dark:bg-navy-800">
              {STATUS_ORDER.map(s => {
                const v = g.counts[s] || 0;
                if (v === 0) return null;
                const w = (v / g.total) * 100;
                return (
                  <button
                    key={s}
                    title={`${g.category} · ${s}: ${v} — click to filter`}
                    onClick={() => go(g.category, s)}
                    style={{ width: `${w}%`, backgroundColor: STATUS_COLORS[s] }}
                    className="h-full transition-opacity hover:opacity-80 cursor-pointer"
                  />
                );
              })}
            </div>
          </div>
          <div className="col-span-1 text-right tabular text-ink-500 text-[11px]">
            {g.received}/{g.total}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 pt-3 mt-2 border-t border-rule dark:border-navy-800 text-[10.5px] text-ink-500">
        {STATUS_ORDER.map(s => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS[s] }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
