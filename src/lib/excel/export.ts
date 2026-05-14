import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { getDb } from '@/lib/db';

XLSX.set_fs(fs);

export async function exportToWorkbook(
  engagementId: number,
  opts?: { pbcIds?: number[] },
): Promise<Buffer> {
  const db = await getDb();
  const wb = XLSX.utils.book_new();

  const pbcSelect = `
    SELECT num as "#", category as "Category", item_requested as "Item Requested",
           why_purpose as "Why / Audit Purpose", format_expected as "Format Expected",
           priority as "Priority", owner_client as "Owner (Client)", status as "Status",
           date_requested::text as "Date Requested", date_received::text as "Date Received",
           notes as "Notes", tsc_mapping::text as "TSC Mapping"
    FROM pbc_items
    WHERE engagement_id = $1
  `;
  const pbcRows = (opts?.pbcIds && opts.pbcIds.length > 0)
    ? (await db.query(`${pbcSelect} AND id = ANY($2::bigint[]) ORDER BY num`, [engagementId, opts.pbcIds])).rows
    : (await db.query(`${pbcSelect} ORDER BY num`, [engagementId])).rows;
  const pbcSheetName = (opts?.pbcIds && opts.pbcIds.length > 0) ? 'PBC List (selection)' : 'PBC List';
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pbcRows), pbcSheetName);

  if (opts?.pbcIds && opts.pbcIds.length > 0) {
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  const access = (await db.query(`
    SELECT num as "#", system as "System / Platform", access_type as "Access Type",
           role_permissions as "Role / Permissions Needed", recommended_method as "Recommended Method",
           justification as "Justification", owner_client as "Owner (Client)", status as "Status",
           provisioned_date::text as "Provisioned Date", notes as "Notes"
    FROM access_requests WHERE engagement_id = $1 ORDER BY num
  `, [engagementId])).rows;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(access), 'Access Requests');

  const walks = (await db.query(`
    SELECT num as "#", process_area as "Process Area",
           description as "Description", objective as "Objective",
           key_topics as "Key Topics",
           attendees as "Client Attendees Needed", proposed_date::text as "Proposed Date",
           duration_min as "Duration (min)", status as "Status", notes as "Notes"
    FROM walkthroughs WHERE engagement_id = $1 ORDER BY num
  `, [engagementId])).rows;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(walks), 'Walkthroughs');

  const ents = (await db.query(`
    SELECT num as "#", legal_entity as "Legal Entity", country_location as "Country / Location",
           it_model as "IT Model", key_applications as "Key Applications", hosting as "Hosting",
           headcount as "Headcount", in_scope as "In Scope (Y/N)", rationale as "Rationale"
    FROM entities WHERE engagement_id = $1 ORDER BY num
  `, [engagementId])).rows;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ents), 'Entity Scope');

  const samp = (await db.query(`
    SELECT num as "#", control_area as "Control Area", control_description as "Control Description",
           population_source as "Population Source", population_size as "Population Size",
           sample_size as "Sample Size", sampling_method as "Sampling Method",
           test_status as "Test Status", findings_summary as "Findings Summary"
    FROM sampling_items WHERE engagement_id = $1 ORDER BY num
  `, [engagementId])).rows;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(samp), 'Sampling & Testing');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
