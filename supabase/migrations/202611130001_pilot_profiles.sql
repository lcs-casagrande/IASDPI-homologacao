-- ISSUE #1. REVISAR + backup restaurado antes de aplicar. Nunca por CI/Preview.
-- Piloto isolado existente. Preserva a função pública instalada, dados e admin.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('iasdpi_pilot.iasdpi_access') IS NULL THEN RAISE EXCEPTION 'Exige operador postgres e piloto instalado.';END IF;
 PERFORM iasdpi_pilot_admin.assert_core_unchanged();
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_access WHERE enabled AND role='admin') THEN RAISE EXCEPTION 'Administrador existente necessário.';END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_plans p CROSS JOIN LATERAL jsonb_array_elements(public.iasdpi_pilot_schedule_published(p.month)) r
 JOIN iasdpi_pilot.schedule_departments d ON d.id::text=r->>'department_id' WHERE d.code<>'ancionato') THEN
 RAISE EXCEPTION 'Consulta pública ainda expõe outros departamentos; interromper sem sobrescrever a função.';END IF;
END $$;
CREATE TABLE IF NOT EXISTS iasdpi_pilot_private.profile_backups(key text PRIMARY KEY,definition text NOT NULL);
INSERT INTO iasdpi_pilot_private.profile_backups SELECT 'public-function',pg_get_functiondef('public.iasdpi_pilot_schedule_published(date)'::regprocedure) ON CONFLICT DO NOTHING;
INSERT INTO iasdpi_pilot_private.profile_backups SELECT p.oid::regprocedure::text,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE NOT EXISTS(SELECT 1 FROM iasdpi_pilot_private.profile_backups WHERE key='backup-complete') AND ((n.nspname='public' AND p.proname LIKE 'iasdpi\_pilot\_%' ESCAPE '\') OR n.nspname='iasdpi_pilot_private') ON CONFLICT DO NOTHING;
INSERT INTO iasdpi_pilot_private.profile_backups VALUES('backup-complete','v1') ON CONFLICT DO NOTHING;
DO $$ DECLARE c record;n integer:=0;BEGIN
 FOR c IN SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='iasdpi_pilot.iasdpi_access'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%role%' LOOP
 IF c.definition NOT IN($check$CHECK ((role = 'admin'::text))$check$,$check$CHECK ((role = ANY (ARRAY['admin'::text, 'membro'::text, 'secretaria'::text])))$check$) THEN RAISE EXCEPTION 'Constraint de perfil divergente; não substituir: %',c.conname;END IF;
 n:=n+1;EXECUTE format('ALTER TABLE iasdpi_pilot.iasdpi_access DROP CONSTRAINT %I',c.conname);END LOOP;
 IF n<>1 THEN RAISE EXCEPTION 'Quantidade de constraints de perfil incompatível.';END IF;
 ALTER TABLE iasdpi_pilot.iasdpi_access ADD CONSTRAINT pilot_profile_role CHECK(role IN('admin','membro','secretaria'));
END $$;
CREATE TABLE IF NOT EXISTS iasdpi_pilot_private.profile_aliases(
 church_id uuid NOT NULL DEFAULT public.iasdpi_pilot_current_church_id(),id uuid NOT NULL DEFAULT gen_random_uuid(),
 identifier text NOT NULL CHECK(identifier IN('admin','membro','secretaria')),user_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT true,version bigint NOT NULL DEFAULT 1,
 PRIMARY KEY(church_id,identifier),UNIQUE(church_id,user_id),UNIQUE(id));
CREATE TABLE IF NOT EXISTS iasdpi_pilot_private.profile_credentials(
 church_id uuid NOT NULL DEFAULT public.iasdpi_pilot_current_church_id(),user_id uuid NOT NULL,
 must_change boolean NOT NULL DEFAULT false,min_iat bigint NOT NULL DEFAULT 0,
 version bigint NOT NULL DEFAULT 1,change_id uuid,PRIMARY KEY(church_id,user_id));
CREATE TABLE IF NOT EXISTS iasdpi_pilot_private.profile_rate(key text PRIMARY KEY,window_at timestamptz NOT NULL,attempts integer NOT NULL);
DO $$ DECLARE u uuid;BEGIN
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot_private.profile_aliases WHERE identifier='admin') THEN
 IF (SELECT count(*) FROM iasdpi_pilot.iasdpi_access WHERE enabled AND role='admin')<>1 THEN RAISE EXCEPTION 'Mais de um admin: associar alias por revisão explícita.';END IF;
 SELECT user_id INTO u FROM iasdpi_pilot.iasdpi_access WHERE enabled AND role='admin';
 INSERT INTO iasdpi_pilot_private.profile_aliases(identifier,user_id) VALUES('admin',u);
 END IF;
 INSERT INTO iasdpi_pilot_private.profile_credentials(user_id) SELECT user_id FROM iasdpi_pilot.iasdpi_access ON CONFLICT DO NOTHING;
END $$;
-- Novos dados privados: sem acesso direto para clientes ou service_role.
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['profile_backups','profile_aliases','profile_credentials','profile_rate'] LOOP
 EXECUTE format('ALTER TABLE iasdpi_pilot_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE iasdpi_pilot_private.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON iasdpi_pilot_private.%I FROM public,anon,authenticated,service_role',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON iasdpi_pilot_private.%I TO iasdpi_pilot_executor',t);
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=('iasdpi_pilot_private.'||t)::regclass AND polname='profiles_executor') THEN
 EXECUTE format('CREATE POLICY profiles_executor ON iasdpi_pilot_private.%I FOR ALL TO iasdpi_pilot_executor USING(true) WITH CHECK(true)',t);
 EXECUTE format('CREATE POLICY profiles_operator ON iasdpi_pilot_private.%I FOR ALL TO postgres USING(true) WITH CHECK(true)',t);
 END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.profile_identity(p_allow_change boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_admin.uid();c iasdpi_pilot_private.profile_credentials;BEGIN
 IF u IS NULL OR iasdpi_pilot_admin.jwt()->>'role' IS DISTINCT FROM 'authenticated' OR coalesce(iasdpi_pilot_admin.jwt()->>'is_anonymous','false')='true'
 OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot_admin.auth_accounts WHERE id=u AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false))
 OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_access WHERE church_id=public.iasdpi_pilot_current_church_id() AND user_id=u AND enabled AND role IN('admin','membro','secretaria')) THEN
 RAISE EXCEPTION 'Acesso não autorizado.' USING errcode='42501';END IF;
 SELECT * INTO c FROM iasdpi_pilot_private.profile_credentials WHERE church_id=public.iasdpi_pilot_current_church_id() AND user_id=u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Acesso não configurado.' USING errcode='42501';END IF;
 IF coalesce((iasdpi_pilot_admin.jwt()->>'iat')::bigint,0)<coalesce(c.min_iat,0) THEN RAISE EXCEPTION 'Sessão expirada. Entre novamente.' USING errcode='42501';END IF;
 IF c.change_id IS NOT NULL THEN RAISE EXCEPTION 'Alteração de credencial em andamento.' USING errcode='42501';END IF;
 IF c.must_change AND NOT p_allow_change THEN RAISE EXCEPTION 'Altere a senha provisória.' USING errcode='42501';END IF;
 RETURN u;
