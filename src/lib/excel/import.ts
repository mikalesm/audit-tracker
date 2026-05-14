import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { getDb } from '@/lib/db';
import { DEFAULT_TSC_BY_CATEGORY } from '@/lib/templates/library';

// xlsx ESM build does not auto-detect Node fs; wire it up so readFile works.
XLSX.set_fs(fs);

export interface ImportSummary {
  pbc: { added: number; updatedStatic: number; total: number };
  access: { added: number; total: number };
  walkthroughs: { added: number; total: number };
  entities: { added: number; total: number };
  sampling: { added: number; total: number };
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
function toInt(v: unknown): number | null {
  const c = clean(v);
  if (c === null) return null;
  const n = parseInt(c, 10);
  return isNaN(n) ? null : n;
}

function findHeaderRow(sheet: XLSX.WorkSheet, expectedFirstCell: string): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= Math.min(range.s.c + 3, range.e.c); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && String(cell.v).trim() === expectedFirstCell) {
        return r;
      }
    }
  }
  return -1;
}

function sheetToRows(sheet: XLSX.WorkSheet, headerCell: string): Record<string, unknown>[] {
  const headerRow = findHeaderRow(sheet, headerCell);
  if (headerRow < 0) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']!);
  const newRange: XLSX.Range = {
    s: { r: headerRow, c: range.s.c },
    e: { r: range.e.r, c: range.e.c },
  };
  return XLSX.utils.sheet_to_json(sheet, {
    range: XLSX.utils.encode_range(newRange),
    defval: null,
    raw: false,
  }) as Record<string, unknown>[];
}

export async function importFromExcelBuffer(engagementId: number, buffer: Buffer): Promise<ImportSummary> {
  const wb = XLSX.read(buffer, { cellDates: true });
  return importFromWorkbook(engagementId, wb);
}

