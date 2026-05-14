'use client';
import * as React from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Slim "what is this page?" banner that sits at the top of a list surface
 * (PBC, walkthroughs, access, entities, sampling). Dismissible per-surface;
 * choice is remembered in localStorage so returning users aren't nagged.
 *
 * Use this on list views to give first-time users context without forcing
 * them to read a help page. The richer `HelpPanel` is the collapsible
 * step-by-step variant used on the dashboards.
 */
export default function HelpStrip({
  title,
  children,
  storageKey,
  tone = 'info',
  className,
}: {
  title: string;
  children: React.ReactNode;
  /** localStorage key under `helpstrip:` — picks up where the user left off. */
  storageKey: string;
  tone?: 'info' | 'muted';
  className?: string;
}) {
  const [dismissed, setDismissed] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const v = localStorage.getItem(`helpstrip:${storageKey}`);
      setDismissed(v === '1');
    } catch {}
    setReady(true);
  }, [storageKey]);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(`helpstrip:${storageKey}`, '1'); } catch {}
  }

  if (!ready || dismissed) return null;

  return (
    <div className={cn(
      'rounded-lg border px-4 py-3 flex items-start gap-3',
      tone === 'info'
        ? 'border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-900'
        : 'border-rule bg-canvas dark:bg-navy-900 dark:border-navy-700',
      className,
    )}>
      <HelpCircle className={cn(
        'w-4 h-4 mt-0.5 shrink-0',
        tone === 'info' ? 'text-blue-700 dark:text-blue-300' : 'text-ink-500'
      )} />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold tracking-tight leading-tight mb-0.5">{title}</div>
        <div className="text-[12px] text-ink-700 dark:text-slate-300 leading-relaxed">{children}</div>
      </div>
      <button
        onClick={dismiss}
        className="p-1 -mr-1 rounded hover:bg-white/60 dark:hover:bg-navy-800 text-ink-500"
        aria-label="Dismiss help"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
