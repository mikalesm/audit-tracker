'use client';
import * as React from 'react';
import type { Walkthrough } from '@/types';
import { WALKTHROUGH_STATUSES, formatDate } from '@/lib/utils';
import { InlineDate, InlineSelect, InlineText } from '@/components/tables/InlineEdit';
import { StatusPill, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SavedFlash, useSaveIndicator } from '@/components/tables/SavedIndicator';
import { Calendar, List as ListIcon, X, Clock, Users, AlertTriangle } from 'lucide-react';
import HelpStrip from '@/components/ui/HelpStrip';
import ViewToggle, { useViewMode } from '@/components/tables/ViewToggle';
import ContextSection from '@/components/ui/ContextSection';

type View = 'list' | 'week';
type Role = 'auditor_lead' | 'auditor' | 'client_owner' | 'client_reviewer';

export default function WalkthroughsView() {
  const [items, setItems] = React.useState<Walkthrough[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<View>('list');
  const [viewMode, setViewMode] = useViewMode('walkthroughs', 'cards');
  const [openId, setOpenId] = React.useState<number | null>(null);
  const [role, setRole] = React.useState<Role>('auditor_lead');
  const { savedKey, flash } = useSaveIndicator();

  React.useEffect(() => { load(); }, []);
  React.useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.user?.currentRole) setRole(d.user.currentRole);
    }).catch(() => {});
  }, []);
  async function load() {
    setItems(await (await fetch('/api/walkthroughs')).json()); setLoading(false);
  }
  async function patch(id: number, p: Partial<Walkthrough>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...p } : i));
    const r = await fetch(`/api/walkthroughs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    if (r.ok) {
      const updated: Walkthrough = await r.json();
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      flash();
    }
  }

  const openItem = openId ? items.find(i => i.id === openId) ?? null : null;
  const isAuditor = role === 'auditor' || role === 'auditor_lead';

  return (
    <div className="px-6 py-7 max-w-[1500px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[21px] font-semibold tracking-tight">Walkthroughs</h1>
          <p className="text-[12.5px] text-ink-500 dark:text-slate-400 mt-1">{items.length} sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <SavedFlash savedKey={savedKey} />
          {view === 'list' && <ViewToggle mode={viewMode} onChange={setViewMode} />}
          <div className="flex items-center rounded-md border border-rule p-0.5 dark:border-navy-700">
            <button onClick={() => setView('list')} className={`px-2 h-8 inline-flex items-center gap-1 text-[12px] rounded ${view === 'list' ? 'bg-canvas dark:bg-navy-800' : 'text-ink-500'}`}><ListIcon className="w-3.5 h-3.5" /> List</button>
            <button onClick={() => setView('week')} className={`px-2 h-8 inline-flex items-center gap-1 text-[12px] rounded ${view === 'week' ? 'bg-canvas dark:bg-navy-800' : 'text-ink-500'}`}><Calendar className="w-3.5 h-3.5" /> Week</button>
          </div>
        </div>
      </div>

      <HelpStrip
        storageKey="walkthroughs-list"
        title="What is a walkthrough?"
      >
        A walkthrough is a working session where the audit team meets the team that
        owns a process (e.g. Change Management, Access Provisioning) to observe how
        the control works in practice. Each row has an <strong>objective</strong>
        (what we&apos;re trying to confirm) and a <strong>description</strong>
        (what you can expect from the session). Click any row for the full agenda.
      </HelpStrip>

      {view === 'list' && viewMode === 'cards' && (
        <CardList
          items={items}
          loading={loading}
          isAuditor={isAuditor}
          onOpen={setOpenId}
        />
      )}

      {view === 'list' && viewMode === 'table' && (
        <div className="rounded-xl border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 shadow-card dark:shadow-none overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th className="min-w-[180px]">Process Area</th>
                <th className="min-w-[240px]">Objective</th>
                <th className="min-w-[180px]">Attendees</th>
                <th className="w-[110px]">Date</th>
                <th className="w-[80px]">Duration</th>
                <th className="w-[130px]">Status</th>
                <th className="min-w-[180px]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="p-0"><div className="h-[34px] mx-3 my-1 skeleton" /></td></tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-[13px]">
                  <EmptyState role={role} />
                </td></tr>
              )}
              {!loading && items.map(w => (
                <tr key={w.id} className="cursor-pointer hover:bg-canvas/60 dark:hover:bg-navy-900/40" onClick={() => setOpenId(w.id)}>
                  <td className="text-ink-500 tabular">{w.num}</td>
                  <td className="text-[13px] font-medium">{w.processArea}</td>
                  <td className="text-[12px] text-ink-700 dark:text-slate-300 max-w-[260px] line-clamp-2">
                    {w.objective || <span className="text-ink-500 italic">No objective set</span>}
                  </td>
                  <td className="text-[12px] text-ink-700 dark:text-slate-300 max-w-[200px] line-clamp-2">{w.attendees || '—'}</td>
                  <td onClick={e => e.stopPropagation()}><InlineDate value={w.proposedDate} onCommit={v => patch(w.id, { proposedDate: v })} /></td>
                  <td className="text-[12px] tabular text-ink-500">{w.durationMin ? `${w.durationMin}m` : '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <InlineSelect value={w.status} options={[...WALKTHROUGH_STATUSES]}
                      onCommit={v => patch(w.id, { status: v as Walkthrough['status'] })}
                      renderValue={v => <StatusPill status={v} />} />
                  </td>
                  <td className="text-[12.5px]" onClick={e => e.stopPropagation()}><InlineText value={w.notes} onCommit={v => patch(w.id, { notes: v })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'week' && <WeekView items={items} onPatch={patch} onOpen={setOpenId} />}

      {openItem && (
        <WalkthroughDetailDialog
          item={openItem}
          isAuditor={isAuditor}
          onClose={() => setOpenId(null)}
          onPatch={(p) => patch(openItem.id, p)}
        />
      )}
    </div>
  );
}

function EmptyState({ role }: { role: Role }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="text-ink-700 dark:text-slate-300 font-medium">No walkthroughs scheduled yet</div>
      <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
        Walkthroughs are working sessions with the audited team.{' '}
        {role === 'auditor_lead' || role === 'auditor' ? (
          <>They&apos;re usually imported from the standard Excel via{' '}
          <a href="/settings" className="text-navy-700 dark:text-navy-300 underline">Settings → Re-sync from Excel</a>,
          or seeded from a template when an engagement is created.</>
        ) : (
          <>None are scheduled with you yet — your audit lead will set these up.</>
        )}
      </p>
    </div>
  );
}

function CardList({
  items,
  loading,
  isAuditor,
  onOpen,
}: {
  items: Walkthrough[];
  loading: boolean;
  isAuditor: boolean;
  onOpen: (id: number) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[160px] skeleton rounded-lg" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="py-12 text-center"><EmptyState role={isAuditor ? 'auditor_lead' : 'client_reviewer'} /></div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map(w => {
        const missing = isAuditor && (!w.description || !w.objective);
        return (
          <button
            key={w.id}
            onClick={() => onOpen(w.id)}
            className="text-left rounded-xl border border-rule dark:border-navy-700 bg-white shadow-card dark:bg-navy-950 dark:shadow-none p-4 transition-all hover:border-navy-300 hover:shadow-card-hover dark:hover:border-navy-500"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="text-[10.5px] uppercase tracking-wider text-ink-500 dark:text-slate-400 font-mono">
                #{w.num}
              </div>
              <StatusPill status={w.status} />
            </div>
            <div className="text-[14px] font-semibold leading-snug text-ink-900 dark:text-slate-100 mb-1.5">
              {w.processArea}
            </div>
            {w.objective ? (
              <p className="text-[12px] text-ink-700 dark:text-slate-300 leading-relaxed line-clamp-2 mb-2.5">
                <span className="font-semibold text-ink-500 dark:text-slate-400">Objective:</span> {w.objective}
              </p>
            ) : (
              <p className="text-[12px] text-ink-500 italic mb-2.5">
                {isAuditor ? 'No objective yet — click to add one.' : 'Objective not set.'}
              </p>
            )}
            <div className="flex items-center gap-3 text-[11px] text-ink-500 dark:text-slate-400 flex-wrap">
              {w.proposedDate ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {formatDate(w.proposedDate)}
                </span>
              ) : (
                <span className="italic">Unscheduled</span>
              )}
              {w.durationMin && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {w.durationMin}m
                </span>
              )}
              {w.attendees && (
                <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                  <Users className="w-3 h-3 shrink-0" />
                  <span className="truncate">{w.attendees}</span>
                </span>
              )}
              {missing && (
                <span className="ml-auto inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 text-[10.5px]">
                  <AlertTriangle className="w-3 h-3" /> Needs context
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function WalkthroughDetailDialog({ item, isAuditor, onClose, onPatch }: {
  item: Walkthrough;
  isAuditor: boolean;
  onClose: () => void;
  onPatch: (p: Partial<Walkthrough>) => void;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 dark:bg-black/50" />
      <div
        className="relative w-[640px] max-w-[90vw] h-full bg-white dark:bg-navy-950 border-l border-rule dark:border-navy-800 shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-rule dark:border-navy-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-ink-500 dark:text-slate-400 mb-1">
                Walkthrough #{item.num}
              </div>
              <div className="text-[16px] font-semibold tracking-tight leading-tight">{item.processArea}</div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusPill status={item.status} />
                {item.proposedDate && (
                  <Badge tone="neutral">{formatDate(item.proposedDate)}</Badge>
                )}
                {item.durationMin && (
                  <Badge tone="neutral">{item.durationMin} min</Badge>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-canvas dark:hover:bg-navy-800">
              <X className="w-4 h-4 text-ink-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <ContextSection
            label="What this session covers"
            audience="client"
          >
            {isAuditor ? (
              <InlineText
                value={item.description}
                onCommit={v => onPatch({ description: v })}
                placeholder="A working session with [team] to walk through how [process] operates day-to-day…"
                multiline
              />
            ) : (
              <p className="text-ink-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {item.description || <span className="text-ink-500 italic">No description yet.</span>}
              </p>
            )}
          </ContextSection>

          <ContextSection
            label="What the auditor wants to confirm"
            audience="both"
          >
            {isAuditor ? (
              <InlineText
                value={item.objective}
                onCommit={v => onPatch({ objective: v })}
                placeholder="Confirm that the control is designed, executed, and reviewed on cadence…"
                multiline
              />
            ) : (
              <p className="text-ink-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {item.objective || <span className="text-ink-500 italic">No objective set.</span>}
              </p>
            )}
          </ContextSection>

          <ContextSection
            label="Topics we plan to cover"
            audience="client"
          >
            <InlineText
              value={item.keyTopics}
              onCommit={v => onPatch({ keyTopics: v ?? '' } as Partial<Walkthrough>)}
              placeholder="e.g. Provisioning flow per app, manager approval, periodic review…"
              multiline
            />
          </ContextSection>

          <ContextSection
            label="Who should attend"
            audience="client"
          >
            <InlineText
              value={item.attendees}
              onCommit={v => onPatch({ attendees: v ?? '' } as Partial<Walkthrough>)}
              placeholder="e.g. IAM Lead, HRIS owner"
              multiline
            />
          </ContextSection>

          <div className="rounded-lg border border-rule dark:border-navy-800 bg-canvas/40 dark:bg-navy-900/40 p-3.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-2.5">
              Schedule
            </div>
            <div className="grid grid-cols-3 gap-4 text-[13px]">
              <Field label="Proposed date">
                <InlineDate value={item.proposedDate} onCommit={v => onPatch({ proposedDate: v })} />
              </Field>
              <Field label="Duration">
                <span className="text-ink-700 dark:text-slate-300 tabular">
                  {item.durationMin ? `${item.durationMin} min` : '—'}
                </span>
              </Field>
              <Field label="Status">
                <InlineSelect
                  value={item.status} options={[...WALKTHROUGH_STATUSES]}
                  onCommit={v => onPatch({ status: v as Walkthrough['status'] })}
                  renderValue={v => <StatusPill status={v} />}
                />
              </Field>
            </div>
          </div>

          <ContextSection
            label="Notes (shared)"
            audience="both"
          >
            <InlineText value={item.notes} onCommit={v => onPatch({ notes: v })} placeholder="Add a note…" multiline />
          </ContextSection>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DRAG_MIME = 'application/x-walkthrough-id';

function WeekView({ items, onPatch, onOpen }: {
  items: Walkthrough[];
  onPatch: (id: number, p: Partial<Walkthrough>) => void;
  onOpen: (id: number) => void;
}) {
  const [weekStart, setWeekStart] = React.useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return d;
  });
  const [draggingId, setDraggingId] = React.useState<number | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const itemsByDay = (d: Date) => items.filter(i => {
    if (!i.proposedDate) return false;
    return i.proposedDate.slice(0, 10) === ymd(d);
  });
  const unscheduled = items.filter(i => !i.proposedDate);

  function onDragStart(e: React.DragEvent, id: number) {
    e.dataTransfer.setData(DRAG_MIME, String(id));
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  }
  function onDragEnd() { setDraggingId(null); setDropTarget(null); }
  function onDragOverCell(e: React.DragEvent, key: string) {
    if (draggingId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget !== key) setDropTarget(key);
  }
  function onDropOnDay(e: React.DragEvent, d: Date) {
    e.preventDefault();
    const idStr = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    const id = parseInt(idStr, 10);
    setDraggingId(null);
    setDropTarget(null);
    if (!id) return;
    const item = items.find(i => i.id === id);
    const target = ymd(d);
    if (item && item.proposedDate?.slice(0, 10) !== target) {
      onPatch(id, { proposedDate: target });
    }
  }
  function onDropOnUnscheduled(e: React.DragEvent) {
    e.preventDefault();
    const idStr = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    const id = parseInt(idStr, 10);
    setDraggingId(null);
    setDropTarget(null);
    if (!id) return;
    const item = items.find(i => i.id === id);
    if (item && item.proposedDate) {
      onPatch(id, { proposedDate: null });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}>← Prev</Button>
        <div className="text-[13px] font-medium">
          Week of {formatDate(weekStart.toISOString())}
        </div>
        <Button variant="secondary" size="sm" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}>Next →</Button>
        <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay() + 1); setWeekStart(d); }}>Today</Button>
        <span className="ml-auto text-[11px] text-ink-500">Drag a card onto a day to reschedule</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map(d => {
          const today = d.toDateString() === new Date().toDateString();
          const dayItems = itemsByDay(d);
          const key = ymd(d);
          const isDropTarget = dropTarget === key;
          return (
            <div
              key={d.toISOString()}
              onDragOver={e => onDragOverCell(e, key)}
              onDragLeave={() => { if (dropTarget === key) setDropTarget(null); }}
              onDrop={e => onDropOnDay(e, d)}
              className={`min-h-[200px] rounded-lg border p-2 transition-colors ${
                isDropTarget
                  ? 'border-navy-500 bg-navy-50 dark:bg-navy-900 ring-2 ring-navy-300 dark:ring-navy-700'
                  : today
                    ? 'border-navy-400 bg-navy-50/40 dark:bg-navy-900/40'
                    : 'border-rule dark:border-navy-800 bg-white dark:bg-navy-950'
              }`}
            >
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mb-1">
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
              <div className="text-[14px] font-semibold mb-2">{d.getDate()}</div>
              <div className="space-y-1.5">
                {dayItems.map(w => (
                  <button
                    key={w.id}
                    draggable
                    onDragStart={e => onDragStart(e, w.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => onOpen(w.id)}
                    className={`w-full text-left rounded border border-rule dark:border-navy-700 bg-white dark:bg-navy-900 p-1.5 hover:border-navy-400 dark:hover:border-navy-500 hover:bg-canvas dark:hover:bg-navy-800 cursor-grab active:cursor-grabbing transition-opacity ${
                      draggingId === w.id ? 'opacity-40' : ''
                    }`}
                    title="Drag to reschedule, click to open"
                  >
                    <div className="text-[11.5px] font-medium truncate">#{w.num} {w.processArea}</div>
                    <div className="text-[10.5px] text-ink-500 truncate">{w.attendees}</div>
                    <div className="mt-1"><StatusPill status={w.status} /></div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div
        onDragOver={e => onDragOverCell(e, 'unscheduled')}
        onDragLeave={() => { if (dropTarget === 'unscheduled') setDropTarget(null); }}
        onDrop={onDropOnUnscheduled}
        className={`border border-dashed rounded-lg p-3 transition-colors ${
          dropTarget === 'unscheduled'
            ? 'border-navy-500 bg-navy-50 dark:bg-navy-900 ring-2 ring-navy-300 dark:ring-navy-700'
            : 'border-rule dark:border-navy-700'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
            Unscheduled ({unscheduled.length})
          </div>
          {draggingId !== null && (
            <span className="text-[10.5px] text-ink-500">Drop here to unschedule</span>
          )}
        </div>
        {unscheduled.length === 0 ? (
          <p className="text-[12px] text-ink-500 italic">All walkthroughs scheduled. Drop a card here to remove its date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {unscheduled.map(w => (
              <div
                key={w.id}
                draggable
                onDragStart={e => onDragStart(e, w.id)}
                onDragEnd={onDragEnd}
                className={`rounded border border-rule dark:border-navy-700 bg-white dark:bg-navy-900 p-2 cursor-grab active:cursor-grabbing transition-opacity ${
                  draggingId === w.id ? 'opacity-40' : ''
                }`}
              >
                <button onClick={() => onOpen(w.id)} className="text-left w-full">
                  <div className="text-[12px] font-medium truncate hover:text-navy-700 dark:hover:text-navy-300">#{w.num} {w.processArea}</div>
                  <div className="text-[11px] text-ink-500 line-clamp-2">{w.objective || w.keyTopics}</div>
                </button>
                <div
                  className="mt-1.5"
                  draggable={false}
                  onDragStart={e => e.stopPropagation()}
                >
                  <InlineDate value={w.proposedDate} onCommit={v => onPatch(w.id, { proposedDate: v })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
