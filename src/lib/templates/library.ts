// Master library for engagement templates.
//
// This is a generic IT-audit starter set baked into the source so a fresh
// install can create useful templates without uploading an Excel. Each
// platform-admin can override / extend the content per-template using
// Settings → Re-sync from Excel inside the template engagement.
//
// Categories MUST match the Category union in src/types/index.ts and the
// keys in DEFAULT_TSC_BY_CATEGORY at src/lib/excel/import.ts so the TSC
// auto-mapping continues to work when items are later imported on top.

import type { Category, PBCPriority, TSC } from '@/types';

export type PBCCategory = Category;

export const PBC_CATEGORIES: readonly PBCCategory[] = [
  'Governance',
  'Entities & Systems',
  'Access Management',
  'Change Management',
  'IT Operations',
  'Third Parties',
  'Licensing',
  'IT Spend',
  'SOC 2 Readiness',
  'Physical & Environmental',
] as const;

export interface LibraryPBCItem {
  category: PBCCategory;
  itemRequested: string;
  whyPurpose: string;
  formatExpected: string;
  priority: PBCPriority;
  tscMapping: TSC[];
}

export interface LibraryAccessRequest {
  system: string;
  accessType: string;
  rolePermissions: string;
  recommendedMethod: string;
  justification: string;
}

export interface LibraryWalkthrough {
  processArea: string;
  /** One-paragraph narrative describing what the walkthrough covers. */
  description: string;
  /** What the auditor is trying to confirm in this session. */
  objective: string;
  keyTopics: string;
  attendees: string;
  durationMin: number;
}

export interface LibraryEntity {
  legalEntity: string | null;
  countryLocation: string | null;
  itModel: string | null;
  keyApplications: string | null;
  hosting: string | null;
  headcount: number | null;
  inScope: 'Y' | 'N' | null;
  rationale: string | null;
}

export interface LibrarySamplingItem {
  controlArea: string;
  controlDescription: string;
  populationSource: string;
  samplingMethod: string;
}

