-- IASDPI piloto ISOLADO. Não executar no Supabase sem autorização e recuperação revisada.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('public.iasdpi_programs') IS NULL OR to_regprocedure('public.iasdpi_list_trash(integer)') IS NULL THEN RAISE EXCEPTION 'Exige postgres, PostgreSQL 17 e núcleo 001–004 existente.';END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN('iasdpi_pilot','iasdpi_pilot_private','iasdpi_pilot_admin','iasdpi_pilot_operational'))
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'iasdpi\_pilot\_%' ESCAPE '\') THEN RAISE EXCEPTION 'Piloto já presente ou colisão de nomes. Não reaplicar.';END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN('iasdpi_schedule_private','iasdpi_governance_private'))
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (c.relname LIKE 'schedule\_%' ESCAPE '\' OR c.relname IN('iasdpi_events','iasdpi_churches')))
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'iasdpi\_schedule\_%' ESCAPE '\' OR p.proname LIKE 'iasdpi\_registry\_%' ESCAPE '\' OR p.proname LIKE 'iasdpi\_event%' ESCAPE '\')) THEN RAISE EXCEPTION 'Estruturas antigas de Escalas/Eventos já presentes. Conciliar antes; não criar base paralela.';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='iasdpi_pilot_executor') THEN CREATE ROLE iasdpi_pilot_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='iasdpi_pilot_executor' AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='iasdpi_pilot_executor'::regrole AND member<>'postgres'::regrole)
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='iasdpi_pilot_executor'::regrole) THEN RAISE EXCEPTION 'Papel executor isolado inseguro.';END IF;
END $$;
GRANT iasdpi_pilot_executor TO postgres;
CREATE SCHEMA iasdpi_pilot AUTHORIZATION postgres;
CREATE SCHEMA iasdpi_pilot_admin AUTHORIZATION postgres;
CREATE SCHEMA iasdpi_pilot_operational AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA iasdpi_pilot,iasdpi_pilot_admin,iasdpi_pilot_operational FROM public,anon,authenticated,service_role;
CREATE VIEW iasdpi_pilot_admin.auth_accounts WITH(security_barrier=true) AS SELECT id,email,email_confirmed_at,is_anonymous FROM auth.users;
REVOKE ALL ON iasdpi_pilot_admin.auth_accounts FROM public,anon,authenticated,service_role;
CREATE FUNCTION iasdpi_pilot_admin.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE FUNCTION iasdpi_pilot_admin.jwt() RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
CREATE TABLE iasdpi_pilot.iasdpi_access(user_id uuid PRIMARY KEY,role text NOT NULL DEFAULT 'admin' CHECK(role='admin'),enabled boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE iasdpi_pilot.iasdpi_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iasdpi_pilot.iasdpi_access FROM public,anon,authenticated,service_role;
CREATE TABLE iasdpi_pilot_admin.control(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),revision bigint NOT NULL DEFAULT 0);
INSERT INTO iasdpi_pilot_admin.control DEFAULT VALUES;
CREATE TABLE iasdpi_pilot_operational.receipts(request_id uuid PRIMARY KEY,actor_id uuid NOT NULL,signature text NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION iasdpi_pilot_operational.fingerprint(p jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT md5(p::text) $$;
CREATE TABLE iasdpi_pilot_admin.installation(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),step integer NOT NULL DEFAULT 0,core jsonb NOT NULL);
CREATE FUNCTION iasdpi_pilot_admin.core_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH expected(name) AS (VALUES ('public.iasdpi_access'),('public.iasdpi_templates'),('public.culto_archives'),('public.iasdpi_programs'),('public.iasdpi_activities'),('public.iasdpi_subactivities'),('iasdpi_admin_private.control'),('iasdpi_admin_private.invitations'),('iasdpi_admin_private.audit'),('iasdpi_operational_private.revisions'),('iasdpi_operational_private.receipts'),('iasdpi_operational_private.trash_audit'),('auth.users')), r AS (SELECT e.name,c.* FROM expected e LEFT JOIN pg_class c ON c.oid=to_regclass(e.name))
SELECT jsonb_build_object('relations',(SELECT jsonb_agg(jsonb_build_object('name',name,'oid',oid,'owner',relowner,'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity,'options',reloptions,
'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',a.atttypid,'typmod',a.atttypmod,'null',a.attnotnull,'acl',a.attacl,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
'constraints',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'name',conname,'definition',pg_get_constraintdef(c.oid,true)) ORDER BY conname) FROM pg_constraint c WHERE conrelid=r.oid),
'indexes',(SELECT jsonb_agg(jsonb_build_object('oid',indexrelid,'definition',pg_get_indexdef(indexrelid),'valid',indisvalid) ORDER BY indexrelid) FROM pg_index WHERE indrelid=r.oid),
'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE polrelid=r.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('oid',t.oid,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY t.oid) FROM pg_trigger t WHERE tgrelid=r.oid)) ORDER BY name) FROM r),
'functions',(SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'definition',pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=ANY(ARRAY['iasdpi_admin_private.lock_admin()','iasdpi_admin_private.require_admin()','iasdpi_operational_private.change_trash(p_id text, p_expected_version bigint, p_delete boolean, p_reason text, p_request_id uuid)','iasdpi_operational_private.fingerprint(p jsonb)','iasdpi_operational_private.preview_import_003(p_documents jsonb)','iasdpi_operational_private.project_program(p jsonb)','iasdpi_operational_private.require_access()','iasdpi_operational_private.save_program_003(p_id text, p_expected_version bigint, p_document jsonb, p_request_id uuid, p_import boolean)','public.iasdpi_accept_invite(p_token text)','public.iasdpi_create_invite(p_email text)','public.iasdpi_find_account(p_email text)','public.iasdpi_list_invites()','public.iasdpi_list_trash(p_offset integer)','public.iasdpi_list_users(p_offset integer)','public.iasdpi_preview_import(p_documents jsonb)','public.iasdpi_restore_program(p_id text, p_expected_version bigint, p_request_id uuid)','public.iasdpi_revoke_invite(p_id uuid)','public.iasdpi_save_program(p_id text, p_expected_version bigint, p_document jsonb, p_request_id uuid, p_import boolean)','public.iasdpi_save_template(p_id text, p_expected_version bigint, p_name text, p_plan jsonb)','public.iasdpi_set_access(p_user_id uuid, p_role text, p_enabled boolean)','public.iasdpi_trash_detail(p_id text)','public.iasdpi_trash_program(p_id text, p_expected_version bigint, p_request_id uuid, p_reason text)'])),
'schemas',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'owner',nspowner,'acl',nspacl) ORDER BY nspname) FROM pg_namespace WHERE nspname IN('public','auth','iasdpi_admin_private','iasdpi_operational_private')));
$$;
REVOKE ALL ON FUNCTION iasdpi_pilot_admin.core_snapshot() FROM public,anon,authenticated,service_role;
INSERT INTO iasdpi_pilot_admin.installation(core) VALUES(iasdpi_pilot_admin.core_snapshot());
DO $$ DECLARE b jsonb:=(SELECT core FROM iasdpi_pilot_admin.installation WHERE singleton);BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b->'relations') r WHERE r->>'oid' IS NULL) OR jsonb_array_length(b->'functions')<>22
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(b->'functions') f WHERE md5(f->>'definition')<>ALL(ARRAY['00ed5d2466d8b2b3b31ba55408feebdf','0b8b9352bac848243ce64a909f392fad','1334ff0523061662956f883a56f0a04d','2075ff9518bf5b3f981cfd60f7273b4d','29561f4c935cfb2ad3cfec086892769f','2d28a02a19dc8678528b231b92fd9d3e','3046f1263082c1449950659ca64b0e01','3e824ac7c7a068b0b1421dfa498dc00c','3ea1d7813aec632be27a2adad7267e44','3ff376939fbbca70ca7090bcb4cc8ba1','400db97c824d684053d446d8a9596e08','40e50fa9191a32f620fc8d6630679814','4480642944ef71693ee508bdaedc9828','48de24c745c6458a4b722bbc69ea0a29','4b42985e843c442fe7b7daba6ea4360d','698ce1ca9601dcf2af3e7bf3bd2e6309','6c5bbd44c0a363ce96347aff42de8cba','70530e0c9238c9c207e0f821093245c0','720894794493a5c6ff2874c11fb7f901','7243f436a350a0b7fa2ba883482be4d1','7489ac87bc3159850d807c4f6c6594f3','7a8b15d93b0a009e0d0489d8b333661d','7f220bd3493ef9acb60fb8c8c8889985','8e6b12dd26c7d2c0030a079e57bd0e9e','90204e4aa35c257175adb73272c46d57','980322ed2982b43d03e09818efb3a359','99f0e431d8301814397434677dc89196','a08de7e54bdd7ad4dbbd3c2487c6e92e','a60a2ceb0c2411234c8ba1b872a6c81b','a6a7ec4056136fda50ac3eb6d4c00948','a7c936b722753b7dddf173d8d4ecb6b3','b31cc90fcae9b1b88d14cca3dfe2b2cd','b32b0d15577daf92f26e76123c952e91','bedafc2c3c110ee2b55bb7757e383f71','d1d4805f9b69b5b69a09f44bacae194e','d40f01fa381423df6bc8a2891ddf0d81','d8bfb54eca63e24908302e5db7f81d16','d9c03e691fc144bd0ac3937b5cf6be26','dd0f8bd779666442fc213c7d2639bbf2','de5d975383f33c22f277dddadb3e6ca0','e0078ec53b91d1057dcec12c2564487e','ebd144420a2f10536227c60ffc7efd34','fdeae35d8d084b621c8c235a62558bea','feb8e18adf8a4cf7a8cbc204872e6bb2','ff261e3cf3f5a93b3b0a56dc1d4a4f53','fff68b045367750071ca3ef14751b430'])) THEN RAISE EXCEPTION 'Núcleo 001–004 divergente da base reconhecida; parar antes da instalação.';END IF;END $$;
CREATE FUNCTION iasdpi_pilot_admin.assert_core_unchanged() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF (SELECT core FROM iasdpi_pilot_admin.installation WHERE singleton) IS DISTINCT FROM iasdpi_pilot_admin.core_snapshot() THEN RAISE EXCEPTION 'Núcleo Cronoanálise/Auth mudou: cancelar etapa e investigar.';END IF;END $$;
REVOKE ALL ON FUNCTION iasdpi_pilot_admin.assert_core_unchanged() FROM public,anon,authenticated,service_role;

-- Regras reutilizadas de 005_schedule_foundation.sql
-- IASDPI: Fase A. Revisar antes de executar como postgres; não importa escalas.
DO $$ BEGIN
 IF current_user <> 'postgres' OR to_regclass('iasdpi_pilot_operational.receipts') IS NULL
 OR to_regprocedure('public.iasdpi_list_trash(integer)') IS NULL THEN
   RAISE EXCEPTION 'Execute 001–004 antes da 005, usando postgres.';
 END IF;
END $$;
CREATE SCHEMA iasdpi_pilot_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA iasdpi_pilot_private FROM public,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA iasdpi_pilot_private REVOKE EXECUTE ON FUNCTIONS FROM public;

CREATE FUNCTION iasdpi_pilot_private.normal_name(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT regexp_replace(translate(lower(btrim(value)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g');
$$;
CREATE TABLE iasdpi_pilot.schedule_departments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK(code ~ '^[a-z][a-z0-9-]{1,59}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 120),
 normalized_name text GENERATED ALWAYS AS (iasdpi_pilot_private.normal_name(name)) STORED UNIQUE, active boolean NOT NULL DEFAULT true,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE iasdpi_pilot.schedule_people (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 160),
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 2 AND 160),
 normalized_name text GENERATED ALWAYS AS (iasdpi_pilot_private.normal_name(name)) STORED,
 auth_user_id uuid UNIQUE,
 active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX schedule_people_name_idx ON iasdpi_pilot.schedule_people(normalized_name);
CREATE TABLE iasdpi_pilot.schedule_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_people(id),
 department_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_departments(id), active boolean NOT NULL DEFAULT true,
 is_ministry_head boolean NOT NULL DEFAULT false,
 desired_monthly_count integer CHECK(desired_monthly_count BETWEEN 0 AND 100),
 max_monthly_count integer CHECK(max_monthly_count BETWEEN 0 AND 100),
 max_consecutive integer CHECK(max_consecutive BETWEEN 1 AND 100),
 preferences text NOT NULL DEFAULT '' CHECK(length(preferences)<=2000),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(person_id,department_id), UNIQUE(id,department_id),
 CHECK(desired_monthly_count IS NULL OR max_monthly_count IS NULL OR desired_monthly_count<=max_monthly_count)
);
CREATE INDEX schedule_memberships_department_idx ON iasdpi_pilot.schedule_memberships(department_id,person_id);
CREATE TABLE iasdpi_pilot.schedule_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), department_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_departments(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 120),
 normalized_name text GENERATED ALWAYS AS (iasdpi_pilot_private.normal_name(name)) STORED,
 description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 default_required_count integer CHECK(default_required_count BETWEEN 0 AND 100),
 active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(department_id,normalized_name), UNIQUE(id,department_id)
);
CREATE TABLE iasdpi_pilot.schedule_qualifications (
 membership_id uuid NOT NULL, role_id uuid NOT NULL, department_id uuid NOT NULL,
 PRIMARY KEY(membership_id,role_id),
 FOREIGN KEY(membership_id,department_id) REFERENCES iasdpi_pilot.schedule_memberships(id,department_id),
 FOREIGN KEY(role_id,department_id) REFERENCES iasdpi_pilot.schedule_roles(id,department_id)
);
CREATE FUNCTION iasdpi_pilot_private.valid_weekdays(days smallint[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT cardinality(days) BETWEEN 1 AND 7 AND NOT EXISTS(SELECT 1 FROM unnest(days) d WHERE d IS NULL OR d<0 OR d>6)
 AND cardinality(days)=(SELECT count(DISTINCT d) FROM unnest(days) d);
$$;
CREATE TABLE iasdpi_pilot.schedule_availability (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_people(id),
 department_id uuid REFERENCES iasdpi_pilot.schedule_departments(id),
 kind text NOT NULL CHECK(kind IN ('available','unavailable')), pattern text NOT NULL CHECK(pattern IN ('period','weekly')),
 starts_on date, ends_on date, weekdays smallint[], valid_from date, valid_until date,
 start_time time(0), end_time time(0), active boolean NOT NULL DEFAULT true,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(person_id,department_id) REFERENCES iasdpi_pilot.schedule_memberships(person_id,department_id),
 CHECK((start_time IS NULL)=(end_time IS NULL)),
 CHECK((pattern='period' AND starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on>=starts_on AND weekdays IS NULL AND valid_from IS NULL AND valid_until IS NULL
        AND (start_time IS NULL OR (ends_on+end_time)>(starts_on+start_time)))
 OR (pattern='weekly' AND starts_on IS NULL AND ends_on IS NULL AND weekdays IS NOT NULL
     AND iasdpi_pilot_private.valid_weekdays(weekdays) AND (valid_until IS NULL OR valid_from IS NULL OR valid_until>=valid_from)
     AND (start_time IS NULL OR end_time>start_time)))
);
CREATE INDEX schedule_availability_person_idx ON iasdpi_pilot.schedule_availability(person_id,department_id);
CREATE TABLE iasdpi_pilot.schedule_department_access (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), department_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_departments(id),
 user_id uuid NOT NULL, access_level text NOT NULL CHECK(access_level IN ('manager','viewer')),
 enabled boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(department_id,user_id)
);
CREATE INDEX schedule_department_access_user_idx ON iasdpi_pilot.schedule_department_access(user_id,enabled);
CREATE TABLE iasdpi_pilot_private.person_details (
 person_id uuid PRIMARY KEY REFERENCES iasdpi_pilot.schedule_people(id),
 contact text NOT NULL DEFAULT '' CHECK(length(contact)<=1000), notes text NOT NULL DEFAULT '' CHECK(length(notes)<=4000)
);
CREATE TABLE iasdpi_pilot_private.audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL,
 entity text NOT NULL, entity_id uuid NOT NULL, department_id uuid REFERENCES iasdpi_pilot.schedule_departments(id),
 version bigint NOT NULL, changed_fields text[] NOT NULL, reason text,
 captured_at timestamptz NOT NULL DEFAULT now()
);
-- Nenhuma política permissiva: acesso somente pelas RPCs abaixo, verificando identidade e escopo.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_departments','schedule_people','schedule_memberships','schedule_roles','schedule_qualifications','schedule_availability','schedule_department_access'] LOOP
   EXECUTE format('ALTER TABLE iasdpi_pilot.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON iasdpi_pilot.%I FROM public,anon,authenticated',t);
 END LOOP;
END $$;
ALTER TABLE iasdpi_pilot_private.person_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE iasdpi_pilot_private.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA iasdpi_pilot_private FROM public,anon,authenticated;

CREATE FUNCTION iasdpi_pilot_private.actor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_pilot_admin.uid(); BEGIN
 IF u IS NULL OR iasdpi_pilot_admin.jwt()->>'is_anonymous'='true'
 OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot_admin.auth_accounts WHERE id=u AND email_confirmed_at IS NOT NULL AND NOT is_anonymous)
 OR EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_access WHERE user_id=u AND NOT enabled) THEN
   RAISE EXCEPTION 'Conta confirmada e acesso ativo necessários.' USING errcode='42501';
 END IF;
 RETURN u;
