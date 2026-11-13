"""Provisionamento em modo plano: nenhum acesso de rede."""
import importlib.util,subprocess,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('provision',ROOT/'scripts/provision_profiles.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ProvisionTests(unittest.TestCase):
 def test_plan_no_accounts_or_credentials(self):
  p=module.plan('membro',['11111111-1111-4111-8111-111111111111']);self.assertTrue(p['review_required']);self.assertNotIn('password',p)
 def test_admin_and_invalid_department_rejected(self):
  for role,deps in [('admin',['11111111-1111-4111-8111-111111111111']),('secretaria',[]),('membro',["'; DROP TABLE people;"])]:
   with self.assertRaises(ValueError):module.plan(role,deps)
 def test_enroll_sql_uses_validated_ids_only(self):
  sql=module.enroll_sql('22222222-2222-4222-8222-222222222222','secretaria',['11111111-1111-4111-8111-111111111111']);self.assertIn('profile_enroll',sql);self.assertNotIn('password',sql);self.assertNotIn('auth.users',sql)
 def test_execute_refuses_noninteractive_environment(self):
  r=subprocess.run([sys.executable,str(ROOT/'scripts/provision_profiles.py'),'membro','--department','11111111-1111-4111-8111-111111111111','--execute'],stdin=subprocess.DEVNULL,text=True,capture_output=True);self.assertNotEqual(r.returncode,0);self.assertNotIn('senha provisória',r.stdout+r.stderr)