// ---- PBC items, grouped by category, in display order ----
const PBC: LibraryPBCItem[] = [
  // Governance
  { category: 'Governance', itemRequested: 'Org chart with reporting lines for IT, Information Security, Internal Audit', whyPurpose: 'Establish IT governance structure and segregation of duties', formatExpected: 'PDF / PowerPoint / Visio', priority: 'High', tscMapping: ['Security'] },
  { category: 'Governance', itemRequested: 'IT strategy / multi-year roadmap for the audit period', whyPurpose: 'Understand IT priorities and major initiatives in scope', formatExpected: 'PDF / PowerPoint', priority: 'Medium', tscMapping: ['Security'] },
  { category: 'Governance', itemRequested: 'IT policies index (acceptable use, access control, change mgmt, incident response, data classification, BCP/DR)', whyPurpose: 'Confirm policy coverage and review cadence', formatExpected: 'List or folder of PDFs', priority: 'High', tscMapping: ['Security'] },
  { category: 'Governance', itemRequested: 'IT steering committee minutes for the audit period', whyPurpose: 'Evidence of governance oversight and key decisions', formatExpected: 'PDF / Word docs', priority: 'Medium', tscMapping: ['Security'] },
  { category: 'Governance', itemRequested: 'Risk register (IT risks, treatment plans, owners)', whyPurpose: 'Confirm risk management process and IT risk visibility', formatExpected: 'Excel / GRC export', priority: 'High', tscMapping: ['Security'] },
  { category: 'Governance', itemRequested: 'Most recent internal audit findings + management responses', whyPurpose: 'Track remediation of prior findings', formatExpected: 'PDF / Excel', priority: 'Medium', tscMapping: ['Security'] },

  // Entities & Systems
  { category: 'Entities & Systems', itemRequested: 'List of in-scope legal entities and locations', whyPurpose: 'Confirm engagement scope at the entity level', formatExpected: 'Excel / Word', priority: 'High', tscMapping: ['Security'] },
  { category: 'Entities & Systems', itemRequested: 'Application inventory with owner, criticality, hosting model, data classification', whyPurpose: 'Identify key applications supporting in-scope processes', formatExpected: 'Excel / CMDB export', priority: 'High', tscMapping: ['Security'] },
  { category: 'Entities & Systems', itemRequested: 'Network diagram (high level) covering in-scope environments', whyPurpose: 'Understand network architecture and security zones', formatExpected: 'PDF / Visio', priority: 'Medium', tscMapping: ['Security'] },
  { category: 'Entities & Systems', itemRequested: 'Data flow diagrams for the most critical applications', whyPurpose: 'Confirm data handling and trust boundaries', formatExpected: 'PDF / Visio', priority: 'Medium', tscMapping: ['Security', 'Confidentiality'] },
  { category: 'Entities & Systems', itemRequested: 'Server / cloud-resource inventory (production), grouped by environment and owner', whyPurpose: 'Establish infrastructure population for sampling', formatExpected: 'Excel / CMDB export', priority: 'High', tscMapping: ['Security'] },

  // Access Management
  { category: 'Access Management', itemRequested: 'User listings (active employees + contractors) from HR and from each in-scope application as of audit cutoff', whyPurpose: 'Compare HR-active to app-active for orphaned access testing', formatExpected: 'Excel/CSV with hire/term dates', priority: 'High', tscMapping: ['Security', 'Confidentiality'] },
  { category: 'Access Management', itemRequested: 'Joiner / mover / leaver process documentation', whyPurpose: 'Confirm access lifecycle controls', formatExpected: 'PDF / Word / flowchart', priority: 'High', tscMapping: ['Security'] },
  { category: 'Access Management', itemRequested: 'Recent termination listing (last 90 days) with last-access timestamps in each app', whyPurpose: 'Test timely access removal for leavers', formatExpected: 'Excel/CSV', priority: 'High', tscMapping: ['Security', 'Confidentiality'] },
  { category: 'Access Management', itemRequested: 'Privileged / admin user listings per application', whyPurpose: 'Test that privileged access is restricted and reviewed', formatExpected: 'Excel/CSV', priority: 'High', tscMapping: ['Security', 'Confidentiality'] },
  { category: 'Access Management', itemRequested: 'Most recent user access review evidence (approvals + actions taken)', whyPurpose: 'Confirm periodic access certification operates as designed', formatExpected: 'Excel + emails / GRC export', priority: 'High', tscMapping: ['Security', 'Confidentiality'] },
  { category: 'Access Management', itemRequested: 'Password / MFA policy configuration screenshots from each app (length, complexity, MFA enforcement)', whyPurpose: 'Confirm authentication controls match policy', formatExpected: 'Screenshots / config export', priority: 'Medium', tscMapping: ['Security'] },

  // Change Management
  { category: 'Change Management', itemRequested: 'Change management policy + workflow diagram', whyPurpose: 'Establish design of change controls', formatExpected: 'PDF / Word / Visio', priority: 'High', tscMapping: ['Security', 'Processing Integrity'] },
  { category: 'Change Management', itemRequested: 'Full change ticket population for the audit period (prod-impacting changes)', whyPurpose: 'Sampling population for change testing', formatExpected: 'CSV export from ticketing system', priority: 'High', tscMapping: ['Processing Integrity'] },
  { category: 'Change Management', itemRequested: 'Emergency change listing with post-implementation review evidence', whyPurpose: 'Test the e-change process and after-the-fact controls', formatExpected: 'CSV + tickets', priority: 'Medium', tscMapping: ['Processing Integrity'] },
  { category: 'Change Management', itemRequested: 'CI/CD pipeline configuration / branch protection for in-scope repos', whyPurpose: 'Confirm separation of duties in code deployment', formatExpected: 'Screenshots / config export', priority: 'Medium', tscMapping: ['Security', 'Processing Integrity'] },
  { category: 'Change Management', itemRequested: 'List of developers with production deploy access', whyPurpose: 'Test SoD between develop and deploy', formatExpected: 'Excel/CSV', priority: 'High', tscMapping: ['Security'] },

  // IT Operations
  { category: 'IT Operations', itemRequested: 'Backup policy + most recent restore test results (per critical system)', whyPurpose: 'Confirm backup process operating and tested', formatExpected: 'PDF + tickets / runbook output', priority: 'High', tscMapping: ['Availability'] },
  { category: 'IT Operations', itemRequested: 'Patch management standard + patch compliance report as of cutoff', whyPurpose: 'Test patch SLA adherence', formatExpected: 'PDF + scanner export', priority: 'Medium', tscMapping: ['Security', 'Availability'] },
  { category: 'IT Operations', itemRequested: 'Vulnerability scan reports for the audit period (external + internal)', whyPurpose: 'Confirm vulnerability management cadence + remediation', formatExpected: 'PDF / scanner export', priority: 'Medium', tscMapping: ['Security'] },
  { category: 'IT Operations', itemRequested: 'Incident response playbook + incident log for the audit period', whyPurpose: 'Test IR readiness and historical handling', formatExpected: 'PDF + ticket export', priority: 'Medium', tscMapping: ['Security', 'Availability'] },
  { category: 'IT Operations', itemRequested: 'Monitoring + alerting configuration (key dashboards, on-call rota)', whyPurpose: 'Confirm operational monitoring coverage', formatExpected: 'Screenshots / on-call schedule', priority: 'Medium', tscMapping: ['Availability'] },
  { category: 'IT Operations', itemRequested: 'BCP/DR plan + most recent DR test report', whyPurpose: 'Confirm continuity plans are tested annually', formatExpected: 'PDF + test report', priority: 'Medium', tscMapping: ['Availability'] },

  // Third Parties
  { category: 'Third Parties', itemRequested: 'Vendor inventory with criticality classification and data shared', whyPurpose: 'Identify in-scope vendor population', formatExpected: 'Excel / GRC export', priority: 'High', tscMapping: ['Security', 'Confidentiality'] },
  { category: 'Third Parties', itemRequested: 'Most recent SOC 2 / ISO reports for critical vendors', whyPurpose: 'Evidence of third-party control reliance', formatExpected: 'PDFs', priority: 'High', tscMapping: ['Security'] },
  { category: 'Third Parties', itemRequested: 'Vendor onboarding due-diligence packet samples', whyPurpose: 'Test vendor onboarding control', formatExpected: 'Folder of vendor packets', priority: 'Medium', tscMapping: ['Security'] },
  { category: 'Third Parties', itemRequested: 'Master service agreement template / DPA template', whyPurpose: 'Confirm contractual security and data protection terms', formatExpected: 'PDF / Word', priority: 'Low', tscMapping: ['Confidentiality'] },

  // Licensing
  { category: 'Licensing', itemRequested: 'Master software license inventory (per application + entitlement counts)', whyPurpose: 'Establish licensing baseline', formatExpected: 'Excel / SAM tool export', priority: 'High', tscMapping: ['Security'] },
  { category: 'Licensing', itemRequested: 'Latest reconciliation: licenses held vs deployed/active', whyPurpose: 'Test compliance with license terms', formatExpected: 'Excel', priority: 'High', tscMapping: ['Security'] },
  { category: 'Licensing', itemRequested: 'OEM / Microsoft / Adobe / Oracle audit history (if applicable)', whyPurpose: 'Confirm history of vendor audits and outcomes', formatExpected: 'PDF / email thread', priority: 'Low', tscMapping: [] },
  { category: 'Licensing', itemRequested: 'Open-source software inventory + license obligations (SBOM)', whyPurpose: 'Confirm OSS license compliance', formatExpected: 'CSV / SBOM JSON', priority: 'Medium', tscMapping: [] },

  // IT Spend
  { category: 'IT Spend', itemRequested: 'IT budget vs actuals for the audit period (by cost center)', whyPurpose: 'Spend benchmarking and outlier identification', formatExpected: 'Excel', priority: 'Medium', tscMapping: [] },
  { category: 'IT Spend', itemRequested: 'Top 20 IT vendor spend with contract end dates', whyPurpose: 'Renewal planning and spend concentration', formatExpected: 'Excel', priority: 'Medium', tscMapping: [] },
  { category: 'IT Spend', itemRequested: 'Cloud spend report (per provider, last 12 months trended monthly)', whyPurpose: 'Identify cost optimization opportunities', formatExpected: 'CSV / provider export', priority: 'Low', tscMapping: [] },
  { category: 'IT Spend', itemRequested: 'Headcount + contractor cost breakdown by IT function', whyPurpose: 'Org cost analysis', formatExpected: 'Excel', priority: 'Low', tscMapping: [] },

  // SOC 2 Readiness
  { category: 'SOC 2 Readiness', itemRequested: 'Existing SOC 2 readiness assessment or gap analysis (if any)', whyPurpose: 'Identify known gaps to plan testing efficiently', formatExpected: 'PDF / Word', priority: 'Medium', tscMapping: ['Security', 'Availability', 'Confidentiality'] },
  { category: 'SOC 2 Readiness', itemRequested: 'Information security policy + most recent management review evidence', whyPurpose: 'Foundational SOC 2 Security CC control', formatExpected: 'PDF + sign-off', priority: 'High', tscMapping: ['Security'] },
  { category: 'SOC 2 Readiness', itemRequested: 'Most recent security awareness training completion report', whyPurpose: 'Test workforce training control', formatExpected: 'Excel / LMS export', priority: 'Medium', tscMapping: ['Security'] },
  { category: 'SOC 2 Readiness', itemRequested: 'Data retention + disposal policy and evidence of execution', whyPurpose: 'Test data lifecycle controls', formatExpected: 'PDF + tickets', priority: 'Medium', tscMapping: ['Confidentiality'] },
  { category: 'SOC 2 Readiness', itemRequested: 'Encryption-in-transit and at-rest configuration evidence for the most sensitive systems', whyPurpose: 'Confirm cryptographic controls', formatExpected: 'Screenshots / config export', priority: 'High', tscMapping: ['Security', 'Confidentiality'] },

  // Physical & Environmental
  { category: 'Physical & Environmental', itemRequested: 'List of in-scope physical sites (offices + data centers + colos)', whyPurpose: 'Determine physical scope', formatExpected: 'Excel', priority: 'Medium', tscMapping: ['Security'] },
  { category: 'Physical & Environmental', itemRequested: 'Badge access listings for data center / server room areas', whyPurpose: 'Test physical access restriction', formatExpected: 'Excel / access system export', priority: 'Medium', tscMapping: ['Security'] },
  { category: 'Physical & Environmental', itemRequested: 'Visitor log / sign-in records for sensitive facilities, last 90 days', whyPurpose: 'Test visitor access control', formatExpected: 'CSV / scanned log', priority: 'Low', tscMapping: ['Security'] },
  { category: 'Physical & Environmental', itemRequested: 'Environmental controls evidence: UPS, fire suppression, temperature/humidity logs', whyPurpose: 'Confirm environmental controls for availability', formatExpected: 'Screenshots / monitoring export', priority: 'Low', tscMapping: ['Availability'] },
];

