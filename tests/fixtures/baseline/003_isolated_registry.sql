-- IASDPI piloto ISOLADO. Não executar no Supabase sem autorização e recuperação revisada.
BEGIN;
DO $$ BEGIN IF (SELECT step FROM iasdpi_pilot_admin.installation WHERE singleton)<>2 THEN RAISE EXCEPTION 'Ordem de instalação inválida; não reaplicar.';END IF;END $$;

-- Regras reutilizadas de 014_portal_integration.sql
-- G4: funções de integração, sem alterar registros ou permissões existentes.
-- Revisar após 001–013 completas; NÃO executado automaticamente.
DO $$ BEGIN IF to_regprocedure('iasdpi_pilot_private.has_capability(uuid,uuid,text)') IS NULL THEN RAISE EXCEPTION 'Exige escopo isolado 002.';END IF;END $$;
-- Projeção pública estrita da última versão efetivamente publicada.
-- Uma revisão em rascunho nunca entra nesta consulta, nem substitui a versão aprovada.
CREATE FUNCTION public.iasdpi_pilot_schedule_published(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<'1000-01-01' OR p_month>'9998-12-01' THEN RAISE EXCEPTION 'Informe o primeiro dia de um mês válido.' USING errcode='22023';END IF;
 RETURN coalesce((WITH published AS (
 SELECT p.id,p.department_id,d.name department,v.version,v.captured_at,v.snapshot
 FROM iasdpi_pilot.schedule_plans p JOIN iasdpi_pilot.schedule_departments d ON d.id=p.department_id AND d.active
 CROSS JOIN LATERAL (SELECT x.version,x.captured_at,x.snapshot FROM iasdpi_pilot.schedule_versions x
 WHERE x.plan_id=p.id AND x.snapshot->>'status'='published' ORDER BY x.version DESC LIMIT 1) v
 WHERE p.month=p_month AND p.church_id=public.iasdpi_pilot_current_church_id()
 ), rows AS (
 SELECT pub.id plan_id,pub.department_id,pub.department,pub.version,pub.captured_at,
 e.scheduled_on,e.title event_title,e.starts_at,e.ends_at,r.name role,p.display_name person,a->>'id' assignment_id
 FROM published pub CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(pub.snapshot->'requirements')='array' THEN pub.snapshot->'requirements' ELSE '[]'::jsonb END) req
 JOIN iasdpi_pilot.schedule_events e ON e.id::text=req->>'event_id' AND e.scheduled_on>=p_month AND e.scheduled_on<(p_month+interval '1 month')::date
 JOIN iasdpi_pilot.schedule_roles r ON r.id::text=req->>'role_id' AND r.department_id=pub.department_id
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(req->'assignments')='array' THEN req->'assignments' ELSE '[]'::jsonb END) a
 JOIN iasdpi_pilot.schedule_people p ON p.id::text=a->>'person_id'
 ) SELECT jsonb_agg(jsonb_build_object('id','published:'||plan_id::text||':'||coalesce(assignment_id,person||scheduled_on::text||role),
 'date',scheduled_on,'department_id',department_id,'department',department,'person',person,'role',role,
 'event',event_title,'starts_at',starts_at,'ends_at',ends_at,'version',version,'published_at',captured_at,'origin','Escala publicada no sistema')
 ORDER BY scheduled_on,department,person,assignment_id) FROM rows),'[]'::jsonb);
END $$;
GRANT CREATE ON SCHEMA public TO iasdpi_pilot_executor;
ALTER FUNCTION public.iasdpi_pilot_schedule_published(date) OWNER TO iasdpi_pilot_executor;
REVOKE CREATE ON SCHEMA public FROM iasdpi_pilot_executor;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_schedule_published(date) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_published(date) TO anon,authenticated;
-- Contexto mínimo para navegação; não devolve pessoas, contatos ou rascunhos.
CREATE FUNCTION public.iasdpi_pilot_portal_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();c jsonb;BEGIN
 c:=public.iasdpi_pilot_schedule_catalog();
 RETURN jsonb_build_object('actor_id',u,'is_admin',iasdpi_pilot_private.is_admin(u),'departments',coalesce((SELECT jsonb_agg(jsonb_build_object(
 'id',d->>'id','code',d->>'code','name',d->>'name','active',(d->>'active')::boolean,
 'can_edit',iasdpi_pilot_private.has_capability(u,(d->>'id')::uuid,'edit'),
 'can_publish',iasdpi_pilot_private.has_capability(u,(d->>'id')::uuid,'publish'),
 'can_manage_members',iasdpi_pilot_private.has_capability(u,(d->>'id')::uuid,'members'),
 'can_manage_access',iasdpi_pilot_private.has_capability(u,(d->>'id')::uuid,'access'),
 'can_handle_requests',iasdpi_pilot_private.has_capability(u,(d->>'id')::uuid,'requests')))
 FROM jsonb_array_elements(c->'departments') d),'[]'::jsonb));
END $$;
GRANT CREATE ON SCHEMA public TO iasdpi_pilot_executor;
ALTER FUNCTION public.iasdpi_pilot_portal_context() OWNER TO iasdpi_pilot_executor;
REVOKE CREATE ON SCHEMA public FROM iasdpi_pilot_executor;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_portal_context() FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_portal_context() TO authenticated;
-- Ponte de contexto: retorna SOMENTE igrejas autorizadas para iasdpi_pilot_admin.uid().
-- postgres é necessário para consultar as próprias associações entre igrejas;
-- não aceita user_id, não concede papéis e não devolve membros/contatos.
CREATE FUNCTION public.iasdpi_pilot_my_churches() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 u:=iasdpi_pilot_private.actor();RETURN (SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'is_admin',true)) FROM iasdpi_pilot.iasdpi_churches WHERE id=public.iasdpi_pilot_current_church_id());END $$;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_my_churches() FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_my_churches() TO authenticated;

-- Regras reutilizadas de 015_elder_period_storage.sql
-- G5: Ancionato semanal/mensal. Revisar e executar após 001–014, como postgres.
-- Não importa referências, não cria pessoas e não altera atribuições existentes.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_pilot_portal_context()') IS NULL
 OR to_regprocedure('public.iasdpi_pilot_schedule_published(date)') IS NULL THEN
 RAISE EXCEPTION 'Exige postgres e migrações 001–014 completas.';END IF;
 IF to_regclass('iasdpi_pilot.schedule_elder_periods') IS NOT NULL THEN RAISE EXCEPTION '015 já instalada; revisar sem sobrescrever.';END IF;
