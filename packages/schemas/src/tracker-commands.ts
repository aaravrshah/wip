import { applicationStages } from '@wip/domain';
import { z } from 'zod';

const optionalTrimmed = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

const isoDateTime = z.iso.datetime({ offset: true });
const webUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'https:' || protocol === 'http:';
}, 'Use an http:// or https:// URL.');

export const applicationStageSchema = z.enum(applicationStages);
export const workplaceSchema = z.enum(['hybrid', 'on_site', 'remote', 'unspecified']);
export const nextActionKindSchema = z.enum([
  'assessment',
  'decision',
  'follow_up',
  'interview',
  'prepare',
  'other',
]);
export const contactRelationshipSchema = z.enum([
  'recruiter',
  'referrer',
  'interviewer',
  'hiring_manager',
  'other',
]);
export const documentKindSchema = z.enum(['resume', 'cover_letter', 'portfolio', 'other']);
export const documentUsePurposeSchema = z.enum([
  'prepared',
  'submitted',
  'shared',
  'requested',
  'other',
]);
const contentSha256Schema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/, 'Use a 64-character lowercase SHA-256 value.');

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16, 'Use an idempotency key with at least 16 characters.')
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, 'The idempotency key contains unsupported characters.');

export const createApplicationCommandSchema = z
  .object({
    company: z.string().trim().min(1, 'Company is required.').max(120),
    role: z.string().trim().min(1, 'Role or title is required.').max(160),
    stage: applicationStageSchema.default('saved'),
    sourceUrl: optionalTrimmed(2_048).pipe(webUrl.optional()),
    sourceName: optionalTrimmed(120),
    location: optionalTrimmed(160),
    workplace: workplaceSchema.default('unspecified'),
    requisitionId: optionalTrimmed(120),
    appliedAt: isoDateTime.optional(),
    jobDescriptionText: optionalTrimmed(200_000),
    nextAction: z
      .object({
        kind: nextActionKindSchema,
        title: z.string().trim().min(1, 'Next-action title is required.').max(200),
        details: optionalTrimmed(5_000),
        dueAt: isoDateTime,
      })
      .optional(),
  })
  .strict();

export const updateApplicationCommandSchema = z
  .object({
    expectedVersion: z.int().positive(),
    company: z.string().trim().min(1, 'Company is required.').max(120),
    role: z.string().trim().min(1, 'Role or title is required.').max(160),
    sourceUrl: optionalTrimmed(2_048).pipe(webUrl.optional()),
    sourceName: optionalTrimmed(120),
    location: optionalTrimmed(160),
    workplace: workplaceSchema,
    requisitionId: optionalTrimmed(120),
  })
  .strict();

export const recordStageChangeCommandSchema = z
  .object({
    stage: applicationStageSchema,
    effectiveAt: isoDateTime,
  })
  .strict();

export const createNoteCommandSchema = z
  .object({ body: z.string().trim().min(1, 'Note text is required.').max(10_000) })
  .strict();

export const updateNoteCommandSchema = z
  .object({
    expectedVersion: z.int().positive(),
    body: z.string().trim().min(1, 'Note text is required.').max(10_000),
  })
  .strict();

export const createNextActionCommandSchema = z
  .object({
    kind: nextActionKindSchema,
    title: z.string().trim().min(1, 'Next-action title is required.').max(200),
    details: optionalTrimmed(5_000),
    dueAt: isoDateTime,
  })
  .strict();

export const updateNextActionCommandSchema = z
  .object({
    expectedVersion: z.int().positive(),
    kind: nextActionKindSchema,
    title: z.string().trim().min(1, 'Next-action title is required.').max(200),
    details: optionalTrimmed(5_000),
    dueAt: isoDateTime,
    state: z.enum(['open', 'completed']),
  })
  .strict();

export const deleteApplicationCommandSchema = z
  .object({ confirmation: z.string().trim().min(1).max(200) })
  .strict();

const contactFieldsSchema = {
  name: z.string().trim().min(1, 'Contact name is required.').max(160),
  organization: optionalTrimmed(160),
  roleTitle: optionalTrimmed(160),
  email: optionalTrimmed(320).pipe(z.email().optional()),
  phone: optionalTrimmed(80),
  profileUrl: optionalTrimmed(2_048).pipe(webUrl.optional()),
};

export const createApplicationContactCommandSchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('create'),
      relationship: contactRelationshipSchema,
      ...contactFieldsSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal('link'),
      contactId: z.uuid(),
      relationship: contactRelationshipSchema,
    })
    .strict(),
]);

export const updateApplicationContactCommandSchema = z
  .object({
    expectedVersion: z.int().positive(),
    relationship: contactRelationshipSchema,
    ...contactFieldsSchema,
  })
  .strict();

const documentVersionFieldsSchema = {
  versionLabel: z.string().trim().min(1, 'Version label is required.').max(120),
  filename: optionalTrimmed(255),
  contentSha256: contentSha256Schema.optional(),
  externalReference: optionalTrimmed(2_048).pipe(webUrl.optional()),
  purpose: documentUsePurposeSchema,
  usedAt: isoDateTime.optional(),
};

export const createApplicationDocumentCommandSchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('create'),
      kind: documentKindSchema,
      title: z.string().trim().min(1, 'Document name is required.').max(160),
      ...documentVersionFieldsSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal('add_version'),
      documentId: z.uuid(),
      ...documentVersionFieldsSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal('link_version'),
      documentVersionId: z.uuid(),
      purpose: documentUsePurposeSchema,
      usedAt: isoDateTime.optional(),
    })
    .strict(),
]);

export const updateDocumentCommandSchema = z
  .object({
    expectedVersion: z.int().positive(),
    kind: documentKindSchema,
    title: z.string().trim().min(1, 'Document name is required.').max(160),
  })
  .strict();

export const TRACKER_DELETION_PHRASE = 'DELETE MY WIP DATA';

export const deleteTrackerDataCommandSchema = z
  .object({ confirmation: z.literal(TRACKER_DELETION_PHRASE) })
  .strict();

export const trackerExportFormatSchema = z.enum(['json', 'csv']);

export const captureFieldSourceSchema = z.enum([
  'json_ld',
  'ats_adapter',
  'semantic',
  'meta',
  'heuristic',
  'user',
]);
export const captureConfidenceSchema = z.enum(['high', 'medium', 'low']);
const captureFieldEvidenceSchema = z
  .object({
    source: captureFieldSourceSchema,
    confidence: captureConfidenceSchema,
  })
  .strict();

export const extensionCaptureCommandSchema = z
  .object({
    company: z.string().trim().min(1, 'Company is required.').max(120),
    role: z.string().trim().min(1, 'Role or title is required.').max(160),
    stage: applicationStageSchema.default('saved'),
    sourceUrl: webUrl.max(2_048),
    canonicalUrl: optionalTrimmed(2_048).pipe(webUrl.optional()),
    pageTitle: optionalTrimmed(300),
    location: optionalTrimmed(160),
    workplace: workplaceSchema.default('unspecified'),
    employmentType: optionalTrimmed(160),
    salaryText: optionalTrimmed(500),
    requisitionId: optionalTrimmed(120),
    descriptionHtml: z.string().trim().min(1, 'A job description is required.').max(250_000),
    descriptionText: z.string().trim().min(1, 'A job description is required.').max(200_000),
    extraction: z
      .object({
        extractorVersion: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .regex(/^wip-extractor\/[0-9]+\.[0-9]+\.[0-9]+$/),
        selectedSource: captureFieldSourceSchema,
        fieldEvidence: z
          .object({
            company: captureFieldEvidenceSchema.optional(),
            role: captureFieldEvidenceSchema.optional(),
            location: captureFieldEvidenceSchema.optional(),
            workplace: captureFieldEvidenceSchema.optional(),
            employmentType: captureFieldEvidenceSchema.optional(),
            salaryText: captureFieldEvidenceSchema.optional(),
            requisitionId: captureFieldEvidenceSchema.optional(),
            description: captureFieldEvidenceSchema,
          })
          .strict(),
        warnings: z.array(z.string().trim().min(1).max(240)).max(20),
      })
      .strict(),
  })
  .strict();

const captureApplicationSummarySchema = z
  .object({
    id: z.string().min(1).max(200),
    company: z.string(),
    role: z.string(),
    stage: applicationStageSchema,
    path: z.string().startsWith('/applications/'),
  })
  .strict();

export const extensionCaptureResponseSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('created'),
      application: captureApplicationSummarySchema,
      idempotentReplay: z.boolean(),
    })
    .strict(),
  z
    .object({
      status: z.literal('duplicate'),
      application: captureApplicationSummarySchema,
      matchedOn: z.array(z.enum(['source_url', 'requisition_id'])).min(1),
    })
    .strict(),
]);

export type CreateApplicationCommand = z.infer<typeof createApplicationCommandSchema>;
export type UpdateApplicationCommand = z.infer<typeof updateApplicationCommandSchema>;
export type RecordStageChangeCommand = z.infer<typeof recordStageChangeCommandSchema>;
export type CreateNoteCommand = z.infer<typeof createNoteCommandSchema>;
export type UpdateNoteCommand = z.infer<typeof updateNoteCommandSchema>;
export type CreateNextActionCommand = z.infer<typeof createNextActionCommandSchema>;
export type UpdateNextActionCommand = z.infer<typeof updateNextActionCommandSchema>;
export type DeleteApplicationCommand = z.infer<typeof deleteApplicationCommandSchema>;
export type CreateApplicationContactCommand = z.infer<typeof createApplicationContactCommandSchema>;
export type UpdateApplicationContactCommand = z.infer<typeof updateApplicationContactCommandSchema>;
export type CreateApplicationDocumentCommand = z.infer<
  typeof createApplicationDocumentCommandSchema
>;
export type UpdateDocumentCommand = z.infer<typeof updateDocumentCommandSchema>;
export type DeleteTrackerDataCommand = z.infer<typeof deleteTrackerDataCommandSchema>;
export type TrackerExportFormat = z.infer<typeof trackerExportFormatSchema>;
export type CaptureFieldSource = z.infer<typeof captureFieldSourceSchema>;
export type CaptureConfidence = z.infer<typeof captureConfidenceSchema>;
export type ExtensionCaptureCommand = z.infer<typeof extensionCaptureCommandSchema>;
export type ExtensionCaptureResponse = z.infer<typeof extensionCaptureResponseSchema>;
