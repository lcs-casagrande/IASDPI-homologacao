"""Operador confiável. Plano por padrão. Nunca chamado pelo frontend/CI/Vercel."""
import argparse,json,os,secrets,sys,uuid,urllib.request
from pathlib import Path
URL='https://pwbxksxxmnblqwpvlheu.supabase.co'
def plan(role,departments):
 if role not in ('membro','secretaria'):raise ValueError('Admin existente não é recriado nem recebe nova senha.')
 ids=[str(uuid.UUID(x)) for x in departments]
 if not ids:raise ValueError('Informe departamentos autorizados explicitamente.')
 return {'role':role,'departments':ids,'auth_account':'nova identidade técnica; nenhuma conta criada no modo plano','review_required':True}
def enroll_sql(user,role,departments):
 p=plan(role,departments);user=str(uuid.UUID(user))
 return "BEGIN; SELECT iasdpi_pilot_private.profile_enroll('%s','%s',ARRAY[%s]::uuid[]); COMMIT;"%(user,role,','.join("'%s'"%x for x in p['departments']))
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('role',choices=['membro','secretaria']);parser.add_argument('--department',action='append',required=True);parser.add_argument('--execute',action='store_true');parser.add_argument('--backup-receipt',type=Path);parser.add_argument('--reset-receipt',type=Path)
 a=parser.parse_args();p=plan(a.role,a.department)
 if not a.execute:print(json.dumps(p,ensure_ascii=False,indent=2));return
 if not sys.stdin.isatty() or not sys.stderr.isatty() or os.getenv('CI'):raise SystemExit('Operação permitida somente em terminal privado interativo, nunca em CI.')
 if not a.backup_receipt:raise SystemExit('Backup/restauração verificados e revisão explícita são necessários.')
 receipt=json.loads(a.backup_receipt.read_text())
 if receipt.get('project_url')!=URL or receipt.get('restore_validated') is not True or not receipt.get('reviewed_by'):raise SystemExit('Recibo de backup/revisão inválido. Não inventar comprovação.')
 if input('Digite IASD_PARADA_REVISADO para confirmar a operação real: ')!='IASD_PARADA_REVISADO':raise SystemExit('Cancelado.')
 service=os.environ.get('SUPABASE_SERVICE_ROLE_KEY');public=os.environ.get('SUPABASE_PUBLISHABLE_KEY')
 if not service or not public:raise SystemExit('Configurar credenciais somente no ambiente privado do operador.')
 def request(path,data=None,method=None,token=service,key=service):
  req=urllib.request.Request(URL+path,data=json.dumps(data).encode() if data is not None else None,method=method or ('POST' if data is not None else 'GET'),headers={'apikey':key,'Authorization':'Bearer '+token,'Content-Type':'application/json','x-iasdpi-church':'IASD_PI'})
  with urllib.request.urlopen(req,timeout=25) as r:return json.load(r) if r.status!=204 else None
 password=secrets.token_urlsafe(32)
 if a.reset_receipt:
  reset=json.loads(a.reset_receipt.read_text());user=str(uuid.UUID(reset['user_id']))
  if reset['identifier']!=a.role:raise SystemExit('Perfil do recibo diverge.')
  binding=request('/rest/v1/rpc/iasdpi_pilot_alias_login_lookup',{'p_identifier':a.role})
  if not binding or binding['user_id']!=user:raise SystemExit('Associação atual diverge; interromper.')
  account=request('/auth/v1/admin/users/'+user)
  request('/auth/v1/admin/users/'+user,{'password':password},method='PUT')
  # Sessão nova com a senha provisória para revogar globalmente os refresh tokens anteriores.
  session=request('/auth/v1/token?grant_type=password',{'email':account['email'],'password':password},token='',key=public)
  request('/auth/v1/logout?scope=global',{},token=session['access_token'],key=public)
  request('/rest/v1/rpc/iasdpi_pilot_password_complete',{'p_user':user,'p_change':str(uuid.UUID(reset['change_id'])),'p_version':reset['version'],'p_require_change':True})
  print('Redefinição concluída; novo login e troca de senha obrigatórios.')
 else:
  account=request('/auth/v1/admin/users',{'email':uuid.uuid4().hex+'@accounts.iasdpi.invalid','password':password,'email_confirm':True})
  user=str(uuid.UUID(account['id']));print('Identidade Auth criada, ainda SEM ACESSO ao piloto. Revisar/executar somente este SQL no SQL Editor:')
  print(enroll_sql(user,a.role,a.department))
 # Credencial exibida uma vez somente ao operador em TTY; nunca arquivo/DB/log/HTTP público.
 sys.stderr.write('\nEntrega privada ao responsável: usuário '+a.role+' | senha provisória '+password+'\n')
if __name__=='__main__':
 try:main()
 except Exception:raise SystemExit('Operação não concluída. Verifique no painel antes de repetir; nenhuma credencial foi registrada em log.')