END $$;
CREATE TABLE iasdpi_pilot.schedule_elder_periods (
 id uuid PRIMARY KEY,
 church_id uuid NOT NULL DEFAULT public.iasdpi_pilot_current_church_id() REFERENCES iasdpi_pilot.iasdpi_churches(id),
 department_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('weekly','monthly')),
 starts_on date NOT NULL CHECK(starts_on BETWEEN date '1000-01-01' AND date '9998-12-31'),ends_on date NOT NULL,
 person_id uuid,status text NOT NULL CHECK(status IN ('draft','published')),version bigint NOT NULL CHECK(version>0),
 created_by uuid NOT NULL,updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='weekly' AND extract(dow FROM starts_on)=0 AND ends_on=starts_on+6)
 OR (kind='monthly' AND extract(day FROM starts_on)=1 AND ends_on=(starts_on+interval '1 month - 1 day')::date)),
 CHECK(status<>'published' OR person_id IS NOT NULL),
 FOREIGN KEY(church_id,department_id) REFERENCES iasdpi_pilot.schedule_departments(church_id,id),
 FOREIGN KEY(church_id,person_id) REFERENCES iasdpi_pilot.schedule_people(church_id,id),
 UNIQUE(church_id,department_id,kind,starts_on),UNIQUE(church_id,id)
);
CREATE INDEX schedule_elder_range ON iasdpi_pilot.schedule_elder_periods(church_id,department_id,starts_on,ends_on);
CREATE TABLE iasdpi_pilot.schedule_elder_versions (
 church_id uuid NOT NULL DEFAULT public.iasdpi_pilot_current_church_id() REFERENCES iasdpi_pilot.iasdpi_churches(id),
 period_id uuid NOT NULL,version bigint NOT NULL CHECK(version>0),
 actor_id uuid NOT NULL,captured_at timestamptz NOT NULL DEFAULT now(),snapshot jsonb NOT NULL,
 PRIMARY KEY(church_id,period_id,version),FOREIGN KEY(church_id,period_id) REFERENCES iasdpi_pilot.schedule_elder_periods(church_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_elder_periods','schedule_elder_versions'] LOOP
 EXECUTE format('ALTER TABLE iasdpi_pilot.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON iasdpi_pilot.%I FROM public,anon,authenticated,service_role',t);
 EXECUTE format('GRANT SELECT,INSERT%s ON iasdpi_pilot.%I TO iasdpi_pilot_executor',CASE WHEN t='schedule_elder_periods' THEN ',UPDATE' ELSE '' END,t);
 EXECUTE format('CREATE POLICY church_boundary ON iasdpi_pilot.%I AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id())',t);
 EXECUTE format('CREATE POLICY church_executor ON iasdpi_pilot.%I FOR ALL TO iasdpi_pilot_executor USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id())',t);
 EXECUTE format('CREATE TRIGGER church_immutable BEFORE UPDATE OF church_id ON iasdpi_pilot.%I FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_admin.immutable_church()',t);
 END LOOP;
END $$;
-- Identidade determinística dos períodos virtuais: consulta não grava dados.
CREATE FUNCTION iasdpi_pilot_private.elder_id(d uuid,k text,s date) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT md5(public.iasdpi_pilot_current_church_id()::text||':'||d::text||':'||k||':'||to_char(s,'YYYY-MM-DD'))::uuid;
$$;
CREATE VIEW iasdpi_pilot_private.published_elder_periods WITH(security_invoker=true) AS
 SELECT p.id,p.church_id,p.department_id,p.kind,p.starts_on,p.ends_on,v.version,v.captured_at,
 (v.snapshot->>'person_id')::uuid person_id
 FROM iasdpi_pilot.schedule_elder_periods p CROSS JOIN LATERAL (
 SELECT x.version,x.captured_at,x.snapshot FROM iasdpi_pilot.schedule_elder_versions x
 WHERE x.church_id=p.church_id AND x.period_id=p.id AND x.snapshot->>'status'='published'
 ORDER BY x.version DESC LIMIT 1) v;
-- Mantém a versão publicada como compromisso mesmo durante uma revisão em rascunho.
CREATE OR REPLACE VIEW iasdpi_pilot_private.confirmed_days WITH(security_invoker=true) AS
 SELECT a.person_id,a.department_id,d.day,a.plan_id,a.id assignment_id FROM iasdpi_pilot.schedule_assignments a
 JOIN iasdpi_pilot.schedule_plans p ON p.id=a.plan_id AND p.status='published'
 CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(a) d(day)
 UNION ALL SELECT person_id,department_id,scheduled_on,NULL::uuid,NULL::uuid FROM iasdpi_pilot.schedule_legacy_commitments
 -- Uma revisão diária privada também não apaga o compromisso ainda público.
 UNION ALL SELECT a.person_id,p.department_id,day,p.id,a.id FROM iasdpi_pilot.schedule_plans p
 CROSS JOIN LATERAL (SELECT v.snapshot FROM iasdpi_pilot.schedule_versions v WHERE v.plan_id=p.id AND v.snapshot->>'status'='published' ORDER BY v.version DESC LIMIT 1) v
 CROSS JOIN LATERAL jsonb_array_elements(v.snapshot->'requirements') req
 CROSS JOIN LATERAL jsonb_array_elements(req->'assignments') entry
 CROSS JOIN LATERAL jsonb_populate_record(NULL::iasdpi_pilot.schedule_assignments,entry||jsonb_build_object('timing_mode',coalesce(entry->>'timing_mode','timed'))) a
 CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(a) day
 WHERE p.status='draft'
 UNION ALL SELECT p.person_id,p.department_id,d.day::date,NULL::uuid,p.id
 FROM iasdpi_pilot_private.published_elder_periods p
 CROSS JOIN LATERAL generate_series(p.starts_on::timestamp,p.ends_on::timestamp,interval '1 day') d(day) WHERE p.kind='weekly';
CREATE FUNCTION iasdpi_pilot_private.elder_validate(d uuid,k text,s date,e date,p uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE other record; BEGIN
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=d AND code='ancionato' AND active)
 OR (p IS NOT NULL AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people person JOIN iasdpi_pilot.schedule_memberships m ON m.person_id=person.id
 WHERE person.id=p AND person.active AND m.department_id=d AND m.active)) THEN
 RAISE EXCEPTION 'Pessoa inativa, sem vínculo ativo no Ancionato ou departamento indisponível.' USING errcode='23514';END IF;
 -- O vínculo ativo é a elegibilidade usada nesta modalidade; não cria habilitações.
 -- Disponibilidade e limites permanecem preferências; mensal não reserva dias.
 IF k='weekly' AND p IS NOT NULL THEN
 FOR other IN SELECT DISTINCT c.department_id,c.day FROM iasdpi_pilot_private.confirmed_days c
 WHERE c.person_id=p AND c.department_id<>d AND c.day BETWEEN s AND e LOOP
 IF NOT iasdpi_pilot_private.has_day_exception(p,other.day,d,other.department_id) THEN
 RAISE EXCEPTION 'Conflito com outro departamento em %; exige exceção administrativa justificada.',to_char(other.day,'DD/MM/YYYY') USING errcode='23P01';END IF;
 END LOOP;END IF;
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_elder_workspace(p_department uuid,p_month date,p_year integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_pilot_private.actor();first_day date;last_day date;result jsonb; BEGIN
 IF NOT iasdpi_pilot_private.can_view(u,p_department) OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND code='ancionato' AND active) THEN
 RAISE EXCEPTION 'Sem consulta autorizada ao Ancionato desta igreja.' USING errcode='42501';END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<'1000-02-01' OR p_month>'9998-11-01'
 OR (p_year IS NOT NULL AND (p_year<1000 OR p_year>9998)) THEN RAISE EXCEPTION 'Mês ou ano inválido.' USING errcode='22023';END IF;
 first_day:=p_month-extract(dow FROM p_month)::integer;last_day:=(p_month+interval '1 month - 1 day')::date;
 WITH definitions AS (
 SELECT 'weekly'::text kind,day::date starts_on,day::date+6 ends_on FROM generate_series(first_day::timestamp,last_day::timestamp,interval '7 days') day
 UNION ALL SELECT 'monthly',day::date,(day+interval '1 month - 1 day')::date FROM generate_series(
 coalesce(make_date(p_year,1,1),p_month)::timestamp,coalesce(make_date(p_year,12,1),p_month)::timestamp,interval '1 month') day
 ) SELECT jsonb_agg(coalesce(to_jsonb(p),jsonb_build_object('id',iasdpi_pilot_private.elder_id(p_department,x.kind,x.starts_on),
 'department_id',p_department,'kind',x.kind,'starts_on',x.starts_on,'ends_on',x.ends_on,'person_id',NULL,'status','draft','version',0)) ORDER BY x.kind DESC,x.starts_on)
 INTO result FROM definitions x LEFT JOIN iasdpi_pilot.schedule_elder_periods p ON p.department_id=p_department AND p.kind=x.kind AND p.starts_on=x.starts_on;
 RETURN jsonb_build_object('periods',result,'availability_enabled',false,
 'commitments',coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',c.person_id,'department_id',CASE WHEN c.department_id=p_department THEN p_department ELSE NULL END,'date',c.day,'status','published'))
 FROM iasdpi_pilot_private.confirmed_days c WHERE c.day BETWEEN first_day AND last_day+6
 AND (c.department_id=p_department OR NOT iasdpi_pilot_private.has_day_exception(c.person_id,c.day,p_department,c.department_id)) AND EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships m WHERE m.department_id=p_department AND m.person_id=c.person_id AND m.active)),'[]'),
 'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'starts_on',starts_on,'ends_on',ends_on,'person_id',person_id,'status','published','version',version) ORDER BY starts_on)
 FROM iasdpi_pilot_private.published_elder_periods WHERE department_id=p_department AND starts_on<p_month),'[]'));
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_elder_save(p_department uuid,p_status text,p_rows jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;item jsonb;old iasdpi_pilot.schedule_elder_periods;nextrow iasdpi_pilot.schedule_elder_periods;k text;s date;e date;p uuid;v bigint;rid uuid;seen text[]:='{}';sig text;receipt iasdpi_pilot_operational.receipts;result jsonb:='[]';batch_kind text;BEGIN
 u:=iasdpi_pilot_private.actor();
 -- Mesmo lock das RPCs operacionais: READ COMMITTED revalida após espera;
 -- REPEATABLE READ obsoleto falha com 40001 em vez de contornar o conflito.
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_pilot_private.actor();
 IF p_status IS NULL OR p_status NOT IN ('draft','published') OR p_request_id IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 12 OR pg_column_size(p_rows)>100000 THEN RAISE EXCEPTION 'Gravação de períodos inválida.' USING errcode='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND code='ancionato' AND active)
 OR NOT iasdpi_pilot_private.has_capability(u,p_department,'view')
 OR NOT iasdpi_pilot_private.has_capability(u,p_department,CASE WHEN p_status='published' THEN 'publish' ELSE 'edit' END) THEN
 RAISE EXCEPTION 'Sem permissão para esta ação do Ancionato nesta igreja.' USING errcode='42501';END IF;
 sig:='elder-g5:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('department',p_department,'status',p_status,'rows',p_rows));
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023';END IF;RETURN receipt.response;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
 IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR NOT (item ? 'person_id') OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) key WHERE NOT key=ANY(ARRAY['id','kind','starts_on','ends_on','person_id','expected_version']))
 THEN RAISE EXCEPTION 'Campos do período inválidos.' USING errcode='22023';END IF;
 k:=item->>'kind';s:=(item->>'starts_on')::date;e:=(item->>'ends_on')::date;p:=(item->>'person_id')::uuid;v:=(item->>'expected_version')::bigint;rid:=(item->>'id')::uuid;
 IF k IS NULL OR k NOT IN ('weekly','monthly') OR s IS NULL OR e IS NULL OR s<'1000-01-01' OR s>'9998-12-31' OR v IS NULL OR v<0 OR rid IS NULL
 OR (k='weekly' AND (extract(dow FROM s)<>0 OR e<>s+6)) OR (k='monthly' AND (extract(day FROM s)<>1 OR e<>(s+interval '1 month - 1 day')::date))
 OR k||':'||s::text=ANY(seen) OR (batch_kind IS NOT NULL AND batch_kind<>k) THEN RAISE EXCEPTION 'Períodos únicos e da mesma modalidade: domingo a sábado ou mês completo.' USING errcode='22023';END IF;
 batch_kind:=k;seen:=array_append(seen,k||':'||s::text);
 SELECT * INTO old FROM iasdpi_pilot.schedule_elder_periods WHERE department_id=p_department AND kind=k AND starts_on=s FOR UPDATE;
 IF rid IS DISTINCT FROM coalesce(old.id,iasdpi_pilot_private.elder_id(p_department,k,s)) OR coalesce(old.version,0)<>v THEN
 RAISE EXCEPTION 'Esta escala mudou em outra edição. Recarregue e compare antes de salvar.' USING errcode='40001';END IF;
 IF (old.person_id IS DISTINCT FROM p OR old.id IS NULL OR p_status='draft') AND NOT iasdpi_pilot_private.has_capability(u,p_department,'edit') THEN RAISE EXCEPTION 'Sem permissão para editar o Ancionato.' USING errcode='42501';END IF;
 IF old.status='published' AND NOT iasdpi_pilot_private.has_capability(u,p_department,'publish') THEN RAISE EXCEPTION 'Sem permissão para revisar escala publicada.' USING errcode='42501';END IF;
 IF p_status='published' AND p IS NULL THEN RAISE EXCEPTION 'Publicação bloqueada: há períodos sem ancião.' USING errcode='23514';END IF;
 PERFORM iasdpi_pilot_private.elder_validate(p_department,k,s,e,p);
 INSERT INTO iasdpi_pilot.schedule_elder_periods(id,department_id,kind,starts_on,ends_on,person_id,status,version,created_by,updated_by)
 VALUES(rid,p_department,k,s,e,p,p_status,v+1,u,u)
 ON CONFLICT(id) DO UPDATE SET person_id=excluded.person_id,status=excluded.status,version=excluded.version,updated_by=u,updated_at=now()
 RETURNING * INTO nextrow;
 INSERT INTO iasdpi_pilot.schedule_elder_versions(period_id,version,actor_id,snapshot) VALUES(rid,nextrow.version,u,to_jsonb(nextrow));
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields)
 VALUES(u,'elder-'||k,rid,p_department,nextrow.version,ARRAY['person_id','status']);
 result:=result||jsonb_build_array(to_jsonb(nextrow));
 END LOOP;
 result:=jsonb_build_object('periods',result);
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_elder_versions(p_department uuid,p_kind text,p_starts_on date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();BEGIN
 IF NOT iasdpi_pilot_private.can_view(u,p_department) OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND code='ancionato' AND active) THEN RAISE EXCEPTION 'Sem consulta ao histórico do Ancionato.' USING errcode='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('version',v.version,'actor_id',v.actor_id,'captured_at',v.captured_at,'snapshot',v.snapshot) ORDER BY v.version DESC)
 FROM iasdpi_pilot.schedule_elder_versions v JOIN iasdpi_pilot.schedule_elder_periods p ON p.church_id=v.church_id AND p.id=v.period_id
 WHERE p.department_id=p_department AND p.kind=p_kind AND p.starts_on=p_starts_on),'[]');END $$;
-- Revalida publicações preservadas ao alterar vínculo, pessoa, exceção ou compromisso.
CREATE FUNCTION iasdpi_pilot_private.elder_revalidate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE p record;BEGIN
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 FOR p IN SELECT * FROM iasdpi_pilot_private.published_elder_periods WHERE ends_on>=(now() AT TIME ZONE 'America/Sao_Paulo')::date LOOP
 PERFORM iasdpi_pilot_private.elder_validate(p.department_id,p.kind,p.starts_on,p.ends_on,p.person_id);END LOOP;RETURN NULL;END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_people','schedule_memberships','schedule_departments','schedule_day_exceptions','schedule_legacy_commitments','schedule_assignments','schedule_elder_versions'] LOOP
 EXECUTE format('CREATE CONSTRAINT TRIGGER elder_revalidate AFTER INSERT OR UPDATE OR DELETE ON iasdpi_pilot.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_private.elder_revalidate()',t);END LOOP;
