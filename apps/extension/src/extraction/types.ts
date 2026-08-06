import type { CaptureConfidence, CaptureFieldSource } from '@wip/schemas';
import type { ApplicationStage } from '@wip/domain';

export interface FieldEvidence {
  source: CaptureFieldSource;
  confidence: CaptureConfidence;
}

export interface ExtractionDraft {
  extractorVersion: string;
  selectedSource: CaptureFieldSource;
  sourceUrl: string;
  canonicalUrl?: string;
  pageTitle?: string;
  role?: string;
  company?: string;
  stage: ApplicationStage;
  location?: string;
  workplace: 'hybrid' | 'on_site' | 'remote' | 'unspecified';
  employmentType?: string;
  salaryText?: string;
  requisitionId?: string;
  descriptionHtml: string;
  descriptionText: string;
  fieldEvidence: {
    company?: FieldEvidence;
    role?: FieldEvidence;
    location?: FieldEvidence;
    workplace?: FieldEvidence;
    employmentType?: FieldEvidence;
    salaryText?: FieldEvidence;
    requisitionId?: FieldEvidence;
    description: FieldEvidence;
  };
  warnings: string[];
}

export type ExtractionResult =
  | { status: 'captured'; draft: ExtractionDraft }
  | { status: 'unsupported'; reason: string; sourceUrl?: string };
