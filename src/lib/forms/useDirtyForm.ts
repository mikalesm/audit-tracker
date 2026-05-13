'use client';
import * as React from 'react';

/**
 * Local-edit form state with dirty tracking. Tracks an "edited" copy of the
 * value, exposes `isDirty`, and offers `commit()` to mark the current edit
 * as the new baseline (after a successful save) and `reset()` to abandon
 * edits.
 *
 * A simple `beforeunload` warning is registered while any dirty form is
 * mounted, so the user gets a browser warning if they try to navigate away
 * with unsaved changes.
 */
export function useDirtyForm<T extends object>(initial: T | null) {
  const [committed, setCommitted] = React.useState<T | null>(initial);
  const [value, setValue] = React.useState<T | null>(initial);
  // Reset both when `initial` arrives async (e.g. from a fetch).
  React.useEffect(() => {
    setCommitted(initial);
    setValue(initial);
  }, [initial]);

  const isDirty = React.useMemo(() => {
    if (!committed || !value) return false;
    return !shallowEqual(committed, value);
  }, [committed, value]);

  React.useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Most modern browsers ignore the returned string but still show their
      // own confirmation. Keep this defensive.
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  function patch(p: Partial<T>) {
    setValue(v => (v ? { ...v, ...p } : v));
  }
  function commit(next?: T) {
    setCommitted(next ?? value);
    if (next) setValue(next);
  }
  function reset() {
    setValue(committed);
  }

  return { value, committed, isDirty, patch, commit, reset, setValue };
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const ak = Object.keys(a) as (keyof T)[];
  const bk = Object.keys(b) as (keyof T)[];
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