END $$;
-- Amplia o feed público existente, sem expor rascunhos, contatos ou autores.
ALTER FUNCTION public.iasdpi_pilot_schedule_published(date) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_published(date) RENAME TO published_g4;
REVOKE ALL ON FUNCTION iasdpi_pilot_private.published_g4(date) FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.iasdpi_pilot_schedule_published(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE rows jsonb;BEGIN
 rows:=iasdpi_pilot_private.published_g4(p_month);
 RETURN rows||coalesce((SELECT jsonb_agg(jsonb_build_object('id','elder:'||p.id::text,'date',p.starts_on,'startDate',p.starts_on,'endDate',p.ends_on,
 'kind',p.kind,'department_id',p.department_id,'department',d.name,'person',person.display_name,'role',CASE WHEN p.kind='weekly' THEN 'Ancião da Semana' ELSE 'Ancião do Mês' END,
 'version',p.version,'published_at',p.captured_at,'origin','Escala publicada no sistema') ORDER BY p.starts_on,p.kind)
 FROM iasdpi_pilot_private.published_elder_periods p JOIN iasdpi_pilot.schedule_departments d ON d.id=p.department_id AND d.active
 JOIN iasdpi_pilot.schedule_people person ON person.id=p.person_id
 WHERE p.starts_on<=(p_month+interval '1 month - 1 day')::date AND p.ends_on>=p_month),'[]');END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_settings_get() SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_settings_get() RENAME TO settings_get_g4;
CREATE FUNCTION public.iasdpi_pilot_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN iasdpi_pilot_private.settings_get_g4()||jsonb_build_object('elder_periods',true);END $$;
-- O rodízio diário consulta os mesmos compromissos antes de sugerir pessoas.
ALTER FUNCTION public.iasdpi_pilot_schedule_rotation_context(uuid,date) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_rotation_context(uuid,date) RENAME TO rotation_context_g4;
REVOKE ALL ON FUNCTION iasdpi_pilot_private.rotation_context_g4(uuid,date) FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.iasdpi_pilot_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb;BEGIN
 result:=iasdpi_pilot_private.rotation_context_g4(p_department,p_month);
 RETURN result||jsonb_build_object('people',coalesce((SELECT jsonb_agg(person||jsonb_build_object(
 'history_count',(SELECT count(DISTINCT c.day) FROM iasdpi_pilot_private.confirmed_days c WHERE c.person_id=(person->>'person_id')::uuid AND c.department_id=p_department AND c.day<p_month),
 'last_day',(SELECT max(c.day) FROM iasdpi_pilot_private.confirmed_days c WHERE c.person_id=(person->>'person_id')::uuid AND c.department_id=p_department AND c.day<p_month),
 'global_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT value::date AS day FROM jsonb_array_elements_text(person->'global_days') UNION SELECT c.day FROM iasdpi_pilot_private.confirmed_days c WHERE c.person_id=(person->>'person_id')::uuid AND c.day>=p_month AND c.day<(p_month+interval '1 month')::date) dates),'[]'),
 'department_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT value::date AS day FROM jsonb_array_elements_text(person->'department_days') UNION SELECT c.day FROM iasdpi_pilot_private.confirmed_days c WHERE c.person_id=(person->>'person_id')::uuid AND c.department_id=p_department AND c.day>=p_month AND c.day<(p_month+interval '1 month')::date) dates),'[]'),
 'days',coalesce((SELECT jsonb_agg(day_item.value||jsonb_build_object('conflict',coalesce((day_item.value->>'conflict')::boolean,false) OR EXISTS(
 SELECT 1 FROM iasdpi_pilot_private.confirmed_days c WHERE c.person_id=(person->>'person_id')::uuid AND c.department_id<>p_department AND c.day=(day_item.value->>'date')::date
 AND NOT iasdpi_pilot_private.has_day_exception(c.person_id,c.day,p_department,c.department_id)))) FROM jsonb_array_elements(person->'days') day_item(value)),'[]')))
 FROM jsonb_array_elements(result->'people') person),'[]'));
END $$;
-- Workspace B1.1 faz despacho dinâmico para settings_get, preservando o restante.
-- Proprietários sem BYPASSRLS; auxiliares jamais executáveis pelo navegador.
GRANT CREATE ON SCHEMA public,iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='iasdpi_pilot_private' AND p.proname IN ('elder_id','elder_validate','elder_revalidate','published_g4','settings_get_g4','rotation_context_g4'))
 OR (n.nspname='public' AND p.proname IN ('iasdpi_pilot_schedule_elder_workspace','iasdpi_pilot_schedule_elder_save','iasdpi_pilot_schedule_elder_versions','iasdpi_pilot_schedule_published','iasdpi_pilot_schedule_settings_get','iasdpi_pilot_schedule_rotation_context')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 END LOOP;END $$;
ALTER VIEW iasdpi_pilot_private.published_elder_periods OWNER TO iasdpi_pilot_executor;
REVOKE ALL ON iasdpi_pilot_private.published_elder_periods FROM public,anon,authenticated,service_role;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private FROM iasdpi_pilot_executor;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_elder_workspace(uuid,date,integer),public.iasdpi_pilot_schedule_elder_save(uuid,text,jsonb,uuid),
 public.iasdpi_pilot_schedule_elder_versions(uuid,text,date),public.iasdpi_pilot_schedule_settings_get(),public.iasdpi_pilot_schedule_rotation_context(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_schedule_published(date) TO anon,authenticated;

-- Regras reutilizadas de 016_department_schedule_days.sql
-- G7: dias por departamento; executar somente após revisão e 001–015 completas.
-- Não remove eventos, planos, atribuições, históricos, contas ou permissões.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_pilot_schedule_elder_save(uuid,text,jsonb,uuid)') IS NULL
 OR to_regprocedure('public.iasdpi_pilot_portal_context()') IS NULL THEN RAISE EXCEPTION 'Exige postgres e migrações 001–015 completas.';END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='iasdpi_pilot.schedule_departments'::regclass AND attname='planning_weekdays' AND NOT attisdropped) THEN RAISE EXCEPTION '016 já instalada; não sobrescrever.';END IF;
END $$;
ALTER TABLE iasdpi_pilot.schedule_departments ADD COLUMN planning_weekdays smallint[] NOT NULL DEFAULT ARRAY[3,6,0]::smallint[]
 CHECK(cardinality(planning_weekdays)=0 OR iasdpi_pilot_private.valid_weekdays(planning_weekdays));
-- Preserva a escolha global anterior das igrejas já existentes; departamentos novos
-- começam com quarta/sábado/domingo. Apenas a coluna nova é preenchida.
UPDATE iasdpi_pilot.schedule_departments d SET planning_weekdays=s.weekdays FROM iasdpi_pilot.schedule_settings s
 WHERE s.church_id=d.church_id AND s.weekdays IS DISTINCT FROM d.planning_weekdays;
CREATE FUNCTION iasdpi_pilot_private.can_configure_days(u uuid,d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_pilot_private.is_admin(u) OR iasdpi_pilot_private.has_capability(u,d,'members') OR iasdpi_pilot_private.has_capability(u,d,'access');
$$;
CREATE FUNCTION public.iasdpi_pilot_schedule_department_days(p_department uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();BEGIN
 IF NOT iasdpi_pilot_private.can_view(u,p_department) OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND active) THEN RAISE EXCEPTION 'Sem consulta deste departamento.' USING errcode='42501';END IF;
 RETURN (SELECT jsonb_build_object('department_id',id,'weekdays',planning_weekdays,'version',version,'can_edit',iasdpi_pilot_private.can_configure_days(u,id)) FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND active);
END $$;
CREATE FUNCTION public.iasdpi_pilot_schedule_department_days_save(p_department uuid,p_expected_version bigint,p_weekdays smallint[],p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;d iasdpi_pilot.schedule_departments;sig text;r iasdpi_pilot_operational.receipts;result jsonb;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.can_configure_days(u,p_department) THEN RAISE EXCEPTION 'Sem administração deste departamento.' USING errcode='42501';END IF;
 SELECT * INTO d FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND active FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Departamento indisponível nesta igreja.' USING errcode='42501';END IF;
 IF p_expected_version IS NULL OR p_expected_version<1 OR p_request_id IS NULL OR p_weekdays IS NULL OR array_ndims(p_weekdays)>1
 OR NOT (cardinality(p_weekdays)=0 OR iasdpi_pilot_private.valid_weekdays(p_weekdays)) THEN RAISE EXCEPTION 'Dias ou versão inválidos. Use dias únicos de 0 a 6.' USING errcode='22023';END IF;
 sig:='department-days-g7:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('department',p_department,'version',p_expected_version,'weekdays',p_weekdays));
 SELECT * INTO r FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 IF d.version<>p_expected_version THEN RAISE EXCEPTION 'Configuração alterada em outro dispositivo. Recarregue e compare antes de salvar.' USING errcode='40001';END IF;
 UPDATE iasdpi_pilot.schedule_departments SET planning_weekdays=p_weekdays,version=version+1,updated_at=now() WHERE id=d.id;
 result:=public.iasdpi_pilot_schedule_department_days(d.id);
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields)
 VALUES(u,'department-days',d.id,d.id,(result->>'version')::bigint,ARRAY['planning_weekdays']);
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_settings_get() SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_settings_get() RENAME TO settings_get_g5;
CREATE FUNCTION public.iasdpi_pilot_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();BEGIN
 RETURN iasdpi_pilot_private.settings_get_g5()||jsonb_build_object('department_days_enabled',true,
 'department_weekdays',coalesce((SELECT jsonb_object_agg(id,planning_weekdays) FROM iasdpi_pilot.schedule_departments WHERE active AND iasdpi_pilot_private.can_view(u,id)),'{}'),
 'department_days_versions',coalesce((SELECT jsonb_object_agg(id,version) FROM iasdpi_pilot.schedule_departments WHERE active AND iasdpi_pilot_private.can_view(u,id)),'{}'),
 'department_days_can_edit',coalesce((SELECT jsonb_object_agg(id,iasdpi_pilot_private.can_configure_days(u,id)) FROM iasdpi_pilot.schedule_departments WHERE active AND iasdpi_pilot_private.can_view(u,id)),'{}'));
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_settings_save(bigint,jsonb) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_settings_save(bigint,jsonb) RENAME TO settings_save_g5;
CREATE FUNCTION public.iasdpi_pilot_schedule_settings_save(p_expected_version bigint,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador altera o período global.' USING errcode='42501';END IF;
 IF p_data ? 'weekdays' AND p_data->'weekdays' IS DISTINCT FROM (SELECT to_jsonb(weekdays) FROM iasdpi_pilot.schedule_settings) THEN
 RAISE EXCEPTION 'Configure os dias em cada departamento. Os dias globais anteriores foram preservados.' USING errcode='22023';END IF;
 RETURN iasdpi_pilot_private.settings_save_g5(p_expected_version,p_data-'weekdays');
END $$;
-- Mantém a implementação anterior privada para diagnóstico e recuperação revisada.
ALTER FUNCTION public.iasdpi_pilot_schedule_generate_days(uuid,text,uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_generate_days(uuid,text,uuid) RENAME TO generate_days_g5;
CREATE FUNCTION public.iasdpi_pilot_schedule_generate_days(p_department uuid,p_title text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;s iasdpi_pilot.schedule_settings;d iasdpi_pilot.schedule_departments;months date[];day date;events jsonb:='[]';sig text;r iasdpi_pilot_operational.receipts;result jsonb;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.has_capability(u,p_department,'edit') THEN RAISE EXCEPTION 'Sem edição deste departamento.' USING errcode='42501';END IF;
 SELECT * INTO d FROM iasdpi_pilot.schedule_departments WHERE id=p_department AND active;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Departamento indisponível.' USING errcode='42501';END IF;
 IF p_request_id IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Informe o nome dos cultos.' USING errcode='22023';END IF;
 sig:='department-generation-g7:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('department',p_department,'title',p_title));
 SELECT * INTO r FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 SELECT * INTO s FROM iasdpi_pilot.schedule_settings;
 months:=iasdpi_pilot_private.future_months((now() AT TIME ZONE 'America/Sao_Paulo')::date,s.planning_months);
 FOR day IN SELECT x::date FROM generate_series(months[1]::timestamp,(months[array_length(months,1)]+interval '1 month - 1 day')::timestamp,interval '1 day') x
 WHERE extract(dow FROM x)::smallint=ANY(d.planning_weekdays) OR x::date=ANY(s.extra_dates) LOOP
 events:=events||jsonb_build_array(public.iasdpi_pilot_schedule_event_create(gen_random_uuid(),jsonb_build_object('department_id',p_department,'title',p_title,'date',day),gen_random_uuid()));
 END LOOP;
 result:=jsonb_build_object('months',months,'events',events,'settings_version',s.version,'department_days_version',d.version,'weekdays',d.planning_weekdays);
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_rotation_context(uuid,date) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_rotation_context(uuid,date) RENAME TO rotation_context_g5;
CREATE FUNCTION public.iasdpi_pilot_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb;BEGIN
 result:=iasdpi_pilot_private.rotation_context_g5(p_department,p_month);
 RETURN result||jsonb_build_object('planning_weekdays',(SELECT planning_weekdays FROM iasdpi_pilot.schedule_departments WHERE id=p_department),'extra_dates',(SELECT extra_dates FROM iasdpi_pilot.schedule_settings));
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='iasdpi_pilot_private' AND p.proname IN ('can_configure_days','settings_get_g5','settings_save_g5','generate_days_g5','rotation_context_g5'))
 OR (n.nspname='public' AND p.proname IN ('iasdpi_pilot_schedule_department_days','iasdpi_pilot_schedule_department_days_save','iasdpi_pilot_schedule_settings_get','iasdpi_pilot_schedule_settings_save','iasdpi_pilot_schedule_generate_days','iasdpi_pilot_schedule_rotation_context')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private FROM iasdpi_pilot_executor;

-- Regras reutilizadas de 017_central_registry_integration.sql
-- G8.2: integração sobre a cadeia 001–016 disponível. G8.1 não encontrada no checkout.
-- Nenhuma pessoa, disponibilidade ou habilitação é inferida de nomes/organograma.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_pilot_schedule_department_days(uuid)') IS NULL THEN RAISE EXCEPTION 'Exige postgres e 001–016 completas.';END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='iasdpi_pilot.schedule_memberships'::regclass AND attname='participation_confirmed' AND NOT attisdropped) THEN RAISE EXCEPTION '017 já instalada; revisar sem sobrescrever.';END IF;
END $$;
ALTER TABLE iasdpi_pilot.schedule_memberships
 ADD COLUMN participation_confirmed boolean NOT NULL DEFAULT false,
 ADD COLUMN availability_override boolean NOT NULL DEFAULT false,
 ADD COLUMN leadership_scope text NOT NULL DEFAULT '' CHECK(length(leadership_scope)<=120);
ALTER TABLE iasdpi_pilot.schedule_availability DROP CONSTRAINT schedule_availability_origin_check;
ALTER TABLE iasdpi_pilot.schedule_availability ADD CONSTRAINT schedule_availability_origin_check CHECK(origin IN ('manual','daily-profile','registry-g82'));
-- Preserva confirmações explícitas existentes; liderança e função genérica não confirmam qualificação.
UPDATE iasdpi_pilot.schedule_memberships m SET participation_confirmed=true WHERE EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_qualifications q WHERE q.membership_id=m.id);
CREATE TABLE iasdpi_pilot.schedule_source_links(
 church_id uuid NOT NULL DEFAULT public.iasdpi_pilot_current_church_id() REFERENCES iasdpi_pilot.iasdpi_churches(id),
 source_key text NOT NULL CHECK(length(source_key) BETWEEN 1 AND 500),person_id uuid NOT NULL,
 reference jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(reference)='object'),
 version bigint NOT NULL CHECK(version>0),updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(church_id,source_key),FOREIGN KEY(church_id,person_id) REFERENCES iasdpi_pilot.schedule_people(church_id,id)
);
ALTER TABLE iasdpi_pilot.schedule_source_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iasdpi_pilot.schedule_source_links FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON iasdpi_pilot.schedule_source_links TO iasdpi_pilot_executor;
CREATE POLICY church_boundary ON iasdpi_pilot.schedule_source_links AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id());
CREATE POLICY church_executor ON iasdpi_pilot.schedule_source_links FOR ALL TO iasdpi_pilot_executor USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id());
CREATE TRIGGER church_immutable BEFORE UPDATE OF church_id ON iasdpi_pilot.schedule_source_links FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_admin.immutable_church();
CREATE INDEX schedule_source_links_person ON iasdpi_pilot.schedule_source_links(church_id,person_id);
-- A implementação anterior à 010 já distingue disponibilidade desconhecida.
CREATE OR REPLACE FUNCTION iasdpi_pilot_private.day_availability(person uuid,department uuid,day date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN iasdpi_pilot_private.day_availability_009(person,department,day)='unavailable' THEN 'unavailable'
 WHEN EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships m WHERE m.person_id=person AND m.department_id=department AND m.availability_override) THEN
 CASE WHEN EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_availability v WHERE v.person_id=person AND v.department_id=department AND v.active AND v.kind='available' AND v.start_time IS NULL AND v.end_time IS NULL AND
 ((v.pattern='weekly' AND extract(dow FROM day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR day>=v.valid_from) AND (v.valid_until IS NULL OR day<=v.valid_until)) OR (v.pattern='period' AND day BETWEEN v.starts_on AND v.ends_on))) THEN 'available' ELSE 'unknown' END
 ELSE iasdpi_pilot_private.day_availability_009(person,department,day) END;
