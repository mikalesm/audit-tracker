// Master library for engagement templates.
//
// This is the firm's real IT-audit programme, transcribed from the
// authoritative workbook `IT_Audit_PBC_Tracker_v2.xlsx` (committed at
// `data/templates/`). A fresh install can create useful templates without
// uploading the Excel. Each platform-admin can still override / extend the
// content per-template using Settings → Re-sync from Excel inside the
// template engagement.
//
// Counts: 88 PBC items across 14 categories, 19 access requests, 11
// walkthroughs, 16 sampling controls. The original 55 items across 10
// categories are transcribed from the workbook; the Endpoint & MDM, Security
// Posture, Cloud Security Posture, and AI Governance categories (33 items)
// were added to cover modern endpoint-management, posture, and AI-governance
// audit scope. Each PBC item carries a `scope` ('group' | 'entity'): entity
// items are instantiated once per in-scope legal entity at seed time.
// Entities are intentionally illustrative (the workbook's Entity Scope sheet
// is a blank per-client template).
//
// Categories MUST match the Category union in src/types/index.ts. The TSC
// auto-mapping (DEFAULT_TSC_BY_CATEGORY below) is the single source of truth
// shared with the Excel importer in src/lib/excel/import.ts.

import type { Category, PBCPriority, TSC } from '@/types';

export type PBCCategory = Category;

export const PBC_CATEGORIES: readonly PBCCategory[] = [
  'Governance',
  'Entities & Systems',
  'Access Management',
  'Change Management',
  'IT Operations',
  'Endpoint & MDM',
  'Security Posture',
  'Cloud Security Posture',
  'AI Governance',
  'Third Parties',
  'Licensing',
  'IT Spend',
  'SOC 2 Readiness',
  'Physical & Environmental',
] as const;

// Default SOC 2 Trust Service Criteria per category. Single source of truth:
// the Excel importer (src/lib/excel/import.ts) imports this to auto-map TSC on
// rows that arrive without an explicit mapping, and the library below uses it
// to derive tscMapping for every PBC item.
export const DEFAULT_TSC_BY_CATEGORY: Record<PBCCategory, TSC[]> = {
  'Governance': ['Security'],
  'Entities & Systems': ['Security'],
  'Access Management': ['Security', 'Confidentiality'],
  'Change Management': ['Security', 'Processing Integrity'],
  'IT Operations': ['Availability', 'Security'],
  'Endpoint & MDM': ['Security', 'Confidentiality'],
  'Security Posture': ['Security'],
  'Cloud Security Posture': ['Security', 'Availability', 'Confidentiality'],
  'AI Governance': ['Security', 'Confidentiality', 'Privacy'],
  'Third Parties': ['Security', 'Confidentiality'],
  'Licensing': ['Security'],
  'IT Spend': [],
  'SOC 2 Readiness': ['Security', 'Availability', 'Confidentiality'],
  'Physical & Environmental': ['Security', 'Availability'],
};

// One-line description of what each category covers — surfaced as tooltips in
// the UI. Transcribed from the workbook's Categories reference sheet.
export const CATEGORY_COVERAGE: Record<PBCCategory, string> = {
  'Governance': 'Org structure, policies, risk, audit history, strategy, training',
  'Entities & Systems': 'Multi-entity scoping, applications, network, cloud/SaaS, assets, domains/certs',
  'Access Management': 'Identity dump, privileged users, HR reconciliation, JML, access reviews, service accounts, authentication',
  'Change Management': 'Change population, procedure, emergency changes, dev/prod segregation, code repos',
  'IT Operations': 'Backups, incidents, monitoring, patching, vulnerabilities, AV/EDR, BCP/DR',
  'Endpoint & MDM': 'Device management platform, compliance policies, configuration baselines, app protection, mobile/BYOD, endpoint patching',
  'Security Posture': 'Posture score & trend, attack surface & exposure, detection coverage, posture remediation, framework alignment',
  'Cloud Security Posture': 'CSPM findings, cloud config baselines, cloud identity & privileged access, key/secret/data protection, cloud logging & detection',
  'AI Governance': 'AI/GenAI tool inventory, AI acceptable-use policy, Copilot/enterprise AI config, data exposure & DLP for AI, shadow AI & model risk',
  'Third Parties': 'Vendor inventory, assurance reports, onboarding/DD, contracts/DPAs',
  'Licensing': 'License inventory & optimization, true-ups, SaaS seats, prior audits, procurement',
  'IT Spend': 'Budget vs actual, GL detail, top vendors, PO/invoice approval, intercompany, capex/opex, shadow IT',
  'SOC 2 Readiness': 'TSC scope, control matrix, system description, risk assessment, customer commitments',
  'Physical & Environmental': 'Data center access, environmental controls (if on-prem)',
};

export interface LibraryPBCItem {
  category: PBCCategory;
  itemRequested: string;
  whyPurpose: string;
  formatExpected: string;
  priority: PBCPriority;
  tscMapping: TSC[];
  /**
   * `'group'` — one engagement-wide request. `'entity'` — instantiated once
   * per in-scope legal entity (e.g. a network map per subsidiary).
   */
  scope: 'group' | 'entity';
  /** Stable slug linking a seeded row back to this library item. */
  templateKey: string;
}

/**
 * Default scope per category. Most audit evidence is group-wide; access work
 * and physical controls are inherently per-entity (each entity has its own
 * identity tenant / AD / facility). Per-item exceptions are in SCOPE_OVERRIDES.
 */
const DEFAULT_SCOPE_BY_CATEGORY: Record<PBCCategory, 'group' | 'entity'> = {
  'Governance': 'group',
  'Entities & Systems': 'group',
  'Access Management': 'entity',
  'Change Management': 'group',
  'IT Operations': 'group',
  'Endpoint & MDM': 'group',
  'Security Posture': 'group',
  'Cloud Security Posture': 'group',
  'AI Governance': 'group',
  'Third Parties': 'group',
  'Licensing': 'group',
  'IT Spend': 'group',
  'SOC 2 Readiness': 'group',
  'Physical & Environmental': 'entity',
};

