'use client';

// Visual timeline for activity_log entries on a single PBC item. Replaces the
// flat date-prefix list. Groups by day, draws a vertical rule with colored
// event dots, and renders each event as a plain-English sentence with the
// actor and a relative timestamp.

import * as React from 'react';
import type { ActivityLog } from '@/types';
import {
  CheckCircle2, Upload, Trash2, User as UserIcon, Calendar, Flag,
  FileText, Link2, Tag, Building2, Pencil, Plus, MessageSquare,
} from 'lucide-react';
import { cn, formatDateTime, relativeTime } from '@/lib/utils';

interface EventStyle {
  Icon: React.ComponentType<{ className?: string }>;
  /** Dot background. Goes on the circle. */
  ring: string;
  /** Icon color on top of the dot. */
  fg: string;
}

const STYLE_BY_FIELD: Record<string, EventStyle> = {
  status:           { Icon: CheckCircle2,    ring: 'bg-blue-100 dark:bg-blue-950/60',       fg: 'text-blue-700 dark:text-blue-300' },
  priority:         { Icon: Flag,            ring: 'bg-violet-100 dark:bg-violet-950/60',   fg: 'text-violet-700 dark:text-violet-300' },
  ownerClient:      { Icon: UserIcon,        ring: 'bg-amber-100 dark:bg-amber-950/60',     fg: 'text-amber-700 dark:text-amber-300' },
  dateRequested:    { Icon: Calendar,        ring: 'bg-slate-100 dark:bg-slate-800',        fg: 'text-slate-700 dark:text-slate-300' },
  dateReceived:     { Icon: Calendar,        ring: 'bg-emerald-100 dark:bg-emerald-950/60', fg: 'text-emerald-700 dark:text-emerald-300' },
  evidence_added:   { Icon: Upload,          ring: 'bg-emerald-100 dark:bg-emerald-950/60', fg: 'text-emerald-700 dark:text-emerald-300' },
  evidence_deleted: { Icon: Trash2,          ring: 'bg-red-100 dark:bg-red-950/60',         fg: 'text-red-700 dark:text-red-300' },
  notes:            { Icon: MessageSquare,   ring: 'bg-indigo-100 dark:bg-indigo-950/60',   fg: 'text-indigo-700 dark:text-indigo-300' },
  internalComments: { Icon: MessageSquare,   ring: 'bg-navy-100 dark:bg-navy-900',          fg: 'text-navy-700 dark:text-navy-300' },
  tscMapping:       { Icon: Tag,             ring: 'bg-slate-100 dark:bg-slate-800',        fg: 'text-slate-700 dark:text-slate-300' },
  linkedItems:      { Icon: Link2,           ring: 'bg-slate-100 dark:bg-slate-800',        fg: 'text-slate-700 dark:text-slate-300' },
  category:         { Icon: Tag,             ring: 'bg-slate-100 dark:bg-slate-800',        fg: 'text-slate-700 dark:text-slate-300' },
  itemRequested:    { Icon: Pencil,          ring: 'bg-slate-100 dark:bg-slate-800',        fg: 'text-slate-700 dark:text-slate-300' },
  whyPurpose:       { Icon: FileText,        ring: 'bg-slate-100 dark:bg-slate-800',        fg: 'text-slate-700 dark:text-slate-300' },
  formatExpected:   { Icon: FileText,        ring: 'bg-slate-100 dark:bg-slate-800',        fg: 'text-slate-700 dark:text-slate-300' },
  entityId:         { Icon: Building2,       ring: 'bg-slate-100 dark:bg-slate-800',        fg: 'text-slate-700 dark:text-slate-300' },
  created:          { Icon: Plus,            ring: 'bg-navy-100 dark:bg-navy-900',          fg: 'text-navy-700 dark:text-navy-300' },
};
const DEFAULT_STYLE: EventStyle = {
  Icon: Pencil, ring: 'bg-slate-100 dark:bg-slate-800', fg: 'text-slate-600 dark:text-slate-400',
};

const FIELD_LABEL: Record<string, string> = {
  status: 'status',
  priority: 'priority',
  ownerClient: 'owner',
  dateRequested: 'request date',
  dateReceived: 'received date',
  notes: 'notes',
  internalComments: 'internal comment',
  tscMapping: 'TSC mapping',
  linkedItems: 'linked items',
  category: 'category',
  itemRequested: 'request title',
  whyPurpose: 'why we need it',
  formatExpected: 'expected format',
  entityId: 'entity',
};