$$;
CREATE FUNCTION public.iasdpi_pilot_registry_people(p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d WHERE d.active AND iasdpi_pilot_private.has_capability(u,d.id,'members')) THEN RAISE EXCEPTION 'Sem administração de membros.' USING errcode='42501';END IF;
 IF p_search IS NULL OR length(p_search)>160 THEN RAISE EXCEPTION 'Pesquisa inválida.' USING errcode='22023';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'display_name',display_name,'active',active,'version',version) ORDER BY name,id) FROM iasdpi_pilot.schedule_people WHERE position(iasdpi_pilot_private.normal_name(p_search) in normalized_name)>0),'[]');
END $$;
CREATE FUNCTION public.iasdpi_pilot_registry_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();c jsonb;BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d WHERE d.active AND iasdpi_pilot_private.has_capability(u,d.id,'members')) THEN RAISE EXCEPTION 'Sem administração de membros.' USING errcode='42501';END IF;
 c:=public.iasdpi_pilot_schedule_catalog();
 RETURN c||jsonb_build_object('profiles',coalesce((SELECT jsonb_agg(jsonb_build_object('membership_id',m.id,'weekdays',
 (SELECT jsonb_object_agg(day::text,coalesce((SELECT v.kind FROM iasdpi_pilot.schedule_availability v WHERE v.person_id=m.person_id AND (v.department_id=m.department_id OR (v.department_id IS NULL AND NOT m.availability_override)) AND v.active AND v.pattern='weekly' AND v.start_time IS NULL AND v.end_time IS NULL AND day=ANY(v.weekdays) ORDER BY CASE v.kind WHEN 'unavailable' THEN 0 ELSE 1 END LIMIT 1),'unknown')) FROM generate_series(0,6) day)))
 FROM iasdpi_pilot.schedule_memberships m WHERE iasdpi_pilot_private.has_capability(u,m.department_id,'members')),'[]'),
 'source_links',CASE WHEN iasdpi_pilot_private.is_admin(u) THEN coalesce((SELECT jsonb_agg(to_jsonb(l)-'church_id'-'updated_by') FROM iasdpi_pilot.schedule_source_links l),'[]') ELSE '[]'::jsonb END);
END $$;
CREATE FUNCTION public.iasdpi_pilot_registry_save(p_person uuid,p_expected_person_version bigint,p_person_patch jsonb,p_links jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;a boolean;p iasdpi_pilot.schedule_people;m iasdpi_pilot.schedule_memberships;entry jsonb;patch jsonb;dep uuid;expected bigint;result jsonb;sig text;receipt iasdpi_pilot_operational.receipts;r uuid;v text;days smallint[];kind text;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();a:=iasdpi_pilot_private.is_admin(u);
 IF p_person IS NULL OR p_request_id IS NULL OR p_expected_person_version IS NULL OR p_expected_person_version<0 OR jsonb_typeof(p_person_patch) IS DISTINCT FROM 'object' OR jsonb_typeof(p_links) IS DISTINCT FROM 'array' OR jsonb_array_length(p_links)>100 OR pg_column_size(p_links)>120000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_person_patch) k WHERE k NOT IN ('name','display_name','active')) THEN RAISE EXCEPTION 'Dados inválidos.' USING errcode='22023';END IF;
 IF NOT a AND (p_person_patch<>'{}' OR jsonb_array_length(p_links)=0) THEN RAISE EXCEPTION 'Dados da pessoa são administrados centralmente. Edite apenas os vínculos autorizados.' USING errcode='42501';END IF;
 -- Autoriza todos os vínculos antes de consultar recibo ou alterar qualquer linha.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_links) e GROUP BY e->>'department_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Departamento repetido no lote.' USING errcode='22023';END IF;
 FOR entry IN SELECT * FROM jsonb_array_elements(p_links) LOOP
 dep:=(entry->>'department_id')::uuid;
 IF dep IS NULL OR NOT iasdpi_pilot_private.has_capability(u,dep,'members') OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=dep AND active) THEN RAISE EXCEPTION 'Sem administração deste departamento.' USING errcode='42501';END IF;
 END LOOP;
 sig:='registry-g82:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('person',p_person,'version',p_expected_person_version,'patch',p_person_patch,'links',p_links));
 SELECT * INTO receipt FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023';END IF;RETURN receipt.response;END IF;
 SELECT * INTO p FROM iasdpi_pilot.schedule_people WHERE id=p_person FOR UPDATE;
 IF coalesce(p.version,0)<>p_expected_person_version THEN RAISE EXCEPTION 'Cadastro da pessoa mudou. Recarregue e compare.' USING errcode='40001';END IF;
 IF p.id IS NULL AND (NOT a OR NOT p_person_patch ? 'name') THEN RAISE EXCEPTION 'Selecione uma pessoa existente ou solicite cadastro ao administrador.' USING errcode='42501';END IF;
 IF p_person_patch<>'{}' THEN
 patch:=p_person_patch;
 IF patch ? 'name' AND NOT patch ? 'display_name' THEN patch:=patch||jsonb_build_object('display_name',patch->>'name');END IF;
 PERFORM public.iasdpi_pilot_schedule_save('person',p_person,p_expected_person_version,patch,gen_random_uuid());
 END IF;
 FOR entry IN SELECT * FROM jsonb_array_elements(p_links) LOOP
 dep:=(entry->>'department_id')::uuid;expected:=(entry->>'expected_version')::bigint;patch:=entry->'patch';
 IF expected IS NULL OR expected<0 OR jsonb_typeof(patch) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(entry) k WHERE k NOT IN ('department_id','expected_version','patch')) OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN ('active','is_ministry_head','leadership_scope','participation_confirmed','availability_override','max_monthly_count','role_ids','weekdays')) THEN RAISE EXCEPTION 'Vínculo ou campo inválido.' USING errcode='22023';END IF;
 SELECT * INTO m FROM iasdpi_pilot.schedule_memberships WHERE person_id=p_person AND department_id=dep FOR UPDATE;
 IF coalesce(m.version,0)<>expected THEN RAISE EXCEPTION 'Vínculo alterado em outra edição. Recarregue e compare.' USING errcode='40001';END IF;
 IF patch ? 'leadership_scope' AND patch->>'leadership_scope'<>'' AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments WHERE id=dep AND code='diaconato' AND patch->>'leadership_scope' IN ('Diaconato — Diáconos','Diaconato — Diaconisas')) THEN RAISE EXCEPTION 'Subdivisão de liderança inválida.' USING errcode='22023';END IF;
 IF patch ? 'role_ids' AND (jsonb_typeof(patch->'role_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(patch->'role_ids')>100) THEN RAISE EXCEPTION 'Funções inválidas.' USING errcode='22023';END IF;
 IF m.id IS NULL THEN INSERT INTO iasdpi_pilot.schedule_memberships(person_id,department_id) VALUES(p_person,dep) RETURNING * INTO m;END IF;
 UPDATE iasdpi_pilot.schedule_memberships SET active=CASE WHEN patch?'active' THEN (patch->>'active')::boolean ELSE active END,
 is_ministry_head=CASE WHEN patch?'is_ministry_head' THEN (patch->>'is_ministry_head')::boolean ELSE is_ministry_head END,
 leadership_scope=CASE WHEN patch?'leadership_scope' THEN patch->>'leadership_scope' ELSE leadership_scope END,
 participation_confirmed=CASE WHEN patch?'participation_confirmed' THEN (patch->>'participation_confirmed')::boolean ELSE participation_confirmed END,
 availability_override=CASE WHEN patch?'weekdays' THEN true WHEN patch?'availability_override' THEN (patch->>'availability_override')::boolean ELSE availability_override END,
 max_monthly_count=CASE WHEN patch?'max_monthly_count' THEN (patch->>'max_monthly_count')::integer ELSE max_monthly_count END,
 version=CASE WHEN expected=0 THEN 1 ELSE version+1 END,updated_at=now() WHERE id=m.id;
 IF patch ? 'role_ids' THEN
 DELETE FROM iasdpi_pilot.schedule_qualifications WHERE membership_id=m.id;
 FOR r IN SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(patch->'role_ids') LOOP
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_roles WHERE id=r AND department_id=dep AND active) THEN RAISE EXCEPTION 'Função de outro departamento ou inativa.' USING errcode='23514';END IF;
 INSERT INTO iasdpi_pilot.schedule_qualifications(membership_id,role_id,department_id) VALUES(m.id,r,dep);END LOOP;
 END IF;
 IF patch ? 'weekdays' THEN
 IF jsonb_typeof(patch->'weekdays') IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each_text(patch->'weekdays') x WHERE x.key !~ '^[0-6]$' OR x.value NOT IN ('available','unavailable','unknown') OR x.value IS NULL) OR (SELECT count(*) FROM jsonb_object_keys(patch->'weekdays'))<>7 THEN RAISE EXCEPTION 'Confirme os sete dias: disponível, indisponível ou pendente.' USING errcode='22023';END IF;
 UPDATE iasdpi_pilot.schedule_availability SET active=false,version=version+1,updated_at=now() WHERE person_id=p_person AND department_id=dep AND origin='registry-g82' AND active;
 FOREACH kind IN ARRAY ARRAY['available','unavailable'] LOOP
 SELECT array_agg(key::smallint ORDER BY key) INTO days FROM jsonb_each_text(patch->'weekdays') WHERE value=kind;
 IF days IS NOT NULL THEN INSERT INTO iasdpi_pilot.schedule_availability(person_id,department_id,kind,pattern,weekdays,origin) VALUES(p_person,dep,kind,'weekly',days,'registry-g82');END IF;
 END LOOP;
 END IF;
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields,reason) VALUES(u,'registry-membership',m.id,dep,CASE WHEN expected=0 THEN 1 ELSE expected+1 END,ARRAY(SELECT jsonb_object_keys(patch)),jsonb_build_object('old_scope',m.leadership_scope,'scope',coalesce(patch->>'leadership_scope',m.leadership_scope))::text);
 END LOOP;
 SELECT jsonb_build_object('person',to_jsonb(person)-'auth_user_id'-'normalized_name','memberships',coalesce((SELECT jsonb_agg(to_jsonb(link)) FROM iasdpi_pilot.schedule_memberships link WHERE link.person_id=p_person AND iasdpi_pilot_private.has_capability(u,link.department_id,'members')),'[]')) INTO result FROM iasdpi_pilot.schedule_people person WHERE id=p_person;
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_pilot_registry_source_save(p_source_key text,p_person uuid,p_expected_version bigint,p_request_id uuid,p_reference jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE day date;u uuid;old iasdpi_pilot.schedule_source_links;result jsonb;sig text;r iasdpi_pilot_operational.receipts;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Associação exige administrador da igreja.' USING errcode='42501';END IF;
 IF p_source_key IS NULL OR length(p_source_key) NOT BETWEEN 1 AND 500 OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people WHERE id=p_person) THEN RAISE EXCEPTION 'Associação inválida.' USING errcode='22023';END IF;
 sig:='registry-source:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('source',p_source_key,'person',p_person,'version',p_expected_version,'reference',p_reference));SELECT * INTO r FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 IF jsonb_typeof(p_reference) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_reference) k WHERE k NOT IN ('department_id','starts_on','ends_on','kind','original_name')) THEN RAISE EXCEPTION 'Referência histórica inválida.' USING errcode='22023';END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_legacy_commitments l WHERE (l.source_key=p_source_key OR starts_with(l.source_key,p_source_key||':day:')) AND l.person_id<>p_person) THEN RAISE EXCEPTION 'Compromisso histórico já conciliado com outra identidade. Exige revisão administrativa; não foi sobrescrito.' USING errcode='23505';END IF;
 IF p_reference<>'{}' THEN
 IF p_reference->>'kind' IS NULL OR length(coalesce(p_reference->>'original_name','')) NOT BETWEEN 1 AND 160 OR p_reference->>'kind' NOT IN ('daily','weekly','monthly') OR (p_reference->>'starts_on')::date IS NULL OR (p_reference->>'ends_on')::date IS NULL OR (p_reference->>'ends_on')::date<(p_reference->>'starts_on')::date OR (p_reference->>'ends_on')::date-(p_reference->>'starts_on')::date>31 THEN RAISE EXCEPTION 'Período histórico inválido.' USING errcode='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships WHERE person_id=p_person AND department_id=(p_reference->>'department_id')::uuid) THEN RAISE EXCEPTION 'Vincule a pessoa ao departamento antes de conciliar o histórico.' USING errcode='23514';END IF;
 -- Mês não reserva dias, conforme a regra do Ancionato. Dias/semanas reutilizam 009.
 IF p_reference->>'kind'<>'monthly' THEN
 FOR day IN SELECT x::date FROM generate_series((p_reference->>'starts_on')::date::timestamp,(p_reference->>'ends_on')::date::timestamp,interval '1 day') x LOOP
 PERFORM public.iasdpi_pilot_schedule_register_legacy(jsonb_build_array(jsonb_build_object('source_key',p_source_key||':day:'||day::text,'person_id',p_person,'department_id',p_reference->>'department_id','date',day,'original_name',p_reference->>'original_name')),gen_random_uuid());
 END LOOP;END IF;
 END IF;
 SELECT * INTO old FROM iasdpi_pilot.schedule_source_links WHERE source_key=p_source_key FOR UPDATE;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Associação alterada em outra edição.' USING errcode='40001';END IF;
 INSERT INTO iasdpi_pilot.schedule_source_links(source_key,person_id,reference,version,updated_by) VALUES(p_source_key,p_person,p_reference,1,u) ON CONFLICT(church_id,source_key) DO UPDATE SET person_id=excluded.person_id,reference=CASE WHEN p_reference='{}'::jsonb THEN schedule_source_links.reference ELSE p_reference END,version=schedule_source_links.version+1,updated_by=u,updated_at=now() RETURNING to_jsonb(schedule_source_links)-'church_id'-'updated_by' INTO result;
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,version,changed_fields,reason) VALUES(u,'registry-source',p_person,(result->>'version')::bigint,ARRAY['association'],p_source_key);
 INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_pilot_registry_public() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM public.iasdpi_pilot_current_church_id(); -- A função validada já exige igreja ativa/listada; não amplia grants de tabela.
 RETURN jsonb_build_object('heads',coalesce((SELECT jsonb_agg(jsonb_build_object('department_code',d.code,'department',d.name,'scope',m.leadership_scope,'name',p.display_name)) FROM iasdpi_pilot.schedule_memberships m JOIN iasdpi_pilot.schedule_people p ON p.id=m.person_id JOIN iasdpi_pilot.schedule_departments d ON d.id=m.department_id WHERE m.active AND m.is_ministry_head AND p.active AND d.active),'[]'),
 'configured',coalesce((SELECT jsonb_agg(x) FROM (SELECT DISTINCT d.code department_code,d.name department,scope.value scope FROM iasdpi_pilot_private.audit_logs a JOIN iasdpi_pilot.schedule_departments d ON d.id=a.department_id CROSS JOIN LATERAL jsonb_array_elements_text(jsonb_build_array((CASE WHEN a.entity='registry-membership' THEN a.reason::jsonb ELSE '{}'::jsonb END)->>'old_scope',(CASE WHEN a.entity='registry-membership' THEN a.reason::jsonb ELSE '{}'::jsonb END)->>'scope')) scope(value) WHERE a.entity='registry-membership' AND a.changed_fields && ARRAY['is_ministry_head','leadership_scope'] AND d.active) x),'[]'),
 'links',coalesce((SELECT jsonb_agg(jsonb_build_object('source_key',l.source_key,'display_name',p.display_name)) FROM iasdpi_pilot.schedule_source_links l JOIN iasdpi_pilot.schedule_people p ON p.id=l.person_id),'[]'));
