import Dashboard from '@/components/dashboard/Dashboard';
import { getSettings } from '@/lib/repository/settings';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const settings = await getSettings();
  return <Dashboard settings={settings} />;
}
