DO $$
DECLARE
  authenticated_bypasses_rls boolean;
  authenticated_is_elevated boolean;
BEGIN
  IF to_regprocedure('auth.user_id()') IS NULL THEN
    RAISE EXCEPTION 'Configure Neon RLS/JWKS before applying this migration';
  END IF;

  SELECT
    rolbypassrls,
    rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication
  INTO authenticated_bypasses_rls, authenticated_is_elevated
  FROM pg_roles
  WHERE rolname = 'authenticated';

  IF authenticated_bypasses_rls IS NULL THEN
    RAISE EXCEPTION 'Neon RLS authenticated role is missing';
  ELSIF authenticated_bypasses_rls THEN
    RAISE EXCEPTION 'authenticated role must not have BYPASSRLS';
  ELSIF authenticated_is_elevated THEN
    RAISE EXCEPTION 'authenticated role must not have elevated database privileges';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class
    JOIN pg_roles ON pg_roles.oid = pg_class.relowner
    WHERE pg_roles.rolname = 'authenticated'
      AND pg_class.relnamespace = 'public'::regnamespace
      AND pg_class.relname IN (
        'owners',
        'applications',
        'application_events',
        'job_description_snapshots',
        'documents',
        'document_versions',
        'application_document_uses',
        'contacts',
        'application_contacts',
        'notes',
        'next_actions'
      )
  ) THEN
    RAISE EXCEPTION 'authenticated role must not own Wip tables';
  END IF;
END
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.wip_current_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT id
  FROM public.owners
  WHERE auth_provider = 'clerk'
    AND auth_subject = auth.user_id()
  LIMIT 1
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.wip_provision_owner()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  clerk_subject text;
  provisioned_owner_id uuid;
BEGIN
  clerk_subject := auth.user_id();

  IF clerk_subject IS NULL OR clerk_subject = '' THEN
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
REVOKE ALL ON FUNCTION public.wip_current_owner_id() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.wip_provision_owner() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.wip_current_owner_id() TO authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.wip_provision_owner() TO authenticated;--> statement-breakpoint
ALTER TABLE "application_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "application_document_uses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "application_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_description_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "next_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "owners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "owners_clerk_subject_unique" ON "owners" USING btree ("auth_subject") WHERE "owners"."auth_provider" = 'clerk';--> statement-breakpoint
CREATE POLICY "application_contacts_owner_select" ON "application_contacts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("application_contacts"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "application_document_uses_owner_select" ON "application_document_uses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("application_document_uses"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "application_events_owner_select" ON "application_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("application_events"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "applications_owner_select" ON "applications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("applications"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "contacts_owner_select" ON "contacts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("contacts"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "document_versions_owner_select" ON "document_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("document_versions"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "documents_owner_select" ON "documents" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("documents"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "job_description_snapshots_owner_select" ON "job_description_snapshots" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("job_description_snapshots"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "next_actions_owner_select" ON "next_actions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("next_actions"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "notes_owner_select" ON "notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("notes"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "owners_clerk_identity_select" ON "owners" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("owners"."auth_provider" = 'clerk' and "owners"."auth_subject" = (select auth.user_id()));--> statement-breakpoint
ALTER TABLE "application_contacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "application_document_uses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "application_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "applications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_description_snapshots" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "next_actions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "owners" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO authenticated;--> statement-breakpoint
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
TO authenticated;
