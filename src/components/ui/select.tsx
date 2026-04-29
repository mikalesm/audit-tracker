'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly string[] | string[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, options, placeholder, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-8 w-full rounded-md border border-rule bg-white px-2 text-[13px] text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 disabled:opacity-50 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-100',
        className
      )}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
);
Select.displayName = 'Select';
