'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A labelled block used inside detail panels to make each "request" surface
 * explain itself. The label sits in the gutter at the top in small-caps; the
 * caption (if present) sits underneath as a tooltip-style hint about what the
 * block is for. Children render the actual content/editor.
 */
export default function ContextSection({
  label,
  caption,
  audience,
  className,
  children,
}: {
  label: string;
  caption?: string;
  /** If set, renders a small chip indicating who sees this content. */
  audience?: 'client' | 'internal' | 'both';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <h3 className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">
          {label}
        </h3>
        {audience && <AudienceChip audience={audience} />}
      </div>
      {caption && (
        <p className="text-[11.5px] text-ink-500 dark:text-slate-400 leading-snug">{caption}</p>
      )}
      <div>{children}</div>
    </section>
  );
}

function AudienceChip({ audience }: { audience: 'client' | 'internal' | 'both' }) {
  if (audience === 'client') {
    return (
      <span className="px-1.5 py-px text-[9.5px] uppercase tracking-wider rounded bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 border border-blue-200 dark:border-blue-900">
        Client sees this
      </span>
    );
  }
  if (audience === 'internal') {
    return (
      <span className="px-1.5 py-px text-[9.5px] uppercase tracking-wider rounded bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
        Internal only
      </span>
    );
  }
  return (
    <span className="px-1.5 py-px text-[9.5px] uppercase tracking-wider rounded bg-canvas text-ink-500 dark:bg-navy-800 dark:text-slate-400 border border-rule dark:border-navy-700">
      Shared
    </span>
  );
}
