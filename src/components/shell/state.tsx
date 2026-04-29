'use client';
import * as React from 'react';
import type { Entity } from '@/types';

const EntityCtx = React.createContext<{ entity: string | null; setEntity: (s: string | null) => void; entities: Entity[] } | null>(null);

export function useEntityFilter() {
  const ctx = React.useContext(EntityCtx);
  if (!ctx) return { entity: null, setEntity: () => {}, entities: [] as Entity[] };
  return ctx;
}
export function useEntities() {
  return useEntityFilter().entities;
}

export function EntityFilterProvider({ children }: { children: React.ReactNode }) {
  const [entity, setEntity] = React.useState<string | null>(null);
  const [entities, setEntities] = React.useState<Entity[]>([]);

  React.useEffect(() => {
    try { const s = localStorage.getItem('entityFilter'); if (s) setEntity(s); } catch {}
    fetch('/api/entities').then(r => r.json()).then(d => {
      const list = (d as Entity[]).filter(e => e.legalEntity);
      setEntities(list);
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    try {
      if (entity) localStorage.setItem('entityFilter', entity);
      else localStorage.removeItem('entityFilter');
    } catch {}
  }, [entity]);

  return <EntityCtx.Provider value={{ entity, setEntity, entities }}>{children}</EntityCtx.Provider>;
}
