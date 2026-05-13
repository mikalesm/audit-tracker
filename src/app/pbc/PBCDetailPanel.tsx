'use client';
import * as React from 'react';
import type { PBCItem, EvidenceFile, ActivityLog } from '@/types';
import { Button } from '@/components/ui/button';
import { StatusPill, Badge } from '@/components/ui/badge';
import { InlineDate, InlineSelect, InlineText } from '@/components/tables/InlineEdit';
import { STATUSES, PRIORITIES, TSC_VALUES, formatDate, formatDateTime, fileSize, isOverdue } from '@/lib/utils';
import { Upload, X, Trash2, Paperclip, Link2, Plus, Search } from 'lucide-react';

type Role = 'auditor_lead' | 'auditor' | 'client_owner' | 'client_reviewer';

export default function PBCDetailPanel({ item, onClose, onPatch, role = 'auditor_lead' }: {
  item: PBCItem;
  onClose: () => void;
  onPatch: (patch: Partial<PBCItem>) => void;
  /** Used to gate the Internal Comments tab to auditors only. */
  role?: Role;
}) {
  const isAuditor = role === 'auditor_lead' || role === 'auditor';
  type Tab = 'detail' | 'evidence' | 'activity' | 'comments';
  const initialTab: Tab = 'detail';
  const [tab, setTab] = React.useState<Tab>(initialTab);
  // If a client is somehow on the comments tab (e.g. role changed mid-session), snap back.
  React.useEffect(() => { if (!isAuditor && tab === 'comments') setTab('detail'); }, [isAuditor, tab]);
  const tabs: Tab[] = isAuditor
    ? ['detail', 'evidence', 'activity', 'comments']
    : ['detail', 'evidence', 'activity'];
  const [evidence, setEvidence] = React.useState<EvidenceFile[]>([]);
  const [activity, setActivity] = React.useState<ActivityLog[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [allItems, setAllItems] = React.useState<PBCItem[]>([]);
  const linkedItems = React.useMemo(
    () => allItems.filter(p => item.linkedItems.includes(p.id)),
    [allItems, item.linkedItems]
  );

  React.useEffect(() => {
    fetch(`/api/evidence/${item.id}`).then(r => r.json()).then(setEvidence).catch(() => {});
    fetch(`/api/activity?type=pbc&id=${item.id}`).then(r => r.json()).then(setActivity).catch(() => {});
    fetch('/api/pbc').then(r => r.json()).then(setAllItems).catch(() => {});
  }, [item.id]);

  function addLink(targetId: number) {
    if (item.linkedItems.includes(targetId) || targetId === item.id) return;
    onPatch({ linkedItems: [...item.linkedItems, targetId] });
  }
  function removeLink(targetId: number) {
    onPatch({ linkedItems: item.linkedItems.filter(id => id !== targetId) });
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('file', f);
    const res = await fetch(`/api/evidence/${item.id}`, { method: 'POST', body: fd });
    if (res.ok) {
      const list = await fetch(`/api/evidence/${item.id}`).then(r => r.json());
      setEvidence(list);
    }
  }

  async function deleteFile(id: number) {
    await fetch(`/api/evidence/file/${id}`, { method: 'DELETE' });
    setEvidence(e => e.filter(x => x.id !== id));
  }

  function toggleTSC(t: string) {
    const next = item.tscMapping.includes(t as PBCItem['tscMapping'][number])
      ? item.tscMapping.filter(x => x !== t)
      : [...item.tscMapping, t as PBCItem['tscMapping'][number]];
    onPatch({ tscMapping: next });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 dark:bg-black/50" />
      <div
        className="relative w-[600px] max-w-[90vw] h-full bg-white dark:bg-navy-950 border-l border-rule dark:border-navy-800 shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 border-b border-rule dark:border-navy-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-ink-500 dark:text-slate-400 mb-1">
                #{item.num} · {item.category}
              </div>
              <div className="text-[15px] font-semibold tracking-tight leading-tight text-ink-900 dark:text-slate-100">
                {item.itemRequested}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusPill status={item.status} />
                <Badge tone={item.priority === 'High' ? 'danger' : item.priority.startsWith('Medium') ? 'gold' : 'neutral'}>
                  {item.priority}
                </Badge>
                {isOverdue(item) && <Badge tone="danger">Overdue</Badge>}
                {item.tscMapping.map(t => <Badge key={t} tone="neutral">{t}</Badge>)}
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-canvas dark:hover:bg-navy-800">
              <X className="w-4 h-4 text-ink-500" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-1 -mb-3">
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2.5 py-1.5 text-[12.5px] capitalize border-b-2 -mb-px ${tab === t ? 'border-navy-700 text-navy-700 dark:text-navy-300 dark:border-navy-300 font-medium' : 'border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-slate-100'}`}
              >
                {t === 'detail' ? 'Detail' : t === 'evidence' ? `Evidence${evidence.length ? ` (${evidence.length})` : ''}` : t === 'activity' ? `Activity${activity.length ? ` (${activity.length})` : ''}` : 'Comments'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'detail' && (
            <div className="space-y-5 text-[13px]">
              <Section label="Why / Audit Purpose">
                <p className="text-ink-700 dark:text-slate-300 leading-relaxed">{item.whyPurpose || '—'}</p>
              </Section>
              <Section label="Format Expected">
                <p className="text-ink-700 dark:text-slate-300">{item.formatExpected || '—'}</p>
              </Section>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Status">
                  <InlineSelect
                    value={item.status} options={[...STATUSES]}
                    onCommit={v => onPatch({ status: v as PBCItem['status'] })}
                    renderValue={v => <StatusPill status={v} />}
                  />
                </Field>
                <Field label="Priority">
                  <InlineSelect
                    value={item.priority} options={[...PRIORITIES]}
                    onCommit={v => onPatch({ priority: v as PBCItem['priority'] })}
                    renderValue={v => <span>{v}</span>}
                  />
                </Field>
                <Field label="Owner (Client)">
                  <InlineText value={item.ownerClient} onCommit={v => onPatch({ ownerClient: v })} placeholder="Unassigned" />
                </Field>
                <Field label="Date Requested">
                  <InlineDate value={item.dateRequested} onCommit={v => onPatch({ dateRequested: v })} />
                </Field>
                <Field label="Date Received">
                  <InlineDate value={item.dateReceived} onCommit={v => onPatch({ dateReceived: v })} />
                </Field>
                <Field label="Updated">
                  <span className="text-ink-500">{formatDateTime(item.updatedAt)}</span>
                </Field>
              </div>
              <Section label="SOC 2 TSC Mapping">
                <div className="flex flex-wrap gap-1.5">
                  {TSC_VALUES.map(t => {
                    const on = item.tscMapping.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => toggleTSC(t)}
                        className={`px-2 py-0.5 text-[11.5px] rounded ring-1 ring-inset ${on ? 'bg-navy-700 text-white ring-navy-700' : 'bg-white text-ink-700 ring-rule hover:bg-canvas dark:bg-navy-900 dark:text-slate-300 dark:ring-navy-700'}`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section label="Notes (shared)">
                <InlineText value={item.notes} onCommit={v => onPatch({ notes: v })} placeholder="Add a note…" multiline />
              </Section>
              <Section label="Linked items">
                <div className="space-y-1">
                  {linkedItems.length === 0 && <p className="text-ink-500 text-[12px]">Link related items (e.g. HR list ↔ AD dump for reconciliation).</p>}
                  {linkedItems.map(li => (
                    <div key={li.id} className="flex items-center gap-2 text-[12.5px] group">
                      <Link2 className="w-3 h-3 text-ink-500 shrink-0" />
                      <span className="text-ink-500 shrink-0">#{li.num}</span>
                      <span className="truncate flex-1">{li.itemRequested}</span>
                      <button
                        onClick={() => removeLink(li.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-canvas dark:hover:bg-navy-800 text-ink-500 hover:text-danger transition-opacity"
                        title="Remove link"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <LinkPicker
                    allItems={allItems}
                    excludeIds={[item.id, ...item.linkedItems]}
                    onPick={addLink}
                  />
                </div>
              </Section>
            </div>
          )}

          {tab === 'evidence' && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
                className={`border border-dashed rounded-lg px-4 py-6 text-center transition-colors ${dragOver ? 'border-navy-400 bg-navy-50 dark:bg-navy-900' : 'border-rule dark:border-navy-700'}`}
              >
                <Upload className="w-5 h-5 mx-auto text-ink-500 mb-1.5" />
                <div className="text-[13px] font-medium">Drop files to upload</div>
                <div className="text-[11.5px] text-ink-500 mt-0.5">Files stay local in <code className="text-[11px]">data/evidence/{item.id}/</code></div>
                <label className="inline-flex mt-2.5">
                  <input type="file" multiple className="hidden" onChange={e => uploadFiles(e.target.files)} />
                  <span className="cursor-pointer inline-flex items-center text-[12px] text-navy-700 dark:text-navy-300 hover:underline">or browse</span>
                </label>
              </div>
              <div className="space-y-1.5">
                {evidence.length === 0 && <p className="text-[12px] text-ink-500">No evidence uploaded yet.</p>}
                {evidence.map(f => (
                  <div key={f.id} className="flex items-center gap-2.5 px-3 py-2 border border-rule dark:border-navy-700 rounded">
                    <Paperclip className="w-3.5 h-3.5 text-ink-500" />
                    <a href={`/api/evidence/file/${f.id}`} className="text-[13px] truncate flex-1 hover:text-navy-700 dark:hover:text-navy-300">{f.filename}</a>
                    <span className="text-[11px] text-ink-500 tabular">{fileSize(f.size)}</span>
                    <span className="text-[11px] text-ink-500">{formatDate(f.uploadedAt)}</span>
                    <button onClick={() => deleteFile(f.id)} className="p-1 rounded hover:bg-canvas dark:hover:bg-navy-800 text-ink-500 hover:text-danger">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-2">
              {activity.length === 0 && <p className="text-[12px] text-ink-500">No activity yet.</p>}
              {activity.map(a => (
                <div key={a.id} className="text-[12.5px] flex items-start gap-2 py-1.5 border-b border-rule dark:border-navy-800 last:border-0">
                  <span className="text-ink-500 tabular w-[120px] shrink-0">{formatDateTime(a.ts)}</span>
                  <span className="text-ink-700 dark:text-slate-300">
                    <span className="font-medium">{a.field}</span>
                    {a.oldValue !== null && <> · <span className="text-ink-500 line-through">{a.oldValue}</span></>}
                    {a.newValue !== null && <> → <span>{a.newValue}</span></>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {isAuditor && tab === 'comments' && (
            <div className="space-y-3">
              <Section label="Internal comments (auditor-only)">
                <InlineText value={item.internalComments} onCommit={v => onPatch({ internalComments: v })} placeholder="Notes for the audit team. Not exported to client report." multiline />
                <p className="text-[11px] text-ink-500 mt-2">These notes are excluded from the client-facing PDF.</p>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="text-[13px]">{children}</div>
    </div>
  );
}
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function LinkPicker({ allItems, excludeIds, onPick }: {
  allItems: PBCItem[];
  excludeIds: number[];
  onPick: (id: number) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function on(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, [open]);

  React.useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  const candidates = React.useMemo(() => {
    const term = q.toLowerCase().trim();
    return allItems
      .filter(i => !excludeIds.includes(i.id))
      .filter(i => !term ||
        i.itemRequested.toLowerCase().includes(term) ||
        i.category.toLowerCase().includes(term) ||
        String(i.num).includes(term))
      .slice(0, 20);
  }, [allItems, excludeIds, q]);

  return (
    <div className="relative pt-1" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 text-[12px] text-navy-700 dark:text-navy-300 hover:underline"
      >
        <Plus className="w-3 h-3" /> Link an item
      </button>
      {open && (
        <div className="absolute z-30 left-0 mt-1 w-[420px] max-w-[calc(100vw-2rem)] bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-rule dark:border-navy-700 flex items-center px-3">
            <Search className="w-3.5 h-3.5 text-ink-500" />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search PBC items by # or text…"
              className="flex-1 h-9 bg-transparent px-2 text-[13px] focus:outline-none"
            />
          </div>
          <div className="max-h-[260px] overflow-y-auto py-1">
            {candidates.length === 0 && <p className="px-3 py-3 text-[12px] text-ink-500 text-center">No matching items.</p>}
            {candidates.map(c => (
              <button
                key={c.id}
                onClick={() => { onPick(c.id); setOpen(false); setQ(''); }}
                className="w-full text-left px-3 py-1.5 hover:bg-canvas dark:hover:bg-navy-800"
              >
                <div className="text-[12.5px] truncate">
                  <span className="text-ink-500 mr-1.5">#{c.num}</span>
                  {c.itemRequested}
                </div>
                <div className="text-[11px] text-ink-500 truncate">{c.category} · {c.status}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
