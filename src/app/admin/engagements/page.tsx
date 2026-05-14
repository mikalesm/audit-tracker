import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getActor } from '@/lib/rbac';
import { listAllEngagementsWithCounts, listEngagementsForUser } from '@/lib/repository/engagements';
import AdminEngagementsTable from './AdminEngagementsTable';

export const dynamic = 'force-dynamic';

export default async function AdminEngagementsPage() {
  const actor = await getActor();
  if (!actor) redirect('/signin?callbackUrl=/admin/engagements');
  if (actor.systemRole !== 'platform_admin') redirect('/engagements');

  const [engagements, myEngagements] = await Promise.all([
    listAllEngagementsWithCounts(),
    listEngagementsForUser(actor.userId),
  ]);
  const myIds = new Set(myEngagements.map(e => e.id));

  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-navy-950">
      <header className="border-b border-rule dark:border-navy-800 bg-white dark:bg-navy-950">
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-navy-700 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold tracking-tight">IT</span>
            </div>
            <div className="text-[13px] font-semibold tracking-tight">Audit Tracker · admin</div>
          </Link>
          <nav className="flex items-center gap-1 ml-6">
            <AdminTab href="/admin" label="Overview" />
            <AdminTab href="/admin/engagements" label="Engagements" active />
            <AdminTab href="/admin/templates" label="Templates" />
            <AdminTab href="/admin/users" label="Users" />
          </nav>
          <div className="ml-auto text-[12px] text-ink-500 dark:text-slate-400">{actor.email}</div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-[20px] font-semibold tracking-tight">All engagements</h1>
            <Link
              href="/engagements/new"
              className="px-3 h-8 inline-flex items-center rounded bg-navy-700 text-white text-[13px] hover:bg-navy-800"
            >
              + New audit
            </Link>
          </div>
          <p className="text-[12px] text-ink-500 dark:text-slate-400 mb-4">
            Each row is an engagement. Members listed here include every role; the count is the total. PBC items count is per-engagement.
          </p>
          <AdminEngagementsTable
            initial={engagements.map(e => ({ ...e, isMember: myIds.has(e.id) }))}
          />
        </div>
      </main>
    </div>
  );
}

function AdminTab({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 h-7 inline-flex items-center rounded text-[12.5px] ${
        active ? 'bg-navy-50 text-navy-800 font-medium dark:bg-navy-800 dark:text-slate-100'
               : 'text-ink-700 dark:text-slate-300 hover:bg-canvas dark:hover:bg-navy-900'
      }`}
    >
      {label}
    </Link>
  );
}
