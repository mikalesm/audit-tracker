'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A labelled block used inside detail panels. The label is a calm sentence-case
 * title; children render the actual content/editor. Client-visible content is
 * the default in this shared dataroom, so only the *exception* — content the
 * client must NOT see — is flagged, via the `audience="internal"` marker.
 */
export default function ContextSection({
  label,
  audience,
  className,
  children,
}: {
  label: string;
  /** Only `'internal'` renders a marker; `'client'`/`'both'` are the silent default. */
  audience?: 'client' | 'internal' | 'both';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <h3 className="text-[12px] font-semibold text-ink-700 dark:text-slate-300">
          {label}
        </h3>
        {audience === 'internal' && <InternalMarker />}
      </div>
      <div>{children}</div>
    </section>
  );
}

function InternalMarker() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
      Audit team only
    </span>
  );
}
