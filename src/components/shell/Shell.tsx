'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EngagementSettings } from '@/types';
import GlobalSearch from './GlobalSearch';
import KeyboardShortcuts from './KeyboardShortcuts';
import ThemeToggle from './ThemeToggle';
import EntityFilter from './EntityFilter';
import UserMenu from './UserMenu';
import { EntityFilterProvider } from './state';

type Role = 'auditor_lead' | 'auditor' | 'client_owner' | 'client_reviewer';

interface NavItem {
  href: string;
  label: string;
  shortcut: string;
  minRole: Role;
  /** Tooltip shown on the link itself. */
  hint: string;
}

interface NavGroup {
  label: string;
  /** Tooltip shown on the group label. */
  description: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    description: 'Day-to-day work — the live requests, sessions, and access list.',
    items: [
      { href: '/',             label: 'Dashboard',    shortcut: 'g d', minRole: 'client_reviewer', hint: 'Engagement overview & progress' },
      { href: '/pbc',          label: 'PBC List',     shortcut: 'g p', minRole: 'client_reviewer', hint: 'Provided-By-Client evidence requests' },
      { href: '/walkthroughs', label: 'Walkthroughs', shortcut: 'g w', minRole: 'client_reviewer', hint: 'Working sessions to observe controls' },
      { href: '/access',       label: 'Access',       shortcut: 'g a', minRole: 'client_reviewer', hint: 'Read-only access we need in client systems' },
    ],
  },
  {
    label: 'Scope',
    description: "What's being audited — the entities and controls in play.",
    items: [
      { href: '/entities', label: 'Entities', shortcut: 'g e', minRole: 'client_reviewer', hint: 'Legal entities in/out of scope and the rationale' },
      { href: '/sampling', label: 'Sampling', shortcut: 'g s', minRole: 'client_reviewer', hint: 'Controls being tested, populations, samples' },
    ],
  },
  {
    label: 'Audit',
    description: 'Audit-team records that clients do not see.',
    items: [
      { href: '/activity', label: 'Activity', shortcut: 'g t', minRole: 'auditor', hint: 'Audit-team activity log' },
      { href: '/reports',  label: 'Reports',  shortcut: 'g r', minRole: 'auditor', hint: 'Export the PBC tracker, evidence, and findings' },
    ],
  },
];

// Engagement settings live in the account menu rather than the primary nav:
// they're audit-lead-only and low-frequency, so they don't earn a top-level slot.

const ROLE_RANK: Record<Role, number> = {
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
  currentRole: Role | null;
  currentEngagement: Engagement | null;
}

interface SectionCounts {
  pbc: number;
  walkthroughs: number;
  access: number;
  entities: number;
  sampling: number;
}

// Nav items that should disappear when the engagement has zero rows in their
// section. Always-visible items (Dashboard, PBC List, Activity, Reports) are
// not in this map.
const SECTION_OF_PATH: Record<string, keyof SectionCounts> = {
  '/walkthroughs': 'walkthroughs',
  '/access': 'access',
  '/entities': 'entities',
  '/sampling': 'sampling',
};