END $$;
CREATE FUNCTION iasdpi_pilot_private.is_admin(u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_access WHERE user_id=u AND enabled AND role='admin');
$$;
CREATE FUNCTION iasdpi_pilot_private.can_manage(u uuid,d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_pilot_private.is_admin(u) OR EXISTS(
 SELECT 1 FROM iasdpi_pilot.schedule_department_access a JOIN iasdpi_pilot.schedule_departments dep ON dep.id=a.department_id
 WHERE a.user_id=u AND a.department_id=d AND a.enabled AND a.access_level='manager' AND dep.active);
$$;
CREATE FUNCTION iasdpi_pilot_private.can_view(u uuid,d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_pilot_private.is_admin(u) OR EXISTS(
 SELECT 1 FROM iasdpi_pilot.schedule_department_access a JOIN iasdpi_pilot.schedule_departments dep ON dep.id=a.department_id
 WHERE a.user_id=u AND a.department_id=d AND a.enabled AND dep.active)
 OR EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people p JOIN iasdpi_pilot.schedule_memberships m ON m.person_id=p.id
 JOIN iasdpi_pilot.schedule_departments dep ON dep.id=m.department_id
 WHERE p.auth_user_id=u AND p.active AND m.active AND m.department_id=d AND dep.active);
$$;
CREATE FUNCTION iasdpi_pilot_private.can_see_person(u uuid,p uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_pilot_private.is_admin(u) OR EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people WHERE id=p AND auth_user_id=u AND active)
 OR EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships m JOIN iasdpi_pilot.schedule_department_access a ON a.department_id=m.department_id
 JOIN iasdpi_pilot.schedule_departments d ON d.id=a.department_id
 WHERE m.person_id=p AND a.user_id=u AND a.enabled AND d.active);
$$;
CREATE FUNCTION public.iasdpi_pilot_schedule_catalog() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_pilot_private.actor(); a boolean:=iasdpi_pilot_private.is_admin(u); result jsonb; BEGIN
 IF NOT a AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d WHERE iasdpi_pilot_private.can_view(u,d.id)) THEN
   RAISE EXCEPTION 'Solicite acesso a um departamento ao administrador.' USING errcode='42501';
 END IF;
 SELECT jsonb_build_object('actor_id',u,'is_admin',a,
 'departments',coalesce((SELECT jsonb_agg((to_jsonb(d)-'normalized_name')||jsonb_build_object('can_manage',iasdpi_pilot_private.can_manage(u,d.id),'can_roster',
 a OR EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_department_access acl WHERE acl.department_id=d.id AND acl.user_id=u AND acl.enabled)))
 FROM iasdpi_pilot.schedule_departments d WHERE iasdpi_pilot_private.can_view(u,d.id)),'[]'::jsonb),
 'people',coalesce((SELECT jsonb_agg(to_jsonb(p)-'normalized_name'-'auth_user_id') FROM iasdpi_pilot.schedule_people p WHERE iasdpi_pilot_private.can_see_person(u,p.id)),'[]'::jsonb),
 'memberships',coalesce((SELECT jsonb_agg(CASE WHEN iasdpi_pilot_private.can_manage(u,m.department_id) OR EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people p WHERE p.id=m.person_id AND p.auth_user_id=u AND p.active)
 THEN to_jsonb(m) ELSE to_jsonb(m)-'preferences'-'desired_monthly_count'-'max_monthly_count'-'max_consecutive' END)
 FROM iasdpi_pilot.schedule_memberships m WHERE iasdpi_pilot_private.can_view(u,m.department_id) AND iasdpi_pilot_private.can_see_person(u,m.person_id)),'[]'::jsonb),
 'roles',coalesce((SELECT jsonb_agg(to_jsonb(r)-'normalized_name') FROM iasdpi_pilot.schedule_roles r WHERE iasdpi_pilot_private.can_view(u,r.department_id)),'[]'::jsonb),
 'qualifications',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM iasdpi_pilot.schedule_qualifications q JOIN iasdpi_pilot.schedule_memberships m ON m.id=q.membership_id
 WHERE iasdpi_pilot_private.can_view(u,q.department_id) AND iasdpi_pilot_private.can_see_person(u,m.person_id)),'[]'::jsonb),
 'availability',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM iasdpi_pilot.schedule_availability v WHERE iasdpi_pilot_private.can_see_person(u,v.person_id) AND
 (a OR (v.department_id IS NOT NULL AND iasdpi_pilot_private.can_manage(u,v.department_id)) OR EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people p WHERE p.id=v.person_id AND p.auth_user_id=u AND p.active))), '[]'::jsonb),
 'access',CASE WHEN a THEN coalesce((SELECT jsonb_agg(to_jsonb(acl)) FROM iasdpi_pilot.schedule_department_access acl),'[]'::jsonb) ELSE '[]'::jsonb END) INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_person_details(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_pilot_private.actor(); BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador.' USING errcode='42501'; END IF;
 RETURN (SELECT jsonb_build_object('auth_user_id',p.auth_user_id,'contact',coalesce(d.contact,''),'notes',coalesce(d.notes,''))
 FROM iasdpi_pilot.schedule_people p LEFT JOIN iasdpi_pilot_private.person_details d ON d.person_id=p.id WHERE p.id=p_id);
END $$;

CREATE FUNCTION public.iasdpi_pilot_schedule_save(p_entity text,p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; admin boolean; tab text; permitted text[]; oldrow jsonb; patch jsonb:=p_data;
 d uuid; person uuid; columns text; values_sql text; assignments text; result jsonb; signature text;
 receipt iasdpi_pilot_operational.receipts; new_version bigint; roles jsonb; role_id uuid;
BEGIN
 u:=iasdpi_pilot_private.actor();
 -- Serializa mutações e revogações; REPEATABLE READ/SERIALIZABLE falha com 40001 em disputa.
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_pilot_private.actor(); admin:=iasdpi_pilot_private.is_admin(u);
 IF p_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR pg_column_size(p_data)>24000 THEN
   RAISE EXCEPTION 'Identificador, versão ou dados inválidos.' USING errcode='22023'; END IF;
 CASE p_entity
 WHEN 'department' THEN tab:='schedule_departments'; permitted:=ARRAY['code','name','active'];
 WHEN 'person' THEN tab:='schedule_people'; permitted:=ARRAY['name','display_name','auth_user_id','active','department_id','contact','notes','confirm_homonym','reason'];
 WHEN 'membership' THEN tab:='schedule_memberships'; permitted:=ARRAY['person_id','department_id','active','is_ministry_head','desired_monthly_count','max_monthly_count','max_consecutive','preferences','role_ids'];
 WHEN 'role' THEN tab:='schedule_roles'; permitted:=ARRAY['department_id','name','description','default_required_count','active'];
 WHEN 'availability' THEN tab:='schedule_availability'; permitted:=ARRAY['person_id','department_id','kind','pattern','starts_on','ends_on','weekdays','valid_from','valid_until','start_time','end_time','active'];
 WHEN 'access' THEN tab:='schedule_department_access'; permitted:=ARRAY['department_id','user_id','access_level','enabled'];
 ELSE RAISE EXCEPTION 'Cadastro desconhecido.' USING errcode='22023'; END CASE;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(permitted)) THEN RAISE EXCEPTION 'Campo não permitido.' USING errcode='22023'; END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM iasdpi_pilot.%I t WHERE id=$1 FOR UPDATE',tab) INTO oldrow USING p_id;
 IF p_entity IN ('department','access') AND NOT admin THEN RAISE EXCEPTION 'Somente administrador.' USING errcode='42501'; END IF;
 d:=CASE WHEN oldrow IS NOT NULL AND p_entity<>'person' THEN (oldrow->>'department_id')::uuid ELSE (p_data->>'department_id')::uuid END;
 IF oldrow IS NOT NULL AND ((p_data ? 'department_id' AND (p_data->>'department_id')::uuid IS DISTINCT FROM d)
 OR (p_data ? 'person_id' AND p_data->>'person_id' IS DISTINCT FROM oldrow->>'person_id')
 OR (p_data ? 'user_id' AND p_data->>'user_id' IS DISTINCT FROM oldrow->>'user_id')) THEN
   RAISE EXCEPTION 'O vínculo existente não pode ser transferido; inative-o e cadastre outro.' USING errcode='22023'; END IF;
 IF p_entity NOT IN ('department','access') AND NOT admin AND NOT iasdpi_pilot_private.can_manage(u,d) THEN
   RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 person:=coalesce((oldrow->>'person_id')::uuid,(p_data->>'person_id')::uuid);
 IF p_entity IN ('membership','availability') AND NOT admin AND NOT iasdpi_pilot_private.can_see_person(u,person) THEN
   RAISE EXCEPTION 'Pessoa fora do cadastro autorizado; solicite vínculo ao administrador.' USING errcode='42501'; END IF;
 IF p_entity='access' AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot_admin.auth_accounts WHERE id=(coalesce(oldrow,p_data)->>'user_id')::uuid AND email_confirmed_at IS NOT NULL AND NOT is_anonymous) THEN
   RAISE EXCEPTION 'A conta deve existir e ter e-mail confirmado.' USING errcode='22023'; END IF;
 IF p_entity='person' AND p_data->>'auth_user_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot_admin.auth_accounts WHERE id=(p_data->>'auth_user_id')::uuid AND email_confirmed_at IS NOT NULL AND NOT is_anonymous) THEN
   RAISE EXCEPTION 'Vincule somente uma conta existente e confirmada.' USING errcode='22023'; END IF;
 signature:='schedule-foundation:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('module','schedule-foundation','entity',p_entity,'id',p_id,'expected',p_expected_version,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN
   IF receipt.actor_id<>u OR receipt.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023'; END IF;
   RETURN receipt.response;
 END IF;
 IF p_entity='person' AND NOT admin AND (oldrow IS NOT NULL OR p_data ?| ARRAY['auth_user_id','contact','notes','confirm_homonym','reason']) THEN
   RAISE EXCEPTION 'Identidade e dados privados são administrados centralmente.' USING errcode='42501'; END IF;
 IF p_entity='person' AND oldrow IS NOT NULL AND p_data ? 'department_id' THEN RAISE EXCEPTION 'Altere departamentos pelo cadastro de vínculos.' USING errcode='22023'; END IF;
 IF (oldrow IS NULL AND p_expected_version<>0) OR (oldrow IS NOT NULL AND (oldrow->>'version')::bigint<>p_expected_version) THEN
   RAISE EXCEPTION 'Este cadastro mudou em outro dispositivo. Recarregue antes de reaplicar suas alterações.' USING errcode='40001'; END IF;
 IF p_entity='person' THEN
   IF (oldrow IS NULL OR (p_data ? 'name' AND p_data->>'name' IS DISTINCT FROM oldrow->>'name')) AND EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people WHERE id<>p_id AND normalized_name=iasdpi_pilot_private.normal_name(coalesce(p_data->>'name',oldrow->>'name')))
      AND NOT (admin AND coalesce((p_data->>'confirm_homonym')::boolean,false) AND length(btrim(p_data->>'reason'))>=10) THEN
     RAISE EXCEPTION 'Já existe um nome igual. Reutilize o cadastro ou peça ao administrador para confirmar um homônimo com justificativa.' USING errcode='23514'; END IF;
   IF p_data ? 'contact' OR p_data ? 'notes' THEN
     INSERT INTO iasdpi_pilot_private.person_details(person_id,contact,notes)
       SELECT p_id,'','' WHERE oldrow IS NOT NULL ON CONFLICT DO NOTHING;
     -- Para criação, inserir detalhes após a identidade.
   END IF;
   patch:=patch-ARRAY['department_id','contact','notes','confirm_homonym','reason'];
 END IF;
 IF p_entity='membership' AND p_data ? 'role_ids' THEN
   roles:=p_data->'role_ids'; patch:=patch-'role_ids';
   IF jsonb_typeof(roles) IS DISTINCT FROM 'array' OR jsonb_array_length(roles)>100 THEN RAISE EXCEPTION 'Habilitações inválidas.' USING errcode='22023'; END IF;
 END IF;
 new_version:=coalesce((oldrow->>'version')::bigint,0)+1;
 patch:=patch||jsonb_build_object('id',p_id,'version',new_version,'updated_at',now());
 SELECT string_agg(format('%I',k),','),string_agg(format('p.%I',k),','),string_agg(format('%I=p.%I',k,k),',')
 INTO columns,values_sql,assignments FROM jsonb_object_keys(patch) k;
 IF oldrow IS NULL THEN
   EXECUTE format('INSERT INTO iasdpi_pilot.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::iasdpi_pilot.%I,$1) p RETURNING to_jsonb(%I.*)',tab,columns,values_sql,tab,tab) INTO result USING patch;
 ELSE
   EXECUTE format('UPDATE iasdpi_pilot.%I t SET %s FROM jsonb_populate_record(NULL::iasdpi_pilot.%I,$1) p WHERE t.id=$2 RETURNING to_jsonb(t.*)',tab,assignments,tab) INTO result USING oldrow||patch,p_id;
 END IF;
 IF p_entity='person' THEN
   IF p_data ? 'contact' OR p_data ? 'notes' THEN
     INSERT INTO iasdpi_pilot_private.person_details(person_id,contact,notes) VALUES(p_id,coalesce(p_data->>'contact',''),coalesce(p_data->>'notes',''))
     ON CONFLICT(person_id) DO UPDATE SET contact=CASE WHEN p_data ? 'contact' THEN coalesce(p_data->>'contact','') ELSE person_details.contact END,
       notes=CASE WHEN p_data ? 'notes' THEN coalesce(p_data->>'notes','') ELSE person_details.notes END;
   END IF;
   IF oldrow IS NULL AND d IS NOT NULL THEN
     INSERT INTO iasdpi_pilot.schedule_memberships(person_id,department_id) VALUES(p_id,d);
   END IF;
 END IF;
 IF roles IS NOT NULL THEN
   DELETE FROM iasdpi_pilot.schedule_qualifications WHERE membership_id=p_id;
   FOR role_id IN SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(roles) LOOP
     INSERT INTO iasdpi_pilot.schedule_qualifications(membership_id,department_id,role_id) VALUES(p_id,d,role_id);
   END LOOP;
 END IF;
 result:=result-ARRAY['normalized_name','auth_user_id'];
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields,reason)
 VALUES(u,p_entity,p_id,d,new_version,ARRAY(SELECT jsonb_object_keys(p_data)),CASE WHEN p_entity='person' THEN p_data->>'reason' END);
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,signature,result,now());
 RETURN result;
