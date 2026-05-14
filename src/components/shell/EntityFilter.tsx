'use client';
import * as React from 'react';
import { useEntityFilter } from '@/components/shell/state';

export default function EntityFilter() {
  const { entityId, setEntityId, entities } = useEntityFilter();
  if (entities.length === 0) return null;
  return (
    <select
      value={entityId ?? ''}
      onChange={e => setEntityId(e.target.value ? Number(e.target.value) : null)}
      className="h-8 rounded-md border border-rule bg-white dark:bg-navy-900 dark:border-navy-700 px-2 text-[12px] text-ink-700 dark:text-slate-300"
      aria-label="Filter by entity"
    >
      <option value="">All entities</option>
      {entities.map(e => (
        <option key={e.id} value={e.id}>
          {e.legalEntity || `Entity #${e.num}`}
        </option>
      ))}
    </select>
  );
}
