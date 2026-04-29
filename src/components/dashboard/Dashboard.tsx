'use client';
import * as React from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/badge';
import KPIStrip from './KPIStrip';
import CategoryBars from './CategoryBars';
import PriorityDonut from './PriorityDonut';
import { Download, FileText, Printer, ExternalLink, Building2 } from 'lucide-react';
import { formatDate, formatDateTime, relativeTime } from '@/lib/utils';
import type { EngagementSettings, Entity } from '@/types';
import { useEntityFilter } from '@/components/shell/state';
import { Badge } from '@/components/ui/badge';

interface DashboardData {
  kpi: {
    total: number; received: number; inProgress: number; outstanding: number;
    pctComplete: number; outstandingHighPriority: number;
  };
  categoryStatus: { category: string; status: string; count: number }[];
  priorityCounts: { priority: string; count: number }[];
  receivedTrend: { day: string; count: number }[];
  overdue: { id: number; num: number; category: string; item: string; priority: string; dateRequested: string; status: string }[];
  recentActivity: { id: number; field: string; oldValue: string | null; newValue: string | null; ts: string; num: number; title: string; pbcId: number }[];
  upcoming: { id: number; num: number; process_area: string; proposed_date: string; duration_min: number | null; status: string }[];
  entityScope: { inScope: number; total: number };
}

