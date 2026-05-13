import type { Metadata } from 'next';
import './globals.css';
import Shell from '@/components/shell/Shell';
import ClientSessionProvider from '@/components/shell/SessionProvider';
import { getSettings } from '@/lib/repository/settings';
import { ensureSchema } from '@/lib/bootstrap';
import { getActor } from '@/lib/rbac';
import type { EngagementSettings } from '@/types';

export const metadata: Metadata = {
  title: 'IT Audit — PBC Tracker',
  description: 'Engagement workspace for IT audit, SOC 2 readiness, licensing and IT spend',
};

export const dynamic = 'force-dynamic';

const PLACEHOLDER_SETTINGS: EngagementSettings = {
  clientName: 'Audit Tracker',
  auditPeriod: '',
  leadAuditor: '',
  sponsor: '',
  projectTitle: 'IT Audit — PBC Tracker',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();
  // Settings are per-engagement now. When the actor has no selected engagement
  // (sign-in page, /engagements list, /engagements/new), fall back to a
  // generic header.
  let settings = PLACEHOLDER_SETTINGS;
  try {
    const actor = await getActor();
    if (actor?.engagement) {
      settings = await getSettings(actor.engagement.id);
    }
  } catch {
    // ensureSchema may have failed; render a bare shell anyway so /signin still works.
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}` }} />
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>
        <ClientSessionProvider>
          <Shell settings={settings}>{children}</Shell>
        </ClientSessionProvider>
      </body>
    </html>
  );
}
