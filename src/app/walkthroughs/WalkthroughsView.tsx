'use client';
import * as React from 'react';
import type { Walkthrough } from '@/types';
import { WALKTHROUGH_STATUSES, formatDate } from '@/lib/utils';
import { InlineDate, InlineSelect, InlineText } from '@/components/tables/InlineEdit';
import { StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SavedFlash, useSaveIndicator } from '@/components/tables/SavedIndicator';
import { Calendar, List as ListIcon, X } from 'lucide-react';

type View = 'list' | 'week';

export default function WalkthroughsView() {
  const [items, setItems] = React.useState<Walkthrough[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<View>('list');
  const { savedKey, flash } = useSaveIndicator();

  React.useEffect(() => { load(); }, []);
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

  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Walkthroughs</h1>
          <p className="text-[12px] text-ink-500 dark:text-slate-400 mt-0.5">{items.length} sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <SavedFlash savedKey={savedKey} />
          <div className="flex items-center rounded-md border border-rule dark:border-navy-700 p-0.5">
            <button onClick={() => setView('list')} className={`px-2 h-7 inline-flex items-center gap-1 text-[12px] rounded ${view === 'list' ? 'bg-canvas dark:bg-navy-800' : ''}`}><ListIcon className="w-3 h-3" /> List</button>
            <button onClick={() => setView('week')} className={`px-2 h-7 inline-flex items-center gap-1 text-[12px] rounded ${view === 'week' ? 'bg-canvas dark:bg-navy-800' : ''}`}><Calendar className="w-3 h-3" /> Week</button>
          </div>
        </div>
      </div>

      {view === 'list' && (
        <div className="rounded-lg border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th className="min-w-[180px]">Process Area</th>
                <th className="min-w-[280px]">Key Topics</th>
                <th className="min-w-[200px]">Attendees</th>
                <th className="w-[110px]">Date</th>
                <th className="w-[80px]">Duration</th>
                <th className="w-[130px]">Status</th>
                <th className="min-w-[200px]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="p-0"><div className="h-[34px] mx-3 my-1 skeleton" /></td></tr>
              ))}
              {!loading && items.map(w => (
                <tr key={w.id}>
                  <td className="text-ink-500 tabular">{w.num}</td>
                  <td className="text-[13px] font-medium">{w.processArea}</td>
                  <td className="text-[12px] text-ink-700 dark:text-slate-300 max-w-[280px] line-clamp-2">{w.keyTopics}</td>
                  <td className="text-[12px] text-ink-700 dark:text-slate-300 max-w-[200px] line-clamp-2">{w.attendees}</td>
                  <td><InlineDate value={w.proposedDate} onCommit={v => patch(w.id, { proposedDate: v })} /></td>
                  <td className="text-[12px] tabular text-ink-500">{w.durationMin ? `${w.durationMin}m` : '—'}</td>
                  <td>
                    <InlineSelect value={w.status} options={[...WALKTHROUGH_STATUSES]}
                      onCommit={v => patch(w.id, { status: v as Walkthrough['status'] })}
                      renderValue={v => <StatusPill status={v} />} />
                  </td>
                  <td className="text-[12.5px]"><InlineText value={w.notes} onCommit={v => patch(w.id, { notes: v })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'week' && <WeekView items={items} onPatch={patch} />}
    </div>
  );
}

function WalkthroughDetailDialog({ item, onClose, onPatch }: {
  item: Walkthrough;
  onClose: () => void;
  onPatch: (id: number, p: Partial<Walkthrough>) => void;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 bg-black/30 dark:bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-navy-950 border border-rule dark:border-navy-700 rounded-lg shadow-xl w-[560px] max-w-full" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-3 border-b border-rule dark:border-navy-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-ink-500 dark:text-slate-400 mb-1">Walkthrough #{item.num}</div>
            <div className="text-[15px] font-semibold tracking-tight">{item.processArea}</div>
            <div className="mt-1.5"><StatusPill status={item.status} /></div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-canvas dark:hover:bg-navy-800">
            <X className="w-4 h-4 text-ink-500" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-[13px]">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Key topics</div>
            <p className="text-ink-700 dark:text-slate-300 whitespace-pre-line">{item.keyTopics || '—'}</p>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Client attendees</div>
            <p className="text-ink-700 dark:text-slate-300 whitespace-pre-line">{item.attendees || '—'}</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Date</div>
              <InlineDate value={item.proposedDate} onCommit={v => onPatch(item.id, { proposedDate: v })} />
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Duration</div>
              <span className="text-ink-700 dark:text-slate-300 tabular">{item.durationMin ? `${item.durationMin} min` : '—'}</span>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Status</div>
              <InlineSelect
                value={item.status} options={[...WALKTHROUGH_STATUSES]}
                onCommit={v => onPatch(item.id, { status: v as Walkthrough['status'] })}
                renderValue={v => <StatusPill status={v} />}
              />
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Notes</div>
            <InlineText value={item.notes} onCommit={v => onPatch(item.id, { notes: v })} placeholder="Add a note…" multiline />
          </div>
        </div>
      </div>
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

function WeekView({ items, onPatch }: { items: Walkthrough[]; onPatch: (id: number, p: Partial<Walkthrough>) => void }) {
  const [weekStart, setWeekStart] = React.useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return d;
  });
  const [openId, setOpenId] = React.useState<number | null>(null);
  const [draggingId, setDraggingId] = React.useState<number | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null); // 'YYYY-MM-DD' or 'unscheduled'
  const openItem = openId ? items.find(i => i.id === openId) : null;
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
  function onDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }
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
                    onClick={() => setOpenId(w.id)}
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
                <button onClick={() => setOpenId(w.id)} className="text-left w-full">
                  <div className="text-[12px] font-medium truncate hover:text-navy-700 dark:hover:text-navy-300">#{w.num} {w.processArea}</div>
                  <div className="text-[11px] text-ink-500 line-clamp-2">{w.keyTopics}</div>
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
      {openItem && (
        <WalkthroughDetailDialog item={openItem} onClose={() => setOpenId(null)} onPatch={onPatch} />
      )}
    </div>
  );
}
