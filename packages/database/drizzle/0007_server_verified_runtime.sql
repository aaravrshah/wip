DO $$
DECLARE
  runtime_can_bypass_rls boolean;
  runtime_is_elevated boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wip_runtime') THEN
    CREATE ROLE wip_runtime
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS;
  END IF;

  SELECT
    rolbypassrls,
    rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication
  INTO runtime_can_bypass_rls, runtime_is_elevated
  FROM pg_roles
  WHERE rolname = 'wip_runtime';

  IF runtime_can_bypass_rls OR runtime_is_elevated THEN
    RAISE EXCEPTION 'wip_runtime must remain a non-elevated NOBYPASSRLS role';
  END IF;
END
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.wip_clerk_subject()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.wip_current_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT id
  FROM public.owners
  WHERE auth_provider = 'clerk'
    AND auth_subject = public.wip_clerk_subject()
  LIMIT 1
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.wip_provision_owner()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  clerk_subject text;
  provisioned_owner_id uuid;
BEGIN
  clerk_subject := public.wip_clerk_subject();

  IF clerk_subject IS NULL THEN
    RAISE EXCEPTION 'verified Clerk identity required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.owners (auth_provider, auth_subject, timezone)
  VALUES ('clerk', clerk_subject, 'UTC')
  ON CONFLICT (auth_subject) WHERE auth_provider = 'clerk'
  DO NOTHING
  RETURNING id INTO provisioned_owner_id;

  IF provisioned_owner_id IS NULL THEN
    SELECT id INTO STRICT provisioned_owner_id
    FROM public.owners
    WHERE auth_provider = 'clerk'
      AND auth_subject = clerk_subject;
  END IF;

  RETURN provisioned_owner_id;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.wip_clerk_subject() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.wip_current_owner_id() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.wip_provision_owner() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.wip_clerk_subject() TO authenticated, wip_runtime;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.wip_current_owner_id() TO authenticated, wip_runtime;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.wip_provision_owner() TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "owners_clerk_identity_select" ON public.owners
  TO authenticated, wip_runtime
  USING (auth_provider = 'clerk' AND auth_subject = (SELECT public.wip_clerk_subject()));--> statement-breakpoint
ALTER POLICY "application_contacts_owner_select" ON public.application_contacts TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "application_document_uses_owner_select" ON public.application_document_uses TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "application_events_owner_select" ON public.application_events TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "applications_owner_select" ON public.applications TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "contacts_owner_select" ON public.contacts TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "document_versions_owner_select" ON public.document_versions TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "documents_owner_select" ON public.documents TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "job_description_snapshots_owner_select" ON public.job_description_snapshots TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "next_actions_owner_select" ON public.next_actions TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "notes_owner_select" ON public.notes TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "application_events_owner_insert" ON public.application_events TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "applications_owner_insert" ON public.applications TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "applications_owner_update" ON public.applications TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "applications_owner_delete" ON public.applications TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "job_description_snapshots_owner_insert" ON public.job_description_snapshots TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "next_actions_owner_insert" ON public.next_actions TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "next_actions_owner_update" ON public.next_actions TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "next_actions_owner_delete" ON public.next_actions TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "notes_owner_insert" ON public.notes TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "notes_owner_update" ON public.notes TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "notes_owner_delete" ON public.notes TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "application_contacts_owner_insert" ON public.application_contacts TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "application_contacts_owner_update" ON public.application_contacts TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "application_contacts_owner_delete" ON public.application_contacts TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "application_document_uses_owner_insert" ON public.application_document_uses TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "application_document_uses_owner_delete" ON public.application_document_uses TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "contacts_owner_insert" ON public.contacts TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "contacts_owner_update" ON public.contacts TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "contacts_owner_delete" ON public.contacts TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "document_versions_owner_insert" ON public.document_versions TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "documents_owner_insert" ON public.documents TO authenticated, wip_runtime;--> statement-breakpoint
ALTER POLICY "documents_owner_update" ON public.documents TO authenticated, wip_runtime;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO wip_runtime;--> statement-breakpoint
GRANT SELECT ON TABLE
  public.owners,
  public.applications,
  public.application_events,
  public.job_description_snapshots,
  public.documents,
  public.document_versions,
  public.application_document_uses,
  public.contacts,
  public.application_contacts,
  public.notes,
  public.next_actions