END $$;
-- Somente departamentos: nomes no organograma NÃO são contas nem concedem acesso.
INSERT INTO iasdpi_pilot.schedule_departments(id,code,name) VALUES
 ('a0000000-0000-4000-8000-000000000001','sonoplastia','Sonoplastia'),
 ('a0000000-0000-4000-8000-000000000002','diaconato','Diaconato'),
 ('a0000000-0000-4000-8000-000000000003','musica','Música'),
 ('a0000000-0000-4000-8000-000000000004','ancionato','Ancionato');
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iasdpi_pilot_private FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_schedule_catalog(),public.iasdpi_pilot_schedule_person_details(uuid),public.iasdpi_pilot_schedule_save(text,uuid,bigint,jsonb,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_catalog(),public.iasdpi_pilot_schedule_person_details(uuid),public.iasdpi_pilot_schedule_save(text,uuid,bigint,jsonb,uuid) TO authenticated;

-- Regras reutilizadas de 006_schedule_management.sql
-- IASDPI — B1. Revisar e executar somente após 001–005, como postgres.
-- Não importa nem altera pessoas, fontes legadas, cultos ou agenda oficial.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_pilot_schedule_catalog()') IS NULL THEN
  RAISE EXCEPTION 'Execute 001–005 antes da 006, usando postgres.';
 END IF;
END $$;

CREATE TABLE iasdpi_pilot.schedule_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160),
 normalized_title text GENERATED ALWAYS AS (iasdpi_pilot_private.normal_name(title)) STORED,
 scheduled_on date NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 source text, source_key text, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at AND ends_at<=starts_at+interval '7 days'),
 CHECK(scheduled_on=(starts_at AT TIME ZONE 'America/Sao_Paulo')::date),
 CHECK((source IS NULL AND source_key IS NULL) OR (source IS NOT NULL AND source_key IS NOT NULL AND length(btrim(source)) BETWEEN 1 AND 100 AND length(btrim(source_key)) BETWEEN 1 AND 300)),
 UNIQUE(normalized_title,starts_at), UNIQUE(source,source_key)
);
CREATE INDEX schedule_events_month_idx ON iasdpi_pilot.schedule_events(scheduled_on);
CREATE TABLE iasdpi_pilot.schedule_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), department_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_departments(id),
 month date NOT NULL CHECK(extract(day FROM month)=1), title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')), version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL, updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(department_id,month), UNIQUE(id,department_id)
);
CREATE TABLE iasdpi_pilot.schedule_requirements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL, department_id uuid NOT NULL,
 event_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_events(id), role_id uuid NOT NULL,
 required_count integer NOT NULL CHECK(required_count BETWEEN 1 AND 100), notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 FOREIGN KEY(plan_id,department_id) REFERENCES iasdpi_pilot.schedule_plans(id,department_id),
 FOREIGN KEY(role_id,department_id) REFERENCES iasdpi_pilot.schedule_roles(id,department_id),
 UNIQUE(plan_id,event_id,role_id), UNIQUE(id,plan_id,department_id)
);
CREATE INDEX schedule_requirements_event_idx ON iasdpi_pilot.schedule_requirements(event_id);
CREATE TABLE iasdpi_pilot.schedule_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid NOT NULL, plan_id uuid NOT NULL, department_id uuid NOT NULL,
 person_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_people(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 FOREIGN KEY(requirement_id,plan_id,department_id) REFERENCES iasdpi_pilot.schedule_requirements(id,plan_id,department_id),
 CHECK(ends_at>starts_at), UNIQUE(requirement_id,person_id)
);
CREATE INDEX schedule_assignments_person_idx ON iasdpi_pilot.schedule_assignments(person_id,starts_at,ends_at);
CREATE INDEX schedule_assignments_plan_idx ON iasdpi_pilot.schedule_assignments(plan_id);
CREATE TABLE iasdpi_pilot.schedule_versions (
 plan_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_plans(id), version bigint NOT NULL,
 actor_id uuid NOT NULL, captured_at timestamptz NOT NULL DEFAULT now(), snapshot jsonb NOT NULL,
 PRIMARY KEY(plan_id,version)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_events','schedule_plans','schedule_requirements','schedule_assignments','schedule_versions'] LOOP
  EXECUTE format('ALTER TABLE iasdpi_pilot.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON iasdpi_pilot.%I FROM public,anon,authenticated',t);
 END LOOP;
END $$;

CREATE FUNCTION iasdpi_pilot_private.plan_snapshot(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT to_jsonb(p)||jsonb_build_object('requirements',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object(
 'assignments',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM iasdpi_pilot.schedule_assignments a WHERE a.requirement_id=r.id),'[]'::jsonb)) ORDER BY r.id)
 FROM iasdpi_pilot.schedule_requirements r WHERE r.plan_id=p.id),'[]'::jsonb)) FROM iasdpi_pilot.schedule_plans p WHERE p.id=p_id;
$$;

-- Serviço único de validação, chamado pela gravação e por gatilhos de integridade.
-- Na B1 funções distintas são exclusivas por padrão: não há exceção implícita.
CREATE FUNCTION iasdpi_pilot_private.validate_assignment(a iasdpi_pilot.schedule_assignments) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r iasdpi_pilot.schedule_requirements; e iasdpi_pilot.schedule_events; BEGIN
 SELECT * INTO STRICT r FROM iasdpi_pilot.schedule_requirements WHERE id=a.requirement_id;
 SELECT * INTO STRICT e FROM iasdpi_pilot.schedule_events WHERE id=r.event_id;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people p JOIN iasdpi_pilot.schedule_memberships m ON m.person_id=p.id
 JOIN iasdpi_pilot.schedule_qualifications q ON q.membership_id=m.id JOIN iasdpi_pilot.schedule_roles role ON role.id=q.role_id
 JOIN iasdpi_pilot.schedule_departments d ON d.id=m.department_id
 WHERE p.id=a.person_id AND p.active AND m.active AND d.active AND role.active AND m.department_id=r.department_id AND q.role_id=r.role_id) THEN
  RAISE EXCEPTION 'Voluntário sem habilitação ativa para esta função e departamento.' USING errcode='23514'; END IF;
 IF a.starts_at<e.starts_at OR a.ends_at>e.ends_at OR a.ends_at<=a.starts_at THEN
  RAISE EXCEPTION 'A participação deve estar dentro do horário do evento.' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_assignments other WHERE other.person_id=a.person_id AND other.id<>a.id
 AND tstzrange(other.starts_at,other.ends_at,'[)') && tstzrange(a.starts_at,a.ends_at,'[)')) THEN
  RAISE EXCEPTION 'Conflito: voluntário já escalado em horário sobreposto, inclusive em outro departamento.' USING errcode='23P01'; END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_availability v WHERE v.person_id=a.person_id AND v.active AND v.kind='unavailable'
 AND (v.department_id IS NULL OR v.department_id=r.department_id) AND (
 (v.pattern='period' AND tstzrange((v.starts_on+coalesce(v.start_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo',
 ((CASE WHEN v.end_time IS NULL THEN v.ends_on+1 ELSE v.ends_on END)+coalesce(v.end_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo','[)') && tstzrange(a.starts_at,a.ends_at,'[)'))
 OR (v.pattern='weekly' AND EXISTS(SELECT 1 FROM generate_series((a.starts_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,
 (a.ends_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,interval '1 day') AS days(day)
 WHERE extract(dow FROM day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR day::date>=v.valid_from) AND (v.valid_until IS NULL OR day::date<=v.valid_until)
 AND tstzrange((day::date+coalesce(v.start_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo',
 ((CASE WHEN v.end_time IS NULL THEN day::date+1 ELSE day::date END)+coalesce(v.end_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo','[)') && tstzrange(a.starts_at,a.ends_at,'[)'))))) THEN
  RAISE EXCEPTION 'Conflito: voluntário indisponível no período informado.' USING errcode='23514'; END IF;
END $$;
CREATE FUNCTION iasdpi_pilot_private.assignment_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 PERFORM iasdpi_pilot_private.validate_assignment(NEW); RETURN NEW;
END $$;
CREATE TRIGGER schedule_assignment_guard BEFORE INSERT OR UPDATE ON iasdpi_pilot.schedule_assignments
 FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_private.assignment_guard();

-- A alteração posterior de disponibilidade/habilitação também não pode invalidar uma escala.
-- Diferido para permitir que a RPC 005 substitua o conjunto de habilitações atomicamente.
CREATE FUNCTION iasdpi_pilot_private.revalidate_plans() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a iasdpi_pilot.schedule_assignments; BEGIN
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 FOR a IN SELECT * FROM iasdpi_pilot.schedule_assignments LOOP PERFORM iasdpi_pilot_private.validate_assignment(a); END LOOP;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_people','schedule_memberships','schedule_roles','schedule_qualifications','schedule_availability','schedule_departments'] LOOP
  EXECUTE format('CREATE CONSTRAINT TRIGGER schedule_b1_revalidate AFTER INSERT OR UPDATE OR DELETE ON iasdpi_pilot.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_private.revalidate_plans()',t);
 END LOOP;
END $$;

CREATE FUNCTION public.iasdpi_pilot_schedule_workspace(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_pilot_private.actor(); BEGIN
 IF NOT iasdpi_pilot_private.can_view(u,p_department) OR NOT (iasdpi_pilot_private.is_admin(u) OR EXISTS(
 SELECT 1 FROM iasdpi_pilot.schedule_department_access WHERE user_id=u AND department_id=p_department AND enabled)) THEN
  RAISE EXCEPTION 'Sem consulta de escalas deste departamento.' USING errcode='42501'; END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 THEN RAISE EXCEPTION 'Informe o primeiro dia do mês.' USING errcode='22023'; END IF;
 RETURN jsonb_build_object('plan',(SELECT iasdpi_pilot_private.plan_snapshot(id) FROM iasdpi_pilot.schedule_plans WHERE department_id=p_department AND month=p_month),
 'events',coalesce((SELECT jsonb_agg(to_jsonb(e)-'normalized_title' ORDER BY starts_at,id) FROM iasdpi_pilot.schedule_events e WHERE scheduled_on>=p_month AND scheduled_on<(p_month+interval '1 month')::date),'[]'::jsonb),
 'versions',coalesce((SELECT jsonb_agg(jsonb_build_object('version',v.version,'actor_id',v.actor_id,'captured_at',v.captured_at) ORDER BY v.version DESC)
 FROM iasdpi_pilot.schedule_versions v JOIN iasdpi_pilot.schedule_plans p ON p.id=v.plan_id WHERE p.department_id=p_department AND p.month=p_month),'[]'::jsonb));
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_plan_version(p_id uuid,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_pilot_private.actor(); d uuid; BEGIN
 SELECT department_id INTO d FROM iasdpi_pilot.schedule_plans WHERE id=p_id;
 -- Reutiliza exatamente a verificação de consulta do workspace, sem devolver outros departamentos.
 PERFORM public.iasdpi_pilot_schedule_workspace(d,(SELECT month FROM iasdpi_pilot.schedule_plans WHERE id=p_id));
 RETURN (SELECT snapshot FROM iasdpi_pilot.schedule_versions WHERE plan_id=p_id AND version=p_version);
END $$;

-- Eventos compartilhados são imutáveis nesta fase. Repetir título+início ou origem reutiliza o UUID.
CREATE FUNCTION public.iasdpi_pilot_schedule_event_create(p_id uuid,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; d uuid; day date; finish_day date; first_at timestamptz; last_at timestamptz; old iasdpi_pilot.schedule_events;
 signature text; receipt iasdpi_pilot_operational.receipts; result jsonb;
BEGIN
 u:=iasdpi_pilot_private.actor(); UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton; u:=iasdpi_pilot_private.actor();
 d:=(p_data->>'department_id')::uuid;
 IF NOT iasdpi_pilot_private.can_manage(u,d) OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=d AND active) THEN
  RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 IF p_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR pg_column_size(p_data)>8000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['department_id','title','date','end_date','start_time','end_time','source','source_key']))
 OR coalesce(p_data->>'start_time','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(p_data->>'end_time','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
  RAISE EXCEPTION 'Evento inválido. Informe título, data e horários HH:mm.' USING errcode='22023'; END IF;
 IF ((p_data->>'source') IS NULL)<>((p_data->>'source_key') IS NULL)
 OR (p_data->>'source' IS NOT NULL AND (length(btrim(p_data->>'source')) NOT BETWEEN 1 AND 100 OR length(btrim(p_data->>'source_key')) NOT BETWEEN 1 AND 300)) THEN
  RAISE EXCEPTION 'Informe origem e identificador externo juntos, ou deixe ambos vazios.' USING errcode='22023'; END IF;
 day:=(p_data->>'date')::date; finish_day:=coalesce((p_data->>'end_date')::date,day);
 first_at:=(day+(p_data->>'start_time')::time) AT TIME ZONE 'America/Sao_Paulo';
 last_at:=(finish_day+(p_data->>'end_time')::time) AT TIME ZONE 'America/Sao_Paulo';
 IF day IS NULL OR last_at<=first_at THEN RAISE EXCEPTION 'Informe um término posterior ao início (e data final em eventos noturnos).' USING errcode='22023'; END IF;
 signature:='schedule-b1-event:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('id',p_id,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_id<>u OR receipt.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023'; END IF;
  RETURN receipt.response;
 END IF;
 SELECT * INTO old FROM iasdpi_pilot.schedule_events WHERE id=p_id OR (normalized_title=iasdpi_pilot_private.normal_name(p_data->>'title') AND starts_at=first_at)
 OR (source=p_data->>'source' AND source_key=p_data->>'source_key') ORDER BY id LIMIT 1;
 IF FOUND THEN
  IF p_data->>'source' IS NOT NULL AND (old.source IS DISTINCT FROM p_data->>'source' OR old.source_key IS DISTINCT FROM p_data->>'source_key') THEN
   RAISE EXCEPTION 'Já existe evento equivalente com outra referência. Revise a identidade; nenhuma associação foi feita automaticamente.' USING errcode='23505'; END IF;
  IF old.starts_at<>first_at OR old.ends_at<>last_at OR old.normalized_title<>iasdpi_pilot_private.normal_name(p_data->>'title') OR old.scheduled_on<>day THEN
   RAISE EXCEPTION 'Já existe um evento com esta identidade e horários diferentes. Reutilize o evento existente; nada foi sobrescrito.' USING errcode='23505'; END IF;
  result:=to_jsonb(old)-'normalized_title';
 ELSE
  INSERT INTO iasdpi_pilot.schedule_events(id,title,scheduled_on,starts_at,ends_at,source,source_key,created_by)
  VALUES(p_id,p_data->>'title',day,first_at,last_at,p_data->>'source',p_data->>'source_key',u) RETURNING to_jsonb(schedule_events.*)-'normalized_title' INTO result;
  INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields) VALUES(u,'b1-event',p_id,d,1,ARRAY['create']);
 END IF;
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,signature,result,now()); RETURN result;
END $$;

CREATE FUNCTION public.iasdpi_pilot_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; old iasdpi_pilot.schedule_plans; d uuid; mon date; next_status text; signature text; result jsonb;
 receipt iasdpi_pilot_operational.receipts; req jsonb; item jsonb; r iasdpi_pilot.schedule_requirements; e iasdpi_pilot.schedule_events; n bigint;
BEGIN
 u:=iasdpi_pilot_private.actor(); UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton; u:=iasdpi_pilot_private.actor();
 IF p_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR pg_column_size(p_data)>1000000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['department_id','month','title','status','requirements'])) THEN
  RAISE EXCEPTION 'Plano, versão ou campos inválidos.' USING errcode='22023'; END IF;
 SELECT * INTO old FROM iasdpi_pilot.schedule_plans WHERE id=p_id FOR UPDATE;
 d:=coalesce(old.department_id,(p_data->>'department_id')::uuid); mon:=coalesce(old.month,(p_data->>'month')::date);
 IF NOT iasdpi_pilot_private.can_manage(u,d) OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=d AND active) THEN
  RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 IF mon IS NULL OR extract(day FROM mon)<>1 OR (p_data ? 'department_id' AND (p_data->>'department_id')::uuid IS DISTINCT FROM d)
 OR (p_data ? 'month' AND (p_data->>'month')::date IS DISTINCT FROM mon) THEN RAISE EXCEPTION 'Departamento e mês são obrigatórios e não podem ser transferidos.' USING errcode='22023'; END IF;
 signature:='schedule-b1-plan:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('id',p_id,'expected',p_expected_version,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_id<>u OR receipt.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023'; END IF;
  RETURN receipt.response;
 END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Esta escala mudou em outro dispositivo. Seus campos devem ser preservados; recarregue e compare antes de reaplicar.' USING errcode='40001'; END IF;
 next_status:=coalesce(p_data->>'status',old.status,'draft'); n:=coalesce(old.version,0)+1;
 IF old.id IS NULL THEN
  IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_plans WHERE department_id=d AND month=mon) THEN RAISE EXCEPTION 'Já existe uma escala deste departamento e mês. Abra a existente.' USING errcode='23505'; END IF;
  INSERT INTO iasdpi_pilot.schedule_plans(id,department_id,month,title,status,version,created_by,updated_by)
  VALUES(p_id,d,mon,coalesce(p_data->>'title','Escala mensal'),next_status,n,u,u);
 ELSE UPDATE iasdpi_pilot.schedule_plans SET title=coalesce(p_data->>'title',title),status=next_status,version=n,updated_by=u,updated_at=now() WHERE id=p_id; END IF;
 IF p_data ? 'requirements' THEN
  IF jsonb_typeof(p_data->'requirements') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'requirements')>500 THEN RAISE EXCEPTION 'Lista de funções inválida ou excessiva.' USING errcode='22023'; END IF;
  -- O conjunto completo é substituído atomicamente. Campo ausente mantém os dados existentes.
  DELETE FROM iasdpi_pilot.schedule_assignments WHERE plan_id=p_id;
  DELETE FROM iasdpi_pilot.schedule_requirements WHERE plan_id=p_id;
  FOR req IN SELECT value FROM jsonb_array_elements(p_data->'requirements') LOOP
   IF jsonb_typeof(req) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(req) k WHERE NOT k=ANY(ARRAY['id','event_id','role_id','required_count','notes','assignments'])) THEN RAISE EXCEPTION 'Função necessária inválida.' USING errcode='22023'; END IF;
   SELECT * INTO e FROM iasdpi_pilot.schedule_events WHERE id=(req->>'event_id')::uuid;
   IF e.id IS NULL OR e.scheduled_on<mon OR e.scheduled_on>=(mon+interval '1 month')::date OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_roles WHERE id=(req->>'role_id')::uuid AND department_id=d AND active) THEN
    RAISE EXCEPTION 'Evento fora do mês ou função inativa/de outro departamento.' USING errcode='23514'; END IF;
   INSERT INTO iasdpi_pilot.schedule_requirements(id,plan_id,department_id,event_id,role_id,required_count,notes)
   VALUES((req->>'id')::uuid,p_id,d,e.id,(req->>'role_id')::uuid,(req->>'required_count')::integer,coalesce(req->>'notes','')) RETURNING * INTO r;
   IF jsonb_typeof(req->'assignments') IS DISTINCT FROM 'array' OR jsonb_array_length(req->'assignments')>r.required_count THEN RAISE EXCEPTION 'Lista de voluntários inválida ou maior que as vagas.' USING errcode='23514'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(req->'assignments') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE NOT k=ANY(ARRAY['id','person_id','starts_at','ends_at'])) THEN RAISE EXCEPTION 'Atribuição inválida.' USING errcode='22023'; END IF;
    INSERT INTO iasdpi_pilot.schedule_assignments(id,requirement_id,plan_id,department_id,person_id,starts_at,ends_at)
    VALUES((item->>'id')::uuid,r.id,p_id,d,(item->>'person_id')::uuid,coalesce((item->>'starts_at')::timestamptz,e.starts_at),coalesce((item->>'ends_at')::timestamptz,e.ends_at));
   END LOOP;
  END LOOP;
 END IF;
 IF next_status='published' AND (NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_requirements WHERE plan_id=p_id) OR EXISTS(
 SELECT 1 FROM iasdpi_pilot.schedule_requirements coverage WHERE coverage.plan_id=p_id AND (SELECT count(*) FROM iasdpi_pilot.schedule_assignments assigned WHERE assigned.requirement_id=coverage.id)<coverage.required_count)) THEN
  RAISE EXCEPTION 'Publicação bloqueada: existem funções sem voluntários suficientes.' USING errcode='23514'; END IF;
 result:=iasdpi_pilot_private.plan_snapshot(p_id);
 INSERT INTO iasdpi_pilot.schedule_versions(plan_id,version,actor_id,snapshot) VALUES(p_id,n,u,result);
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields) VALUES(u,'b1-plan',p_id,d,n,ARRAY(SELECT jsonb_object_keys(p_data)));
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,signature,result,now()); RETURN result;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iasdpi_pilot_private FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_schedule_workspace(uuid,date),public.iasdpi_pilot_schedule_plan_version(uuid,bigint),
 public.iasdpi_pilot_schedule_event_create(uuid,jsonb,uuid),public.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_workspace(uuid,date),public.iasdpi_pilot_schedule_plan_version(uuid,bigint),
 public.iasdpi_pilot_schedule_event_create(uuid,jsonb,uuid),public.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid) TO authenticated;

-- Regras reutilizadas de 007_daily_schedules.sql
-- B1.1: revisão obrigatória. Executar somente após 001–006, como postgres.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid)') IS NULL THEN RAISE EXCEPTION 'Execute 001–006 primeiro, como postgres.'; END IF;
 END $$;
ALTER TABLE iasdpi_pilot.schedule_events ADD COLUMN timing_mode text NOT NULL DEFAULT 'timed' CHECK(timing_mode IN ('day','timed'));
ALTER TABLE iasdpi_pilot.schedule_events ALTER COLUMN starts_at DROP NOT NULL,ALTER COLUMN ends_at DROP NOT NULL;
ALTER TABLE iasdpi_pilot.schedule_events ADD CONSTRAINT schedule_event_mode CHECK((timing_mode='day' AND starts_at IS NULL AND ends_at IS NULL) OR (timing_mode='timed' AND starts_at IS NOT NULL AND ends_at IS NOT NULL));
CREATE UNIQUE INDEX schedule_day_event_unique ON iasdpi_pilot.schedule_events(normalized_title,scheduled_on) WHERE timing_mode='day';
ALTER TABLE iasdpi_pilot.schedule_assignments ADD COLUMN timing_mode text NOT NULL DEFAULT 'timed' CHECK(timing_mode IN ('day','timed')),ADD COLUMN assigned_on date;
-- Somente a data derivada é preenchida. Timestamps e precisão existentes não mudam.
ALTER TABLE iasdpi_pilot.schedule_assignments DISABLE TRIGGER schedule_assignment_guard;
UPDATE iasdpi_pilot.schedule_assignments SET assigned_on=(starts_at AT TIME ZONE 'America/Sao_Paulo')::date;
ALTER TABLE iasdpi_pilot.schedule_assignments ENABLE TRIGGER schedule_assignment_guard;
ALTER TABLE iasdpi_pilot.schedule_assignments ALTER COLUMN assigned_on SET NOT NULL,ALTER COLUMN starts_at DROP NOT NULL,ALTER COLUMN ends_at DROP NOT NULL;
ALTER TABLE iasdpi_pilot.schedule_assignments ADD CONSTRAINT schedule_assignment_mode CHECK((timing_mode='day' AND starts_at IS NULL AND ends_at IS NULL) OR (timing_mode='timed' AND starts_at IS NOT NULL AND ends_at IS NOT NULL));
CREATE INDEX schedule_assignment_day_idx ON iasdpi_pilot.schedule_assignments(person_id,assigned_on,department_id);
ALTER TABLE iasdpi_pilot.schedule_people ADD COLUMN max_monthly_count integer CHECK(max_monthly_count BETWEEN 0 AND 100);
ALTER TABLE iasdpi_pilot.schedule_availability ADD COLUMN origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','daily-profile'));

CREATE TABLE iasdpi_pilot.schedule_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),planning_months integer NOT NULL DEFAULT 2 CHECK(planning_months IN (1,2,3,6)),
 weekdays smallint[] NOT NULL DEFAULT ARRAY[3,6,0]::smallint[] CHECK(cardinality(weekdays)=0 OR iasdpi_pilot_private.valid_weekdays(weekdays)),
 extra_dates date[] NOT NULL DEFAULT '{}',version bigint NOT NULL DEFAULT 1,updated_by uuid,updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO iasdpi_pilot.schedule_settings(singleton) VALUES(true);
CREATE TABLE iasdpi_pilot.schedule_day_exceptions (
 id uuid PRIMARY KEY,person_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_people(id),day date NOT NULL,
 department_a uuid NOT NULL REFERENCES iasdpi_pilot.schedule_departments(id),department_b uuid NOT NULL REFERENCES iasdpi_pilot.schedule_departments(id),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),enabled boolean NOT NULL DEFAULT true,
 approved_by uuid NOT NULL,approved_at timestamptz NOT NULL DEFAULT now(),
 revoked_by uuid,revoked_at timestamptz,version bigint NOT NULL DEFAULT 1,
 CHECK(department_a<department_b),UNIQUE(person_id,day,department_a,department_b)
);
ALTER TABLE iasdpi_pilot.schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE iasdpi_pilot.schedule_day_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iasdpi_pilot.schedule_settings,iasdpi_pilot.schedule_day_exceptions FROM public,anon,authenticated;

