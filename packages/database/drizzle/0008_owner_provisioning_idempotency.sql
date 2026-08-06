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
  ON CONFLICT DO NOTHING
  RETURNING id INTO provisioned_owner_id;

  IF provisioned_owner_id IS NULL THEN
    SELECT id INTO STRICT provisioned_owner_id
    FROM public.owners
    WHERE auth_provider = 'clerk'
      AND auth_subject = clerk_subject;
  END IF;

  RETURN provisioned_owner_id;
END
$$;