TO wip_runtime;--> statement-breakpoint
GRANT INSERT (
  id, owner_id, public_id, create_idempotency_key, create_request_hash, last_mutation_id,
  company_name, role_title, location_text, workplace, current_stage, projected_applied_at,
  last_confirmed_event_at, projected_stage_event_id, projected_stage_occurred_at,
  projected_stage_created_at, waiting_on, source_url, source_name, requisition_id
) ON public.applications TO wip_runtime;--> statement-breakpoint
GRANT UPDATE (
  company_name, role_title, location_text, workplace, current_stage, projected_applied_at,
  last_confirmed_event_at, projected_stage_event_id, projected_stage_occurred_at,
  projected_stage_created_at, waiting_on, source_url, source_name, requisition_id, updated_at,
  version, last_mutation_id
) ON public.applications TO wip_runtime;--> statement-breakpoint
GRANT DELETE ON public.applications TO wip_runtime;--> statement-breakpoint
GRANT INSERT (
  id, owner_id, application_id, event_type, event_kind, title, details, occurred_at, source,
  confidence, confirmation_state, payload_version, payload, source_reference_type,
  source_reference_id, supersedes_event_id, idempotency_key, created_by_owner_id
) ON public.application_events TO wip_runtime;--> statement-breakpoint
GRANT INSERT (
  id, owner_id, application_id, captured_at, capture_source, source_url, canonical_url,
  page_title, description_html, description_text, content_sha256, extractor_version,
  provenance, capture_metadata
) ON public.job_description_snapshots TO wip_runtime;--> statement-breakpoint
GRANT INSERT (id, owner_id, application_id, body) ON public.notes TO wip_runtime;--> statement-breakpoint
GRANT UPDATE (body, version, updated_at) ON public.notes TO wip_runtime;--> statement-breakpoint
GRANT DELETE ON public.notes TO wip_runtime;--> statement-breakpoint
GRANT INSERT (id, owner_id, application_id, kind, title, details, due_at, state, completed_at)
  ON public.next_actions TO wip_runtime;--> statement-breakpoint
GRANT UPDATE (kind, title, details, due_at, state, completed_at, version, updated_at)
  ON public.next_actions TO wip_runtime;--> statement-breakpoint
GRANT DELETE ON public.next_actions TO wip_runtime;--> statement-breakpoint
GRANT INSERT (id, owner_id, display_name, email, organization, role_title, phone, profile_url)
  ON public.contacts TO wip_runtime;--> statement-breakpoint
GRANT UPDATE (display_name, email, organization, role_title, phone, profile_url, version, updated_at)
  ON public.contacts TO wip_runtime;--> statement-breakpoint
GRANT DELETE ON public.contacts TO wip_runtime;--> statement-breakpoint
GRANT INSERT (id, owner_id, application_id, contact_id, relationship)
  ON public.application_contacts TO wip_runtime;--> statement-breakpoint
GRANT UPDATE (relationship) ON public.application_contacts TO wip_runtime;--> statement-breakpoint
GRANT DELETE ON public.application_contacts TO wip_runtime;--> statement-breakpoint
GRANT INSERT (id, owner_id, kind, title) ON public.documents TO wip_runtime;--> statement-breakpoint
GRANT UPDATE (kind, title, version, updated_at) ON public.documents TO wip_runtime;--> statement-breakpoint
GRANT INSERT (
  id, owner_id, document_id, version_label, filename, content_sha256, external_reference
) ON public.document_versions TO wip_runtime;--> statement-breakpoint
GRANT INSERT (id, owner_id, application_id, document_version_id, purpose, used_at)
  ON public.application_document_uses TO wip_runtime;--> statement-breakpoint
GRANT DELETE ON public.application_document_uses TO wip_runtime;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.wip_delete_tracker_data() TO wip_runtime;
