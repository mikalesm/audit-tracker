'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

const SHORTCUTS = [
  { keys: '/', description: 'Focus global search' },
  { keys: '?', description: 'Show this overlay' },
  { keys: 'g d', description: 'Go to Dashboard' },
  { keys: 'g p', description: 'Go to PBC List' },
  { keys: 'g a', description: 'Go to Access' },
  { keys: 'g w', description: 'Go to Walkthroughs' },
  { keys: 'g e', description: 'Go to Entities' },
  { keys: 'g s', description: 'Go to Sampling' },
  { keys: 'g t', description: 'Go to Activity timeline' },
  { keys: 'g r', description: 'Go to Reports' },
  { keys: 'g ,', description: 'Go to Settings' },
  { keys: 'j / k', description: 'Move down / up in tables' },
  { keys: 'Enter', description: 'Open detail panel for current row' },
  { keys: 'Esc', description: 'Close detail panel / overlays' },
  { keys: '⌘ z / ⇧ ⌘ z', description: 'Undo / redo edit (PBC)' },
];

export default function KeyboardShortcuts() {
  const [show, setShow] = React.useState(false);
  const router = useRouter();
  const lastG = React.useRef(0);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isField = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (isField) return;
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShow(s => !s);
        return;
      }
      if (e.key === 'Escape') {
        setShow(false);
      }
      if (e.key === 'g') {
        lastG.current = Date.now();
        return;
      }
      if (Date.now() - lastG.current < 1200) {
        const map: Record<string, string> = {
          d: '/', p: '/pbc', a: '/access', w: '/walkthroughs',
          e: '/entities', s: '/sampling', t: '/activity',
          r: '/reports', ',': '/settings',
        };
        const target = map[e.key];
        if (target) {
          e.preventDefault();
          router.push(target);
          lastG.current = 0;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  if (!show) return null;
  return (
    <div className="no-print fixed inset-0 z-50 bg-black/30 dark:bg-black/60 flex items-center justify-center" onClick={() => setShow(false)}>
      <div className="w-[520px] bg-white dark:bg-navy-900 border border-rule dark:border-navy-700 rounded-lg shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold">Keyboard shortcuts</h2>
          <button onClick={() => setShow(false)} className="text-[12px] text-ink-500 hover:text-ink-900 dark:hover:text-slate-100">Close</button>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="flex items-center justify-between gap-4 text-[12.5px]">
              <span className="text-ink-700 dark:text-slate-300">{s.description}</span>
              <kbd className="rounded border border-rule dark:border-navy-700 px-1.5 py-0.5 text-[11px] font-mono bg-canvas dark:bg-navy-800">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
