CREATE OR REPLACE FUNCTION "wip_reject_immutable_update"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Wip immutable records cannot be updated; append a replacement record instead'
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "application_events_immutable_update"
BEFORE UPDATE ON "application_events"
FOR EACH ROW EXECUTE FUNCTION "wip_reject_immutable_update"();
--> statement-breakpoint
CREATE TRIGGER "job_description_snapshots_immutable_update"
BEFORE UPDATE ON "job_description_snapshots"
FOR EACH ROW EXECUTE FUNCTION "wip_reject_immutable_update"();
--> statement-breakpoint
CREATE TRIGGER "document_versions_immutable_update"
BEFORE UPDATE ON "document_versions"
FOR EACH ROW EXECUTE FUNCTION "wip_reject_immutable_update"();
