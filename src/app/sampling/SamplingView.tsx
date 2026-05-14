'use client';
import * as React from 'react';
import type { SamplingItem } from '@/types';
import { TEST_STATUSES } from '@/lib/utils';
import { InlineSelect, InlineText } from '@/components/tables/InlineEdit';
import { StatusPill } from '@/components/ui/badge';
import { SavedFlash, useSaveIndicator } from '@/components/tables/SavedIndicator';
import { Calculator, Info } from 'lucide-react';
import HelpStrip from '@/components/ui/HelpStrip';

// AICPA-style sample size table (95% confidence, 5% tolerable rate, 0% expected) — auditor common reference.
const SAMPLE_TABLE: { population: number; sample: number }[] = [
  { population: 50, sample: 22 },
  { population: 100, sample: 27 },
  { population: 250, sample: 30 },
  { population: 500, sample: 30 },
  { population: 1000, sample: 30 },
  { population: 5000, sample: 30 },
  { population: 100000, sample: 30 },
];

function suggestedSample(pop: number | null): number | null {
  if (!pop || pop <= 0) return null;
  if (pop <= 30) return pop;
  for (const row of SAMPLE_TABLE) {
    if (pop <= row.population) return row.sample;
  }
  return 30;
}

export default function SamplingView() {
  const [items, setItems] = React.useState<SamplingItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { savedKey, flash } = useSaveIndicator();
  const [showHelper, setShowHelper] = React.useState(false);

  React.useEffect(() => { load(); }, []);
  async function load() { setItems(await (await fetch('/api/sampling')).json()); setLoading(false); }
  async function patch(id: number, p: Partial<SamplingItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...p } : i));
    const r = await fetch(`/api/sampling/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    if (r.ok) {
      const updated: SamplingItem = await r.json();
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      flash();
    }
  }

  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Sampling & Testing</h1>
          <p className="text-[12px] text-ink-500 dark:text-slate-400 mt-0.5">
            {items.length} controls · 95% confidence / 5% tolerable rate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SavedFlash savedKey={savedKey} />
          <button
            onClick={() => setShowHelper(s => !s)}
            className="inline-flex items-center gap-1 text-[12px] text-navy-700 dark:text-navy-300 hover:underline"
          >
            <Calculator className="w-3.5 h-3.5" /> Sample size table
          </button>
        </div>
      </div>

      <HelpStrip
        storageKey="sampling-list"
        title="How sampling works here"
      >
        Each row is one <strong>control</strong> we test. For each, we identify
        the <em>population</em> (e.g. all changes in the period), the
        <em>sample size</em> (use the calculator on the right for AICPA-style
        defaults), and the <em>method</em> (random, stratified, all). Update the
        status as testing progresses and capture findings in the last column.
      </HelpStrip>

      {showHelper && (
        <div className="rounded-lg border border-rule dark:border-navy-700 bg-canvas dark:bg-navy-900 p-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-ink-500 mt-0.5" />
            <div className="flex-1">
              <div className="text-[13px] font-medium mb-1">Suggested sample size (attribute sampling)</div>
              <p className="text-[11.5px] text-ink-500 mb-3">
                Common audit reference: 95% confidence, 5% tolerable deviation rate, 0% expected. Click "Suggest" in the row to populate.
              </p>
              <div className="grid grid-cols-7 gap-2 text-[11.5px]">
                {SAMPLE_TABLE.map(r => (
                  <div key={r.population} className="text-center px-2 py-1.5 bg-white dark:bg-navy-950 rounded border border-rule dark:border-navy-700">
                    <div className="text-ink-500 tabular">≤ {r.population.toLocaleString()}</div>
                    <div className="font-semibold tabular">{r.sample}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th className="min-w-[180px]">Control Area</th>
              <th className="min-w-[280px]">Description</th>
              <th className="min-w-[180px]">Population Source</th>
              <th className="w-[110px]">Pop. Size</th>
              <th className="w-[110px]">Sample Size</th>
              <th className="min-w-[160px]">Method</th>
              <th className="w-[110px]">Status</th>
              <th className="min-w-[200px]">Findings</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={9} className="p-0"><div className="h-[34px] mx-3 my-1 skeleton" /></td></tr>)}
            {!loading && items.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-[13px]">
                <div className="max-w-md mx-auto">
                  <div className="text-ink-700 dark:text-slate-300 font-medium">No sampling controls yet</div>
                  <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
                    Sampling controls are usually seeded from a template or imported via{' '}
                    <a href="/settings" className="text-navy-700 dark:text-navy-300 underline">Settings → Re-sync from Excel</a>.
                  </p>
                </div>
              </td></tr>
            )}
            {!loading && items.map(s => {
              const suggested = suggestedSample(s.populationSize);
              return (
                <tr key={s.id}>
                  <td className="text-ink-500 tabular">{s.num}</td>
                  <td className="text-[13px] font-medium">{s.controlArea}</td>
                  <td className="text-[12px] text-ink-700 dark:text-slate-300 max-w-[280px] line-clamp-2">{s.controlDescription}</td>
                  <td className="text-[12.5px] text-ink-700 dark:text-slate-300">{s.populationSource}</td>
                  <td className="tabular text-[12.5px]">
                    <InlineText
                      value={s.populationSize === null ? null : String(s.populationSize)}
                      onCommit={v => patch(s.id, { populationSize: v ? parseInt(v, 10) || null : null })}
                    />
                  </td>
                  <td className="tabular text-[12.5px]">
                    <div className="flex items-center gap-1">
                      <InlineText
                        value={s.sampleSize === null ? null : String(s.sampleSize)}
                        onCommit={v => patch(s.id, { sampleSize: v ? parseInt(v, 10) || null : null })}
                      />
                      {suggested && s.sampleSize !== suggested && (
                        <button
                          title={`Suggest: ${suggested}`}
                          onClick={() => patch(s.id, { sampleSize: suggested })}
                          className="text-[10px] px-1 py-0.5 rounded bg-canvas dark:bg-navy-800 text-ink-500 hover:text-navy-700 dark:hover:text-navy-300"
                        >
                          → {suggested}
                        </button>
                      )}
                    </div>
                  </td>
                  <td><InlineText value={s.samplingMethod} onCommit={v => patch(s.id, { samplingMethod: v ?? '' })} /></td>
                  <td>
                    <InlineSelect
                      value={s.testStatus} options={[...TEST_STATUSES]}
                      onCommit={v => patch(s.id, { testStatus: v as SamplingItem['testStatus'] })}
                      renderValue={v => <StatusPill status={v} />}
                    />
                  </td>
                  <td className="text-[12.5px]"><InlineText value={s.findingsSummary} onCommit={v => patch(s.id, { findingsSummary: v })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