// ---- Access requests ----
const ACCESS: LibraryAccessRequest[] = [
  { system: 'Active Directory / Entra ID', accessType: 'Read-only auditor', rolePermissions: 'Read users, groups, group memberships, last logon', recommendedMethod: 'Custom RBAC role', justification: 'User listing extraction for access testing' },
  { system: 'Okta / SSO', accessType: 'Read-only', rolePermissions: 'Read users, groups, app assignments, sign-in logs', recommendedMethod: 'Built-in Read-only Admin', justification: 'Authentication and SSO control testing' },
  { system: 'HRIS (Workday / SAP / BambooHR)', accessType: 'Auditor read-only', rolePermissions: 'Active employees + contractor list, hire/term dates, manager hierarchy', recommendedMethod: 'Audit role', justification: 'Joiner/mover/leaver testing' },
  { system: 'ERP (in-scope financial system)', accessType: 'Read-only', rolePermissions: 'Users, roles, role assignments, change history', recommendedMethod: 'Built-in Inquiry role', justification: 'Privileged access + change review' },
  { system: 'CRM (e.g. Salesforce / Dynamics)', accessType: 'Read-only', rolePermissions: 'Users, profiles, permission sets, login history', recommendedMethod: 'View All', justification: 'Access testing' },
  { system: 'Production cloud (AWS / Azure / GCP)', accessType: 'Read-only Reader', rolePermissions: 'List resources, read IAM, read CloudTrail / Activity Log', recommendedMethod: 'Built-in Reader / SecurityAudit', justification: 'Cloud infra and IAM testing' },
  { system: 'Source control (GitHub / GitLab / Bitbucket)', accessType: 'Org auditor', rolePermissions: 'Read all repos, branch protection settings, audit log', recommendedMethod: 'Built-in Auditor role', justification: 'Change control testing' },
  { system: 'CI/CD (GitHub Actions / Azure DevOps / Jenkins)', accessType: 'Read-only', rolePermissions: 'Read pipeline definitions, runs, approvers, secrets metadata', recommendedMethod: 'Built-in viewer', justification: 'Deployment control testing' },
  { system: 'Ticketing (Jira / ServiceNow)', accessType: 'Read-only', rolePermissions: 'Read all projects/queues used for change + incident management', recommendedMethod: 'Custom view role', justification: 'Change + incident sampling' },
  { system: 'EDR / Antivirus console', accessType: 'Read-only', rolePermissions: 'Coverage reports, detection history, exclusions', recommendedMethod: 'Built-in viewer', justification: 'Endpoint protection coverage testing' },
  { system: 'Vulnerability scanner', accessType: 'Read-only', rolePermissions: 'Scan history, findings, remediation status', recommendedMethod: 'Built-in viewer', justification: 'Vulnerability management testing' },
  { system: 'MDM (Intune / Jamf)', accessType: 'Read-only', rolePermissions: 'Device inventory, compliance status, configuration profiles', recommendedMethod: 'Read-only Operator', justification: 'Endpoint configuration testing' },
];

