'use client';
import * as React from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Quiet, collapsible "what is this page?" strip at the top of a list surface
 * (PBC, walkthroughs, access, entities, sampling). Collapsed by default so it
 * never competes with the data; one click reveals the explainer. The
 * open/closed choice is remembered per-surface in localStorage.
 *
 * The richer `HelpPanel` is the step-by-step variant used on the dashboards.
 */
export default function HelpStrip({
  title,
  children,
  storageKey,
  tone = 'muted',
  className,
}: {
  title: string;
  children: React.ReactNode;
  /** localStorage key under `helpstrip:` — picks up where the user left off. */
  storageKey: string;
  tone?: 'info' | 'muted';
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      // Migrate the old `1 = dismissed` value to the new collapsed default.
      const v = localStorage.getItem(`helpstrip:${storageKey}`);
      if (v === 'open') setOpen(true);
    } catch {}
  }, [storageKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(`helpstrip:${storageKey}`, next ? 'open' : 'closed'); } catch {}
  }

  return (
    <div className={cn(
      'rounded-lg border border-rule bg-surface dark:bg-navy-900 dark:border-navy-700',
      tone === 'info' && open && 'border-navy-200 dark:border-navy-700',
      className,
    )}>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3.5 py-2 text-left group"
        aria-expanded={open}
      >
        <HelpCircle className="w-3.5 h-3.5 shrink-0 text-ink-300 group-hover:text-ink-500 dark:text-slate-500" />
        <span className="text-[12px] font-medium text-ink-700 dark:text-slate-300">{title}</span>
        {!open && (
          <span className="text-[12px] text-ink-300 dark:text-slate-500 hidden sm:inline">— quick explainer</span>
        )}
        <ChevronDown className={cn(
          'w-3.5 h-3.5 ml-auto shrink-0 text-ink-300 transition-transform',
          open && 'rotate-180',
        )} />
      </button>
      {open && (
        <div className="px-3.5 pb-3 pl-9 text-[12px] text-ink-500 dark:text-slate-400 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
