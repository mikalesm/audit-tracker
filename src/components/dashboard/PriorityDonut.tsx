'use client';
import * as React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS: Record<string, string> = {
  'High':        '#9C2A2A',
  'Medium-High': '#BF8F00',
  'Medium':      '#1F4E78',
  'Low-Medium':  '#5687b0',
  'Low':         '#cbd5e1',
};

const ORDER = ['High', 'Medium-High', 'Medium', 'Low-Medium', 'Low'];

export default function PriorityDonut({ data }: { data: { priority: string; count: number }[] }) {
  const sorted = ORDER
    .map(p => ({ name: p, value: data.find(d => d.priority === p)?.count || 0 }))
    .filter(d => d.value > 0);
  const total = sorted.reduce((a, b) => a + b.value, 0);

  if (total === 0) return <p className="text-[12.5px] text-ink-500">No data.</p>;

  return (
    <div className="flex items-center gap-5">
      <div className="w-[140px] h-[140px] relative shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={sorted} dataKey="value" innerRadius={45} outerRadius={65} stroke="none" isAnimationActive={false}>
              {sorted.map((d, i) => <Cell key={i} fill={COLORS[d.name]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[20px] font-semibold tabular leading-none">{total}</div>
          <div className="text-[9.5px] uppercase tracking-wider text-ink-500 mt-1">Items</div>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {sorted.map(d => (
          <div key={d.name} className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[d.name] }} />
            <span className="text-ink-700 dark:text-slate-300 flex-1">{d.name}</span>
            <span className="tabular text-ink-500">{d.value}</span>
            <span className="tabular text-ink-500 w-[36px] text-right">{Math.round(d.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
