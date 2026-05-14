import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getActor } from '@/lib/rbac';
import NewEngagementForm from './NewEngagementForm';

export const dynamic = 'force-dynamic';

export default async function NewEngagementPage() {
  const actor = await getActor();
  if (!actor) redirect('/signin?callbackUrl=/engagements/new');
  if (actor.systemRole !== 'platform_admin') redirect('/engagements');

  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-navy-950">
      <header className="border-b border-rule dark:border-navy-800 bg-white dark:bg-navy-950">
        <div className="max-w-[720px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/engagements" className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-navy-700 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold tracking-tight">IT</span>
            </div>
            <div className="text-[13px] font-semibold tracking-tight">Audit Tracker</div>
          </Link>
          <div className="ml-auto text-[12px] text-ink-500 dark:text-slate-400">{actor.email}</div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-[720px] mx-auto px-6 py-10">
          <Link href="/engagements" className="text-[12px] text-ink-500 hover:underline">← All engagements</Link>
          <h1 className="text-[20px] font-semibold tracking-tight mt-3 mb-1">Start a new audit</h1>
          <p className="text-[12.5px] text-ink-500 dark:text-slate-400 mb-6">
            Creates a hard-isolated workspace: separate database rows for every PBC item, walkthrough, evidence file; a separate Azure Blob container; per-engagement role assignments.
          </p>
          <NewEngagementForm />
        </div>
      </main>
    </div>
  );
}
