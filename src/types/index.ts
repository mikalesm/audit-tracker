export type PBCStatus =
  | 'Not Started'
  | 'Requested'
  | 'In Progress'
  | 'Received'
  | 'Reviewed'
  | 'N/A';

export type PBCPriority = 'High' | 'Medium-High' | 'Medium' | 'Low-Medium' | 'Low';

export type Category =
  | 'Governance'
  | 'Entities & Systems'
  | 'Access Management'
  | 'Change Management'
  | 'IT Operations'
  | 'Third Parties'
  | 'Licensing'
  | 'IT Spend'
  | 'SOC 2 Readiness'
  | 'Physical & Environmental';

export type TSC =
  | 'Security'
  | 'Availability'
  | 'Confidentiality'
  | 'Processing Integrity'
  | 'Privacy';

export interface PBCItem {
  id: number;
  num: number;
  category: string;
  itemRequested: string;
  whyPurpose: string;
  formatExpected: string;
  priority: PBCPriority;
  ownerClient: string | null;
  status: PBCStatus;
  dateRequested: string | null;
  dateReceived: string | null;
  notes: string | null;
  tscMapping: TSC[];
  internalComments: string | null;
  linkedItems: number[];
  createdAt: string;
  updatedAt: string;
}

export type AccessStatus =
  | 'Not Requested'
  | 'Requested'
  | 'Provisioned'
  | 'Revoked'
  | 'N/A';

export interface AccessRequest {
  id: number;
  num: number;
  system: string;
  accessType: string;
  rolePermissions: string;
  recommendedMethod: string;
  justification: string;
  ownerClient: string | null;
  status: AccessStatus;
  provisionedDate: string | null;
  notes: string | null;
  updatedAt: string;
}

export type WalkthroughStatus =
  | 'Not Scheduled'
  | 'Scheduled'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled';

export interface Walkthrough {
  id: number;
  num: number;
  processArea: string;
  description: string | null;
  objective: string | null;
  keyTopics: string;
  attendees: string;
  proposedDate: string | null;
  durationMin: number | null;
  status: WalkthroughStatus;
  notes: string | null;
  updatedAt: string;
}

export interface Entity {
  id: number;
  num: number;
  legalEntity: string | null;
  countryLocation: string | null;
  itModel: string | null;
  keyApplications: string | null;
  hosting: string | null;
  headcount: number | null;
  inScope: 'Y' | 'N' | null;
  rationale: string | null;
  updatedAt: string;
}

export type TestStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Tested'
  | 'Findings'
  | 'N/A';

export interface SamplingItem {
  id: number;
  num: number;
  controlArea: string;
  controlDescription: string;
  populationSource: string;
  populationSize: number | null;
  sampleSize: number | null;
  samplingMethod: string;
  testStatus: TestStatus;
  findingsSummary: string | null;
  updatedAt: string;
}

export interface ActivityLog {
  id: number;
  entityType: string;
  entityId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  ts: string;
}

export interface EvidenceFile {
  id: number;
  itemId: number;
  filename: string;
  size: number;
  uploadedAt: string;
  storedPath: string;
}

export interface EngagementSettings {
  clientName: string;
  auditPeriod: string;
  leadAuditor: string;
  sponsor: string;
  projectTitle: string;
}
