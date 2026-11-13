-- IASDPI piloto ISOLADO. Não executar no Supabase sem autorização e recuperação revisada.
BEGIN;
DO $$ BEGIN IF (SELECT step FROM iasdpi_pilot_admin.installation WHERE singleton)<>4 THEN RAISE EXCEPTION 'Ordem de instalação inválida; não reaplicar.';END IF;END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_schedule_published(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE rows jsonb;BEGIN
 rows:=iasdpi_pilot_private.published_before_privacy(p_month);
 RETURN coalesce((SELECT jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(row) WHERE key IN('id','date','department_id','department','person','role','event','starts_at','ends_at','startDate','endDate','kind','pending','vacancy_count','version','published_at','origin'))) FROM jsonb_array_elements(rows)row),'[]');END $$;
CREATE FUNCTION public.iasdpi_pilot_initial_status() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('mode','isolated-admin-v1','church_code','IASD_PI','published_only',true,'events',true,'schedules',true,'alias_required',false) $$;
-- Encerramento: nenhuma RPC de gravação confia em papel recebido do frontend.
GRANT CREATE ON SCHEMA public,iasdpi_pilot_private,iasdpi_pilot_admin,iasdpi_pilot_operational TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname LIKE 'iasdpi\_pilot\_%' ESCAPE '\') OR n.nspname IN('iasdpi_pilot_private','iasdpi_pilot_admin','iasdpi_pilot_operational') LOOP
 IF f.proname IN('core_snapshot','assert_core_unchanged') THEN CONTINUE;END IF;
 IF f.proname NOT IN('iasdpi_pilot_list_churches','iasdpi_pilot_current_church_id') THEN EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);END IF;
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 IF f.proname IN('iasdpi_pilot_list_churches','iasdpi_pilot_current_church_id','iasdpi_pilot_schedule_published','iasdpi_pilot_events_published','iasdpi_pilot_registry_public','iasdpi_pilot_initial_status') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.sig);END IF;
 END LOOP;END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private,iasdpi_pilot_admin,iasdpi_pilot_operational FROM iasdpi_pilot_executor;
-- Novas tabelas pós-scope também recebem defesa restritiva para gravações diretas.
DO $$ DECLARE t record;BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN('iasdpi_pilot','iasdpi_pilot_private','iasdpi_pilot_admin','iasdpi_pilot_operational') LOOP
 EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.schemaname,t.tablename);
 EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',t.schemaname,t.tablename);
 EXECUTE format('CREATE POLICY pilot_operator ON %I.%I FOR ALL TO postgres USING(true) WITH CHECK(true)',t.schemaname,t.tablename);
 EXECUTE format('REVOKE ALL ON %I.%I FROM public,anon,authenticated,service_role',t.schemaname,t.tablename);
 END LOOP;END $$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA iasdpi_pilot,iasdpi_pilot_private,iasdpi_pilot_admin,iasdpi_pilot_operational FROM public,anon,authenticated,service_role;

REVOKE ALL ON SCHEMA iasdpi_pilot,iasdpi_pilot_private,iasdpi_pilot_admin,iasdpi_pilot_operational FROM public,anon,authenticated,service_role;
-- Padrões já aprovados: Comunicação/Família/Criança com vagas aos sábados.
UPDATE iasdpi_pilot.schedule_departments SET planning_weekdays=ARRAY[6]::smallint[]
 WHERE code IN('comunicacao','ministerio-da-familia','ministerio-da-crianca');

UPDATE iasdpi_pilot_admin.installation SET step=5 WHERE singleton;
SELECT iasdpi_pilot_admin.assert_core_unchanged();
NOTIFY pgrst,'reload schema';
COMMIT;
