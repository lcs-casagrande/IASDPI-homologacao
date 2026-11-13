-- IASDPI piloto ISOLADO. Não executar no Supabase sem autorização e recuperação revisada.
BEGIN;
DO $$ BEGIN IF (SELECT step FROM iasdpi_pilot_admin.installation WHERE singleton)<>3 THEN RAISE EXCEPTION 'Ordem de instalação inválida; não reaplicar.';END IF;END $$;

-- Regras reutilizadas de 020_calendar_events.sql
-- E1: eventos editoriais. Revisar após 001–019; não importa nem modifica dados existentes.
-- schedule_events continua representando eventos técnicos de participação nas escalas.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('iasdpi_pilot_private.person_aliases') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='iasdpi_pilot_executor') THEN
 RAISE EXCEPTION 'Exige postgres e a cadeia 001–019 completa.';END IF;
 IF to_regclass('iasdpi_pilot.iasdpi_events') IS NOT NULL THEN RAISE EXCEPTION '020 já instalada; não sobrescrever.';END IF;
END $$;

CREATE TABLE iasdpi_pilot.iasdpi_events(
 id uuid PRIMARY KEY,church_id uuid NOT NULL DEFAULT public.iasdpi_pilot_current_church_id() REFERENCES iasdpi_pilot.iasdpi_churches(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160),
 date date NOT NULL,end_date date NOT NULL CHECK(end_date>=date AND end_date<=date+366),
 all_day boolean NOT NULL DEFAULT false,
 start_time time,end_time time,CHECK(NOT all_day OR start_time IS NULL AND end_time IS NULL),CHECK(status<>'published' OR end_time IS NULL OR start_time IS NOT NULL),
 CHECK(end_date>date OR end_time IS NULL OR end_time>start_time),
 location text NOT NULL DEFAULT '' CHECK(length(location)<=500),description text NOT NULL DEFAULT '' CHECK(length(description)<=5000),
 category text CHECK(category IN('church','department')),department_id uuid,
 CHECK(department_id IS NULL OR category IS NOT DISTINCT FROM 'department'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published','cancelled')),
 version bigint NOT NULL CHECK(version>0),source_key text CHECK(length(source_key) BETWEEN 1 AND 500),
 source_url text CHECK(source_url='https://iasd-paradainglesa.netlify.app/'),
 CHECK((source_key IS NULL)=(source_url IS NULL)),
 cancellation_reason text NOT NULL DEFAULT '' CHECK(length(cancellation_reason)<=2000),
 created_by uuid NOT NULL,updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(church_id,id),UNIQUE(church_id,source_key),
 FOREIGN KEY(church_id,department_id) REFERENCES iasdpi_pilot.schedule_departments(church_id,id)
);
CREATE INDEX iasdpi_events_period ON iasdpi_pilot.iasdpi_events(church_id,date,end_date);
CREATE INDEX iasdpi_events_department ON iasdpi_pilot.iasdpi_events(church_id,department_id,status);
CREATE UNIQUE INDEX iasdpi_events_identity ON iasdpi_pilot.iasdpi_events(church_id,
 iasdpi_pilot_private.normal_name(title),date,end_date,coalesce(start_time::text,''),coalesce(end_time::text,''),
 coalesce(category,''),coalesce(department_id::text,''),iasdpi_pilot_private.normal_name(location));
CREATE TABLE iasdpi_pilot.iasdpi_event_versions(
 church_id uuid NOT NULL DEFAULT public.iasdpi_pilot_current_church_id(),event_id uuid NOT NULL,version bigint NOT NULL,
 actor_id uuid NOT NULL,captured_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL CHECK(status IN('draft','published','cancelled')),snapshot jsonb NOT NULL,
 PRIMARY KEY(church_id,event_id,version),FOREIGN KEY(church_id,event_id) REFERENCES iasdpi_pilot.iasdpi_events(church_id,id)
);
CREATE INDEX iasdpi_event_versions_public ON iasdpi_pilot.iasdpi_event_versions(church_id,event_id,version DESC) WHERE status IN('published','cancelled');
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['iasdpi_events','iasdpi_event_versions'] LOOP
 EXECUTE format('ALTER TABLE iasdpi_pilot.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE iasdpi_pilot.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON iasdpi_pilot.%I FROM public,anon,authenticated,service_role',t);
 EXECUTE format('CREATE POLICY church_boundary ON iasdpi_pilot.%I AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id())',t);
 EXECUTE format('CREATE POLICY church_executor ON iasdpi_pilot.%I FOR ALL TO iasdpi_pilot_executor USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id())',t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON iasdpi_pilot.iasdpi_events TO iasdpi_pilot_executor;
GRANT SELECT,INSERT ON iasdpi_pilot.iasdpi_event_versions TO iasdpi_pilot_executor;

CREATE FUNCTION iasdpi_pilot_private.event_can(u uuid,category text,department uuid,cap text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_pilot_private.is_admin(u) OR (category='department' AND department IS NOT NULL
 AND iasdpi_pilot_private.has_capability(u,department,cap));
$$;
CREATE FUNCTION public.iasdpi_pilot_events_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();BEGIN
 RETURN jsonb_build_object('is_admin',iasdpi_pilot_private.is_admin(u),'departments',coalesce((SELECT jsonb_agg(jsonb_build_object(
 'id',d.id,'name',d.name,'code',d.code,'can_edit',iasdpi_pilot_private.has_capability(u,d.id,'edit'),
 'can_publish',iasdpi_pilot_private.has_capability(u,d.id,'publish')) ORDER BY d.name)
 FROM iasdpi_pilot.schedule_departments d WHERE d.active AND (iasdpi_pilot_private.is_admin(u) OR iasdpi_pilot_private.can_view(u,d.id))),'[]'),
 'events',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('can_edit',iasdpi_pilot_private.event_can(u,e.category,e.department_id,'edit'),
 'can_publish',iasdpi_pilot_private.event_can(u,e.category,e.department_id,'publish')) ORDER BY e.date,e.title)
 FROM iasdpi_pilot.iasdpi_events e WHERE iasdpi_pilot_private.is_admin(u) OR e.category='department' AND iasdpi_pilot_private.can_view(u,e.department_id)),'[]'));
END $$;

