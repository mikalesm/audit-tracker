import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getActor } from '@/lib/rbac';
import { listAllEngagementsWithCounts } from '@/lib/repository/engagements';
import { listUsers } from '@/lib/repository/users';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const actor = await getActor();
  if (!actor) redirect('/signin?callbackUrl=/admin');
  if (actor.systemRole !== 'platform_admin') redirect('/engagements');

  const [engagements, users] = await Promise.all([
    listAllEngagementsWithCounts(),
    listUsers(),
  ]);
  const activeCount = engagements.filter(e => e.status === 'active').length;
  const closedCount = engagements.filter(e => e.status === 'closed').length;
  const archivedCount = engagements.filter(e => e.status === 'archived').length;
  const platformAdminCount = users.filter(u => u.systemRole === 'platform_admin').length;
  const activeUserCount = users.filter(u => u.isActive).length;

  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-navy-950">
      <header className="border-b border-rule dark:border-navy-800 bg-white dark:bg-navy-950">
        <div className="max-w-[1100px] mx-auto px-6 h-12 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-navy-700 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold tracking-tight">IT</span>
            </div>
            <div className="text-[13px] font-semibold tracking-tight">Audit Tracker · admin</div>
          </Link>
          <nav className="flex items-center gap-1 ml-6">
            <AdminTab href="/admin" label="Overview" active />
            <AdminTab href="/admin/engagements" label="Engagements" />
            <AdminTab href="/admin/users" label="Users" />
          </nav>
          <div className="ml-auto text-[12px] text-ink-500 dark:text-slate-400">{actor.email}</div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          <h1 className="text-[20px] font-semibold tracking-tight mb-6">Platform overview</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Stat label="Active engagements"   value={activeCount} hint="Audits in progress" />
            <Stat label="Closed engagements"   value={closedCount} hint="Finished, kept for retention" />
            <Stat label="Archived engagements" value={archivedCount} hint="Read-only history" />
            <Stat label="Total users"          value={users.length} hint={`${activeUserCount} active`} />
            <Stat label="Platform admins"      value={platformAdminCount} hint="Can create engagements + manage users" />
            <Stat label="This platform"        value={null}
              valueText={engagements.length === 0 ? 'Brand new' : `${engagements.reduce((a, e) => a + e.itemCount, 0)} PBC items across all audits`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NavCard
              href="/admin/engagements"
              title="Engagements"
              body="Browse every audit on the platform. Change status (active → closed → archived). Add yourself as auditor_lead to one without leaving the admin pages."
            />
            <NavCard
              href="/admin/users"
              title="Users"
              body="Grant or revoke platform_admin. Deactivate a user across all engagements at once. (Per-engagement roles are managed inside each engagement's Members page.)"
            />
          </div>

          <p className="text-[11.5px] text-ink-500 dark:text-slate-400 mt-8">
            Isolation guarantees: each engagement&apos;s data lives behind an explicit membership check on every API request. Even platform_admin must be added as a member to view an engagement&apos;s PBC items, evidence, or settings.
          </p>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, valueText, hint }: { label: string; value: number | null; valueText?: string; hint?: string }) {
  return (
    <div className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg p-4">
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">{label}</div>
      <div className="text-[28px] font-semibold tracking-tight mt-1">
        {value !== null ? value : <span className="text-[14px] font-normal text-ink-700 dark:text-slate-300">{valueText}</span>}
      </div>
      {hint && <div className="text-[11.5px] text-ink-500 dark:text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function NavCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="block bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg p-5 hover:border-navy-700 transition-colors"
    >
      <div className="text-[14px] font-semibold tracking-tight mb-1">{title} →</div>
      <p className="text-[12.5px] text-ink-700 dark:text-slate-300 leading-relaxed">{body}</p>
    </Link>
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
