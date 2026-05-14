'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
    const variants = {
      primary: 'bg-navy-700 text-white shadow-sm hover:bg-navy-800 active:bg-navy-900',
      secondary: 'bg-white text-ink-900 border border-rule-strong shadow-card hover:bg-canvas hover:border-rule-strong dark:bg-navy-900 dark:text-slate-100 dark:border-navy-700 dark:shadow-none dark:hover:bg-navy-800',
      outline: 'border border-rule-strong bg-transparent text-ink-900 hover:bg-canvas dark:border-navy-700 dark:text-slate-100 dark:hover:bg-navy-800',
      ghost: 'bg-transparent text-ink-700 hover:bg-canvas hover:text-ink-900 dark:text-slate-300 dark:hover:bg-navy-800',
      danger: 'bg-danger text-white shadow-sm hover:bg-red-800 active:bg-red-900',
    };
    const sizes = {
      sm: 'h-8 px-2.5',
      md: 'h-9 px-3.5',
      lg: 'h-10 px-4',
      icon: 'h-9 w-9 p-0',
    };
    return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
  }
);
Button.displayName = 'Button';