export default function Shell({ settings, children }: { settings: EngagementSettings; children: React.ReactNode }) {
  const pathname = usePathname();
  // Render bare chrome on screens that own their own layout: sign-in, the
  // engagement picker and its sub-pages, and the platform admin pages.
  if (pathname === '/signin'
    || pathname === '/engagements'
    || pathname.startsWith('/engagements/')
    || pathname === '/admin'
    || pathname.startsWith('/admin/')) return <>{children}</>;

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
  const [sectionCounts, setSectionCounts] = React.useState<SectionCounts | null>(null);
  const [authConfigured, setAuthConfigured] = React.useState(true);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/me').then(async r => {
      if (r.status === 401) { setMe(null); setAuthConfigured(true); return; }
      const data = await r.json();
      setMe(data.user);
      setEngagements(data.engagements || []);
      setSectionCounts(data.sectionCounts ?? null);
      if (data.user?.currentEngagement === null && (data.engagements?.length ?? 0) > 0) {
        router.replace('/engagements');
      }
    }).catch(() => { setAuthConfigured(false); setMe(null); });
  }, [pathname, router]);

  // Close mobile drawer on every navigation.
  React.useEffect(() => { setMobileNavOpen(false); }, [pathname]);

  const role: Role = (me?.currentRole as Role) ?? (authConfigured ? 'client_reviewer' : 'auditor_lead');
  const currentEng = me?.currentEngagement ?? null;

  // Filter groups by role and by per-engagement section presence; drop groups
  // that become empty. Until sectionCounts loads we show role-allowed items —
  // nothing flickers in/out for users with all sections present.
  const visibleGroups = React.useMemo(
    () => NAV_GROUPS
      .map(g => ({ ...g, items: g.items.filter(i => {
        if (ROLE_RANK[role] < ROLE_RANK[i.minRole]) return false;
        const section = SECTION_OF_PATH[i.href];
        if (section && sectionCounts && sectionCounts[section] === 0) return false;
        return true;
      }) }))
      .filter(g => g.items.length > 0),
    [role, sectionCounts]
  );

  async function switchTo(slug: string) {
    await fetch(`/api/engagements/${slug}/switch`, { method: 'POST' });
    setSwitcherOpen(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:bg-navy-950/95 dark:supports-[backdrop-filter]:bg-navy-950/80 border-b border-rule dark:border-navy-800">
        <div className="px-4 md:px-6 h-14 flex items-center gap-3">
          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileNavOpen(o => !o)}
            className="md:hidden p-2 -ml-1 rounded-md hover:bg-canvas dark:hover:bg-navy-900"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <Link href="/" className="flex items-center gap-2.5 shrink-0 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/carpa-tech-logo.png"
              alt="Carpa Tech"
              className="w-7 h-7 rounded-md object-contain shrink-0 dark:bg-white/5 dark:p-0.5"
            />
            <div className="leading-tight min-w-0 max-w-[220px] hidden sm:block">
              <div className="text-[13px] font-semibold tracking-tight truncate">
                {currentEng?.name ?? settings.projectTitle}
              </div>
              <div className="text-[10.5px] text-ink-500 dark:text-slate-400 truncate">
                {currentEng
                  ? `${currentEng.clientName}${currentEng.fiscalYear ? ' · ' + currentEng.fiscalYear : ''}`
                  : `${settings.clientName}${settings.auditPeriod ? ' · ' + settings.auditPeriod : ''}`}
              </div>
            </div>
          </Link>

          {/* Engagement switcher (only when there are multiple memberships or actor is platform_admin) */}
          {(engagements.length > 1 || me?.systemRole === 'platform_admin') && (
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen(o => !o)}
                className="px-2.5 h-8 inline-flex items-center gap-1 rounded-md text-[12px] font-medium text-ink-500 border border-rule hover:bg-canvas hover:text-ink-900 dark:hover:bg-navy-900 dark:text-slate-400 dark:border-navy-700"
              >
                Switch <ChevronDown className="w-3 h-3" />
              </button>
              {switcherOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-72 bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-pop z-50">
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
                      <>
                        <Link
                          href="/engagements/new"
                          onClick={() => setSwitcherOpen(false)}
                          className="block px-2 py-1.5 rounded text-[12px] hover:bg-canvas dark:hover:bg-navy-800 font-medium"
                        >
                          + New audit
                        </Link>
                        <Link
                          href="/admin"
                          onClick={() => setSwitcherOpen(false)}
                          className="block px-2 py-1.5 rounded text-[12px] hover:bg-canvas dark:hover:bg-navy-800"
                        >
                          Platform admin →
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grouped nav (desktop only) */}
          <nav className="hidden md:flex items-center gap-0 ml-2 min-w-0 flex-1 overflow-hidden">
            {visibleGroups.map((g, gi) => (
              <React.Fragment key={g.label}>
                {gi > 0 && <span className="mx-1.5 h-5 w-px bg-rule dark:bg-navy-700 shrink-0" aria-hidden />}
                <div className="flex items-center gap-0.5 shrink-0" title={g.description}>
                  {g.items.map(item => {
                    const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.hint}
                        className={cn(
                          'px-2.5 h-8 inline-flex items-center rounded-md text-[13px] transition-colors whitespace-nowrap',
                          active
                            ? 'bg-navy-50 text-navy-800 font-semibold dark:bg-navy-800 dark:text-slate-100'
                            : 'text-ink-700 hover:bg-canvas hover:text-ink-900 dark:text-slate-300 dark:hover:bg-navy-900'
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </React.Fragment>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 shrink-0 pl-2">
            <div className="hidden wide:flex items-center gap-2">
              <EntityFilter />
              <GlobalSearch />
            </div>
            <ThemeToggle />
            {authConfigured && <UserMenu user={me ? { email: me.email, role: me.currentRole ?? '' } : null} />}
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-rule dark:border-navy-800 bg-white dark:bg-navy-950">
            <div className="px-4 py-3 space-y-3">
              {visibleGroups.map(g => (
                <div key={g.label}>
                  <div className="mb-1">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">
                      {g.label}
                    </div>
                    <div className="text-[10.5px] text-ink-500 dark:text-slate-400 leading-snug">
                      {g.description}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {g.items.map(item => {
                      const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'px-2 py-1.5 rounded text-[13px]',
                            active
                              ? 'bg-navy-50 text-navy-800 font-medium dark:bg-navy-800 dark:text-slate-100'
                              : 'text-ink-700 hover:bg-canvas dark:text-slate-300 dark:hover:bg-navy-900'
                          )}
                        >
                          <div>{item.label}</div>
                          <div className="text-[10px] text-ink-500 dark:text-slate-400 leading-tight mt-0.5">
                            {item.hint}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="border-t border-rule dark:border-navy-800 pt-3 flex items-center gap-2">
                <EntityFilter />
                <GlobalSearch />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 min-w-0">{children}</main>
      <KeyboardShortcuts />
    </div>
  );
}