// ---- Walkthroughs ----
const WALKS: LibraryWalkthrough[] = [
  { processArea: 'IT Governance',
    description: 'A working session with IT leadership to understand how IT is run end-to-end: how decisions get made, where policy ownership sits, and how exceptions are handled. This is usually the first walkthrough we run and sets context for everything else.',
    objective: 'Confirm that an IT governance framework exists, is owned at the right level, and that policies are reviewed on a regular cadence.',
    keyTopics: 'Org structure, steering committee cadence, policy ownership, exception process', attendees: 'CIO / IT Director', durationMin: 60 },
  { processArea: 'Logical Access — Joiner / Mover / Leaver',
    description: 'Walk through how a user gains, changes, and loses access to in-scope applications across the full employment lifecycle. We will trace one of each (joiner, mover, leaver) in the relevant system to see the control operating.',
    objective: 'Confirm the end-to-end access lifecycle is designed, approved, executed, and reviewed — and that deprovisioning happens within an acceptable SLA.',
    keyTopics: 'Provisioning flow per app, manager approval, periodic review, deprovisioning SLAs', attendees: 'IAM Lead, HRIS owner', durationMin: 90 },
  { processArea: 'Privileged Access',
    description: 'Walk through how administrative access to production systems is granted, used, monitored, and revoked. Covers normal admin access, break-glass / firefighter accounts, and any privileged access management tooling.',
    objective: 'Confirm that privileged access is restricted to a small, named population; that elevated sessions are logged; and that break-glass procedures are documented and tested.',
    keyTopics: 'PAM tooling, break-glass procedures, admin account review', attendees: 'IT Security Lead', durationMin: 60 },
  { processArea: 'Change Management',
    description: 'Walk through the lifecycle of a typical production-impacting change, from ticket creation to post-implementation review. We pick one normal change and one emergency change to compare.',
    objective: 'Confirm that production changes are approved before deployment, that segregation of duties is enforced, and that emergency changes are reviewed after the fact.',
    keyTopics: 'Ticket lifecycle, approvals, CAB, emergency changes, post-implementation review', attendees: 'Release Manager, Eng Lead', durationMin: 90 },
  { processArea: 'Software Development Lifecycle',
    description: 'Walk through how a code change moves from a developer commit to production: branching, peer review, automated testing, deployment gates, and who can bypass each step.',
    objective: 'Confirm that code reaching production has been peer-reviewed and that automated controls (CI, branch protection) are in place to enforce SoD between develop and deploy.',
    keyTopics: 'Branching strategy, code review, automated testing, deploy gates', attendees: 'Engineering Manager', durationMin: 60 },
  { processArea: 'Backup & Restore',
    description: 'Walk through the backup posture for in-scope critical systems: what is backed up, where backups live, how long they are retained, and how a restore actually plays out.',
    objective: 'Confirm that backups exist for all critical systems and that at least one successful restore test has been performed within the audit period.',
    keyTopics: 'Backup schedule, retention, restore tests, offsite copies', attendees: 'Infra / Ops Lead', durationMin: 45 },
  { processArea: 'Vulnerability & Patch Management',
    description: 'Walk through how vulnerabilities are discovered, prioritised, tracked, and remediated across servers, endpoints, and applications. Covers both the tooling and the human workflow.',
    objective: 'Confirm that vulnerabilities are identified on a regular cadence and remediated within SLA, with documented exceptions for anything outstanding.',
    keyTopics: 'Scanning cadence, SLA per severity, exception tracking', attendees: 'IT Security Lead', durationMin: 60 },
  { processArea: 'Incident Response',
    description: 'Walk through how an incident is detected, triaged, communicated, and closed out. We will reference one or two real incidents from the audit period.',
    objective: 'Confirm that the incident response plan is documented, executed in practice, and that high-severity incidents drive a post-mortem.',
    keyTopics: 'Detection, triage, comms, post-mortem cadence', attendees: 'IR Lead', durationMin: 60 },
  { processArea: 'Third-Party Risk Management',
    description: 'Walk through how new vendors are onboarded, how they are monitored over time, and how contractual security and data protection terms are negotiated.',
    objective: 'Confirm that critical vendors are subject to due diligence at onboarding and on an ongoing basis, with current SOC 2 / risk assessments on file.',
    keyTopics: 'Onboarding due diligence, ongoing monitoring, contract terms', attendees: 'Vendor Risk Manager', durationMin: 60 },
];

