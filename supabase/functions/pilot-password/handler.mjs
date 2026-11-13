const ERROR='Não foi possível concluir. Entre novamente ou procure a administração.';
export function createPasswordHandler({readEnv,fetch:send=globalThis.fetch}={}){
 return async request=>{
  const origin=request.headers.get('origin')||'';
  const allowed=(readEnv('IASDPI_ALIAS_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(x=>{try{return new URL(x).origin===x&&x.startsWith('https://');}catch{return false;}});
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
  const reply=(status,body={error:ERROR})=>new Response(JSON.stringify(body),{status,headers});
  if(!allowed.includes(origin))return reply(403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type'}});
  if(request.method!=='POST')return reply(405);
  const url=readEnv('SUPABASE_URL'),key=readEnv('SUPABASE_PUBLISHABLE_KEY')||readEnv('SUPABASE_ANON_KEY'),service=readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if(readEnv('IASDPI_ALIAS_LOGIN_ENABLED')!=='true'||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')||!key||!service)return reply(503);
  let body;
  try{
   if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error();
   const reader=request.body.getReader();let size=0,parts=[];
   for(;;){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>8192){await reader.cancel();throw Error();}parts.push(x.value);}
   const bytes=new Uint8Array(size);let offset=0;for(const x of parts){bytes.set(x,offset);offset+=x.length;}body=JSON.parse(new TextDecoder().decode(bytes));
   if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['church','password'].includes(k))||body.church!=='IASD_PI'||typeof body.password!=='string'||body.password.length<12||body.password.length>256||['admin','membro','secretaria'].includes(body.password.toLowerCase()))throw Error();
  }catch{return reply(400);}
  const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');if(!token||token.length>16384)return reply(401);
  async function remote(path,data=null,privileged=false,method=data?'POST':'GET'){
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);
   try{return await send(url+path,{method,redirect:'error',signal:ctl.signal,headers:{apikey:privileged?service:key,Authorization:'Bearer '+(privileged?service:token),'Content-Type':'application/json','x-iasdpi-church':'IASD_PI'},...(data?{body:JSON.stringify(data)}:{})});}finally{clearTimeout(timer);}
  }
  async function rpc(name,data){const r=await remote('/rest/v1/rpc/iasdpi_pilot_'+name,data,true);if(!r.ok)throw Error();return r.json();}
  try{
   const response=await remote('/auth/v1/user');if(!response.ok)return reply(401);const user=await response.json();
   const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
   if(user.is_anonymous!==false||user.id!==claims.sub||!Number.isSafeInteger(claims.iat))return reply(401);
   // Bloqueia imediatamente os acessos antigos antes da alteração no provedor.
   const operation=await rpc('password_begin',{p_user:user.id,p_iat:claims.iat});
   const changed=await remote('/auth/v1/user',{password:body.password},false,'PUT');if(!changed.ok){await rpc('password_abort',{p_user:user.id,p_change:operation.change_id,p_version:operation.version});return reply(400);}
   const logout=await remote('/auth/v1/logout?scope=global',{});if(!logout.ok)throw Error();
   if(await rpc('password_complete',{p_user:user.id,p_change:operation.change_id,p_version:operation.version})!==true)throw Error();
   return reply(200,{completed:true,reauthenticate:true});
  }catch{return reply(503);}
 };
}
