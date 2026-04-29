'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_COLORS } from '@/lib/utils';

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const c = STATUS_COLORS[status] ?? { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' };
  return (
    <span className={cn(
      'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
      c.bg, c.text, c.ring,
      className
    )}>
      {status}
    </span>
  );
}

export function Badge({ children, className, tone = 'neutral' }: { children: React.ReactNode; className?: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'gold' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
    success: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    warning: 'bg-gold-100 text-gold-800 ring-gold-200',
    danger:  'bg-red-100 text-red-800 ring-red-200',
    gold:    'bg-gold-100 text-gold-800 ring-gold-200',
  };
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  );
}