// ---- Entities (empty/example placeholders) ----
const ENTITIES: LibraryEntity[] = [
  { legalEntity: 'HQ entity', countryLocation: null, itModel: 'Centralized', keyApplications: 'ERP, HRIS, CRM, SSO', hosting: 'Cloud', headcount: null, inScope: 'Y', rationale: 'Primary in-scope entity' },
  { legalEntity: 'EU subsidiary', countryLocation: null, itModel: 'Hybrid', keyApplications: 'Local AD + cloud apps', hosting: 'Hybrid', headcount: null, inScope: 'Y', rationale: 'Material entity in scope' },
  { legalEntity: 'APAC subsidiary', countryLocation: null, itModel: 'Standalone', keyApplications: 'Local file shares + cloud email', hosting: 'On-Prem', headcount: null, inScope: null, rationale: 'Scope TBD pending materiality assessment' },
  { legalEntity: 'Acquired entity (year 1)', countryLocation: null, itModel: 'Standalone', keyApplications: 'Pre-acquisition stack, integration in progress', hosting: 'On-Prem', headcount: null, inScope: null, rationale: 'Carve-out — confirm scope after integration plan review' },
  { legalEntity: 'Dormant / holding entity', countryLocation: null, itModel: null, keyApplications: null, hosting: null, headcount: 0, inScope: 'N', rationale: 'No active IT operations' },
];

