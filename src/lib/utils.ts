import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  // Accepts ISO date or datetime
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toISOString().slice(0, 10);
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d.includes('T') ? d : d.replace(' ', 'T') + 'Z');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function relativeTime(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d.includes('T') ? d : d.replace(' ', 'T') + 'Z');
  if (isNaN(dt.getTime())) return d;
  const diff = Date.now() - dt.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return dt.toISOString().slice(0, 10);
}

export function isOverdue(item: { dateRequested: string | null; dateReceived: string | null; status: string }): boolean {
  if (!item.dateRequested) return false;
  if (item.dateReceived) return false;
  if (['Received', 'Reviewed', 'N/A'].includes(item.status)) return false;
  const requested = new Date(item.dateRequested);
  const days = (Date.now() - requested.getTime()) / 86400000;
  return days > 7;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export const STATUSES = ['Not Started', 'Requested', 'In Progress', 'Received', 'Reviewed', 'N/A'] as const;
export const PRIORITIES = ['High', 'Medium-High', 'Medium', 'Low-Medium', 'Low'] as const;
export const CATEGORIES = [
  'Governance', 'Entities & Systems', 'Access Management', 'Change Management',
  'IT Operations', 'Third Parties', 'Licensing', 'IT Spend', 'SOC 2 Readiness',
  'Physical & Environmental',
] as const;
export const ACCESS_STATUSES = ['Not Requested', 'Requested', 'Provisioned', 'Revoked', 'N/A'] as const;
export const WALKTHROUGH_STATUSES = ['Not Scheduled', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const;
export const TEST_STATUSES = ['Not Started', 'In Progress', 'Tested', 'Findings', 'N/A'] as const;
export const TSC_VALUES = ['Security', 'Availability', 'Confidentiality', 'Processing Integrity', 'Privacy'] as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  'Not Started': { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' },
  'Requested':   { bg: 'bg-navy-100',  text: 'text-navy-800', ring: 'ring-navy-200' },
  'In Progress': { bg: 'bg-gold-100',  text: 'text-gold-800', ring: 'ring-gold-200' },
  'Received':    { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-200' },
  'Reviewed':    { bg: 'bg-emerald-200', text: 'text-emerald-900', ring: 'ring-emerald-300' },
  'N/A':         { bg: 'bg-zinc-100',  text: 'text-zinc-600', ring: 'ring-zinc-200' },
  'Not Requested': { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' },
  'Provisioned': { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-200' },
  'Revoked':     { bg: 'bg-zinc-100', text: 'text-zinc-700', ring: 'ring-zinc-200' },
  'Not Scheduled': { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-200' },
  'Scheduled':   { bg: 'bg-navy-100', text: 'text-navy-800', ring: 'ring-navy-200' },
  'Completed':   { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-200' },
  'Cancelled':   { bg: 'bg-zinc-100', text: 'text-zinc-600', ring: 'ring-zinc-200' },
  'Tested':      { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-200' },
  'Findings':    { bg: 'bg-red-100', text: 'text-red-800', ring: 'ring-red-200' },
};

export const PRIORITY_BORDER: Record<string, string> = {
  'High':        'border-l-[3px] border-l-danger',
  'Medium-High': 'border-l-[3px] border-l-gold-500',
  'Medium':      'border-l-[3px] border-l-navy-400',
  'Low-Medium':  'border-l-[3px] border-l-navy-200',
  'Low':         'border-l-[3px] border-l-slate-200',
};
