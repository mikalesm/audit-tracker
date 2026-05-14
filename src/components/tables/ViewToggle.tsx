'use client';
import * as React from 'react';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ListView = 'cards' | 'table';

/**
 * Toggle between "Cards" (explanation-first, default for new users) and
 * "Table" (dense, power-user). Persists per-surface in localStorage.
 *
 * Use `useViewMode(storageKey, default?)` to consume; pair with this button
 * for the visual UI.
 */
export function useViewMode(storageKey: string, defaultMode: ListView = 'cards'): [
  ListView,
  (v: ListView) => void,
] {
  const [mode, setMode] = React.useState<ListView>(defaultMode);
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(`viewmode:${storageKey}`);
      if (v === 'cards' || v === 'table') setMode(v);
    } catch {}
  }, [storageKey]);
  const set = React.useCallback((v: ListView) => {
    setMode(v);
    try { localStorage.setItem(`viewmode:${storageKey}`, v); } catch {}
  }, [storageKey]);
  return [mode, set];
}

export default function ViewToggle({
  mode,
  onChange,
  className,
}: {
  mode: ListView;
  onChange: (v: ListView) => void;
  className?: string;
}) {
  return (
    <div className={cn(
      'inline-flex items-center rounded-md border border-rule dark:border-navy-700 p-0.5',
      className,
    )}>
      <button
        onClick={() => onChange('cards')}
        className={cn(
          'px-2 h-7 inline-flex items-center gap-1 text-[12px] rounded transition-colors',
          mode === 'cards'
            ? 'bg-navy-50 text-navy-800 font-medium dark:bg-navy-800 dark:text-slate-100'
            : 'text-ink-500 hover:text-ink-900 dark:hover:text-slate-100',
        )}
        title="Card view — easier to scan, includes context"
      >
        <LayoutGrid className="w-3 h-3" /> Cards
      </button>
      <button
        onClick={() => onChange('table')}
        className={cn(
          'px-2 h-7 inline-flex items-center gap-1 text-[12px] rounded transition-colors',
          mode === 'table'
            ? 'bg-navy-50 text-navy-800 font-medium dark:bg-navy-800 dark:text-slate-100'
            : 'text-ink-500 hover:text-ink-900 dark:hover:text-slate-100',
        )}
        title="Table view — dense, for power users"
      >
        <Rows3 className="w-3 h-3" /> Table
      </button>
    </div>
  );
}