export default function Dashboard({ settings }: { settings: EngagementSettings }) {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const { entity, entities } = useEntityFilter();
  const selectedEntity: Entity | null = React.useMemo(
    () => entity ? entities.find(e => (e.legalEntity || `Entity #${e.num}`) === entity) ?? null : null,
    [entity, entities]
  );

  React.useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
  }, []);

  if (!data) {
    return (
      <div className="px-6 py-6 grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[100px] skeleton" />)}
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Engagement overview</h1>
          <p className="text-[12.5px] text-ink-500 dark:text-slate-400 mt-0.5">
            {settings.clientName} · {settings.auditPeriod} · Lead: {settings.leadAuditor}
          </p>
        </div>
        <div className="flex items-center gap-1.5 no-print">
          <Link href="/reports"><Button variant="secondary" size="sm"><FileText className="w-3.5 h-3.5" /> Export PDF</Button></Link>
          <a href="/api/export"><Button variant="secondary" size="sm"><Download className="w-3.5 h-3.5" /> Export Excel</Button></a>
          <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="w-3.5 h-3.5" /> Print</Button>
        </div>
      </div>

      {/* Entity scope panel — only when an entity filter is active */}
      {selectedEntity && (
        <Card className="mb-4">
          <CardBody className="!py-4">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded bg-navy-50 dark:bg-navy-800 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-navy-700 dark:text-navy-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">Entity scope</span>
                  {selectedEntity.inScope === 'Y' && <Badge tone="success">In scope</Badge>}
                  {selectedEntity.inScope === 'N' && <Badge tone="neutral">Out of scope</Badge>}
                </div>
                <div className="text-[15px] font-semibold tracking-tight">{selectedEntity.legalEntity || `Entity #${selectedEntity.num}`}</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 mt-3 text-[12.5px]">
                  <Field label="Country" value={selectedEntity.countryLocation} />
                  <Field label="IT Model" value={selectedEntity.itModel} />
                  <Field label="Hosting" value={selectedEntity.hosting} />
                  <Field label="Headcount" value={selectedEntity.headcount === null ? null : String(selectedEntity.headcount)} />
                  <div className="col-span-2 lg:col-span-4">
                    <Field label="Key applications" value={selectedEntity.keyApplications} />
                  </div>
                  {selectedEntity.rationale && (
                    <div className="col-span-2 lg:col-span-4">
                      <Field label="Scope rationale" value={selectedEntity.rationale} />
                    </div>
                  )}
                </div>
              </div>
              <Link href="/entities" className="text-[11.5px] text-navy-700 dark:text-navy-300 hover:underline shrink-0 inline-flex items-center gap-0.5">
                Manage <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {/* KPI strip */}
      <KPIStrip kpi={data.kpi} trend={data.receivedTrend} entityScope={data.entityScope} />

      {/* Two-column layout */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-12 lg:col-span-7">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Status by Category</CardTitle>
                <span className="text-[11px] text-ink-500">Sorted by % outstanding</span>
              </div>
            </CardHeader>
            <CardBody>
              <CategoryBars data={data.categoryStatus} />
            </CardBody>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status by Priority</CardTitle>
            </CardHeader>
            <CardBody>
              <PriorityDonut data={data.priorityCounts} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent activity</CardTitle>
                <Link href="/pbc" className="text-[11px] text-navy-700 dark:text-navy-300 hover:underline inline-flex items-center gap-0.5">View all <ExternalLink className="w-3 h-3" /></Link>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto -mt-1">
                {data.recentActivity.length === 0 && <p className="text-[12px] text-ink-500">No activity yet.</p>}
                {data.recentActivity.map(a => (
                  <Link href={`/pbc?id=${a.pbcId}`} key={a.id} className="block px-2 -mx-2 py-1.5 rounded hover:bg-canvas dark:hover:bg-navy-800">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10.5px] tabular text-ink-500 shrink-0 w-[70px]">{relativeTime(a.ts)}</span>
                      <span className="text-[11px] text-ink-500 shrink-0">#{a.num}</span>
                      <span className="text-[12.5px] truncate flex-1">{a.title.slice(0, 80)}</span>
                    </div>
                    <div className="text-[11px] text-ink-500 ml-[78px]">
                      {a.field}{a.newValue && <>: <span className="text-ink-700 dark:text-slate-300">{a.newValue}</span></>}
                    </div>
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Renewals & deadlines + Coming up */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-12 lg:col-span-7">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Overdue (requested {'>'} 7 days, not received)</CardTitle>
                <span className="text-[11px] text-ink-500">{data.overdue.length} item{data.overdue.length === 1 ? '' : 's'}</span>
              </div>
            </CardHeader>
            <CardBody>
              {data.overdue.length === 0 ? (
                <p className="text-[12.5px] text-ink-500">Nothing overdue. Nice.</p>
              ) : (
                <div className="space-y-1">
                  {data.overdue.slice(0, 8).map(o => (
                    <Link key={o.id} href={`/pbc?id=${o.id}`} className="flex items-center gap-3 px-2 -mx-2 py-1.5 rounded hover:bg-canvas dark:hover:bg-navy-800">
                      <span className="text-[11px] tabular text-ink-500 shrink-0 w-[36px]">#{o.num}</span>
                      <span className="text-[11px] text-ink-500 shrink-0 w-[120px] truncate">{o.category}</span>
                      <span className="text-[12.5px] truncate flex-1">{o.item}</span>
                      <span className="text-[11px] text-danger tabular shrink-0">requested {formatDate(o.dateRequested)}</span>
                      <StatusPill status={o.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="col-span-12 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Coming up — walkthroughs (next 14 days)</CardTitle>
            </CardHeader>
            <CardBody>
              {data.upcoming.length === 0 ? (
                <p className="text-[12.5px] text-ink-500">No walkthroughs scheduled. <Link href="/walkthroughs" className="text-navy-700 dark:text-navy-300 hover:underline">Schedule one →</Link></p>
              ) : (
                <div className="space-y-1.5">
                  {data.upcoming.map(u => (
                    <div key={u.id} className="flex items-center gap-3 text-[12.5px]">
                      <span className="text-ink-500 tabular w-[80px]">{formatDate(u.proposed_date)}</span>
                      <span className="flex-1 truncate">{u.process_area}</span>
                      {u.duration_min && <span className="text-ink-500 text-[11px]">{u.duration_min}m</span>}
                      <StatusPill status={u.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">{label}</div>
      <div className="text-ink-900 dark:text-slate-100 mt-0.5">{value || '—'}</div>
    </div>
  );
}
