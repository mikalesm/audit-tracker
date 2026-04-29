import { getDb } from '@/lib/db';
import type { SamplingItem } from '@/types';
import { logActivity } from './activity';

type Row = {
  id: number; num: number; control_area: string; control_description: string;
  population_source: string; population_size: number | null; sample_size: number | null;
  sampling_method: string; test_status: string; findings_summary: string | null;
  updated_at: string | Date;
};

function toItem(r: Row): SamplingItem {
  return {
    id: Number(r.id), num: Number(r.num), controlArea: r.control_area, controlDescription: r.control_description,
    populationSource: r.population_source,
    populationSize: r.population_size === null ? null : Number(r.population_size),
    sampleSize: r.sample_size === null ? null : Number(r.sample_size),
    samplingMethod: r.sampling_method,
    testStatus: r.test_status as SamplingItem['testStatus'],
    findingsSummary: r.findings_summary,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

export async function listSampling(): Promise<SamplingItem[]> {
  const db = await getDb();
  const r = await db.query<Row>('SELECT * FROM sampling_items ORDER BY num');
  return r.rows.map(toItem);
}

const COLS: Record<string, string> = {
  populationSize: 'population_size', sampleSize: 'sample_size',
  samplingMethod: 'sampling_method', testStatus: 'test_status',
  findingsSummary: 'findings_summary', controlArea: 'control_area',
  controlDescription: 'control_description', populationSource: 'population_source',
};
const INT_COLS = new Set(['population_size', 'sample_size']);

export async function updateSampling(id: number, patch: Record<string, unknown>, userId: number | null = null): Promise<SamplingItem> {
  const db = await getDb();
  const existing = (await db.query<Row>('SELECT * FROM sampling_items WHERE id = $1', [id])).rows[0];
  if (!existing) throw new Error('not found');

  await db.withTx(async (tx) => {
    for (const [k, v] of Object.entries(patch)) {
      const col = COLS[k]; if (!col) continue;
      const oldVal = (existing as unknown as Record<string, unknown>)[col];
      let newVal: string | number | null;
      if (v === null || v === undefined || v === '') newVal = null;
      else if (INT_COLS.has(col)) {
        const n = parseInt(String(v), 10); newVal = isNaN(n) ? null : n;
      } else newVal = String(v);
      const oldStr = oldVal === null || oldVal === undefined ? null : String(oldVal);
      const newStr = newVal === null ? null : String(newVal);
      if (oldStr === newStr) continue;
      const cast = INT_COLS.has(col) ? '::int' : '';
      await tx.query(
        `UPDATE sampling_items SET ${col} = $1${cast}, updated_at = NOW() WHERE id = $2`,
        [newVal, id]
      );
      await logActivity('sampling', id, k, oldStr, newStr, userId, tx);
    }
  });

  const fresh = (await db.query<Row>('SELECT * FROM sampling_items WHERE id = $1', [id])).rows[0];
  return toItem(fresh);
}