END $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.actor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.profile_identity();BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador.' USING errcode='42501';END IF;RETURN u;END $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.profile_role(u uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT role FROM iasdpi_pilot.iasdpi_access WHERE church_id=public.iasdpi_pilot_current_church_id() AND user_id=u AND enabled $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.event_actor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.profile_identity();BEGIN
 IF iasdpi_pilot_private.profile_role(u) NOT IN('admin','secretaria') THEN RAISE EXCEPTION 'Sem gestão de eventos.' USING errcode='42501';END IF;RETURN u;END $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.can_view(u uuid,d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_pilot_private.is_admin(u) OR (iasdpi_pilot_private.profile_role(u) IN('membro','secretaria') AND EXISTS(
 SELECT 1 FROM iasdpi_pilot.schedule_department_access a JOIN iasdpi_pilot.schedule_departments dep ON dep.id=a.department_id AND dep.church_id=a.church_id
 WHERE a.church_id=public.iasdpi_pilot_current_church_id() AND a.user_id=u AND a.department_id=d AND a.enabled AND dep.active)) $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.can_manage(u uuid,d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_pilot_private.is_admin(u) $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.has_capability(u uuid,d uuid,cap text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_pilot_private.is_admin(u) AND cap IN('view','edit','publish','members') $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.event_can(u uuid,category text,department uuid,cap text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_pilot_private.is_admin(u) OR
 (iasdpi_pilot_private.profile_role(u)='secretaria' AND cap IN('view','edit','publish') AND ((category='church' AND department IS NULL) OR (category='department' AND iasdpi_pilot_private.can_view(u,department)))) $$;
-- Somente operações de eventos recebem o ator restrito. RPCs de escalas/cadastro continuam admin.
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 (n.nspname='public' AND p.proname IN('iasdpi_pilot_event_preview','iasdpi_pilot_event_submit','iasdpi_pilot_event_series_save','iasdpi_pilot_events_catalog'))
 OR (n.nspname='iasdpi_pilot_private' AND p.proname IN('event_store','event_save_021','events_catalog_021')) LOOP
 IF position('iasdpi_pilot_private.actor()' IN (SELECT prosrc FROM pg_proc WHERE oid=f.oid))>0 THEN
 EXECUTE replace(pg_get_functiondef(f.oid),'iasdpi_pilot_private.actor()','iasdpi_pilot_private.event_actor()');END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.events_catalog_021() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.event_actor();BEGIN
 RETURN jsonb_build_object('is_admin',iasdpi_pilot_private.is_admin(u),'can_submit_general',true,'can_manage_events',true,'can_approve_general',false,
 'departments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code,'can_edit',iasdpi_pilot_private.event_can(u,'department',id,'edit'),'can_publish',iasdpi_pilot_private.event_can(u,'department',id,'publish')) ORDER BY name) FROM iasdpi_pilot.schedule_departments WHERE active AND iasdpi_pilot_private.can_view(u,id)),'[]'),
 'events',coalesce((SELECT jsonb_agg((CASE WHEN iasdpi_pilot_private.is_admin(u) THEN to_jsonb(e) ELSE to_jsonb(e)-ARRAY['created_by','updated_by'] END)||jsonb_build_object('can_edit',true,'can_publish',true) ORDER BY date,title) FROM iasdpi_pilot.iasdpi_events e WHERE iasdpi_pilot_private.event_can(u,e.category,e.department_id,'view')),'[]'));
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_my_churches() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM iasdpi_pilot_private.profile_identity(true);
 RETURN (SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name)) FROM iasdpi_pilot.iasdpi_churches WHERE id=public.iasdpi_pilot_current_church_id());END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_portal_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.profile_identity(true);r text:=iasdpi_pilot_private.profile_role(u);pending boolean;BEGIN
 SELECT must_change INTO pending FROM iasdpi_pilot_private.profile_credentials WHERE user_id=u AND church_id=public.iasdpi_pilot_current_church_id();
 RETURN jsonb_build_object('profile_access',true,'actor_id',u,'role',r,'is_admin',r='admin','must_change_password',coalesce(pending,false),'published_only',r='membro','can_manage_events',r IN('admin','secretaria'),
 'departments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code,'active',active,'can_edit',r='admin','can_publish',r='admin','can_manage_members',r='admin') ORDER BY name) FROM iasdpi_pilot.schedule_departments WHERE active AND iasdpi_pilot_private.can_view(u,id)),'[]'));
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_schedule_visible(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.profile_identity();BEGIN
 RETURN coalesce((SELECT jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(r) WHERE key IN('id','date','department_id','department','person','role','event','starts_at','ends_at','startDate','endDate','kind','pending','vacancy_count','version','published_at','origin')))
 FROM jsonb_array_elements(iasdpi_pilot_private.published_before_privacy(p_month)||coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.source_key,'date',l.scheduled_on,'department_id',d.id,'department',d.name,'person',p.display_name,'role',NULL,'origin','Histórico manual confirmado')) FROM iasdpi_pilot.schedule_legacy_commitments l JOIN iasdpi_pilot.schedule_departments d ON d.id=l.department_id AND d.church_id=l.church_id JOIN iasdpi_pilot.schedule_people p ON p.id=l.person_id AND p.church_id=l.church_id WHERE l.church_id=public.iasdpi_pilot_current_church_id() AND l.scheduled_on>=p_month AND l.scheduled_on<(p_month+interval '1 month')::date),'[]')) r JOIN iasdpi_pilot.schedule_departments d ON d.id::text=r->>'department_id'
 WHERE d.church_id=public.iasdpi_pilot_current_church_id() AND (d.code='ancionato' OR iasdpi_pilot_private.can_view(u,d.id))),'[]');END $$;
