'use client';
import * as React from 'react';
import { Search } from 'lucide-react';
import Link from 'next/link';

interface SearchResult {
  type: 'pbc' | 'walkthrough' | 'entity' | 'access';
  id: number;
  title: string;
  subtitle?: string;
  href: string;
}

export default function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isField = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === '/' && !isField) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
        setQ('');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  React.useEffect(() => {
    if (!q) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(setResults)
        .catch(() => {});
    }, 100);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const grouped = React.useMemo(() => {
    const g: Record<string, SearchResult[]> = {};
    for (const r of results) {
      g[r.type] ??= [];
      g[r.type].push(r);
    }
    return g;
  }, [results]);

  const labels: Record<string, string> = {
    pbc: 'PBC items', walkthrough: 'Walkthroughs', entity: 'Entities', access: 'Access requests',
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="h-7 px-2.5 inline-flex items-center gap-2 rounded border border-rule bg-white dark:bg-navy-900 dark:border-navy-700 text-[12px] text-ink-500 dark:text-slate-400 hover:bg-canvas dark:hover:bg-navy-800 w-[200px]"
      >
        <Search className="w-3.5 h-3.5" />
        Search
        <kbd className="ml-auto rounded border border-rule dark:border-navy-700 px-1 text-[10px] text-ink-500">/</kbd>
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-[420px] z-50 bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-rule dark:border-navy-700 flex items-center px-3">
            <Search className="w-3.5 h-3.5 text-ink-500" />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search items, walkthroughs, entities…"
              className="flex-1 h-9 bg-transparent px-2 text-[13px] focus:outline-none"
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {q && results.length === 0 && (
              <div className="px-4 py-6 text-[12px] text-ink-500 text-center">No results.</div>
            )}
            {Object.entries(grouped).map(([k, items]) => (
              <div key={k} className="py-1">
                <div className="px-3 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-slate-400">
                  {labels[k] || k}
                </div>
                {items.slice(0, 8).map(r => (
                  <Link
                    key={`${r.type}-${r.id}`}
                    href={r.href}
                    onClick={() => { setOpen(false); setQ(''); }}
                    className="block px-3 py-1.5 hover:bg-canvas dark:hover:bg-navy-800"
                  >
                    <div className="text-[13px] truncate">{r.title}</div>
                    {r.subtitle && <div className="text-[11px] text-ink-500 truncate">{r.subtitle}</div>}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
