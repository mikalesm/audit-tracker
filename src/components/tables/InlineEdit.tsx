'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export function InlineText({
  value, onCommit, placeholder, className, multiline,
}: {
  value: string | null;
  onCommit: (v: string | null) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? '');
  React.useEffect(() => { setDraft(value ?? ''); }, [value]);

  function commit() {
    setEditing(false);
    const next = draft.trim() === '' ? null : draft;
    if (next !== value) onCommit(next);
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { commit(); }
          }}
          className={cn(
            'w-full min-h-[60px] -mx-1 px-1 py-0.5 text-[13px] bg-white dark:bg-navy-900 border border-navy-400 rounded outline-none',
            className
          )}
        />
      );
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
          if (e.key === 'Enter') { commit(); }
        }}
        className={cn(
          'w-full -mx-1 px-1 h-[26px] text-[13px] bg-white dark:bg-navy-900 border border-navy-400 rounded outline-none',
          className
        )}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className={cn(
        'block cursor-text -mx-1 px-1 py-0 rounded hover:bg-canvas dark:hover:bg-navy-800 truncate',
        !value && 'text-ink-300 dark:text-slate-500',
        className
      )}
    >
      {value || placeholder || '—'}
    </span>
  );
}

export function InlineSelect({
  value, options, onCommit, className, renderValue,
}: {
  value: string;
  options: readonly string[] | string[];
  onCommit: (v: string) => void;
  className?: string;
  renderValue?: (v: string) => React.ReactNode;
}) {
  const [editing, setEditing] = React.useState(false);
  if (editing) {
    return (
      <select
        autoFocus
        value={value}
        onChange={e => { onCommit(e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
        className={cn(
          'w-full -mx-1 px-1 h-[26px] text-[13px] bg-white dark:bg-navy-900 border border-navy-400 rounded outline-none',
          className
        )}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className={cn('cursor-pointer block hover:bg-canvas/60 dark:hover:bg-navy-800/60 rounded -mx-0.5 px-0.5', className)}
    >
      {renderValue ? renderValue(value) : value}
    </span>
  );
}

export function InlineDate({
  value, onCommit, className,
}: {
  value: string | null;
  onCommit: (v: string | null) => void;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const dateStr = value ? value.slice(0, 10) : '';
  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={dateStr}
        onBlur={e => {
          setEditing(false);
          const next = e.target.value || null;
          if (next !== dateStr) onCommit(next);
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') setEditing(false);
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={cn(
          '-mx-1 px-1 h-[26px] text-[13px] bg-white dark:bg-navy-900 border border-navy-400 rounded outline-none',
          className
        )}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className={cn(
        'block cursor-text -mx-1 px-1 rounded hover:bg-canvas dark:hover:bg-navy-800',
        !value && 'text-ink-300 dark:text-slate-500',
        className
      )}
    >
      {dateStr || '—'}
    </span>
  );
}