-- Bloqueia remoção/rebaixamento/suspensão do último administrador, inclusive por SQL concorrente.
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.profile_admin_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM 1 FROM iasdpi_pilot_admin.control WHERE singleton FOR UPDATE;
 IF OLD.role='admin' AND OLD.enabled AND (TG_OP='DELETE' OR NOT NEW.enabled OR NEW.role<>'admin')
 AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_access WHERE church_id=OLD.church_id AND user_id<>OLD.user_id AND role='admin' AND enabled) THEN RAISE EXCEPTION 'Último administrador não pode ser removido.';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='iasdpi_pilot.iasdpi_access'::regclass AND tgname='profile_admin_guard') THEN
 CREATE TRIGGER profile_admin_guard BEFORE UPDATE OR DELETE ON iasdpi_pilot.iasdpi_access FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_private.profile_admin_guard();END IF;END $$;
-- Endpoint exclusivamente servidor: aliases e limites nunca são resolvidos pelo cliente.
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_alias_login_limit(p_keys text[]) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE k text;n integer;allowed boolean:=true;BEGIN
 IF cardinality(p_keys) NOT BETWEEN 1 AND 5 OR EXISTS(SELECT 1 FROM unnest(p_keys) x WHERE x!~'^(global|(church|alias|identity|ip):[a-f0-9]{64})$') THEN RAISE EXCEPTION 'Chave inválida.';END IF;
 DELETE FROM iasdpi_pilot_private.profile_rate WHERE key IN(SELECT key FROM iasdpi_pilot_private.profile_rate WHERE window_at<clock_timestamp()-interval '1 day' LIMIT 200);
 FOREACH k IN ARRAY p_keys LOOP
 INSERT INTO iasdpi_pilot_private.profile_rate VALUES(k,date_trunc('minute',clock_timestamp()),1)
 ON CONFLICT(key) DO UPDATE SET window_at=excluded.window_at,attempts=CASE WHEN profile_rate.window_at=excluded.window_at THEN profile_rate.attempts+1 ELSE 1 END RETURNING attempts INTO n;
 IF n>(CASE WHEN k='global' THEN 200 WHEN k LIKE 'church:%' THEN 100 WHEN k LIKE 'ip:%' THEN 20 ELSE 6 END) THEN RETURN false;END IF;
 END LOOP;RETURN allowed;END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_alias_login_lookup(p_identifier text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('alias_id',a.id,'user_id',a.user_id,'version',a.version,'email',u.email)
 FROM iasdpi_pilot_private.profile_aliases a JOIN iasdpi_pilot.iasdpi_access p ON p.user_id=a.user_id AND p.church_id=a.church_id AND p.role=a.identifier AND p.enabled
 JOIN iasdpi_pilot_admin.auth_accounts u ON u.id=a.user_id AND u.email_confirmed_at IS NOT NULL AND NOT coalesce(u.is_anonymous,false)
 WHERE a.church_id=public.iasdpi_pilot_current_church_id() AND a.identifier=p_identifier AND a.enabled $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_alias_login_confirm(p_alias_id uuid,p_version bigint,p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM iasdpi_pilot_private.profile_aliases a JOIN iasdpi_pilot.iasdpi_access p ON p.user_id=a.user_id AND p.church_id=a.church_id AND p.enabled AND p.role=a.identifier WHERE a.church_id=public.iasdpi_pilot_current_church_id() AND a.id=p_alias_id AND a.user_id=p_user_id AND a.enabled AND a.version=p_version) $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_password_begin(p_user uuid,p_iat bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE c iasdpi_pilot_private.profile_credentials;BEGIN
 PERFORM 1 FROM iasdpi_pilot_admin.control WHERE singleton FOR UPDATE;
 SELECT * INTO STRICT c FROM iasdpi_pilot_private.profile_credentials WHERE user_id=p_user AND church_id=public.iasdpi_pilot_current_church_id() FOR UPDATE;
 IF c.change_id IS NOT NULL OR p_iat<c.min_iat OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_access WHERE user_id=p_user AND enabled AND church_id=c.church_id) THEN RAISE EXCEPTION 'Sessão revogada.';END IF;
 UPDATE iasdpi_pilot_private.profile_credentials SET must_change=true,min_iat=ceil(extract(epoch FROM clock_timestamp()))::bigint,version=version+1,change_id=gen_random_uuid() WHERE user_id=p_user AND church_id=c.church_id RETURNING * INTO c;
 UPDATE iasdpi_pilot_private.profile_aliases SET version=version+1 WHERE user_id=p_user AND church_id=c.church_id;
 RETURN jsonb_build_object('change_id',c.change_id,'version',c.version);END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_password_complete(p_user uuid,p_change uuid,p_version bigint,p_require_change boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE iasdpi_pilot_private.profile_credentials SET must_change=p_require_change,change_id=NULL,version=version+1,min_iat=ceil(extract(epoch FROM clock_timestamp()))::bigint WHERE church_id=public.iasdpi_pilot_current_church_id() AND user_id=p_user AND change_id=p_change AND version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Operação alterada; manter troca obrigatória.';END IF;RETURN true;END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_password_abort(p_user uuid,p_change uuid,p_version bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE iasdpi_pilot_private.profile_credentials SET change_id=NULL,version=version+1 WHERE user_id=p_user AND church_id=public.iasdpi_pilot_current_church_id() AND change_id=p_change AND version=p_version;
 RETURN FOUND;END $$;
-- Recuperação supervisionada: bloqueia o perfil antes de trocar a credencial no Auth.
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.profile_reset_begin(p_identifier text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;c iasdpi_pilot_private.profile_credentials;BEGIN
 IF p_identifier NOT IN('membro','secretaria') THEN RAISE EXCEPTION 'Admin existente preservado; recuperação administrativa exige revisão separada.';END IF;
 PERFORM 1 FROM iasdpi_pilot_admin.control WHERE singleton FOR UPDATE;
 SELECT user_id INTO STRICT u FROM iasdpi_pilot_private.profile_aliases WHERE identifier=p_identifier AND church_id=public.iasdpi_pilot_current_church_id() AND enabled;
 UPDATE iasdpi_pilot_private.profile_credentials SET must_change=true,min_iat=ceil(extract(epoch FROM clock_timestamp()))::bigint,version=version+1,change_id=gen_random_uuid() WHERE user_id=u AND church_id=public.iasdpi_pilot_current_church_id() RETURNING * INTO STRICT c;
 UPDATE iasdpi_pilot_private.profile_aliases SET version=version+1 WHERE user_id=u AND church_id=c.church_id;
 RETURN jsonb_build_object('identifier',p_identifier,'user_id',u,'change_id',c.change_id,'version',c.version);END $$;
-- Helper privado de provisionamento: somente SQL Editor/operador, não uma RPC de gestão pública.
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.profile_enroll(p_user uuid,p_role text,p_departments uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE d uuid;BEGIN
 IF p_role NOT IN('membro','secretaria') OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot_admin.auth_accounts WHERE id=p_user AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false)) THEN RAISE EXCEPTION 'Identidade confirmada e perfil permitido necessários.';END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_access WHERE user_id=p_user) OR EXISTS(SELECT 1 FROM iasdpi_pilot_private.profile_aliases WHERE identifier=p_role) THEN RAISE EXCEPTION 'Identidade ou alias existente; não sobrescrever.';END IF;
 IF cardinality(p_departments)=0 OR p_departments IS NULL OR EXISTS(SELECT 1 FROM unnest(p_departments) x WHERE NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=x AND active AND church_id=public.iasdpi_pilot_current_church_id())) THEN RAISE EXCEPTION 'Departamentos autorizados explícitos necessários.';END IF;
 INSERT INTO iasdpi_pilot.iasdpi_access(user_id,role) VALUES(p_user,p_role);
 INSERT INTO iasdpi_pilot_private.profile_aliases(identifier,user_id) VALUES(p_role,p_user);
 INSERT INTO iasdpi_pilot_private.profile_credentials(user_id,must_change,min_iat) VALUES(p_user,true,ceil(extract(epoch FROM clock_timestamp()))::bigint);
 FOREACH d IN ARRAY p_departments LOOP INSERT INTO iasdpi_pilot.schedule_department_access(department_id,user_id,access_level) VALUES(d,p_user,'viewer');END LOOP;
