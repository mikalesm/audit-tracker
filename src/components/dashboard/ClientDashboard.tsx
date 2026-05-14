'use client';
import * as React from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/badge';
import { Upload, CalendarDays, Clock, AlertTriangle, ArrowRight, ChevronDown, Flame } from 'lucide-react';
import { formatDate, relativeTime } from '@/lib/utils';
import HelpPanel from './HelpPanel';
import type { EngagementSettings } from '@/types';

interface DashboardData {
  kpi: {
    total: number; received: number; inProgress: number; outstanding: number;
    pctComplete: number;
  };
  overdue: { id: number; num: number; category: string; item: string; priority: string; dateRequested: string; status: string }[];
  upcoming: { id: number; num: number; process_area: string; proposed_date: string; duration_min: number | null; status: string }[];
}

interface OwnedItem {
  id: number;
  num: number;
  category: string;
  itemRequested: string;
  status: string;
  priority: string;
  ownerClient: string | null;
  dateRequested: string | null;
}

/**
 * The dashboard a client_owner / client_reviewer sees. Action-oriented:
 * what's expected of them, where to put it, what's coming up.
 *
 * Auditors continue to use the analytical Dashboard component.
 */
export default function ClientDashboard({
  settings,
  actorEmail,
  actorRole,
}: {
  settings: EngagementSettings;
  actorEmail: string;
  actorRole: 'client_owner' | 'client_reviewer';
}) {
  const [pbc, setPbc] = React.useState<OwnedItem[] | null>(null);
  const [data, setData] = React.useState<DashboardData | null>(null);

  React.useEffect(() => {
    Promise.all([
      fetch('/api/pbc').then(r => r.ok ? r.json() : []),
      fetch('/api/dashboard').then(r => r.ok ? r.json() : null),
    ]).then(([items, dash]) => {
      setPbc(items as OwnedItem[]);
      setData(dash);
    });
  }, []);

  // "Yours" = owner_client roughly matches the actor's email local-part or full email.
  const emailLocal = actorEmail.split('@')[0].toLowerCase();
  const isOwnedByActor = (owner: string | null) => {
    if (!owner) return false;
    const o = owner.toLowerCase();
    return o.includes(emailLocal) || o.includes(actorEmail.toLowerCase());
  };

  const isOutstanding = (status: string) => !['Received', 'Reviewed', 'N/A'].includes(status);

  const owned = (pbc || []).filter(i => isOwnedByActor(i.ownerClient));
  const ownedReceived = owned.filter(i => i.status === 'Received' || i.status === 'Reviewed');
  const allOutstanding = (pbc || []).filter(i => isOutstanding(i.status));

  // When the auditor has explicitly assigned items to this client, focus on
  // those. Otherwise (common early in an engagement) fall back to everything
  // the audit team is still waiting on — a useful dashboard from day one.
  const hasAssignments = owned.length > 0;
  const toProvide = hasAssignments
    ? owned.filter(i => isOutstanding(i.status))
    : allOutstanding;

  const overdueToShow = hasAssignments
    ? (data?.overdue || []).filter(o => owned.some(x => x.id === o.id))
    : (data?.overdue || []);

  const canUpload = actorRole === 'client_owner';

  // Group the items-to-provide by category so the client sees the shape of the
  // work — ~10 progress-bearing sections — instead of one 55-row scroll.
  const byCategory = React.useMemo(() => {
    const groups = new Map<string, { items: OwnedItem[]; total: number; provided: number; high: number }>();
    for (const it of toProvide) {
      let g = groups.get(it.category);
      if (!g) { g = { items: [], total: 0, provided: 0, high: 0 }; groups.set(it.category, g); }
      g.items.push(it);
      if (it.priority === 'High') g.high++;
    }
    for (const it of pbc || []) {
      const g = groups.get(it.category);
      if (!g) continue;
      g.total++;
      if (it.status === 'Received' || it.status === 'Reviewed') g.provided++;
    }
    return Array.from(groups.entries()).map(([category, g]) => ({ category, ...g }));
  }, [pbc, toProvide]);

  // Highest-priority items to provide — surfaced as a "start here" focus band.
  const topPriority = React.useMemo(() => {
    const rank: Record<string, number> = {
      'High': 0, 'Medium-High': 1, 'Medium': 2, 'Low-Medium': 3, 'Low': 4,
    };
    return [...toProvide]
      .sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || a.num - b.num)
      .slice(0, 6);
  }, [toProvide]);

  // `openCats === null` until the first interaction; until then the first
  // category is expanded so the panel never opens as a wall of just headers.
  const [openCats, setOpenCats] = React.useState<Set<string> | null>(null);
  const effectiveOpen = openCats ?? new Set(byCategory.slice(0, 1).map(c => c.category));
  function toggleCat(c: string) {
    const next = new Set(effectiveOpen);
    if (next.has(c)) next.delete(c); else next.add(c);
    setOpenCats(next);
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Welcome to your audit workspace</h1>
        <p className="text-[13px] text-ink-500 dark:text-slate-400 mt-0.5">
          {settings.clientName} · {settings.auditPeriod}
          {settings.leadAuditor && <> · Audit lead: {settings.leadAuditor}</>}
        </p>
      </div>

      {/* Overall progress — the at-a-glance summary leads the dashboard */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-navy-700 dark:text-navy-300" />
                Overall progress
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Items total" value={data.kpi.total} />
              <Stat label="Provided" value={data.kpi.received} tone="positive" />
              <Stat label="In progress" value={data.kpi.inProgress} />
              <Stat label="Not started" value={data.kpi.outstanding - data.kpi.inProgress} tone={data.kpi.outstanding > data.kpi.total / 2 ? 'warning' : 'neutral'} />
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11.5px] text-ink-500 dark:text-slate-400 mb-1">
                <span>{data.kpi.pctComplete}% complete across the engagement</span>
                <span>{data.kpi.received} of {data.kpi.total}</span>
              </div>
              <div className="h-2 rounded-full bg-canvas dark:bg-navy-900 overflow-hidden">
                <div
                  className="h-full bg-navy-700 dark:bg-navy-300 transition-all"
                  style={{ width: `${data.kpi.pctComplete}%` }}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <HelpPanel
        title="How this works"
        storageKey="client-dashboard-howto"
      >
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            <strong>The auditor adds requests</strong> to the <Link href="/pbc" className="underline">PBC List</Link> — each row is one piece of evidence we need from you.
          </li>
          {canUpload ? (
            <li>
              <strong>You upload the evidence</strong> by clicking an item to open its detail panel and dropping a file in the Evidence tab. Set the <em>Status</em> to <em>In Progress</em> while you&apos;re gathering, then <em>Received</em> once you&apos;ve uploaded.
            </li>
          ) : (
            <li>
              <strong>Track what&apos;s been provided</strong> here. You don&apos;t have edit rights on this engagement — talk to your colleague with the &quot;Contributor&quot; role if something needs to be uploaded.
            </li>
          )}
          <li>
            <strong>The auditor reviews</strong> and marks items <em>Reviewed</em>. Anything they need clarification on, they&apos;ll add as a note on the item.
          </li>
          <li>
            <strong>Walkthroughs are working sessions</strong> — see the <Link href="/walkthroughs" className="underline">Walkthroughs page</Link> for what&apos;s scheduled with you.
          </li>
        </ol>
      </HelpPanel>

      {/* "Start here" — vibrant focus band on the highest-priority requests */}
      {pbc !== null && topPriority.length > 0 && (
        <div className="rounded-xl bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 p-5 text-white shadow-card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-400/20 ring-1 ring-amber-300/30">
                <Flame className="w-4 h-4 text-amber-300" />
              </span>
              <div>
                <h2 className="text-[14px] font-semibold tracking-tight">Start here</h2>
                <p className="text-[11.5px] text-navy-200">
                  Your highest-priority requests — tackle these first
                </p>
              </div>
            </div>
            <Link href="/pbc" className="text-[12px] text-navy-100 hover:text-white shrink-0">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {topPriority.map(item => (
              <Link
                key={item.id}
                href={`/pbc?id=${item.id}`}
                className="group rounded-lg bg-white/10 hover:bg-white/[0.16] ring-1 ring-white/15 p-3 transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`text-[9.5px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                    item.priority === 'High'
                      ? 'bg-amber-400 text-navy-900'
                      : 'bg-white/20 text-white'
                  }`}>
                    {item.priority}
                  </span>
                  <span className="text-[10.5px] text-navy-200 font-mono">#{item.num}</span>
                </div>
                <div className="text-[12.5px] font-medium leading-snug line-clamp-2 mb-2">
                  {item.itemRequested}
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-navy-200">
                  <span className="truncate">{item.category}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* "What's expected of you" */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Upload className="w-4 h-4 text-navy-700 dark:text-navy-300" />
              {canUpload ? 'What you need to upload' : 'Outstanding items'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          {pbc === null ? (
            <div className="h-24 skeleton" />
          ) : toProvide.length === 0 ? (
            <EmptyState
              title="You're all caught up — nice."
              body={hasAssignments
                ? `You've completed ${ownedReceived.length} of ${owned.length} items assigned to you.`
                : 'Every request has been provided. The audit team will reach out if they need anything else.'}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[12px] text-ink-500 dark:text-slate-400">
                  {hasAssignments
                    ? `${toProvide.length} item${toProvide.length === 1 ? '' : 's'} still to provide, across ${byCategory.length} area${byCategory.length === 1 ? '' : 's'}.`
                    : `Nothing's assigned to you by name yet — here's everything the audit team is waiting on, by area.`}
                </p>
                <Link href="/pbc" className="text-[12px] text-navy-700 dark:text-navy-200 hover:underline shrink-0">
                  Open full list →
                </Link>
              </div>
              <div className="space-y-2">
                {byCategory.map(g => (
                  <CategoryGroup
                    key={g.category}
                    category={g.category}
                    items={g.items}
                    total={g.total}
                    provided={g.provided}
                    high={g.high}
                    open={effectiveOpen.has(g.category)}
                    onToggle={() => toggleCat(g.category)}
                  />
                ))}
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Overdue strip (only when relevant) */}
      {overdueToShow.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                Overdue ({overdueToShow.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-[12.5px] text-ink-700 dark:text-slate-300 mb-3">
              These items are more than a week past the requested date. Please prioritise.
            </div>
            <div className="divide-y divide-rule dark:divide-navy-800">
              {overdueToShow.slice(0, 5).map(o => (
                <Link key={o.id} href={`/pbc?id=${o.id}`} className="py-2 flex items-center gap-3 -mx-2 px-2 rounded hover:bg-canvas/60 dark:hover:bg-navy-900">
                  <span className="text-[10.5px] font-mono text-ink-500 dark:text-slate-400 w-10">#{o.num}</span>
                  <span className="flex-1 truncate text-[12.5px]">{o.item}</span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-300">
                    Requested {relativeTime(o.dateRequested)}
                  </span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Upcoming walkthroughs */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-navy-700 dark:text-navy-300" />
              Upcoming walkthroughs
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          {data === null ? (
            <div className="h-16 skeleton" />
          ) : data.upcoming.length === 0 ? (
            <EmptyState
              title="No walkthroughs scheduled"
              body="Walkthroughs are working sessions with the auditor. None are on the calendar yet."
            />
          ) : (
            <div className="divide-y divide-rule dark:divide-navy-800">
              {data.upcoming.slice(0, 6).map(w => (
                <Link
                  key={w.id}
                  href="/walkthroughs"
                  className="py-2.5 flex items-center gap-3 hover:bg-canvas/60 dark:hover:bg-navy-900 -mx-3 px-3 rounded"
                >
                  <span className="text-[10.5px] font-mono text-ink-500 dark:text-slate-400 w-10 shrink-0">#{w.num}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{w.process_area}</div>
                    <div className="text-[11px] text-ink-500 dark:text-slate-400 mt-0.5">
                      {formatDate(w.proposed_date)}
                      {w.duration_min && <> · {w.duration_min} min</>}
                    </div>
                  </div>
                  <StatusPill status={w.status} />
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

    </div>
  );
}

function CategoryGroup({ category, items, total, provided, high, open, onToggle }: {
  category: string;
  items: OwnedItem[];
  total: number;
  provided: number;
  high: number;
  open: boolean;
  onToggle: () => void;
}) {
  const pct = total > 0 ? Math.round((provided / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-rule dark:border-navy-800 overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-canvas/60 dark:hover:bg-navy-900 transition-colors"
      >
        <ChevronDown className={`w-4 h-4 text-ink-300 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
        <span className="text-[13px] font-semibold tracking-tight flex-1 min-w-0 truncate">{category}</span>
        {high > 0 && (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-700 dark:text-amber-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden /> {high} high
          </span>
        )}
        <span className="text-[11px] text-ink-500 dark:text-slate-400 tabular shrink-0">
          {items.length} to provide
        </span>
        <div className="hidden sm:flex items-center gap-2 shrink-0 w-[124px]">
          <div className="h-1.5 flex-1 rounded-full bg-canvas dark:bg-navy-900 overflow-hidden">
            <div className="h-full bg-navy-600 dark:bg-navy-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10.5px] text-ink-500 dark:text-slate-400 tabular w-9 text-right">{provided}/{total}</span>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-rule dark:divide-navy-800 border-t border-rule dark:border-navy-800">
          {items.map(item => (
            <Link
              key={item.id}
              href={`/pbc?id=${item.id}`}
              className="py-2.5 px-3 flex items-center gap-3 hover:bg-canvas/60 dark:hover:bg-navy-900"
            >
              <span className="text-[10.5px] uppercase tracking-wider text-ink-500 dark:text-slate-400 font-mono shrink-0 w-10">
                #{item.num}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{item.itemRequested}</div>
                {item.dateRequested && (
                  <div className="text-[11px] text-ink-500 dark:text-slate-400 mt-0.5">
                    requested {formatDate(item.dateRequested)}
                  </div>
                )}
              </div>
              <StatusPill status={item.status} />
              <ArrowRight className="w-3.5 h-3.5 text-ink-500 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center py-6 px-4">
      <div className="text-[13px] font-medium">{title}</div>
      <div className="text-[12px] text-ink-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{body}</div>
    </div>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'positive' | 'warning' }) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-700 dark:text-emerald-300'
    : tone === 'warning' ? 'text-amber-700 dark:text-amber-300'
    : 'text-ink-900 dark:text-slate-100';
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">{label}</div>
      <div className={`text-[24px] font-semibold tracking-tight mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
