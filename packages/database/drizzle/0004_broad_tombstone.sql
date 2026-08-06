ALTER TABLE "applications" ADD CONSTRAINT "applications_version_check" CHECK ("applications"."version" > 0);--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_create_request_hash_check" CHECK ("applications"."create_request_hash" is null or (char_length("applications"."create_request_hash") = 64 and "applications"."create_request_hash" ~ '^[0-9a-f]{64}$'));--> statement-breakpoint
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_version_check" CHECK ("next_actions"."version" > 0);--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_version_check" CHECK ("notes"."version" > 0);--> statement-breakpoint
GRANT INSERT (
  id,
  owner_id,
  public_id,
  create_idempotency_key,
  create_request_hash,
  last_mutation_id,
  company_name,
  role_title,
  location_text,
  workplace,
  current_stage,
  projected_applied_at,
  last_confirmed_event_at,
  projected_stage_event_id,
  projected_stage_occurred_at,
  projected_stage_created_at,
  waiting_on,
  source_url,
  source_name,
  requisition_id
) ON public.applications TO authenticated;--> statement-breakpoint
GRANT UPDATE (
  company_name,
  role_title,
  location_text,
  workplace,
  current_stage,
  projected_applied_at,
  last_confirmed_event_at,
  projected_stage_event_id,
  projected_stage_occurred_at,
  projected_stage_created_at,
  waiting_on,
  source_url,
  source_name,
  requisition_id,
  updated_at,
  version,
  last_mutation_id
) ON public.applications TO authenticated;--> statement-breakpoint
GRANT DELETE ON public.applications TO authenticated;--> statement-breakpoint
GRANT INSERT (
  id,
  owner_id,
  application_id,
  event_type,
  event_kind,
  title,
  details,
  occurred_at,
  source,
  confidence,
  confirmation_state,
  payload_version,
  payload,
  source_reference_type,
  source_reference_id,
  supersedes_event_id,
  idempotency_key,
  created_by_owner_id
) ON public.application_events TO authenticated;--> statement-breakpoint
GRANT INSERT (
  id,
  owner_id,
  application_id,
  captured_at,
  capture_source,
  source_url,
  canonical_url,
  page_title,
  description_html,
  description_text,
  content_sha256,
  extractor_version,
  provenance,
  capture_metadata
) ON public.job_description_snapshots TO authenticated;--> statement-breakpoint
GRANT INSERT (id, owner_id, application_id, body)
  ON public.notes TO authenticated;--> statement-breakpoint
GRANT UPDATE (body, version, updated_at)
  ON public.notes TO authenticated;--> statement-breakpoint
GRANT DELETE ON public.notes TO authenticated;--> statement-breakpoint
GRANT INSERT (id, owner_id, application_id, kind, title, details, due_at, state, completed_at)
  ON public.next_actions TO authenticated;--> statement-breakpoint
GRANT UPDATE (kind, title, details, due_at, state, completed_at, version, updated_at)
  ON public.next_actions TO authenticated;--> statement-breakpoint
GRANT DELETE ON public.next_actions TO authenticated;
