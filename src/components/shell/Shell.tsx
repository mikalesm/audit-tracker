'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { EngagementSettings } from '@/types';
import GlobalSearch from './GlobalSearch';
import KeyboardShortcuts from './KeyboardShortcuts';
import ThemeToggle from './ThemeToggle';
import EntityFilter from './EntityFilter';
import UserMenu from './UserMenu';
import { EntityFilterProvider } from './state';

const NAV = [
  { href: '/', label: 'Dashboard', shortcut: 'g d', minRole: 'client_reviewer' as const },
  { href: '/pbc', label: 'PBC List', shortcut: 'g p', minRole: 'client_reviewer' as const },
  { href: '/access', label: 'Access', shortcut: 'g a', minRole: 'client_reviewer' as const },
  { href: '/walkthroughs', label: 'Walkthroughs', shortcut: 'g w', minRole: 'client_reviewer' as const },
  { href: '/entities', label: 'Entities', shortcut: 'g e', minRole: 'client_reviewer' as const },
  { href: '/sampling', label: 'Sampling', shortcut: 'g s', minRole: 'client_reviewer' as const },
  { href: '/activity', label: 'Activity', shortcut: 'g t', minRole: 'auditor' as const },
  { href: '/reports', label: 'Reports', shortcut: 'g r', minRole: 'auditor' as const },
  { href: '/settings', label: 'Settings', shortcut: 'g ,', minRole: 'auditor_lead' as const },
];

const ROLE_RANK: Record<string, number> = {
  auditor_lead: 4, auditor: 3, client_owner: 2, client_reviewer: 1,
};

export default function Shell({ settings, children }: { settings: EngagementSettings; children: React.ReactNode }) {
  const pathname = usePathname();
  // Render bare chrome on the sign-in page.
  if (pathname === '/signin') return <>{children}</>;

  return (
    <EntityFilterProvider>
      <ShellInner settings={settings}>{children}</ShellInner>
    </EntityFilterProvider>
  );
}

function ShellInner({ settings, children }: { settings: EngagementSettings; children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = React.useState<{ userId: number; email: string; role: string } | null>(null);
  const [authConfigured, setAuthConfigured] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/me').then(async r => {
      if (r.status === 401) { setMe(null); setAuthConfigured(true); return; }
      const data = await r.json();
      setMe(data.user);
    }).catch(() => { setAuthConfigured(false); setMe(null); });
  }, [pathname]);

  const role = me?.role ?? 'auditor_lead'; // when auth is unconfigured, show everything

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print sticky top-0 z-40 bg-white dark:bg-navy-950 border-b border-rule dark:border-navy-800">
        <div className="px-6 h-12 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-6 h-6 rounded bg-navy-700 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold tracking-tight">IT</span>
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-tight">{settings.projectTitle}</div>
              <div className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-slate-400">
                {settings.clientName} · {settings.auditPeriod}
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-0.5 ml-4">
            {NAV
              .filter(n => ROLE_RANK[role] >= ROLE_RANK[n.minRole])
              .map(n => {
                const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={cn(
                      'px-3 h-7 inline-flex items-center rounded text-[13px] transition-colors',
                      active
                        ? 'bg-navy-50 text-navy-800 font-medium dark:bg-navy-800 dark:text-slate-100'
                        : 'text-ink-700 hover:bg-canvas dark:text-slate-300 dark:hover:bg-navy-900'
                    )}
                  >
                    {n.label}
                  </Link>
                );
              })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <EntityFilter />
            <GlobalSearch />
            <ThemeToggle />
            {authConfigured && <UserMenu user={me} />}
          </div>
        </div>
      </header>
      <main className="flex-1 min-w-0">{children}</main>
      <KeyboardShortcuts />
    </div>
  );
}
