'use client';
import * as React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface KPI {
  total: number; received: number; inProgress: number; outstanding: number;
  pctComplete: number; outstandingHighPriority: number;
}

export default function KPIStrip({ kpi, trend, entityScope }: {
  kpi: KPI;
  trend: { day: string; count: number }[];
  entityScope: { inScope: number; total: number };
}) {
  const tiles = [
    { label: 'Total items', value: kpi.total, sub: `${entityScope.inScope}/${entityScope.total} entities in scope` },
    { label: 'Received', value: kpi.received, trend: true },
    { label: 'In progress', value: kpi.inProgress },
    { label: 'Outstanding', value: kpi.outstanding, danger: kpi.outstanding > kpi.total * 0.5 },
    { label: '% Complete', value: kpi.pctComplete, suffix: '%', ring: true },
    { label: 'Outstanding High', value: kpi.outstandingHighPriority, danger: kpi.outstandingHighPriority > 0 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map(t => (
        <Tile key={t.label} {...t} trendData={t.trend ? trend : undefined} />
      ))}
    </div>
  );
}

function Tile({ label, value, sub, trendData, danger, ring, suffix }: {
  label: string;
  value: number;
  sub?: string;
  trendData?: { day: string; count: number }[];
  danger?: boolean;
  ring?: boolean;
  suffix?: string;
}) {
  return (
    <div className={cn(
      'rounded-lg border bg-white dark:bg-navy-900 px-5 py-4 flex flex-col justify-between min-h-[100px]',
      'border-rule dark:border-navy-700',
      danger && 'border-red-200 bg-red-50/30 dark:bg-red-950/20 dark:border-red-900'
    )}>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">{label}</div>
      <div className="flex items-end justify-between gap-3 mt-2">
        <div className={cn(
          'kpi-num',
          danger ? 'text-danger' : 'text-ink-900 dark:text-slate-100'
        )}>
          {value}{suffix && <span className="text-[18px] text-ink-500 ml-0.5">{suffix}</span>}
        </div>
        {ring && <ProgressRing pct={value} />}
        {trendData && trendData.length > 1 && (
          <div className="w-[70px] h-[24px]">
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <Line type="monotone" dataKey="count" stroke="#1F4E78" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {sub && <div className="text-[11px] text-ink-500 mt-1.5">{sub}</div>}
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 14, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#E5E7EB" strokeWidth="2.5" className="dark:stroke-navy-800" />
      <circle
        cx="18" cy="18" r={r} fill="none"
        stroke="#1F4E78" strokeWidth="2.5"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}
