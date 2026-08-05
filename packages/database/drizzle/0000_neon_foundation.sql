CREATE TYPE "public"."application_stage" AS ENUM('saved', 'preparing', 'applied', 'assessment', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."confirmation_state" AS ENUM('pending', 'confirmed', 'rejected', 'not_required');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('resume', 'cover_letter', 'portfolio', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_use_purpose" AS ENUM('prepared', 'submitted', 'shared');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('application', 'assessment', 'document', 'employer', 'follow_up', 'interview', 'offer', 'status');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('manual', 'demo_seed', 'extension', 'email_extraction', 'import', 'system');--> statement-breakpoint
CREATE TYPE "public"."next_action_kind" AS ENUM('assessment', 'decision', 'follow_up', 'interview', 'prepare', 'other');--> statement-breakpoint
CREATE TYPE "public"."next_action_state" AS ENUM('open', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."snapshot_capture_source" AS ENUM('manual', 'demo_seed', 'extension', 'import');--> statement-breakpoint
CREATE TYPE "public"."waiting_on" AS ENUM('candidate', 'employer', 'none');--> statement-breakpoint
CREATE TYPE "public"."workplace" AS ENUM('hybrid', 'on_site', 'remote');--> statement-breakpoint
CREATE TABLE "application_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"relationship" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_contacts_owner_id_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "application_contacts_unique" UNIQUE("owner_id","application_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "application_document_uses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"purpose" "document_use_purpose" NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_document_uses_owner_id_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "application_document_uses_unique" UNIQUE("owner_id","application_id","document_version_id","purpose")
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_kind" "event_kind" NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"source" "event_source" NOT NULL,
	"confidence" numeric(4, 3),
	"confirmation_state" "confirmation_state" NOT NULL,
	"payload_version" smallint DEFAULT 1 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_reference_type" text,
	"source_reference_id" uuid,
	"supersedes_event_id" uuid,
	"idempotency_key" text,
	"created_by_owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_events_owner_id_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "application_events_confidence_check" CHECK ("application_events"."confidence" is null or "application_events"."confidence" between 0 and 1),
	CONSTRAINT "application_events_payload_version_check" CHECK ("application_events"."payload_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"public_id" text NOT NULL,
	"company_name" text NOT NULL,
	"role_title" text NOT NULL,
	"location_text" text NOT NULL,
	"workplace" "workplace" NOT NULL,
	"current_stage" "application_stage" NOT NULL,
	"projected_applied_at" timestamp with time zone,
	"last_confirmed_event_at" timestamp with time zone NOT NULL,
	"waiting_on" "waiting_on" DEFAULT 'none' NOT NULL,
	"source_url" text,
	"source_name" text,
	"requisition_id" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_owner_id_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "applications_owner_public_id_unique" UNIQUE("owner_id","public_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"organization" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_owner_id_id_unique" UNIQUE("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"filename" text,
	"content_sha256" text,
	"external_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_owner_id_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "document_versions_owner_document_label_unique" UNIQUE("owner_id","document_id","version_label"),
	CONSTRAINT "document_versions_sha256_check" CHECK ("document_versions"."content_sha256" is null or (char_length("document_versions"."content_sha256") = 64 and "document_versions"."content_sha256" ~ '^[0-9a-f]{64}$'))
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_owner_id_id_unique" UNIQUE("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "job_description_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"capture_source" "snapshot_capture_source" NOT NULL,
	"source_url" text,
	"canonical_url" text,
	"page_title" text,
	"description_html" text NOT NULL,
	"description_text" text NOT NULL,
	"content_sha256" text NOT NULL,
	"extractor_version" text NOT NULL,
	"provenance" text NOT NULL,
	"capture_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_snapshots_owner_id_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "job_snapshots_owner_application_hash_unique" UNIQUE("owner_id","application_id","content_sha256"),
	CONSTRAINT "job_snapshots_sha256_check" CHECK (char_length("job_description_snapshots"."content_sha256") = 64 and "job_description_snapshots"."content_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "next_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" "next_action_kind" NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"due_at" timestamp with time zone NOT NULL,
	"state" "next_action_state" DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "next_actions_owner_id_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "next_actions_completion_check" CHECK (("next_actions"."state" = 'completed' and "next_actions"."completed_at" is not null) or ("next_actions"."state" <> 'completed'))
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_owner_id_id_unique" UNIQUE("owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider" text,
	"auth_subject" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"locale" text,
	"week_starts_on" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_week_starts_on_check" CHECK ("owners"."week_starts_on" is null or "owners"."week_starts_on" between 0 and 6)
);
--> statement-breakpoint
ALTER TABLE "application_contacts" ADD CONSTRAINT "application_contacts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_contacts" ADD CONSTRAINT "application_contacts_owner_application_fk" FOREIGN KEY ("owner_id","application_id") REFERENCES "public"."applications"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_contacts" ADD CONSTRAINT "application_contacts_owner_contact_fk" FOREIGN KEY ("owner_id","contact_id") REFERENCES "public"."contacts"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_document_uses" ADD CONSTRAINT "application_document_uses_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_document_uses" ADD CONSTRAINT "application_document_uses_owner_application_fk" FOREIGN KEY ("owner_id","application_id") REFERENCES "public"."applications"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_document_uses" ADD CONSTRAINT "application_document_uses_owner_version_fk" FOREIGN KEY ("owner_id","document_version_id") REFERENCES "public"."document_versions"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_created_by_owner_id_owners_id_fk" FOREIGN KEY ("created_by_owner_id") REFERENCES "public"."owners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_owner_application_fk" FOREIGN KEY ("owner_id","application_id") REFERENCES "public"."applications"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_owner_supersedes_fk" FOREIGN KEY ("owner_id","supersedes_event_id") REFERENCES "public"."application_events"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_owner_document_fk" FOREIGN KEY ("owner_id","document_id") REFERENCES "public"."documents"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_description_snapshots" ADD CONSTRAINT "job_description_snapshots_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_description_snapshots" ADD CONSTRAINT "job_snapshots_owner_application_fk" FOREIGN KEY ("owner_id","application_id") REFERENCES "public"."applications"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_owner_application_fk" FOREIGN KEY ("owner_id","application_id") REFERENCES "public"."applications"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_owner_application_fk" FOREIGN KEY ("owner_id","application_id") REFERENCES "public"."applications"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_contacts_owner_application_idx" ON "application_contacts" USING btree ("owner_id","application_id");--> statement-breakpoint
CREATE INDEX "application_document_uses_owner_application_idx" ON "application_document_uses" USING btree ("owner_id","application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_events_owner_idempotency_unique" ON "application_events" USING btree ("owner_id","idempotency_key") WHERE "application_events"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "application_events_owner_application_occurred_idx" ON "application_events" USING btree ("owner_id","application_id","occurred_at","created_at");--> statement-breakpoint
CREATE INDEX "applications_owner_stage_updated_idx" ON "applications" USING btree ("owner_id","current_stage","updated_at");--> statement-breakpoint
CREATE INDEX "applications_owner_last_event_idx" ON "applications" USING btree ("owner_id","last_confirmed_event_at");--> statement-breakpoint
CREATE INDEX "contacts_owner_name_idx" ON "contacts" USING btree ("owner_id","display_name");--> statement-breakpoint
CREATE INDEX "document_versions_owner_document_created_idx" ON "document_versions" USING btree ("owner_id","document_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_owner_kind_idx" ON "documents" USING btree ("owner_id","kind");--> statement-breakpoint
CREATE INDEX "job_snapshots_owner_application_captured_idx" ON "job_description_snapshots" USING btree ("owner_id","application_id","captured_at");--> statement-breakpoint
CREATE INDEX "next_actions_owner_state_due_idx" ON "next_actions" USING btree ("owner_id","state","due_at");--> statement-breakpoint
CREATE INDEX "next_actions_owner_application_idx" ON "next_actions" USING btree ("owner_id","application_id");--> statement-breakpoint
CREATE INDEX "notes_owner_application_created_idx" ON "notes" USING btree ("owner_id","application_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "owners_auth_identity_unique" ON "owners" USING btree ("auth_provider","auth_subject") WHERE "owners"."auth_provider" is not null and "owners"."auth_subject" is not null;