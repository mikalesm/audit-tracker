'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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

interface Engagement {
  id: number; slug: string; name: string; clientName: string; fiscalYear: string | null;
}
interface EngagementForUser extends Engagement { role: string }
interface Me {
  userId: number;
  email: string;
  systemRole: 'platform_admin' | 'member';
  currentRole: string | null;
  currentEngagement: Engagement | null;
}

export default function Shell({ settings, children }: { settings: EngagementSettings; children: React.ReactNode }) {
  const pathname = usePathname();
  // Render bare chrome on the sign-in page, the engagement picker, and the
  // new-engagement form. Those screens own their own layout.
  if (pathname === '/signin'
    || pathname === '/engagements'
    || pathname.startsWith('/engagements/')) return <>{children}</>;

  return (
    <EntityFilterProvider>
      <ShellInner settings={settings}>{children}</ShellInner>
    </EntityFilterProvider>
  );
}

function ShellInner({ settings, children }: { settings: EngagementSettings; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = React.useState<Me | null>(null);
  const [engagements, setEngagements] = React.useState<EngagementForUser[]>([]);
  const [authConfigured, setAuthConfigured] = React.useState(true);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/me').then(async r => {
      if (r.status === 401) { setMe(null); setAuthConfigured(true); return; }
      const data = await r.json();
      setMe(data.user);
      setEngagements(data.engagements || []);
      // If the actor has memberships but no engagement is selected, send them
      // to the picker. Lets clients still poke at the auth-unconfigured demo.
      if (data.user?.currentEngagement === null && (data.engagements?.length ?? 0) > 0) {
        router.replace('/engagements');
      }
    }).catch(() => { setAuthConfigured(false); setMe(null); });
  }, [pathname, router]);

  const role = me?.currentRole ?? (authConfigured ? 'client_reviewer' : 'auditor_lead');
  const currentEng = me?.currentEngagement ?? null;

  async function switchTo(slug: string) {
    await fetch(`/api/engagements/${slug}/switch`, { method: 'POST' });
    setSwitcherOpen(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print sticky top-0 z-40 bg-white dark:bg-navy-950 border-b border-rule dark:border-navy-800">
        <div className="px-6 h-12 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-6 h-6 rounded bg-navy-700 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold tracking-tight">IT</span>
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-tight">
                {currentEng?.name ?? settings.projectTitle}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-slate-400">
                {currentEng
                  ? `${currentEng.clientName}${currentEng.fiscalYear ? ' · ' + currentEng.fiscalYear : ''}`
                  : `${settings.clientName}${settings.auditPeriod ? ' · ' + settings.auditPeriod : ''}`}
              </div>
            </div>
          </Link>

          {/* Engagement switcher */}
          {engagements.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen(o => !o)}
                className="px-2 h-7 inline-flex items-center gap-1 rounded text-[12px] text-ink-500 hover:bg-canvas dark:hover:bg-navy-900 dark:text-slate-400"
              >
                Switch ▾
              </button>
              {switcherOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded shadow-lg z-50">
                  <div className="p-2 max-h-80 overflow-auto">
                    {engagements.map(e => (
                      <button
                        key={e.id}
                        onClick={() => switchTo(e.slug)}
                        className={cn(
                          'w-full text-left px-2 py-1.5 rounded text-[12.5px] hover:bg-canvas dark:hover:bg-navy-800',
                          e.slug === currentEng?.slug && 'bg-navy-50 dark:bg-navy-800 font-medium'
                        )}
                      >
                        <div>{e.name}</div>
                        <div className="text-[10.5px] text-ink-500 dark:text-slate-400 uppercase tracking-wider">
                          {e.clientName} · {e.role}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-rule dark:border-navy-700 p-1">
                    <Link
                      href="/engagements"
                      onClick={() => setSwitcherOpen(false)}
                      className="block px-2 py-1.5 rounded text-[12px] hover:bg-canvas dark:hover:bg-navy-800"
                    >
                      View all engagements
                    </Link>
                    {me?.systemRole === 'platform_admin' && (
                      <Link
                        href="/engagements/new"
                        onClick={() => setSwitcherOpen(false)}
                        className="block px-2 py-1.5 rounded text-[12px] hover:bg-canvas dark:hover:bg-navy-800 font-medium"
                      >
                        + New audit
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
            {authConfigured && <UserMenu user={me ? { userId: me.userId, email: me.email, role: me.currentRole ?? '' } : null} />}
          </div>
        </div>
      </header>
      <main className="flex-1 min-w-0">{children}</main>
      <KeyboardShortcuts />
    </div>
  );
}