CREATE FUNCTION iasdpi_pilot_private.future_months(today date,count integer) RETURNS date[]
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT array_agg((date_trunc('month',today)::date+make_interval(months=>n))::date ORDER BY n) FROM generate_series(1,count) n; $$;
CREATE FUNCTION iasdpi_pilot_private.assignment_days(a iasdpi_pilot.schedule_assignments) RETURNS SETOF date
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT a.assigned_on WHERE a.timing_mode='day'
 UNION ALL SELECT d::date FROM generate_series((a.starts_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,
 ((a.ends_at-interval '1 microsecond') AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,interval '1 day') d WHERE a.timing_mode='timed';
$$;
CREATE FUNCTION iasdpi_pilot_private.day_availability(person uuid,department uuid,day date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_availability v WHERE v.person_id=person AND v.active AND (v.department_id IS NULL OR v.department_id=department)
 AND v.kind='unavailable' AND ((v.pattern='period' AND tsrange(day::timestamp,(day+1)::timestamp,'[)') && tsrange(v.starts_on+coalesce(v.start_time,time '00:00'),(CASE WHEN v.end_time IS NULL THEN v.ends_on+1 ELSE v.ends_on END)+coalesce(v.end_time,time '00:00'),'[)')) OR (v.pattern='weekly' AND extract(dow FROM day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR day>=v.valid_from) AND (v.valid_until IS NULL OR day<=v.valid_until)))) THEN 'unavailable'
 WHEN EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_availability v WHERE v.person_id=person AND v.active AND (v.department_id IS NULL OR v.department_id=department)
 AND v.kind='available' AND v.start_time IS NULL AND v.end_time IS NULL AND ((v.pattern='period' AND day BETWEEN v.starts_on AND v.ends_on) OR (v.pattern='weekly' AND extract(dow FROM day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR day>=v.valid_from) AND (v.valid_until IS NULL OR day<=v.valid_until)))) THEN 'available' ELSE 'unknown' END;
$$;
CREATE FUNCTION iasdpi_pilot_private.has_day_exception(p_person uuid,p_day date,p_a uuid,p_b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_day_exceptions x WHERE x.person_id=p_person AND x.day=p_day AND x.department_a=least(p_a,p_b) AND x.department_b=greatest(p_a,p_b) AND x.enabled); $$;

CREATE FUNCTION public.iasdpi_pilot_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor(); BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_department_access a JOIN iasdpi_pilot.schedule_departments d ON d.id=a.department_id WHERE a.user_id=u AND a.enabled AND d.active) THEN RAISE EXCEPTION 'Sem acesso às escalas.' USING errcode='42501'; END IF;
 RETURN (SELECT to_jsonb(s)||jsonb_build_object('daily',true,'can_edit',iasdpi_pilot_private.is_admin(u),'today',(now() AT TIME ZONE 'America/Sao_Paulo')::date,'future_months',iasdpi_pilot_private.future_months((now() AT TIME ZONE 'America/Sao_Paulo')::date,s.planning_months)) FROM iasdpi_pilot.schedule_settings s);
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_settings_save(p_expected_version bigint,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid; days smallint[]; extras date[]; BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador altera o período e os dias.' USING errcode='42501'; END IF;
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['planning_months','weekdays','extra_dates'])) THEN RAISE EXCEPTION 'Configuração inválida.' USING errcode='22023'; END IF;
 IF p_data ? 'weekdays' THEN SELECT coalesce(array_agg(value::smallint),'{}') INTO days FROM jsonb_array_elements_text(p_data->'weekdays'); END IF;
 IF p_data ? 'extra_dates' THEN SELECT coalesce(array_agg(DISTINCT value::date),'{}') INTO extras FROM jsonb_array_elements_text(p_data->'extra_dates'); END IF;
 IF (extras IS NOT NULL AND (cardinality(extras)>366 OR array_position(extras,NULL) IS NOT NULL)) THEN RAISE EXCEPTION 'Datas extraordinárias inválidas.' USING errcode='22023'; END IF;
 UPDATE iasdpi_pilot.schedule_settings SET planning_months=CASE WHEN p_data ? 'planning_months' THEN (p_data->>'planning_months')::integer ELSE planning_months END,weekdays=coalesce(days,weekdays),extra_dates=coalesce(extras,extra_dates),version=version+1,updated_by=u,updated_at=now() WHERE singleton AND version=p_expected_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Configuração mudou. Recarregue antes de salvar.' USING errcode='40001'; END IF;
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,version,changed_fields) VALUES(u,'daily-settings','00000000-0000-4000-8000-000000000007',(SELECT version FROM iasdpi_pilot.schedule_settings),ARRAY(SELECT jsonb_object_keys(p_data)));
 RETURN public.iasdpi_pilot_schedule_settings_get();
END $$;

