-- SOMENTE LEITURA. Capturar e anexar ao PR antes da ativação; não é cópia já obtida do banco real.
BEGIN TRANSACTION READ ONLY;
SELECT iasdpi_pilot_admin.assert_core_unchanged();
SELECT jsonb_build_object('public_schedule_definition',pg_get_functiondef('public.iasdpi_pilot_schedule_published(date)'::regprocedure),
 'public_schedule_sha256',encode(sha256(convert_to(pg_get_functiondef('public.iasdpi_pilot_schedule_published(date)'::regprocedure),'UTF8')),'hex'),
 'rpc_owners_acl',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'iasdpi\_pilot\_%' ESCAPE '\'),
 'active_admin_count',(SELECT count(*) FROM iasdpi_pilot.iasdpi_access WHERE role='admin' AND enabled),
 'rls_all_enabled',NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('iasdpi_pilot','iasdpi_pilot_private') AND c.relkind='r' AND NOT c.relrowsecurity)) AS profiles_preflight;
COMMIT;
