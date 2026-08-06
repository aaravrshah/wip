CREATE TYPE "public"."contact_relationship" AS ENUM('recruiter', 'referrer', 'interviewer', 'hiring_manager', 'other');--> statement-breakpoint
ALTER TYPE "public"."document_use_purpose" ADD VALUE 'requested';--> statement-breakpoint
ALTER TYPE "public"."document_use_purpose" ADD VALUE 'other';--> statement-breakpoint
UPDATE "application_contacts"
SET "relationship" = CASE
  WHEN lower("relationship") LIKE '%recruit%' THEN 'recruiter'
  WHEN lower("relationship") LIKE '%referr%' THEN 'referrer'
  WHEN lower("relationship") LIKE '%interview%' THEN 'interviewer'
  WHEN lower("relationship") LIKE '%hiring%' THEN 'hiring_manager'
  ELSE 'other'
END;--> statement-breakpoint
ALTER TABLE "application_contacts" ALTER COLUMN "relationship" SET DATA TYPE "public"."contact_relationship" USING "relationship"::"public"."contact_relationship";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "role_title" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "profile_url" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_version_check" CHECK ("contacts"."version" > 0);--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_version_check" CHECK ("documents"."version" > 0);--> statement-breakpoint
CREATE POLICY "application_contacts_owner_insert" ON "application_contacts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("application_contacts"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "application_contacts_owner_update" ON "application_contacts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("application_contacts"."owner_id" = (select public.wip_current_owner_id())) WITH CHECK ("application_contacts"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "application_contacts_owner_delete" ON "application_contacts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("application_contacts"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "application_document_uses_owner_insert" ON "application_document_uses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("application_document_uses"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "application_document_uses_owner_delete" ON "application_document_uses" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("application_document_uses"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "contacts_owner_insert" ON "contacts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("contacts"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "contacts_owner_update" ON "contacts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("contacts"."owner_id" = (select public.wip_current_owner_id())) WITH CHECK ("contacts"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "contacts_owner_delete" ON "contacts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("contacts"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "document_versions_owner_insert" ON "document_versions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("document_versions"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "documents_owner_insert" ON "documents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("documents"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "documents_owner_update" ON "documents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("documents"."owner_id" = (select public.wip_current_owner_id())) WITH CHECK ("documents"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
GRANT INSERT (id, owner_id, display_name, email, organization, role_title, phone, profile_url)
  ON public.contacts TO authenticated;--> statement-breakpoint
GRANT UPDATE (display_name, email, organization, role_title, phone, profile_url, version, updated_at)
  ON public.contacts TO authenticated;--> statement-breakpoint
GRANT DELETE ON public.contacts TO authenticated;--> statement-breakpoint
GRANT INSERT (id, owner_id, application_id, contact_id, relationship)
  ON public.application_contacts TO authenticated;--> statement-breakpoint
GRANT UPDATE (relationship) ON public.application_contacts TO authenticated;--> statement-breakpoint
GRANT DELETE ON public.application_contacts TO authenticated;--> statement-breakpoint
GRANT INSERT (id, owner_id, kind, title) ON public.documents TO authenticated;--> statement-breakpoint
GRANT UPDATE (kind, title, version, updated_at) ON public.documents TO authenticated;--> statement-breakpoint
GRANT INSERT (
  id, owner_id, document_id, version_label, filename, content_sha256, external_reference
) ON public.document_versions TO authenticated;--> statement-breakpoint
GRANT INSERT (id, owner_id, application_id, document_version_id, purpose, used_at)
  ON public.application_document_uses TO authenticated;--> statement-breakpoint
GRANT DELETE ON public.application_document_uses TO authenticated;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.wip_delete_tracker_data()
RETURNS TABLE (
  applications_deleted bigint,
  documents_deleted bigint,
  contacts_deleted bigint
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  current_owner_id uuid;
BEGIN
  current_owner_id := public.wip_current_owner_id();
  IF current_owner_id IS NULL THEN
    RAISE EXCEPTION 'verified Wip owner required' USING ERRCODE = '42501';
  END IF;

  WITH deleted AS (
    DELETE FROM public.applications WHERE owner_id = current_owner_id RETURNING 1
  ) SELECT count(*) INTO applications_deleted FROM deleted;

  WITH deleted AS (
    DELETE FROM public.documents WHERE owner_id = current_owner_id RETURNING 1
  ) SELECT count(*) INTO documents_deleted FROM deleted;

  WITH deleted AS (
    DELETE FROM public.contacts WHERE owner_id = current_owner_id RETURNING 1
  ) SELECT count(*) INTO contacts_deleted FROM deleted;

  RETURN NEXT;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.wip_delete_tracker_data() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.wip_delete_tracker_data() TO authenticated;