ALTER FUNCTION public.iasdpi_pilot_schedule_event_create(uuid,jsonb,uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_event_create(uuid,jsonb,uuid) RENAME TO event_create_006;
CREATE FUNCTION public.iasdpi_pilot_schedule_event_create(p_id uuid,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; d uuid; day date; old iasdpi_pilot.schedule_events; result jsonb; receipt iasdpi_pilot_operational.receipts; sig text; BEGIN
 IF nullif(p_data->>'start_time','') IS NOT NULL OR nullif(p_data->>'end_time','') IS NOT NULL THEN RETURN iasdpi_pilot_private.event_create_006(p_id,p_data,p_request_id); END IF;
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();d:=(p_data->>'department_id')::uuid;
 IF NOT iasdpi_pilot_private.can_manage(u,d) OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=d AND active) THEN RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 IF p_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['department_id','title','date','end_date','start_time','end_time','source','source_key'])) OR length(btrim(p_data->>'title')) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Informe título e data válidos.' USING errcode='22023'; END IF;
 day:=(p_data->>'date')::date;
 IF day IS NULL OR (p_data->>'end_date' IS NOT NULL AND (p_data->>'end_date')::date<>day) OR ((p_data->>'source') IS NULL)<>((p_data->>'source_key') IS NULL) THEN RAISE EXCEPTION 'A escala diária deve informar uma única data e origem completa, quando usada.' USING errcode='22023'; END IF;
 sig:='schedule-daily-event:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('id',p_id,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023'; END IF;RETURN receipt.response; END IF;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_events WHERE id=p_id OR (timing_mode='day' AND scheduled_on=day AND normalized_title=iasdpi_pilot_private.normal_name(p_data->>'title')))
 AND p_data->>'source_key' IS NULL AND (SELECT count(*) FROM iasdpi_pilot.schedule_events WHERE scheduled_on=day AND normalized_title=iasdpi_pilot_private.normal_name(p_data->>'title'))>1 THEN
  RAISE EXCEPTION 'Há vários eventos históricos com esse nome na data. Selecione o evento existente; nenhuma identidade foi mesclada.' USING errcode='23505'; END IF;
 SELECT * INTO old FROM iasdpi_pilot.schedule_events WHERE id=p_id OR (scheduled_on=day AND normalized_title=iasdpi_pilot_private.normal_name(p_data->>'title')) OR (source=p_data->>'source' AND source_key=p_data->>'source_key') ORDER BY (id=p_id) DESC,timing_mode,id LIMIT 1;
 IF FOUND THEN
  IF old.scheduled_on<>day OR old.normalized_title<>iasdpi_pilot_private.normal_name(p_data->>'title') OR (p_data->>'source' IS NOT NULL AND (old.source IS DISTINCT FROM p_data->>'source' OR old.source_key IS DISTINCT FROM p_data->>'source_key')) THEN RAISE EXCEPTION 'Evento existente com outra identidade. Nada foi alterado.' USING errcode='23505'; END IF;
  result:=to_jsonb(old)-'normalized_title';
 ELSE
  INSERT INTO iasdpi_pilot.schedule_events(id,title,scheduled_on,timing_mode,source,source_key,created_by) VALUES(p_id,p_data->>'title',day,'day',p_data->>'source',p_data->>'source_key',u) RETURNING to_jsonb(schedule_events.*)-'normalized_title' INTO result;
  INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields) VALUES(u,'daily-event',p_id,d,1,ARRAY['create']);
 END IF;
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_generate_days(p_department uuid,p_title text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; s iasdpi_pilot.schedule_settings; months date[]; day date; result jsonb:='[]'; row jsonb; sig text; receipt iasdpi_pilot_operational.receipts; BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.can_manage(u,p_department) THEN RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 IF p_request_id IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Informe o nome dos cultos.' USING errcode='22023'; END IF;
 sig:='schedule-daily-generation:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('department',p_department,'title',p_title));
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023'; END IF;RETURN receipt.response; END IF;
 SELECT * INTO s FROM iasdpi_pilot.schedule_settings;months:=iasdpi_pilot_private.future_months((now() AT TIME ZONE 'America/Sao_Paulo')::date,s.planning_months);
 FOR day IN SELECT d::date FROM generate_series(months[1]::timestamp,(months[array_length(months,1)]+interval '1 month' - interval '1 day')::timestamp,interval '1 day') d WHERE extract(dow FROM d)::smallint=ANY(s.weekdays) OR d::date=ANY(s.extra_dates) LOOP
  row:=public.iasdpi_pilot_schedule_event_create(gen_random_uuid(),jsonb_build_object('department_id',p_department,'title',p_title,'date',day),gen_random_uuid());result:=result||jsonb_build_array(row);
 END LOOP;
 row:=jsonb_build_object('months',months,'events',result,'settings_version',s.version);
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,row,now());RETURN row;
END $$;

