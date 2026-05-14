import { redirect } from 'next/navigation';
import Dashboard from '@/components/dashboard/Dashboard';
import ClientDashboard from '@/components/dashboard/ClientDashboard';
import { getSettings } from '@/lib/repository/settings';
import { getActor } from '@/lib/rbac';
import { listEngagementsForUser } from '@/lib/repository/engagements';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const actor = await getActor();
  if (!actor) redirect('/signin');
  if (!actor.engagement) {
    const list = await listEngagementsForUser(actor.userId);
    if (list.length === 0) redirect('/engagements');
    if (list.length === 1) redirect('/engagements');
    redirect('/engagements');
  }
  const engagementId = actor.engagement.id;
  const settings = await withEngagement(engagementId, () => getSettings(engagementId));

  // Client roles get a guided dashboard. Auditors keep the analytical one.
  if (actor.role === 'client_owner' || actor.role === 'client_reviewer') {
    return (
      <ClientDashboard
        settings={settings}
        actorEmail={actor.email}
        actorRole={actor.role}
      />
    );
  }
  return <Dashboard settings={settings} />;
}

