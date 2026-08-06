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

  UPDATE public.owners
  SET
    timezone = 'UTC',
    locale = NULL,
    week_starts_on = NULL,
    updated_at = now()
  WHERE id = current_owner_id;

  RETURN NEXT;
END
$$;
