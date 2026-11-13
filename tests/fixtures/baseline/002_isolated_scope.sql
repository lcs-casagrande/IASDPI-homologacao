-- IASDPI piloto ISOLADO. Não executar no Supabase sem autorização e recuperação revisada.
BEGIN;
DO $$ BEGIN IF (SELECT step FROM iasdpi_pilot_admin.installation WHERE singleton)<>1 THEN RAISE EXCEPTION 'Ordem de instalação inválida; não reaplicar.';END IF;END $$;
CREATE TABLE iasdpi_pilot.iasdpi_churches(id uuid PRIMARY KEY,code text NOT NULL UNIQUE CHECK(code='IASD_PI'),name text NOT NULL,active boolean NOT NULL DEFAULT true,listed boolean NOT NULL DEFAULT true);
INSERT INTO iasdpi_pilot.iasdpi_churches VALUES('1a5d0000-0000-4000-8000-000000000001','IASD_PI','IASD Parada Inglesa',true,true);
ALTER TABLE iasdpi_pilot.iasdpi_churches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iasdpi_pilot.iasdpi_churches FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.iasdpi_pilot_list_churches() RETURNS TABLE(id uuid,code text,name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT id,code,name FROM iasdpi_pilot.iasdpi_churches WHERE active AND listed $$;
CREATE FUNCTION public.iasdpi_pilot_current_church_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE v_code text;c uuid;BEGIN
 BEGIN v_code:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-iasdpi-church';EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Contexto de igreja inválido.' USING errcode='42501';END;
 IF coalesce(v_code,'IASD_PI')<>'IASD_PI' THEN RAISE EXCEPTION 'Igreja não autorizada para o piloto.' USING errcode='42501';END IF;
 SELECT id INTO c FROM iasdpi_pilot.iasdpi_churches WHERE code='IASD_PI' AND active AND listed;
 IF c IS NULL THEN RAISE EXCEPTION 'Igreja indisponível.' USING errcode='42501';END IF;RETURN c;END $$;
GRANT USAGE ON SCHEMA iasdpi_pilot,iasdpi_pilot_admin,iasdpi_pilot_operational,iasdpi_pilot_private TO iasdpi_pilot_executor;
GRANT SELECT ON iasdpi_pilot_admin.auth_accounts,iasdpi_pilot.iasdpi_churches TO iasdpi_pilot_executor;
CREATE POLICY pilot_church_read ON iasdpi_pilot.iasdpi_churches FOR SELECT TO iasdpi_pilot_executor USING(active AND listed);
CREATE FUNCTION iasdpi_pilot_admin.immutable_church() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF NEW.church_id IS DISTINCT FROM OLD.church_id THEN RAISE EXCEPTION 'Não é permitido transferir a igreja.' USING errcode='42501';END IF;RETURN NEW;END $$;
DO $$ DECLARE t record;BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN('iasdpi_pilot','iasdpi_pilot_private','iasdpi_pilot_admin','iasdpi_pilot_operational') AND tablename NOT IN('iasdpi_churches','installation') LOOP
 EXECUTE format('ALTER TABLE %I.%I ADD COLUMN church_id uuid NOT NULL DEFAULT public.iasdpi_pilot_current_church_id() REFERENCES iasdpi_pilot.iasdpi_churches(id)',t.schemaname,t.tablename);
 EXECUTE format('CREATE INDEX ON %I.%I(church_id)',t.schemaname,t.tablename);
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=t.schemaname AND table_name=t.tablename AND column_name='id') THEN
  EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I UNIQUE(church_id,id)',t.schemaname,t.tablename,t.tablename||'_pilot_identity');END IF;
 EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.schemaname,t.tablename);
 EXECUTE format('CREATE POLICY pilot_boundary ON %I.%I AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_pilot_current_church_id()) WITH CHECK(church_id=public.iasdpi_pilot_current_church_id())',t.schemaname,t.tablename);
 EXECUTE format('CREATE POLICY pilot_executor ON %I.%I FOR ALL TO iasdpi_pilot_executor USING(true) WITH CHECK(true)',t.schemaname,t.tablename);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I.%I TO iasdpi_pilot_executor',t.schemaname,t.tablename);
 EXECUTE format('CREATE TRIGGER pilot_immutable BEFORE UPDATE OF church_id ON %I.%I FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_admin.immutable_church()',t.schemaname,t.tablename);
 END LOOP;END $$;
