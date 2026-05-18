'use client';
import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn, STATUSES, PRIORITIES, CATEGORIES, TSC_VALUES, PRIORITY_BORDER, isOverdue, formatDate } from '@/lib/utils';
import { CATEGORY_COVERAGE } from '@/lib/templates/library';
import type { PBCItem } from '@/types';
import { InlineDate, InlineSelect, InlineText } from '@/components/tables/InlineEdit';
import { StatusPill, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SavedFlash, useSaveIndicator } from '@/components/tables/SavedIndicator';
import PBCDetailPanel from './PBCDetailPanel';
import { Filter, ChevronDown, X, ListFilter, Download, BookmarkPlus, Bookmark, Trash2, AlertTriangle, Building2, Plus } from 'lucide-react';
import { useEntityFilter } from '@/components/shell/state';
import HelpStrip from '@/components/ui/HelpStrip';
import ViewToggle, { useViewMode } from '@/components/tables/ViewToggle';
import AddItemDialog from '@/components/ui/AddItemDialog';

type SortKey = 'num' | 'category' | 'priority' | 'status' | 'dateRequested' | 'dateReceived' | 'ownerClient';
type SortDir = 'asc' | 'desc';

interface UndoOp {
  itemId: number;
  field: keyof PBCItem;
  before: unknown;
  after: unknown;
}

interface SavedViewRecord {
  id: number;
  name: string;
  filters: PBCFilterSnapshot;
  createdAt: string;
}

interface PBCFilterSnapshot {
  search?: string;
  cats?: string[];
  prios?: string[];
  statuses?: string[];
  owners?: string[];
  tsc?: string[];
  reqFrom?: string; reqTo?: string;
  recFrom?: string; recTo?: string;
  notesMode?: 'any' | 'has' | 'none';
  builtIn?: string;
}

const SAVED_VIEWS = [
  { id: 'all', label: 'All items' },
  { id: 'high-outstanding', label: 'High outstanding' },
  { id: 'received-week', label: 'Received this week' },
  { id: 'awaiting-client', label: 'Awaiting client' },
  { id: 'awaiting-review', label: 'Awaiting auditor review' },
  { id: 'overdue', label: 'Overdue' },
];

