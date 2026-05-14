import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getActor } from '@/lib/rbac';
import { getEngagementBySlug, listEngagementMembers, getMembership } from '@/lib/repository/engagements';
import MembersTable from './MembersTable';

export const dynamic = 'force-dynamic';

export default async function MembersPage({ params }: { params: { slug: string } }) {
  const actor = await getActor();
  if (!actor) redirect(`/signin?callbackUrl=/engagements/${params.slug}/members`);

  const eng = await getEngagementBySlug(params.slug);
  if (!eng) redirect('/engagements');

  const myMembership = await getMembership(eng.id, actor.userId);
  const canManage = actor.systemRole === 'platform_admin' || myMembership?.role === 'auditor_lead';
  if (!myMembership && actor.systemRole !== 'platform_admin') redirect('/engagements');

  const members = await listEngagementMembers(eng.id);

  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-navy-950">
      <header className="border-b border-rule dark:border-navy-800 bg-white dark:bg-navy-950">
        <div className="max-w-[920px] mx-auto px-6 h-14 flex items-center gap-4">
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
        <div className="max-w-[920px] mx-auto px-6 py-10">
          <Link href="/engagements" className="text-[12px] text-ink-500 hover:underline">← All engagements</Link>
          <h1 className="text-[20px] font-semibold tracking-tight mt-3">{eng.name}</h1>
          <div className="text-[12.5px] text-ink-500 dark:text-slate-400 mb-6">
            {eng.clientName}{eng.fiscalYear ? ` · ${eng.fiscalYear}` : ''} · members
          </div>
          <MembersTable
            slug={eng.slug}
            initialMembers={members}
            currentUserId={actor.userId}
            canManage={canManage}
          />
        </div>
      </main>
    </div>
  );
}