END $$;
CREATE FUNCTION public.iasdpi_pilot_registry_history(p_person uuid,p_department uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();BEGIN
 IF NOT iasdpi_pilot_private.has_capability(u,p_department,'members') OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships WHERE person_id=p_person AND department_id=p_department) THEN RAISE EXCEPTION 'Sem histórico deste vínculo.' USING errcode='42501';END IF;
 RETURN jsonb_build_object('current',coalesce((SELECT jsonb_agg(row ORDER BY row->>'assigned_on' DESC) FROM (
 SELECT jsonb_build_object('assigned_on',e.scheduled_on,'department',d.name,'role',r.name,'status',p.status) row FROM iasdpi_pilot.schedule_assignments a JOIN iasdpi_pilot.schedule_requirements req ON req.id=a.requirement_id JOIN iasdpi_pilot.schedule_roles r ON r.id=req.role_id JOIN iasdpi_pilot.schedule_departments d ON d.id=a.department_id JOIN iasdpi_pilot.schedule_events e ON e.id=req.event_id JOIN iasdpi_pilot.schedule_plans p ON p.id=a.plan_id WHERE a.person_id=p_person AND a.department_id=p_department
 UNION ALL SELECT jsonb_build_object('assigned_on',l.scheduled_on,'department',d.name,'role','Função histórica: Pendente de confirmação','status','Histórico manual — original preservado','original_name',l.original_name) FROM iasdpi_pilot.schedule_legacy_commitments l JOIN iasdpi_pilot.schedule_departments d ON d.id=l.department_id WHERE l.person_id=p_person AND l.department_id=p_department
 UNION ALL SELECT jsonb_build_object('assigned_on',l.reference->>'starts_on','ends_on',l.reference->>'ends_on','department',d.name,'role','Ancião do Mês · referência histórica','status','Histórico manual — original preservado') FROM iasdpi_pilot.schedule_source_links l JOIN iasdpi_pilot.schedule_departments d ON d.id=(l.reference->>'department_id')::uuid WHERE l.person_id=p_person AND d.id=p_department AND l.reference->>'kind'='monthly'
 UNION ALL SELECT jsonb_build_object('assigned_on',x.starts_on,'ends_on',x.ends_on,'department',d.name,'role',CASE x.kind WHEN 'weekly' THEN 'Ancião da Semana' ELSE 'Ancião do Mês' END,'status',x.status) FROM iasdpi_pilot.schedule_elder_periods x JOIN iasdpi_pilot.schedule_departments d ON d.id=x.department_id WHERE x.person_id=p_person AND x.department_id=p_department
 ) rows),'[]'),
 'versions',coalesce((SELECT jsonb_agg(row) FROM (
 SELECT jsonb_build_object('version',v.version,'title',v.snapshot->>'title','status',v.snapshot->>'status','captured_at',v.captured_at) row FROM iasdpi_pilot.schedule_versions v JOIN iasdpi_pilot.schedule_plans p ON p.id=v.plan_id WHERE p.department_id=p_department AND EXISTS(SELECT 1 FROM jsonb_array_elements(v.snapshot->'requirements') req CROSS JOIN LATERAL jsonb_array_elements(req->'assignments') a WHERE a->>'person_id'=p_person::text)
 UNION ALL SELECT jsonb_build_object('version',v.version,'title',v.snapshot->>'kind','status',v.snapshot->>'status','captured_at',v.captured_at) FROM iasdpi_pilot.schedule_elder_versions v JOIN iasdpi_pilot.schedule_elder_periods p ON p.id=v.period_id WHERE p.department_id=p_department AND v.snapshot->>'person_id'=p_person::text
 ) rows),'[]'));
END $$;
-- Contexto central mantém a detecção cruzada, mas nunca converte unknown em available.
ALTER FUNCTION public.iasdpi_pilot_schedule_rotation_context(uuid,date) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_rotation_context(uuid,date) RENAME TO rotation_context_g7;
CREATE FUNCTION public.iasdpi_pilot_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb;BEGIN
 c:=iasdpi_pilot_private.rotation_context_g7(p_department,p_month);
 RETURN c||jsonb_build_object('central_registry',true,'availability_enabled',true,'availability_default','unknown','people',coalesce((SELECT jsonb_agg(person||jsonb_build_object('days',(SELECT jsonb_agg(day||jsonb_build_object('state',iasdpi_pilot_private.day_availability((person->>'person_id')::uuid,p_department,(day->>'date')::date))) FROM jsonb_array_elements(person->'days') day))) FROM jsonb_array_elements(c->'people') person),'[]'));
