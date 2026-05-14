import * as XLSX from 'xlsx';
import * as fs from 'fs';

// xlsx ESM build does not auto-detect Node fs; wire it up so readFile works.
// This runs once on first import and is shared by the importer and the
// library drift-check (scripts/check-library-sync.ts).
XLSX.set_fs(fs);

export function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export function toInt(v: unknown): number | null {
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

export function sheetToRows(sheet: XLSX.WorkSheet, headerCell: string): Record<string, unknown>[] {
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