END $$;
GRANT DELETE ON iasdpi_pilot_private.profile_rate TO iasdpi_pilot_executor;
-- Grants somente nos novos endpoints do servidor; nenhum aumento anônimo.
GRANT CREATE ON SCHEMA public,iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 (n.nspname='iasdpi_pilot_private' AND p.proname IN('profile_identity','profile_role','event_actor','profile_admin_guard','profile_enroll','profile_reset_begin')) OR
 (n.nspname='public' AND p.proname IN('iasdpi_pilot_alias_login_limit','iasdpi_pilot_alias_login_lookup','iasdpi_pilot_alias_login_confirm','iasdpi_pilot_password_begin','iasdpi_pilot_password_complete','iasdpi_pilot_password_abort')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);END IF;
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private FROM iasdpi_pilot_executor;
-- Publicação pública instalada permanece byte a byte igual.
DO $$ BEGIN IF pg_get_functiondef('public.iasdpi_pilot_schedule_published(date)'::regprocedure) IS DISTINCT FROM (SELECT definition FROM iasdpi_pilot_private.profile_backups WHERE key='public-function') THEN RAISE EXCEPTION 'Função pública mudou; rollback.';END IF;END $$;
SELECT iasdpi_pilot_admin.assert_core_unchanged();
NOTIFY pgrst,'reload schema';
COMMIT;