END $$;
ALTER FUNCTION public.iasdpi_pilot_schedule_settings_get() SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_settings_get() RENAME TO settings_get_g7;
CREATE FUNCTION public.iasdpi_pilot_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN iasdpi_pilot_private.settings_get_g7()||jsonb_build_object('central_registry',true,'availability_enabled',true,'availability_default','unknown');END $$;
-- Períodos do Ancionato consultam confirmação por data, sem recortar semanas/meses.
ALTER FUNCTION public.iasdpi_pilot_schedule_elder_workspace(uuid,date,integer) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_elder_workspace(uuid,date,integer) RENAME TO elder_workspace_g7;
CREATE FUNCTION public.iasdpi_pilot_schedule_elder_workspace(p_department uuid,p_month date,p_year integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb;s date;e date;BEGIN
 c:=iasdpi_pilot_private.elder_workspace_g7(p_department,p_month,p_year);
 SELECT min((x->>'starts_on')::date),max((x->>'ends_on')::date) INTO s,e FROM jsonb_array_elements(c->'periods') x;
 RETURN c||jsonb_build_object('central_registry',true,'availability_days',coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',m.person_id,'date',d::date,'state',iasdpi_pilot_private.day_availability(m.person_id,p_department,d::date))) FROM iasdpi_pilot.schedule_memberships m CROSS JOIN generate_series(s::timestamp,e::timestamp,interval '1 day') d WHERE m.department_id=p_department AND m.active),'[]'));
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='public' AND p.proname IN ('iasdpi_pilot_registry_history','iasdpi_pilot_registry_people','iasdpi_pilot_registry_catalog','iasdpi_pilot_registry_save','iasdpi_pilot_registry_source_save','iasdpi_pilot_registry_public','iasdpi_pilot_schedule_elder_workspace','iasdpi_pilot_schedule_rotation_context','iasdpi_pilot_schedule_settings_get')) OR (n.nspname='iasdpi_pilot_private' AND p.proname IN ('day_availability','rotation_context_g7','settings_get_g7','elder_workspace_g7')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 IF f.proname='iasdpi_pilot_registry_public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.sig);END IF;
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private FROM iasdpi_pilot_executor;

-- Regras reutilizadas de 018_registry_search.sql
-- G8.3: corrige somente a pesquisa do cadastro central. Não cria tabelas nem altera registros.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_pilot_registry_save(uuid,bigint,jsonb,jsonb,uuid)') IS NULL
 OR to_regclass('iasdpi_pilot.schedule_source_links') IS NULL THEN RAISE EXCEPTION 'Exige postgres e migrações 001–017 completas.';END IF;
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_registry_people(p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();term text;BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d WHERE d.active AND iasdpi_pilot_private.has_capability(u,d.id,'members')) THEN RAISE EXCEPTION 'Sem administração de membros.' USING errcode='42501';END IF;
 IF p_search IS NULL OR length(p_search)>160 THEN RAISE EXCEPTION 'Pesquisa inválida.' USING errcode='22023';END IF;
 term:=iasdpi_pilot_private.normal_name(p_search);
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'display_name',display_name,'active',active,'version',version) ORDER BY name,id)
 FROM iasdpi_pilot.schedule_people WHERE position(term in normalized_name)>0 OR position(term in iasdpi_pilot_private.normal_name(display_name))>0),'[]');
END $$;
GRANT CREATE ON SCHEMA public TO iasdpi_pilot_executor;
ALTER FUNCTION public.iasdpi_pilot_registry_people(text) OWNER TO iasdpi_pilot_executor;
REVOKE ALL ON FUNCTION public.iasdpi_pilot_registry_people(text) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_registry_people(text) TO authenticated;
REVOKE CREATE ON SCHEMA public FROM iasdpi_pilot_executor;

-- Regras reutilizadas de 019_registry_identities.sql
-- G8.4. Revisar após 001–018. Instalar NÃO renomeia nem mescla pessoas.
-- Renomeação/mesclagem: somente RPC administrativa, prévia e confirmação explícita.
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_pilot_registry_people(text)') IS NULL
 OR to_regclass('iasdpi_pilot.schedule_source_links') IS NULL THEN RAISE EXCEPTION 'Exige postgres e cadeia 001–018 revisada.';END IF;
 IF to_regclass('iasdpi_pilot_private.person_aliases') IS NOT NULL THEN RAISE EXCEPTION '019 já instalada. Revisar sem sobrescrever.';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname IN('iasdpi_pilot_registry_identity_preview','iasdpi_pilot_registry_identity_apply','iasdpi_pilot_registry_audit')) OR (n.nspname='iasdpi_pilot_private' AND p.proname IN('canonical_person','confirmed_person_names','identity_group','identity_person_guard','identity_display_sync','identity_reference_guard','catalog_g83','save_g83','public_g83'))) THEN RAISE EXCEPTION 'Objetos G8.4 preexistentes: revisar antes de instalar.';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['iasdpi_pilot_schedule_catalog','iasdpi_pilot_schedule_save','iasdpi_pilot_registry_people','iasdpi_pilot_registry_public','iasdpi_pilot_registry_history']) expected(name) WHERE (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=expected.name)<>1) THEN RAISE EXCEPTION 'RPC ausente ou sobrecarga inesperada. Revisar a cadeia anterior.';END IF;

END $$;
ALTER TABLE iasdpi_pilot.schedule_people ADD COLUMN merged_into uuid,
 ADD CONSTRAINT schedule_people_merged_fk FOREIGN KEY(church_id,merged_into) REFERENCES iasdpi_pilot.schedule_people(church_id,id),
 ADD CONSTRAINT schedule_people_merged_check CHECK(merged_into IS NULL OR (merged_into<>id AND NOT active));
CREATE INDEX schedule_people_merged ON iasdpi_pilot.schedule_people(church_id,merged_into) WHERE merged_into IS NOT NULL;
CREATE TABLE iasdpi_pilot_private.person_aliases(
 church_id uuid NOT NULL DEFAULT public.iasdpi_pilot_current_church_id(),person_id uuid NOT NULL,
 alias text NOT NULL CHECK(length(btrim(alias)) BETWEEN 2 AND 160),
 normalized_alias text GENERATED ALWAYS AS(iasdpi_pilot_private.normal_name(alias)) STORED,
 scope text NOT NULL DEFAULT '',created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(church_id,person_id,normalized_alias,scope),
 FOREIGN KEY(church_id,person_id) REFERENCES iasdpi_pilot.schedule_people(church_id,id)
);
ALTER TABLE iasdpi_pilot_private.person_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iasdpi_pilot_private.person_aliases FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON iasdpi_pilot_private.person_aliases TO iasdpi_pilot_executor;
CREATE POLICY church_boundary ON iasdpi_pilot_private.person_aliases AS RESTRICTIVE FOR ALL TO public
 USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id());
CREATE POLICY church_executor ON iasdpi_pilot_private.person_aliases FOR ALL TO iasdpi_pilot_executor
 USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id());
CREATE TRIGGER church_immutable BEFORE UPDATE OF church_id ON iasdpi_pilot_private.person_aliases FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_admin.immutable_church();
CREATE INDEX registry_alias_search ON iasdpi_pilot_private.person_aliases(church_id,normalized_alias);
DO $$ DECLARE c record;BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='iasdpi_pilot.schedule_availability'::regclass AND confrelid='iasdpi_pilot.schedule_memberships'::regclass AND contype='f' LOOP
 EXECUTE format('ALTER TABLE iasdpi_pilot.schedule_availability ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE',c.conname);END LOOP;END $$;


CREATE FUNCTION iasdpi_pilot_private.canonical_person(p uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(merged_into,id) FROM iasdpi_pilot.schedule_people WHERE id=p;
$$;
-- Lista fechada: nenhuma associação por semelhança ou inferência de ministério.
CREATE FUNCTION iasdpi_pilot_private.confirmed_person_names() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT '[]'::jsonb; $$;

CREATE FUNCTION iasdpi_pilot_private.identity_group(target text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET jit=off AS $$
DECLARE rule jsonb;ids uuid[];blocked text[]:='{}';refs jsonb:='{}';rows jsonb;t text;names text[];part jsonb;BEGIN
 IF public.iasdpi_pilot_current_church_id()<>'1a5d0000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Correspondências autorizadas somente para IASD_PI.' USING errcode='42501';END IF;
 SELECT x INTO rule FROM jsonb_array_elements(iasdpi_pilot_private.confirmed_person_names()) x WHERE x->>'name'=target;
 IF rule IS NULL THEN RAISE EXCEPTION 'Nome fora das correspondências confirmadas.' USING errcode='22023';END IF;
 SELECT array_agg(iasdpi_pilot_private.normal_name(x)) INTO names FROM jsonb_array_elements_text(rule->'aliases'||jsonb_build_array(target)) x;
 SELECT array_agg(p.id ORDER BY (p.name=target) DESC,p.created_at,p.id),jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'display_name',p.display_name,'version',p.version,'active',p.active) ORDER BY (p.name=target) DESC,p.created_at,p.id)
 INTO ids,rows FROM iasdpi_pilot.schedule_people p WHERE p.merged_into IS NULL AND p.normalized_name=ANY(names)
 AND (p.normalized_name=iasdpi_pilot_private.normal_name(target) OR NOT rule?'department' OR EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships m JOIN iasdpi_pilot.schedule_departments d ON d.id=m.department_id WHERE m.person_id=p.id AND d.code=rule->>'department'));
 ids:=coalesce(ids,'{}');rows:=coalesce(rows,'[]');
 -- Relatório inclui TODAS as referências vivas e seus valores no token (sem expô-los ao cliente).
 FOREACH t IN ARRAY ARRAY['schedule_memberships','schedule_availability','schedule_assignments','schedule_day_exceptions','schedule_legacy_commitments','schedule_elder_periods','schedule_source_links'] LOOP
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),%L::jsonb) FROM iasdpi_pilot.%I x WHERE person_id=ANY($1)','[]',t) INTO part USING ids;refs:=refs||jsonb_build_object(t,part);
 END LOOP;
 refs:=refs||jsonb_build_object('people',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM iasdpi_pilot.schedule_people p WHERE p.id=ANY(ids)),'private_details',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY person_id),'[]') FROM iasdpi_pilot_private.person_details x WHERE person_id=ANY(ids)),
 'qualifications',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.membership_id,q.role_id),'[]') FROM iasdpi_pilot.schedule_qualifications q JOIN iasdpi_pilot.schedule_memberships m ON m.id=q.membership_id WHERE m.person_id=ANY(ids)),
 'confirmed_days',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY to_jsonb(c)::text),'[]') FROM iasdpi_pilot_private.confirmed_days c WHERE c.person_id=ANY(ids)),
 'aliases',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text),'[]') FROM iasdpi_pilot_private.person_aliases a WHERE a.person_id=ANY(ids)));
 IF cardinality(ids)>1 THEN
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships WHERE person_id=ANY(ids) GROUP BY department_id HAVING count(*)>1) THEN blocked:=array_append(blocked,'Há vínculos duplicados no mesmo departamento. Revisar condições, funções e limites antes de mesclar.');END IF;
 IF (SELECT count(DISTINCT auth_user_id) FROM iasdpi_pilot.schedule_people WHERE id=ANY(ids))>1 THEN blocked:=array_append(blocked,'Há contas autenticadas diferentes. Nenhuma conta será desvinculada automaticamente.');END IF;
 IF (SELECT count(DISTINCT jsonb_build_array(active,max_monthly_count)) FROM iasdpi_pilot.schedule_people WHERE id=ANY(ids))>1 THEN blocked:=array_append(blocked,'Status ou limites globais divergem. Revisar antes da mesclagem.');END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_availability WHERE person_id=ANY(ids) AND department_id IS NULL AND active) THEN blocked:=array_append(blocked,'Disponibilidade global pode afetar novos departamentos. Revisão necessária.');END IF;
 IF (SELECT count(DISTINCT contact) FROM iasdpi_pilot_private.person_details WHERE person_id=ANY(ids) AND contact<>'')>1 OR (SELECT count(DISTINCT notes) FROM iasdpi_pilot_private.person_details WHERE person_id=ANY(ids) AND notes<>'')>1 THEN blocked:=array_append(blocked,'Contatos ou notas privadas divergem. Revisão administrativa necessária.');END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot_private.confirmed_days a JOIN iasdpi_pilot_private.confirmed_days b ON a.day=b.day AND a.department_id<>b.department_id AND a.person_id<>b.person_id WHERE a.person_id=ANY(ids) AND b.person_id=ANY(ids)) THEN blocked:=array_append(blocked,'As identidades possuem compromissos confirmados em departamentos diferentes no mesmo dia.');END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_assignments WHERE person_id=ANY(ids) GROUP BY requirement_id HAVING count(*)>1) OR EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_day_exceptions WHERE person_id=ANY(ids) GROUP BY day,department_a,department_b HAVING count(*)>1) THEN blocked:=array_append(blocked,'Referências operacionais duplicadas exigem revisão.');END IF;
 END IF;
 -- Falha fechada se uma evolução futura acrescentar uma referência não tratada.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint k WHERE k.contype='f' AND k.confrelid='iasdpi_pilot.schedule_people'::regclass AND k.conrelid NOT IN ('iasdpi_pilot.schedule_people'::regclass,'iasdpi_pilot.schedule_memberships'::regclass,'iasdpi_pilot.schedule_availability'::regclass,'iasdpi_pilot.schedule_assignments'::regclass,'iasdpi_pilot.schedule_day_exceptions'::regclass,'iasdpi_pilot.schedule_legacy_commitments'::regclass,'iasdpi_pilot.schedule_elder_periods'::regclass,'iasdpi_pilot.schedule_source_links'::regclass,'iasdpi_pilot_private.person_details'::regclass,'iasdpi_pilot_private.person_aliases'::regclass)) THEN blocked:=array_append(blocked,'Existe referência adicional ao cadastro central. Revisar a integração antes de consolidar.');END IF;
 RETURN jsonb_build_object('name',target,'aliases',rule->'aliases','department',rule->>'department','people',rows,'blockers',to_jsonb(blocked),
 'references',(SELECT jsonb_object_agg(key,jsonb_array_length(value)) FROM jsonb_each(refs)),
 'token',md5(jsonb_build_object('church',public.iasdpi_pilot_current_church_id(),'rule',rule,'people',rows,'references',refs,'blockers',blocked)::text));