// ---- Sampling controls ----
const SAMPLING: LibrarySamplingItem[] = [
  { controlArea: 'Joiner provisioning', controlDescription: 'New hires have access requested + approved before account creation', populationSource: 'HRIS new hires for the audit period', samplingMethod: 'Random sample, 25 (n>=25)' },
  { controlArea: 'Leaver deprovisioning', controlDescription: 'Terminated employees have all access revoked within 24 hours of effective date', populationSource: 'HRIS terminations for the audit period', samplingMethod: 'Random sample, 25' },
  { controlArea: 'Periodic access review', controlDescription: 'Manager certification of direct-report access at least annually per app', populationSource: 'Completed access reviews per in-scope app', samplingMethod: 'All reviews; trace 5 per review' },
  { controlArea: 'Privileged access approval', controlDescription: 'Granting of admin access has documented approval', populationSource: 'Admin grants during the audit period', samplingMethod: 'Random sample, 25' },
  { controlArea: 'Change approval', controlDescription: 'Production-impacting changes have documented approval before deployment', populationSource: 'Change tickets for the audit period', samplingMethod: 'Random sample, 25 (stratified by environment)' },
  { controlArea: 'Emergency change post-review', controlDescription: 'Emergency changes have post-implementation review within 5 business days', populationSource: 'Emergency changes for the audit period', samplingMethod: 'All e-changes if <25, else random 25' },
  { controlArea: 'Code review', controlDescription: 'Prod-bound code changes have peer review before merge', populationSource: 'Merged pull requests to production branches', samplingMethod: 'Random sample, 25' },
  { controlArea: 'Patch SLA compliance', controlDescription: 'Critical OS patches applied within policy SLA', populationSource: 'Server inventory + scanner findings as of cutoff', samplingMethod: 'Risk-based: top critical findings + random 15' },
  { controlArea: 'Backup restore test', controlDescription: 'At least one successful restore test per critical system per year', populationSource: 'List of critical systems', samplingMethod: 'All critical systems' },
  { controlArea: 'Incident response', controlDescription: 'Incidents are triaged, communicated, and closed with post-mortem (if Sev1/Sev2)', populationSource: 'Incident tickets for the audit period', samplingMethod: 'All Sev1/Sev2 + random 10 lower-sev' },
  { controlArea: 'Vendor due diligence', controlDescription: 'Critical vendors have current SOC 2 / risk assessment on file', populationSource: 'Critical vendor inventory', samplingMethod: 'All critical vendors' },
  { controlArea: 'MFA enforcement', controlDescription: 'MFA is enforced for all interactive logins to in-scope apps', populationSource: 'Active users per in-scope app', samplingMethod: 'Configuration test (no sampling); spot-check 10 user logon events' },
];

