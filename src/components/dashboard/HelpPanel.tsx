'use client';
import * as React from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Collapsible inline help block. Collapsed by default to keep the surface
 * calm; the open/closed choice is remembered in localStorage by `storageKey`
 * so a returning user isn't forced to re-collapse it.
 */
export default function HelpPanel({
  title,
  children,
  storageKey,
  defaultOpen = false,
  tone = 'muted',
}: {
  title: string;
  children: React.ReactNode;
  storageKey?: string;
  defaultOpen?: boolean;
  tone?: 'info' | 'muted';
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const v = localStorage.getItem(`help:${storageKey}`);
      if (v === '0') setOpen(false);
      else if (v === '1') setOpen(true);
    } catch {}
  }, [storageKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (storageKey) {
      try { localStorage.setItem(`help:${storageKey}`, next ? '1' : '0'); } catch {}
    }
  }

  return (
    <div className={cn(
      'rounded-lg border border-rule bg-surface dark:bg-navy-900 dark:border-navy-700',
      tone === 'info' && open && 'border-navy-200 dark:border-navy-700',
    )}>
      <button
        type="button"
        onClick={toggle}
        className="w-full px-3.5 py-2 flex items-center gap-2 text-left group"
        aria-expanded={open}
      >
        <HelpCircle className="w-3.5 h-3.5 shrink-0 text-ink-300 group-hover:text-ink-500 dark:text-slate-500" />
        <span className="text-[12px] font-medium text-ink-700 dark:text-slate-300 flex-1">{title}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-ink-300 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-3.5 pb-3 pl-9 text-[12px] text-ink-500 dark:text-slate-400 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