/** Plain-English description of one activity event. */
function describe(a: ActivityLog): React.ReactNode {
  const old = a.oldValue?.trim() || null;
  const next = a.newValue?.trim() || null;
  switch (a.field) {
    case 'evidence_added':
      return <>uploaded <strong className="text-ink-900 dark:text-slate-100">{next || 'a file'}</strong></>;
    case 'evidence_deleted':
      return <>removed <strong className="text-ink-900 dark:text-slate-100">{old || 'a file'}</strong></>;
    case 'created':
      return <>created this item</>;
    case 'deleted':
      return <>deleted this item</>;
    case 'status':
      return next
        ? <>set status to <Pill>{next}</Pill>{old ? <> <span className="text-ink-500">(was <Pill muted>{old}</Pill>)</span></> : null}</>
        : <>cleared the status</>;
    case 'priority':
      return next
        ? <>changed priority to <Pill>{next}</Pill></>
        : <>cleared the priority</>;
    case 'ownerClient':
      return next
        ? <>assigned <strong className="text-ink-900 dark:text-slate-100">{next}</strong> as owner</>
        : <>unassigned the owner</>;
    case 'dateRequested':
      return next ? <>set request date to <strong>{next}</strong></> : <>cleared request date</>;
    case 'dateReceived':
      return next ? <>set received date to <strong>{next}</strong></> : <>cleared received date</>;
    case 'entityId':
      return next ? <>scoped it to entity <strong>#{next}</strong></> : <>moved it to group-wide</>;
    case 'tscMapping':
      return <>updated the TSC mapping</>;
    case 'linkedItems':
      return <>updated linked items</>;
    case 'notes':
    case 'internalComments':
    case 'whyPurpose':
    case 'formatExpected':
    case 'itemRequested':
    case 'category': {
      const label = FIELD_LABEL[a.field] ?? a.field;
      return <>updated the <strong className="text-ink-900 dark:text-slate-100">{label}</strong></>;
    }
    default: {
      const label = FIELD_LABEL[a.field] ?? a.field;
      return next
        ? <>set <strong className="text-ink-900 dark:text-slate-100">{label}</strong> to <strong>{next}</strong></>
        : <>changed <strong className="text-ink-900 dark:text-slate-100">{label}</strong></>;
    }
  }
}

function Pill({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0 rounded text-[11.5px] font-medium ring-1 ring-inset',
      muted
        ? 'bg-canvas dark:bg-navy-900 text-ink-500 ring-rule dark:ring-navy-700'
        : 'bg-white dark:bg-navy-900 text-ink-900 dark:text-slate-100 ring-rule dark:ring-navy-700'
    )}>
      {children}
    </span>
  );
}

function actorLabel(a: ActivityLog): string {
  if (a.userName) return a.userName;
  if (a.userEmail) return a.userEmail.split('@')[0];
  return 'Someone';
}

function actorInitials(a: ActivityLog): string {
  const src = a.userName || a.userEmail || '?';
  const parts = src.split(/[ .@_-]+/).filter(Boolean);
  return (parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join('')) || '?';
}

/** Group label for the day a timestamp falls on (Today / Yesterday / weekday / date). */
function dayLabel(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const today = startOfDay(new Date()).getTime();
  const that = startOfDay(d).getTime();
  const diff = (today - that) / 86400000;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  if (d.getFullYear() === new Date().getFullYear()) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ActivityTimeline({ items }: { items: ActivityLog[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[12.5px] text-ink-500">No activity yet — changes will show up here.</p>
    );
  }

  // Group by day, preserving newest-first order.
  const groups: Array<{ day: string; entries: ActivityLog[] }> = [];
  let currentDay: string | null = null;
  for (const a of items) {
    const d = dayLabel(a.ts);
    if (d !== currentDay) {
      groups.push({ day: d, entries: [] });
      currentDay = d;
    }
    groups[groups.length - 1].entries.push(a);
  }

  return (
    <div className="relative">
      {/* The continuous vertical rule sits behind the dots. */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-rule dark:bg-navy-800" aria-hidden />
      <div className="space-y-5">
        {groups.map(group => (
          <section key={group.day}>
            <h4 className="ml-9 mb-2 text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">
              {group.day}
            </h4>
            <ul className="space-y-3">
              {group.entries.map(a => {
                const style = STYLE_BY_FIELD[a.field] ?? DEFAULT_STYLE;
                const Icon = style.Icon;
                return (
                  <li key={a.id} className="relative pl-9">
                    <span
                      className={cn(
                        'absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center',
                        'ring-4 ring-white dark:ring-navy-950',
                        style.ring,
                      )}
                      aria-hidden
                    >
                      <Icon className={cn('w-3 h-3', style.fg)} />
                    </span>
                    <div className="text-[12.5px] leading-snug text-ink-700 dark:text-slate-300">
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-canvas dark:bg-navy-800 text-[9px] font-semibold text-ink-700 dark:text-slate-300 ring-1 ring-rule dark:ring-navy-700 mr-1.5 align-[-2px]"
                        title={a.userEmail ?? undefined}
                      >
                        {actorInitials(a)}
                      </span>
                      <span className="text-ink-900 dark:text-slate-100 font-medium">
                        {actorLabel(a)}
                      </span>{' '}
                      {describe(a)}
                    </div>
                    <div
                      className="text-[11px] text-ink-500 dark:text-slate-400 mt-0.5 tabular"
                      title={formatDateTime(a.ts)}
                    >
                      {relativeTime(a.ts)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
