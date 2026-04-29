import type { Metadata } from 'next';
import './globals.css';
import Shell from '@/components/shell/Shell';
import ClientSessionProvider from '@/components/shell/SessionProvider';
import { getSettings } from '@/lib/repository/settings';
import { ensureSchema } from '@/lib/bootstrap';

export const metadata: Metadata = {
  title: 'IT Audit — PBC Tracker',
  description: 'Engagement workspace for IT audit, SOC 2 readiness, licensing and IT spend',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();
  const settings = await getSettings();
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
