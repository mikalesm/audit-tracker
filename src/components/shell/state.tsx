'use client';
import * as React from 'react';
import type { Entity } from '@/types';

interface EntityFilterValue {
  /** Selected legal entity id, or `null` for "all entities". */
  entityId: number | null;
  setEntityId: (id: number | null) => void;
  entities: Entity[];
}

const EntityCtx = React.createContext<EntityFilterValue | null>(null);

export function useEntityFilter(): EntityFilterValue {
  const ctx = React.useContext(EntityCtx);
  if (!ctx) return { entityId: null, setEntityId: () => {}, entities: [] as Entity[] };
  return ctx;
}
export function useEntities() {
  return useEntityFilter().entities;
}

export function EntityFilterProvider({ children }: { children: React.ReactNode }) {
  const [entityId, setEntityId] = React.useState<number | null>(null);
  const [entities, setEntities] = React.useState<Entity[]>([]);

  React.useEffect(() => {
    try {
      const s = localStorage.getItem('entityFilterId');
      if (s) setEntityId(Number(s));
    } catch {}
    fetch('/api/entities').then(r => r.json()).then(d => {
      const list = (d as Entity[]).filter(e => e.legalEntity);
      setEntities(list);
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    try {
      if (entityId != null) localStorage.setItem('entityFilterId', String(entityId));
      else localStorage.removeItem('entityFilterId');
    } catch {}
  }, [entityId]);

  return <EntityCtx.Provider value={{ entityId, setEntityId, entities }}>{children}</EntityCtx.Provider>;
}
