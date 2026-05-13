import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getActor } from '@/lib/rbac';
import NewTemplateForm from './NewTemplateForm';

export const dynamic = 'force-dynamic';

export default async function NewTemplatePage() {
  const actor = await getActor();
  if (!actor) redirect('/signin?callbackUrl=/admin/templates/new');
  if (actor.systemRole !== 'platform_admin') redirect('/engagements');

  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-navy-950">
      <header className="border-b border-rule dark:border-navy-800 bg-white dark:bg-navy-950">
        <div className="max-w-[720px] mx-auto px-6 h-12 flex items-center gap-4">
          <Link href="/admin/templates" className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-navy-700 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold tracking-tight">IT</span>
            </div>
            <div className="text-[13px] font-semibold tracking-tight">Audit Tracker · admin</div>
          </Link>
          <div className="ml-auto text-[12px] text-ink-500 dark:text-slate-400">{actor.email}</div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-[720px] mx-auto px-6 py-10">
          <Link href="/admin/templates" className="text-[12px] text-ink-500 hover:underline">← All templates</Link>
          <h1 className="text-[20px] font-semibold tracking-tight mt-3 mb-1">Create a template</h1>
          <p className="text-[12.5px] text-ink-500 dark:text-slate-400 mb-6">
            A template is a special engagement that holds your standard PBC list. After creating, you&apos;ll be auto-added as auditor_lead and switched into it. Use Settings → Re-sync from Excel to import your standard workbook (the same one you&apos;d normally upload per-client).
          </p>
          <NewTemplateForm />
        </div>
      </main>
    </div>
  );
}
