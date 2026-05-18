'use client';
import * as React from 'react';
import type { AccessRequest } from '@/types';
import { ACCESS_STATUSES } from '@/lib/utils';
import { InlineDate, InlineSelect, InlineText } from '@/components/tables/InlineEdit';
import { StatusPill, Badge } from '@/components/ui/badge';
import { SavedFlash, useSaveIndicator } from '@/components/tables/SavedIndicator';
import HelpStrip from '@/components/ui/HelpStrip';
import ViewToggle, { useViewMode } from '@/components/tables/ViewToggle';
import ContextSection from '@/components/ui/ContextSection';
import { X, KeyRound, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AddItemDialog from '@/components/ui/AddItemDialog';

type Role = 'auditor_lead' | 'auditor' | 'client_owner' | 'client_reviewer';

export default function AccessView() {
  const [items, setItems] = React.useState<AccessRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewMode, setViewMode] = useViewMode('access', 'cards');
  const [openId, setOpenId] = React.useState<number | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [role, setRole] = React.useState<Role>('auditor_lead');
  const { savedKey, flash } = useSaveIndicator();

  React.useEffect(() => { load(); }, []);
  React.useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.user?.currentRole) setRole(d.user.currentRole);
    }).catch(() => {});
  }, []);
  async function load() {
    const r = await fetch('/api/access'); setItems(await r.json()); setLoading(false);
  }
  async function patch(id: number, p: Partial<AccessRequest>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...p } : i));
    const r = await fetch(`/api/access/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    if (r.ok) {
      const updated: AccessRequest = await r.json();
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      flash();
    }
  }

  const isAuditor = role === 'auditor' || role === 'auditor_lead';
  const openItem = openId ? items.find(i => i.id === openId) ?? null : null;
  const notRequestedCount = items.filter(i => i.status === 'Not Requested').length;

  return (
    <div className="px-6 py-7 max-w-[1500px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[21px] font-semibold tracking-tight">Access requests</h1>
          <p className="text-[12.5px] text-ink-500 dark:text-slate-400 mt-1">
            {items.length} read-only access requests · {notRequestedCount > 0 ? (
              <span className="text-danger">{notRequestedCount} still not requested</span>
            ) : <span className="text-emerald-700">all in motion</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SavedFlash savedKey={savedKey} />
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          {role === 'auditor_lead' && (
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" /> Add access request
            </Button>
          )}
        </div>
      </div>

      <HelpStrip
        storageKey="access-list"
        title="What are access requests?"
      >
        These are the read-only logins the audit team needs in client systems
        (Active Directory, ERP, source control, etc.) to test controls without
        touching production. Each row explains <strong>why</strong> the access
        is needed and the <strong>recommended built-in role</strong> to grant.
        Click a row to see full justification and provisioning detail.
      </HelpStrip>

      {viewMode === 'cards' && (
        <CardList items={items} loading={loading} role={role} onOpen={setOpenId} />
      )}

      {viewMode === 'table' && (
        <div className="rounded-xl border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 shadow-card dark:shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th className="min-w-[200px]">System / Platform</th>
                  <th className="min-w-[160px]">Access Type</th>
                  <th className="min-w-[240px]">Role / Permissions</th>
                  <th className="min-w-[160px]">Recommended Method</th>
                  <th className="w-[140px]">Owner</th>
                  <th className="w-[120px]">Status</th>
                  <th className="w-[110px]">Provisioned</th>
                  <th className="min-w-[180px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="p-0"><div className="h-[34px] mx-3 my-1 skeleton" /></td></tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-[13px]"><EmptyState isAuditor={isAuditor} /></td></tr>
                )}
                {!loading && items.map(item => (
                  <tr key={item.id} className="cursor-pointer hover:bg-canvas/60 dark:hover:bg-navy-900/40" onClick={() => setOpenId(item.id)}>
                    <td className="text-ink-500 tabular">{item.num}</td>
                    <td className="text-[13px] font-medium">{item.system}</td>
                    <td className="text-[12.5px] text-ink-700 dark:text-slate-300">{item.accessType}</td>
                    <td className="text-[12px] text-ink-700 dark:text-slate-300 line-clamp-2 max-w-[260px]">{item.rolePermissions}</td>
                    <td className="text-[12.5px] text-ink-700 dark:text-slate-300">{item.recommendedMethod}</td>
                    <td onClick={e => e.stopPropagation()}><InlineText value={item.ownerClient} onCommit={v => patch(item.id, { ownerClient: v })} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <InlineSelect
                        value={item.status} options={[...ACCESS_STATUSES]}
                        onCommit={v => patch(item.id, { status: v as AccessRequest['status'] })}
                        renderValue={v => <StatusPill status={v} />}
                      />
                    </td>
                    <td onClick={e => e.stopPropagation()}><InlineDate value={item.provisionedDate} onCommit={v => patch(item.id, { provisionedDate: v })} /></td>
                    <td className="text-[12.5px]" onClick={e => e.stopPropagation()}><InlineText value={item.notes} onCommit={v => patch(item.id, { notes: v })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openItem && (
        <AccessDetailDialog
          item={openItem}
          isAuditor={isAuditor}
          onClose={() => setOpenId(null)}
          onPatch={(p) => patch(openItem.id, p)}
        />
      )}

      {showAdd && (
        <AddItemDialog
          title="Add access request"
          description="System can be one of the existing entries or a new free-text section name."
          submitLabel="Add access request"
          fields={[
            {
              name: 'system',
              label: 'Section / system',
              kind: 'combo',
              required: true,
              placeholder: 'e.g. Active Directory',
              options: Array.from(new Set(items.map(i => i.system).filter(Boolean))).sort(),
              help: 'Pick from existing systems or type a new section.',
            },
            { name: 'accessType', label: 'Access type', kind: 'text', placeholder: 'e.g. Read-only' },
            { name: 'rolePermissions', label: 'Role / permissions', kind: 'text', placeholder: 'e.g. Domain Audit' },
            { name: 'recommendedMethod', label: 'Recommended method', kind: 'text', placeholder: 'e.g. Built-in role' },
            { name: 'justification', label: 'Justification', kind: 'textarea', placeholder: 'Why is this access required?' },
          ]}
          onClose={() => setShowAdd(false)}
          onSubmit={async (values) => {
            const res = await fetch('/api/access', {
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

function EmptyState({ isAuditor }: { isAuditor: boolean }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="text-ink-700 dark:text-slate-300 font-medium">No access requests yet</div>
      <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
        {isAuditor ? (
          <>Access requests are usually seeded from a template or imported via{' '}
          <a href="/settings" className="text-navy-700 dark:text-navy-300 underline">Settings → Re-sync from Excel</a>.</>
        ) : (
          <>The audit team hasn&apos;t requested access yet. When they do, you&apos;ll see the system, role, and justification here.</>
        )}
      </p>
    </div>
  );
}

function CardList({
  items, loading, role, onOpen,
}: {
  items: AccessRequest[];
  loading: boolean;
  role: Role;
  onOpen: (id: number) => void;
}) {
  const isAuditor = role === 'auditor' || role === 'auditor_lead';
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[160px] skeleton rounded-lg" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return <div className="py-12 text-center"><EmptyState isAuditor={isAuditor} /></div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onOpen(item.id)}
          className="text-left rounded-xl border border-rule dark:border-navy-700 bg-white dark:bg-navy-950 shadow-card dark:shadow-none p-4 transition-all hover:border-navy-300 hover:shadow-card-hover dark:hover:border-navy-500"
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="text-[10.5px] uppercase tracking-wider text-ink-500 dark:text-slate-400 font-mono">
              #{item.num}
            </div>
            <StatusPill status={item.status} />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-3.5 h-3.5 text-navy-700 dark:text-navy-300 shrink-0" />
            <span className="text-[14px] font-semibold leading-snug">{item.system}</span>
          </div>
          {item.accessType && (
            <Badge tone="neutral">{item.accessType}</Badge>
          )}
          {item.justification ? (
            <p className="text-[12px] text-ink-700 dark:text-slate-300 leading-relaxed line-clamp-2 mt-2">
              <span className="font-semibold text-ink-500 dark:text-slate-400">Why:</span> {item.justification}
            </p>
          ) : (
            <p className="text-[12px] text-ink-500 italic mt-2">
              {isAuditor ? 'No justification yet — click to add one.' : 'No justification provided.'}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-ink-500 dark:text-slate-400 mt-2.5 flex-wrap">
            {item.recommendedMethod && (
              <span className="truncate">Method: <span className="text-ink-700 dark:text-slate-300">{item.recommendedMethod}</span></span>
            )}
            {item.ownerClient ? (
              <span>Owner: <span className="text-ink-700 dark:text-slate-300">{item.ownerClient}</span></span>
            ) : (
              <span className="italic">Unassigned</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function AccessDetailDialog({ item, isAuditor, onClose, onPatch }: {
  item: AccessRequest;
  isAuditor: boolean;
  onClose: () => void;
  onPatch: (p: Partial<AccessRequest>) => void;
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
                Access request #{item.num}
              </div>
              <div className="text-[16px] font-semibold tracking-tight leading-tight inline-flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-navy-700 dark:text-navy-300" />
                {item.system}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusPill status={item.status} />
                {item.accessType && <Badge tone="neutral">{item.accessType}</Badge>}
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-canvas dark:hover:bg-navy-800">
              <X className="w-4 h-4 text-ink-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <ContextSection
            label="System in scope"
            audience="client"
          >
            {isAuditor ? (
              <InlineText
                value={item.system}
                onCommit={v => onPatch({ system: v ?? '' } as Partial<AccessRequest>)}
                placeholder="e.g. Active Directory / Entra ID"
              />
            ) : (
              <p className="text-ink-900 dark:text-slate-100">{item.system}</p>
            )}
          </ContextSection>

          <ContextSection
            label="Why this access is needed"
            audience="client"
          >
            {isAuditor ? (
              <InlineText
                value={item.justification}
                onCommit={v => onPatch({ justification: v ?? '' } as Partial<AccessRequest>)}
                placeholder="e.g. Required for testing joiner/mover/leaver controls and privileged access reviews…"
                multiline
              />
            ) : (
              <p className="text-ink-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {item.justification || <span className="text-ink-500 italic">No justification yet — reach out to the audit team if it&apos;s unclear why this is needed.</span>}
              </p>
            )}
          </ContextSection>

          <ContextSection
            label="Permissions we need"
            audience="client"
          >
            <InlineText
              value={item.rolePermissions}
              onCommit={v => onPatch({ rolePermissions: v ?? '' } as Partial<AccessRequest>)}
              placeholder="e.g. Read users, groups, group memberships, last logon"
              multiline
            />
          </ContextSection>

          <ContextSection
            label="Recommended method to grant"
            audience="client"
          >
            <InlineText
              value={item.recommendedMethod}
              onCommit={v => onPatch({ recommendedMethod: v ?? '' } as Partial<AccessRequest>)}
              placeholder="e.g. Built-in Reader role / Custom RBAC / Security group membership"
            />
          </ContextSection>

          <div className="rounded-lg border border-rule dark:border-navy-800 bg-canvas/40 dark:bg-navy-900/40 p-3.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400 mb-2.5">
              Provisioning
            </div>
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <Field label="Access type">
                <InlineText
                  value={item.accessType}
                  onCommit={v => onPatch({ accessType: v ?? '' } as Partial<AccessRequest>)}
                  placeholder="e.g. Read-only auditor"
                />
              </Field>
              <Field label="Status">
                <InlineSelect
                  value={item.status} options={[...ACCESS_STATUSES]}
                  onCommit={v => onPatch({ status: v as AccessRequest['status'] })}
                  renderValue={v => <StatusPill status={v} />}
                />
              </Field>
              <Field label="Owner (Client)">
                <InlineText value={item.ownerClient} onCommit={v => onPatch({ ownerClient: v })} placeholder="Who is provisioning this" />
              </Field>
              <Field label="Provisioned date">
                <InlineDate value={item.provisionedDate} onCommit={v => onPatch({ provisionedDate: v })} />
              </Field>
            </div>
          </div>

          <ContextSection
            label="Notes"
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