export async function importFromExcelPath(engagementId: number, filePath: string): Promise<ImportSummary> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found: ${filePath}`);
  }
  const wb = XLSX.readFile(filePath, { cellDates: true });
  return importFromWorkbook(engagementId, wb);
}

async function importFromWorkbook(engagementId: number, wb: XLSX.WorkBook): Promise<ImportSummary> {
  const db = await getDb();
  const summary: ImportSummary = {
    pbc: { added: 0, updatedStatic: 0, total: 0 },
    access: { added: 0, total: 0 },
    walkthroughs: { added: 0, total: 0 },
    entities: { added: 0, total: 0 },
    sampling: { added: 0, total: 0 },
  };

  await db.withTx(async (tx) => {
    // ---- PBC List
    const pbcSheet = wb.Sheets['PBC List'];
    if (pbcSheet) {
      const rows = sheetToRows(pbcSheet, '#');
      for (const r of rows) {
        const num = toInt(r['#']);
        if (num === null) continue;
        const cat = clean(r['Category']) || 'Governance';
        const tsc = DEFAULT_TSC_BY_CATEGORY[cat as keyof typeof DEFAULT_TSC_BY_CATEGORY] || [];
        const existing = (await tx.query<{ id: number }>(
          'SELECT id FROM pbc_items WHERE engagement_id = $1 AND num = $2',
          [engagementId, num]
        )).rows[0];
        if (existing) {
          await tx.query(
            `UPDATE pbc_items
             SET category = $3, item_requested = $4, why_purpose = $5, format_expected = $6, priority = $7
             WHERE engagement_id = $1 AND num = $2`,
            [engagementId, num, cat, clean(r['Item Requested']) ?? '', clean(r['Why / Audit Purpose']) ?? '', clean(r['Format Expected']) ?? '', clean(r['Priority']) ?? 'Medium']
          );
          summary.pbc.updatedStatic++;
        } else {
          await tx.query(
            `INSERT INTO pbc_items (engagement_id, num, category, item_requested, why_purpose, format_expected, priority, owner_client, status, date_requested, date_received, notes, tsc_mapping)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11::date, $12, $13::jsonb)`,
            [
              engagementId, num, cat,
              clean(r['Item Requested']) ?? '',
              clean(r['Why / Audit Purpose']) ?? '',
              clean(r['Format Expected']) ?? '',
              clean(r['Priority']) ?? 'Medium',
              clean(r['Owner (Client)']),
              clean(r['Status']) ?? 'Not Started',
              clean(r['Date Requested']),
              clean(r['Date Received']),
              clean(r['Notes']),
              JSON.stringify(tsc),
            ]
          );
          summary.pbc.added++;
        }
      }
      summary.pbc.total = Number((await tx.query<{ c: number }>(
        'SELECT COUNT(*)::int AS c FROM pbc_items WHERE engagement_id = $1',
        [engagementId]
      )).rows[0].c);
    }

    // ---- Access Requests
    const aSheet = wb.Sheets['Access Requests'];
    if (aSheet) {
      const rows = sheetToRows(aSheet, '#');
      for (const r of rows) {
        const num = toInt(r['#']);
        if (num === null) continue;
        const result = await tx.query(
          `INSERT INTO access_requests (engagement_id, num, system, access_type, role_permissions, recommended_method, justification, owner_client, status, provisioned_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11)
           ON CONFLICT (engagement_id, num) DO NOTHING`,
          [
            engagementId, num,
            clean(r['System / Platform']) ?? '',
            clean(r['Access Type']) ?? '',
            clean(r['Role / Permissions Needed']) ?? '',
            clean(r['Recommended Method']) ?? '',
            clean(r['Justification']) ?? '',
            clean(r['Owner (Client)']),
            clean(r['Status']) ?? 'Not Requested',
            clean(r['Provisioned Date']),
            clean(r['Notes']),
          ]
        );
        if (result.rowCount > 0) summary.access.added++;
      }
      summary.access.total = Number((await tx.query<{ c: number }>(
        'SELECT COUNT(*)::int AS c FROM access_requests WHERE engagement_id = $1',
        [engagementId]
      )).rows[0].c);
    }

    // ---- Walkthroughs
    const wSheet = wb.Sheets['Walkthroughs'];
    if (wSheet) {
      const rows = sheetToRows(wSheet, '#');
      for (const r of rows) {
        const num = toInt(r['#']);
        if (num === null) continue;
        // Description / Objective are optional columns — workbooks exported
        // before they existed simply won't carry them.
        const existing = (await tx.query<{ id: number }>(
          'SELECT id FROM walkthroughs WHERE engagement_id = $1 AND num = $2',
          [engagementId, num]
        )).rows[0];
        if (existing) {
          // Re-sync: overlay the structural columns onto the existing row.
          await tx.query(
            `UPDATE walkthroughs
             SET process_area = $3, description = $4, objective = $5,
                 key_topics = $6, attendees = $7, duration_min = $8
             WHERE engagement_id = $1 AND num = $2`,
            [
              engagementId, num,
              clean(r['Process Area']) ?? '',
              clean(r['Description']),
              clean(r['Objective']),
              clean(r['Key Topics']) ?? '',
              clean(r['Client Attendees Needed']) ?? '',
              toInt(r['Duration (min)']),
            ]
          );
        } else {
          await tx.query(
            `INSERT INTO walkthroughs (engagement_id, num, process_area, description, objective, key_topics, attendees, proposed_date, duration_min, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11)`,
            [
              engagementId, num,
              clean(r['Process Area']) ?? '',
              clean(r['Description']),
              clean(r['Objective']),
              clean(r['Key Topics']) ?? '',
              clean(r['Client Attendees Needed']) ?? '',
              clean(r['Proposed Date']),
              toInt(r['Duration (min)']),
              clean(r['Status']) ?? 'Not Scheduled',
              clean(r['Notes']),
            ]
          );
          summary.walkthroughs.added++;
        }
      }
      summary.walkthroughs.total = Number((await tx.query<{ c: number }>(
        'SELECT COUNT(*)::int AS c FROM walkthroughs WHERE engagement_id = $1',
        [engagementId]
      )).rows[0].c);
    }

    // ---- Entity Scope
    const eSheet = wb.Sheets['Entity Scope'];
    if (eSheet) {
      const rows = sheetToRows(eSheet, '#');
      for (const r of rows) {
        const num = toInt(r['#']);
        if (num === null) continue;
        const result = await tx.query(
          `INSERT INTO entities (engagement_id, num, legal_entity, country_location, it_model, key_applications, hosting, headcount, in_scope, rationale)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (engagement_id, num) DO NOTHING`,
          [
            engagementId, num,
            clean(r['Legal Entity']),
            clean(r['Country / Location']),
            clean(r['IT Model (Centralized / Hybrid / Standalone)']),
            clean(r['Key Applications']),
            clean(r['Hosting (Cloud / On-Prem)']),
            toInt(r['Headcount']),
            clean(r['In Scope (Y/N)']),
            clean(r['Rationale']),
          ]
        );
        if (result.rowCount > 0) summary.entities.added++;
      }
      summary.entities.total = Number((await tx.query<{ c: number }>(
        'SELECT COUNT(*)::int AS c FROM entities WHERE engagement_id = $1',
        [engagementId]
      )).rows[0].c);
    }

    // ---- Sampling & Testing
    const sSheet = wb.Sheets['Sampling & Testing'];
    if (sSheet) {
      const rows = sheetToRows(sSheet, '#');
      for (const r of rows) {
        const num = toInt(r['#']);
        if (num === null) continue;
        const result = await tx.query(
          `INSERT INTO sampling_items (engagement_id, num, control_area, control_description, population_source, population_size, sample_size, sampling_method, test_status, findings_summary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (engagement_id, num) DO NOTHING`,
          [
            engagementId, num,
            clean(r['Control Area']) ?? '',
            clean(r['Control Description']) ?? '',
            clean(r['Population Source']) ?? '',
            toInt(r['Population Size']),
            toInt(r['Sample Size']),
            clean(r['Sampling Method']) ?? '',
            clean(r['Test Status']) ?? 'Not Started',
            clean(r['Findings Summary']),
          ]
        );
        if (result.rowCount > 0) summary.sampling.added++;
      }
      summary.sampling.total = Number((await tx.query<{ c: number }>(
        'SELECT COUNT(*)::int AS c FROM sampling_items WHERE engagement_id = $1',
        [engagementId]
      )).rows[0].c);
    }
  });

  return summary;
}
