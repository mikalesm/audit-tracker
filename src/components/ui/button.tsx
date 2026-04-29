'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
    const variants = {
      primary: 'bg-navy-700 text-white hover:bg-navy-800',
      secondary: 'bg-white text-ink-900 border border-rule hover:bg-canvas dark:bg-navy-900 dark:text-slate-100 dark:border-navy-700 dark:hover:bg-navy-800',
      outline: 'border border-rule bg-transparent text-ink-900 hover:bg-canvas dark:border-navy-700 dark:text-slate-100 dark:hover:bg-navy-800',
      ghost: 'bg-transparent text-ink-700 hover:bg-canvas dark:text-slate-300 dark:hover:bg-navy-800',
      danger: 'bg-danger text-white hover:bg-red-800',
    };
    const sizes = {
      sm: 'h-7 px-2.5',
      md: 'h-8 px-3',
      lg: 'h-9 px-4',
      icon: 'h-8 w-8 p-0',
    };
    return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
  }
);
Button.displayName = 'Button';
