import test from 'node:test';import assert from 'node:assert/strict';
import {createPasswordHandler} from '../supabase/functions/pilot-password/handler.mjs';
const UID='11111111-1111-4111-8111-111111111111',origin='https://preview.example';
const token='header.'+Buffer.from(JSON.stringify({sub:UID,iat:1234})).toString('base64url')+'.signature';
function fixture(fail=''){
 const env={SUPABASE_URL:'https://preview.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test-only',SUPABASE_SERVICE_ROLE_KEY:'server-test-only',IASDPI_ALIAS_LOGIN_ENABLED:'true',IASDPI_ALIAS_ALLOWED_ORIGINS:origin};let calls=[];
 const send=async(url,o)=>{const body=o.body?JSON.parse(o.body):null;calls.push({url,method:o.method,body,headers:o.headers});
  if(url.endsWith('/user')&&o.method==='GET')return fail==='token'?Response.json({error:'private'},{status:401}):Response.json({id:UID,is_anonymous:false,email:'private@example.invalid'});
  if(url.endsWith('password_begin'))return fail==='revoked'?Response.json({error:'private'},{status:403}):Response.json({change_id:UID,version:2});
  if(url.endsWith('/user')&&o.method==='PUT')return fail==='provider'?Response.json({error:'private'},{status:400}):Response.json({id:UID});
  if(url.includes('/logout?'))return fail==='logout'?Response.json({error:'private'},{status:503}):new Response(null,{status:204});
  if(url.endsWith('password_abort'))return Response.json(true);
  if(url.endsWith('password_complete'))return fail==='ack'?Response.json({error:'private'},{status:400}):Response.json(true);
  throw Error('unexpected');};
 const request=(extra={},headers={})=>new Request('https://preview.supabase.co/functions/v1/pilot-password',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer '+token,...headers},body:JSON.stringify({church:'IASD_PI',password:'UniqueSynthetic#999',...extra})});
 return {env,calls,request,handler:createPasswordHandler({readEnv:k=>env[k],fetch:send})};
}
test('altera apenas a própria senha, encerra sessões e confirma via RPC protegida',async()=>{const f=fixture(),r=await f.handler(f.request());assert.equal(r.status,200);assert.deepEqual(await r.json(),{completed:true,reauthenticate:true});assert.deepEqual(f.calls.map(c=>c.method),['GET','POST','PUT','POST','POST']);assert.equal(f.calls[1].body.p_user,UID);assert.equal(f.calls[2].headers.Authorization,'Bearer '+token);assert.equal(f.calls[4].headers.Authorization,'Bearer server-test-only');assert(f.calls.filter(c=>c.url.includes('/rpc/')).every(c=>!JSON.stringify(c.body).includes('UniqueSynthetic')));});
test('não aceita ID ou perfil arbitrário, senha fraca, payload excessivo e igreja diferente',async()=>{for(const body of [{user_id:UID},{role:'admin'},{password:'admin'},{password:'x'.repeat(9000)},{church:'OUTRA'}]){const f=fixture(),r=await f.handler(f.request(body));assert.equal(r.status,400);assert.equal(f.calls.length,0);}});
test('recusa origem, ausência de ativação e método incorreto',async()=>{const f=fixture();assert.equal((await f.handler(f.request({}, {origin:'https://wrong.example'}))).status,403);f.env.IASDPI_ALIAS_LOGIN_ENABLED='false';assert.equal((await f.handler(f.request())).status,503);assert.equal(f.calls.length,0);});
test('falhas de Auth, revogação, logout ou confirmação não declaram sucesso nem expõem diagnóstico',async()=>{for(const mode of ['token','revoked','provider','logout','ack']){const f=fixture(mode),r=await f.handler(f.request());assert(r.status>=400);const text=await r.text();assert(!text.includes('private'));assert(!text.includes('completed'));assert(!text.includes(UID));assert(!text.includes('server-test'));if(['token','revoked'].includes(mode))assert(!f.calls.some(c=>c.method==='PUT'));}});
test('CORS preflight não altera nada nem usa credenciais',async()=>{const f=fixture(),r=await f.handler(new Request('https://preview.supabase.co/',{method:'OPTIONS',headers:{origin}}));assert.equal(r.status,204);assert.equal(f.calls.length,0);assert.equal(r.headers.get('access-control-allow-origin'),origin);});
