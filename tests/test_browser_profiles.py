"""Browser -> HTTP mocks -> PostgreSQL 17 local. Todas as origens externas interceptadas.
Não representa teste do Auth/Edge/Supabase real, nem fornece credenciais para Preview.
"""
import base64,json,os,re,subprocess,tempfile,threading,time,unittest,uuid
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import test_profiles_db as pg
try:
 from playwright.sync_api import sync_playwright
except ImportError:sync_playwright=None
class SilentHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
@unittest.skipUnless(pg.CONTAINER and sync_playwright,'Requer PostgreSQL local + Playwright/Chromium')
class BrowserProfilesTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  pg.ProfilesDBTests.setUpClass.__func__(cls)
  cls.temp=tempfile.TemporaryDirectory();cls.addClassCleanup(cls.temp.cleanup)
  subprocess.run(['node','piloto/tools/build.mjs','--output',cls.temp.name],cwd=pg.ROOT,env={**os.environ,'IASDPI_PROFILES_ACTIVATED':'reviewed'},check=True,capture_output=True)
  cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(SilentHandler,directory=cls.temp.name));threading.Thread(target=cls.server.serve_forever,daemon=True).start();cls.addClassCleanup(cls.server.server_close);cls.addClassCleanup(cls.server.shutdown)
  cls.origin='http://127.0.0.1:'+str(cls.server.server_port)
 def setUp(self):
  pg.ProfilesDBTests.setUp(self);self.errors=[];self.network=[];self.rpc_errors=[]
  self.pw=sync_playwright().start();self.addCleanup(self.pw.stop)
  self.browser=self.pw.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox']);self.addCleanup(self.browser.close)
  self.context=self.browser.new_context(viewport={'width':1365,'height':900});self.context.route('**/*',self.route)
  self.page=self.context.new_page();self.page.set_default_timeout(7000);self.page.on('pageerror',lambda e:self.errors.append(str(e)))
  self.users={pg.A:'admin',pg.M:'membro',pg.S:'secretaria'}
 def tearDown(self):
  self.context.unroute_all(behavior='wait')
  pg.ProfilesDBTests.tearDown(self)
 def session(self,user):
  claims={'sub':user,'role':'authenticated','iat':int(time.time())+10,'exp':int(time.time())+3600,'aud':'authenticated','is_anonymous':False}
  encode=lambda o:base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
  return {'access_token':encode({'alg':'HS256','typ':'JWT'})+'.'+encode(claims)+'.synthetic_signature','refresh_token':'synthetic-refresh-'+user,'token_type':'bearer','expires_in':3600,'expires_at':claims['exp'],'user':{'id':user,'email':'internal@example.invalid','aud':'authenticated','role':'authenticated','is_anonymous':False,'email_confirmed_at':'2026-01-01T00:00:00Z','app_metadata':{},'user_metadata':{}}}
 def route(self,route):
  req=route.request;url=urlparse(req.url)
  if req.url.startswith(self.origin+'/'):route.continue_();return
  if url.hostname!='pwbxksxxmnblqwpvlheu.supabase.co':self.network.append(req.url);route.abort();return
  headers={'Access-Control-Allow-Origin':self.origin,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Content-Type':'application/json'}
  if req.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
  body=json.loads(req.post_data or '{}');auth=req.headers.get('authorization','');user=None;role='anon'
  if auth.startswith('Bearer eyJ'):
   claims=json.loads(base64.urlsafe_b64decode(auth.split('.')[1]+'=='));user=claims['sub'];role='authenticated'
  def reply(data,status=200):route.fulfill(status=status,headers=headers,body=json.dumps(data,ensure_ascii=False))
  try:
   if url.path=='/functions/v1/alias-login':
    uid=next((u for u,r in self.users.items() if r==body.get('identifier')),None)
    if not uid or body.get('password')!='SyntheticOnly#123':reply({'error':'Não foi possível entrar.'},401);return
    session=self.session(uid);reply({k:session[k] for k in ['access_token','refresh_token']});return
   if url.path=='/auth/v1/user':reply(self.session(user)['user'] if user else {},200 if user else 401);return
   if url.path=='/auth/v1/token':reply(self.session(user or pg.A));return
   if url.path=='/auth/v1/logout':reply({});return
   if url.path=='/rest/v1/iasdpi_access':reply([{'user_id':pg.A,'role':'admin','enabled':True}] if user==pg.A else []);return
   if url.path.startswith('/rest/v1/rpc/'):
    name=url.path.rsplit('/',1)[1]
    if not re.fullmatch('iasdpi_pilot_[a-z_]+',name):raise ValueError('RPC fora do piloto')
    def val(v):
     if v is None:return 'null'
     if isinstance(v,bool):return str(v).lower()
     if isinstance(v,(int,float)):return str(v)
     if isinstance(v,(dict,list)):return "'"+json.dumps(v).replace("'","''")+"'::jsonb"
     return "'"+str(v).replace("'","''")+"'"
    args=','.join(k+'=>'+(('ARRAY['+','.join("'"+str(uuid.UUID(x))+"'" for x in v)+']::uuid[]') if k=='p_exclude' else val(v)) for k,v in body.items() if re.fullmatch('p_[a-z_]+',k))
    sql=("select coalesce(jsonb_agg(t),'[]') from public."+name+'('+args+') t') if name=='iasdpi_pilot_list_churches' else ('select public.'+name+'('+args+')')
    out=self.d.sql(sql,user=user,role=role)
    reply(out=='t' if out in ('t','f') else json.loads(out or 'null'));return
   raise ValueError('Endpoint não previsto: '+url.path)
  except Exception as error:
   self.rpc_errors.append((url.path,str(error)));reply({'code':'42501','message':'Acesso não autorizado ou operação inválida no teste local.'},403)
 def login(self,name):
  self.page.goto(self.origin+'/#portal-login');self.page.locator('#portal-login-form').wait_for();
  try:self.page.locator('[name=church]').select_option('IASD_PI')
  except Exception:raise AssertionError(str(self.rpc_errors)+str(self.errors)+str(self.network)+self.page.locator('body').inner_text())
  self.page.locator('#portal-login-form [name=email]').fill(name);self.page.locator('#portal-login-form [name=password]').fill('SyntheticOnly#123');self.page.locator('#portal-login-form button[type=submit]').click()
  try:self.page.wait_for_function("()=>window.IASDPIPortalAccess?.valid()===true",timeout=7000)
  except Exception:raise AssertionError(str(self.rpc_errors)+self.page.locator('body').inner_text()+str(self.errors))
  self.page.wait_for_function("()=>document.querySelector('[data-account-label]')?.textContent !== 'Minha conta'")
 def assert_clean(self):self.assertEqual(self.errors,[]);self.assertEqual(self.network,[])
 def test_public_login_and_mobile(self):
  self.page.goto(self.origin+'/#portal-login');self.page.locator('#portal-login-form').wait_for()
  self.assertEqual(self.page.locator('#portal-login-form [name=email]').get_attribute('type'),'text');self.assertTrue(self.page.locator('[name=remember]').is_checked())
  self.assertFalse(self.page.locator('.header a[data-page=events]').is_visible())
  self.context.set_default_timeout(5000);self.page.set_viewport_size({'width':390,'height':844});self.page.locator('.portal-menu-toggle').click()
  self.assertTrue(self.page.locator('.header a[data-page=portal-login]').is_visible())
  self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));self.assert_clean()
 def test_member_readonly_and_direct_route_denial(self):
  self.login('membro');self.assertEqual(self.page.locator('[data-account-label]').inner_text(),'Membro')
  for route in ['events','schedule-build','schedule-members','access-admin']:
   self.page.goto(self.origin+'/#'+route);self.page.get_by_role('heading',name='Acesso restrito',exact=True).wait_for()
  self.page.goto(self.origin+'/#home');self.page.locator('#auth-login-form').wait_for()
  self.assertFalse(self.page.locator('.header a[data-page=events]').is_visible());self.assertFalse(self.page.locator('.header a[data-page=home]').is_visible());self.assert_clean()
 def test_secretaria_event_publish_reload_cancel_and_denials(self):
  self.login('secretaria');self.page.locator('[data-event-new]').wait_for();self.page.locator('[data-event-new]').click()
  self.page.locator('#event-editor [name=title]').fill('Evento sintético da secretaria')
  self.page.locator('#event-editor [name=all_day]').check();self.page.locator('#event-editor [name=event_organizer]').select_option('local_church');self.page.locator('#event-editor [name=program_category]').select_option('general')
  self.page.locator('#event-editor button[value=published]').click();
  try:self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Publicação confirmada')")
  except Exception:raise AssertionError(str(self.rpc_errors)+self.page.locator('body').inner_text())
  self.assertEqual(self.d.sql("select status from iasdpi_pilot.iasdpi_events where title='Evento sintético da secretaria'"),'published')
  self.page.reload();self.page.locator('[data-event-open]').first.wait_for();self.page.locator('[data-event-open]').first.click();self.assertFalse(self.page.locator('[data-event-history]').count())
  self.page.on('dialog',lambda dialog:dialog.accept());self.page.locator('[data-event-cancel]').click();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Cancelamento confirmado')")
  self.page.goto(self.origin+'/#schedule-build');self.page.get_by_role('heading',name='Acesso restrito',exact=True).wait_for();self.assert_clean()
 def test_admin_existing_modules_and_mobile(self):
  self.login('admin');self.page.locator('.header a[data-page=events]').wait_for();self.page.goto(self.origin+'/#events');self.page.locator('[data-event-new]').wait_for()
  self.assertTrue(self.page.locator('.header a[data-page=schedule-build]').is_visible());self.assertTrue(self.page.locator('.header a[data-page=home]').is_visible())
  self.page.set_viewport_size({'width':390,'height':844});self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));self.assert_clean()
 def test_direct_http_permissions_cannot_be_forged(self):
  self.page.goto(self.origin+'/#portal-login');self.page.locator('#portal-login-form').wait_for()
  for uid in [None,pg.M,pg.S]:
   token=self.session(uid)['access_token'] if uid else None
   for name,args in [('iasdpi_pilot_registry_catalog',{}),('iasdpi_pilot_schedule_catalog',{}),('iasdpi_pilot_alias_login_lookup',{'p_identifier':'admin'})]:
    status=self.page.evaluate("""async data => (await fetch('https://pwbxksxxmnblqwpvlheu.supabase.co/rest/v1/rpc/'+data.name,{method:'POST',headers:{'Content-Type':'application/json',apikey:window.IASDPIConfig.supabasePublishableKey,...(data.token?{Authorization:'Bearer '+data.token}:{}),'x-iasdpi-church':'IASD_PI'},body:JSON.stringify(data.args)})).status""",{'name':name,'args':args,'token':token})
    self.assertEqual(status,403,(uid,name))
  self.assert_clean()
 def test_first_password_change_gate(self):
  self.d.sql("update iasdpi_pilot_private.profile_credentials set must_change=true where user_id='%s'"%pg.M)
  self.login('membro');self.page.wait_for_url('**/#reset-password');self.page.locator('#own-password-form').wait_for()
  self.assertFalse(self.page.locator('.header a[data-page=events]').is_visible());self.assert_clean()
