import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getActor } from '@/lib/rbac';
import { listAllEngagementsWithCounts, listEngagementsForUser } from '@/lib/repository/engagements';
import AdminTemplatesTable from './AdminTemplatesTable';

export const dynamic = 'force-dynamic';

export default async function AdminTemplatesPage() {
  const actor = await getActor();
  if (!actor) redirect('/signin?callbackUrl=/admin/templates');
  if (actor.systemRole !== 'platform_admin') redirect('/engagements');

  const [templates, mine] = await Promise.all([
    listAllEngagementsWithCounts({ kind: 'template' }),
    listEngagementsForUser(actor.userId),
  ]);
  const mineIds = new Set(mine.map(m => m.id));

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
            <AdminTab href="/admin" label="Overview" />
            <AdminTab href="/admin/engagements" label="Engagements" />
            <AdminTab href="/admin/templates" label="Templates" active />
            <AdminTab href="/admin/users" label="Users" />
          </nav>
          <div className="ml-auto text-[12px] text-ink-500 dark:text-slate-400">{actor.email}</div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-[20px] font-semibold tracking-tight">Engagement templates</h1>
            <Link
              href="/admin/templates/new"
              className="px-3 h-8 inline-flex items-center rounded bg-navy-700 text-white text-[13px] hover:bg-navy-800"
            >
              + New template
            </Link>
          </div>
          <p className="text-[12.5px] text-ink-500 dark:text-slate-400 mb-6">
            A template is a special engagement holding the standard PBC list, walkthroughs, sampling controls, and entity scope.
            When you create a new audit, you can pick a template and the new engagement is pre-populated with its rows. Per-client
            fields (status, dates, owner, notes, findings) are reset; the structural fields (category, item description, format, priority, TSC mapping) are copied as-is.
            <br /><br />
            To <strong>edit</strong> a template, click <strong>Open</strong> below. The template becomes your current engagement and
            you can use Settings → Re-sync from Excel to import or update its content. Templates are never shown in the regular engagement picker.
          </p>
          <AdminTemplatesTable
            initial={templates.map(t => ({ ...t, isMember: mineIds.has(t.id) }))}
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
