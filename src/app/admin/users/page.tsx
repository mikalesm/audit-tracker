import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getActor } from '@/lib/rbac';
import { listUsers } from '@/lib/repository/users';
import AdminUsersTable from './AdminUsersTable';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const actor = await getActor();
  if (!actor) redirect('/signin?callbackUrl=/admin/users');
  if (actor.systemRole !== 'platform_admin') redirect('/engagements');

  const users = await listUsers();

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
            <AdminTab href="/admin/templates" label="Templates" />
            <AdminTab href="/admin/users" label="Users" active />
          </nav>
          <div className="ml-auto text-[12px] text-ink-500 dark:text-slate-400">{actor.email}</div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          <h1 className="text-[20px] font-semibold tracking-tight mb-1">Platform users</h1>
          <p className="text-[12px] text-ink-500 dark:text-slate-400 mb-4">
            Everyone who has signed in at least once. <strong>Platform admins</strong> can create engagements and manage users. <strong>Members</strong> are regular users — their per-engagement role lives on each engagement&apos;s Members page.
          </p>
          <AdminUsersTable initial={users} currentUserId={actor.userId} />
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
