// Drift-check: the in-code template library (src/lib/templates/library.ts) is a
// manual transcription of the authoritative workbook
// (data/templates/IT_Audit_PBC_Tracker_v2.xlsx). The two feed different seed
// paths — library.ts drives UI template creation (seedFromLibrary), the
// workbook drives Settings -> Re-sync from Excel (importFromExcel*). If they
// drift, the two paths produce different engagements.
//
// This script fails CI when the workbook-derived fields no longer match. It
// deliberately does NOT compare:
//   - entities          — library entities are illustrative placeholders; the
//                          workbook's Entity Scope sheet is a blank template.
//   - walkthrough description / objective — authored in library.ts; the
//                          workbook's Walkthroughs sheet has no such columns.
//   - sampling method   — library.ts blanks it on purpose (per-engagement
//                          decision); the workbook carries a default value.
//   - the Endpoint & MDM, Security Posture, Cloud Security Posture and AI
//                          Governance PBC categories — these are authored in
//                          library.ts beyond the workbook's original 10
//                          categories, so they are excluded from the PBC check.
//   - the PBC `scope` / `templateKey` fields — library-only, no workbook source.

import path from 'path';
import * as XLSX from 'xlsx';
import { clean, toInt, sheetToRows } from '@/lib/excel/sheet-utils';
import { LIBRARY } from '@/lib/templates/library';

const WORKBOOK = path.join(process.cwd(), 'data', 'templates', 'IT_Audit_PBC_Tracker_v2.xlsx');

interface FieldMap<T> {
  /** Field name on the library item. */
  lib: keyof T;
  /** Column header in the workbook sheet. */
  col: string;
  /** 'int' compares numerically (via toInt); default compares as strings. */
  kind?: 'int';
}

/** Workbook string cell, normalized the same way the importer normalizes it. */
function str(v: unknown): string {
  return clean(v) ?? '';
}

function checkDataset<T>(
  label: string,
  sheetName: string,
  wb: XLSX.WorkBook,
  libRows: readonly T[],
  fields: FieldMap<T>[],
): string[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [`${label}: workbook sheet "${sheetName}" not found`];

  const rows = sheetToRows(sheet, '#').filter((r) => toInt(r['#']) !== null);
  const problems: string[] = [];

  if (rows.length !== libRows.length) {
    problems.push(
      `${label}: row count differs — workbook has ${rows.length}, library.ts has ${libRows.length}`,
    );
  }

  const n = Math.min(rows.length, libRows.length);
  for (let i = 0; i < n; i++) {
    const wr = rows[i];
    const lr = libRows[i];

    const num = toInt(wr['#']);
    if (num !== i + 1) {
      problems.push(`${label} row ${i + 1}: workbook "#" is ${num}, expected sequential ${i + 1}`);
    }

    for (const f of fields) {
      const libVal = lr[f.lib];
      if (f.kind === 'int') {
        const wbVal = toInt(wr[f.col]);
        if (wbVal !== libVal) {
          problems.push(`${label} #${i + 1} [${String(f.lib)}]: workbook=${wbVal} library=${String(libVal)}`);
        }
      } else {
        const wbVal = str(wr[f.col]);
        const lv = String(libVal ?? '');
        if (wbVal !== lv) {
          problems.push(
            `${label} #${i + 1} [${String(f.lib)}]:\n` +
              `    workbook: ${JSON.stringify(wbVal)}\n` +
              `    library:  ${JSON.stringify(lv)}`,
          );
        }
      }
    }
  }

  return problems;
}

function main(): void {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.readFile(WORKBOOK, { cellDates: true });
  } catch (e) {
    console.error(`Could not read workbook at ${WORKBOOK}`);
    console.error(e);
    process.exitCode = 1;
    return;
  }

  // Categories present in the authoritative workbook. PBC items in categories
  // added beyond the workbook (the four security categories) are authored in
  // library.ts and are not part of the drift check.
  const WORKBOOK_PBC_CATEGORIES = new Set([
    'Governance', 'Entities & Systems', 'Access Management', 'Change Management',
    'IT Operations', 'Third Parties', 'Licensing', 'IT Spend', 'SOC 2 Readiness',
    'Physical & Environmental',
  ]);
  const workbookPbc = LIBRARY.pbc.filter((i) => WORKBOOK_PBC_CATEGORIES.has(i.category));

  const problems: string[] = [
    ...checkDataset('PBC', 'PBC List', wb, workbookPbc, [
      { lib: 'category', col: 'Category' },
      { lib: 'itemRequested', col: 'Item Requested' },
      { lib: 'whyPurpose', col: 'Why / Audit Purpose' },
      { lib: 'formatExpected', col: 'Format Expected' },
      { lib: 'priority', col: 'Priority' },
    ]),
    ...checkDataset('Access', 'Access Requests', wb, LIBRARY.access, [
      { lib: 'system', col: 'System / Platform' },
      { lib: 'accessType', col: 'Access Type' },
      { lib: 'rolePermissions', col: 'Role / Permissions Needed' },
      { lib: 'recommendedMethod', col: 'Recommended Method' },
      { lib: 'justification', col: 'Justification' },
    ]),
    ...checkDataset('Walkthroughs', 'Walkthroughs', wb, LIBRARY.walkthroughs, [
      { lib: 'processArea', col: 'Process Area' },
      { lib: 'keyTopics', col: 'Key Topics' },
      { lib: 'attendees', col: 'Client Attendees Needed' },
      { lib: 'durationMin', col: 'Duration (min)', kind: 'int' },
    ]),
    ...checkDataset('Sampling', 'Sampling & Testing', wb, LIBRARY.sampling, [
      { lib: 'controlArea', col: 'Control Area' },
      { lib: 'controlDescription', col: 'Control Description' },
      { lib: 'populationSource', col: 'Population Source' },
    ]),
  ];

  if (problems.length > 0) {
    console.error('library.ts has drifted from IT_Audit_PBC_Tracker_v2.xlsx:\n');
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      '\nFix: re-transcribe the affected rows in src/lib/templates/library.ts so they ' +
        'match the workbook, or update the workbook if it is the one that is wrong.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `library.ts is in sync with the workbook — ` +
      `${LIBRARY.pbc.length} PBC items, ${LIBRARY.access.length} access requests, ` +
      `${LIBRARY.walkthroughs.length} walkthroughs, ${LIBRARY.sampling.length} sampling controls.`,
  );
}

main();
