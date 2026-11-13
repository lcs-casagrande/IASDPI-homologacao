-- ROLLBACK LÓGICO. Operador/revisão explícitos. Não exclui usuários, aliases ou históricos.
-- Antes: desativar pilotProfilesEnabled/aliasLoginEnabled e Edge Functions do piloto.
BEGIN;
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Somente operador.';END IF;
PERFORM 1 FROM iasdpi_pilot_admin.control WHERE singleton FOR UPDATE;END $$;
UPDATE iasdpi_pilot.iasdpi_access SET enabled=false WHERE role IN('membro','secretaria');
UPDATE iasdpi_pilot_private.profile_aliases SET enabled=false,version=version+1;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT definition FROM iasdpi_pilot_private.profile_backups WHERE key NOT IN('public-function','backup-complete') LOOP EXECUTE r.definition;END LOOP;
 IF pg_get_functiondef('public.iasdpi_pilot_schedule_published(date)'::regprocedure) IS DISTINCT FROM (SELECT definition FROM iasdpi_pilot_private.profile_backups WHERE key='public-function') THEN RAISE EXCEPTION 'Consulta pública mudou; rollback interrompido.';END IF;
 PERFORM iasdpi_pilot_admin.assert_core_unchanged();END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
