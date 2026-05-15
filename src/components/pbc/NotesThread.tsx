'use client';
import * as React from 'react';
import { Pencil, Trash2, Check, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Note {
  id: number;
  pbcItemId: number;
  userId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  authorEmail: string;
  authorName: string | null;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fullStamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

function initials(name: string | null, email: string): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/**
 * Threaded notes for a PBC item — replaces the legacy single TEXT field.
 * Author + timestamp on every entry, Enter-to-send composer, edit/delete on
 * own notes (auditor_lead can also delete others'). Shared between auditor
 * and client roles.
 */
export default function NotesThread({
  pbcItemId,
  currentUserId,
  isAuditorLead,
  canWrite,
}: {
  pbcItemId: number;
  currentUserId: number;
  isAuditorLead: boolean;
  canWrite: boolean;
}) {
  const [notes, setNotes] = React.useState<Note[] | null>(null);
  const [draft, setDraft] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editText, setEditText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  // Bump to force a re-render so relTime stays current — every minute is fine.
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    fetch(`/api/pbc/${pbcItemId}/notes`)
      .then(r => r.ok ? r.json() : [])
      .then(setNotes)
      .catch(() => setNotes([]));
  }, [pbcItemId]);

  React.useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  async function send() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);
    try {
      const r = await fetch(`/api/pbc/${pbcItemId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Failed to post note'); return; }
      setNotes(prev => prev ? [...prev, data] : [data]);
      setDraft('');
    } finally {
      setPosting(false);
    }
  }

  async function saveEdit(id: number) {
    const body = editText.trim();
    if (!body) return;
    setError(null);
    const r = await fetch(`/api/pbc/${pbcItemId}/notes/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    const data = await r.json();
    if (!r.ok) { setError(data.error || 'Failed to update note'); return; }
    setNotes(prev => prev?.map(n => n.id === id ? data : n) ?? null);
    setEditingId(null);
    setEditText('');
  }

  async function remove(id: number) {
    if (!confirm('Delete this note?')) return;
    setError(null);
    const r = await fetch(`/api/pbc/${pbcItemId}/notes/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error || 'Failed to delete note');
      return;
    }
    setNotes(prev => prev?.filter(n => n.id !== id) ?? null);
  }

  function onComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
  function onEditKey(e: React.KeyboardEvent<HTMLTextAreaElement>, id: number) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit(id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingId(null);
      setEditText('');
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {notes === null && <div className="h-12 skeleton rounded" />}
        {notes !== null && notes.length === 0 && (
          <p className="text-[12px] text-ink-500 italic">No notes yet.</p>
        )}
        {notes !== null && notes.map(n => {
          const mine = n.userId === currentUserId;
          const editing = editingId === n.id;
          const canDelete = mine || isAuditorLead;
          return (
            <div key={n.id} className="group flex items-start gap-2.5">
              <div className={cn(
                'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold',
                mine
                  ? 'bg-navy-700 text-white'
                  : 'bg-canvas text-ink-700 ring-1 ring-rule dark:bg-navy-800 dark:text-slate-200 dark:ring-navy-700',
              )}>
                {initials(n.authorName, n.authorEmail)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[12.5px] font-medium text-ink-900 dark:text-slate-100">
                    {n.authorName || n.authorEmail}
                  </span>
                  <span
                    className="text-[10.5px] text-ink-500 dark:text-slate-400 tabular"
                    title={fullStamp(n.createdAt)}
                  >
                    {relTime(n.createdAt)}
                  </span>
                  {n.editedAt && (
                    <span className="text-[10.5px] text-ink-500 italic" title={`Edited ${fullStamp(n.editedAt)}`}>
                      (edited)
                    </span>
                  )}
                  {canWrite && (mine || canDelete) && !editing && (
                    <span className="ml-auto opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 transition-opacity">
                      {mine && (
                        <button
                          type="button"
                          onClick={() => { setEditingId(n.id); setEditText(n.body); }}
                          className="p-1 rounded hover:bg-canvas dark:hover:bg-navy-800 text-ink-500 hover:text-ink-900 dark:hover:text-slate-100"
                          aria-label="Edit note"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => remove(n.id)}
                          className="p-1 rounded hover:bg-canvas dark:hover:bg-navy-800 text-ink-500 hover:text-danger"
                          aria-label="Delete note"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
                {editing ? (
                  <div className="mt-1">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => onEditKey(e, n.id)}
                      rows={Math.min(6, Math.max(2, editText.split('\n').length))}
                      className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-[13px] text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-100"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => saveEdit(n.id)}
                        className="inline-flex items-center gap-1 px-2 h-7 rounded-md bg-navy-700 text-white text-[11.5px] hover:bg-navy-800"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingId(null); setEditText(''); }}
                        className="inline-flex items-center gap-1 px-2 h-7 rounded-md border border-rule text-[11.5px] hover:bg-canvas dark:border-navy-700 dark:hover:bg-navy-800"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      <span className="text-[10.5px] text-ink-500">Enter saves · Shift+Enter for newline</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-ink-700 dark:text-slate-300 leading-relaxed whitespace-pre-line mt-0.5">
                    {n.body}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canWrite && (
        <div className="pt-1">
          <div className="relative">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={onComposerKey}
              placeholder="Write a note… (Enter to send, Shift+Enter for newline)"
              rows={Math.min(5, Math.max(2, draft.split('\n').length))}
              disabled={posting}
              className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 pr-11 text-[13px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 disabled:opacity-50 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={send}
              disabled={posting || !draft.trim()}
              className="absolute right-2 bottom-2 inline-flex items-center justify-center w-7 h-7 rounded-md bg-navy-700 text-white hover:bg-navy-800 disabled:opacity-40 disabled:hover:bg-navy-700"
              aria-label="Send note"
              title="Send (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-[12px] text-red-600 dark:text-red-400">{error}</div>
      )}
    </div>
  );
}
