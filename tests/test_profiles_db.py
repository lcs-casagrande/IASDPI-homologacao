"""PostgreSQL 17 descartável sem rede. Auth/claims são exclusivamente sintéticos."""
import os,json,subprocess,uuid,time,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
A='11111111-1111-4111-8111-111111111111';M='22222222-2222-4222-8222-222222222222';S='33333333-3333-4333-8333-333333333333';L='44444444-4444-4444-8444-444444444444'
CONTAINER=os.environ.get('IASDPI_PG_TEST_CONTAINER')
class DB:
 def __init__(self,name):
  self.name=name;self.cmd=['docker','--host=unix:///var/run/docker.sock','exec','-i',CONTAINER,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']
 def sql(self,sql,user=None,role=None,iat=None,fail=False,db=None):
  if user or role:
   role=role or 'authenticated';claims=json.dumps({'sub':user,'role':role,'is_anonymous':False,'iat':int(time.time())+10 if iat is None else iat})
   sql="begin;set local role %s;set local request.jwt.claims='%s';set local request.headers='%s';%s;commit;"%(role,claims,json.dumps({"x-iasdpi-church":"IASD_PI"}),sql)
  r=subprocess.run(self.cmd+['-d',db or self.name],input=sql,text=True,capture_output=True)
  if fail:
   assert r.returncode!=0,'Operação indevida aceita';return r.stderr
  assert r.returncode==0,r.stderr
  return r.stdout.strip()
 def rpc(self,name,args=None,user=A,role=None,fail=False,iat=None):
  def val(x):
   if x is None:return 'null'
   if isinstance(x,bool):return str(x).lower()
   if isinstance(x,(int,float)):return str(x)
   if isinstance(x,(dict,list)):return "'"+json.dumps(x).replace("'","''")+"'::jsonb"
   return "'"+str(x).replace("'","''")+"'"
  out=self.sql('select public.'+name+'('+','.join(val(x) for x in args or [])+')',user=user,role=role,fail=fail,iat=iat)
  return out if fail else (out=='t' if out in('t','f') else json.loads(out or 'null'))

def install(db):
 db.sql("do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin;end if;end $$",db='postgres')
 db.sql('create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting(\'request.jwt.claims\',true),\'\')::jsonb->>\'sub\')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting(\'request.jwt.claims\',true),\'\')::jsonb $$;grant usage on schema auth to anon,authenticated;')
 for uid,label in [(A,'admin'),(M,'reader'),(S,'office'),(L,'ungranted')]:db.sql("insert into auth.users values('%s','%s@example.invalid',now(),false)"%(uid,label))
 files=ROOT/'tests/fixtures/baseline'
 for f in ['001_single_church_access.sql','002_user_management.sql','003_operational_storage.sql','004_culto_trash.sql']:
  db.sql((files/f).read_text())
 db.sql("insert into public.iasdpi_access(user_id,role) values('%s','admin')"%A)
 for f in sorted(files.glob('00[1-6]_isolated_*.sql')):db.sql(f.read_text())
 db.sql((files/'006_event_responsible.sql').read_text())
 db.sql("insert into iasdpi_pilot.iasdpi_access(user_id) values('%s')"%A)
 # Equivalência funcional à alteração pública declarada na issue. Não é captura do SQL remoto.
 db.sql("create or replace function public.iasdpi_pilot_schedule_published(p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin return coalesce((select jsonb_agg(r) from jsonb_array_elements(iasdpi_pilot_private.published_before_privacy(p_month)) r join iasdpi_pilot.schedule_departments d on d.id::text=r->>'department_id' where d.code='ancionato'),'[]');end $$")

@unittest.skipUnless(CONTAINER,'Definir IASDPI_PG_TEST_CONTAINER para PostgreSQL 17 sem rede')
class ProfilesDBTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  mode=subprocess.check_output(['docker','--host=unix:///var/run/docker.sock','inspect','--format','{{.HostConfig.NetworkMode}}',CONTAINER],text=True).strip();assert mode=='none'
  cls.template='iasdpi_issue1_tpl_'+uuid.uuid4().hex;d=DB(cls.template);d.sql('create database '+cls.template,db='postgres');cls.addClassCleanup(d.sql,'drop database '+cls.template+' with (force)',db='postgres')
  install(d);d.sql((ROOT/'supabase/migrations/202611130001_pilot_profiles.sql').read_text())
 @classmethod
 def tearDownClass(cls):pass
 def setUp(self):
  self.d=DB('iasdpi_issue1_'+uuid.uuid4().hex);self.d.sql('create database '+self.d.name+' template '+self.template,db='postgres');self.addCleanup(self.d.sql,'drop database '+self.d.name+' with (force)',db='postgres')
  self.dep=self.d.sql("select id from iasdpi_pilot.schedule_departments where code='sonoplastia'")
  for u,r in [(M,'membro'),(S,'secretaria')]:self.d.sql("select iasdpi_pilot_private.profile_enroll('%s','%s',array['%s'::uuid])"%(u,r,self.dep))
  self.d.sql('update iasdpi_pilot_private.profile_credentials set must_change=false,min_iat=0')
 def tearDown(self):self.d.sql('select iasdpi_pilot_admin.assert_core_unchanged()')
 def event(self,user=S,status='draft',title='Evento sintético'):
  return self.d.rpc('iasdpi_pilot_event_submit',[str(uuid.uuid4()),0,{'title':title,'date':'2026-11-21','all_day':True,'category':'church','program_category':'general','organizer_kind':'local_church','status':status,'spaces':[]},str(uuid.uuid4()),False],user=user)['event']
 def test_roles_context(self):
  for u,r in [(A,'admin'),(M,'membro'),(S,'secretaria')]:self.assertEqual(self.d.rpc('iasdpi_pilot_portal_context',user=u)['role'],r)
 def test_secretaria_events(self):
  e=self.event(status='published');self.assertEqual(e['status'],'published')
  c=self.d.rpc('iasdpi_pilot_events_catalog',user=S);self.assertTrue(c['can_submit_general']);self.assertFalse(c['is_admin'])
  e=self.d.rpc('iasdpi_pilot_event_submit',[e['id'],e['version'],{'title':'Alterado','status':'cancelled'},str(uuid.uuid4()),False],user=S)['event'];self.assertEqual(e['status'],'cancelled')
 def test_membro_denied_write(self):
  self.d.rpc('iasdpi_pilot_event_submit',[str(uuid.uuid4()),0,{},str(uuid.uuid4()),False],user=M,fail=True)
 def test_anon_denied_private(self):
  self.d.rpc('iasdpi_pilot_portal_context',user=None,role='anon',fail=True)
  self.d.sql('select * from iasdpi_pilot_private.profile_aliases',role='anon',fail=True)

 def test_admin_credentials_and_public_function_preserved_and_idempotent(self):
  before=self.d.sql("select row_to_json(u) from auth.users u where id='%s'"%A)
  public=self.d.sql("select pg_get_functiondef('public.iasdpi_pilot_schedule_published(date)'::regprocedure)")
  alias=self.d.sql("select row_to_json(a) from iasdpi_pilot_private.profile_aliases a where identifier='admin'")
  self.d.sql((ROOT/'supabase/migrations/202611130001_pilot_profiles.sql').read_text())
  self.assertEqual(before,self.d.sql("select row_to_json(u) from auth.users u where id='%s'"%A))
  self.assertEqual(public,self.d.sql("select pg_get_functiondef('public.iasdpi_pilot_schedule_published(date)'::regprocedure)"))
  self.assertEqual(alias,self.d.sql("select row_to_json(a) from iasdpi_pilot_private.profile_aliases a where identifier='admin'"))
 def test_direct_admin_rpcs_denied_to_both_non_admin_profiles(self):
  calls=[('iasdpi_pilot_schedule_catalog',[]),('iasdpi_pilot_registry_catalog',[]),('iasdpi_pilot_schedule_save',['department',str(uuid.uuid4()),0,{'name':'Nao deve existir','code':'forbidden'},str(uuid.uuid4())]),('iasdpi_pilot_schedule_plan_save',[str(uuid.uuid4()),0,{},str(uuid.uuid4())]),('iasdpi_pilot_schedule_settings_save',[1,{}]),('iasdpi_pilot_schedule_members',[]),('iasdpi_pilot_schedule_elder_workspace',[self.dep,'2026-11-01','weekly']),('iasdpi_pilot_registry_people',['']),('iasdpi_pilot_event_history',[str(uuid.uuid4())])]
  for user in [M,S]:
   for name,args in calls:
    with self.subTest(user=user,name=name):self.assertIn('ERROR',self.d.rpc(name,args,user=user,fail=True))
 def test_alias_lookup_service_only_and_generic_missing(self):
  for user in [M,S,A]:self.d.rpc('iasdpi_pilot_alias_login_lookup',['admin'],user=user,fail=True)
  self.d.rpc('iasdpi_pilot_alias_login_lookup',['admin'],user=None,role='anon',fail=True)
  r=self.d.rpc('iasdpi_pilot_alias_login_lookup',['admin'],user=None,role='service_role');self.assertEqual(r['user_id'],A)
  self.assertIsNone(self.d.rpc('iasdpi_pilot_alias_login_lookup',['leader'],user=None,role='service_role'))
 def test_member_cannot_get_events_catalog_or_private_events(self):
  self.event(status='draft',title='Evento privado sintético')
  self.d.rpc('iasdpi_pilot_events_catalog',user=M,fail=True)
  self.d.rpc('iasdpi_pilot_events_visible',['2026-11-01'],user=M,fail=True)
 def test_public_events_only_published_open(self):
  self.event(status='draft',title='Rascunho sintético');self.event(status='published',title='Publicado sintético')
  r=self.d.rpc('iasdpi_pilot_events_published',['2026-11-01'],user=None,role='anon');self.assertEqual([x['title'] for x in r['events']],['Publicado sintético'])
 def test_member_and_secretaria_never_receive_unpublished_schedule(self):
  person=str(uuid.uuid4());role=self.d.rpc('iasdpi_pilot_schedule_daily_role',[self.dep])
  self.d.rpc('iasdpi_pilot_registry_save',[person,0,{'name':'Participante sintético','display_name':'Participante sintético'},[{'department_id':self.dep,'expected_version':0,'patch':{'participation_confirmed':True,'role_ids':[role['id']]}}],str(uuid.uuid4())])
  day=self.d.sql("select (now() at time zone 'America/Sao_Paulo')::date+2");event=self.d.rpc('iasdpi_pilot_schedule_event_create',[str(uuid.uuid4()),{'date':day,'title':'Escala sintética','department_id':self.dep},str(uuid.uuid4())])
  plan=self.d.rpc('iasdpi_pilot_schedule_plan_save',[str(uuid.uuid4()),0,{'department_id':self.dep,'month':day[:7]+'-01','title':'Planejamento sintético','status':'draft','requirements':[{'id':str(uuid.uuid4()),'event_id':event['id'],'role_id':role['id'],'required_count':1,'assignments':[{'id':str(uuid.uuid4()),'person_id':person,'timing_mode':'day'}]}]},str(uuid.uuid4())])
  self.assertEqual(self.d.rpc('iasdpi_pilot_schedule_visible',[day[:7]+'-01'],user=M),[])
  self.d.rpc('iasdpi_pilot_schedule_plan_save',[plan['id'],plan['version'],{'status':'published'},str(uuid.uuid4())])
  for user in [M,S]:self.assertEqual(len(self.d.rpc('iasdpi_pilot_schedule_visible',[day[:7]+'-01'],user=user)),1)
  self.assertEqual(self.d.rpc('iasdpi_pilot_schedule_published',[day[:7]+'-01'],user=None,role='anon'),[])
  self.d.sql("update iasdpi_pilot.schedule_department_access set enabled=false where user_id='%s'"%M)
  self.assertEqual(self.d.rpc('iasdpi_pilot_schedule_visible',[day[:7]+'-01'],user=M),[])
 def test_leader_remains_ungranted(self):
  self.d.rpc('iasdpi_pilot_portal_context',user=L,fail=True)
  self.d.sql("insert into iasdpi_pilot.iasdpi_access(user_id,role) values('%s','leader')"%L,fail=True)
 def test_revoked_access_and_unknown_church(self):
  self.d.sql("update iasdpi_pilot.iasdpi_access set enabled=false where user_id='%s'"%M)
  self.d.rpc('iasdpi_pilot_portal_context',user=M,fail=True)
  self.assertIsNone(self.d.rpc('iasdpi_pilot_alias_login_lookup',['membro'],user=None,role='service_role'))
  self.d.sql("set request.headers='{\"x-iasdpi-church\":\"OUTRA\"}';select public.iasdpi_pilot_schedule_published('2026-11-01')",fail=True)
 def test_password_gate_and_supervised_rotation_invalidates_old_sessions(self):
  old=int(time.time());self.d.sql("update iasdpi_pilot_private.profile_credentials set must_change=true where user_id='%s'"%M)
  self.assertTrue(self.d.rpc('iasdpi_pilot_portal_context',user=M)['must_change_password'])
  self.d.rpc('iasdpi_pilot_schedule_visible',['2026-11-01'],user=M,fail=True)
  self.d.rpc('iasdpi_pilot_password_begin',[M,old],user=M,fail=True)
  op=self.d.rpc('iasdpi_pilot_password_begin',[M,old],user=None,role='service_role')
  self.d.rpc('iasdpi_pilot_portal_context',user=M,iat=old,fail=True)
  self.d.rpc('iasdpi_pilot_password_complete',[M,str(uuid.uuid4()),op['version']],user=None,role='service_role',fail=True)
  self.assertTrue(self.d.rpc('iasdpi_pilot_password_complete',[M,op['change_id'],op['version']],user=None,role='service_role'))
  self.d.rpc('iasdpi_pilot_portal_context',user=M,iat=old,fail=True)
  self.assertFalse(self.d.rpc('iasdpi_pilot_portal_context',user=M)['must_change_password'])
 def test_password_busy_abort_and_supervised_reset(self):
  op=self.d.rpc('iasdpi_pilot_password_begin',[M,int(time.time())+10],user=None,role='service_role')
  self.d.rpc('iasdpi_pilot_password_begin',[M,int(time.time())+10],user=None,role='service_role',fail=True)
  self.d.rpc('iasdpi_pilot_portal_context',user=M,fail=True)
  self.assertTrue(self.d.rpc('iasdpi_pilot_password_abort',[M,op['change_id'],op['version']],user=None,role='service_role'))
  self.assertTrue(self.d.rpc('iasdpi_pilot_portal_context',user=M)['must_change_password'])
  reset=json.loads(self.d.sql("select iasdpi_pilot_private.profile_reset_begin('membro')"))
  self.d.rpc('iasdpi_pilot_password_complete',[M,reset['change_id'],reset['version'],True],user=None,role='service_role')
  self.assertTrue(self.d.rpc('iasdpi_pilot_portal_context',user=M)['must_change_password'])
  self.d.sql("select iasdpi_pilot_private.profile_reset_begin('admin')",fail=True)
 def test_secretaria_unauthorized_department_and_stale_version(self):
  e=self.event(status='draft')
  self.d.rpc('iasdpi_pilot_event_submit',[e['id'],e['version'],{'title':'Versao atual'},str(uuid.uuid4()),False],user=S)
  self.d.rpc('iasdpi_pilot_event_submit',[e['id'],e['version'],{'title':'Versao antiga'},str(uuid.uuid4()),False],user=S,fail=True)
  other=self.d.sql("select id from iasdpi_pilot.schedule_departments where code='musica'")
  self.d.rpc('iasdpi_pilot_event_submit',[str(uuid.uuid4()),0,{'title':'Nao autorizado','date':'2026-11-21','all_day':True,'category':'department','department_id':other,'program_category':'departmental','organizer_kind':'department','organizer_department_id':other,'status':'published','spaces':[]},str(uuid.uuid4()),False],user=S,fail=True)
 def test_concurrent_event_updates_only_one_version_wins(self):
  from concurrent.futures import ThreadPoolExecutor
  e=self.event(status='draft')
  def save(title):
   try:return self.d.rpc('iasdpi_pilot_event_submit',[e['id'],e['version'],{'title':title},str(uuid.uuid4()),False],user=S)['event']['version']
   except AssertionError:return 'denied'
  with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(save,['Edicao concorrente A','Edicao concorrente B']))
  self.assertEqual(results.count('denied'),1);self.assertIn(e['version']+1,results)
 def test_last_admin_cannot_be_removed_demoted_or_suspended(self):
  for sql in ["delete from iasdpi_pilot.iasdpi_access where user_id='%s'"%A,"update iasdpi_pilot.iasdpi_access set role='membro' where user_id='%s'"%A,"update iasdpi_pilot.iasdpi_access set enabled=false where user_id='%s'"%A]:self.d.sql(sql,fail=True)
 def test_rate_limit_and_confirmation_race(self):
  r=self.d.rpc('iasdpi_pilot_alias_login_lookup',['membro'],user=None,role='service_role')
  self.d.sql("update iasdpi_pilot_private.profile_aliases set enabled=false,version=version+1 where identifier='membro'")
  self.assertFalse(self.d.rpc('iasdpi_pilot_alias_login_confirm',[r['alias_id'],r['version'],M],user=None,role='service_role'))
  key='alias:'+('a'*64)
  for i in range(6):self.assertEqual(self.d.sql("select public.iasdpi_pilot_alias_login_limit(array['%s'])"%key,role='service_role'),'t')
  self.assertEqual(self.d.sql("select public.iasdpi_pilot_alias_login_limit(array['%s'])"%key,role='service_role'),'f')
 def test_no_direct_private_or_core_permissions(self):
  for u in [M,S]:
   for table in ['iasdpi_pilot.schedule_plans','iasdpi_pilot.schedule_people','iasdpi_pilot_private.profile_credentials']:
    self.d.sql('select * from '+table,user=u,fail=True)
   self.assertEqual(self.d.sql('select * from public.iasdpi_programs',user=u),'')
   self.d.rpc('iasdpi_set_access',[u,'admin',True],user=u,fail=True)
 def test_rollback_keeps_admin_and_disables_new_profiles(self):
  self.d.sql((ROOT/'supabase/rollback_profiles.sql').read_text())
  self.assertTrue(self.d.rpc('iasdpi_pilot_portal_context',user=A)['is_admin'])
  self.d.rpc('iasdpi_pilot_portal_context',user=M,fail=True);self.d.rpc('iasdpi_pilot_portal_context',user=S,fail=True)

if __name__=='__main__':unittest.main()