ALTER FUNCTION public.iasdpi_pilot_schedule_workspace(uuid,date) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_workspace(uuid,date) RENAME TO workspace_006;
CREATE FUNCTION public.iasdpi_pilot_schedule_workspace(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb; BEGIN
 result:=iasdpi_pilot_private.workspace_006(p_department,p_month);
 RETURN result||jsonb_build_object('settings',public.iasdpi_pilot_schedule_settings_get(),'availability',coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',m.person_id,'date',d::date,'state',iasdpi_pilot_private.day_availability(m.person_id,p_department,d::date))) FROM iasdpi_pilot.schedule_memberships m CROSS JOIN generate_series(p_month::timestamp,(p_month+interval '1 month' - interval '1 day')::timestamp,interval '1 day') d WHERE m.department_id=p_department AND m.active),'[]'::jsonb));
END $$;

CREATE FUNCTION iasdpi_pilot_private.validate_daily_assignment(a iasdpi_pilot.schedule_assignments,p_new boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req iasdpi_pilot.schedule_requirements; event iasdpi_pilot.schedule_events; day date; other record; maximum integer; count_days integer; mon date; BEGIN
 SELECT * INTO STRICT req FROM iasdpi_pilot.schedule_requirements WHERE id=a.requirement_id;
 SELECT * INTO STRICT event FROM iasdpi_pilot.schedule_events WHERE id=req.event_id;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people p JOIN iasdpi_pilot.schedule_memberships m ON m.person_id=p.id
 JOIN iasdpi_pilot.schedule_qualifications q ON q.membership_id=m.id JOIN iasdpi_pilot.schedule_roles role ON role.id=q.role_id JOIN iasdpi_pilot.schedule_departments d ON d.id=m.department_id
 WHERE p.id=a.person_id AND p.active AND m.active AND d.active AND role.active AND m.department_id=a.department_id AND q.role_id=req.role_id) THEN RAISE EXCEPTION 'Voluntário sem habilitação ativa.' USING errcode='23514'; END IF;
 IF a.timing_mode='day' AND a.assigned_on<>event.scheduled_on THEN RAISE EXCEPTION 'Data da atribuição difere do evento.' USING errcode='23514'; END IF;
 IF a.timing_mode='timed' THEN
  IF event.starts_at IS NULL OR a.starts_at<event.starts_at OR a.ends_at>event.ends_at OR a.ends_at<=a.starts_at THEN RAISE EXCEPTION 'Intervalo histórico fora do evento.' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_availability v WHERE v.person_id=a.person_id AND v.active AND v.kind='unavailable'
 AND (v.department_id IS NULL OR v.department_id=req.department_id) AND (
 (v.pattern='period' AND tstzrange((v.starts_on+coalesce(v.start_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo',
 ((CASE WHEN v.end_time IS NULL THEN v.ends_on+1 ELSE v.ends_on END)+coalesce(v.end_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo','[)') && tstzrange(a.starts_at,a.ends_at,'[)'))
 OR (v.pattern='weekly' AND EXISTS(SELECT 1 FROM generate_series((a.starts_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,
 (a.ends_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,interval '1 day') AS days(calendar_day)
 WHERE extract(dow FROM calendar_day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR calendar_day::date>=v.valid_from) AND (v.valid_until IS NULL OR calendar_day::date<=v.valid_until)
 AND tstzrange((calendar_day::date+coalesce(v.start_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo',
 ((CASE WHEN v.end_time IS NULL THEN calendar_day::date+1 ELSE calendar_day::date END)+coalesce(v.end_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo','[)') && tstzrange(a.starts_at,a.ends_at,'[)'))))) THEN
  RAISE EXCEPTION 'Conflito: voluntário indisponível no período informado.' USING errcode='23514'; END IF;
 END IF;
 IF p_new OR a.timing_mode='day' THEN
  FOR day IN SELECT * FROM iasdpi_pilot_private.assignment_days(a) LOOP
   IF iasdpi_pilot_private.day_availability(a.person_id,a.department_id,day)<>'available' THEN RAISE EXCEPTION 'Disponibilidade não confirmada ou pessoa indisponível nesta data. Revise as flags do cadastro.' USING errcode='23514'; END IF;
   FOR other IN SELECT DISTINCT x.department_id FROM iasdpi_pilot.schedule_assignments x CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(x) occupied WHERE x.person_id=a.person_id AND x.id<>a.id AND x.department_id<>a.department_id AND occupied=day LOOP
    IF NOT iasdpi_pilot_private.has_day_exception(a.person_id,day,a.department_id,other.department_id) THEN RAISE EXCEPTION 'Conflito: pessoa em dois departamentos na mesma data. Somente administrador pode autorizar uma exceção justificada.' USING errcode='23P01'; END IF;
   END LOOP;
   mon:=date_trunc('month',day)::date;
   SELECT max_monthly_count INTO maximum FROM iasdpi_pilot.schedule_people WHERE id=a.person_id;
   SELECT count(DISTINCT occupied) INTO count_days FROM (SELECT occupied FROM iasdpi_pilot.schedule_assignments x CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(x) occupied WHERE x.person_id=a.person_id AND x.id<>a.id UNION SELECT occupied FROM iasdpi_pilot_private.assignment_days(a) occupied) dates WHERE occupied>=mon AND occupied<(mon+interval '1 month')::date;
   IF maximum IS NOT NULL AND count_days>maximum THEN RAISE EXCEPTION 'Limite mensal da pessoa excedido (dias distintos).' USING errcode='23514'; END IF;
   SELECT max_monthly_count INTO maximum FROM iasdpi_pilot.schedule_memberships WHERE person_id=a.person_id AND department_id=a.department_id;
   SELECT count(DISTINCT occupied) INTO count_days FROM (SELECT occupied FROM iasdpi_pilot.schedule_assignments x CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(x) occupied WHERE x.person_id=a.person_id AND x.department_id=a.department_id AND x.id<>a.id UNION SELECT occupied FROM iasdpi_pilot_private.assignment_days(a) occupied) dates WHERE occupied>=mon AND occupied<(mon+interval '1 month')::date;
   IF maximum IS NOT NULL AND count_days>maximum THEN RAISE EXCEPTION 'Limite mensal do vínculo excedido.' USING errcode='23514'; END IF;
  END LOOP;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.validate_assignment(a iasdpi_pilot.schedule_assignments) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM iasdpi_pilot_private.validate_daily_assignment(a,true); END $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.assignment_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE event iasdpi_pilot.schedule_events; BEGIN
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 SELECT e.* INTO STRICT event FROM iasdpi_pilot.schedule_requirements r JOIN iasdpi_pilot.schedule_events e ON e.id=r.event_id WHERE r.id=NEW.requirement_id;
 NEW.assigned_on:=CASE WHEN NEW.timing_mode='day' THEN event.scheduled_on ELSE (NEW.starts_at AT TIME ZONE 'America/Sao_Paulo')::date END;
 PERFORM iasdpi_pilot_private.validate_assignment(NEW);RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.revalidate_plans() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE item iasdpi_pilot.schedule_assignments; BEGIN
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 FOR item IN SELECT * FROM iasdpi_pilot.schedule_assignments WHERE assigned_on>=(now() AT TIME ZONE 'America/Sao_Paulo')::date LOOP
  -- Horários antigos não são transformados nem recebem exceções automáticas.
  PERFORM iasdpi_pilot_private.validate_daily_assignment(item,false);
 END LOOP;RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; old iasdpi_pilot.schedule_plans; d uuid; mon date; next_status text; signature text; result jsonb;
 receipt iasdpi_pilot_operational.receipts; req jsonb; item jsonb; r iasdpi_pilot.schedule_requirements; e iasdpi_pilot.schedule_events; n bigint;
BEGIN
 u:=iasdpi_pilot_private.actor(); UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton; u:=iasdpi_pilot_private.actor();
 IF p_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR pg_column_size(p_data)>1000000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['department_id','month','title','status','requirements'])) THEN
  RAISE EXCEPTION 'Plano, versão ou campos inválidos.' USING errcode='22023'; END IF;
 SELECT * INTO old FROM iasdpi_pilot.schedule_plans WHERE id=p_id FOR UPDATE;
 d:=coalesce(old.department_id,(p_data->>'department_id')::uuid); mon:=coalesce(old.month,(p_data->>'month')::date);
 IF NOT iasdpi_pilot_private.can_manage(u,d) OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=d AND active) THEN
  RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 IF mon IS NULL OR extract(day FROM mon)<>1 OR (p_data ? 'department_id' AND (p_data->>'department_id')::uuid IS DISTINCT FROM d)
 OR (p_data ? 'month' AND (p_data->>'month')::date IS DISTINCT FROM mon) THEN RAISE EXCEPTION 'Departamento e mês são obrigatórios e não podem ser transferidos.' USING errcode='22023'; END IF;
 signature:='schedule-b1-plan:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('id',p_id,'expected',p_expected_version,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_id<>u OR receipt.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023'; END IF;
  RETURN receipt.response;
 END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Esta escala mudou em outro dispositivo. Seus campos devem ser preservados; recarregue e compare antes de reaplicar.' USING errcode='40001'; END IF;
 next_status:=coalesce(p_data->>'status',old.status,'draft'); n:=coalesce(old.version,0)+1;
 IF old.id IS NULL THEN
  IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_plans WHERE department_id=d AND month=mon) THEN RAISE EXCEPTION 'Já existe uma escala deste departamento e mês. Abra a existente.' USING errcode='23505'; END IF;
  INSERT INTO iasdpi_pilot.schedule_plans(id,department_id,month,title,status,version,created_by,updated_by)
  VALUES(p_id,d,mon,coalesce(p_data->>'title','Escala mensal'),next_status,n,u,u);
 ELSE UPDATE iasdpi_pilot.schedule_plans SET title=coalesce(p_data->>'title',title),status=next_status,version=n,updated_by=u,updated_at=now() WHERE id=p_id; END IF;
 IF p_data ? 'requirements' THEN
  IF jsonb_typeof(p_data->'requirements') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'requirements')>500 THEN RAISE EXCEPTION 'Lista de funções inválida ou excessiva.' USING errcode='22023'; END IF;
  -- O conjunto completo é substituído atomicamente. Campo ausente mantém os dados existentes.
  DELETE FROM iasdpi_pilot.schedule_assignments WHERE plan_id=p_id;
  DELETE FROM iasdpi_pilot.schedule_requirements WHERE plan_id=p_id;
  FOR req IN SELECT value FROM jsonb_array_elements(p_data->'requirements') LOOP
   IF jsonb_typeof(req) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(req) k WHERE NOT k=ANY(ARRAY['id','event_id','role_id','required_count','notes','assignments'])) THEN RAISE EXCEPTION 'Função necessária inválida.' USING errcode='22023'; END IF;
   SELECT * INTO e FROM iasdpi_pilot.schedule_events WHERE id=(req->>'event_id')::uuid;
   IF e.id IS NULL OR e.scheduled_on<mon OR e.scheduled_on>=(mon+interval '1 month')::date OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_roles WHERE id=(req->>'role_id')::uuid AND department_id=d AND active) THEN
    RAISE EXCEPTION 'Evento fora do mês ou função inativa/de outro departamento.' USING errcode='23514'; END IF;
   INSERT INTO iasdpi_pilot.schedule_requirements(id,plan_id,department_id,event_id,role_id,required_count,notes)
   VALUES((req->>'id')::uuid,p_id,d,e.id,(req->>'role_id')::uuid,(req->>'required_count')::integer,coalesce(req->>'notes','')) RETURNING * INTO r;
   IF jsonb_typeof(req->'assignments') IS DISTINCT FROM 'array' OR jsonb_array_length(req->'assignments')>r.required_count THEN RAISE EXCEPTION 'Lista de voluntários inválida ou maior que as vagas.' USING errcode='23514'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(req->'assignments') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE NOT k=ANY(ARRAY['id','person_id','starts_at','ends_at','timing_mode'])) THEN RAISE EXCEPTION 'Atribuição inválida.' USING errcode='22023'; END IF;
    INSERT INTO iasdpi_pilot.schedule_assignments(id,requirement_id,plan_id,department_id,person_id,starts_at,ends_at,timing_mode)
    VALUES((item->>'id')::uuid,r.id,p_id,d,(item->>'person_id')::uuid,CASE WHEN coalesce(item->>'timing_mode',e.timing_mode)='day' THEN NULL ELSE coalesce((item->>'starts_at')::timestamptz,e.starts_at) END,CASE WHEN coalesce(item->>'timing_mode',e.timing_mode)='day' THEN NULL ELSE coalesce((item->>'ends_at')::timestamptz,e.ends_at) END,coalesce(item->>'timing_mode',e.timing_mode));
   END LOOP;
  END LOOP;
 END IF;
 IF next_status='published' AND (NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_requirements WHERE plan_id=p_id) OR EXISTS(
 SELECT 1 FROM iasdpi_pilot.schedule_requirements coverage WHERE coverage.plan_id=p_id AND (SELECT count(*) FROM iasdpi_pilot.schedule_assignments assigned WHERE assigned.requirement_id=coverage.id)<coverage.required_count)) THEN
  RAISE EXCEPTION 'Publicação bloqueada: existem funções sem voluntários suficientes.' USING errcode='23514'; END IF;
 result:=iasdpi_pilot_private.plan_snapshot(p_id);
 INSERT INTO iasdpi_pilot.schedule_versions(plan_id,version,actor_id,snapshot) VALUES(p_id,n,u,result);
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields) VALUES(u,'b1-plan',p_id,d,n,ARRAY(SELECT jsonb_object_keys(p_data)));
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,signature,result,now()); RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_members() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor(); BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador consulta a planilha central.' USING errcode='42501'; END IF;
 RETURN jsonb_build_object('catalog',public.iasdpi_pilot_schedule_catalog(),'members',coalesce((SELECT jsonb_agg((to_jsonb(p)-ARRAY['normalized_name','auth_user_id'])||jsonb_build_object(
 'weekdays',(SELECT jsonb_object_agg(d::text,CASE WHEN EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_availability a WHERE a.person_id=p.id AND a.origin='daily-profile' AND a.pattern='weekly' AND a.kind='unavailable' AND d::smallint=ANY(a.weekdays) AND a.active) THEN 'unavailable' WHEN EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_availability a WHERE a.person_id=p.id AND a.origin='daily-profile' AND a.pattern='weekly' AND a.kind='available' AND d::smallint=ANY(a.weekdays) AND a.active) THEN 'available' ELSE 'unknown' END) FROM generate_series(0,6) d),
 'unavailable_dates',coalesce((SELECT jsonb_agg(a.starts_on ORDER BY a.starts_on) FROM iasdpi_pilot.schedule_availability a WHERE a.person_id=p.id AND a.origin='daily-profile' AND a.pattern='period' AND a.active),'[]'::jsonb),
 'manual_rules',(SELECT count(*) FROM iasdpi_pilot.schedule_availability a WHERE a.person_id=p.id AND a.origin='manual' AND a.active)) ORDER BY p.name) FROM iasdpi_pilot.schedule_people p),'[]'::jsonb));
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_member_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; result jsonb; sig text; receipt iasdpi_pilot_operational.receipts; kind text; days smallint[]; day date; BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador altera a planilha central.' USING errcode='42501'; END IF;
 IF p_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR pg_column_size(p_data)>24000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['name','display_name','active','max_monthly_count','weekdays','unavailable_dates'])) THEN RAISE EXCEPTION 'Campos da pessoa inválidos.' USING errcode='22023'; END IF;
 sig:='schedule-daily-member:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('id',p_id,'expected',p_expected_version,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023'; END IF;RETURN receipt.response; END IF;
 result:=public.iasdpi_pilot_schedule_save('person',p_id,p_expected_version,p_data-ARRAY['weekdays','unavailable_dates','max_monthly_count'],gen_random_uuid());
 IF p_data ? 'max_monthly_count' THEN UPDATE iasdpi_pilot.schedule_people SET max_monthly_count=(p_data->>'max_monthly_count')::integer WHERE id=p_id; END IF;
 IF p_data ? 'weekdays' THEN
  IF jsonb_typeof(p_data->'weekdays') IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each_text(p_data->'weekdays') x WHERE x.key!~'^[0-6]$' OR x.value IS NULL OR x.value NOT IN ('available','unavailable','unknown')) THEN RAISE EXCEPTION 'Flags semanais inválidas.' USING errcode='22023'; END IF;
  DELETE FROM iasdpi_pilot.schedule_availability WHERE person_id=p_id AND origin='daily-profile' AND pattern='weekly';
  FOREACH kind IN ARRAY ARRAY['available','unavailable'] LOOP
   SELECT array_agg(key::smallint ORDER BY key) INTO days FROM jsonb_each_text(p_data->'weekdays') x WHERE x.value=kind;
   IF days IS NOT NULL THEN INSERT INTO iasdpi_pilot.schedule_availability(person_id,kind,pattern,weekdays,origin) VALUES(p_id,kind,'weekly',days,'daily-profile'); END IF;
  END LOOP;
 END IF;
 IF p_data ? 'unavailable_dates' THEN
  IF jsonb_typeof(p_data->'unavailable_dates') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'unavailable_dates')>366 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'unavailable_dates') x WHERE x='null'::jsonb) THEN RAISE EXCEPTION 'Datas indisponíveis inválidas.' USING errcode='22023'; END IF;
  DELETE FROM iasdpi_pilot.schedule_availability WHERE person_id=p_id AND origin='daily-profile' AND pattern='period';
  FOR day IN SELECT DISTINCT value::date FROM jsonb_array_elements_text(p_data->'unavailable_dates') LOOP INSERT INTO iasdpi_pilot.schedule_availability(person_id,kind,pattern,starts_on,ends_on,origin) VALUES(p_id,'unavailable','period',day,day,'daily-profile');END LOOP;
 END IF;
 SELECT to_jsonb(p)-ARRAY['normalized_name','auth_user_id'] INTO result FROM iasdpi_pilot.schedule_people p WHERE id=p_id;
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,version,changed_fields) VALUES(u,'daily-member',p_id,(result->>'version')::bigint,ARRAY(SELECT jsonb_object_keys(p_data)));
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_person_history(p_person uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor(); BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador consulta este histórico.' USING errcode='42501'; END IF;
 RETURN jsonb_build_object('current',coalesce((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('department',d.name,'role',r.name,'event',e.title,'status',p.status) ORDER BY a.assigned_on DESC) FROM iasdpi_pilot.schedule_assignments a JOIN iasdpi_pilot.schedule_requirements req ON req.id=a.requirement_id JOIN iasdpi_pilot.schedule_roles r ON r.id=req.role_id JOIN iasdpi_pilot.schedule_departments d ON d.id=a.department_id JOIN iasdpi_pilot.schedule_events e ON e.id=req.event_id JOIN iasdpi_pilot.schedule_plans p ON p.id=a.plan_id WHERE a.person_id=p_person),'[]'::jsonb),
 'versions',coalesce((SELECT jsonb_agg(x) FROM (SELECT v.plan_id,v.version,v.captured_at,v.snapshot->>'title' title,v.snapshot->>'status' status FROM iasdpi_pilot.schedule_versions v WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(v.snapshot->'requirements') req CROSS JOIN LATERAL jsonb_array_elements(req->'assignments') a WHERE a->>'person_id'=p_person::text) ORDER BY v.captured_at DESC LIMIT 200) x),'[]'::jsonb));
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_exceptions() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor(); BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador consulta exceções.' USING errcode='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.day DESC) FROM iasdpi_pilot.schedule_day_exceptions x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_exception_save(p_id uuid,p_expected_version bigint,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; old iasdpi_pilot.schedule_day_exceptions; a uuid; b uuid; person uuid; day date; v_enabled boolean; result jsonb; BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador autoriza exceções.' USING errcode='42501'; END IF;
 IF p_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['person_id','day','department_a','department_b','reason','enabled'])) THEN RAISE EXCEPTION 'Exceção inválida.' USING errcode='22023'; END IF;
 SELECT * INTO old FROM iasdpi_pilot.schedule_day_exceptions WHERE id=p_id;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Exceção mudou. Recarregue.' USING errcode='40001'; END IF;
 person:=coalesce(old.person_id,(p_data->>'person_id')::uuid);day:=coalesce(old.day,(p_data->>'day')::date);a:=least((p_data->>'department_a')::uuid,(p_data->>'department_b')::uuid);b:=greatest((p_data->>'department_a')::uuid,(p_data->>'department_b')::uuid);
 IF old.id IS NOT NULL THEN
  IF (p_data ? 'person_id' AND (p_data->>'person_id')::uuid IS DISTINCT FROM old.person_id) OR (p_data ? 'day' AND (p_data->>'day')::date IS DISTINCT FROM old.day) OR (a IS NOT NULL AND (a<>old.department_a OR b<>old.department_b)) THEN RAISE EXCEPTION 'A identidade da autorização não pode mudar.' USING errcode='22023'; END IF;
  a:=old.department_a;b:=old.department_b;
 END IF;
 IF person IS NULL OR day IS NULL OR a IS NULL OR b IS NULL OR a=b OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people WHERE id=person AND active) OR (SELECT count(*) FROM iasdpi_pilot.schedule_departments WHERE id IN (a,b) AND active)<>2 THEN RAISE EXCEPTION 'Pessoa, data ou departamentos inválidos.' USING errcode='22023'; END IF;
 v_enabled:=coalesce((p_data->>'enabled')::boolean,old.enabled,true);
 IF NOT v_enabled AND EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_assignments x CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(x) occupied JOIN iasdpi_pilot.schedule_assignments y ON y.person_id=x.person_id AND y.department_id=b CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(y) occupied_y WHERE x.person_id=person AND x.department_id=a AND occupied=day AND occupied_y=day) THEN RAISE EXCEPTION 'Exceção em uso. Corrija uma das atribuições antes de revogar.' USING errcode='23514'; END IF;
 IF old.id IS NULL THEN
  INSERT INTO iasdpi_pilot.schedule_day_exceptions(id,person_id,day,department_a,department_b,reason,enabled,approved_by) VALUES(p_id,person,day,a,b,p_data->>'reason',v_enabled,u);
 ELSE UPDATE iasdpi_pilot.schedule_day_exceptions SET reason=coalesce(p_data->>'reason',reason),enabled=v_enabled,approved_by=CASE WHEN v_enabled AND NOT old.enabled THEN u ELSE approved_by END,approved_at=CASE WHEN v_enabled AND NOT old.enabled THEN now() ELSE approved_at END,revoked_by=CASE WHEN NOT v_enabled THEN u ELSE NULL END,revoked_at=CASE WHEN NOT v_enabled THEN now() ELSE NULL END,version=version+1 WHERE id=p_id; END IF;
 SELECT to_jsonb(x) INTO result FROM iasdpi_pilot.schedule_day_exceptions x WHERE id=p_id;
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,version,changed_fields,reason) VALUES(u,'daily-exception',p_id,(result->>'version')::bigint,ARRAY(SELECT jsonb_object_keys(p_data)),p_data->>'reason');RETURN result;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iasdpi_pilot_private FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_schedule_event_create(uuid,jsonb,uuid),public.iasdpi_pilot_schedule_workspace(uuid,date),public.iasdpi_pilot_schedule_settings_get(),public.iasdpi_pilot_schedule_settings_save(bigint,jsonb),public.iasdpi_pilot_schedule_generate_days(uuid,text,uuid),public.iasdpi_pilot_schedule_members(),public.iasdpi_pilot_schedule_member_save(uuid,bigint,jsonb,uuid),public.iasdpi_pilot_schedule_person_history(uuid),public.iasdpi_pilot_schedule_exceptions(),public.iasdpi_pilot_schedule_exception_save(uuid,bigint,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_event_create(uuid,jsonb,uuid),public.iasdpi_pilot_schedule_workspace(uuid,date),public.iasdpi_pilot_schedule_settings_get(),public.iasdpi_pilot_schedule_settings_save(bigint,jsonb),public.iasdpi_pilot_schedule_generate_days(uuid,text,uuid),public.iasdpi_pilot_schedule_members(),public.iasdpi_pilot_schedule_member_save(uuid,bigint,jsonb,uuid),public.iasdpi_pilot_schedule_person_history(uuid),public.iasdpi_pilot_schedule_exceptions(),public.iasdpi_pilot_schedule_exception_save(uuid,bigint,jsonb) TO authenticated;

-- Regras reutilizadas de 008_monthly_rotation.sql
-- IASDPI B1.2: contexto somente leitura para proposta mensal. Revisar após 007.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_pilot_schedule_members()') IS NULL THEN
  RAISE EXCEPTION 'Instale 001–007 antes da 008, como postgres.';
 END IF;
END $$;

CREATE FUNCTION public.iasdpi_pilot_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_pilot_private.actor(); result jsonb; current_plan uuid; BEGIN
 IF NOT iasdpi_pilot_private.can_manage(u,p_department) OR NOT EXISTS(
  SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND active) THEN
  RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501';
 END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<date '1000-01-01' OR p_month>date '9998-12-01' THEN
  RAISE EXCEPTION 'Informe o primeiro dia de um mês válido.' USING errcode='22023';
 END IF;
 SELECT id INTO current_plan FROM iasdpi_pilot.schedule_plans WHERE department_id=p_department AND month=p_month;
 -- Somente pessoas do departamento solicitado. Conflitos externos são booleanos:
 -- não revelam departamento, nomes, observações ou detalhes das outras escalas.
 WITH occupied AS MATERIALIZED (
  SELECT a.person_id,a.department_id,a.plan_id,d.day,p.status FROM iasdpi_pilot.schedule_assignments a
  JOIN iasdpi_pilot.schedule_plans p ON p.id=a.plan_id
  CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(a) d(day)
  WHERE EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships m WHERE m.person_id=a.person_id AND m.department_id=p_department)
 ), days AS (SELECT generate_series(p_month::timestamp,(p_month+interval '1 month' - interval '1 day')::timestamp,interval '1 day')::date AS day)
 SELECT jsonb_build_object('month',p_month,'department_id',p_department,'basis_version',coalesce((SELECT version FROM iasdpi_pilot.schedule_plans WHERE id=current_plan),0),
 'history_scope','published-before-month',
 'people',coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',person.id,
  'history_count',(SELECT count(DISTINCT day) FROM occupied WHERE person_id=person.id AND department_id=p_department AND day<p_month AND status='published'),
  'last_day',(SELECT max(day) FROM occupied WHERE person_id=person.id AND department_id=p_department AND day<p_month AND status='published'),
  'global_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT day FROM occupied WHERE person_id=person.id AND plan_id IS DISTINCT FROM current_plan AND day>=p_month AND day<(p_month+interval '1 month')::date) x),'[]'::jsonb),
  'department_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT day FROM occupied WHERE person_id=person.id AND department_id=p_department AND plan_id IS DISTINCT FROM current_plan AND day>=p_month AND day<(p_month+interval '1 month')::date) x),'[]'::jsonb),
  'days',(SELECT jsonb_agg(jsonb_build_object('date',days.day,'state',iasdpi_pilot_private.day_availability(person.id,p_department,days.day),
   'conflict',EXISTS(SELECT 1 FROM occupied other WHERE other.person_id=person.id AND other.department_id<>p_department AND other.day=days.day
    AND NOT iasdpi_pilot_private.has_day_exception(person.id,days.day,p_department,other.department_id))) ORDER BY days.day) FROM days)
 ) ORDER BY person.id) FROM iasdpi_pilot.schedule_people person WHERE EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships m WHERE m.person_id=person.id AND m.department_id=p_department)),'[]'::jsonb),
 'heads',coalesce((SELECT jsonb_agg(person.display_name ORDER BY person.display_name) FROM iasdpi_pilot.schedule_memberships member JOIN iasdpi_pilot.schedule_people person ON person.id=member.person_id
 WHERE member.department_id=p_department AND member.is_ministry_head AND member.active AND person.active),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_rotation_context(uuid,date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_schedule_rotation_context(uuid,date) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_rotation_context(uuid,date) TO authenticated;

-- Estende a resposta existente sem tocar em dados nem alterar o contrato da B1.1.
ALTER FUNCTION public.iasdpi_pilot_schedule_workspace(uuid,date) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_workspace(uuid,date) RENAME TO workspace_007;
REVOKE ALL ON FUNCTION iasdpi_pilot_private.workspace_007(uuid,date) FROM public,anon,authenticated;
CREATE FUNCTION public.iasdpi_pilot_schedule_workspace(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE workspace jsonb; u uuid; BEGIN
 workspace:=iasdpi_pilot_private.workspace_007(p_department,p_month);
 u:=iasdpi_pilot_private.actor();
 RETURN workspace||jsonb_build_object('monthly',true,'rotation_context',CASE WHEN iasdpi_pilot_private.can_manage(u,p_department)
  THEN public.iasdpi_pilot_schedule_rotation_context(p_department,p_month) ELSE NULL END);
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_workspace(uuid,date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_schedule_workspace(uuid,date) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_workspace(uuid,date) TO authenticated;
-- Gravação continua nas RPCs/validações transacionais da 007; não publica propostas.

-- Regras reutilizadas de 009_confirmed_schedule_conflicts.sql
-- IASDPI B1.2: confirmação antecipada e rascunhos não confirmados.
-- Revisar após 008. Não importa pessoas nem escalas automaticamente.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_pilot_schedule_rotation_context(uuid,date)') IS NULL THEN RAISE EXCEPTION 'Instale 001–008 como postgres antes da 009.'; END IF;
END $$;
CREATE TABLE iasdpi_pilot.schedule_legacy_commitments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_key text NOT NULL UNIQUE CHECK(length(source_key) BETWEEN 1 AND 300),
 person_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_people(id),department_id uuid NOT NULL REFERENCES iasdpi_pilot.schedule_departments(id),
 scheduled_on date NOT NULL,original_name text NOT NULL CHECK(length(original_name) BETWEEN 1 AND 160),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE iasdpi_pilot.schedule_legacy_commitments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iasdpi_pilot.schedule_legacy_commitments FROM public,anon,authenticated;
CREATE INDEX schedule_legacy_person_day ON iasdpi_pilot.schedule_legacy_commitments(person_id,scheduled_on,department_id);
CREATE VIEW iasdpi_pilot_private.confirmed_days AS
 SELECT a.person_id,a.department_id,d.day,a.plan_id,a.id assignment_id FROM iasdpi_pilot.schedule_assignments a
 JOIN iasdpi_pilot.schedule_plans p ON p.id=a.plan_id AND p.status='published'
 CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(a) d(day)
 UNION ALL SELECT person_id,department_id,scheduled_on,NULL::uuid,NULL::uuid FROM iasdpi_pilot.schedule_legacy_commitments;
REVOKE ALL ON iasdpi_pilot_private.confirmed_days FROM public,anon,authenticated;
CREATE FUNCTION iasdpi_pilot_private.monthly_days(a iasdpi_pilot.schedule_assignments,mon date,in_department boolean) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT count(DISTINCT day) FROM (
 SELECT day FROM iasdpi_pilot_private.confirmed_days c WHERE c.person_id=a.person_id AND c.plan_id IS DISTINCT FROM a.plan_id AND (NOT in_department OR c.department_id=a.department_id)
 UNION SELECT occupied FROM iasdpi_pilot.schedule_assignments x CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(x) occupied WHERE x.plan_id=a.plan_id AND x.person_id=a.person_id AND x.id<>a.id
 UNION SELECT occupied FROM iasdpi_pilot_private.assignment_days(a) occupied
 ) days WHERE day>=mon AND day<(mon+interval '1 month')::date;
$$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.validate_daily_assignment(a iasdpi_pilot.schedule_assignments,p_new boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req iasdpi_pilot.schedule_requirements; event iasdpi_pilot.schedule_events; v_day date; other record; maximum integer; count_days integer; mon date; BEGIN
 SELECT * INTO STRICT req FROM iasdpi_pilot.schedule_requirements WHERE id=a.requirement_id;
 SELECT * INTO STRICT event FROM iasdpi_pilot.schedule_events WHERE id=req.event_id;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people p JOIN iasdpi_pilot.schedule_memberships m ON m.person_id=p.id
 JOIN iasdpi_pilot.schedule_qualifications q ON q.membership_id=m.id JOIN iasdpi_pilot.schedule_roles role ON role.id=q.role_id JOIN iasdpi_pilot.schedule_departments d ON d.id=m.department_id
 WHERE p.id=a.person_id AND p.active AND m.active AND d.active AND role.active AND m.department_id=a.department_id AND q.role_id=req.role_id) THEN RAISE EXCEPTION 'Voluntário sem habilitação ativa.' USING errcode='23514'; END IF;
 IF a.timing_mode='day' AND a.assigned_on<>event.scheduled_on THEN RAISE EXCEPTION 'Data da atribuição difere do evento.' USING errcode='23514'; END IF;
 IF a.timing_mode='timed' THEN
  IF event.starts_at IS NULL OR a.starts_at<event.starts_at OR a.ends_at>event.ends_at OR a.ends_at<=a.starts_at THEN RAISE EXCEPTION 'Intervalo histórico fora do evento.' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_availability v WHERE v.person_id=a.person_id AND v.active AND v.kind='unavailable'
 AND (v.department_id IS NULL OR v.department_id=req.department_id) AND (
 (v.pattern='period' AND tstzrange((v.starts_on+coalesce(v.start_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo',
 ((CASE WHEN v.end_time IS NULL THEN v.ends_on+1 ELSE v.ends_on END)+coalesce(v.end_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo','[)') && tstzrange(a.starts_at,a.ends_at,'[)'))
 OR (v.pattern='weekly' AND EXISTS(SELECT 1 FROM generate_series((a.starts_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,
 (a.ends_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,interval '1 day') AS days(calendar_day)
 WHERE extract(dow FROM calendar_day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR calendar_day::date>=v.valid_from) AND (v.valid_until IS NULL OR calendar_day::date<=v.valid_until)
 AND tstzrange((calendar_day::date+coalesce(v.start_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo',
 ((CASE WHEN v.end_time IS NULL THEN calendar_day::date+1 ELSE calendar_day::date END)+coalesce(v.end_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo','[)') && tstzrange(a.starts_at,a.ends_at,'[)'))))) THEN
  RAISE EXCEPTION 'Conflito: voluntário indisponível no período informado.' USING errcode='23514'; END IF;
 END IF;
 IF p_new OR a.timing_mode='day' THEN
  FOR v_day IN SELECT * FROM iasdpi_pilot_private.assignment_days(a) LOOP
   IF iasdpi_pilot_private.day_availability(a.person_id,a.department_id,v_day)<>'available' THEN RAISE EXCEPTION 'Disponibilidade não confirmada ou pessoa indisponível nesta data. Revise as flags do cadastro.' USING errcode='23514'; END IF;
   FOR other IN SELECT DISTINCT x.department_id FROM iasdpi_pilot_private.confirmed_days x WHERE x.person_id=a.person_id AND x.assignment_id IS DISTINCT FROM a.id AND x.department_id<>a.department_id AND x.day=v_day LOOP
    IF NOT iasdpi_pilot_private.has_day_exception(a.person_id,v_day,a.department_id,other.department_id) THEN RAISE EXCEPTION 'Conflito: pessoa em dois departamentos na mesma data. Somente administrador pode autorizar uma exceção justificada.' USING errcode='23P01'; END IF;
   END LOOP;
   mon:=date_trunc('month',v_day)::date;
   SELECT max_monthly_count INTO maximum FROM iasdpi_pilot.schedule_people WHERE id=a.person_id;
   SELECT iasdpi_pilot_private.monthly_days(a,mon,false) INTO count_days;
   IF maximum IS NOT NULL AND count_days>maximum THEN RAISE EXCEPTION 'Limite mensal da pessoa excedido (dias distintos).' USING errcode='23514'; END IF;
   SELECT max_monthly_count INTO maximum FROM iasdpi_pilot.schedule_memberships WHERE person_id=a.person_id AND department_id=a.department_id;
   SELECT iasdpi_pilot_private.monthly_days(a,mon,true) INTO count_days;
   IF maximum IS NOT NULL AND count_days>maximum THEN RAISE EXCEPTION 'Limite mensal do vínculo excedido.' USING errcode='23514'; END IF;
  END LOOP;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_pilot_private.actor(); result jsonb; current_plan uuid; BEGIN
 IF NOT iasdpi_pilot_private.can_manage(u,p_department) OR NOT EXISTS(
  SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND active) THEN
  RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501';
 END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<date '1000-01-01' OR p_month>date '9998-12-01' THEN
  RAISE EXCEPTION 'Informe o primeiro dia de um mês válido.' USING errcode='22023';
 END IF;
 SELECT id INTO current_plan FROM iasdpi_pilot.schedule_plans WHERE department_id=p_department AND month=p_month;
 -- Somente pessoas do departamento solicitado. Conflitos externos são booleanos:
 -- não revelam departamento, nomes, observações ou detalhes das outras escalas.
 WITH occupied AS MATERIALIZED (
  SELECT a.person_id,a.department_id,a.plan_id,d.day,p.status FROM iasdpi_pilot.schedule_assignments a
  JOIN iasdpi_pilot.schedule_plans p ON p.id=a.plan_id
  CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(a) d(day)
  WHERE EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships m WHERE m.person_id=a.person_id AND m.department_id=p_department)
 UNION ALL SELECT l.person_id,l.department_id,NULL::uuid,l.scheduled_on,'published' FROM iasdpi_pilot.schedule_legacy_commitments l WHERE EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships m WHERE m.person_id=l.person_id AND m.department_id=p_department)
 ), days AS (SELECT generate_series(p_month::timestamp,(p_month+interval '1 month' - interval '1 day')::timestamp,interval '1 day')::date AS day)
 SELECT jsonb_build_object('month',p_month,'department_id',p_department,'basis_version',coalesce((SELECT version FROM iasdpi_pilot.schedule_plans WHERE id=current_plan),0),
 'history_scope','published-before-month','drafts_are_warnings',true,
 'people',coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',person.id,
  'history_count',(SELECT count(DISTINCT day) FROM occupied WHERE person_id=person.id AND department_id=p_department AND day<p_month AND status='published'),
  'last_day',(SELECT max(day) FROM occupied WHERE person_id=person.id AND department_id=p_department AND day<p_month AND status='published'),
  'global_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT day FROM occupied WHERE person_id=person.id AND (plan_id IS NULL OR plan_id IS DISTINCT FROM current_plan) AND status='published' AND day>=p_month AND day<(p_month+interval '1 month')::date) x),'[]'::jsonb),
  'department_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT day FROM occupied WHERE person_id=person.id AND department_id=p_department AND (plan_id IS NULL OR plan_id IS DISTINCT FROM current_plan) AND status='published' AND day>=p_month AND day<(p_month+interval '1 month')::date) x),'[]'::jsonb),
  'days',(SELECT jsonb_agg(jsonb_build_object('date',days.day,'state',iasdpi_pilot_private.day_availability(person.id,p_department,days.day),
   'conflict',EXISTS(SELECT 1 FROM occupied other WHERE other.person_id=person.id AND other.department_id<>p_department AND other.status='published' AND other.day=days.day
    AND NOT iasdpi_pilot_private.has_day_exception(person.id,days.day,p_department,other.department_id)),
   'draft_dispute',EXISTS(SELECT 1 FROM occupied other WHERE other.person_id=person.id AND other.department_id<>p_department AND other.status='draft' AND other.day=days.day)) ORDER BY days.day) FROM days)
 ) ORDER BY person.id) FROM iasdpi_pilot.schedule_people person WHERE EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships m WHERE m.person_id=person.id AND m.department_id=p_department)),'[]'::jsonb),
 'heads',coalesce((SELECT jsonb_agg(person.display_name ORDER BY person.display_name) FROM iasdpi_pilot.schedule_memberships member JOIN iasdpi_pilot.schedule_people person ON person.id=member.person_id
 WHERE member.department_id=p_department AND member.is_ministry_head AND member.active AND person.active),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;

-- Revalidação obrigatória inclusive em publicação parcial (status sem requirements).
ALTER FUNCTION public.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid) RENAME TO plan_save_007;
REVOKE ALL ON FUNCTION iasdpi_pilot_private.plan_save_007(uuid,bigint,jsonb,uuid) FROM public,anon,authenticated;
CREATE FUNCTION public.iasdpi_pilot_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb; a iasdpi_pilot.schedule_assignments; BEGIN
 result:=iasdpi_pilot_private.plan_save_007(p_id,p_expected_version,p_data,p_request_id);
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_plans WHERE id=p_id AND status='published') THEN
  FOR a IN SELECT * FROM iasdpi_pilot.schedule_assignments WHERE plan_id=p_id LOOP PERFORM iasdpi_pilot_private.validate_daily_assignment(a,true); END LOOP;
 END IF;
 RETURN result;
END $$;
-- Mapeamento explícito dos nomes históricos para UUIDs existentes. Nunca cria pessoas,
-- funções ou disponibilidade. Não transfere nem sobrescreve uma referência já registrada.
CREATE FUNCTION public.iasdpi_pilot_schedule_register_legacy(p_rows jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; row jsonb; old iasdpi_pilot.schedule_legacy_commitments; sig text; receipt iasdpi_pilot_operational.receipts; n integer:=0; result jsonb; BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador confirma identidades históricas.' USING errcode='42501'; END IF;
 IF p_request_id IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)>500 OR pg_column_size(p_rows)>500000 THEN RAISE EXCEPTION 'Referências inválidas.' USING errcode='22023'; END IF;
 sig:='schedule-legacy:'||iasdpi_pilot_operational.fingerprint(p_rows);
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023'; END IF;RETURN receipt.response; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF jsonb_typeof(row) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(row) k WHERE NOT k=ANY(ARRAY['source_key','person_id','department_id','date','original_name'])) THEN RAISE EXCEPTION 'Campos históricos inválidos.' USING errcode='22023'; END IF;
  SELECT * INTO old FROM iasdpi_pilot.schedule_legacy_commitments WHERE source_key=row->>'source_key';
  IF FOUND THEN
   IF old.person_id IS DISTINCT FROM (row->>'person_id')::uuid OR old.department_id IS DISTINCT FROM (row->>'department_id')::uuid OR old.scheduled_on IS DISTINCT FROM (row->>'date')::date OR old.original_name IS DISTINCT FROM row->>'original_name' THEN RAISE EXCEPTION 'Referência histórica já vinculada; não sobrescrita.' USING errcode='23505'; END IF;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships WHERE person_id=(row->>'person_id')::uuid AND department_id=(row->>'department_id')::uuid) THEN RAISE EXCEPTION 'Confirme o vínculo histórico da pessoa antes de importar.' USING errcode='23514'; END IF;
   INSERT INTO iasdpi_pilot.schedule_legacy_commitments(source_key,person_id,department_id,scheduled_on,original_name,created_by)
   VALUES(row->>'source_key',(row->>'person_id')::uuid,(row->>'department_id')::uuid,(row->>'date')::date,row->>'original_name',u);n:=n+1;
  END IF;
 END LOOP;
 -- Importação também não pode invalidar escalas publicadas já existentes.
 FOR old IN SELECT l.* FROM iasdpi_pilot.schedule_legacy_commitments l JOIN jsonb_array_elements(p_rows) j ON l.source_key=j->>'source_key' LOOP
  IF EXISTS(SELECT 1 FROM iasdpi_pilot_private.confirmed_days other WHERE other.person_id=old.person_id AND other.day=old.scheduled_on AND other.department_id<>old.department_id AND NOT iasdpi_pilot_private.has_day_exception(old.person_id,old.scheduled_on,old.department_id,other.department_id)) THEN RAISE EXCEPTION 'Conflito com compromisso confirmado; revise a identidade antes de importar.' USING errcode='23P01'; END IF;
 END LOOP;
 result:=jsonb_build_object('inserted',n,'considered',jsonb_array_length(p_rows));
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,version,changed_fields,reason) VALUES(u,'legacy-mapping',p_request_id,1,ARRAY['person_id','source_key'],'Mapeamento explícito; nomes e registros originais preservados.');
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now()); RETURN result;
END $$;
-- Uma exceção em uso por compromisso histórico também não pode ser revogada.
ALTER FUNCTION public.iasdpi_pilot_schedule_exception_save(uuid,bigint,jsonb) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_exception_save(uuid,bigint,jsonb) RENAME TO exception_save_007;
REVOKE ALL ON FUNCTION iasdpi_pilot_private.exception_save_007(uuid,bigint,jsonb) FROM public,anon,authenticated;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.exception_save_007(p_id uuid,p_expected_version bigint,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; old iasdpi_pilot.schedule_day_exceptions; a uuid; b uuid; person uuid; day date; v_enabled boolean; result jsonb; BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador autoriza exceções.' USING errcode='42501'; END IF;
 IF p_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['person_id','day','department_a','department_b','reason','enabled'])) THEN RAISE EXCEPTION 'Exceção inválida.' USING errcode='22023'; END IF;
 SELECT * INTO old FROM iasdpi_pilot.schedule_day_exceptions WHERE id=p_id;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Exceção mudou. Recarregue.' USING errcode='40001'; END IF;
 person:=coalesce(old.person_id,(p_data->>'person_id')::uuid);day:=coalesce(old.day,(p_data->>'day')::date);a:=least((p_data->>'department_a')::uuid,(p_data->>'department_b')::uuid);b:=greatest((p_data->>'department_a')::uuid,(p_data->>'department_b')::uuid);
 IF old.id IS NOT NULL THEN
  IF (p_data ? 'person_id' AND (p_data->>'person_id')::uuid IS DISTINCT FROM old.person_id) OR (p_data ? 'day' AND (p_data->>'day')::date IS DISTINCT FROM old.day) OR (a IS NOT NULL AND (a<>old.department_a OR b<>old.department_b)) THEN RAISE EXCEPTION 'A identidade da autorização não pode mudar.' USING errcode='22023'; END IF;
  a:=old.department_a;b:=old.department_b;
 END IF;
 IF person IS NULL OR day IS NULL OR a IS NULL OR b IS NULL OR a=b OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people WHERE id=person AND active) OR (SELECT count(*) FROM iasdpi_pilot.schedule_departments WHERE id IN (a,b) AND active)<>2 THEN RAISE EXCEPTION 'Pessoa, data ou departamentos inválidos.' USING errcode='22023'; END IF;
 v_enabled:=coalesce((p_data->>'enabled')::boolean,old.enabled,true);
 IF NOT v_enabled AND EXISTS(SELECT 1 FROM iasdpi_pilot_private.confirmed_days x JOIN iasdpi_pilot_private.confirmed_days y ON y.person_id=x.person_id AND y.day=x.day WHERE x.person_id=person AND x.department_id=a AND y.department_id=b AND x.day=coalesce(old.day,(p_data->>'day')::date)) THEN RAISE EXCEPTION 'Exceção em uso por compromissos confirmados; corrija uma das atribuições antes de revogar.' USING errcode='23514'; END IF;
 IF old.id IS NULL THEN
  INSERT INTO iasdpi_pilot.schedule_day_exceptions(id,person_id,day,department_a,department_b,reason,enabled,approved_by) VALUES(p_id,person,day,a,b,p_data->>'reason',v_enabled,u);
 ELSE UPDATE iasdpi_pilot.schedule_day_exceptions SET reason=coalesce(p_data->>'reason',reason),enabled=v_enabled,approved_by=CASE WHEN v_enabled AND NOT old.enabled THEN u ELSE approved_by END,approved_at=CASE WHEN v_enabled AND NOT old.enabled THEN now() ELSE approved_at END,revoked_by=CASE WHEN NOT v_enabled THEN u ELSE NULL END,revoked_at=CASE WHEN NOT v_enabled THEN now() ELSE NULL END,version=version+1 WHERE id=p_id; END IF;
 SELECT to_jsonb(x) INTO result FROM iasdpi_pilot.schedule_day_exceptions x WHERE id=p_id;
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,version,changed_fields,reason) VALUES(u,'daily-exception',p_id,(result->>'version')::bigint,ARRAY(SELECT jsonb_object_keys(p_data)),p_data->>'reason');RETURN result;
END $$;

CREATE FUNCTION public.iasdpi_pilot_schedule_exception_save(p_id uuid,p_expected_version bigint,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb; BEGIN
 result:=iasdpi_pilot_private.exception_save_007(p_id,p_expected_version,p_data);
 IF NOT (result->>'enabled')::boolean AND EXISTS(
  SELECT 1 FROM iasdpi_pilot_private.confirmed_days a JOIN iasdpi_pilot_private.confirmed_days b ON a.person_id=b.person_id AND a.day=b.day
  WHERE a.person_id=(result->>'person_id')::uuid AND a.day=(result->>'day')::date AND a.department_id=(result->>'department_a')::uuid AND b.department_id=(result->>'department_b')::uuid
 ) THEN RAISE EXCEPTION 'Exceção em uso por compromissos confirmados, inclusive históricos.' USING errcode='23514'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_schedule_exception_save(uuid,bigint,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_exception_save(uuid,bigint,jsonb) TO authenticated;
ALTER FUNCTION public.iasdpi_pilot_schedule_person_history(uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_person_history(uuid) RENAME TO person_history_007;
CREATE FUNCTION public.iasdpi_pilot_schedule_person_history(p_person uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb; BEGIN
 result:=iasdpi_pilot_private.person_history_007(p_person);
 RETURN result||jsonb_build_object('current',(result->'current')||coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'assigned_on',l.scheduled_on,'department',d.name,'role','Função histórica: Pendente de confirmação','status','Histórico manual — original preservado','original_name',l.original_name,'source_key',l.source_key) ORDER BY l.scheduled_on DESC) FROM iasdpi_pilot.schedule_legacy_commitments l JOIN iasdpi_pilot.schedule_departments d ON d.id=l.department_id WHERE l.person_id=p_person),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_schedule_person_history(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_person_history(uuid) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iasdpi_pilot_private FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_schedule_rotation_context(uuid,date),public.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid),public.iasdpi_pilot_schedule_register_legacy(jsonb,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_rotation_context(uuid,date),public.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid),public.iasdpi_pilot_schedule_register_legacy(jsonb,uuid) TO authenticated;

-- Regras reutilizadas de 010_simple_daily_schedules.sql
-- Montagem por dia: participação geral, disponibilidade padrão e preferências.
-- REVISÃO SOMENTE. Executar depois de 001–009, com autorização administrativa.
-- Não altera pessoas, disponibilidades, atribuições nem versões já gravadas.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('iasdpi_pilot.schedule_legacy_commitments') IS NULL
 OR to_regprocedure('iasdpi_pilot_private.plan_save_007(uuid,bigint,jsonb,uuid)') IS NULL THEN
  RAISE EXCEPTION 'Instale 001–009 como postgres antes da 010.';
 END IF;
END $$;

ALTER TABLE iasdpi_pilot.schedule_roles ADD COLUMN general_assignment boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX schedule_one_general_role ON iasdpi_pilot.schedule_roles(department_id) WHERE general_assignment;
-- O marcador não é editável pela RPC genérica da 005; não se concede escrita direta.
CREATE FUNCTION public.iasdpi_pilot_schedule_daily_role(p_department uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; row iasdpi_pilot.schedule_roles; BEGIN
 u:=iasdpi_pilot_private.actor();
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.can_manage(u,p_department) OR NOT EXISTS(
  SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND active) THEN
  RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501';
 END IF;
 SELECT * INTO row FROM iasdpi_pilot.schedule_roles WHERE department_id=p_department AND general_assignment;
 IF FOUND THEN
  IF NOT row.active THEN RAISE EXCEPTION 'Participação diária inativa. Revise o cadastro.' USING errcode='23514'; END IF;
 ELSE
  -- Nunca converte uma função técnica já cadastrada em participação geral.
  IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_roles WHERE department_id=p_department
   AND normalized_name=iasdpi_pilot_private.normal_name('Participação no departamento')) THEN
   RAISE EXCEPTION 'Já existe uma função com este nome. Revise antes de ativar a participação diária.' USING errcode='23505';
  END IF;
  INSERT INTO iasdpi_pilot.schedule_roles(department_id,name,general_assignment)
   VALUES(p_department,'Participação no departamento',true) RETURNING * INTO row;
  INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields)
   VALUES(u,'daily-participation',row.id,p_department,row.version,ARRAY['create']);
 END IF;
 RETURN to_jsonb(row)-'normalized_name';
END $$;

ALTER FUNCTION iasdpi_pilot_private.day_availability(uuid,uuid,date) RENAME TO day_availability_009;
CREATE FUNCTION iasdpi_pilot_private.day_availability(person uuid,department uuid,day date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE iasdpi_pilot_private.day_availability_009(person,department,day)
  WHEN 'unknown' THEN 'available' ELSE iasdpi_pilot_private.day_availability_009(person,department,day) END;
$$;

ALTER FUNCTION public.iasdpi_pilot_schedule_settings_get() SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_settings_get() RENAME TO settings_get_009;
CREATE FUNCTION public.iasdpi_pilot_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 RETURN iasdpi_pilot_private.settings_get_009()||jsonb_build_object(
  'simplified_daily',true,'availability_default','available','availability_advisory',true);
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_rotation_context(uuid,date) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_rotation_context(uuid,date) RENAME TO rotation_context_009;
CREATE FUNCTION public.iasdpi_pilot_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 RETURN iasdpi_pilot_private.rotation_context_009(p_department,p_month)||jsonb_build_object(
  'availability_default','available','availability_advisory',true);
END $$;

-- Preserva a versão anterior para revisão/rollback administrativo.
ALTER FUNCTION iasdpi_pilot_private.validate_daily_assignment(iasdpi_pilot.schedule_assignments,boolean) RENAME TO validate_daily_assignment_009;
CREATE FUNCTION iasdpi_pilot_private.validate_daily_assignment(a iasdpi_pilot.schedule_assignments,p_new boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req iasdpi_pilot.schedule_requirements; event iasdpi_pilot.schedule_events; v_day date; other record; BEGIN
 SELECT * INTO STRICT req FROM iasdpi_pilot.schedule_requirements WHERE id=a.requirement_id;
 SELECT * INTO STRICT event FROM iasdpi_pilot.schedule_events WHERE id=req.event_id;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people p
  JOIN iasdpi_pilot.schedule_memberships m ON m.person_id=p.id
  JOIN iasdpi_pilot.schedule_departments d ON d.id=m.department_id
  JOIN iasdpi_pilot.schedule_roles role ON role.id=req.role_id AND role.department_id=m.department_id
  WHERE p.id=a.person_id AND p.active AND m.active AND d.active AND role.active
   AND m.department_id=a.department_id AND (role.general_assignment OR EXISTS(
    SELECT 1 FROM iasdpi_pilot.schedule_qualifications q WHERE q.membership_id=m.id AND q.role_id=role.id))) THEN
  RAISE EXCEPTION 'Pessoa inativa, sem vínculo ativo ou sem habilitação para a função específica.' USING errcode='23514';
 END IF;
 IF a.timing_mode='day' AND a.assigned_on<>event.scheduled_on THEN
  RAISE EXCEPTION 'Data da atribuição difere do evento.' USING errcode='23514';
 END IF;
 IF a.timing_mode='timed' AND (event.starts_at IS NULL OR a.starts_at<event.starts_at
  OR a.ends_at>event.ends_at OR a.ends_at<=a.starts_at) THEN
  RAISE EXCEPTION 'Intervalo histórico fora do evento.' USING errcode='23514';
 END IF;
 IF p_new OR a.timing_mode='day' THEN
  FOR v_day IN SELECT * FROM iasdpi_pilot_private.assignment_days(a) LOOP
   FOR other IN SELECT DISTINCT x.department_id FROM iasdpi_pilot_private.confirmed_days x
    WHERE x.person_id=a.person_id AND x.assignment_id IS DISTINCT FROM a.id
     AND x.department_id<>a.department_id AND x.day=v_day LOOP
    IF NOT iasdpi_pilot_private.has_day_exception(a.person_id,v_day,a.department_id,other.department_id) THEN
     RAISE EXCEPTION 'Conflito: pessoa em dois departamentos na mesma data. Exceção exige administrador e justificativa.' USING errcode='23P01';
    END IF;
   END LOOP;
  END LOOP;
 END IF;
 -- Disponibilidade e limites são preferências do rodízio, não proibições manuais.
 -- A RPC de gravação e seus gatilhos mantêm locks, CAS, cobertura e revalidação.
END $$;

ALTER FUNCTION public.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid) RENAME TO plan_save_009;
CREATE FUNCTION public.iasdpi_pilot_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; a iasdpi_pilot.schedule_assignments; v_day date; reasons text[]; mon date; replayed boolean; BEGIN
 SELECT EXISTS(SELECT 1 FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id) INTO replayed;
 result:=iasdpi_pilot_private.plan_save_009(p_id,p_expected_version,p_data,p_request_id);
 -- Uma repetição idempotente devolve a confirmação original, sem duplicar auditoria.
 IF replayed OR (result->>'version')::bigint<>p_expected_version+1 OR EXISTS(
  SELECT 1 FROM iasdpi_pilot_private.audit_logs WHERE entity='manual-preference-override' AND entity_id=p_request_id) THEN RETURN result; END IF;
 reasons:='{}';
 FOR a IN SELECT * FROM iasdpi_pilot.schedule_assignments WHERE plan_id=p_id LOOP
  FOR v_day IN SELECT * FROM iasdpi_pilot_private.assignment_days(a) LOOP
   IF iasdpi_pilot_private.day_availability(a.person_id,a.department_id,v_day)='unavailable' THEN reasons:=array_append(reasons,'availability'); END IF;
   mon:=date_trunc('month',v_day)::date;
   IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people WHERE id=a.person_id AND max_monthly_count IS NOT NULL
    AND iasdpi_pilot_private.monthly_days(a,mon,false)>max_monthly_count) THEN reasons:=array_append(reasons,'monthly-limit'); END IF;
   IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships WHERE person_id=a.person_id AND department_id=a.department_id AND max_monthly_count IS NOT NULL
    AND iasdpi_pilot_private.monthly_days(a,mon,true)>max_monthly_count) THEN reasons:=array_append(reasons,'department-limit'); END IF;
  END LOOP;
 END LOOP;
 IF cardinality(reasons)>0 THEN
  INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields,reason)
   VALUES(iasdpi_pilot_private.actor(),'manual-preference-override',p_request_id,(result->>'department_id')::uuid,(result->>'version')::bigint,
    ARRAY(SELECT DISTINCT unnest(reasons)),'Escolha manual permitida fora das preferências do automático.');
 END IF;
 RETURN result;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iasdpi_pilot_private FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_schedule_daily_role(uuid),public.iasdpi_pilot_schedule_settings_get(),
 public.iasdpi_pilot_schedule_rotation_context(uuid,date),public.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_daily_role(uuid),public.iasdpi_pilot_schedule_settings_get(),
 public.iasdpi_pilot_schedule_rotation_context(uuid,date),public.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.actor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_admin.uid();BEGIN
 IF u IS NULL OR coalesce(iasdpi_pilot_admin.jwt()->>'is_anonymous','false')='true'
 OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot_admin.auth_accounts WHERE id=u AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false))
 OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_access WHERE user_id=u AND enabled AND role='admin') THEN RAISE EXCEPTION 'Administrador ativo do piloto necessário.' USING errcode='42501';END IF;
 RETURN u;END $$;
-- Administração de contas não é um recurso do piloto. Apenas operador poderá
-- conceder/revogar a tabela privada de administradores; a UI não autoeleva contas.
-- Departamentos já confirmados no portal; não cria pessoas/contas/habilitações.
INSERT INTO iasdpi_pilot.schedule_departments(code,name) VALUES
 ('comunicacao','Comunicação'),('ministerio-da-familia','Ministério da Família'),('ministerio-da-crianca','Ministério da Criança');

UPDATE iasdpi_pilot_admin.installation SET step=1 WHERE singleton;
SELECT iasdpi_pilot_admin.assert_core_unchanged();
NOTIFY pgrst,'reload schema';
COMMIT;