END $$;

CREATE FUNCTION public.iasdpi_pilot_registry_identity_preview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET jit=off AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Conciliação exige administrador da igreja.' USING errcode='42501';END IF;
 RETURN jsonb_build_object('groups',CASE WHEN public.iasdpi_pilot_current_church_id()='1a5d0000-0000-4000-8000-000000000001'::uuid THEN
 (SELECT jsonb_agg(iasdpi_pilot_private.identity_group(x->>'name')) FROM jsonb_array_elements(iasdpi_pilot_private.confirmed_person_names()) x) ELSE '[]'::jsonb END,
 'possible_duplicates',coalesce((SELECT jsonb_agg(g) FROM (WITH labels AS (SELECT id,name,normalized_name FROM iasdpi_pilot.schedule_people WHERE merged_into IS NULL UNION SELECT p.id,p.name,a.normalized_alias FROM iasdpi_pilot.schedule_people p JOIN iasdpi_pilot_private.person_aliases a ON a.person_id=p.id WHERE p.merged_into IS NULL) SELECT normalized_name,count(*) count,jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY id) people FROM labels GROUP BY normalized_name HAVING count(*)>1) g),'[]'));
END $$;

CREATE FUNCTION public.iasdpi_pilot_registry_identity_apply(p_name text,p_canonical uuid,p_token text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET jit=off AS $$
DECLARE u uuid;g jsonb;ids uuid[];sources uuid[];t text;periodrow record;keep iasdpi_pilot.schedule_people;sig text;r iasdpi_pilot_operational.receipts;result jsonb;plan uuid;authid uuid;before_refs jsonb:='{}';part jsonb;BEGIN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador da igreja.' USING errcode='42501';END IF;
 IF p_request_id IS NULL OR p_token IS NULL OR p_canonical IS NULL OR p_name IS NULL THEN RAISE EXCEPTION 'Conciliação inválida.' USING errcode='22023';END IF;
 sig:='registry-identity:'||iasdpi_pilot_operational.fingerprint(jsonb_build_object('name',p_name,'canonical',p_canonical,'token',p_token,'church',public.iasdpi_pilot_current_church_id()));
 SELECT * INTO r FROM iasdpi_pilot_operational.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 g:=iasdpi_pilot_private.identity_group(p_name);
 IF g->>'token'<>p_token THEN RAISE EXCEPTION 'Dados mudaram após a prévia. Recarregue e compare antes de confirmar.' USING errcode='40001';END IF;
 IF jsonb_array_length(g->'blockers')>0 THEN RAISE EXCEPTION 'Conciliação bloqueada: %',g->'blockers' USING errcode='23514';END IF;
 SELECT array_agg((x->>'id')::uuid) INTO ids FROM jsonb_array_elements(g->'people') x;
 IF ids IS NULL OR NOT p_canonical=ANY(ids) THEN RAISE EXCEPTION 'Escolha um identificador da prévia.' USING errcode='22023';END IF;
 SELECT array_agg(x) INTO sources FROM unnest(ids) x WHERE x<>p_canonical;sources:=coalesce(sources,'{}');
 IF EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people WHERE merged_into=ANY(sources)) THEN RAISE EXCEPTION 'Uma identidade já consolidada deve permanecer como identificador principal.' USING errcode='23514';END IF;
 PERFORM 1 FROM iasdpi_pilot.schedule_people WHERE id=ANY(ids) ORDER BY id FOR UPDATE;SET CONSTRAINTS ALL DEFERRED;
 SELECT * INTO STRICT keep FROM iasdpi_pilot.schedule_people WHERE id=p_canonical;
 FOREACH t IN ARRAY ARRAY['schedule_memberships','schedule_availability','schedule_assignments','schedule_day_exceptions','schedule_legacy_commitments','schedule_elder_periods','schedule_source_links'] LOOP
 EXECUTE format('SELECT coalesce(jsonb_agg(jsonb_build_object(%L,to_jsonb(x)->%L,%L,to_jsonb(x)->%L,%L,to_jsonb(x)->%L,%L,to_jsonb(x)->%L) ORDER BY to_jsonb(x)::text),%L) FROM iasdpi_pilot.%I x WHERE person_id=ANY($1)','id','id','person_id','person_id','source_key','source_key','version','version','[]',t) INTO part USING ids;
 before_refs:=before_refs||jsonb_build_object(t,part);END LOOP;
 before_refs:=before_refs||jsonb_build_object('auth_links',(SELECT jsonb_agg(jsonb_build_object('person_id',id,'auth_user_id',auth_user_id)) FROM iasdpi_pilot.schedule_people WHERE id=ANY(ids)));

 -- Guardar grafias antes da mudança, sem reescrever snapshots antigos.
 INSERT INTO iasdpi_pilot_private.person_aliases(person_id,alias,scope,created_by)
 SELECT p_canonical,v.alias,coalesce(g->>'department',''),u FROM iasdpi_pilot.schedule_people p CROSS JOIN LATERAL (VALUES(p.name),(p.display_name)) v(alias) WHERE p.id=ANY(ids) ON CONFLICT DO NOTHING;
 INSERT INTO iasdpi_pilot_private.person_aliases(person_id,alias,scope,created_by)
 SELECT p_canonical,x,coalesce(g->>'department',''),u FROM jsonb_array_elements_text(g->'aliases') x ON CONFLICT DO NOTHING;
 INSERT INTO iasdpi_pilot_private.person_aliases(person_id,alias,scope,created_by)
 SELECT p_canonical,alias,scope,u FROM iasdpi_pilot_private.person_aliases WHERE person_id=ANY(sources) ON CONFLICT DO NOTHING;
 SELECT max(auth_user_id::text)::uuid INTO authid FROM iasdpi_pilot.schedule_people WHERE id=ANY(ids);
 UPDATE iasdpi_pilot.schedule_people SET auth_user_id=NULL,version=version+1,updated_at=now() WHERE id=ANY(sources) AND auth_user_id IS NOT NULL;
 UPDATE iasdpi_pilot.schedule_people SET name=p_name,display_name=p_name,auth_user_id=authid,version=version+1,updated_at=now() WHERE id=p_canonical;
 INSERT INTO iasdpi_pilot_private.person_details(person_id,contact,notes,church_id)
 SELECT p_canonical,coalesce(max(nullif(contact,'')),''),coalesce(max(nullif(notes,'')),''),public.iasdpi_pilot_current_church_id() FROM iasdpi_pilot_private.person_details WHERE person_id=ANY(ids)
 ON CONFLICT(person_id) DO UPDATE SET contact=excluded.contact,notes=excluded.notes;
 UPDATE iasdpi_pilot.schedule_memberships SET person_id=p_canonical,version=version+1,updated_at=now() WHERE person_id=ANY(sources);
 UPDATE iasdpi_pilot.schedule_availability SET person_id=p_canonical,version=version+1,updated_at=now() WHERE person_id=ANY(sources);
 UPDATE iasdpi_pilot.schedule_day_exceptions SET person_id=p_canonical,version=version+1 WHERE person_id=ANY(sources);
 UPDATE iasdpi_pilot.schedule_legacy_commitments SET person_id=p_canonical WHERE person_id=ANY(sources);
 UPDATE iasdpi_pilot.schedule_source_links SET person_id=p_canonical,version=version+1,updated_at=now() WHERE person_id=ANY(sources);
 -- Cada planejamento tocado ganha versão; autoria de criação e snapshots antigos ficam intactos.
 FOR plan IN SELECT DISTINCT plan_id FROM iasdpi_pilot.schedule_assignments WHERE person_id=ANY(sources) LOOP
 UPDATE iasdpi_pilot.schedule_assignments SET person_id=p_canonical WHERE plan_id=plan AND person_id=ANY(sources);
 UPDATE iasdpi_pilot.schedule_plans SET version=version+1,updated_by=u,updated_at=now() WHERE id=plan;
 INSERT INTO iasdpi_pilot.schedule_versions(plan_id,version,actor_id,snapshot) SELECT id,version,u,iasdpi_pilot_private.plan_snapshot(id) FROM iasdpi_pilot.schedule_plans WHERE id=plan;
 END LOOP;
 FOR periodrow IN UPDATE iasdpi_pilot.schedule_elder_periods SET person_id=p_canonical,version=version+1,updated_by=u,updated_at=now() WHERE person_id=ANY(sources) RETURNING * LOOP
 INSERT INTO iasdpi_pilot.schedule_elder_versions(period_id,version,actor_id,snapshot) VALUES(periodrow.id,periodrow.version,u,to_jsonb(periodrow));END LOOP;
 UPDATE iasdpi_pilot.schedule_people SET merged_into=p_canonical,active=false,display_name=p_name,version=version+1,updated_at=now() WHERE id=ANY(sources);
 INSERT INTO iasdpi_pilot_private.audit_logs(actor_id,entity,entity_id,version,changed_fields,reason)
 SELECT u,'registry-identity',p_canonical,version,ARRAY['names','aliases','canonical_id'],jsonb_build_object('before',g->'people','canonical_id',p_canonical,'name',p_name,'sources',sources,'references',g->'references','reference_ids_before',before_refs)::text FROM iasdpi_pilot.schedule_people WHERE id=p_canonical;
 result:=jsonb_build_object('person_id',p_canonical,'name',p_name,'retired_ids',sources);
 SET CONSTRAINTS ALL IMMEDIATE;INSERT INTO iasdpi_pilot_operational.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;

-- Impede reutilizar cadastros consolidados ou criar referências novas para IDs aposentados.
CREATE FUNCTION iasdpi_pilot_private.identity_person_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 IF OLD.merged_into IS NOT NULL AND NOT (pg_trigger_depth()>1 AND NEW.name=OLD.name AND NEW.merged_into=OLD.merged_into AND NOT NEW.active) THEN RAISE EXCEPTION 'Cadastro consolidado. Utilize o identificador principal.' USING errcode='23514';END IF;
 IF NEW.name IS DISTINCT FROM OLD.name OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
 u:=iasdpi_pilot_private.actor();INSERT INTO iasdpi_pilot_private.person_aliases(person_id,alias,created_by)
 SELECT coalesce(NEW.merged_into,NEW.id),x,u FROM unnest(ARRAY[OLD.name,OLD.display_name]) x ON CONFLICT DO NOTHING;
 END IF;RETURN NEW;
END $$;
CREATE FUNCTION iasdpi_pilot_private.identity_display_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.merged_into IS NULL AND NEW.display_name IS DISTINCT FROM OLD.display_name THEN UPDATE iasdpi_pilot.schedule_people SET display_name=NEW.display_name,version=version+1,updated_at=now() WHERE merged_into=NEW.id;END IF;RETURN NULL;END $$;
CREATE TRIGGER identity_person_guard BEFORE UPDATE ON iasdpi_pilot.schedule_people FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_private.identity_person_guard();
CREATE TRIGGER identity_display_sync AFTER UPDATE OF display_name ON iasdpi_pilot.schedule_people FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_private.identity_display_sync();
CREATE FUNCTION iasdpi_pilot_private.identity_reference_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.person_id IS NOT NULL AND EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people WHERE id=NEW.person_id AND merged_into IS NOT NULL) THEN RAISE EXCEPTION 'Pessoa consolidada. Recarregue o cadastro central.' USING errcode='23514';END IF;RETURN NEW;END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_memberships','schedule_availability','schedule_assignments','schedule_day_exceptions','schedule_legacy_commitments','schedule_elder_periods','schedule_source_links'] LOOP
 EXECUTE format('CREATE TRIGGER identity_reference_guard BEFORE INSERT OR UPDATE OF person_id ON iasdpi_pilot.%I FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_private.identity_reference_guard()',t);END LOOP;
END $$;

