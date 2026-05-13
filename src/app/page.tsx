import { redirect } from 'next/navigation';
import Dashboard from '@/components/dashboard/Dashboard';
import { getSettings } from '@/lib/repository/settings';
import { getActor } from '@/lib/rbac';
import { listEngagementsForUser } from '@/lib/repository/engagements';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const actor = await getActor();
  if (!actor) redirect('/signin');
  if (!actor.engagement) {
    // No current engagement — bounce to the picker. If the user has exactly
    // one membership, the picker page auto-opens it; otherwise they choose.
    const list = await listEngagementsForUser(actor.userId);
    if (list.length === 0) redirect('/engagements'); // shows empty-state
    if (list.length === 1) redirect('/engagements');
    redirect('/engagements');
  }
  const settings = await getSettings(actor.engagement.id);
  return <Dashboard settings={settings} />;
}
