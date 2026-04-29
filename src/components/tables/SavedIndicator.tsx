'use client';
import * as React from 'react';
import { Check } from 'lucide-react';

export function useSaveIndicator() {
  const [n, setN] = React.useState(0);
  const flash = React.useCallback(() => setN(x => x + 1), []);
  return { savedKey: n, flash };
}

export function SavedFlash({ savedKey }: { savedKey: number }) {
  if (savedKey === 0) return null;
  return (
    <div key={savedKey} className="saved-flash inline-flex items-center gap-1 text-[11.5px] text-emerald-700 dark:text-emerald-400">
      <Check className="w-3.5 h-3.5" />
      Saved
    </div>
  );
}