export const LIBRARY = {
  pbc: PBC,
  access: ACCESS,
  walkthroughs: WALKS,
  entities: ENTITIES,
  sampling: SAMPLING,
} as const;

// Compile-time guarantee: every PBC item references a category that is in the
// canonical list. Catches typos before runtime.
const _categoryCheck: Record<PBCCategory, true> = Object.fromEntries(
  PBC_CATEGORIES.map((c) => [c, true as const])
) as Record<PBCCategory, true>;
for (const it of PBC) {
  if (!_categoryCheck[it.category]) {
    throw new Error(`library: unknown PBC category ${it.category}`);
  }
}

export interface LibrarySelection {
  pbcCategories: PBCCategory[];
  includeAccess: boolean;
  includeWalkthroughs: boolean;
  includeEntities: boolean;
  includeSampling: boolean;
}

/** Selection that picks the entire library. */
export const FULL_LIBRARY_SELECTION: LibrarySelection = {
  pbcCategories: [...PBC_CATEGORIES],
  includeAccess: true,
  includeWalkthroughs: true,
  includeEntities: true,
  includeSampling: true,
};

export function isValidCategory(s: unknown): s is PBCCategory {
  return typeof s === 'string' && (PBC_CATEGORIES as readonly string[]).includes(s);
}
