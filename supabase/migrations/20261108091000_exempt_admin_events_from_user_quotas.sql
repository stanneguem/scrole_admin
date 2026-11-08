-- Admin-created directory events are exempt from end-user event quotas.
DO $migration$
DECLARE v_definition text;
BEGIN
  v_definition := pg_get_functiondef('public.scrole_enforce_event_quota_limits()'::regprocedure);
  IF position('scrole.admin_event_creation' in v_definition) = 0 THEN
    v_definition := replace(v_definition,
      E'begin\n  select exists (',
      E'begin\n  if current_setting(''scrole.admin_event_creation'', true) = ''true'' then\n    return new;\n  end if;\n\n  select exists (');
    IF position('scrole.admin_event_creation' in v_definition) = 0 THEN
      RAISE EXCEPTION 'Could not insert admin event quota bypass safely';
    END IF;
    EXECUTE v_definition;
  END IF;

  v_definition := pg_get_functiondef('public.admin_create_event_from_console(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text)'::regprocedure);
  IF position('scrole.admin_event_creation' in v_definition) = 0 THEN
    v_definition := replace(v_definition,
      E'begin\n if p_creator_id is null',
      E'begin\n perform set_config(''scrole.admin_event_creation'',''true'',true);\n if p_creator_id is null');
    IF position('scrole.admin_event_creation' in v_definition) = 0 THEN
      RAISE EXCEPTION 'Could not mark admin event creation safely';
    END IF;
    EXECUTE v_definition;
  END IF;
END;
$migration$;