-- A RPC antiga também respeita o cadastro central: identidade só por admin.
ALTER FUNCTION public.iasdpi_pilot_schedule_save(text,uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_save(text,uuid,bigint,jsonb,uuid) RENAME TO save_g83;
CREATE FUNCTION public.iasdpi_pilot_schedule_save(p_entity text,p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 IF p_entity='person' THEN
 u:=iasdpi_pilot_private.actor();UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;u:=iasdpi_pilot_private.actor();
 IF NOT iasdpi_pilot_private.is_admin(u) THEN RAISE EXCEPTION 'Identidade central administrada pela igreja. Edite somente os vínculos autorizados.' USING errcode='42501';END IF;END IF;
 RETURN iasdpi_pilot_private.save_g83(p_entity,p_id,p_expected_version,p_data,p_request_id);
END $$;

ALTER FUNCTION public.iasdpi_pilot_schedule_catalog() SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_schedule_catalog() RENAME TO catalog_g83;
CREATE FUNCTION public.iasdpi_pilot_schedule_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb;BEGIN
 c:=iasdpi_pilot_private.catalog_g83();RETURN c||jsonb_build_object('identity_registry',true,'identity_redirects',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'canonical_id',p.merged_into,'original_name',p.name)) FROM iasdpi_pilot.schedule_people p WHERE p.merged_into IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(c->'people') x WHERE (x->>'id')::uuid=p.merged_into)),'[]'),'people',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(c->'people') x JOIN iasdpi_pilot.schedule_people p ON p.id=(x->>'id')::uuid WHERE p.merged_into IS NULL),'[]'));END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_pilot_registry_people(p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();term text;BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_departments d WHERE d.active AND iasdpi_pilot_private.has_capability(u,d.id,'members')) THEN RAISE EXCEPTION 'Sem administração de membros.' USING errcode='42501';END IF;
 IF p_search IS NULL OR length(p_search)>160 THEN RAISE EXCEPTION 'Pesquisa inválida.' USING errcode='22023';END IF;term:=iasdpi_pilot_private.normal_name(p_search);
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'display_name',p.display_name,'active',p.active,'version',p.version,'aliases',coalesce((SELECT jsonb_agg(DISTINCT alias ORDER BY alias) FROM iasdpi_pilot_private.person_aliases WHERE person_id=p.id),'[]')) ORDER BY p.name,p.id)
 FROM iasdpi_pilot.schedule_people p WHERE p.merged_into IS NULL AND (position(term in p.normalized_name)>0 OR position(term in iasdpi_pilot_private.normal_name(p.display_name))>0 OR EXISTS(SELECT 1 FROM iasdpi_pilot_private.person_aliases a WHERE a.person_id=p.id AND position(term in a.normalized_alias)>0))),'[]');END $$;
CREATE FUNCTION public.iasdpi_pilot_registry_audit(p_person uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();ids uuid[];BEGIN
 IF NOT iasdpi_pilot_private.is_admin(u) OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people WHERE id=p_person AND merged_into IS NULL) THEN RAISE EXCEPTION 'Histórico cadastral exige administrador da igreja.' USING errcode='42501';END IF;
 SELECT array_agg(id) INTO ids FROM iasdpi_pilot.schedule_people WHERE id=p_person OR merged_into=p_person;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'actor_id',a.actor_id,'entity',a.entity,'captured_at',a.captured_at,'version',a.version,'changed_fields',a.changed_fields) ORDER BY a.captured_at DESC,a.id)
 FROM iasdpi_pilot_private.audit_logs a WHERE a.entity_id=ANY(ids) OR a.entity_id IN(SELECT id FROM iasdpi_pilot.schedule_memberships WHERE person_id=p_person)),'[]');END $$;

CREATE OR REPLACE VIEW iasdpi_pilot_private.published_elder_periods WITH(security_invoker=true) AS
 SELECT p.id,p.church_id,p.department_id,p.kind,p.starts_on,p.ends_on,v.version,v.captured_at,
 iasdpi_pilot_private.canonical_person((v.snapshot->>'person_id')::uuid) person_id
 FROM iasdpi_pilot.schedule_elder_periods p CROSS JOIN LATERAL (
 SELECT x.version,x.captured_at,x.snapshot FROM iasdpi_pilot.schedule_elder_versions x
 WHERE x.church_id=p.church_id AND x.period_id=p.id AND x.snapshot->>'status'='published'
 ORDER BY x.version DESC LIMIT 1) v;
-- Mantém a versão publicada como compromisso mesmo durante uma revisão em rascunho.
CREATE OR REPLACE VIEW iasdpi_pilot_private.confirmed_days WITH(security_invoker=true) AS
 SELECT iasdpi_pilot_private.canonical_person(a.person_id) person_id,a.department_id,d.day,a.plan_id,a.id assignment_id FROM iasdpi_pilot.schedule_assignments a
 JOIN iasdpi_pilot.schedule_plans p ON p.id=a.plan_id AND p.status='published'
 CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(a) d(day)
 UNION ALL SELECT iasdpi_pilot_private.canonical_person(person_id),department_id,scheduled_on,NULL::uuid,NULL::uuid FROM iasdpi_pilot.schedule_legacy_commitments
 -- Uma revisão diária privada também não apaga o compromisso ainda público.
 UNION ALL SELECT iasdpi_pilot_private.canonical_person(a.person_id),p.department_id,day,p.id,a.id FROM iasdpi_pilot.schedule_plans p
 CROSS JOIN LATERAL (SELECT v.snapshot FROM iasdpi_pilot.schedule_versions v WHERE v.plan_id=p.id AND v.snapshot->>'status'='published' ORDER BY v.version DESC LIMIT 1) v
 CROSS JOIN LATERAL jsonb_array_elements(v.snapshot->'requirements') req
 CROSS JOIN LATERAL jsonb_array_elements(req->'assignments') entry
 CROSS JOIN LATERAL jsonb_populate_record(NULL::iasdpi_pilot.schedule_assignments,entry||jsonb_build_object('timing_mode',coalesce(entry->>'timing_mode','timed'))) a
 CROSS JOIN LATERAL iasdpi_pilot_private.assignment_days(a) day
 WHERE p.status='draft'
 UNION ALL SELECT p.person_id,p.department_id,d.day::date,NULL::uuid,p.id
 FROM iasdpi_pilot_private.published_elder_periods p
 CROSS JOIN LATERAL generate_series(p.starts_on::timestamp,p.ends_on::timestamp,interval '1 day') d(day) WHERE p.kind='weekly';

CREATE OR REPLACE FUNCTION public.iasdpi_pilot_registry_history(p_person uuid,p_department uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_pilot_private.actor();BEGIN
 IF NOT iasdpi_pilot_private.has_capability(u,p_department,'members') OR NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_memberships WHERE person_id=p_person AND department_id=p_department) THEN RAISE EXCEPTION 'Sem histórico deste vínculo.' USING errcode='42501';END IF;
 RETURN jsonb_build_object('current',coalesce((SELECT jsonb_agg(row ORDER BY row->>'assigned_on' DESC) FROM (
 SELECT jsonb_build_object('assigned_on',e.scheduled_on,'department',d.name,'role',r.name,'status',p.status) row FROM iasdpi_pilot.schedule_assignments a JOIN iasdpi_pilot.schedule_requirements req ON req.id=a.requirement_id JOIN iasdpi_pilot.schedule_roles r ON r.id=req.role_id JOIN iasdpi_pilot.schedule_departments d ON d.id=a.department_id JOIN iasdpi_pilot.schedule_events e ON e.id=req.event_id JOIN iasdpi_pilot.schedule_plans p ON p.id=a.plan_id WHERE a.person_id=p_person AND a.department_id=p_department
 UNION ALL SELECT jsonb_build_object('assigned_on',l.scheduled_on,'department',d.name,'role','Função histórica: Pendente de confirmação','status','Histórico manual — original preservado','original_name',l.original_name) FROM iasdpi_pilot.schedule_legacy_commitments l JOIN iasdpi_pilot.schedule_departments d ON d.id=l.department_id WHERE l.person_id=p_person AND l.department_id=p_department
 UNION ALL SELECT jsonb_build_object('assigned_on',l.reference->>'starts_on','ends_on',l.reference->>'ends_on','department',d.name,'role','Ancião do Mês · referência histórica','status','Histórico manual — original preservado') FROM iasdpi_pilot.schedule_source_links l JOIN iasdpi_pilot.schedule_departments d ON d.id=(l.reference->>'department_id')::uuid WHERE l.person_id=p_person AND d.id=p_department AND l.reference->>'kind'='monthly'
 UNION ALL SELECT jsonb_build_object('assigned_on',x.starts_on,'ends_on',x.ends_on,'department',d.name,'role',CASE x.kind WHEN 'weekly' THEN 'Ancião da Semana' ELSE 'Ancião do Mês' END,'status',x.status) FROM iasdpi_pilot.schedule_elder_periods x JOIN iasdpi_pilot.schedule_departments d ON d.id=x.department_id WHERE x.person_id=p_person AND x.department_id=p_department
 ) rows),'[]'),
 'versions',coalesce((SELECT jsonb_agg(row) FROM (
 SELECT jsonb_build_object('version',v.version,'title',v.snapshot->>'title','status',v.snapshot->>'status','captured_at',v.captured_at) row FROM iasdpi_pilot.schedule_versions v JOIN iasdpi_pilot.schedule_plans p ON p.id=v.plan_id WHERE p.department_id=p_department AND EXISTS(SELECT 1 FROM jsonb_array_elements(v.snapshot->'requirements') req CROSS JOIN LATERAL jsonb_array_elements(req->'assignments') a WHERE iasdpi_pilot_private.canonical_person((a->>'person_id')::uuid)=p_person)
 UNION ALL SELECT jsonb_build_object('version',v.version,'title',v.snapshot->>'kind','status',v.snapshot->>'status','captured_at',v.captured_at) FROM iasdpi_pilot.schedule_elder_versions v JOIN iasdpi_pilot.schedule_elder_periods p ON p.id=v.period_id WHERE p.department_id=p_department AND iasdpi_pilot_private.canonical_person((v.snapshot->>'person_id')::uuid)=p_person
 ) rows),'[]'));
END $$;


-- Projeção pública estritamente das equivalências que a liderança confirmou;
-- nunca enumera contatos, apelidos de login ou nomes privados de outras pessoas.
ALTER FUNCTION public.iasdpi_pilot_registry_public() SET SCHEMA iasdpi_pilot_private;
ALTER FUNCTION iasdpi_pilot_private.iasdpi_pilot_registry_public() RENAME TO public_g83;
CREATE FUNCTION public.iasdpi_pilot_registry_public() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb;names jsonb;BEGIN
 c:=iasdpi_pilot_private.public_g83();names:=coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('alias',a.alias,'name',p.display_name,'department',a.scope))
 FROM iasdpi_pilot_private.person_aliases a JOIN iasdpi_pilot.schedule_people p ON p.id=a.person_id AND p.merged_into IS NULL
 WHERE public.iasdpi_pilot_current_church_id()='1a5d0000-0000-4000-8000-000000000001'::uuid AND EXISTS(SELECT 1 FROM jsonb_array_elements(iasdpi_pilot_private.confirmed_person_names()) r CROSS JOIN LATERAL jsonb_array_elements_text(r->'aliases') n WHERE iasdpi_pilot_private.normal_name(n)=a.normalized_alias AND coalesce(r->>'department','')=a.scope)),'[]');RETURN c||CASE WHEN jsonb_array_length(names)>0 THEN jsonb_build_object('confirmed_names',names) ELSE '{}'::jsonb END;END $$;

GRANT CREATE ON SCHEMA public,iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 (n.nspname='public' AND p.proname IN('iasdpi_pilot_registry_identity_preview','iasdpi_pilot_registry_identity_apply','iasdpi_pilot_registry_audit','iasdpi_pilot_registry_people','iasdpi_pilot_schedule_catalog','iasdpi_pilot_schedule_save','iasdpi_pilot_registry_history','iasdpi_pilot_registry_public')) OR
 (n.nspname='iasdpi_pilot_private' AND p.proname IN('canonical_person','confirmed_person_names','identity_group','identity_person_guard','identity_display_sync','identity_reference_guard','catalog_g83','save_g83','public_g83')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;IF f.proname='iasdpi_pilot_registry_public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.sig);END IF;END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot_private FROM iasdpi_pilot_executor;

UPDATE iasdpi_pilot_admin.installation SET step=3 WHERE singleton;
SELECT iasdpi_pilot_admin.assert_core_unchanged();
NOTIFY pgrst,'reload schema';
COMMIT;
