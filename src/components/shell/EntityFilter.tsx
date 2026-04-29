'use client';
import * as React from 'react';
import { useEntityFilter, useEntities } from '@/components/shell/state';

export default function EntityFilter() {
  const entities = useEntities();
  const { entity, setEntity } = useEntityFilter();
  if (entities.length === 0) return null;
  return (
    <select
      value={entity || ''}
      onChange={e => setEntity(e.target.value || null)}
      className="h-7 rounded border border-rule bg-white dark:bg-navy-900 dark:border-navy-700 px-2 text-[12px] text-ink-700 dark:text-slate-300"
      aria-label="Filter by entity"
    >
      <option value="">All entities</option>
      {entities.map(e => (
        <option key={e.id} value={e.legalEntity || `Entity #${e.num}`}>
          {e.legalEntity || `Entity #${e.num}`}
        </option>
      ))}
    </select>
  );
}