// Per-item scope exceptions, matched by a substring of `itemRequested`.
// In Entities & Systems the inventories are per-entity, but the multi-entity
// scoping pack (which *defines* the entities) and the tenant-wide cloud/SaaS
// inventory stay group-wide.
const SCOPE_OVERRIDES: { match: string; scope: 'group' | 'entity' }[] = [
  { match: 'Application inventory per entity', scope: 'entity' },
  { match: 'Network architecture pack', scope: 'entity' },
  { match: 'Asset inventory —', scope: 'entity' },
  { match: 'Domain and SSL/TLS certificate inventory', scope: 'entity' },
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// Stable key from category + the distinctive head clause of the request text.
function templateKeyFor(category: string, itemRequested: string): string {
  const head = itemRequested.split(/[—:]/)[0].trim();
  return `${slugify(category)}/${slugify(head)}`;
}

function scopeFor(item: { category: PBCCategory; itemRequested: string }): 'group' | 'entity' {
  const override = SCOPE_OVERRIDES.find(o => item.itemRequested.includes(o.match));
  return override ? override.scope : DEFAULT_SCOPE_BY_CATEGORY[item.category];
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
// Transcribed verbatim from the workbook's PBC List sheet. tscMapping is
// derived per-category from DEFAULT_TSC_BY_CATEGORY below.
const PBC_RAW: Omit<LibraryPBCItem, 'tscMapping' | 'scope' | 'templateKey'>[] = [
  // Governance (7)
  { category: 'Governance', itemRequested: 'IT organizational chart — all entities, with roles, reporting lines, and external vendors / MSPs / contractors involved in IT operations', whyPurpose: 'Understand IT structure, identify control owners, SoD at org level, surface external parties embedded in IT processes', formatExpected: 'PDF / Visio', priority: 'High' },
  { category: 'Governance', itemRequested: 'All IT and InfoSec policies — Acceptable Use, InfoSec, Access Control, Change Mgmt, Backup, Incident Response, Vendor Mgmt, Data Classification, BCP/DR, Password, Remote Access, Encryption, Data Retention, GenAI Use, MDM, Clean Desk', whyPurpose: 'Baseline for control design assessment; SOC 2 TSC mapping; check policies are current and approved', formatExpected: 'PDF / Word, with version, approval date, and owner', priority: 'High' },
  { category: 'Governance', itemRequested: 'IT risk assessment + risk register (current & prior year) + methodology + risk acceptance log + steering minutes referencing risk + heat map + supporting inputs (pen tests, threat intel, vuln scans, prior audits)', whyPurpose: 'Confirm structured, current view of IT risks; align audit scope; surface gaps where significant risks have no controls', formatExpected: 'Excel + PDF', priority: 'High' },
  { category: 'Governance', itemRequested: 'Prior internal/external audit reports (IT) and management responses — last 12 months (incl. internal audit, ITGC memos, prior SOC 2/ISO, regulatory inspections, pen tests, vendor licensing audits)', whyPurpose: 'Identify previously known findings, check remediation status, flag repeat issues', formatExpected: 'PDF reports + remediation tracker', priority: 'Medium' },
  { category: 'Governance', itemRequested: 'IT steering committee minutes — last 12 months, with attendees and charter', whyPurpose: 'Evidence of governance and oversight; tone at the top; budget/risk/incident escalation', formatExpected: 'PDF', priority: 'Medium' },
  { category: 'Governance', itemRequested: 'IT strategy document and roadmap (1-3 year strategy + annual roadmap)', whyPurpose: 'Alignment of IT direction with business strategy; planned investments and major initiatives driving change risk', formatExpected: 'PDF / PowerPoint', priority: 'Medium' },
  { category: 'Governance', itemRequested: 'Security awareness and training program — curriculum, completion records, phishing simulations (campaigns, click rates, repeat offenders), new-hire onboarding, role-specific training (devs, admins, finance), policy acknowledgments', whyPurpose: 'SOC 2 CC1.4 / CC2.2; demonstrates personnel competence and awareness; phishing/social engineering control', formatExpected: 'Training platform export + materials', priority: 'High' },

  // Entities & Systems (6)
  { category: 'Entities & Systems', itemRequested: 'Multi-entity scoping pack — per-entity profile (legal name, country, regulatory regime, headcount, IT model, local IT, M&A); shared vs separate services matrix (identity, email, network, helpdesk, ERP, HRIS, backup, SOC); inter-entity arrangements (MSAs, allocations, data flows, cross-entity access); scoping decisions and exclusions; group structure', whyPurpose: 'Define audit boundary; identify intercompany IT dependencies and shared services', formatExpected: 'Excel + PDF org chart', priority: 'High' },
  { category: 'Entities & Systems', itemRequested: 'Application inventory per entity — name, version, owner (business + IT), criticality, hosting model, vendor, data classification, authentication, integrations, in scope for SOC 2 / financial reporting', whyPurpose: 'Scope in-scope systems; foundation for access, change, licensing testing', formatExpected: 'Excel', priority: 'High' },
  { category: 'Entities & Systems', itemRequested: 'Network architecture pack — logical + physical diagrams; cloud architecture per workload; inter-entity connectivity; perimeter; remote access; identity; data flow diagrams; IP schema; network device inventory; firewall rule base + rule review evidence; segmentation rationale; DNS architecture; certificate/PKI documentation; wireless design; change log; monitoring tools; IDS/IPS coverage', whyPurpose: 'Architecture, trust boundaries, segmentation; required for SOC 2 system description', formatExpected: 'Visio / Lucid / PDF + Excel', priority: 'High' },
  { category: 'Entities & Systems', itemRequested: 'Cloud and SaaS inventory — vendor, plan, account/tenant IDs, owner, entity, data, auth method, seats vs active users, annual cost, contract dates, SOC 2 / ISO attestations, procurement route (formal vs shadow IT)', whyPurpose: 'Scope cloud workloads; sub-service organizations for SOC 2; foundation for licensing/spend', formatExpected: 'Excel', priority: 'High' },
  { category: 'Entities & Systems', itemRequested: 'Asset inventory — servers, workstations, mobile, network devices, printers/IoT/OT; with hostname, OS, owner, location, criticality, support status; decommissioned asset list + disposal evidence; reconciliation between sources (CMDB vs Intune vs HR vs procurement)', whyPurpose: 'Completeness check for patch / vuln / EDR coverage testing', formatExpected: 'Excel / CMDB export', priority: 'Medium' },
  { category: 'Entities & Systems', itemRequested: 'Domain and SSL/TLS certificate inventory — registered domains (registrar, expiry, auto-renewal, DNSSEC, SPF/DKIM/DMARC); subdomain inventory; cert inventory (CN, SANs, issuer, expiry, key size, owner); renewal process; expiring certs (30/60/90 days); deprecated algorithms; code signing certs', whyPurpose: 'Surfaces forgotten internet-facing assets, expired certs, weak crypto, subdomain takeover risk', formatExpected: 'Excel + supporting exports', priority: 'Medium' },

  // Access Management (7)
  { category: 'Access Management', itemRequested: 'Identity & access full data extract pack — user dump per tenant (UPN, status, last sign-in interactive+non-interactive, password change, MFA registration & methods, CA policies, risk state, licenses, dept, manager, entity, type, mailbox, forwarding rules); guests; service accounts & app registrations; groups (incl. privileged & dynamic); PIM eligible vs active; CA policy export; auth methods policy; on-prem AD (DCs, trusts, Tier 0, password policy, GPOs, Kerberos delegation, SPNs); reconciliation data (HR, contractors, terminated, role changes); sign-in & audit logs; risky sign-in reports; inactive user reports', whyPurpose: 'Foundation for all access testing — completeness, stale accounts, MFA coverage, license-to-user reconciliation', formatExpected: 'CSV per dataset; Graph API extraction preferred', priority: 'High' },
  { category: 'Access Management', itemRequested: 'Privileged / admin user listings per system — Entra/AD directory roles, app admins, DB sysadmins, OS local admins, cloud Owner/Contributor/UAA, network device admins, security tool admins, hypervisor admins, backup admins, ticketing admins, source code admins, ERP/HRIS admins, M365 workload admins; per user: name, role, justification, approval, date granted, last review, JIT vs permanent, MFA, named vs shared', whyPurpose: 'Test least privilege, validate approvals, identify SoD conflicts', formatExpected: 'Excel — one tab per system', priority: 'High' },
  { category: 'Access Management', itemRequested: 'HR active employee listing as of testing date + JML extracts — employee ID, name, status, hire/term dates, dept, title, manager, entity, employment type; separate extracts for terminations, new hires, role changes during period; contractor/third-party worker list; long-term leave list', whyPurpose: 'Reconciliation source of truth; ghost accounts; deprovisioning testing', formatExpected: 'CSV / Excel', priority: 'High' },
  { category: 'Access Management', itemRequested: 'JML process documentation + sample tickets — joiner, mover, leaver, contractor, emergency termination procedures; RACI; access matrices/birthright; SLA targets; 5-10 sample tickets each (joiners, leavers including involuntary, movers, contractors); evidence per ticket showing request, approver, HR trigger, all systems touched, timestamps, completion', whyPurpose: 'Test design + operating effectiveness of provisioning/deprovisioning', formatExpected: 'PDF + ticket exports', priority: 'High' },
  { category: 'Access Management', itemRequested: 'Periodic access review evidence per system — frequency, last review (user list reviewed, reviewer, date, sign-off, decisions, exceptions, remediation tickets, closure evidence, time to remediation); reviews of privileged accounts, standard users, service accounts, guests, group memberships, application access, cross-entity access, OAuth grants', whyPurpose: 'SOC 2 CC6.2 / CC6.3 — common failure point; rubber-stamp risk', formatExpected: 'Excel + email approvals + tickets', priority: 'High' },
  { category: 'Access Management', itemRequested: 'Service / generic / shared account inventory — per account: name, system, purpose, owner, backup owner, permissions, password rotation, vault status, who has credentials, MFA enforcement, interactive login allowed, last activity, monitoring, last review; categories: service, system/built-in, generic, shared, app-to-app, break-glass, vendor accounts; naming convention, approval process, PAM coverage report', whyPurpose: 'Often the weakest link: high privilege, no clear owner, never reviewed; major SOC 2 finding area', formatExpected: 'Excel', priority: 'Medium-High' },
  { category: 'Access Management', itemRequested: 'Authentication & password configuration pack — on-prem AD (default domain policy, lockout, FGPP, Kerberos, NTLM, LDAP, SMB signing, gMSA, LAPS, SPNs); Entra ID (auth methods policy, password protection, smart lockout, SSPR, security defaults, legacy auth, B2B settings); Conditional Access full export with gap analysis; MFA detail (methods, phishing-resistant coverage, app passwords, trusted IPs); per-app authentication (SSO, MFA, local accounts); privileged auth (PIM MFA, PAW, JIT); cloud platform auth (root protection, IAM password policy, key rotation); other surfaces (VPN, ZTNA, jump host, DB auth, SSH keys, API auth, Wi-Fi 802.1X); Identity Protection; app secret/cert inventory + expiries; federation/trust', whyPurpose: 'Validates policy on paper matches enforcement in systems — common finding gap', formatExpected: 'Screenshots + config exports + GPO HTML + CA JSON + Graph extracts', priority: 'Medium-High' },

  // Change Management (5)
  { category: 'Change Management', itemRequested: 'Full population of changes during audit period — ticket export with: change ID, type (standard/normal/emergency/pre-approved), category, system/CI, requestor, approvers, risk rating, planned/actual dates, status, backout plan, testing evidence, PIR, linked incidents, entity; completeness reconciliation against deployment logs / release notes / CI/CD history; CAB minutes; release calendar', whyPurpose: 'Population for change testing — without complete population, no change testing is reliable', formatExpected: 'CSV / Excel + supporting docs', priority: 'High' },
  { category: 'Change Management', itemRequested: 'Change management procedure / workflow — policy, change types definitions, RACI, workflow diagram, approval matrix, CAB structure, risk/impact criteria, testing requirements, backout requirements, PIR requirements, emergency procedure, standard/pre-approved catalog, freeze periods, bypass capture process, integration with incident & project mgmt, multi-entity scope, tooling', whyPurpose: 'Establishes control design before testing operating effectiveness', formatExpected: 'PDF / Word', priority: 'High' },
  { category: 'Change Management', itemRequested: 'Emergency change evidence — full list of emergency changes during period; per change: emergency justification, pre-implementation approval, implementation evidence, post-implementation approval, linked incident; emergency rate trend; breakdown by system/implementer/reason; after-hours procedure; any without post-approval (open exceptions)', whyPurpose: 'Highest-risk change type; common abuse area for routine work', formatExpected: 'Ticket exports + evidence', priority: 'Medium-High' },
  { category: 'Change Management', itemRequested: 'Dev / Test / Prod segregation — environment list per app, network segregation, data segregation (no prod data in lower envs / masking); access lists for prod and dev (and any cross-env access with justification); CI/CD pipeline architecture; branch protection rules; build artifact integrity; deployment approval gates; manual deployment evidence; source code mgmt (repos, branching, PR/review reqs); IaC repos; DB schema change process; direct prod DB access', whyPurpose: 'Core SoD control — devs shouldn’t deploy to production unreviewed', formatExpected: 'Screenshots + access lists + config exports', priority: 'Medium-High' },
  { category: 'Change Management', itemRequested: 'Code repository access & controls — per platform: org admins, 2FA enforcement, SSO, audit logs, public repo policy; repo inventory; per critical repo: members + permissions, branch protection rules, CODEOWNERS, status checks, webhooks, deploy keys, secrets; pipelines/Actions inventory + approval gates + self-hosted runners + third-party plugins + secrets in pipelines; security tooling (secret scanning, push protection, Dependabot, SAST, SCA, container/license scanning); access reviews; bot/app installations', whyPurpose: 'Source code integrity; supply chain risk; common gap area', formatExpected: 'Exports + screenshots', priority: 'Medium' },

  // IT Operations (7)
  { category: 'IT Operations', itemRequested: 'Backup schedule, retention policy, and restore test evidence — backup design (policy, RPO/RTO, scope, tooling, architecture, 3-2-1, immutable copy, encryption); operations (schedules, retention tiers, recent job logs, failure tracking, SLA metrics, capacity); restore testing (policy, schedule, last test per critical system with date/scope/RTO achieved/issues/sign-off, full DR restore, actual production restores); SaaS/cloud (M365 backup, cloud DB backups, versioning); access (backup admin list, SoD with system admins); resilience (media disposal, key mgmt, immutable recovery test)', whyPurpose: 'Validates data recoverability — untested backup is not a backup; SOC 2 Availability', formatExpected: 'Screenshots + logs + test reports + policy', priority: 'High' },
  { category: 'IT Operations', itemRequested: 'Incident log + IR documentation — full incident export (ID, detection, severity, category, system, customer impact, timeline, SLA, root cause, CAPA, linked changes/problems, notifications, PIR); IR policy / plan; severity matrix; runbooks (ransomware, phishing, breach, account compromise); IR roster + on-call + contact tree; tabletop evidence; PIR samples; trend reporting; communication templates; forensics procedures; external IR retainer', whyPurpose: 'Tests incident management process; control failure indicator', formatExpected: 'Excel / ITSM export + PDFs', priority: 'High' },
  { category: 'IT Operations', itemRequested: 'Monitoring & alerting configuration — SIEM (platform, log source inventory & gap analysis, retention, time sync); detection rules with MITRE mapping + coverage of common scenarios; alerting & response (routing, 24/7 vs business hours, MSSP details, on-call, SLA, sample alerts); infra/availability monitoring; CSPM tooling; specific high-value detections (privileged role changes, CA changes, break-glass usage, audit log clear, mass permission changes, SP credential additions, inbox forwarding); detection engineering process', whyPurpose: 'Detective controls; without monitoring, incidents go undetected; SOC 2 CC7.2/CC7.3', formatExpected: 'Screenshots + config + sample alerts', priority: 'Medium-High' },
  { category: 'IT Operations', itemRequested: 'Patch management — policy with SLAs per severity + asset class; tooling per platform; last 3-6 cycles per asset class with deployment + compliance reports; SLA performance metrics + aged patches; specific reports for critical CVEs released during period; reconciliation patch tool vs asset inventory; offline workstations; EOL/unsupported systems + roadmap; exception register (with expiry + compensating control); cloud-specific (image baselines, container rebuild, auto-patch config)', whyPurpose: 'Top breach vector — unpatched systems; common SLA gap area', formatExpected: 'PDF + reports + screenshots', priority: 'High' },
  { category: 'IT Operations', itemRequested: 'Vulnerability management — VM policy/SLAs/methodology; tooling (network, web app DAST, CSPM, container, agent-based, ASM); scan frequency, authenticated coverage, gap analysis vs assets; recent scan reports per scanner (last 2-4 cycles) + dashboards + aged findings + top recurring vulns; remediation tracking (findings → tickets → closure → verification); SLA achievement metrics; backlog trend; pen test reports + retest evidence; bug bounty; KEV/zero-day handling; threat intel inputs; exception register; metrics reported to leadership', whyPurpose: 'Continuous VM expected; close-the-loop discipline test', formatExpected: 'Scan exports + tracker exports + dashboards', priority: 'High' },
  { category: 'IT Operations', itemRequested: 'AV / EDR coverage and operations — tooling per platform; coverage (deployed vs total assets, % per class, excluded assets register, stale agents, outdated versions); configuration (policy export, tamper protection, exclusions list, ASR rules, controlled folder access, EDR block mode); operations (sample detection events with triage, alert tuning, agent health monitoring, SIEM integration, threat hunting); agent patching', whyPurpose: 'Endpoint protection coverage gaps = blind spots; SOC 2 CC6.8', formatExpected: 'Console exports + reports', priority: 'Medium' },
  { category: 'IT Operations', itemRequested: 'BCP / DR plans + test evidence — BCP, DRP, crisis mgmt plan, pandemic plan; last review/approval; BIA (date, processes, RTO/RPO/MAO per process, dependencies, financial impact); DR architecture (site, replication, failover mechanism, capacity at DR, third-party resilience); test schedule + types performed; most recent DR test per critical system (scope, RTO/RPO achieved vs target, issues, lessons, sign-off); BCP exercises; tabletop with leadership; roles & contacts (out-of-band); workforce continuity; cyber recovery scenarios; any actual invocations during period', whyPurpose: 'SOC 2 Availability; resilience to disruption', formatExpected: 'Plan documents + test reports', priority: 'Medium-High' },

  // Endpoint & MDM (9)
  { category: 'Endpoint & MDM', itemRequested: 'Device management platform configuration export — full enrolled-device inventory per MDM/UEM (Intune / Jamf / Workspace ONE / etc.): platform, ownership (corporate vs BYOD), enrolment method (Autopilot / ADE / manual / Co-management), compliance state, last check-in, OS build, encryption state, primary user, entity; enrolment restrictions; tenant/console config overview', whyPurpose: 'Establishes the managed-device population — the denominator for every endpoint control test; surfaces unmanaged and stale devices', formatExpected: 'CSV / console export + screenshots', priority: 'High' },
  { category: 'Endpoint & MDM', itemRequested: 'Device compliance policies — full export per platform (Windows / macOS / iOS / Android): settings enforced (disk encryption, minimum OS, jailbreak/root detection, password/PIN complexity, firewall, threat-defence integration), assignment scope, grace periods, and the actions taken for non-compliance; compliance dashboard showing % compliant and top failure reasons', whyPurpose: 'Compliance policy is the enforced security baseline for endpoints; tests design and operating effectiveness of device hardening', formatExpected: 'Policy exports + compliance dashboard screenshots', priority: 'High' },
  { category: 'Endpoint & MDM', itemRequested: 'Configuration profiles & security baselines — configuration profiles and security baselines applied per platform (BitLocker / FileVault, Defender / ASR rules, account protection, firewall, Wi-Fi / VPN / certificate profiles, browser controls); settings-catalog / baseline drift report; comparison against the CIS or vendor-recommended baseline with documented deviations', whyPurpose: 'Confirms endpoints are hardened to a defined standard and drift is detected, not just that a policy exists', formatExpected: 'Profile exports + baseline comparison', priority: 'Medium-High' },
  { category: 'Endpoint & MDM', itemRequested: 'App protection & device-based Conditional Access — MAM / app-protection policies (data protection, access requirements, conditional launch), managed-app inventory, and how device compliance feeds Conditional Access (compliant-device CA policies, app-protection CA policies); BYOD data-containment approach and selective-wipe capability', whyPurpose: 'Validates that corporate data on endpoints is contained and that only compliant devices reach corporate resources', formatExpected: 'Policy exports + CA policy export + screenshots', priority: 'Medium-High' },
  { category: 'Endpoint & MDM', itemRequested: 'Mobile & BYOD governance — BYOD policy, MDM enrolment requirements for personal devices, what corporate data is permitted on unmanaged devices, lost / stolen device procedure, and 3-5 sample selective-wipe / retire tickets with evidence (request, approval, completion timestamp)', whyPurpose: 'Tests the control around personal devices accessing corporate data and the leaver / lost-device data-removal process', formatExpected: 'Policy + sample ticket exports', priority: 'Medium' },
  { category: 'Endpoint & MDM', itemRequested: 'Endpoint update & patch management via MDM — OS and app update rings / policies per platform, update-compliance reporting, feature vs quality update cadence, devices on unsupported OS versions, autopatch / managed-update configuration; reconciliation of MDM-managed devices against the asset inventory and EDR coverage', whyPurpose: 'Endpoint patching is a top breach vector; reconciliation surfaces devices missing from management, patching, or EDR', formatExpected: 'Update reports + reconciliation workbook', priority: 'Medium' },
  { category: 'Endpoint & MDM', itemRequested: 'Disk-encryption key escrow & recovery — per platform: percentage of devices encrypted (BitLocker / FileVault), evidence that recovery keys are escrowed to the directory / MDM, access controls on recovery keys, a sample key-recovery event, and the register of unencrypted devices with justification', whyPurpose: 'Encryption only protects data if keys are recoverable and escrow is enforced; unencrypted devices are an unmanaged data-loss path', formatExpected: 'Console exports + screenshots + exception register', priority: 'Medium-High' },
  { category: 'Endpoint & MDM', itemRequested: 'Local administrator & endpoint privilege management — LAPS or endpoint privilege-management tool deployment and coverage, who holds standing local-admin rights, just-in-time elevation configuration, and 3-5 sample elevation requests with approval evidence', whyPurpose: 'Standing local admin on endpoints is a primary lateral-movement and ransomware enabler; tests least privilege at the device layer', formatExpected: 'Tool exports + coverage report + sample approvals', priority: 'Medium-High' },
  { category: 'Endpoint & MDM', itemRequested: 'Device exception & non-compliance register — devices past their compliance grace period, devices formally exempted from compliance policy (with justification, owner and expiry), Conditional Access device exclusions, and the remediation tracking for non-compliant devices', whyPurpose: 'Exceptions are where endpoint controls quietly erode; confirms non-compliance is tracked and time-bound, not permanent', formatExpected: 'Exception register + compliance dashboard export', priority: 'Medium' },

  // Security Posture (8)
  { category: 'Security Posture', itemRequested: 'Security posture score & trend — current Microsoft Secure Score (or equivalent posture score) with score history across the audit period, breakdown by category (identity, devices, apps, data, infrastructure), the top improvement actions and their status, and comparison to the industry / size baseline; any posture items formally risk-accepted by management', whyPurpose: 'Gives an objective, trended view of security posture and whether it is improving, holding, or degrading over the period', formatExpected: 'Screenshots + score export + trend chart', priority: 'High' },
  { category: 'Security Posture', itemRequested: 'Attack surface & external exposure — external attack-surface inventory (internet-facing assets, open ports, exposed services, exposed admin interfaces), EASM / ASM tooling output, exposed or expiring certificates, full subdomain inventory; forgotten / shadow internet-facing assets identified; remediation tracking for exposed findings', whyPurpose: 'The external attack surface is what an attacker sees first; surfaces unknown exposure and shadow assets outside asset management', formatExpected: 'Tool exports + remediation tracker', priority: 'High' },
  { category: 'Security Posture', itemRequested: 'Detection & threat-coverage maturity — detection coverage mapped to MITRE ATT&CK with documented gaps, log-source coverage vs the asset inventory, the high-value detections in place (privileged role changes, CA policy changes, break-glass usage, mass download / permission change, audit-log clear), the detection-engineering / tuning process, and mean-time-to-detect metrics', whyPurpose: 'Posture is not just prevention — confirms the organisation can actually detect the scenarios that matter', formatExpected: 'Coverage matrix + SIEM exports + screenshots', priority: 'Medium-High' },
  { category: 'Security Posture', itemRequested: 'Posture management process & remediation — who owns security posture, the cadence of posture review, how posture findings become remediation tickets with close-the-loop evidence, the posture KPIs reported to leadership, and the accepted-risk register for posture items not being remediated', whyPurpose: 'Confirms posture is actively managed with accountability, not just measured by a dashboard nobody actions', formatExpected: 'Process doc + ticket samples + leadership reporting', priority: 'Medium' },
  { category: 'Security Posture', itemRequested: 'Framework & benchmark alignment — most recent self- or external assessment against a recognised framework (CIS Controls / NIST CSF / ISO 27001 / Cyber Essentials), the maturity scoring, the gap-remediation roadmap, and the assessment date and assessor', whyPurpose: 'Places posture in the context of a recognised control framework and shows a managed path to maturity', formatExpected: 'Assessment report + remediation roadmap', priority: 'Medium' },
  { category: 'Security Posture', itemRequested: 'Phishing-resistant MFA rollout status — coverage of phishing-resistant authentication (FIDO2 / passkeys / certificate-based / Windows Hello for Business) versus legacy MFA (SMS / voice / push), the rollout plan and current status, coverage of privileged accounts specifically, and evidence of legacy-authentication elimination', whyPurpose: 'Push/SMS MFA is now routinely bypassed; phishing-resistant coverage — especially for admins — is a leading posture indicator', formatExpected: 'Coverage report + screenshots + rollout plan', priority: 'High' },
  { category: 'Security Posture', itemRequested: 'Identity Secure Score & risk deep-dive — identity-specific posture: risky users and risky sign-ins over the period, risk-policy configuration, legacy authentication still in use, dormant or unused privileged accounts, and the identity recommendations with their remediation status', whyPurpose: 'Identity is the most-attacked surface; a focused identity-posture view surfaces the exposures a headline score hides', formatExpected: 'Screenshots + exports', priority: 'Medium-High' },
  { category: 'Security Posture', itemRequested: 'Penetration test & remediation evidence — most recent internal and external penetration tests (scope, methodology, dates, tester), findings by severity, the retest evidence, any critical / high findings still open with compensating controls, and any red-team / purple-team exercises run during the period', whyPurpose: 'Independent offensive testing validates that controls hold under real attack, and the retest discipline shows findings are actually closed', formatExpected: 'Pen-test reports + retest evidence + remediation tracker', priority: 'Medium-High' },

  // Cloud Security Posture (8)
  { category: 'Cloud Security Posture', itemRequested: 'Cloud security posture management (CSPM) output — CSPM findings per cloud (Defender for Cloud / Security Hub / SCC / third-party): misconfiguration findings by severity, trend across the period, top recurring issues, public-exposed storage and databases, unencrypted resources, and remediation status; secure-score per cloud', whyPurpose: 'CSPM is the primary detective control for cloud misconfiguration — the dominant cause of cloud breaches', formatExpected: 'CSPM exports + dashboards', priority: 'High' },
  { category: 'Cloud Security Posture', itemRequested: 'Cloud configuration baselines & guardrails — configuration measured against the CIS benchmark per cloud (Azure / AWS / GCP) with compliance score and documented deviations; landing-zone / guardrail policy (Azure Policy / SCPs / Org Policy) export and evidence it is enforced (deny / audit effects, exemptions register)', whyPurpose: 'Confirms cloud environments are built to a defined secure baseline and guardrails actually prevent drift', formatExpected: 'Benchmark reports + policy exports', priority: 'Medium-High' },
  { category: 'Cloud Security Posture', itemRequested: 'Cloud identity & privileged access — RBAC export per cloud (Owner / Contributor / User Access Administrator, IAM roles, GCP roles), privileged-role inventory, PIM / JIT usage, service principals and access keys with age and last-used date, cross-account / cross-tenant trust relationships, and root / break-glass account protection evidence', whyPurpose: 'Cloud identity is the new perimeter; standing privilege and stale keys are the most exploited cloud weaknesses', formatExpected: 'IAM / RBAC exports + screenshots', priority: 'High' },
  { category: 'Cloud Security Posture', itemRequested: 'Cloud key, secret & data protection — key-management inventory (Key Vault / KMS) with rotation evidence, secret inventory and expiry, encryption-at-rest and in-transit coverage, public exposure of storage and databases, and network exposure (NSGs / security groups / firewall rules, public IPs, exposed management ports)', whyPurpose: 'Tests the controls protecting data and credentials in the cloud — common high-severity finding area', formatExpected: 'Config exports + screenshots', priority: 'Medium-High' },
  { category: 'Cloud Security Posture', itemRequested: 'Cloud logging, monitoring & threat detection — evidence that cloud-native logging is enabled and centralised (Activity log / Defender for Cloud, CloudTrail / GuardDuty, GCP audit logs), log retention settings, sample threat-detection alerts with triage, coverage gaps, and who responds to cloud alerts and within what SLA', whyPurpose: 'Without cloud logging and detection, cloud incidents go unseen; confirms detective controls extend into the cloud', formatExpected: 'Config screenshots + sample alerts', priority: 'Medium' },
  { category: 'Cloud Security Posture', itemRequested: 'Public exposure report & remediation — internet-exposed cloud resources (public storage / buckets, publicly reachable databases, exposed management ports such as RDP / SSH, public IPs without documented justification), how exposure is detected, and the remediation timeline and status for each finding', whyPurpose: 'Public exposure of storage and management ports is the single most common cause of cloud data breaches', formatExpected: 'CSPM / scan exports + remediation tracker', priority: 'High' },
  { category: 'Cloud Security Posture', itemRequested: 'Cloud key & secret rotation evidence — rotation cadence and last-rotation evidence for keys and secrets per cloud, the age of any long-lived access keys / secrets, secrets-in-code scanning coverage, and the customer-managed vs platform-managed key decisions with rationale', whyPurpose: 'Stale, un-rotated keys and secrets-in-code are heavily exploited; tests credential hygiene in the cloud', formatExpected: 'Key vault / KMS exports + scan results', priority: 'Medium-High' },
  { category: 'Cloud Security Posture', itemRequested: 'Cloud guardrail exemption register — exceptions granted against guardrail / CSPM policy: what was exempted, the justification, who approved it, the expiry date, and the compensating control; the trend in exemption volume and the review cadence', whyPurpose: 'Guardrails only hold if exceptions are tracked and time-bound; an unmanaged exemption list is a silent erosion of cloud posture', formatExpected: 'Exemption register + policy exports', priority: 'Medium' },

  // AI Governance (8)
  { category: 'AI Governance', itemRequested: 'AI & GenAI tool inventory — inventory of AI / GenAI tools and services in use (M365 Copilot, ChatGPT Enterprise / Team, embedded AI features in SaaS, ML / model platforms, AI APIs): owner, business purpose, data sent to the tool, vendor, contract and DPA status, sanctioned vs shadow; and how the inventory is kept current', whyPurpose: 'You cannot govern AI you have not inventoried; establishes the population for every other AI control', formatExpected: 'Excel inventory + supporting exports', priority: 'High' },
  { category: 'AI Governance', itemRequested: 'AI acceptable-use policy & governance — the AI / GenAI acceptable-use policy (owner, approval date, scope), the rules on what data may and may not be entered into AI tools, prohibited use cases, staff training / awareness on AI use, and the governance body or approval process for adopting new AI tools', whyPurpose: 'Confirms there is a defined, approved, communicated control framework for AI use rather than ad-hoc adoption', formatExpected: 'PDF policy + training records + approval process doc', priority: 'High' },
  { category: 'AI Governance', itemRequested: 'Copilot / enterprise AI configuration — for deployed enterprise AI (e.g. M365 Copilot): licensing and assignment, data-governance settings, what content the assistant can access, sensitivity-label and DLP enforcement on AI outputs, admin controls, audit logging of AI interactions, and evidence of oversharing / over-permissive access remediation before rollout', whyPurpose: 'Enterprise AI inherits the organisation’s access sprawl — confirms it was governed, not just switched on', formatExpected: 'Config screenshots + audit log samples', priority: 'Medium-High' },
  { category: 'AI Governance', itemRequested: 'Data exposure & DLP for AI services — the controls preventing sensitive data leaving to AI services: DLP rules covering GenAI endpoints, network / CASB / proxy controls for unsanctioned AI sites, browser and endpoint controls, and evidence of blocked or alerted events during the period', whyPurpose: 'The primary AI risk is sensitive data leaving the organisation into a third-party model; tests whether that is actually controlled', formatExpected: 'DLP / CASB config + sample alert evidence', priority: 'Medium-High' },
  { category: 'AI Governance', itemRequested: 'Shadow AI detection & model risk — the process to detect unsanctioned AI usage (CASB / proxy / discovery output), the model and vendor risk assessment for AI services in use (training-data use, data retention, IP ownership, accuracy / bias where AI informs decisions), and any incidents involving AI tools during the period', whyPurpose: 'Surfaces uncontrolled AI use and confirms the risk of the AI services in scope has actually been assessed', formatExpected: 'Discovery exports + risk assessments', priority: 'Medium' },
  { category: 'AI Governance', itemRequested: 'Sensitivity-label & DLP enforcement on AI outputs — evidence that AI-generated content inherits and respects sensitivity labels and DLP, the label coverage on the source content the AI can reach, the oversharing controls in place, and sample label / DLP enforcement events on AI interactions', whyPurpose: 'Enterprise AI can surface and re-package sensitive content; tests that classification and DLP actually follow the data through the AI layer', formatExpected: 'Config screenshots + sample enforcement events', priority: 'Medium-High' },
  { category: 'AI Governance', itemRequested: 'AI vendor & sub-processor register — for each AI service in use: vendor, sub-processors, data-processing location, DPA status, training-data and retention clauses, model-provider chain, and any certification (SOC 2 / ISO 27001 / ISO 42001) with review date', whyPurpose: 'AI services are third parties processing potentially sensitive data; confirms they are in the vendor-risk programme, not a blind spot', formatExpected: 'Excel register + DPAs + attestations', priority: 'Medium-High' },
  { category: 'AI Governance', itemRequested: 'AI incident & misuse log — log of AI-related incidents, near-misses and policy violations during the period (sensitive data entered into AI tools, inaccurate AI output relied upon, prohibited-use violations), the shadow-AI discovery output, and the resulting lessons learned or control changes', whyPurpose: 'Shows whether AI risk is actively monitored and whether incidents drive control improvement, rather than AI being an ungoverned experiment', formatExpected: 'Incident log + discovery exports', priority: 'Medium' },

  // Third Parties (4)
  { category: 'Third Parties', itemRequested: 'Vendor / third-party listing with criticality — per vendor: name, service, type, owners, entity served, criticality + rationale, data accessed + classification, system access, sub-processors, contract dates, annual spend, DPA, last DD, last assurance report, status; sub-service orgs flagged for SOC 2; categories covered (cloud, SaaS, MSPs, software vendors with prod access, consultants, payment, HR/payroll, comms, marketing/analytics, AI/ML services, physical security); reconciliation against AP / vendor master / SaaS discovery / expense reports', whyPurpose: 'Scope vendor risk testing; sub-service orgs for SOC 2; surface shadow IT', formatExpected: 'Excel', priority: 'High' },
  { category: 'Third Parties', itemRequested: 'Third-party assurance reports — SOC 1/SOC 2/ISO 27001 for critical vendors and named sub-service orgs; bridge letters for gap to audit period end; internal review log (reviewer, date, findings, CUECs implemented); list of critical vendors without reports + alternative DD', whyPurpose: 'Reliance on key vendors for SOC 2 and ITGC', formatExpected: 'PDFs + Excel review tracker', priority: 'High' },
  { category: 'Third Parties', itemRequested: 'Vendor onboarding & due diligence — onboarding/DD procedure; sample of 5-10 vendors onboarded during period (questionnaire, security review, contract review, approval); periodic re-assessment process for existing critical vendors; offboarding evidence (access removal, data return/destruction certificate)', whyPurpose: 'Front-end vendor risk control test', formatExpected: 'Policy + samples', priority: 'Medium' },
  { category: 'Third Parties', itemRequested: 'Vendor contracts & DPAs — top 20 IT vendor contracts + DPAs for personal data processors + MSAs/SOWs; key clauses (confidentiality, data protection, security reqs, breach notification timeline, audit rights, sub-processor approval, termination/data return, liability/indemnity, SLAs); contract repository + access list', whyPurpose: 'Validates contractual protections actually exist', formatExpected: 'PDFs + summary matrix', priority: 'Medium' },

  // Licensing (5)
  { category: 'Licensing', itemRequested: 'Software licensing — full compliance & optimization pack: master inventory (vendor, product, edition, metric, entitled, deployed, variance, utilization rate, annual cost, cost per active user, contract refs, dates, auto-renewal, entity, allocation, reseller, SAM source); Microsoft (M365 SKU assignment + utilization, E5 vs E3 features used, overlapping licenses, disabled users still licensed, guest paid licenses, group-based, add-ons, Windows Server + CAL position, SQL per-core, VS subscriptions, Azure MACC, Azure Hybrid Benefit, Software Assurance benefits, MLS, Product Use Rights review); Oracle (LMS scripts + outputs, license type, NUP/Processor, options & mgmt packs deployed vs licensed, VM partitioning, ULA, Java SE post-2023); SAP (named user counts, indirect access, engine licensing, USMM/LAW); VMware (post-Broadcom bundles, per-core, perpetual to subscription); SaaS portfolio (seats vs active users 30/60/90, departed employees still seated, free vs paid, consumption usage, overage exposure, minimum commitments, auto-renewal next 90/180, overlapping tools, shadow IT); cloud licensing (RIs/Savings Plans + coverage, unused RIs, Hybrid Benefit, BYOL, Marketplace); open source (license obligations, GPL/AGPL, free-tier commercial restrictions, personal accounts); cost/value views (top 20 spend, cost per active user, waste estimate, renewal calendar, overlapping rationalization, discount achieved); compliance/true-up; SAM tooling + coverage; reclamation process; standard catalog; reconciliation tests (entitlement → deployed → financial)', whyPurpose: 'Compliance + cost optimization findings; central to scope', formatExpected: 'Excel master + per-publisher tabs + raw exports', priority: 'High' },
  { category: 'Licensing', itemRequested: 'Compliance position & true-ups — latest True-Up / True-Down filings (last 2 cycles with quantities + amounts); any vendor-led audit in last 3 years (scope, findings, settlement, remediation); self-audit / mock audit evidence; internal license position review (frequency, owner, last review); reporting to leadership; open compliance gaps + remediation plan + cash reserved for settlement risk', whyPurpose: 'Formal entitlement vs deployment reconciliation; quantifies risk', formatExpected: 'PDFs + Excel', priority: 'Medium-High' },
  { category: 'Licensing', itemRequested: 'SaaS subscriptions — seats vs active users — per app: seats purchased, assigned, active 30/60/90, annual cost, cost per active user, renewal date, auto-renewal, contract owner; departed employees still on seats; inactive seats >60 days (reclaim); apps procured via expense / corporate card (shadow IT); overlapping tools; consumption tier exposure (API calls, storage, transactions); SaaS discovery / mgmt tool used; top 20 SaaS by spend with utilization detail', whyPurpose: 'Highest-impact area for cost savings findings', formatExpected: 'Excel', priority: 'High' },
  { category: 'Licensing', itemRequested: 'Last vendor-led audit / SAM report — most recent vendor software audits (last 3 years), settlement amounts, remediation; internal SAM maturity assessment; SAM tool coverage report (% of estate, gaps); annual SAM report to leadership', whyPurpose: 'Prior audit findings indicate recurring risk; SAM maturity context', formatExpected: 'PDF + Excel', priority: 'Medium' },
  { category: 'Licensing', itemRequested: 'License procurement & assignment process — request/approval/assignment workflow; approval matrix; assignment process (manual/group/automated); reclamation triggers; sample of 5-10 license requests during period with approval evidence; standard software catalog; non-catalog request process', whyPurpose: 'Control over license issuance', formatExpected: 'PDF + samples', priority: 'Medium' },

  // IT Spend (7)
  { category: 'IT Spend', itemRequested: 'IT budget vs actuals — current and prior year by entity and cost center; variance analysis with explanations for material variances; forecast vs actual trend', whyPurpose: 'Identify spend variances; scope spend testing', formatExpected: 'Excel', priority: 'High' },
  { category: 'IT Spend', itemRequested: 'IT general ledger detail — full GL extract for all IT cost centers / accounts for audit period; account mapping (which GL accounts roll to IT); entity dimension preserved', whyPurpose: 'Population for spend analytics and sampling', formatExpected: 'Excel / GL export', priority: 'High' },
  { category: 'IT Spend', itemRequested: 'Top 20 IT vendors by spend — vendor name, annual spend, contract status, renewal date, business owner; linked contracts and POs; concentration analysis (% of total IT spend per vendor)', whyPurpose: 'Concentration risk; contract compliance', formatExpected: 'Excel + PDF contracts', priority: 'High' },
  { category: 'IT Spend', itemRequested: 'PO and invoice approval workflow — approval matrix / DoA for IT spend; workflow doc (request → approve → PO → receipt → invoice → pay); system used (ERP module, Coupa, Ariba); 10-15 sample IT invoices with approval evidence + PO + 3-way match; exception process for unbudgeted / over-budget', whyPurpose: 'Test purchasing controls', formatExpected: 'PDF + sample evidence', priority: 'High' },
  { category: 'IT Spend', itemRequested: 'Intercompany IT cost allocation — methodology (per user / revenue / headcount / fixed split / ABC); supporting calculations for current allocations; intercompany agreements / MSAs; consistency check across periods; transfer pricing (esp. cross-border); reconciliation total allocated = total cost', whyPurpose: 'Multi-entity allocation accuracy', formatExpected: 'Excel + memo', priority: 'High' },
  { category: 'IT Spend', itemRequested: 'Capex vs Opex IT classification — capitalization policy (thresholds, useful life by asset class); recent capitalization decisions for IT (last 12 months); cloud / SaaS treatment under applicable accounting standard (IAS 38 / ASC 350-40, esp. configuration & customization costs)', whyPurpose: 'Accounting treatment review', formatExpected: 'PDF policy + sample decisions', priority: 'Medium' },
  { category: 'IT Spend', itemRequested: 'Shadow IT / unsanctioned spend — sample of expense reports / corporate card transactions for IT-related spend; SaaS discovery tool output (if any); process for detecting and onboarding/offboarding shadow IT', whyPurpose: 'Identify uncontrolled IT spend outside procurement', formatExpected: 'Excel', priority: 'Low-Medium' },

  // SOC 2 Readiness (5)
  { category: 'SOC 2 Readiness', itemRequested: 'Trust Services Criteria scope — confirmation of TSCs in scope (Security mandatory; +Availability / Confidentiality / Processing Integrity / Privacy); Type I or Type II target; audit period; service auditor (if engaged)', whyPurpose: 'Confirm SOC 2 scope', formatExpected: 'Memo / email', priority: 'High' },
  { category: 'SOC 2 Readiness', itemRequested: 'Existing control matrix mapped to TSC — control owner per control; test status / readiness assessment; gap remediation tracker', whyPurpose: 'Starting point for gap assessment', formatExpected: 'Excel', priority: 'High' },
  { category: 'SOC 2 Readiness', itemRequested: 'System description draft — system boundaries (in-scope products/services); infrastructure; software; people; procedures (manual + automated); data (types, flows); sub-service organizations (carve-out vs inclusive); customer responsibilities (CUECs)', whyPurpose: 'Required SOC 2 deliverable foundation', formatExpected: 'Word / PDF', priority: 'High' },
  { category: 'SOC 2 Readiness', itemRequested: 'TSC-specific risk assessment — risk identification mapped to TSCs; likelihood / impact scoring; control mapping per risk', whyPurpose: 'Required by SOC 2 framework', formatExpected: 'Excel / PDF', priority: 'Medium' },
  { category: 'SOC 2 Readiness', itemRequested: 'Customer commitments and system requirements — SLAs in customer contracts (uptime, response time, data handling); contractual security commitments; privacy / data protection commitments; mapping commitments → controls', whyPurpose: 'TSC alignment with customer commitments', formatExpected: 'PDF + matrix', priority: 'Medium' },

  // Physical & Environmental (2)
  { category: 'Physical & Environmental', itemRequested: 'Data center / server room access — access list per facility (employees + vendors); access review evidence; provisioning/deprovisioning process; visitor logs sample; surveillance / camera coverage description', whyPurpose: 'Physical access controls (only if on-prem facilities exist)', formatExpected: 'Excel + PDF', priority: 'Medium' },
  { category: 'Physical & Environmental', itemRequested: 'Environmental controls — UPS, generator, fire suppression, HVAC, water detection; maintenance / inspection records (last 12 months); environmental monitoring / alerting', whyPurpose: 'SOC 2 Availability (only if on-prem)', formatExpected: 'PDF + photos', priority: 'Low' },
];

const PBC: LibraryPBCItem[] = PBC_RAW.map((i) => ({
  ...i,
  tscMapping: DEFAULT_TSC_BY_CATEGORY[i.category],
  scope: scopeFor(i),
  templateKey: templateKeyFor(i.category, i.itemRequested),
}));

// Fail fast if two items collapse to the same templateKey — the re-sync logic
// relies on it being unique within an engagement.
{
  const seen = new Set<string>();
  for (const item of PBC) {
    if (seen.has(item.templateKey)) {
      throw new Error(`library: duplicate templateKey "${item.templateKey}"`);
    }
    seen.add(item.templateKey);
  }
}

// ---- Access requests ----
// Transcribed verbatim from the workbook's Access Requests sheet.
const ACCESS: LibraryAccessRequest[] = [
  { system: 'Microsoft Entra ID / M365', accessType: 'Read-only console', rolePermissions: 'Global Reader', recommendedMethod: 'Account in tenant', justification: 'Walkthroughs, screenshots, ad-hoc checks across multi-entity tenant' },
  { system: 'Microsoft Graph API', accessType: 'Read-only programmatic', rolePermissions: 'Directory.Read.All, AuditLog.Read.All, Reports.Read.All, Policy.Read.All, User.Read.All, Group.Read.All, RoleManagement.Read.All', recommendedMethod: 'App registration with client credentials', justification: 'Bulk user/license/MFA/sign-in extraction across entities — essential for licensing scope' },
  { system: 'Active Directory (on-prem, if any)', accessType: 'Read-only', rolePermissions: 'Domain Users + read on OUs', recommendedMethod: 'Domain account', justification: 'AD queries / PowerShell read commands' },
  { system: 'Microsoft 365 Admin Center', accessType: 'Read-only', rolePermissions: 'Global Reader', recommendedMethod: 'Same as Entra account', justification: 'License assignments, mailbox stats' },
  { system: 'Microsoft Purview / Compliance', accessType: 'Read-only', rolePermissions: 'Compliance Data Reader / Reader', recommendedMethod: 'Account', justification: 'Audit log search, DLP config, retention policies' },
  { system: 'Microsoft Defender / Security portal', accessType: 'Read-only', rolePermissions: 'Security Reader', recommendedMethod: 'Account', justification: 'Endpoint, identity, email security posture' },
  { system: 'Azure (subscriptions in scope)', accessType: 'Read-only', rolePermissions: 'Reader at Mgmt Group / Subscription', recommendedMethod: 'Account or service principal', justification: 'Resource inventory, RBAC review, policy compliance' },
  { system: 'AWS (if applicable)', accessType: 'Read-only', rolePermissions: 'ReadOnlyAccess + SecurityAudit (managed)', recommendedMethod: 'IAM user with MFA, or SSO', justification: 'Cloud configuration review' },
  { system: 'GCP (if applicable)', accessType: 'Read-only', rolePermissions: 'Viewer + Security Reviewer', recommendedMethod: 'Account', justification: 'Cloud configuration review' },
  { system: 'Ticketing system (ServiceNow / Jira)', accessType: 'Read-only', rolePermissions: 'Auditor / Reader role', recommendedMethod: 'Account', justification: 'Pull change and incident populations, sample tickets' },
  { system: 'SIEM / Log management', accessType: 'Read-only', rolePermissions: 'Reader', recommendedMethod: 'Account', justification: 'Verify monitoring, retention, sample alerts' },
  { system: 'In-scope ERP / Finance system', accessType: 'Read-only', rolePermissions: 'Auditor role with read on all modules', recommendedMethod: 'Account', justification: 'GL pull for IT spend, vendor master, PO data' },
  { system: 'HRIS', accessType: 'Read-only or extract', rolePermissions: 'Reader / extract privilege', recommendedMethod: 'Account or one-time export', justification: 'Active employee listing for access reconciliation' },
  { system: 'Document repository (SharePoint / Confluence / Notion)', accessType: 'Read access to IT/audit folder', rolePermissions: 'Reader', recommendedMethod: 'Account', justification: 'Policies, evidence, PBC dropbox' },
  { system: 'Secure file share for evidence', accessType: 'Read/write to dedicated audit folder', rolePermissions: 'Owner of audit folder', recommendedMethod: 'SharePoint site / Egnyte / Box / equivalent', justification: 'Centralized evidence collection — TBD whether client provisions or auditor does' },
  { system: 'Code repository (GitHub / GitLab / Azure DevOps)', accessType: 'Read-only', rolePermissions: 'Reader on org', recommendedMethod: 'Account', justification: 'Verify Dev/Prod separation, deployment evidence' },
  { system: 'Vulnerability scanner (Qualys / Tenable / Rapid7)', accessType: 'Read-only', rolePermissions: 'Reader', recommendedMethod: 'Account', justification: 'Pull scan reports directly' },
  { system: 'Endpoint / EDR console', accessType: 'Read-only', rolePermissions: 'Reader', recommendedMethod: 'Account', justification: 'Coverage and detection evidence' },
  { system: 'SAM / License mgmt tool (Flexera / Snow / etc.)', accessType: 'Read-only', rolePermissions: 'Reader', recommendedMethod: 'Account', justification: 'License inventory and utilization' },
];

// ---- Walkthroughs ----
// Process areas, key topics, attendees, and durations are transcribed from the
// workbook's Walkthroughs sheet. The description + objective are authored here
// to give the portal the human context the spreadsheet doesn't carry.
const WALKS: LibraryWalkthrough[] = [
  { processArea: 'Kickoff',
    description: 'The opening session for the engagement. The audit team and client leadership align on scope, timeline, ways of working, and walk through the PBC list together so everyone knows what evidence is coming and when.',
    objective: 'Confirm scope, timeline, and communication channels are agreed, and that the client understands the PBC request list.',
    keyTopics: 'Scope, objectives, timeline, communication, PBC list walkthrough', attendees: 'CIO / IT Director, audit sponsor, project mgr', durationMin: 60 },
  { processArea: 'Entity & system scoping',
    description: 'A working session to lock down the audit boundary: which legal entities are in scope, what IT is shared vs. separate across them, and which applications and network segments matter.',
    objective: 'Confirm the in-scope entities, shared services, and key applications so testing populations can be defined accurately.',
    keyTopics: 'Entities in scope, shared services, application inventory, network architecture', attendees: 'IT Director, Enterprise Architect', durationMin: 60 },
  { processArea: 'Logical access',
    description: 'Walk through how users get, change, and lose access across in-scope systems — joiner/mover/leaver flows, privileged access handling, periodic access reviews, and MFA enforcement.',
    objective: 'Confirm the access lifecycle is designed, approved, executed, and reviewed, with MFA enforced and deprovisioning happening on time.',
    keyTopics: 'Provisioning, deprovisioning, access reviews, privileged access, MFA, JML', attendees: 'IAM lead, HR contact', durationMin: 90 },
  { processArea: 'Change management',
    description: 'Trace a normal and an emergency change from request to production: approvals, testing, dev/prod separation, and how source control and deployment gates enforce segregation of duties.',
    objective: 'Confirm production changes are approved before deployment and that developers cannot deploy unreviewed code to production.',
    keyTopics: 'Change workflow, approvals, dev/prod separation, emergency changes, source control', attendees: 'Change manager, DevOps lead', durationMin: 60 },
  { processArea: 'IT operations',
    description: 'A broad operations walkthrough covering backups and restore testing, monitoring and alerting, incident response, patching, and vulnerability management.',
    objective: 'Confirm core operational controls — backup/restore, monitoring, incident response, patch and vulnerability management — are designed and operating.',
    keyTopics: 'Backups, monitoring, incident response, patching, vulnerability mgmt', attendees: 'Ops manager, SecOps', durationMin: 90 },
  { processArea: 'Cloud & infrastructure',
    description: 'Review the cloud and network estate: M365/Azure/AWS configuration baselines, network segmentation, and cloud security posture management tooling.',
    objective: 'Confirm cloud and network environments are configured to a secure baseline and that posture is monitored.',
    keyTopics: 'M365/Azure/AWS configuration, network, segmentation, CSPM', attendees: 'Cloud architect, network lead', durationMin: 60 },
  { processArea: 'Vendor & third party',
    description: 'Walk through how third parties are onboarded, risk-assessed, and monitored — including how SOC reports are reviewed and how security terms make it into contracts.',
    objective: 'Confirm critical vendors are subject to due diligence at onboarding and ongoing monitoring, with assurance reports reviewed.',
    keyTopics: 'Vendor onboarding, SOC report review, contract management', attendees: 'Procurement, Vendor Risk', durationMin: 45 },
  { processArea: 'Licensing',
    description: 'A walkthrough of how software licenses are bought, assigned, reclaimed, and reconciled — covering SAM tooling, true-up exposure, and SaaS sprawl.',
    objective: 'Confirm licensing is tracked against entitlements, with a process to reclaim unused seats and manage compliance risk.',
    keyTopics: 'License procurement, assignment, true-up process, SAM tooling, SaaS sprawl', attendees: 'IT Asset Manager, Procurement', durationMin: 60 },
  { processArea: 'IT spend',
    description: 'Walk through how IT spend is budgeted, approved, and accounted for — purchase order and invoice approval, intercompany cost allocation, and capex vs. opex treatment.',
    objective: 'Confirm IT spend is budgeted, approved through the right controls, and allocated and classified consistently.',
    keyTopics: 'Budgeting, PO/invoice approval, intercompany allocation, capex/opex', attendees: 'IT Finance / Controller', durationMin: 60 },
  { processArea: 'Physical & environmental',
    description: 'A short session — only relevant if on-premise facilities exist — covering data center and server room physical access and environmental controls.',
    objective: 'Confirm physical access to facilities is restricted and reviewed, and environmental controls are in place (where on-prem facilities exist).',
    keyTopics: 'Data center access, environmental controls (if on-prem)', attendees: 'Facilities / IT Ops', durationMin: 30 },
  { processArea: 'SOC 2 readiness',
    description: 'A readiness-focused session on the SOC 2 programme: which Trust Services Criteria are in scope, the system description, the control matrix, and where the known gaps are.',
    objective: 'Confirm the SOC 2 scope, system description, and control matrix are in place and understand the current gap-remediation status.',
    keyTopics: 'Trust criteria scope, system description, control matrix, gap status', attendees: 'CISO / Compliance lead', durationMin: 90 },
];

// ---- Entities (illustrative placeholders) ----
// The workbook's Entity Scope sheet is a blank per-client template, so these
// stay as worked examples that show the kind of scoping rationale expected.
const ENTITIES: LibraryEntity[] = [
  { legalEntity: 'HQ entity', countryLocation: null, itModel: 'Centralized', keyApplications: 'ERP, HRIS, CRM, SSO', hosting: 'Cloud', headcount: null, inScope: 'Y', rationale: 'Primary in-scope entity' },
  { legalEntity: 'EU subsidiary', countryLocation: null, itModel: 'Hybrid', keyApplications: 'Local AD + cloud apps', hosting: 'Hybrid', headcount: null, inScope: 'Y', rationale: 'Material entity in scope' },
  { legalEntity: 'APAC subsidiary', countryLocation: null, itModel: 'Standalone', keyApplications: 'Local file shares + cloud email', hosting: 'On-Prem', headcount: null, inScope: null, rationale: 'Scope TBD pending materiality assessment' },
  { legalEntity: 'Acquired entity (year 1)', countryLocation: null, itModel: 'Standalone', keyApplications: 'Pre-acquisition stack, integration in progress', hosting: 'On-Prem', headcount: null, inScope: null, rationale: 'Carve-out — confirm scope after integration plan review' },
  { legalEntity: 'Dormant / holding entity', countryLocation: null, itModel: null, keyApplications: null, hosting: null, headcount: 0, inScope: 'N', rationale: 'No active IT operations' },
];

// ---- Sampling controls ----
// Transcribed from the workbook's Sampling & Testing sheet. Sampling method is
// left blank — it's a per-engagement decision once the population is received.
const SAMPLING: LibrarySamplingItem[] = [
  { controlArea: 'Access — Joiner', controlDescription: 'New users provisioned with appropriate approval and access', populationSource: 'HR new hires during period', samplingMethod: '' },
  { controlArea: 'Access — Leaver', controlDescription: 'Terminated users disabled timely (target SLA)', populationSource: 'HR terminations during period', samplingMethod: '' },
  { controlArea: 'Access — Mover', controlDescription: 'Role changes reflected in access timely', populationSource: 'HR role change report', samplingMethod: '' },
  { controlArea: 'Access — Privileged', controlDescription: 'Privileged access approved and reviewed periodically', populationSource: 'Privileged user list', samplingMethod: '' },
  { controlArea: 'Access — Periodic Review', controlDescription: 'Access review completed and exceptions remediated', populationSource: 'Review evidence per system', samplingMethod: '' },
  { controlArea: 'Change Mgmt — Standard', controlDescription: 'Changes approved, tested, deployed per process', populationSource: 'Change ticket export', samplingMethod: '' },
  { controlArea: 'Change Mgmt — Emergency', controlDescription: 'Emergency changes have post-deployment approval', populationSource: 'Emergency change subset', samplingMethod: '' },
  { controlArea: 'Backup', controlDescription: 'Backups complete successfully and restores tested', populationSource: 'Backup job logs / restore tickets', samplingMethod: '' },
  { controlArea: 'Incident Mgmt', controlDescription: 'Incidents logged, classified, resolved within SLA', populationSource: 'Incident log', samplingMethod: '' },
  { controlArea: 'Patch Mgmt', controlDescription: 'Patches deployed within SLA', populationSource: 'Patch reports / scan results', samplingMethod: '' },
  { controlArea: 'Vulnerability Mgmt', controlDescription: 'Critical/high vulns remediated within SLA', populationSource: 'Scan reports', samplingMethod: '' },
  { controlArea: 'Vendor Mgmt', controlDescription: 'New vendors risk-assessed and SOC reports reviewed', populationSource: 'Vendor onboarding list', samplingMethod: '' },
  { controlArea: 'License Compliance', controlDescription: 'Licenses purchased ≥ deployed; usage justifies seats', populationSource: 'License inventory + usage report', samplingMethod: '' },
  { controlArea: 'IT Spend — Invoices', controlDescription: '3-way match and approval evidence', populationSource: 'GL / AP detail', samplingMethod: '' },
  { controlArea: 'IT Spend — Allocation', controlDescription: 'Intercompany allocations accurate and consistent', populationSource: 'Allocation calc + GL', samplingMethod: '' },
  { controlArea: 'Training', controlDescription: 'Required security training completed per period', populationSource: 'LMS export', samplingMethod: '' },
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
