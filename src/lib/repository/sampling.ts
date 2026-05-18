import { getDb } from '@/lib/db';
import type { SamplingItem } from '@/types';
import { logActivity } from './activity';

type Row = {
  id: number; engagement_id: number; num: number; control_area: string; control_description: string;
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

export async function listSampling(engagementId: number): Promise<SamplingItem[]> {
  const db = await getDb();
  const r = await db.query<Row>(
    'SELECT * FROM sampling_items WHERE engagement_id = $1 ORDER BY num',
    [engagementId]
  );
  return r.rows.map(toItem);
}

const COLS: Record<string, string> = {
  populationSize: 'population_size', sampleSize: 'sample_size',
  samplingMethod: 'sampling_method', testStatus: 'test_status',
  findingsSummary: 'findings_summary', controlArea: 'control_area',
  controlDescription: 'control_description', populationSource: 'population_source',
};
const INT_COLS = new Set(['population_size', 'sample_size']);

export async function updateSampling(
  engagementId: number,
  id: number,
  patch: Record<string, unknown>,
  userId: number | null = null,
): Promise<SamplingItem> {
  const db = await getDb();
  const existing = (await db.query<Row>(
    'SELECT * FROM sampling_items WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  )).rows[0];
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
        `UPDATE sampling_items SET ${col} = $1${cast}, updated_at = NOW() WHERE engagement_id = $2 AND id = $3`,
        [newVal, engagementId, id]
      );
      await logActivity(engagementId, 'sampling', id, k, oldStr, newStr, userId, tx);
    }
  });

  const fresh = (await db.query<Row>(
    'SELECT * FROM sampling_items WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  )).rows[0];
  return toItem(fresh);
}

export async function createSampling(
  engagementId: number,
  payload: Record<string, unknown>,
  userId: number | null = null,
): Promise<SamplingItem> {
  const controlArea = String(payload.controlArea ?? '').trim();
  if (!controlArea) throw new Error('controlArea is required');

  const db = await getDb();
  const next = (await db.query<{ n: number }>(
    'SELECT COALESCE(MAX(num), 0) + 1 AS n FROM sampling_items WHERE engagement_id = $1',
    [engagementId]
  )).rows[0].n;

  const controlDescription = String(payload.controlDescription ?? '');
  const populationSource = String(payload.populationSource ?? '');
  const samplingMethod = String(payload.samplingMethod ?? '');
  const popSize = payload.populationSize === undefined || payload.populationSize === null || payload.populationSize === ''
    ? null : Number(payload.populationSize);
  const sampSize = payload.sampleSize === undefined || payload.sampleSize === null || payload.sampleSize === ''
    ? null : Number(payload.sampleSize);

  const inserted = (await db.query<Row>(
    `INSERT INTO sampling_items
       (engagement_id, num, control_area, control_description, population_source,
        population_size, sample_size, sampling_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [engagementId, next, controlArea, controlDescription, populationSource, popSize, sampSize, samplingMethod]
  )).rows[0];

  await logActivity(engagementId, 'sampling', Number(inserted.id), 'created', null, controlArea, userId);
  return toItem(inserted);
}
