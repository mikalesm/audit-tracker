'use client';
import * as React from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Collapsible inline help block. Default open, can be collapsed and the
 * choice is remembered in localStorage by `storageKey` so a returning user
 * isn't forced to dismiss it again.
 */
export default function HelpPanel({
  title,
  children,
  storageKey,
  defaultOpen = true,
  tone = 'info',
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
      'rounded-lg border',
      tone === 'info'
        ? 'border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-900'
        : 'border-rule bg-canvas dark:bg-navy-900 dark:border-navy-700'
    )}>
      <button
        type="button"
        onClick={toggle}
        className="w-full px-4 py-2.5 flex items-center gap-2 text-left"
      >
        <HelpCircle className={cn(
          'w-4 h-4 shrink-0',
          tone === 'info' ? 'text-blue-700 dark:text-blue-300' : 'text-ink-500'
        )} />
        <span className="text-[13px] font-medium tracking-tight flex-1">{title}</span>
        <ChevronDown className={cn('w-4 h-4 text-ink-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0.5 text-[12.5px] text-ink-700 dark:text-slate-300 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
