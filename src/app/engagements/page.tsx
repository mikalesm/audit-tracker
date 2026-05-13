import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getActor } from '@/lib/rbac';
import { listEngagementsForUser } from '@/lib/repository/engagements';
import EngagementSwitchButton from './EngagementSwitchButton';

export const dynamic = 'force-dynamic';

export default async function EngagementsPage() {
  const actor = await getActor();
  if (!actor) redirect('/signin?callbackUrl=/engagements');

  const engagements = await listEngagementsForUser(actor.userId);
  const isPlatformAdmin = actor.systemRole === 'platform_admin';

  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-navy-950">
      <header className="border-b border-rule dark:border-navy-800 bg-white dark:bg-navy-950">
        <div className="max-w-[920px] mx-auto px-6 h-12 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-navy-700 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold tracking-tight">IT</span>
            </div>
            <div className="text-[13px] font-semibold tracking-tight">Audit Tracker</div>
          </div>
          <div className="ml-auto text-[12px] text-ink-500 dark:text-slate-400">
            {actor.email}{isPlatformAdmin ? ' · platform admin' : ''}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[920px] mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-[20px] font-semibold tracking-tight">Your engagements</h1>
            {isPlatformAdmin && (
              <Link
                href="/engagements/new"
                className="px-3 h-8 inline-flex items-center rounded bg-navy-700 text-white text-[13px] hover:bg-navy-800"
              >
                + New audit
              </Link>
            )}
          </div>

          {engagements.length === 0 ? (
            <div className="border border-rule dark:border-navy-700 rounded-lg p-8 bg-white dark:bg-navy-900">
              <p className="text-[13.5px] text-ink-700 dark:text-slate-300">
                You aren&apos;t a member of any engagement yet.
              </p>
              <p className="text-[12.5px] text-ink-500 dark:text-slate-400 mt-2">
                {isPlatformAdmin
                  ? 'Create one with the “+ New audit” button above.'
                  : 'Ask the audit lead to invite you by email.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {engagements.map((e) => (
                <div
                  key={e.id}
                  className="border border-rule dark:border-navy-700 rounded-lg p-4 bg-white dark:bg-navy-900 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold tracking-tight">{e.name}</div>
                    <div className="text-[12px] text-ink-500 dark:text-slate-400 mt-0.5">
                      {e.clientName}
                      {e.fiscalYear ? ` · ${e.fiscalYear}` : ''}
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-canvas dark:bg-navy-800 text-[10.5px] uppercase tracking-wider">{e.role}</span>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10.5px] uppercase tracking-wider ${
                        e.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : e.status === 'closed' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>{e.status}</span>
                    </div>
                  </div>
                  <EngagementSwitchButton slug={e.slug} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 text-[11.5px] text-ink-500 dark:text-slate-400">
            Each engagement is hard-isolated: separate database rows, separate Blob Storage container, separate access control. Members of one engagement cannot see another.
          </div>
        </div>
      </main>
    </div>
  );
}