CREATE FUNCTION public.iasdpi_pilot_event_save(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;old iasdpi_pilot.iasdpi_events;e iasdpi_pilot.iasdpi_events;c uuid;sig text;r iasdpi_pilot_operational.receipts;
 result jsonb;needs_edit boolean;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_pilot_private.actor();c:=public.iasdpi_pilot_current_church_id();
 IF p_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_request_id IS NULL OR p_patch IS NULL OR jsonb_typeof(p_patch)<>'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('title','date','end_date','all_day','start_time','end_time','location','description','category','department_id','status','source_key','source_url','cancellation_reason')) THEN
 RAISE EXCEPTION 'Campos, identificador ou versão inválidos.' USING errcode='22023';END IF;
 SELECT * INTO old FROM iasdpi_pilot.iasdpi_events WHERE id=p_id FOR UPDATE;
 e:=jsonb_populate_record(NULL::iasdpi_pilot.iasdpi_events,coalesce(to_jsonb(old),'{}')||p_patch);
 needs_edit:=old.id IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('status','cancellation_reason')) OR coalesce(e.status,'draft')='draft';
 IF (needs_edit AND (NOT coalesce(iasdpi_pilot_private.event_can(u,e.category,e.department_id,'edit'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_pilot_private.event_can(u,old.category,old.department_id,'edit'),false)))
 OR (e.status IN('published','cancelled') AND (NOT coalesce(iasdpi_pilot_private.event_can(u,e.category,e.department_id,'publish'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_pilot_private.event_can(u,old.category,old.department_id,'publish'),false))) THEN
 RAISE EXCEPTION 'Sem permissão para gerir ou publicar este evento nesta igreja e departamento.' USING errcode='42501';END IF;
 sig:='events-e1:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('church',c,'id',p_id,'version',p_expected_version,'patch',p_patch));
 SELECT * INTO r FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Evento alterado em outro dispositivo. Recarregue e compare; suas alterações não foram salvas.' USING errcode='40001';END IF;
 IF e.source_key IS NOT NULL AND (old.id IS NULL OR e.source_key IS DISTINCT FROM old.source_key) AND NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador associa eventos da fonte oficial.' USING errcode='42501';END IF;
 IF old.source_key IS NOT NULL AND (e.source_key IS DISTINCT FROM old.source_key OR e.source_url IS DISTINCT FROM old.source_url) THEN
 RAISE EXCEPTION 'A associação da fonte existente não pode ser substituída.' USING errcode='22023';END IF;
 IF e.source_key IS NOT NULL AND c<>'1a5d0000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Fonte exclusiva da IASD_PI.' USING errcode='42501';END IF;
 IF old.id IS NULL THEN
 e.all_day:=coalesce(e.all_day,false);e.status:=coalesce(e.status,'draft');e.created_by:=u;e.created_at:=now();e.location:=coalesce(e.location,'');e.description:=coalesce(e.description,'');e.cancellation_reason:=coalesce(e.cancellation_reason,'');
 END IF;
 IF NOT p_patch ? 'end_date' AND (old.id IS NULL OR old.end_date=old.date) THEN e.end_date:=e.date;END IF;
 IF e.status='published' AND e.end_time IS NOT NULL AND e.start_time IS NULL THEN RAISE EXCEPTION 'Horário inicial pendente. Confirme antes de publicar.' USING errcode='23514';END IF;
 IF e.status='published' AND (e.category IS NULL OR e.category='department' AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d WHERE d.id=e.department_id AND d.active)) THEN
 RAISE EXCEPTION 'Confirme a categoria e o departamento responsável antes de publicar.' USING errcode='23514';END IF;
 e.id:=p_id;e.church_id:=c;e.version:=coalesce(old.version,0)+1;e.updated_by:=u;e.updated_at:=now();
 IF old.id IS NULL THEN INSERT INTO iasdpi_pilot.iasdpi_events SELECT e.*;
 ELSE UPDATE iasdpi_pilot.iasdpi_events SET title=e.title,date=e.date,end_date=e.end_date,all_day=e.all_day,start_time=e.start_time,end_time=e.end_time,
 location=e.location,description=e.description,category=e.category,department_id=e.department_id,status=e.status,source_key=e.source_key,source_url=e.source_url,
 cancellation_reason=e.cancellation_reason,version=e.version,updated_by=u,updated_at=e.updated_at WHERE id=p_id;END IF;
 INSERT INTO iasdpi_pilot.iasdpi_event_versions(church_id,event_id,version,actor_id,status,snapshot) VALUES(c,p_id,e.version,u,e.status,to_jsonb(e));
 result:=to_jsonb(e);INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;

CREATE FUNCTION public.iasdpi_pilot_event_history(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();e iasdpi_pilot.iasdpi_events;BEGIN
 SELECT * INTO e FROM iasdpi_pilot.iasdpi_events WHERE id=p_id;
 IF e.id IS NULL OR NOT (iasdpi_pilot_private.is_admin(u) OR e.category='department' AND iasdpi_pilot_private.can_view(u,e.department_id)) THEN
 RAISE EXCEPTION 'Histórico indisponível para esta identidade.' USING errcode='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY version DESC) FROM iasdpi_pilot.iasdpi_event_versions v WHERE event_id=p_id),'[]');
END $$;
CREATE FUNCTION public.iasdpi_pilot_events_published(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_month IS NULL OR extract(day FROM p_month)<>1 THEN RAISE EXCEPTION 'Informe o primeiro dia do mês.' USING errcode='22023';END IF;
 -- A ponte existente valida igreja ativa/listada sem conceder SELECT direto na tabela.
 PERFORM public.iasdpi_pilot_current_church_id();
 RETURN (WITH latest AS(SELECT DISTINCT ON(event_id) event_id,status,snapshot FROM iasdpi_pilot.iasdpi_event_versions WHERE status IN('published','cancelled') ORDER BY event_id,version DESC)
 SELECT jsonb_build_object('events',coalesce((SELECT jsonb_agg((l.snapshot-'created_by'-'updated_by'-'cancellation_reason')||jsonb_build_object('department_name',d.name) ORDER BY l.snapshot->>'date',l.snapshot->>'title')
 FROM latest l LEFT JOIN iasdpi_pilot.schedule_departments d ON d.id=(l.snapshot->>'department_id')::uuid WHERE l.status='published'
 AND (l.snapshot->>'date')::date < (p_month+interval '1 month')::date AND (l.snapshot->>'end_date')::date>=p_month),'[]'),
 'suppressed_source_keys',coalesce((SELECT jsonb_agg(DISTINCT snapshot->>'source_key') FROM latest WHERE snapshot->>'source_key' IS NOT NULL),'[]')));
END $$;

GRANT CREATE ON SCHEMA public,iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 n.nspname='public' AND p.proname IN('iasdpi_pilot_events_catalog','iasdpi_pilot_event_save','iasdpi_pilot_event_history','iasdpi_pilot_events_published') OR n.nspname='iasdpi_pilot_private' AND p.proname='event_can' LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_events_published(date) TO anon;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private FROM iasdpi_pilot_executor;

-- Regras reutilizadas de 021_calendar_classification_privacy.sql
-- 021: classificação editorial e privacidade, após 001–020. Não importa ou reclassifica dados.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('iasdpi_pilot.iasdpi_events') IS NULL OR to_regprocedure('public.iasdpi_pilot_events_published(date)') IS NULL THEN RAISE EXCEPTION 'Exige postgres e 001–020 completas.';END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='iasdpi_pilot' AND table_name='iasdpi_events' AND column_name='is_restricted') THEN RAISE EXCEPTION '021 já instalada; revisar sem sobrescrever.';END IF;
END $$;
ALTER TABLE iasdpi_pilot.iasdpi_events
 ADD COLUMN program_category text CHECK(program_category IN('general','departmental','reserved')),
 ADD COLUMN organizer_kind text CHECK(organizer_kind IN('local_church','association','school','department','other')),
 ADD COLUMN audience text CHECK(audience IN('whole_church','specific','restricted')),
 ADD COLUMN is_restricted boolean NOT NULL DEFAULT false,
 ADD COLUMN organizer_department_id uuid,
 ADD CONSTRAINT events_organizer_department_fk FOREIGN KEY(church_id,organizer_department_id) REFERENCES iasdpi_pilot.schedule_departments(church_id,id),
 ADD CONSTRAINT events_organizer_kind CHECK(organizer_department_id IS NULL OR organizer_kind IS NOT DISTINCT FROM 'department');
-- category/department_id continuam sendo o escopo de autorização. Não substituir por program_category.
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_event_save(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;old iasdpi_pilot.iasdpi_events;e iasdpi_pilot.iasdpi_events;c uuid;sig text;r iasdpi_pilot_operational.receipts;
 result jsonb;needs_edit boolean;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_pilot_private.actor();c:=public.iasdpi_pilot_current_church_id();
 IF p_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_request_id IS NULL OR p_patch IS NULL OR jsonb_typeof(p_patch)<>'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('title','date','end_date','all_day','start_time','end_time','location','description','category','department_id','status','source_key','source_url','cancellation_reason','program_category','organizer_kind','audience','is_restricted','organizer_department_id')) THEN
 RAISE EXCEPTION 'Campos, identificador ou versão inválidos.' USING errcode='22023';END IF;
 SELECT * INTO old FROM iasdpi_pilot.iasdpi_events WHERE id=p_id FOR UPDATE;
 e:=jsonb_populate_record(NULL::iasdpi_pilot.iasdpi_events,coalesce(to_jsonb(old),'{}')||p_patch);
 needs_edit:=old.id IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('status','cancellation_reason')) OR coalesce(e.status,'draft')='draft';
 IF (needs_edit AND (NOT coalesce(iasdpi_pilot_private.event_can(u,e.category,e.department_id,'edit'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_pilot_private.event_can(u,old.category,old.department_id,'edit'),false)))
 OR (e.status IN('published','cancelled') AND (NOT coalesce(iasdpi_pilot_private.event_can(u,e.category,e.department_id,'publish'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_pilot_private.event_can(u,old.category,old.department_id,'publish'),false))) THEN
 RAISE EXCEPTION 'Sem permissão para gerir ou publicar este evento nesta igreja e departamento.' USING errcode='42501';END IF;
 sig:='events-e21:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('church',c,'id',p_id,'version',p_expected_version,'patch',p_patch));
 SELECT * INTO r FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Evento alterado em outro dispositivo. Recarregue e compare; suas alterações não foram salvas.' USING errcode='40001';END IF;
 IF e.source_key IS NOT NULL AND (old.id IS NULL OR e.source_key IS DISTINCT FROM old.source_key) AND NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador associa eventos da fonte oficial.' USING errcode='42501';END IF;
 IF old.source_key IS NOT NULL AND (e.source_key IS DISTINCT FROM old.source_key OR e.source_url IS DISTINCT FROM old.source_url) THEN
 RAISE EXCEPTION 'A associação da fonte existente não pode ser substituída.' USING errcode='22023';END IF;
 IF e.source_key IS NOT NULL AND c<>'1a5d0000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Fonte exclusiva da IASD_PI.' USING errcode='42501';END IF;
 IF old.id IS NULL THEN
 e.is_restricted:=coalesce(e.is_restricted,false);e.all_day:=coalesce(e.all_day,false);e.status:=coalesce(e.status,'draft');e.created_by:=u;e.created_at:=now();e.location:=coalesce(e.location,'');e.description:=coalesce(e.description,'');e.cancellation_reason:=coalesce(e.cancellation_reason,'');
 END IF;
 IF NOT p_patch ? 'end_date' AND (old.id IS NULL OR old.end_date=old.date) THEN e.end_date:=e.date;END IF;
 IF e.status='published' AND e.end_time IS NOT NULL AND e.start_time IS NULL THEN RAISE EXCEPTION 'Horário inicial pendente. Confirme antes de publicar.' USING errcode='23514';END IF;
 IF e.status='published' AND (e.category IS NULL OR e.category='department' AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d WHERE d.id=e.department_id AND d.active)) THEN
 RAISE EXCEPTION 'Confirme a categoria e o departamento responsável antes de publicar.' USING errcode='23514';END IF;
 e.id:=p_id;e.church_id:=c;e.version:=coalesce(old.version,0)+1;e.updated_by:=u;e.updated_at:=now();
 IF old.id IS NULL THEN INSERT INTO iasdpi_pilot.iasdpi_events SELECT e.*;
 ELSE UPDATE iasdpi_pilot.iasdpi_events SET title=e.title,date=e.date,end_date=e.end_date,all_day=e.all_day,start_time=e.start_time,end_time=e.end_time,
 program_category=e.program_category,organizer_kind=e.organizer_kind,audience=e.audience,is_restricted=e.is_restricted,organizer_department_id=e.organizer_department_id,location=e.location,description=e.description,category=e.category,department_id=e.department_id,status=e.status,source_key=e.source_key,source_url=e.source_url,
 cancellation_reason=e.cancellation_reason,version=e.version,updated_by=u,updated_at=e.updated_at WHERE id=p_id;END IF;
 INSERT INTO iasdpi_pilot.iasdpi_event_versions(church_id,event_id,version,actor_id,status,snapshot) VALUES(c,p_id,e.version,u,e.status,to_jsonb(e));
 result:=to_jsonb(e);INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;

-- Projeção comum: consulta pública nunca recebe título, local ou descrição de evento restrito.
CREATE FUNCTION iasdpi_pilot_private.calendar_events_feed(p_month date,p_private boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 PERFORM public.iasdpi_pilot_current_church_id();
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<'1000-01-01' OR p_month>'9998-12-01' THEN RAISE EXCEPTION 'Informe o primeiro dia de um mês válido.' USING errcode='22023';END IF;
 IF p_private THEN u:=iasdpi_pilot_private.actor();END IF;
 RETURN (WITH latest AS(SELECT DISTINCT ON(event_id) event_id,status,snapshot FROM iasdpi_pilot.iasdpi_event_versions WHERE status IN('published','cancelled') ORDER BY event_id,version DESC)
 SELECT jsonb_build_object('events',coalesce((SELECT jsonb_agg((l.snapshot-'created_by'-'updated_by'-'cancellation_reason')||jsonb_build_object('department_name',d.name)
 ORDER BY l.snapshot->>'date',l.snapshot->>'title') FROM latest l JOIN iasdpi_pilot.iasdpi_events e ON e.id=l.event_id
 LEFT JOIN iasdpi_pilot.schedule_departments d ON d.id=(l.snapshot->>'department_id')::uuid
 WHERE l.status='published' AND (l.snapshot->>'date')::date<(p_month+interval '1 month')::date AND (l.snapshot->>'end_date')::date>=p_month
 AND ((NOT e.is_restricted AND NOT coalesce((l.snapshot->>'is_restricted')::boolean,false)) OR
 p_private AND (iasdpi_pilot_private.is_admin(u) OR l.snapshot->>'category'='department' AND iasdpi_pilot_private.can_view(u,(l.snapshot->>'department_id')::uuid)))),'[]'),
 -- IDs de origem somente de fotografias não restritas. Não retornar metadados de registros ocultos.
 'suppressed_source_keys',coalesce((SELECT jsonb_agg(DISTINCT l.snapshot->>'source_key') FROM latest l JOIN iasdpi_pilot.iasdpi_events e ON e.id=l.event_id
 WHERE l.snapshot->>'source_key' IS NOT NULL AND NOT e.is_restricted AND NOT coalesce((l.snapshot->>'is_restricted')::boolean,false)),'[]')));
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_events_published(p_month date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_pilot_private.calendar_events_feed(p_month,false); $$;
CREATE FUNCTION public.iasdpi_pilot_events_visible(p_month date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_pilot_private.calendar_events_feed(p_month,true); $$;

-- A implementação 015 é preservada como helper privado. O endpoint antigo passa a devolver só Ancionato.
ALTER FUNCTION public.iasdpi_pilot_schedule_published(date) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_published(date) RENAME TO published_before_privacy;
REVOKE ALL ON FUNCTION iasdpi_pilot_private.published_before_privacy(date) FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.iasdpi_pilot_schedule_published(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE rows jsonb;BEGIN
 rows:=iasdpi_pilot_private.published_before_privacy(p_month);
 RETURN coalesce((SELECT jsonb_agg(r) FROM jsonb_array_elements(rows) r WHERE EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d WHERE d.id=(r->>'department_id')::uuid AND d.code='ancionato' AND d.active)),'[]');
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_visible(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();rows jsonb;BEGIN
 rows:=iasdpi_pilot_private.published_before_privacy(p_month);
 RETURN coalesce((SELECT jsonb_agg(r) FROM jsonb_array_elements(rows) r WHERE EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d
 WHERE d.id=(r->>'department_id')::uuid AND (d.code='ancionato' OR iasdpi_pilot_private.can_view(u,d.id)))),'[]')||
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.source_key,'date',l.scheduled_on,'department_id',d.id,'department',d.name,'person_id',p.id,
 'person',p.display_name,'original_person',l.original_name,'role',NULL,'origin','Histórico manual confirmado','legacy',true) ORDER BY l.scheduled_on,l.source_key)
 FROM iasdpi_pilot.schedule_legacy_commitments l JOIN iasdpi_pilot.schedule_departments d ON d.id=l.department_id JOIN iasdpi_pilot.schedule_people p ON p.id=l.person_id
 WHERE l.scheduled_on>=p_month AND l.scheduled_on<(p_month+interval '1 month')::date AND iasdpi_pilot_private.can_view(u,d.id)),'[]');
END $$;
-- Retira associações históricas privadas do endpoint público de nomes/organograma.
ALTER FUNCTION public.iasdpi_pilot_registry_public() SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_registry_public() RENAME TO registry_before_privacy;
REVOKE ALL ON FUNCTION iasdpi_pilot_private.registry_before_privacy() FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.iasdpi_pilot_registry_public() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb;BEGIN
 c:=iasdpi_pilot_private.registry_before_privacy();
 RETURN c||jsonb_build_object('links',coalesce((SELECT jsonb_agg(link) FROM jsonb_array_elements(c->'links') link
 WHERE left(link->>'source_key',9)='ministry:' OR EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_source_links s JOIN iasdpi_pilot.schedule_departments d ON d.id=(s.reference->>'department_id')::uuid
 WHERE s.source_key=link->>'source_key' AND s.reference->>'kind' IN('weekly','monthly') AND d.code='ancionato')),'[]'));
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 n.nspname='public' AND p.proname IN('iasdpi_pilot_event_save','iasdpi_pilot_events_published','iasdpi_pilot_events_visible','iasdpi_pilot_schedule_published','iasdpi_pilot_schedule_visible','iasdpi_pilot_registry_public')
 OR n.nspname='iasdpi_pilot_private' AND p.proname IN('calendar_events_feed','published_before_privacy','registry_before_privacy') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_events_published(date),public.iasdpi_pilot_schedule_published(date),public.iasdpi_pilot_registry_public() TO anon;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private FROM iasdpi_pilot_executor;

-- Regras reutilizadas de 022_event_planning.sql
-- 022: eventos recorrentes, locais e aprovação. Executar SOMENTE após revisão e 001–021.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('iasdpi_pilot_private.calendar_events_feed(date,boolean)') IS NULL THEN RAISE EXCEPTION 'Exige postgres e 001–021.';END IF;
 IF to_regclass('iasdpi_pilot.iasdpi_event_series') IS NOT NULL THEN RAISE EXCEPTION '022 já instalada; não sobrescrever.';END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE TABLE iasdpi_pilot.iasdpi_event_spaces(
 church_id uuid NOT NULL REFERENCES iasdpi_pilot.iasdpi_churches(id),code text NOT NULL,name text NOT NULL,exclusive boolean NOT NULL,
 PRIMARY KEY(church_id,code),CHECK(code IN('nave','quadra','patio','salas','externo')));
INSERT INTO iasdpi_pilot.iasdpi_event_spaces SELECT c.id,v.* FROM iasdpi_pilot.iasdpi_churches c CROSS JOIN(VALUES
 ('nave','Nave',true),('quadra','Quadra',true),('patio','Pátio',true),('salas','Salas',false),('externo','Externo',false)) v(code,name,exclusive) WHERE c.code='IASD_PI';
CREATE TABLE iasdpi_pilot.iasdpi_event_series(
 id uuid PRIMARY KEY,church_id uuid NOT NULL DEFAULT public.iasdpi_pilot_current_church_id() REFERENCES iasdpi_pilot.iasdpi_churches(id),
 definition jsonb NOT NULL,until_date date NOT NULL,version bigint NOT NULL,
 approval_status text NOT NULL CHECK(approval_status IN('not_required','pending','approved','rejected')),
 category text,department_id uuid,created_by uuid NOT NULL,updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(church_id,id),
 FOREIGN KEY(church_id,department_id) REFERENCES iasdpi_pilot.schedule_departments(church_id,id));
CREATE TABLE iasdpi_pilot.iasdpi_event_series_versions(
 church_id uuid NOT NULL,event_series_id uuid NOT NULL,version bigint NOT NULL,actor_id uuid NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now(),snapshot jsonb NOT NULL,PRIMARY KEY(church_id,event_series_id,version),
 FOREIGN KEY(church_id,event_series_id) REFERENCES iasdpi_pilot.iasdpi_event_series(church_id,id));
ALTER TABLE iasdpi_pilot.iasdpi_events ADD COLUMN spaces text[],ADD COLUMN approval_status text NOT NULL DEFAULT 'legacy'
 CHECK(approval_status IN('legacy','not_required','pending','approved','rejected')),
 ADD COLUMN series_id uuid,ADD COLUMN occurrence_on date,ADD COLUMN reservation_conflicts jsonb NOT NULL DEFAULT '[]',
 ADD CONSTRAINT event_series_fk FOREIGN KEY(church_id,series_id) REFERENCES iasdpi_pilot.iasdpi_event_series(church_id,id),
 ADD CONSTRAINT event_occurrence_identity CHECK((series_id IS NULL)=(occurrence_on IS NULL));
-- Preserva a identidade anterior e diferencia os conjuntos de locais novos.
CREATE FUNCTION iasdpi_pilot_private.event_space_key(codes text[]) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT coalesce(string_agg(length(x)::text||':'||x,';' ORDER BY x),'') FROM unnest(codes) x; $$;
DROP INDEX iasdpi_pilot.iasdpi_events_identity;
CREATE UNIQUE INDEX iasdpi_events_identity ON iasdpi_pilot.iasdpi_events(church_id,
 iasdpi_pilot_private.normal_name(title),date,end_date,coalesce(start_time::text,''),coalesce(end_time::text,''),
 coalesce(category,''),coalesce(department_id::text,''),iasdpi_pilot_private.normal_name(location),iasdpi_pilot_private.event_space_key(spaces));
CREATE UNIQUE INDEX event_occurrence_unique ON iasdpi_pilot.iasdpi_events(church_id,series_id,occurrence_on) WHERE series_id IS NOT NULL;
CREATE TABLE iasdpi_pilot.iasdpi_event_reservations(
 church_id uuid NOT NULL,event_id uuid NOT NULL,space_code text NOT NULL,occupied tstzrange NOT NULL,
 PRIMARY KEY(church_id,event_id,space_code),FOREIGN KEY(church_id,event_id) REFERENCES iasdpi_pilot.iasdpi_events(church_id,id),
 FOREIGN KEY(church_id,space_code) REFERENCES iasdpi_pilot.iasdpi_event_spaces(church_id,code),CHECK(NOT isempty(occupied)));
DO $$ DECLARE n text;BEGIN
 SELECT ns.nspname INTO n FROM pg_extension x JOIN pg_namespace ns ON ns.oid=x.extnamespace WHERE x.extname='btree_gist';
 EXECUTE format('ALTER TABLE iasdpi_pilot.iasdpi_event_reservations ADD CONSTRAINT exclusive_event_space EXCLUDE USING gist(church_id %I.gist_uuid_ops WITH =,space_code %I.gist_text_ops WITH =,occupied WITH &&)',n,n);
END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['iasdpi_event_spaces','iasdpi_event_series','iasdpi_event_series_versions','iasdpi_event_reservations'] LOOP
 EXECUTE format('ALTER TABLE iasdpi_pilot.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE iasdpi_pilot.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON iasdpi_pilot.%I FROM public,anon,authenticated,service_role',t);
 EXECUTE format('CREATE POLICY church_boundary ON iasdpi_pilot.%I AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id())',t);
 EXECUTE format('CREATE POLICY church_executor ON iasdpi_pilot.%I FOR ALL TO iasdpi_pilot_executor USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id())',t);
 END LOOP;
END $$;
GRANT SELECT ON iasdpi_pilot.iasdpi_event_spaces TO iasdpi_pilot_executor;
GRANT SELECT,INSERT,UPDATE ON iasdpi_pilot.iasdpi_event_series TO iasdpi_pilot_executor;
GRANT SELECT,INSERT ON iasdpi_pilot.iasdpi_event_series_versions TO iasdpi_pilot_executor;
GRANT SELECT,INSERT,DELETE ON iasdpi_pilot.iasdpi_event_reservations TO iasdpi_pilot_executor;
CREATE FUNCTION iasdpi_pilot_private.event_interval(e jsonb) RETURNS tstzrange
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ DECLARE a timestamptz;b timestamptz;BEGIN
 IF coalesce((e->>'all_day')::boolean,false) THEN a:=(e->>'date')::date::timestamp AT TIME ZONE 'America/Sao_Paulo';b:=((coalesce(nullif(e->>'end_date',''),e->>'date'))::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
 ELSE IF nullif(e->>'start_time','') IS NULL OR nullif(e->>'end_time','') IS NULL THEN RETURN NULL;END IF;
 a:=((e->>'date')::date+(e->>'start_time')::time) AT TIME ZONE 'America/Sao_Paulo';b:=(coalesce(nullif(e->>'end_date',''),e->>'date')::date+(e->>'end_time')::time) AT TIME ZONE 'America/Sao_Paulo';END IF;
 IF b<=a THEN RAISE EXCEPTION 'O término deve ocorrer após o início.' USING errcode='23514';END IF;RETURN tstzrange(a,b,'[)');END $$;
CREATE FUNCTION iasdpi_pilot_private.event_dates(p_data jsonb,p_until date) RETURNS date[]
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ DECLARE first_day date:=(p_data->>'date')::date;last_day date;d date;out date[]:='{}';freq text:=coalesce(p_data->>'recurrence','none');weekday integer;ordinal integer;span integer;BEGIN
 span:=coalesce(nullif(p_data->>'end_date','')::date,first_day)-first_day;
 IF first_day IS NULL OR span<0 OR span>366 OR freq NOT IN('none','weekly','monthly') THEN RAISE EXCEPTION 'Datas ou recorrência inválidas.';END IF;
 IF freq='none' THEN RETURN ARRAY[first_day];END IF;
 IF first_day>p_until OR first_day+span>p_until THEN RAISE EXCEPTION 'A data inicial/final ultrapassa o limite da recorrência: %.',to_char(p_until,'DD/MM/YYYY');END IF;
 weekday:=coalesce((p_data->>'recurrence_weekday')::integer,extract(dow FROM first_day)::integer);ordinal:=coalesce((p_data->>'recurrence_ordinal')::integer,1);
 IF weekday NOT BETWEEN 0 AND 6 OR ordinal NOT IN(-1,1,2,3,4) OR p_until-first_day>7000 THEN RAISE EXCEPTION 'Revise o dia, a posição e a data inicial da recorrência.';END IF;
 FOR d IN SELECT generate_series(first_day::timestamp,(p_until-span)::timestamp,'1 day')::date LOOP
 last_day:=(date_trunc('month',d::timestamp)+interval '1 month - 1 day')::date;
 IF extract(dow FROM d)=weekday AND (freq='weekly' OR ordinal=-1 AND d+7>last_day OR ordinal>0 AND ((extract(day FROM d)::integer-1)/7+1)=ordinal) THEN out:=array_append(out,d);END IF;
 END LOOP;
 IF cardinality(out)=0 OR cardinality(out)>1000 THEN RAISE EXCEPTION 'Nenhuma ocorrência válida ou série muito extensa. Revise as datas.';END IF;RETURN out;END $$;
CREATE FUNCTION iasdpi_pilot_private.event_conflicts(e jsonb,p_exclude uuid[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE span tstzrange:=iasdpi_pilot_private.event_interval(e);c uuid:=public.iasdpi_pilot_current_church_id();BEGIN
 IF span IS NULL THEN RETURN '[]';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('space_code',s.code,'space_name',s.name,'date',e->>'date','occupied',r.occupied::text,'other_event_id',r.event_id))
 FROM iasdpi_pilot.iasdpi_event_reservations r JOIN iasdpi_pilot.iasdpi_event_spaces s ON s.church_id=r.church_id AND s.code=r.space_code
 WHERE r.church_id=c AND s.exclusive AND s.code IN(SELECT jsonb_array_elements_text(coalesce(nullif(e->'spaces','null'),'[]'))) AND NOT r.event_id=ANY(p_exclude) AND r.occupied&&span),'[]')||
 -- Textos antigos só são interpretados se corresponderem EXATAMENTE a um local conhecido. Nada é regravado.
 coalesce((WITH latest AS(SELECT DISTINCT ON(event_id) event_id,status,snapshot FROM iasdpi_pilot.iasdpi_event_versions WHERE status IN('published','cancelled') ORDER BY event_id,version DESC)
 SELECT jsonb_agg(jsonb_build_object('space_code',s.code,'space_name',s.name,'date',e->>'date','occupied',coalesce(iasdpi_pilot_private.event_interval(l.snapshot),tstzrange(((l.snapshot->>'date')::date::timestamp AT TIME ZONE 'America/Sao_Paulo'),(((l.snapshot->>'end_date')::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'),'[)'))::text,'other_event_id',v.id,'legacy',true,'time_pending',iasdpi_pilot_private.event_interval(l.snapshot) IS NULL))
 FROM latest l JOIN iasdpi_pilot.iasdpi_events v ON v.id=l.event_id JOIN iasdpi_pilot.iasdpi_event_spaces s ON s.church_id=v.church_id AND s.exclusive AND iasdpi_pilot_private.normal_name(l.snapshot->>'location')=iasdpi_pilot_private.normal_name(s.name)
 WHERE l.status='published' AND nullif(l.snapshot->'spaces','null') IS NULL AND s.code IN(SELECT jsonb_array_elements_text(coalesce(nullif(e->'spaces','null'),'[]'))) AND NOT v.id=ANY(p_exclude)
 AND coalesce(iasdpi_pilot_private.event_interval(l.snapshot),tstzrange(((l.snapshot->>'date')::date::timestamp AT TIME ZONE 'America/Sao_Paulo'),(((l.snapshot->>'end_date')::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'),'[)'))&&span),'[]');END $$;
CREATE FUNCTION iasdpi_pilot_private.event_conflict_view(rows jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg((r-'other_event_id')||jsonb_build_object('period_label',CASE WHEN coalesce((r->>'time_pending')::boolean,false) THEN 'Horário pendente de revisão' WHEN r->>'occupied' IS NOT NULL THEN to_char(lower((r->>'occupied')::tstzrange) AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||' → '||to_char(upper((r->>'occupied')::tstzrange) AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ELSE 'Horário não informado' END,'event_title',CASE WHEN e.id IS NULL THEN 'Outra ocorrência desta série' WHEN iasdpi_pilot_private.event_can(iasdpi_pilot_admin.uid(),e.category,e.department_id,'view') THEN e.title WHEN NOT e.is_restricted AND pub.status='published' AND NOT coalesce((pub.snapshot->>'is_restricted')::boolean,false) AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_event_series es WHERE es.id=e.series_id AND es.approval_status IN('pending','rejected')) THEN pub.snapshot->>'title' ELSE 'Evento restrito' END)), '[]')
 FROM jsonb_array_elements(rows) r LEFT JOIN iasdpi_pilot.iasdpi_events e ON e.id=(r->>'other_event_id')::uuid LEFT JOIN LATERAL(SELECT status,snapshot FROM iasdpi_pilot.iasdpi_event_versions v WHERE v.event_id=e.id AND v.status IN('published','cancelled') ORDER BY version DESC LIMIT 1) pub ON true;
$$;
CREATE FUNCTION public.iasdpi_pilot_event_preview(p_data jsonb,p_exclude uuid[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();d date;days date[];e jsonb;out jsonb:='[]';conflicts jsonb;until_day date:=(date_trunc('year',now() AT TIME ZONE 'America/Sao_Paulo')+interval '1 year - 1 day')::date;BEGIN
 IF p_exclude IS NULL THEN p_exclude:='{}';END IF;
 until_day:=least(until_day,coalesce(nullif(p_data->>'recurrence_until','')::date,until_day));
 IF NOT coalesce(iasdpi_pilot_private.event_can(u,p_data->>'category',(p_data->>'department_id')::uuid,'edit'),false) THEN RAISE EXCEPTION 'Sem permissão para cadastrar neste departamento.' USING errcode='42501';END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_exclude) x WHERE NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_events v WHERE v.id=x AND iasdpi_pilot_private.event_can(u,v.category,v.department_id,'edit'))) THEN RAISE EXCEPTION 'Exclusão de validação não autorizada.' USING errcode='42501';END IF;
 IF nullif(p_data->'spaces','null') IS NOT NULL AND (jsonb_typeof(p_data->'spaces')<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_data->'spaces') x WHERE NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_event_spaces s WHERE s.code=x))) THEN RAISE EXCEPTION 'Local inválido.';END IF;
 days:=iasdpi_pilot_private.event_dates(p_data,until_day);
 FOREACH d IN ARRAY days LOOP
 IF nullif(p_data->>'preview_from','') IS NOT NULL AND d<(p_data->>'preview_from')::date THEN CONTINUE;END IF;
 e:=p_data||jsonb_build_object('date',d,'end_date',d+(coalesce(nullif(p_data->>'end_date','')::date,(p_data->>'date')::date)-(p_data->>'date')::date));
 conflicts:=iasdpi_pilot_private.event_conflicts(e,p_exclude);
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_event_spaces s WHERE s.exclusive AND s.code IN(SELECT jsonb_array_elements_text(coalesce(nullif(e->'spaces','null'),'[]')))) THEN
 conflicts:=conflicts||coalesce((SELECT jsonb_agg(jsonb_build_object('space_code',s.code,'space_name',s.name,'date',d,'occupied',iasdpi_pilot_private.event_interval(prev)::text,'other_event_id',NULL)) FROM jsonb_array_elements(out) prev CROSS JOIN iasdpi_pilot.iasdpi_event_spaces s WHERE s.exclusive AND s.code IN(SELECT jsonb_array_elements_text(coalesce(nullif(e->'spaces','null'),'[]'))) AND iasdpi_pilot_private.event_interval(prev)&&iasdpi_pilot_private.event_interval(e)),'[]');END IF;
 out:=out||jsonb_build_array(e||jsonb_build_object('reservation_conflicts',iasdpi_pilot_private.event_conflict_view(conflicts)));
 END LOOP;
 RETURN jsonb_build_object('until',until_day,'occurrences',out,'conflict_count',(SELECT count(*) FROM jsonb_array_elements(out) x WHERE jsonb_array_length(x->'reservation_conflicts')>0));END $$;

CREATE FUNCTION iasdpi_pilot_private.event_store(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid,p_series uuid DEFAULT NULL,p_anchor date DEFAULT NULL,p_pending boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;old iasdpi_pilot.iasdpi_events;e iasdpi_pilot.iasdpi_events;c uuid;sig text;r iasdpi_pilot_operational.receipts;
 result jsonb;needs_edit boolean;conflicts jsonb;period tstzrange;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_pilot_private.actor();c:=public.iasdpi_pilot_current_church_id();
 IF p_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_request_id IS NULL OR p_patch IS NULL OR jsonb_typeof(p_patch)<>'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('title','date','end_date','all_day','start_time','end_time','location','description','category','department_id','status','source_key','source_url','cancellation_reason','program_category','organizer_kind','audience','is_restricted','organizer_department_id','spaces')) THEN
 RAISE EXCEPTION 'Campos, identificador ou versão inválidos.' USING errcode='22023';END IF;
 SELECT * INTO old FROM iasdpi_pilot.iasdpi_events WHERE id=p_id FOR UPDATE;
 e:=jsonb_populate_record(NULL::iasdpi_pilot.iasdpi_events,coalesce(to_jsonb(old),'{}')||p_patch);
 needs_edit:=old.id IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('status','cancellation_reason')) OR coalesce(e.status,'draft')='draft';
 IF (needs_edit AND (NOT coalesce(iasdpi_pilot_private.event_can(u,e.category,e.department_id,'edit'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_pilot_private.event_can(u,old.category,old.department_id,'edit'),false)))
 OR (e.status IN('published','cancelled') AND (NOT coalesce(iasdpi_pilot_private.event_can(u,e.category,e.department_id,'publish'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_pilot_private.event_can(u,old.category,old.department_id,'publish'),false))) THEN
 RAISE EXCEPTION 'Sem permissão para gerir ou publicar este evento nesta igreja e departamento.' USING errcode='42501';END IF;
 sig:='events-e22-store:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('church',c,'id',p_id,'version',p_expected_version,'patch',p_patch));
 SELECT * INTO r FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Evento alterado em outro dispositivo. Recarregue e compare; suas alterações não foram salvas.' USING errcode='40001';END IF;
 IF e.source_key IS NOT NULL AND (old.id IS NULL OR e.source_key IS DISTINCT FROM old.source_key) AND NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador associa eventos da fonte oficial.' USING errcode='42501';END IF;
 IF old.source_key IS NOT NULL AND (e.source_key IS DISTINCT FROM old.source_key OR e.source_url IS DISTINCT FROM old.source_url) THEN
 RAISE EXCEPTION 'A associação da fonte existente não pode ser substituída.' USING errcode='22023';END IF;
 IF e.source_key IS NOT NULL AND c<>'1a5d0000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Fonte exclusiva da IASD_PI.' USING errcode='42501';END IF;
 IF old.id IS NULL THEN
 e.approval_status:='not_required';e.reservation_conflicts:='[]';e.is_restricted:=coalesce(e.is_restricted,false);e.all_day:=coalesce(e.all_day,false);e.status:=coalesce(e.status,'draft');e.created_by:=u;e.created_at:=now();e.location:=coalesce(e.location,'');e.description:=coalesce(e.description,'');e.cancellation_reason:=coalesce(e.cancellation_reason,'');
 END IF;
 IF NOT p_patch ? 'end_date' AND (old.id IS NULL OR old.end_date=old.date) THEN e.end_date:=e.date;END IF;
 IF e.status='published' AND e.end_time IS NOT NULL AND e.start_time IS NULL THEN RAISE EXCEPTION 'Horário inicial pendente. Confirme antes de publicar.' USING errcode='23514';END IF;
 IF e.status='published' AND (e.category IS NULL OR e.category='department' AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d WHERE d.id=e.department_id AND d.active)) THEN
 RAISE EXCEPTION 'Confirme a categoria e o departamento responsável antes de publicar.' USING errcode='23514';END IF;
 IF p_series IS NOT NULL THEN e.series_id:=p_series;e.occurrence_on:=p_anchor;END IF;
 IF e.spaces IS NOT NULL AND (cardinality(e.spaces)<>(SELECT count(DISTINCT x) FROM unnest(e.spaces) x) OR EXISTS(SELECT 1 FROM unnest(e.spaces) x WHERE NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_event_spaces s WHERE s.code=x))) THEN RAISE EXCEPTION 'Locais inválidos ou duplicados.';END IF;
 e.reservation_conflicts:=CASE WHEN e.status='cancelled' THEN '[]'::jsonb ELSE iasdpi_pilot_private.event_conflicts(to_jsonb(e),ARRAY[p_id]) END;
 IF jsonb_array_length(e.reservation_conflicts)>0 AND NOT p_pending THEN RAISE EXCEPTION 'Reserva em conflito: %',iasdpi_pilot_private.event_conflict_view(e.reservation_conflicts)::text USING errcode='23P01';END IF;
 e.approval_status:=coalesce(old.approval_status,'not_required');
 IF old.id IS NULL OR e.program_category IS DISTINCT FROM old.program_category THEN e.approval_status:=CASE WHEN e.program_category='general' THEN 'pending' ELSE 'not_required' END;END IF;
 IF old.approval_status IN('pending','rejected') THEN e.approval_status:=old.approval_status;END IF;
 IF p_pending OR e.program_category='general' AND EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('status','cancellation_reason')) THEN e.approval_status:='pending';END IF;
 IF e.approval_status IN('pending','rejected') AND e.status='published' THEN e.status:='draft';END IF;
 period:=iasdpi_pilot_private.event_interval(to_jsonb(e));
 IF e.status='published' AND period IS NULL AND EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_event_spaces s WHERE s.exclusive AND s.code=ANY(e.spaces)) THEN RAISE EXCEPTION 'Informe início e término ou marque Dia inteiro para confirmar a reserva exclusiva.' USING errcode='23514';END IF;
 IF e.status='published' AND e.program_category IS NULL AND coalesce(old.status,'draft')<>'published' THEN RAISE EXCEPTION 'Confirme o Público-alvo antes de publicar.';END IF;
 e.id:=p_id;e.church_id:=c;e.version:=coalesce(old.version,0)+1;e.updated_by:=u;e.updated_at:=now();
 IF old.id IS NULL THEN INSERT INTO iasdpi_pilot.iasdpi_events SELECT e.*;
 ELSE UPDATE iasdpi_pilot.iasdpi_events SET title=e.title,date=e.date,end_date=e.end_date,all_day=e.all_day,start_time=e.start_time,end_time=e.end_time,
 spaces=e.spaces,approval_status=e.approval_status,series_id=e.series_id,occurrence_on=e.occurrence_on,reservation_conflicts=e.reservation_conflicts,program_category=e.program_category,organizer_kind=e.organizer_kind,audience=e.audience,is_restricted=e.is_restricted,organizer_department_id=e.organizer_department_id,location=e.location,description=e.description,category=e.category,department_id=e.department_id,status=e.status,source_key=e.source_key,source_url=e.source_url,
 cancellation_reason=e.cancellation_reason,version=e.version,updated_by=u,updated_at=e.updated_at WHERE id=p_id;END IF;
 IF e.status IN('published','cancelled') THEN
 DELETE FROM iasdpi_pilot.iasdpi_event_reservations WHERE event_id=p_id;
 IF e.status='published' AND period IS NOT NULL THEN INSERT INTO iasdpi_pilot.iasdpi_event_reservations SELECT c,p_id,s.code,period FROM iasdpi_pilot.iasdpi_event_spaces s WHERE s.exclusive AND s.code=ANY(e.spaces);END IF;END IF;
 INSERT INTO iasdpi_pilot.iasdpi_event_versions(church_id,event_id,version,actor_id,status,snapshot) VALUES(c,p_id,e.version,u,e.status,to_jsonb(e));
 result:=to_jsonb(e);INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;


ALTER FUNCTION public.iasdpi_pilot_event_save(uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_event_save(uuid,bigint,jsonb,uuid) RENAME TO event_save_021;
CREATE FUNCTION public.iasdpi_pilot_event_submit(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid,p_accept_conflicts boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_pilot_private.actor();e iasdpi_pilot.iasdpi_events;candidate jsonb;conflicts jsonb;result jsonb;signature text;r iasdpi_pilot_operational.receipts;parent iasdpi_pilot.iasdpi_event_series;BEGIN
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 SELECT * INTO e FROM iasdpi_pilot.iasdpi_events WHERE id=p_id FOR UPDATE;candidate:=coalesce(to_jsonb(e),'{}')||p_patch;
 IF NOT coalesce(iasdpi_pilot_private.event_can(u,candidate->>'category',(candidate->>'department_id')::uuid,'edit'),false) OR e.id IS NOT NULL AND NOT coalesce(iasdpi_pilot_private.event_can(u,e.category,e.department_id,'edit'),false)
 OR p_patch->>'status' IN('published','cancelled') AND NOT coalesce(iasdpi_pilot_private.event_can(u,candidate->>'category',(candidate->>'department_id')::uuid,'publish'),false) THEN RAISE EXCEPTION 'Sem permissão para salvar/publicar o evento.' USING errcode='42501';END IF;
 signature:='event-submit-022:'||iasdpi_pilot_operational.fingerprint(jsonb_build_array(public.iasdpi_pilot_current_church_id(),p_id,p_expected_version,p_patch,p_accept_conflicts));
 SELECT * INTO r FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.';END IF;RETURN r.response;END IF;
 IF coalesce(e.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Evento alterado em outro dispositivo. Recarregue e compare.' USING errcode='40001';END IF;
 conflicts:=CASE WHEN p_patch->>'status'='cancelled' THEN '[]'::jsonb ELSE iasdpi_pilot_private.event_conflicts(candidate,ARRAY[p_id]) END;
 IF jsonb_array_length(conflicts)>0 AND e.series_id IS NOT NULL AND NOT coalesce(p_accept_conflicts,false) THEN RETURN jsonb_build_object('requires_confirmation',true,'conflicts',iasdpi_pilot_private.event_conflict_view(conflicts));END IF;
 result:=iasdpi_pilot_private.event_store(p_id,p_expected_version,p_patch,gen_random_uuid(),NULL,NULL,e.series_id IS NOT NULL AND jsonb_array_length(conflicts)>0);
 IF e.series_id IS NOT NULL THEN
 UPDATE iasdpi_pilot.iasdpi_event_series SET version=version+1,updated_by=u,updated_at=now(),approval_status=CASE WHEN result->>'approval_status'='pending' THEN 'pending' ELSE approval_status END WHERE id=e.series_id RETURNING * INTO parent;
 INSERT INTO iasdpi_pilot.iasdpi_event_series_versions VALUES(parent.church_id,parent.id,parent.version,u,now(),to_jsonb(parent));END IF;
 result:=jsonb_build_object('event',result||jsonb_build_object('reservation_conflicts',iasdpi_pilot_private.event_conflict_view(result->'reservation_conflicts')),'requires_confirmation',false);
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,signature,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_pilot_event_save(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb;BEGIN
 result:=public.iasdpi_pilot_event_submit(p_id,p_expected_version,p_patch,p_request_id,false);
 IF coalesce((result->>'requires_confirmation')::boolean,false) THEN RAISE EXCEPTION 'Esta ocorrência possui conflitos; revise e envie para aprovação na nova interface.';END IF;RETURN result->'event';END $$;

CREATE FUNCTION public.iasdpi_pilot_event_series_save(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid,p_scope text DEFAULT 'all',p_occurrence uuid DEFAULT NULL,p_accept_conflicts boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_pilot_private.actor();c uuid:=public.iasdpi_pilot_current_church_id();old iasdpi_pilot.iasdpi_event_series;series iasdpi_pilot.iasdpi_event_series;selected iasdpi_pilot.iasdpi_events;row iasdpi_pilot.iasdpi_events;
 definition jsonb;plan jsonb;item jsonb;patch jsonb;result jsonb;records jsonb:='[]';days date[];excluded uuid[];cutoff date;until_day date;pending boolean;signature text;r iasdpi_pilot_operational.receipts;BEGIN
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF p_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_scope IS NULL OR p_scope NOT IN('all','following') OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('title','date','end_date','all_day','start_time','end_time','location','description','category','department_id','status','program_category','organizer_kind','organizer_department_id','is_restricted','spaces','recurrence','recurrence_weekday','recurrence_ordinal')) THEN RAISE EXCEPTION 'Dados ou abrangência da série inválidos.';END IF;
 SELECT * INTO old FROM iasdpi_pilot.iasdpi_event_series WHERE id=p_id FOR UPDATE;
 definition:=coalesce(old.definition,'{}')||p_patch;definition:=definition||jsonb_build_object('status',coalesce(definition->>'status','draft'));
 IF NOT coalesce(iasdpi_pilot_private.event_can(u,definition->>'category',(definition->>'department_id')::uuid,'edit'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_pilot_private.event_can(u,old.category,old.department_id,'edit'),false)
 OR definition->>'status' IN('published','cancelled') AND (NOT coalesce(iasdpi_pilot_private.event_can(u,definition->>'category',(definition->>'department_id')::uuid,'publish'),false) OR old.id IS NOT NULL AND NOT coalesce(iasdpi_pilot_private.event_can(u,old.category,old.department_id,'publish'),false)) THEN RAISE EXCEPTION 'Sem permissão para editar/publicar esta série.' USING errcode='42501';END IF;
 signature:='event-series-022:'||iasdpi_pilot_operational.fingerprint(jsonb_build_array(c,p_id,p_expected_version,p_patch,p_scope,p_occurrence,p_accept_conflicts));
 SELECT * INTO r FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.';END IF;RETURN r.response;END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'A série foi alterada em outro dispositivo. Recarregue e compare.' USING errcode='40001';END IF;
 IF old.id IS NULL AND p_scope<>'all' OR definition->>'recurrence' IS NULL OR definition->>'recurrence' NOT IN('weekly','monthly') OR definition->>'status' NOT IN('draft','published','cancelled') THEN RAISE EXCEPTION 'Recorrência/status inválido.';END IF;
 IF p_scope='following' THEN SELECT * INTO selected FROM iasdpi_pilot.iasdpi_events WHERE id=p_occurrence AND series_id=p_id;
 IF selected.id IS NULL THEN RAISE EXCEPTION 'Ocorrência não pertence à série.';END IF;cutoff:=selected.occurrence_on;END IF;
 until_day:=coalesce(old.until_date,(date_trunc('year',now() AT TIME ZONE 'America/Sao_Paulo')+interval '1 year - 1 day')::date);
 days:=iasdpi_pilot_private.event_dates(definition,until_day);
 SELECT coalesce(array_agg(id),'{}') INTO excluded FROM iasdpi_pilot.iasdpi_events WHERE series_id=p_id AND (cutoff IS NULL OR occurrence_on>=cutoff);
 -- Prévia e gravação ficam sob o MESMO bloqueio transacional. A consulta prévia não autoriza a escrita.
 plan:=public.iasdpi_pilot_event_preview(definition||jsonb_build_object('preview_from',cutoff,'recurrence_until',until_day),excluded);
 IF (plan->>'conflict_count')::integer>0 AND NOT coalesce(p_accept_conflicts,false) AND definition->>'status'<>'cancelled' THEN
 RETURN plan||jsonb_build_object('requires_confirmation',true);END IF;
 pending:=coalesce(definition->>'program_category'='general',false) OR (plan->>'conflict_count')::integer>0 OR coalesce(old.approval_status IN('pending','rejected'),false);
 INSERT INTO iasdpi_pilot.iasdpi_event_series(id,church_id,definition,until_date,version,approval_status,category,department_id,created_by,updated_by)
 VALUES(p_id,c,definition,until_day,1,CASE WHEN pending THEN 'pending' ELSE 'not_required' END,definition->>'category',(definition->>'department_id')::uuid,u,u)
 ON CONFLICT(id) DO UPDATE SET definition=excluded.definition,version=iasdpi_event_series.version+1,approval_status=excluded.approval_status,category=excluded.category,department_id=excluded.department_id,updated_by=u,updated_at=now() RETURNING * INTO series;
 FOR row IN SELECT * FROM iasdpi_pilot.iasdpi_events WHERE series_id=p_id AND (cutoff IS NULL OR occurrence_on>=cutoff) AND NOT occurrence_on=ANY(days) LOOP
 PERFORM iasdpi_pilot_private.event_store(row.id,row.version,'{"status":"cancelled","cancellation_reason":"Alteração explícita da recorrência; identidade/histórico preservados."}',gen_random_uuid(),NULL,NULL,true);END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(plan->'occurrences') LOOP
 IF cutoff IS NOT NULL AND (item->>'date')::date<cutoff THEN CONTINUE;END IF;
 SELECT * INTO row FROM iasdpi_pilot.iasdpi_events WHERE series_id=p_id AND occurrence_on=(item->>'date')::date;
 patch:=item-ARRAY['recurrence','recurrence_weekday','recurrence_ordinal','reservation_conflicts','preview_from','recurrence_until'];
 result:=iasdpi_pilot_private.event_store(coalesce(row.id,gen_random_uuid()),coalesce(row.version,0),patch,gen_random_uuid(),p_id,(item->>'date')::date,pending);
 records:=records||jsonb_build_array(result||jsonb_build_object('reservation_conflicts',item->'reservation_conflicts'));
 END LOOP;
 INSERT INTO iasdpi_pilot.iasdpi_event_series_versions VALUES(c,series.id,series.version,u,now(),to_jsonb(series)||jsonb_build_object('scope',p_scope,'occurrence_id',p_occurrence));
 result:=jsonb_build_object('series',to_jsonb(series),'events',records,'conflict_count',plan->'conflict_count','requires_confirmation',false);
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,signature,result,now());RETURN result;
END $$;

ALTER FUNCTION public.iasdpi_pilot_events_catalog() SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_events_catalog() RENAME TO events_catalog_021;
CREATE FUNCTION public.iasdpi_pilot_events_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb:=iasdpi_pilot_private.events_catalog_021();u uuid:=iasdpi_pilot_private.actor();BEGIN
 RETURN c||jsonb_build_object('event_management_v2',true,
 'events',coalesce((SELECT jsonb_agg(e||jsonb_build_object('reservation_conflicts',iasdpi_pilot_private.event_conflict_view(e->'reservation_conflicts'))) FROM jsonb_array_elements(c->'events') e),'[]'),
 'spaces',coalesce((SELECT jsonb_agg(to_jsonb(s)-'church_id' ORDER BY code) FROM iasdpi_pilot.iasdpi_event_spaces s),'[]'),
 'organizer_options',jsonb_build_array(jsonb_build_object('value','local_church','label','Igreja Local'),jsonb_build_object('value','association','label','Associação / Missão'),jsonb_build_object('value','school','label','Escola Adventista'),jsonb_build_object('value','other','label','Outros'))||coalesce((SELECT jsonb_agg(jsonb_build_object('value','department:'||(d->>'id'),'label',d->>'name')) FROM jsonb_array_elements(c->'departments') d),'[]'),
 'series',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM iasdpi_pilot.iasdpi_event_series s WHERE iasdpi_pilot_private.event_can(u,s.category,s.department_id,'view')),'[]'));
END $$;
ALTER FUNCTION public.iasdpi_pilot_event_history(uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_event_history(uuid) RENAME TO event_history_021;
CREATE FUNCTION public.iasdpi_pilot_event_history(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v||jsonb_build_object('snapshot',(v->'snapshot')||jsonb_build_object('reservation_conflicts',iasdpi_pilot_private.event_conflict_view(coalesce(v->'snapshot'->'reservation_conflicts','[]'))))),'[]') FROM jsonb_array_elements(iasdpi_pilot_private.event_history_021(p_id)) v; $$;
ALTER FUNCTION iasdpi_pilot_private.calendar_events_feed(date,boolean) RENAME TO calendar_events_feed_021;
CREATE FUNCTION iasdpi_pilot_private.calendar_events_feed(p_month date,p_private boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE r jsonb:=iasdpi_pilot_private.calendar_events_feed_021(p_month,p_private);BEGIN
 RETURN r||jsonb_build_object('events',coalesce((SELECT jsonb_agg((e-ARRAY['reservation_conflicts'])||jsonb_build_object('space_names',coalesce((SELECT jsonb_agg(s.name ORDER BY s.code) FROM iasdpi_pilot.iasdpi_event_spaces s WHERE s.code IN(SELECT jsonb_array_elements_text(coalesce(nullif(e->'spaces','null'),'[]')))),'[]'))) FROM jsonb_array_elements(r->'events') e
 WHERE coalesce(e->>'approval_status','legacy') NOT IN('pending','rejected') AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_event_series s WHERE s.id=(e->>'series_id')::uuid AND s.approval_status IN('pending','rejected'))),'[]'));
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 n.nspname='public' AND p.proname IN('iasdpi_pilot_event_submit','iasdpi_pilot_event_save','iasdpi_pilot_event_preview','iasdpi_pilot_event_series_save','iasdpi_pilot_events_catalog','iasdpi_pilot_event_history') OR
 n.nspname='iasdpi_pilot_private' AND p.proname IN('event_space_key','event_interval','event_dates','event_conflicts','event_conflict_view','event_store','event_save_021','events_catalog_021','event_history_021','calendar_events_feed','calendar_events_feed_021') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private FROM iasdpi_pilot_executor;

-- Regras reutilizadas de 023_schedule_edit_window.sql
-- Revisão: 001–022 obrigatórias. Não altera dados/histórico nem aplica configuração em produção.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_pilot_event_series_save(uuid,bigint,jsonb,uuid,text,uuid,boolean)') IS NULL
 OR to_regprocedure('iasdpi_pilot_private.plan_save_007(uuid,bigint,jsonb,uuid)') IS NULL THEN RAISE EXCEPTION 'Instale 001–022 como postgres.';END IF;
END $$;
CREATE FUNCTION iasdpi_pilot_private.edit_bounds() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE first_day date:=(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;n integer;BEGIN
 SELECT planning_months INTO STRICT n FROM iasdpi_pilot.schedule_settings;
 RETURN jsonb_build_object('schedule_edit_policy',true,'today',first_day,'editable_from',first_day,'editable_until',(date_trunc('month',first_day)+(n+1)*interval '1 month'-interval '1 day')::date);
END $$;
CREATE FUNCTION iasdpi_pilot_private.assert_edit_day(day date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE b jsonb:=iasdpi_pilot_private.edit_bounds();BEGIN
 IF day IS NULL OR day<(b->>'editable_from')::date THEN RAISE EXCEPTION 'Data encerrada: dias anteriores a hoje são somente para consulta.' USING errcode='23514';END IF;
 IF day>(b->>'editable_until')::date THEN RAISE EXCEPTION 'Data fora do período de edição. Solicite ao administrador a liberação de meses futuros.' USING errcode='23514';END IF;
END $$;
CREATE FUNCTION iasdpi_pilot_private.assert_edit_month(month date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE b jsonb:=iasdpi_pilot_private.edit_bounds();BEGIN
 IF month IS NULL OR month<date_trunc('month',(b->>'today')::date)::date OR month>(b->>'editable_until')::date THEN RAISE EXCEPTION 'Mês somente para consulta. O mês atual sempre está liberado; meses futuros dependem da configuração administrativa.' USING errcode='23514';END IF;
END $$;
-- Normaliza somente campos editáveis; ordem de arrays, aliases e nomes não alteram a identidade.
CREATE FUNCTION iasdpi_pilot_private.frozen_requirements(data jsonb,cutoff date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r->>'id','event_id',r->>'event_id','role_id',r->>'role_id','required_count',(r->>'required_count')::integer,'notes',coalesce(r->>'notes',''),
 'assignments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a->>'id','person_id',a->>'person_id','timing_mode',coalesce(a->>'timing_mode',e.timing_mode),'starts_at',coalesce(nullif(a->>'starts_at','')::timestamptz,e.starts_at),'ends_at',coalesce(nullif(a->>'ends_at','')::timestamptz,e.ends_at)) ORDER BY a->>'id') FROM jsonb_array_elements(coalesce(r->'assignments','[]')) a),'[]')) ORDER BY r->>'id'),'[]')
 FROM jsonb_array_elements(coalesce(data->'requirements','[]')) r JOIN iasdpi_pilot.schedule_events e ON e.id=(r->>'event_id')::uuid WHERE e.scheduled_on<cutoff;
$$;
-- Preserva a implementação anterior sem substituir o OID original (invalida caches).
DO $$ DECLARE body text;old text;new text;BEGIN
 body:=pg_get_functiondef('iasdpi_pilot_private.plan_save_007(uuid,bigint,jsonb,uuid)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_pilot_private.plan_save_007(', 'FUNCTION iasdpi_pilot_private.plan_save_007_before_023(');
 old:='DELETE FROM iasdpi_pilot.schedule_assignments WHERE plan_id=p_id;';new:='DELETE FROM iasdpi_pilot.schedule_assignments removed_assignment WHERE removed_assignment.plan_id=p_id AND EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_requirements retained_req JOIN iasdpi_pilot.schedule_events retained_event ON retained_event.id=retained_req.event_id WHERE retained_req.id=removed_assignment.requirement_id AND retained_event.scheduled_on>=(iasdpi_pilot_private.edit_bounds()->>''today'')::date);';
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Núcleo de escalas incompatível (atribuições).';END IF;body:=replace(body,old,new);
 old:='DELETE FROM iasdpi_pilot.schedule_requirements WHERE plan_id=p_id;';new:='DELETE FROM iasdpi_pilot.schedule_requirements retained_req WHERE retained_req.plan_id=p_id AND EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_events retained_event WHERE retained_event.id=retained_req.event_id AND retained_event.scheduled_on>=(iasdpi_pilot_private.edit_bounds()->>''today'')::date);';
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Núcleo de escalas incompatível (funções).';END IF;body:=replace(body,old,new);
 old:='INSERT INTO iasdpi_pilot.schedule_requirements(id,plan_id,department_id,event_id,role_id,required_count,notes)';new:='IF e.scheduled_on<(iasdpi_pilot_private.edit_bounds()->>''today'')::date THEN CONTINUE;END IF; -- schedule-edit-window-023: passado previamente comparado e preservado'||chr(10)||old;
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Núcleo de escalas incompatível (passado).';END IF;body:=replace(body,old,new);
 old:='coverage.plan_id=p_id AND (SELECT';new:='coverage.plan_id=p_id AND EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_events dated WHERE dated.id=coverage.event_id AND dated.scheduled_on>=(iasdpi_pilot_private.edit_bounds()->>''today'')::date) AND (SELECT';
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Núcleo de escalas incompatível (cobertura).';END IF;body:=replace(body,old,new);
 EXECUTE body;
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_settings_get() SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_settings_get() RENAME TO settings_get_before_023;
CREATE FUNCTION public.iasdpi_pilot_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN iasdpi_pilot_private.settings_get_before_023()||iasdpi_pilot_private.edit_bounds();END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_rotation_context(uuid,date) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_rotation_context(uuid,date) RENAME TO rotation_context_before_023;
CREATE FUNCTION public.iasdpi_pilot_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN iasdpi_pilot_private.rotation_context_before_023(p_department,p_month)||iasdpi_pilot_private.edit_bounds();END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_event_create(uuid,jsonb,uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_event_create(uuid,jsonb,uuid) RENAME TO event_create_before_023;
CREATE FUNCTION public.iasdpi_pilot_schedule_event_create(p_id uuid,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.has_capability(u,(p_data->>'department_id')::uuid,'edit') THEN RAISE EXCEPTION 'Sem edição neste departamento.' USING errcode='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id) THEN
 PERFORM iasdpi_pilot_private.assert_edit_day((p_data->>'date')::date);
 IF nullif(p_data->>'end_date','') IS NOT NULL THEN PERFORM iasdpi_pilot_private.assert_edit_day((p_data->>'end_date')::date);END IF;END IF;
 RETURN iasdpi_pilot_private.event_create_before_023(p_id,p_data,p_request_id);
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_plan_save(uuid,bigint,jsonb,uuid) RENAME TO plan_save_before_023;
CREATE FUNCTION public.iasdpi_pilot_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;old jsonb;mon date;d uuid;today date;result jsonb;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 old:=iasdpi_pilot_private.plan_snapshot(p_id);d:=coalesce((old->>'department_id')::uuid,(p_data->>'department_id')::uuid);
 IF NOT iasdpi_pilot_private.has_capability(u,d,'edit') AND NOT iasdpi_pilot_private.has_capability(u,d,'publish') THEN RAISE EXCEPTION 'Sem edição/publicação deste departamento.' USING errcode='42501';END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id) THEN RETURN iasdpi_pilot_private.plan_save_before_023(p_id,p_expected_version,p_data,p_request_id);END IF;
 mon:=coalesce((old->>'month')::date,(p_data->>'month')::date);PERFORM iasdpi_pilot_private.assert_edit_month(mon);today:=(iasdpi_pilot_private.edit_bounds()->>'today')::date;
 IF p_data ? 'requirements' THEN
 IF iasdpi_pilot_private.frozen_requirements(p_data,today) IS DISTINCT FROM iasdpi_pilot_private.frozen_requirements(old,today) THEN RAISE EXCEPTION 'Datas encerradas não podem ser alteradas, incluídas ou removidas. Preserve os registros anteriores a hoje.' USING errcode='23514';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'requirements') r JOIN iasdpi_pilot.schedule_events e ON e.id=(r->>'event_id')::uuid WHERE e.scheduled_on>(iasdpi_pilot_private.edit_bounds()->>'editable_until')::date) THEN RAISE EXCEPTION 'Data fora do período de edição.' USING errcode='23514';END IF;END IF;
 result:=iasdpi_pilot_private.plan_save_before_023(p_id,p_expected_version,p_data,p_request_id);
 IF iasdpi_pilot_private.frozen_requirements(result,today) IS DISTINCT FROM iasdpi_pilot_private.frozen_requirements(old,today) THEN RAISE EXCEPTION 'Os registros encerrados devem permanecer intactos.' USING errcode='23514';END IF;
 RETURN result;
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_elder_save(uuid,text,jsonb,uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_elder_save(uuid,text,jsonb,uuid) RENAME TO elder_save_before_023;
CREATE FUNCTION public.iasdpi_pilot_schedule_elder_save(p_department uuid,p_status text,p_rows jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;item jsonb;b jsonb;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.has_capability(u,p_department,CASE WHEN p_status='published' THEN 'publish' ELSE 'edit' END) THEN RAISE EXCEPTION 'Sem permissão para esta ação do Ancionato.' USING errcode='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id) THEN
 b:=iasdpi_pilot_private.edit_bounds();FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
 IF (item->>'ends_on')::date<(b->>'today')::date OR (item->>'starts_on')::date>(b->>'editable_until')::date THEN RAISE EXCEPTION 'Período do Ancionato somente para consulta. Edite períodos em curso ou meses futuros liberados.' USING errcode='23514';END IF;END LOOP;END IF;
 RETURN iasdpi_pilot_private.elder_save_before_023(p_department,p_status,p_rows,p_request_id);
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_prepare_month(p_department uuid,p_month date,p_request_id uuid,p_title text DEFAULT 'Culto') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;d iasdpi_pilot.schedule_departments;s iasdpi_pilot.schedule_settings;b jsonb;day date;e jsonb;events jsonb:='[]';sig text;receipt iasdpi_pilot_operational.receipts;result jsonb;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 SELECT * INTO d FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND active;
 IF d.id IS NULL OR NOT iasdpi_pilot_private.has_capability(u,d.id,'edit') THEN RAISE EXCEPTION 'Sem edição neste departamento.' USING errcode='42501';END IF;
 sig:='schedule-prepare-023:'||iasdpi_pilot_operational.fingerprint(jsonb_build_array(public.iasdpi_pilot_current_church_id(),p_department,p_month,p_title));
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.';END IF;RETURN receipt.response;END IF;
 PERFORM iasdpi_pilot_private.assert_edit_month(p_month);
 IF extract(day FROM p_month)<>1 OR p_request_id IS NULL OR length(btrim(p_title)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Mês, título ou solicitação inválidos.';END IF;
 SELECT * INTO STRICT s FROM iasdpi_pilot.schedule_settings;b:=iasdpi_pilot_private.edit_bounds();
 FOR day IN SELECT generate_series(p_month::timestamp,(p_month+interval '1 month - 1 day')::timestamp,'1 day')::date LOOP
 IF day>=(b->>'today')::date AND (extract(dow FROM day)::smallint=ANY(d.planning_weekdays) OR day=ANY(s.extra_dates)) THEN
 e:=public.iasdpi_pilot_schedule_event_create(gen_random_uuid(),jsonb_build_object('department_id',d.id,'title',p_title,'date',day),gen_random_uuid());events:=events||jsonb_build_array(e);END IF;END LOOP;
 result:=jsonb_build_object('events',events,'settings_version',s.version,'month',p_month);
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 n.nspname='public' AND p.proname IN('iasdpi_pilot_schedule_settings_get','iasdpi_pilot_schedule_rotation_context','iasdpi_pilot_schedule_event_create','iasdpi_pilot_schedule_plan_save','iasdpi_pilot_schedule_elder_save','iasdpi_pilot_schedule_prepare_month') OR
 n.nspname='iasdpi_pilot_private' AND p.proname IN('edit_bounds','assert_edit_day','assert_edit_month','frozen_requirements','plan_save_007_before_023','settings_get_before_023','rotation_context_before_023','event_create_before_023','plan_save_before_023','elder_save_before_023') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private FROM iasdpi_pilot_executor;

-- Regras reutilizadas de 024_schedule_publication_rules.sql
-- 024: compatibilidade da Comunicação e publicação com vagas reais em aberto.
-- Somente revisão; executar após 001–023 e autorização. Não aprova eventos.
DO $$ BEGIN IF current_user<>'postgres' OR to_regprocedure('iasdpi_pilot_private.edit_bounds()') IS NULL THEN RAISE EXCEPTION 'Exige postgres e migrações 001–023.';END IF;END $$;
CREATE FUNCTION iasdpi_pilot_private.departments_conflict(a uuid,b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a IS DISTINCT FROM b AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d WHERE d.id IN(a,b) AND d.code='comunicacao');
$$;
-- O helper legado é usado por todos os validadores e contextos. Compatibilidade
-- fixa não cria uma exceção administrativa nem altera a tabela de auditoria.
DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_pilot_private.has_day_exception(uuid,date,uuid,uuid)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_pilot_private.has_day_exception(','FUNCTION iasdpi_pilot_private.has_day_exception_before_024(');
END $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.has_day_exception(p_person uuid,p_day date,p_a uuid,p_b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT iasdpi_pilot_private.departments_conflict(p_a,p_b) OR iasdpi_pilot_private.has_day_exception_before_024(p_person,p_day,p_a,p_b);
$$;
-- Preserva o OID e os validadores de autorização, datas, CAS e conflito.
DO $$ DECLARE body text;start_at integer;end_at integer;block text;BEGIN
 body:=pg_get_functiondef('iasdpi_pilot_private.plan_save_007(uuid,bigint,jsonb,uuid)'::regprocedure);
 IF strpos(body,'schedule-edit-window-023')=0 THEN RAISE EXCEPTION 'Núcleo incompatível: preservação de datas encerradas ausente.';END IF;
 EXECUTE replace(body,'FUNCTION iasdpi_pilot_private.plan_save_007(','FUNCTION iasdpi_pilot_private.plan_save_007_before_024(');
 start_at:=strpos(body,' IF next_status=''published'' AND (NOT EXISTS');
 IF start_at=0 THEN RAISE EXCEPTION 'Núcleo incompatível: validação de cobertura não localizada.';END IF;
 end_at:=strpos(substr(body,start_at),' result:=iasdpi_pilot_private.plan_snapshot(p_id);');
 IF end_at=0 THEN RAISE EXCEPTION 'Núcleo incompatível: limite de cobertura não localizado.';END IF;
 block:=substr(body,start_at,end_at-1);
 body:=replace(body,block,' IF next_status=''published'' AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_requirements WHERE plan_id=p_id) THEN RAISE EXCEPTION ''Cadastre ao menos uma vaga antes de publicar a escala.'' USING errcode=''23514'';END IF;'||chr(10));
 EXECUTE body;
END $$;
-- A pessoa pode permanecer nula em um período publicado, indicando A definir.
DO $$ DECLARE constraint_name text;BEGIN
 SELECT conname INTO STRICT constraint_name FROM pg_constraint WHERE conrelid='iasdpi_pilot.schedule_elder_periods'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%person_id IS NOT NULL%' AND pg_get_constraintdef(oid) LIKE '%published%';
 EXECUTE format('ALTER TABLE iasdpi_pilot.schedule_elder_periods DROP CONSTRAINT %I',constraint_name);
END $$;
-- A 023 continua envolvendo esta implementação e bloqueando períodos encerrados.
DO $$ DECLARE body text;old text:='IF p_status=''published'' AND p IS NULL THEN RAISE EXCEPTION ''Publicação bloqueada: há períodos sem ancião.'' USING errcode=''23514'';END IF;';BEGIN
 body:=pg_get_functiondef('iasdpi_pilot_private.elder_save_before_023(uuid,text,jsonb,uuid)'::regprocedure);
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Núcleo do Ancionato incompatível.';END IF;
 EXECUTE replace(body,'FUNCTION iasdpi_pilot_private.elder_save_before_023(','FUNCTION iasdpi_pilot_private.elder_save_before_023_before_024(');
 EXECUTE replace(body,old,'-- 024: pessoa nula representa uma vaga publicada, sem compromisso atribuído.');
END $$;
-- Alimenta as consultas existentes ANTES do filtro de privacidade da 021.
-- Somente versões efetivamente publicadas; revisões em rascunho não vazam.
DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_pilot_private.published_before_privacy(date)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_pilot_private.published_before_privacy(','FUNCTION iasdpi_pilot_private.published_before_privacy_before_024(');
END $$;
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.published_before_privacy(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE rows jsonb;BEGIN
 rows:=iasdpi_pilot_private.published_before_privacy_before_024(p_month);
 RETURN rows||coalesce((WITH latest AS(
 SELECT p.id,p.department_id,d.name department,v.version,v.captured_at,v.snapshot
 FROM iasdpi_pilot.schedule_plans p JOIN iasdpi_pilot.schedule_departments d ON d.id=p.department_id AND d.active
 CROSS JOIN LATERAL(SELECT x.version,x.captured_at,x.snapshot FROM iasdpi_pilot.schedule_versions x WHERE x.plan_id=p.id AND x.snapshot->>'status'='published' ORDER BY x.version DESC LIMIT 1) v
 WHERE p.month=p_month AND p.church_id=public.iasdpi_pilot_current_church_id())
 SELECT jsonb_agg(jsonb_build_object('id','pending:'||p.id::text||':'||(req->>'id'),'date',e.scheduled_on,'department_id',p.department_id,'department',p.department,'person','','role',r.name,'event',e.title,'version',p.version,'published_at',p.captured_at,'origin','Escala publicada no sistema','pending',true,'vacancy_count',(req->>'required_count')::integer-jsonb_array_length(req->'assignments')))
 FROM latest p CROSS JOIN LATERAL jsonb_array_elements(p.snapshot->'requirements') req
 JOIN iasdpi_pilot.schedule_events e ON e.id=(req->>'event_id')::uuid AND e.scheduled_on>=p_month AND e.scheduled_on<(p_month+interval '1 month')::date
 JOIN iasdpi_pilot.schedule_roles r ON r.id=(req->>'role_id')::uuid AND r.department_id=p.department_id
 WHERE (req->>'required_count')::integer>jsonb_array_length(req->'assignments')),'[]')||
 coalesce((SELECT jsonb_agg(jsonb_build_object('id','elder-pending:'||p.id::text,'date',p.starts_on,'startDate',p.starts_on,'endDate',p.ends_on,'kind',p.kind,'department_id',p.department_id,'department',d.name,'person','','role',CASE WHEN p.kind='weekly' THEN 'Ancião da Semana' ELSE 'Ancião do Mês' END,'version',p.version,'published_at',p.captured_at,'origin','Escala publicada no sistema','pending',true,'vacancy_count',1))
 FROM iasdpi_pilot_private.published_elder_periods p JOIN iasdpi_pilot.schedule_departments d ON d.id=p.department_id AND d.active
 WHERE p.person_id IS NULL AND p.starts_on<=(p_month+interval '1 month - 1 day')::date AND p.ends_on>=p_month),'[]');
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_settings_get() SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_settings_get() RENAME TO settings_get_before_024;
CREATE FUNCTION public.iasdpi_pilot_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 RETURN iasdpi_pilot_private.settings_get_before_024()||jsonb_build_object('allow_pending_publication',true,'non_blocking_department_codes',jsonb_build_array('comunicacao'));
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 n.nspname='public' AND p.proname='iasdpi_pilot_schedule_settings_get' OR n.nspname='iasdpi_pilot_private' AND p.proname IN('departments_conflict','has_day_exception','has_day_exception_before_024','plan_save_007_before_024','elder_save_before_023_before_024','published_before_privacy','published_before_privacy_before_024','settings_get_before_024') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private FROM iasdpi_pilot_executor;

-- Regras reutilizadas de 025_event_direct_publication.sql
-- 025: publicação direta de eventos por usuários já autorizados.
-- Revisão somente: não aplicar no Supabase real sem autorização. Após 001–024.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('iasdpi_pilot_private.departments_conflict(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'Exige postgres e migrações 001–024.';END IF;
END $$;

-- iasdpi_pilot_private.event_store: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_pilot_private.event_store_before_025(uuid,bigint,jsonb,uuid,uuid,date,boolean)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('iasdpi_pilot_private.event_store(uuid,bigint,jsonb,uuid,uuid,date,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_pilot_private.event_store(','FUNCTION iasdpi_pilot_private.event_store_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["e.approval_status:=coalesce(old.approval_status,'not_required');\n IF old.id IS NULL OR e.program_category IS DISTINCT FROM old.program_category THEN e.approval_status:=CASE WHEN e.program_category='general' THEN 'pending' ELSE 'not_required' END;END IF;\n IF old.approval_status IN('pending','rejected') THEN e.approval_status:=old.approval_status;END IF;\n IF p_pending OR e.program_category='general' AND EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('status','cancellation_reason')) THEN e.approval_status:='pending';END IF;\n IF e.approval_status IN('pending','rejected') AND e.status='published' THEN e.status:='draft';END IF;", "e.approval_status:='not_required'; -- 025: publicação direta, sem reescrever versões anteriores."], ["jsonb_array_length(e.reservation_conflicts)>0 AND NOT p_pending", "jsonb_array_length(e.reservation_conflicts)>0 AND e.status='published'"]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 -- Mesmo trecho literal, aceitando apenas LF ou CRLF.
 IF strpos(body,before_text)=0 THEN before_text:=replace(before_text,chr(10),chr(13)||chr(10));END IF;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: iasdpi_pilot_private.event_store.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- public.iasdpi_pilot_event_submit: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_pilot_private.iasdpi_event_submit_before_025(uuid,bigint,jsonb,uuid,boolean)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('public.iasdpi_pilot_event_submit(uuid,bigint,jsonb,uuid,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_pilot_event_submit(','FUNCTION iasdpi_pilot_private.iasdpi_event_submit_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["event-submit-022:", "event-submit-025:"], ["IF jsonb_array_length(conflicts)>0 AND e.series_id IS NOT NULL AND NOT coalesce(p_accept_conflicts,false) THEN RETURN jsonb_build_object('requires_confirmation',true,'conflicts',iasdpi_pilot_private.event_conflict_view(conflicts));END IF;", "-- 025: conflitos são bloqueios de publicação, nunca pedidos de aprovação."], ["e.series_id IS NOT NULL AND jsonb_array_length(conflicts)>0);", "false);"], ["approval_status=CASE WHEN result->>'approval_status'='pending' THEN 'pending' ELSE approval_status END", "approval_status='not_required'"]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 -- Mesmo trecho literal, aceitando apenas LF ou CRLF.
 IF strpos(body,before_text)=0 THEN before_text:=replace(before_text,chr(10),chr(13)||chr(10));END IF;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: public.iasdpi_pilot_event_submit.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- public.iasdpi_pilot_event_save: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_pilot_private.iasdpi_event_save_before_025(uuid,bigint,jsonb,uuid)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('public.iasdpi_pilot_event_save(uuid,bigint,jsonb,uuid)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_pilot_event_save(','FUNCTION iasdpi_pilot_private.iasdpi_event_save_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["Esta ocorrência possui conflitos; revise e envie para aprovação na nova interface.", "Reserva em conflito. Revise os locais e horários antes de publicar."]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 -- Mesmo trecho literal, aceitando apenas LF ou CRLF.
 IF strpos(body,before_text)=0 THEN before_text:=replace(before_text,chr(10),chr(13)||chr(10));END IF;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: public.iasdpi_pilot_event_save.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- public.iasdpi_pilot_event_series_save: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_pilot_private.iasdpi_event_series_save_before_025(uuid,bigint,jsonb,uuid,text,uuid,boolean)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('public.iasdpi_pilot_event_series_save(uuid,bigint,jsonb,uuid,text,uuid,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_pilot_event_series_save(','FUNCTION iasdpi_pilot_private.iasdpi_event_series_save_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["event-series-022:", "event-series-025:"], ["IF (plan->>'conflict_count')::integer>0 AND NOT coalesce(p_accept_conflicts,false) AND definition->>'status'<>'cancelled' THEN\n RETURN plan||jsonb_build_object('requires_confirmation',true);END IF;", "IF (plan->>'conflict_count')::integer>0 AND definition->>'status'='published' THEN\n RAISE EXCEPTION 'Reserva em conflito: resolva os locais e horários antes de publicar a série.' USING errcode='23P01';END IF;"], ["pending:=coalesce(definition->>'program_category'='general',false) OR (plan->>'conflict_count')::integer>0 OR coalesce(old.approval_status IN('pending','rejected'),false);", "pending:=false; -- 025: rascunhos não confirmam reservas; publicação exige ausência de conflitos."], ["CASE WHEN pending THEN 'pending' ELSE 'not_required' END", "'not_required'"]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 -- Mesmo trecho literal, aceitando apenas LF ou CRLF.
 IF strpos(body,before_text)=0 THEN before_text:=replace(before_text,chr(10),chr(13)||chr(10));END IF;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: public.iasdpi_pilot_event_series_save.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- public.iasdpi_pilot_events_catalog: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_pilot_private.iasdpi_events_catalog_before_025()') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('public.iasdpi_pilot_events_catalog()'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_pilot_events_catalog(','FUNCTION iasdpi_pilot_private.iasdpi_events_catalog_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["'event_management_v2',true,", "'event_management_v2',true,'event_approval_required',false,"]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 -- Mesmo trecho literal, aceitando apenas LF ou CRLF.
 IF strpos(body,before_text)=0 THEN before_text:=replace(before_text,chr(10),chr(13)||chr(10));END IF;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: public.iasdpi_pilot_events_catalog.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- iasdpi_pilot_private.calendar_events_feed: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_pilot_private.calendar_events_feed_before_025(date,boolean)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('iasdpi_pilot_private.calendar_events_feed(date,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_pilot_private.calendar_events_feed(','FUNCTION iasdpi_pilot_private.calendar_events_feed_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["\n WHERE coalesce(e->>'approval_status','legacy') NOT IN('pending','rejected') AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_event_series s WHERE s.id=(e->>'series_id')::uuid AND s.approval_status IN('pending','rejected'))", ""]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 -- Mesmo trecho literal, aceitando apenas LF ou CRLF.
 IF strpos(body,before_text)=0 THEN before_text:=replace(before_text,chr(10),chr(13)||chr(10));END IF;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: iasdpi_pilot_private.calendar_events_feed.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- iasdpi_pilot_private.event_conflict_view: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_pilot_private.event_conflict_view_before_025(jsonb)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('iasdpi_pilot_private.event_conflict_view(jsonb)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_pilot_private.event_conflict_view(','FUNCTION iasdpi_pilot_private.event_conflict_view_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[[" AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.iasdpi_event_series es WHERE es.id=e.series_id AND es.approval_status IN('pending','rejected'))", ""]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 -- Mesmo trecho literal, aceitando apenas LF ou CRLF.
 IF strpos(body,before_text)=0 THEN before_text:=replace(before_text,chr(10),chr(13)||chr(10));END IF;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: iasdpi_pilot_private.event_conflict_view.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

GRANT CREATE ON SCHEMA iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='iasdpi_pilot_private' AND p.proname LIKE '%_before_025' LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);END LOOP;
END $$;
REVOKE CREATE ON SCHEMA iasdpi_pilot_private FROM iasdpi_pilot_executor;

UPDATE iasdpi_pilot_admin.installation SET step=4 WHERE singleton;
SELECT iasdpi_pilot_admin.assert_core_unchanged();
NOTIFY pgrst,'reload schema';
COMMIT;
