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
  kind: TimelineEventKind;
  title: string;
  occurredAt: string;
  details?: string;
  source: 'Manual' | 'Demo seed' | 'Email extraction' | 'Extension' | 'Import' | 'System';
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
  kind: 'Resume' | 'Cover letter' | 'Portfolio' | 'Other';
  label: string;
  filename: string;
  version: string;
  usedAt?: string;
}

export interface Contact {
  id: string;
  name: string;
  relationship: string;
  email?: string;
}

export interface ApplicationNote {
  id: string;
  body: string;
  createdAt: string;
}

export interface Application {
  id: string;
  company: string;
  role: string;
  location: string;
  workplace: 'Hybrid' | 'On-site' | 'Remote';
  stage: ApplicationStage;
  dateApplied?: string;
  updatedAt: string;
  waitingOn: 'candidate' | 'employer' | 'none';
  sourceUrl: string;
  requisitionId: string;
  nextAction?: NextAction;
  timeline: TimelineEvent[];
  snapshot: JobSnapshot;
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
