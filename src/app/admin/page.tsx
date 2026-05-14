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

  const [allEngagements, users] = await Promise.all([
    listAllEngagementsWithCounts({ kind: 'all' }),
    listUsers(),
  ]);
  const engagements = allEngagements.filter(e => !e.isTemplate);
  const templates = allEngagements.filter(e => e.isTemplate);
  const activeCount = engagements.filter(e => e.status === 'active').length;
  const closedCount = engagements.filter(e => e.status === 'closed').length;
  const archivedCount = engagements.filter(e => e.status === 'archived').length;
  const platformAdminCount = users.filter(u => u.systemRole === 'platform_admin').length;
  const activeUserCount = users.filter(u => u.isActive).length;

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
            <AdminTab href="/admin" label="Overview" active />
            <AdminTab href="/admin/engagements" label="Engagements" />
            <AdminTab href="/admin/templates" label="Templates" />
            <AdminTab href="/admin/users" label="Users" />
          </nav>
          <div className="ml-auto text-[12px] text-ink-500 dark:text-slate-400">{actor.email}</div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          <h1 className="text-[20px] font-semibold tracking-tight mb-6">Platform overview</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Stat label="Active engagements"   value={activeCount} hint="Client audits in progress" />
            <Stat label="Closed engagements"   value={closedCount} hint="Finished, kept for retention" />
            <Stat label="Archived engagements" value={archivedCount} hint="Read-only history" />
            <Stat label="Templates"            value={templates.length} hint="Reusable PBC lists for new audits" />
            <Stat label="Total users"          value={users.length} hint={`${activeUserCount} active`} />
            <Stat label="Platform admins"      value={platformAdminCount} hint="Can create engagements + manage users" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NavCard
              href="/admin/engagements"
              title="Engagements"
              body="Every client audit. Change status (active → closed → archived). Add yourself as auditor_lead to one without leaving the admin pages."
            />
            <NavCard
              href="/admin/templates"
              title="Templates"
              body="The standard PBC list. Edit a template (open it like a normal engagement) and Re-sync from Excel. New audits pick a template to start pre-populated."
            />
            <NavCard
              href="/admin/users"
              title="Users"
              body="Grant or revoke platform_admin. Deactivate a user across all engagements at once. (Per-engagement roles live on each engagement's Members page.)"
            />
          </div>

          <div className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg p-5 mt-6">
            <div className="text-[12.5px] font-semibold tracking-tight mb-2">Storage isolation</div>
            <p className="text-[11.5px] text-ink-500 dark:text-slate-400 leading-relaxed mb-3">
              Each engagement has its own dedicated Azure Blob container named
              {' '}<code className="text-[11px]">evidence-eng-&lt;id&gt;</code>. The container name is derived from the engagement&apos;s database id and is immutable; the application code path cannot mix evidence across containers. See <code className="text-[11px]">docs/ISOLATION.md</code> for the full contract.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-3">
              {allEngagements.slice(0, 12).map(e => (
                <div key={e.id} className="flex items-center justify-between text-[11.5px] font-mono">
                  <span className="truncate">evidence-eng-{e.id}</span>
                  <span className="text-ink-500 dark:text-slate-400 ml-3 truncate">→ {e.slug}{e.isTemplate ? ' (template)' : ''}</span>
                </div>
              ))}
              {allEngagements.length > 12 && (
                <div className="text-[11px] text-ink-500 dark:text-slate-400 col-span-2">
                  …and {allEngagements.length - 12} more. Full list on the Engagements / Templates tabs.
                </div>
              )}
            </div>
          </div>

          <p className="text-[11.5px] text-ink-500 dark:text-slate-400 mt-6">
            Membership isolation: every API request re-validates membership against engagement_memberships. Cookies alone never grant access. Even platform_admin must be a member to view an engagement&apos;s data.
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
