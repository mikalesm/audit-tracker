'use client';
import * as React from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/badge';
import { Upload, CalendarDays, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
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

  const owned = (pbc || []).filter(i => isOwnedByActor(i.ownerClient));
  const ownedOutstanding = owned.filter(i =>
    !['Received', 'Reviewed', 'N/A'].includes(i.status)
  );
  const ownedReceived = owned.filter(i => i.status === 'Received' || i.status === 'Reviewed');

  const overdueOwned = (data?.overdue || []).filter(o =>
    isOwnedByActor((owned.find(x => x.id === o.id) || {} as OwnedItem).ownerClient)
  );

  const canUpload = actorRole === 'client_owner';

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Welcome to your audit workspace</h1>
        <p className="text-[13px] text-ink-500 dark:text-slate-400 mt-0.5">
          {settings.clientName} · {settings.auditPeriod}
          {settings.leadAuditor && <> · Audit lead: {settings.leadAuditor}</>}
        </p>
      </div>

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
          ) : ownedOutstanding.length === 0 ? (
            <EmptyState
              title={owned.length === 0
                ? 'Nothing assigned to you yet'
                : 'You\'re all caught up — nice.'}
              body={owned.length === 0
                ? 'The auditor will assign items to you (by your email or name). They\'ll show up here when they do.'
                : `You've completed ${ownedReceived.length} of ${owned.length} items assigned to you.`}
            />
          ) : (
            <div className="divide-y divide-rule dark:divide-navy-800">
              {ownedOutstanding.slice(0, 12).map(item => (
                <Link
                  key={item.id}
                  href={`/pbc?id=${item.id}`}
                  className="py-2.5 flex items-center gap-3 hover:bg-canvas/60 dark:hover:bg-navy-900 -mx-3 px-3 rounded"
                >
                  <span className="text-[10.5px] uppercase tracking-wider text-ink-500 dark:text-slate-400 font-mono shrink-0 w-10">
                    #{item.num}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{item.itemRequested}</div>
                    <div className="text-[11px] text-ink-500 dark:text-slate-400 mt-0.5">
                      {item.category}
                      {item.dateRequested && <> · requested {formatDate(item.dateRequested)}</>}
                    </div>
                  </div>
                  <StatusPill status={item.status} />
                  <ArrowRight className="w-3.5 h-3.5 text-ink-500 shrink-0" />
                </Link>
              ))}
              {ownedOutstanding.length > 12 && (
                <Link
                  href="/pbc"
                  className="block py-2.5 text-center text-[12px] text-navy-700 dark:text-navy-200 hover:underline"
                >
                  Show all {ownedOutstanding.length} items →
                </Link>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Overdue strip (only when relevant) */}
      {overdueOwned.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                Overdue ({overdueOwned.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-[12.5px] text-ink-700 dark:text-slate-300 mb-3">
              These items are more than a week past the requested date. Please prioritise.
            </div>
            <div className="divide-y divide-rule dark:divide-navy-800">
              {overdueOwned.slice(0, 5).map(o => (
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

      {/* Compact overall progress */}
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