export default function PBCView() {
  const router = useRouter();
  const params = useSearchParams();
  const initialId = params.get('id') ? parseInt(params.get('id')!, 10) : null;
  const initialCats = (params.get('category') || '').split(',').filter(Boolean);
  const initialStatuses = (params.get('status') || '').split(',').filter(Boolean);
  const initialPrios = (params.get('priority') || '').split(',').filter(Boolean);

  const [items, setItems] = React.useState<PBCItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [filterCats, setFilterCats] = React.useState<string[]>(initialCats);
  const [filterPrios, setFilterPrios] = React.useState<string[]>(initialPrios);
  const [filterStatuses, setFilterStatuses] = React.useState<string[]>(initialStatuses);
  const [filterOwners, setFilterOwners] = React.useState<string[]>([]);
  const [filterTSC, setFilterTSC] = React.useState<string[]>([]);
  const [reqFrom, setReqFrom] = React.useState<string>('');
  const [reqTo, setReqTo] = React.useState<string>('');
  const [recFrom, setRecFrom] = React.useState<string>('');
  const [recTo, setRecTo] = React.useState<string>('');
  const [notesMode, setNotesMode] = React.useState<'any' | 'has' | 'none'>('any');
  const [view, setView] = React.useState('all');
  const [savedViews, setSavedViews] = React.useState<SavedViewRecord[]>([]);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>('num');
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [openId, setOpenId] = React.useState<number | null>(initialId);
  const [cursor, setCursor] = React.useState<number | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [role, setRole] = React.useState<'auditor_lead' | 'auditor' | 'client_owner' | 'client_reviewer'>('auditor_lead');
  const [currentUserId, setCurrentUserId] = React.useState<number>(0);
  const [viewMode, setViewMode] = useViewMode('pbc', 'cards');
  const { savedKey, flash } = useSaveIndicator();
  const undoStack = React.useRef<UndoOp[]>([]);
  const redoStack = React.useRef<UndoOp[]>([]);
  const { entityId, entities } = useEntityFilter();
  const entityNameById = React.useMemo(() => {
    const m = new Map<number, string>();
    for (const e of entities) m.set(e.id, e.legalEntity || `Entity #${e.num}`);
    return m;
  }, [entities]);

  React.useEffect(() => {
    load();
    loadSavedViews();
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.user?.currentRole) setRole(d.user.currentRole);
      if (d?.user?.userId) setCurrentUserId(d.user.userId);
    }).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/pbc');
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }

  async function loadSavedViews() {
    const res = await fetch('/api/saved-views?scope=pbc');
    if (res.ok) setSavedViews(await res.json());
  }

  function currentFilters(): PBCFilterSnapshot {
    return {
      search: search || undefined,
      cats: filterCats.length ? filterCats : undefined,
      prios: filterPrios.length ? filterPrios : undefined,
      statuses: filterStatuses.length ? filterStatuses : undefined,
      owners: filterOwners.length ? filterOwners : undefined,
      tsc: filterTSC.length ? filterTSC : undefined,
      reqFrom: reqFrom || undefined, reqTo: reqTo || undefined,
      recFrom: recFrom || undefined, recTo: recTo || undefined,
      notesMode: notesMode === 'any' ? undefined : notesMode,
      builtIn: view !== 'all' ? view : undefined,
    };
  }

  function applyFilters(f: PBCFilterSnapshot) {
    setSearch(f.search ?? '');
    setFilterCats(f.cats ?? []);
    setFilterPrios(f.prios ?? []);
    setFilterStatuses(f.statuses ?? []);
    setFilterOwners(f.owners ?? []);
    setFilterTSC(f.tsc ?? []);
    setReqFrom(f.reqFrom ?? '');
    setReqTo(f.reqTo ?? '');
    setRecFrom(f.recFrom ?? '');
    setRecTo(f.recTo ?? '');
    setNotesMode(f.notesMode ?? 'any');
    setView(f.builtIn ?? 'all');
  }

  async function saveView(name: string) {
    const res = await fetch('/api/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'pbc', name, filters: currentFilters() }),
    });
    if (res.ok) { await loadSavedViews(); flash(); }
  }

  async function deleteView(id: number) {
    if (!confirm('Delete this saved view?')) return;
    await fetch(`/api/saved-views/${id}`, { method: 'DELETE' });
    await loadSavedViews();
  }

  async function patchItem(id: number, patch: Partial<PBCItem>, recordUndo = true) {
    const before = items.find(i => i.id === id);
    if (!before) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    const res = await fetch(`/api/pbc/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json() as PBCItem;
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      flash();
      if (recordUndo) {
        for (const k of Object.keys(patch) as (keyof PBCItem)[]) {
          undoStack.current.push({ itemId: id, field: k, before: (before as unknown as Record<string, unknown>)[k as string], after: (patch as unknown as Record<string, unknown>)[k as string] });
        }
        if (undoStack.current.length > 20) undoStack.current.shift();
        redoStack.current = [];
      }
    } else {
      // revert on error
      setItems(prev => prev.map(i => i.id === id ? before : i));
    }
  }

  // Undo / redo (cmd-Z / cmd-shift-Z)
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const isUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
      const isRedo = (e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'z' && e.shiftKey || e.key.toLowerCase() === 'y');
      if (isUndo) {
        const op = undoStack.current.pop();
        if (op) {
          e.preventDefault();
          redoStack.current.push(op);
          patchItem(op.itemId, { [op.field]: op.before } as Partial<PBCItem>, false);
        }
      } else if (isRedo) {
        const op = redoStack.current.pop();
        if (op) {
          e.preventDefault();
          undoStack.current.push(op);
          patchItem(op.itemId, { [op.field]: op.after } as Partial<PBCItem>, false);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const filtered = React.useMemo(() => {
    let arr = items.slice();
    const q = search.toLowerCase().trim();
    if (q) {
      arr = arr.filter(i =>
        i.itemRequested.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.ownerClient || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q) ||
        String(i.num).includes(q)
      );
    }
    if (filterCats.length) arr = arr.filter(i => filterCats.includes(i.category));
    if (filterPrios.length) arr = arr.filter(i => filterPrios.includes(i.priority));
    if (filterStatuses.length) arr = arr.filter(i => filterStatuses.includes(i.status));
    if (filterOwners.length) {
      arr = arr.filter(i => {
        const o = i.ownerClient;
        if (filterOwners.includes('__unassigned__')) {
          if (!o) return true;
        }
        return o ? filterOwners.includes(o) : false;
      });
    }
    if (filterTSC.length) arr = arr.filter(i => i.tscMapping.some(t => filterTSC.includes(t)));
    if (reqFrom) arr = arr.filter(i => i.dateRequested && i.dateRequested.slice(0, 10) >= reqFrom);
    if (reqTo) arr = arr.filter(i => i.dateRequested && i.dateRequested.slice(0, 10) <= reqTo);
    if (recFrom) arr = arr.filter(i => i.dateReceived && i.dateReceived.slice(0, 10) >= recFrom);
    if (recTo) arr = arr.filter(i => i.dateReceived && i.dateReceived.slice(0, 10) <= recTo);
    if (notesMode === 'has') arr = arr.filter(i => i.notes && i.notes.trim().length > 0);
    if (notesMode === 'none') arr = arr.filter(i => !i.notes || i.notes.trim().length === 0);

    // Entity filter: show the selected entity's items plus group-wide items.
    if (entityId != null) {
      arr = arr.filter(i => i.entityId === entityId || i.entityId === null);
    }

    if (view === 'high-outstanding') {
      arr = arr.filter(i => i.priority === 'High' && !['Received','Reviewed','N/A'].includes(i.status));
    } else if (view === 'received-week') {
      const cutoff = Date.now() - 7 * 86400000;
      arr = arr.filter(i => i.dateReceived && new Date(i.dateReceived).getTime() >= cutoff);
    } else if (view === 'awaiting-client') {
      arr = arr.filter(i => ['Requested', 'In Progress'].includes(i.status));
    } else if (view === 'awaiting-review') {
      arr = arr.filter(i => i.status === 'Received');
    } else if (view === 'overdue') {
      arr = arr.filter(i => isOverdue(i));
    }

    arr.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (sortKey === 'priority') {
        const order = ['High', 'Medium-High', 'Medium', 'Low-Medium', 'Low'];
        return (order.indexOf(a.priority) - order.indexOf(b.priority)) * (sortDir === 'asc' ? 1 : -1);
      }
      if (sortKey === 'status') {
        const order = ['Not Started','Requested','In Progress','Received','Reviewed','N/A'];
        return (order.indexOf(a.status) - order.indexOf(b.status)) * (sortDir === 'asc' ? 1 : -1);
      }
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * (sortDir === 'asc' ? 1 : -1);
      }
      return String(av).localeCompare(String(bv)) * (sortDir === 'asc' ? 1 : -1);
    });

    return arr;
  }, [items, search, filterCats, filterPrios, filterStatuses, filterOwners, filterTSC, reqFrom, reqTo, recFrom, recTo, notesMode, sortKey, sortDir, view, entityId]);

  const ownerOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.ownerClient) set.add(i.ownerClient);
    return Array.from(set).sort();
  }, [items]);
  const hasMoreFilters = Boolean(filterOwners.length > 0 || filterTSC.length > 0 || reqFrom || reqTo || recFrom || recTo || notesMode !== 'any');

  // Keyboard navigation: j / k / Enter / Esc
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'j') {
        e.preventDefault();
        const idx = cursor === null ? -1 : filtered.findIndex(i => i.id === cursor);
        const next = filtered[Math.min(idx + 1, filtered.length - 1)];
        if (next) setCursor(next.id);
      } else if (e.key === 'k') {
        e.preventDefault();
        const idx = cursor === null ? filtered.length : filtered.findIndex(i => i.id === cursor);
        const next = filtered[Math.max(idx - 1, 0)];
        if (next) setCursor(next.id);
      } else if (e.key === 'Enter') {
        if (cursor && !openId) {
          e.preventDefault();
          setOpenId(cursor);
        }
      } else if (e.key === 'Escape') {
        if (openId) setOpenId(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, filtered, openId]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function bulkSetStatus(status: string) {
    for (const id of Array.from(selected)) {
      await patchItem(id, { status: status as PBCItem['status'] });
    }
    setSelected(new Set());
  }

  async function bulkSetOwner(owner: string | null) {
    for (const id of Array.from(selected)) {
      await patchItem(id, { ownerClient: owner });
    }
    setSelected(new Set());
  }

  function bulkExport() {
    const ids = Array.from(selected).join(',');
    window.location.href = `/api/export?ids=${ids}`;
  }

  const openItem = openId ? items.find(i => i.id === openId) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-6 pt-5 pb-4 border-b border-rule dark:border-navy-800 bg-white dark:bg-navy-950">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[21px] font-semibold tracking-tight">PBC list</h1>
            <p className="text-[12.5px] text-ink-500 dark:text-slate-400 mt-1">
              {filtered.length} of {items.length} items · {entityId != null ? (entityNameById.get(entityId) ?? 'Entity') : 'All entities'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SavedFlash savedKey={savedKey} />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
            <a href="/api/export" className="inline-flex">
              <Button variant="secondary" size="sm"><Download className="w-3.5 h-3.5" /> Export</Button>
            </a>
            {role === 'auditor_lead' && (
              <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="w-3.5 h-3.5" /> Add question
              </Button>
            )}
          </div>
        </div>

        <HelpStrip
          storageKey="pbc-list"
          title="What is the PBC list?"
          className="mb-3"
        >
          PBC = <em>Provided By Client</em>. Each row is one piece of evidence the auditor
          needs. Click any item to see <strong>why it&apos;s being requested</strong>,
          what format is expected, and to upload (or review) the evidence. Switch
          to <em>Table</em> view above for a dense spreadsheet layout.
        </HelpStrip>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items, owners, notes…"
            className="h-9 w-[280px] rounded-md border border-rule-strong bg-white dark:bg-navy-900 dark:border-navy-700 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-navy-400"
          />
          <MultiFilter label="Category" options={[...CATEGORIES]} value={filterCats} onChange={setFilterCats} />
          <MultiFilter label="Priority" options={[...PRIORITIES]} value={filterPrios} onChange={setFilterPrios} />
          <MultiFilter label="Status" options={[...STATUSES]} value={filterStatuses} onChange={setFilterStatuses} />
          <MultiFilter
            label="Owner"
            options={['__unassigned__', ...ownerOptions]}
            optionLabel={o => o === '__unassigned__' ? '(unassigned)' : o}
            value={filterOwners}
            onChange={setFilterOwners}
          />
          <MultiFilter label="TSC" options={[...TSC_VALUES]} value={filterTSC} onChange={setFilterTSC} />
          <MoreFilters
            reqFrom={reqFrom} reqTo={reqTo} setReqFrom={setReqFrom} setReqTo={setReqTo}
            recFrom={recFrom} recTo={recTo} setRecFrom={setRecFrom} setRecTo={setRecTo}
            notesMode={notesMode} setNotesMode={setNotesMode}
            active={hasMoreFilters}
          />
          {(filterCats.length + filterPrios.length + filterStatuses.length + filterOwners.length + filterTSC.length > 0 || hasMoreFilters || search) && (
            <Button variant="ghost" size="sm" onClick={() => {
              setFilterCats([]); setFilterPrios([]); setFilterStatuses([]); setFilterOwners([]); setFilterTSC([]);
              setReqFrom(''); setReqTo(''); setRecFrom(''); setRecTo(''); setNotesMode('any');
              setSearch('');
            }}>
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ViewMenu
              builtIns={SAVED_VIEWS}
              currentBuiltIn={view}
              onSelectBuiltIn={(id) => { applyFilters({ builtIn: id === 'all' ? undefined : id }); }}
              savedViews={savedViews}
              onApplySaved={(v) => applyFilters(v.filters)}
              onDeleteSaved={deleteView}
              onSaveCurrent={() => setShowSaveDialog(true)}
            />
          </div>
        </div>
        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 bg-navy-50 dark:bg-navy-800 border border-navy-200 dark:border-navy-700 rounded-md">
            <span className="text-[12px] font-medium">{selected.size} selected</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-ink-500">Status:</span>
              {STATUSES.map(s => (
                <button key={s} onClick={() => bulkSetStatus(s)} className="text-[11px] px-1.5 py-0.5 rounded hover:bg-navy-100 dark:hover:bg-navy-700">{s}</button>
              ))}
            </div>
            <BulkOwnerSet owners={ownerOptions} onSet={bulkSetOwner} />
            <Button variant="secondary" size="sm" onClick={bulkExport}>
              <Download className="w-3 h-3" /> Export selected
            </Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] text-ink-500 hover:text-ink-900">Clear</button>
          </div>
        )}
      </div>

      {viewMode === 'cards' && (
        <div className="flex-1 overflow-auto bg-canvas/40 dark:bg-navy-950 px-6 py-5">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-[1100px] mx-auto">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[120px] skeleton rounded-lg" />
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="max-w-md mx-auto text-center py-12 text-[13px]">
              {items.length === 0 ? (
                <>
                  <div className="text-ink-700 dark:text-slate-300 font-medium">No PBC items yet</div>
                  {role === 'auditor_lead' ? (
                    <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
                      Either pick a template when you next create an audit (
                      <a href="/engagements/new" className="text-navy-700 dark:text-navy-300 underline">new audit</a>
                      ), or upload your standard Excel here:{' '}
                      <a href="/settings" className="text-navy-700 dark:text-navy-300 underline">Settings → Re-sync from Excel</a>.
                    </p>
                  ) : role === 'auditor' ? (
                    <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
                      Ask the audit lead to import the PBC list from Excel via Settings.
                    </p>
                  ) : (
                    <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
                      The auditor is still setting things up. Items you&apos;ll need to provide will appear here.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-ink-500">
                  No items match the current filters.{' '}
                  <button
                    onClick={() => {
                      setSearch(''); setFilterCats([]); setFilterPrios([]); setFilterStatuses([]);
                      setFilterOwners([]); setFilterTSC([]);
                      setReqFrom(''); setReqTo(''); setRecFrom(''); setRecTo('');
                      setNotesMode('any'); setView('all');
                    }}
                    className="underline text-navy-700 dark:text-navy-300"
                  >Clear filters</button>
                </p>
              )}
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-w-[1500px] mx-auto">
              {filtered.map(item => {
                const overdue = isOverdue(item);
                const missingContext = !item.whyPurpose || !item.formatExpected;
                const isAuditor = role === 'auditor' || role === 'auditor_lead';
                return (
                  <button
                    key={item.id}
                    onClick={() => setOpenId(item.id)}
                    className={cn(
                      'group text-left rounded-xl border bg-white shadow-card dark:bg-navy-950 dark:shadow-none p-4 transition-all hover:border-navy-300 hover:shadow-card-hover dark:hover:border-navy-500',
                      'border-rule dark:border-navy-700',
                      overdue && 'border-l-4 border-l-danger',
                      !overdue && item.priority === 'High' && 'border-l-4 border-l-amber-500',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-[10.5px] uppercase tracking-wider text-ink-500 dark:text-slate-400 font-mono">
                        #{item.num} ·{' '}
                        <span
                          className="underline decoration-dotted underline-offset-2"
                          title={CATEGORY_COVERAGE[item.category as keyof typeof CATEGORY_COVERAGE]}
                        >
                          {item.category}
                        </span>
                      </div>
                      <StatusPill status={item.status} />
                    </div>
                    <div className="text-[13.5px] font-medium leading-snug text-ink-900 dark:text-slate-100 line-clamp-2 mb-3">
                      {item.itemRequested}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                      {item.entityId != null && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-navy-50 text-navy-700 ring-1 ring-inset ring-navy-200 px-1.5 py-0.5 text-[10.5px] font-medium dark:bg-navy-800 dark:text-navy-200 dark:ring-navy-700">
                          <Building2 className="w-3 h-3" />
                          {entityNameById.get(item.entityId) ?? 'Entity'}
                        </span>
                      )}
                      <Badge tone={item.priority === 'High' ? 'danger' : item.priority.startsWith('Medium') ? 'gold' : 'neutral'}>
                        {item.priority}
                      </Badge>
                      {overdue && <Badge tone="danger">Overdue</Badge>}
                      {item.ownerClient && (
                        <span className="text-ink-500 dark:text-slate-400">
                          Owner: <span className="text-ink-700 dark:text-slate-300">{item.ownerClient}</span>
                        </span>
                      )}
                      {!item.ownerClient && (
                        <span className="text-ink-500 italic">Unassigned</span>
                      )}
                      {isAuditor && missingContext && (
                        <span className="ml-auto inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 text-[10.5px]" title="Missing why or format">
                          <AlertTriangle className="w-3 h-3" /> Needs context
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'table' && (
      <div className="flex-1 overflow-auto bg-white dark:bg-navy-950">
        <table className="data-table">
          <thead>
            <tr>
              <th className="!px-2 sticky left-0 z-20 w-8">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === filtered.length}
                  onChange={e => setSelected(e.target.checked ? new Set(filtered.map(i => i.id)) : new Set())}
                  className="cursor-pointer"
                />
              </th>
              <Th sortable k="num" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="sticky left-8 z-20 bg-canvas dark:bg-navy-950 w-12">#</Th>
              <Th sortable k="category" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="sticky left-20 z-20 bg-canvas dark:bg-navy-950 w-[180px]">Category</Th>
              <th className="min-w-[420px]">Item Requested</th>
              <Th sortable k="priority" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[120px]">Priority</Th>
              <Th sortable k="ownerClient" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[140px]">Owner</Th>
              <Th sortable k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[120px]">Status</Th>
              <Th sortable k="dateRequested" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[110px]">Requested</Th>
              <Th sortable k="dateReceived" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[110px]">Received</Th>
              <th className="w-[80px]">TSC</th>
              <th className="min-w-[200px]">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 12 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={11} className="p-0"><div className="h-[34px] mx-3 my-1 skeleton" /></td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={11} className="text-center py-12 text-[13px]">
                {items.length === 0 ? (
                  <div className="max-w-md mx-auto">
                    <div className="text-ink-700 dark:text-slate-300 font-medium">No PBC items yet</div>
                    {role === 'auditor_lead' ? (
                      <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
                        Either pick a template when you next create an audit (
                        <a href="/engagements/new" className="text-navy-700 dark:text-navy-300 underline">new audit</a>
                        ), or upload your standard Excel here:{' '}
                        <a href="/settings" className="text-navy-700 dark:text-navy-300 underline">Settings → Re-sync from Excel</a>.
                      </p>
                    ) : (role === 'auditor') ? (
                      <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
                        Ask the audit lead to import the PBC list from Excel via Settings.
                      </p>
                    ) : (
                      <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
                        The auditor is still setting things up. Items you&apos;ll need to provide will appear here.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-ink-500">
                    No items match the current filters.{' '}
                    <button
                      onClick={() => {
                        setSearch(''); setFilterCats([]); setFilterPrios([]); setFilterStatuses([]);
                        setFilterOwners([]); setFilterTSC([]);
                        setReqFrom(''); setReqTo(''); setRecFrom(''); setRecTo('');
                        setNotesMode('any'); setView('all');
                      }}
                      className="underline text-navy-700 dark:text-navy-300"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </td></tr>
            )}
            {!loading && filtered.map(item => {
              const overdue = isOverdue(item);
              const isCursor = cursor === item.id;
              const isSelected = selected.has(item.id);
              return (
                <tr
                  key={item.id}
                  className={cn(
                    'group',
                    PRIORITY_BORDER[item.priority],
                    isCursor && 'bg-navy-50/50 dark:bg-navy-900/40',
                    isSelected && 'selected'
                  )}
                  onClick={() => setCursor(item.id)}
                >
                  <td className="!px-2 sticky left-0 z-10 bg-white dark:bg-navy-950 group-hover:bg-canvas/70 dark:group-hover:bg-navy-900/40 w-8">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} onClick={e => e.stopPropagation()} />
                  </td>
                  <td className="sticky left-8 z-10 bg-white dark:bg-navy-950 group-hover:bg-canvas/70 dark:group-hover:bg-navy-900/40 text-ink-500 tabular w-12">{item.num}</td>
                  <td
                    className="sticky left-20 z-10 bg-white dark:bg-navy-950 group-hover:bg-canvas/70 dark:group-hover:bg-navy-900/40 text-[12px] text-ink-700 dark:text-slate-300 truncate max-w-[180px]"
                    title={CATEGORY_COVERAGE[item.category as keyof typeof CATEGORY_COVERAGE]}
                  >
                    {item.category}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {item.entityId != null && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded bg-navy-50 text-navy-700 ring-1 ring-inset ring-navy-200 px-1.5 py-0.5 text-[10px] font-medium dark:bg-navy-800 dark:text-navy-200 dark:ring-navy-700">
                          <Building2 className="w-2.5 h-2.5" />
                          {entityNameById.get(item.entityId) ?? 'Entity'}
                        </span>
                      )}
                      <button
                        onClick={() => setOpenId(item.id)}
                        className="text-left text-[13px] text-ink-900 dark:text-slate-100 hover:text-navy-700 dark:hover:text-navy-300 line-clamp-1 min-w-0"
                      >
                        {item.itemRequested}
                      </button>
                    </div>
                  </td>
                  <td>
                    <InlineSelect
                      value={item.priority}
                      options={[...PRIORITIES]}
                      onCommit={v => patchItem(item.id, { priority: v as PBCItem['priority'] })}
                      renderValue={v => <span className="text-[12.5px] text-ink-700 dark:text-slate-300">{v}</span>}
                    />
                  </td>
                  <td>
                    <InlineText value={item.ownerClient} onCommit={v => patchItem(item.id, { ownerClient: v })} placeholder="—" />
                  </td>
                  <td>
                    <InlineSelect
                      value={item.status}
                      options={[...STATUSES]}
                      onCommit={v => patchItem(item.id, { status: v as PBCItem['status'] })}
                      renderValue={v => <StatusPill status={v} />}
                    />
                  </td>
                  <td>
                    <InlineDate value={item.dateRequested} onCommit={v => patchItem(item.id, { dateRequested: v })} />
                  </td>
                  <td className={cn(overdue && 'text-danger')}>
                    <InlineDate value={item.dateReceived} onCommit={v => patchItem(item.id, { dateReceived: v })} />
                    {overdue && <span className="ml-1 text-[10px] uppercase tracking-wider text-danger">overdue</span>}
                  </td>
                  <td className="text-[11px] text-ink-500">
                    {item.tscMapping.length > 0 ? item.tscMapping.map(t => t[0]).join('') : '—'}
                  </td>
                  <td className="text-[12.5px] text-ink-700 dark:text-slate-300">
                    <InlineText value={item.notes} onCommit={v => patchItem(item.id, { notes: v })} placeholder="—" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {openItem && (
        <PBCDetailPanel
          item={openItem}
          role={role}
          currentUserId={currentUserId}
          onClose={() => { setOpenId(null); router.replace('/pbc'); }}
          onPatch={(patch) => patchItem(openItem.id, patch)}
        />
      )}

      {showSaveDialog && (
        <SaveViewDialog
          onClose={() => setShowSaveDialog(false)}
          onSave={async (name) => { await saveView(name); setShowSaveDialog(false); }}
        />
      )}

      {showAdd && (
        <AddItemDialog
          title="Add PBC question"
          description="The section can be one of the existing categories or a new free-text section name."
          submitLabel="Add question"
          fields={[
            {
              name: 'category',
              label: 'Section',
              kind: 'combo',
              required: true,
              placeholder: 'e.g. Governance, or type a new section name',
              options: Array.from(new Set([...CATEGORIES, ...items.map(i => i.category)])).sort(),
              help: 'Pick from the standard categories or type your own.',
            },
            {
              name: 'itemRequested',
              label: 'Question / item requested',
              kind: 'textarea',
              required: true,
              placeholder: 'What evidence or answer do you need from the client?',
            },
            {
              name: 'whyPurpose',
              label: 'Why we need it',
              kind: 'textarea',
              placeholder: 'Optional — surfaces in the request to the client',
            },
            {
              name: 'formatExpected',
              label: 'Format expected',
              kind: 'text',
              placeholder: 'e.g. PDF export, screenshot, signed memo',
            },
            {
              name: 'priority',
              label: 'Priority',
              kind: 'select',
              options: PRIORITIES,
              defaultValue: 'Medium',
            },
          ]}
          onClose={() => setShowAdd(false)}
          onSubmit={async (values) => {
            const res = await fetch('/api/pbc', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body.error || `Failed (${res.status})`);
            }
            await load();
            flash();
          }}
        />
      )}
    </div>
  );
}

function Th({ children, k, sortable, sortKey, sortDir, onSort, className }: {
  children: React.ReactNode;
  k?: SortKey;
  sortable?: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortable && k === sortKey;
  return (
    <th className={cn(className)}>
      {sortable && k ? (
        <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-ink-900 dark:hover:text-slate-100">
          {children}
          {active && <span className="text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
        </button>
      ) : children}
    </th>
  );
}

function MultiFilter({ label, options, value, onChange, optionLabel }: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  optionLabel?: (o: string) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function on(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(o => !o)}>
        <Filter className="w-3 h-3" />
        {label}
        {value.length > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-navy-700 text-white text-[10px] font-semibold">{value.length}</span>}
        <ChevronDown className="w-3 h-3" />
      </Button>
      {open && (
        <div className="absolute z-30 mt-1 w-[220px] bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-lg p-1.5 max-h-[300px] overflow-y-auto">
          {options.length === 0 && <p className="px-2 py-2 text-[12px] text-ink-500">No values yet.</p>}
          {options.map(o => (
            <label key={o} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-canvas dark:hover:bg-navy-800 cursor-pointer text-[13px]">
              <input
                type="checkbox"
                checked={value.includes(o)}
                onChange={() => onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o])}
              />
              {optionLabel ? optionLabel(o) : o}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function BulkOwnerSet({ owners, onSet }: { owners: string[]; onSet: (owner: string | null) => void }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function on(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <span className="text-[11px] text-ink-500 mr-1">Owner:</span>
      <button onClick={() => setOpen(o => !o)} className="text-[11px] px-1.5 py-0.5 rounded hover:bg-navy-100 dark:hover:bg-navy-700 underline decoration-dotted underline-offset-2">
        Set…
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-[220px] bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-lg p-1.5">
          <div className="px-1 pb-1.5 mb-1 border-b border-rule dark:border-navy-800">
            <input
              autoFocus
              value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onSet(draft.trim()); setDraft(''); setOpen(false); } }}
              placeholder="New owner name…"
              className="w-full h-7 px-2 text-[12.5px] bg-canvas dark:bg-navy-800 rounded outline-none focus:ring-2 focus:ring-navy-400"
            />
          </div>
          <button onClick={() => { onSet(null); setOpen(false); }}
            className="block w-full text-left px-2 py-1 rounded hover:bg-canvas dark:hover:bg-navy-800 text-[12.5px] text-ink-500 italic">
            (unassigned)
          </button>
          {owners.map(o => (
            <button key={o} onClick={() => { onSet(o); setOpen(false); }}
              className="block w-full text-left px-2 py-1 rounded hover:bg-canvas dark:hover:bg-navy-800 text-[12.5px]">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MoreFilters({
  reqFrom, reqTo, setReqFrom, setReqTo,
  recFrom, recTo, setRecFrom, setRecTo,
  notesMode, setNotesMode, active,
}: {
  reqFrom: string; reqTo: string; setReqFrom: (v: string) => void; setReqTo: (v: string) => void;
  recFrom: string; recTo: string; setRecFrom: (v: string) => void; setRecTo: (v: string) => void;
  notesMode: 'any' | 'has' | 'none'; setNotesMode: (v: 'any' | 'has' | 'none') => void;
  active: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function on(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(o => !o)}>
        <ListFilter className="w-3 h-3" /> More
        {active && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-navy-700" />}
        <ChevronDown className="w-3 h-3" />
      </Button>
      {open && (
        <div className="absolute z-30 mt-1 w-[300px] right-0 bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-lg p-3 space-y-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Date requested</div>
            <div className="flex items-center gap-1.5">
              <input type="date" value={reqFrom} onChange={e => setReqFrom(e.target.value)}
                className="flex-1 h-7 rounded border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 px-2 text-[12px]" />
              <span className="text-[11px] text-ink-500">to</span>
              <input type="date" value={reqTo} onChange={e => setReqTo(e.target.value)}
                className="flex-1 h-7 rounded border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 px-2 text-[12px]" />
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Date received</div>
            <div className="flex items-center gap-1.5">
              <input type="date" value={recFrom} onChange={e => setRecFrom(e.target.value)}
                className="flex-1 h-7 rounded border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 px-2 text-[12px]" />
              <span className="text-[11px] text-ink-500">to</span>
              <input type="date" value={recTo} onChange={e => setRecTo(e.target.value)}
                className="flex-1 h-7 rounded border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 px-2 text-[12px]" />
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">Notes</div>
            <div className="flex items-center rounded-md border border-rule dark:border-navy-700 p-0.5">
              {(['any', 'has', 'none'] as const).map(m => (
                <button key={m} onClick={() => setNotesMode(m)}
                  className={`flex-1 h-7 text-[12px] rounded ${notesMode === m ? 'bg-canvas dark:bg-navy-800 font-medium' : 'text-ink-500 hover:text-ink-900 dark:hover:text-slate-100'}`}>
                  {m === 'any' ? 'Any' : m === 'has' ? 'Has notes' : 'No notes'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewMenu({
  builtIns, currentBuiltIn, onSelectBuiltIn,
  savedViews, onApplySaved, onDeleteSaved, onSaveCurrent,
}: {
  builtIns: { id: string; label: string }[];
  currentBuiltIn: string;
  onSelectBuiltIn: (id: string) => void;
  savedViews: SavedViewRecord[];
  onApplySaved: (v: SavedViewRecord) => void;
  onDeleteSaved: (id: number) => void;
  onSaveCurrent: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function on(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, [open]);
  const currentLabel = builtIns.find(b => b.id === currentBuiltIn)?.label ?? 'All items';
  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(o => !o)}>
        <Bookmark className="w-3 h-3" /> {currentLabel}
        <ChevronDown className="w-3 h-3" />
      </Button>
      {open && (
        <div className="absolute z-30 right-0 mt-1 w-[260px] bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-lg overflow-hidden">
          <div className="py-1">
            <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">Built-in views</div>
            {builtIns.map(v => (
              <button
                key={v.id}
                onClick={() => { onSelectBuiltIn(v.id); setOpen(false); }}
                className={`block w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-canvas dark:hover:bg-navy-800 ${currentBuiltIn === v.id ? 'font-medium text-navy-700 dark:text-navy-300' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {savedViews.length > 0 && (
            <div className="py-1 border-t border-rule dark:border-navy-800">
              <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">My saved views</div>
              {savedViews.map(v => (
                <div key={v.id} className="group flex items-center hover:bg-canvas dark:hover:bg-navy-800">
                  <button
                    onClick={() => { onApplySaved(v); setOpen(false); }}
                    className="flex-1 text-left px-3 py-1.5 text-[12.5px] truncate"
                  >
                    {v.name}
                  </button>
                  <button
                    onClick={() => onDeleteSaved(v.id)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-1 text-ink-500 hover:text-danger transition-opacity"
                    title="Delete saved view"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="py-1 border-t border-rule dark:border-navy-800">
            <button
              onClick={() => { onSaveCurrent(); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-[12.5px] text-navy-700 dark:text-navy-300 hover:bg-canvas dark:hover:bg-navy-800 inline-flex items-center gap-1.5"
            >
              <BookmarkPlus className="w-3 h-3" /> Save current as view…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveViewDialog({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    await onSave(name.trim());
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-xl w-[420px]" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-3 border-b border-rule dark:border-navy-800">
          <div className="text-[14px] font-semibold">Save current filters as a view</div>
          <p className="text-[11.5px] text-ink-500 mt-0.5">Captures search, filters, date ranges, and built-in view selection.</p>
        </div>
        <div className="px-5 py-4">
          <label className="block text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1.5">View name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="e.g. Access Mgmt — High awaiting client"
            className="w-full h-9 px-2.5 rounded-md border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 text-[13px] focus:outline-none focus:ring-2 focus:ring-navy-400"
          />
        </div>
        <div className="px-5 py-3 border-t border-rule dark:border-navy-800 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={!name.trim() || busy}>Save view</Button>
        </div>
      </div>
    </div>
  );
}