-- Chaves compostas somente entre objetos NOVOS. Nenhuma FK para o núcleo/Auth.
DO $$ DECLARE f record;a text;b text;k text;action text;BEGIN
 FOR f IN SELECT con.*,nc.nspname cs,cc.relname ct,np.nspname ps,cp.relname pt FROM pg_constraint con JOIN pg_class cc ON cc.oid=con.conrelid JOIN pg_namespace nc ON nc.oid=cc.relnamespace JOIN pg_class cp ON cp.oid=con.confrelid JOIN pg_namespace np ON np.oid=cp.relnamespace
 WHERE con.contype='f' AND nc.nspname IN('iasdpi_pilot','iasdpi_pilot_private') AND np.nspname IN('iasdpi_pilot','iasdpi_pilot_private') AND cp.relname<>'iasdpi_churches' LOOP
 SELECT string_agg(quote_ident(attname),',' ORDER BY ord) INTO a FROM unnest(f.conkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute y ON y.attrelid=f.conrelid AND y.attnum=x.num;
 SELECT string_agg(quote_ident(attname),',' ORDER BY ord) INTO b FROM unnest(f.confkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute y ON y.attrelid=f.confrelid AND y.attnum=x.num;
 k:='pilot_ref_'||substr(md5(f.ps||'.'||f.pt||b),1,20);
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=f.confrelid AND conname=k) THEN EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I UNIQUE(church_id,%s)',f.ps,f.pt,k,b);END IF;
 action:=CASE f.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL' ELSE 'NO ACTION' END;
 -- Relações SET NULL retêm FK original; identidade de igreja não é anulável.
 IF action<>'SET NULL' THEN EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY(church_id,%s) REFERENCES %I.%I(church_id,%s) ON DELETE %s',f.cs,f.ct,'pilot_fk_'||substr(md5(f.oid::text),1,20),a,f.ps,f.pt,b,action);END IF;
 END LOOP;END $$;
CREATE FUNCTION iasdpi_pilot_private.has_capability(u uuid,d uuid,cap text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_pilot_private.is_admin(u) AND cap IN('view','edit','publish','members') $$;
CREATE FUNCTION iasdpi_pilot_admin.admin_reference_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE iasdpi_pilot_admin.control SET revision=revision+1 WHERE singleton;
 IF NEW.enabled AND NOT EXISTS(SELECT 1 FROM iasdpi_pilot_admin.auth_accounts WHERE id=NEW.user_id AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false)) THEN RAISE EXCEPTION 'Selecione identidade Auth existente e confirmada.' USING errcode='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER pilot_admin_reference BEFORE INSERT OR UPDATE ON iasdpi_pilot.iasdpi_access FOR EACH ROW EXECUTE FUNCTION iasdpi_pilot_admin.admin_reference_guard();
-- Transfere somente funções NOVAS. Protege nomes públicos e evita varrer o legado.
GRANT CREATE ON SCHEMA public,iasdpi_pilot,iasdpi_pilot_private,iasdpi_pilot_admin,iasdpi_pilot_operational TO iasdpi_pilot_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname LIKE 'iasdpi\_pilot\_%' ESCAPE '\' AND p.proname NOT IN('iasdpi_pilot_list_churches','iasdpi_pilot_current_church_id')) OR (n.nspname IN('iasdpi_pilot_private','iasdpi_pilot_admin','iasdpi_pilot_operational') AND p.proname NOT IN('core_snapshot','assert_core_unchanged')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_pilot_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_pilot,iasdpi_pilot_private,iasdpi_pilot_admin,iasdpi_pilot_operational FROM iasdpi_pilot_executor;
GRANT EXECUTE ON FUNCTION public.iasdpi_pilot_list_churches(),public.iasdpi_pilot_current_church_id() TO anon,authenticated,iasdpi_pilot_executor;
-- Views auxiliares novas usam RLS das tabelas, sem ownership do núcleo.
GRANT CREATE ON SCHEMA iasdpi_pilot_private TO iasdpi_pilot_executor;
DO $$ DECLARE v record;BEGIN
 FOR v IN SELECT c.oid::regclass object FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='v' AND n.nspname='iasdpi_pilot_private' LOOP
 EXECUTE format('ALTER VIEW %s OWNER TO iasdpi_pilot_executor',v.object);
 EXECUTE format('ALTER VIEW %s SET(security_invoker=true)',v.object);
 EXECUTE format('GRANT SELECT ON %s TO iasdpi_pilot_executor',v.object);
 END LOOP;END $$;
REVOKE CREATE ON SCHEMA iasdpi_pilot_private FROM iasdpi_pilot_executor;

UPDATE iasdpi_pilot_admin.installation SET step=2 WHERE singleton;
SELECT iasdpi_pilot_admin.assert_core_unchanged();
NOTIFY pgrst,'reload schema';
COMMIT;
