export const applicationStages = [
  'saved',
  'preparing',
  'applied',
  'assessment',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStage = (typeof applicationStages)[number];

export const stageLabels: Record<ApplicationStage, string> = {
  saved: 'Saved',
  preparing: 'Preparing',
  applied: 'Applied',
  assessment: 'Assessment',
  interviewing: 'Interviewing',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export type NextActionKind =
  'assessment' | 'decision' | 'follow-up' | 'interview' | 'prepare' | 'other';

export interface NextAction {
  id: string;
  kind: NextActionKind;
  title: string;
  dueAt: string;
  details?: string;
  state?: 'open' | 'completed' | 'cancelled';
  completedAt?: string;
  version?: number;
}

export type TimelineEventKind =
  | 'application'
  | 'assessment'
  | 'document'
  | 'employer'
  | 'follow-up'
  | 'interview'
  | 'offer'
  | 'status';

export interface TimelineEvent {
  id: string;
  eventType?: string;
  kind: TimelineEventKind;
  title: string;
  occurredAt: string;
  createdAt?: string;
  details?: string;
  source: 'Manual' | 'Demo seed' | 'Email extraction' | 'Extension' | 'Import' | 'System';
  confirmationState?: 'pending' | 'confirmed' | 'rejected' | 'not_required';
}

export interface JobSnapshot {
  capturedAt: string;
  sourceUrl: string;
  provenance: string;
  extractorVersion: string;
  contentHash: string;
  html: string;
  text: string;
}

export interface DocumentVersion {
  useId?: string;
  documentId?: string;
  documentVersionId?: string;
  documentVersion?: number;
  kind: 'Resume' | 'Cover letter' | 'Portfolio' | 'Other';
  label: string;
  filename: string;
  version: string;
  purpose?: 'prepared' | 'submitted' | 'shared' | 'requested' | 'other';
  contentHash?: string;
  externalReference?: string;
  usedAt?: string;
}

export type ContactRelationship =
  'recruiter' | 'referrer' | 'interviewer' | 'hiring_manager' | 'other';

export interface ContactRecord {
  id: string;
  name: string;
  organization?: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  profileUrl?: string;
  version?: number;
}

export interface Contact extends ContactRecord {
  associationId?: string;
  relationship: ContactRelationship | string;
}

export interface DocumentCatalogVersion {
  id: string;
  version: string;
  filename?: string;
  contentHash?: string;
  externalReference?: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  kind: 'Resume' | 'Cover letter' | 'Portfolio' | 'Other';
  label: string;
  version: number;
  versions: DocumentCatalogVersion[];
}

export interface ApplicationNote {
  id: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  version?: number;
}

export interface Application {
  id: string;
  company: string;
  role: string;
  location: string;
  workplace: 'Hybrid' | 'On-site' | 'Remote' | 'Not specified';
  stage: ApplicationStage;
  version?: number;
  dateApplied?: string;
  updatedAt: string;
  waitingOn: 'candidate' | 'employer' | 'none';
  sourceUrl: string;
  sourceName?: string;
  requisitionId: string;
  nextAction?: NextAction;
  nextActions?: NextAction[];
  timeline: TimelineEvent[];
  snapshot?: JobSnapshot;
  documents: DocumentVersion[];
  contacts: Contact[];
  notes: ApplicationNote[];
}

export type ApplicationSort = 'company' | 'date-applied' | 'stage' | 'updated';

export interface ApplicationQuery {
  search?: string;
  stage?: ApplicationStage | 'all';
  sort?: ApplicationSort;
}

export interface UpcomingItem {
  applicationId: string;
  company: string;
  role: string;
  action: NextAction;
}
