-- Complemento MANUAL do piloto: responsável do evento por ID central.
-- Não executar remotamente pelo agente. Não reaplicar 001–005.
-- Somente tabelas/RPCs do piloto; sem alterações em Auth ou permissões.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR (SELECT step FROM iasdpi_pilot_admin.installation WHERE singleton) IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'Exige postgres e cinco etapas isoladas concluídas.';END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='iasdpi_pilot.iasdpi_events'::regclass AND attname='responsible_person_id' AND NOT attisdropped) THEN RAISE EXCEPTION 'Complemento já instalado; verificar, não reaplicar.';END IF;
END $$;
SELECT iasdpi_pilot_admin.assert_core_unchanged();
SELECT 1 FROM iasdpi_pilot_admin.control WHERE singleton FOR UPDATE;
ALTER TABLE iasdpi_pilot.iasdpi_events ADD COLUMN responsible_person_id uuid,
 ADD CONSTRAINT event_responsible_person_fk FOREIGN KEY(church_id,responsible_person_id) REFERENCES iasdpi_pilot.schedule_people(church_id,id);
CREATE INDEX event_responsible_person ON iasdpi_pilot.iasdpi_events(church_id,responsible_person_id) WHERE responsible_person_id IS NOT NULL;
DO $patch$ DECLARE change jsonb; sig regprocedure; body text; before_text text; after_text text; owner_before oid; acl_before aclitem[];BEGIN
 FOR change IN SELECT value FROM jsonb_array_elements($changes$[
  {
    "function": "iasdpi_pilot_private.event_store(uuid,bigint,jsonb,uuid,uuid,date,boolean)",
    "before": "'organizer_department_id','spaces'))",
    "after": "'organizer_department_id','spaces','responsible_person_id'))"
  },
  {
    "function": "iasdpi_pilot_private.event_store(uuid,bigint,jsonb,uuid,uuid,date,boolean)",
    "before": "organizer_department_id=e.organizer_department_id,location=e.location",
    "after": "responsible_person_id=e.responsible_person_id,organizer_department_id=e.organizer_department_id,location=e.location"
  },
  {
    "function": "iasdpi_pilot_private.event_store(uuid,bigint,jsonb,uuid,uuid,date,boolean)",
    "before": "e.id:=p_id;e.church_id:=c;",
    "after": "IF e.responsible_person_id IS NOT NULL AND (old.id IS NULL OR e.responsible_person_id IS DISTINCT FROM old.responsible_person_id) AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people p WHERE p.id=e.responsible_person_id AND p.church_id=c AND p.active AND p.merged_into IS NULL) THEN RAISE EXCEPTION 'Selecione uma pessoa ativa do Cadastro Geral desta igreja.' USING errcode='23514';END IF;\n e.id:=p_id;e.church_id:=c;"
  },
  {
    "function": "iasdpi_pilot_private.event_save_021(uuid,bigint,jsonb,uuid)",
    "before": "'organizer_department_id'))",
    "after": "'organizer_department_id','responsible_person_id'))"
  },
  {
    "function": "iasdpi_pilot_private.event_save_021(uuid,bigint,jsonb,uuid)",
    "before": "organizer_department_id=e.organizer_department_id,location=e.location",
    "after": "responsible_person_id=e.responsible_person_id,organizer_department_id=e.organizer_department_id,location=e.location"
  },
  {
    "function": "iasdpi_pilot_private.event_save_021(uuid,bigint,jsonb,uuid)",
    "before": "e.id:=p_id;e.church_id:=c;",
    "after": "IF e.responsible_person_id IS NOT NULL AND (old.id IS NULL OR e.responsible_person_id IS DISTINCT FROM old.responsible_person_id) AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot.schedule_people p WHERE p.id=e.responsible_person_id AND p.church_id=c AND p.active AND p.merged_into IS NULL) THEN RAISE EXCEPTION 'Selecione uma pessoa ativa do Cadastro Geral desta igreja.' USING errcode='23514';END IF;\n e.id:=p_id;e.church_id:=c;"
  },
  {
    "function": "public.iasdpi_pilot_event_series_save(uuid,bigint,jsonb,uuid,text,uuid,boolean)",
    "before": "'recurrence_weekday','recurrence_ordinal'))",
    "after": "'recurrence_weekday','recurrence_ordinal','responsible_person_id'))"
  },
  {
    "function": "public.iasdpi_pilot_events_catalog()",
    "before": "'event_approval_required',false,",
    "after": "'event_approval_required',false,'responsible_people_enabled',true,\n 'responsible_people',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'display_name',p.display_name,'active',p.active) ORDER BY p.display_name,p.id) FROM iasdpi_pilot.schedule_people p WHERE p.church_id=public.iasdpi_pilot_current_church_id() AND p.merged_into IS NULL),'[]'),"
  },
  {
    "function": "iasdpi_pilot_private.identity_group(text)",
    "before": "'iasdpi_pilot_private.person_aliases'::regclass))",
    "after": "'iasdpi_pilot_private.person_aliases'::regclass,'iasdpi_pilot.iasdpi_events'::regclass))"
  },
  {
    "function": "iasdpi_pilot_private.identity_group(text)",
    "before": "refs:=refs||jsonb_build_object('people',",
    "after": "refs:=refs||jsonb_build_object('event_responsibles',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM iasdpi_pilot.iasdpi_events e WHERE e.responsible_person_id=ANY(ids)),\n 'event_series_responsibles',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM iasdpi_pilot.iasdpi_event_series e WHERE e.definition->>'responsible_person_id'=ANY(ids::text[])));\n refs:=refs||jsonb_build_object('people',"
  },
  {
    "function": "public.iasdpi_pilot_registry_identity_apply(text,uuid,text,uuid)",
    "before": "before_refs:=before_refs||jsonb_build_object('auth_links',",
    "after": "before_refs:=before_refs||jsonb_build_object('event_responsibles',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'person_id',e.responsible_person_id,'version',e.version) ORDER BY e.id),'[]') FROM iasdpi_pilot.iasdpi_events e WHERE e.responsible_person_id=ANY(ids)));\n before_refs:=before_refs||jsonb_build_object('auth_links',"
  },
  {
    "function": "public.iasdpi_pilot_registry_identity_apply(text,uuid,text,uuid)",
    "before": "UPDATE iasdpi_pilot.schedule_people SET merged_into=p_canonical,",
    "after": "-- Referências de eventos mudam com versão/histórico; snapshots anteriores não são reescritos.\n FOR periodrow IN UPDATE iasdpi_pilot.iasdpi_events SET responsible_person_id=p_canonical,version=version+1,updated_by=u,updated_at=now() WHERE responsible_person_id=ANY(sources) RETURNING * LOOP\n  INSERT INTO iasdpi_pilot.iasdpi_event_versions(church_id,event_id,version,actor_id,status,snapshot) VALUES(periodrow.church_id,periodrow.id,periodrow.version,u,periodrow.status,to_jsonb(periodrow));END LOOP;\n FOR periodrow IN UPDATE iasdpi_pilot.iasdpi_event_series SET definition=jsonb_set(definition,'{responsible_person_id}',to_jsonb(p_canonical::text)),version=version+1,updated_by=u,updated_at=now() WHERE definition->>'responsible_person_id'=ANY(sources::text[]) RETURNING * LOOP\n  INSERT INTO iasdpi_pilot.iasdpi_event_series_versions(church_id,event_series_id,version,actor_id,snapshot) VALUES(periodrow.church_id,periodrow.id,periodrow.version,u,to_jsonb(periodrow)||jsonb_build_object('scope','identity-reconciliation'));END LOOP;\n UPDATE iasdpi_pilot.schedule_people SET merged_into=p_canonical,"
  },
  {
    "function": "iasdpi_pilot_private.calendar_events_feed_021(date,boolean)",
    "before": "(l.snapshot-'created_by'-'updated_by'-'cancellation_reason')",
    "after": "(l.snapshot-'created_by'-'updated_by'-'cancellation_reason'-'responsible_person_id')||jsonb_build_object('responsible_name',(SELECT p.display_name FROM iasdpi_pilot.schedule_people p WHERE p.id=iasdpi_pilot_private.canonical_person((l.snapshot->>'responsible_person_id')::uuid)))"
  }
]$changes$::jsonb) LOOP
  sig:=(change->>'function')::regprocedure;before_text:=change->>'before';after_text:=change->>'after';
  body:=pg_get_functiondef(sig);
  IF strpos(body,before_text)=0 THEN before_text:=replace(before_text,chr(10),chr(13)||chr(10));END IF;
  IF before_text='' OR (length(body)-length(replace(body,before_text,'')))/length(before_text)<>1 THEN RAISE EXCEPTION 'Complemento incompatível: %',sig;END IF;
  SELECT proowner,proacl INTO owner_before,acl_before FROM pg_proc WHERE oid=sig;
  EXECUTE replace(body,before_text,after_text);
  IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=sig AND (proowner IS DISTINCT FROM owner_before OR proacl IS DISTINCT FROM acl_before)) THEN RAISE EXCEPTION 'Owner/ACL mudou: %',sig;END IF;
 END LOOP;
END $patch$;
SELECT iasdpi_pilot_admin.assert_core_unchanged();
NOTIFY pgrst,'reload schema';
COMMIT;
