ALTER TYPE "public"."workplace" ADD VALUE 'unspecified';--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "create_idempotency_key" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "create_request_hash" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "last_mutation_id" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "projected_stage_event_id" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "projected_stage_occurred_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "projected_stage_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "next_actions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_owner_create_idempotency_unique" ON "applications" USING btree ("owner_id","create_idempotency_key") WHERE "applications"."create_idempotency_key" is not null;--> statement-breakpoint
CREATE POLICY "application_events_owner_insert" ON "application_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("application_events"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "applications_owner_insert" ON "applications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("applications"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "applications_owner_update" ON "applications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("applications"."owner_id" = (select public.wip_current_owner_id())) WITH CHECK ("applications"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "applications_owner_delete" ON "applications" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("applications"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "job_description_snapshots_owner_insert" ON "job_description_snapshots" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("job_description_snapshots"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "next_actions_owner_insert" ON "next_actions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("next_actions"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "next_actions_owner_update" ON "next_actions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("next_actions"."owner_id" = (select public.wip_current_owner_id())) WITH CHECK ("next_actions"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "next_actions_owner_delete" ON "next_actions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("next_actions"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "notes_owner_insert" ON "notes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("notes"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "notes_owner_update" ON "notes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("notes"."owner_id" = (select public.wip_current_owner_id())) WITH CHECK ("notes"."owner_id" = (select public.wip_current_owner_id()));--> statement-breakpoint
CREATE POLICY "notes_owner_delete" ON "notes" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("notes"."owner_id" = (select public.wip_current_owner_id()));