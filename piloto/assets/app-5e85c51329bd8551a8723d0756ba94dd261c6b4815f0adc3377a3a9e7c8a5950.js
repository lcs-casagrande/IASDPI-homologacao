'use strict';
window.IASDPIRelease?.executing();
'use strict';
// Configuração PÚBLICA da homologação; sem segredos administrativos.
window.IASDPIConfig = Object.freeze({
  "churchIsolationEnabled": true,
  "aliasLoginEnabled": false,
  "governanceEnabled": false,
  "portalAccessEnabled": true,
  "centralRegistryEnabled": true,
  "supabaseUrl": "https://pwbxksxxmnblqwpvlheu.supabase.co",
  "supabasePublishableKey": "sb_publishable_E26yqWE3oQMzuS2gjrOCrA_Pd0iuDlJ",
  "environment": "homologation",
  "storageMode": "supabase",
  "storageNamespace": "iasdpi-isolated-pilot-v1",
  "remoteReadOnly": false,
  "siteUrl": "https://lcs-casagrande.github.io/IASDPI-homologacao/piloto/",
  "eventsEnabled": true,
  "calendarPrivacyEnabled": true,
  "responsibilityGovernanceEnabled": false,
  "governanceAdministrationEnabled": false,
  "institutionalAccessEnabled": false,
  "initialOperational": true,
  "connectionPreparation": false,
  "remoteDisabled": false,
  "isolatedPilot": true,
  "pilotAvailabilityChecks": false
});

;
'use strict';
// Seleção pública de contexto, nunca de autorização. Ativar somente após 011.
window.IASDPIChurches=(()=>{
 const enabled=()=>window.IASDPIConfig?.churchIsolationEnabled===true;
 const original='IASD_PI',namespace=window.IASDPIConfig?.storageNamespace||'',key=(namespace?namespace+':':'')+'iasdpi-selected-church-v1';
 let rows=[],phase='idle',message='',loading=null;
 const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function selected(){if(!enabled())return original;try{const code=sessionStorage.getItem(key)||'';return /^[A-Z][A-Z0-9_]{2,39}$/.test(code)?code:'';}catch(_){return '';}}
 const ready=()=>!enabled()||(phase==='ready'&&rows.some(c=>c.code===selected()));
 const current=()=>rows.find(c=>c.code===selected())||null;
 function headers(){if(!enabled())return {};if(!ready())throw Error('Selecione uma igreja autorizada antes de continuar.');return {'x-iasdpi-church':selected()};}
 function storageScope(name){const code=selected();return enabled()&&code&&code!==original?'church:'+code+':'+name:name;}
 function redraw(){if(typeof render==='function')render();}
 async function load(){
  if(!enabled())return [];if(loading)return loading;
  phase='loading';message='Carregando igrejas…';
  loading=(async()=>{try{
   if(window.IASDPIConfig?.remoteDisabled===true)throw Error('Conexão preparada; acesso remoto ainda desativado.');
   const config=window.IASDPIAuth?.config?.()||{url:window.IASDPIConfig?.supabaseUrl,key:window.IASDPIConfig?.supabasePublishableKey};
   const url=new URL(config.url);
   if(url.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(url.host)||url.pathname!=='/'||url.search||url.hash||url.username||url.password||!config.key)throw Error('Conexão pública não configurada.');
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
   let response;try{response=await fetch(config.url+(window.IASDPIAuth?.rpcPath?.('/rest/v1/rpc/iasdpi_list_churches')||'/rest/v1/rpc/iasdpi_list_churches'),{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:'{}',signal:controller.signal});}finally{clearTimeout(timer);}
   if(!response.ok)throw Error('Consulta de igrejas indisponível. Confira a instalação da migração 011.');
   const result=await response.json();
   if(!Array.isArray(result)||result.some(c=>!c||typeof c.id!=='string'||! /^[A-Z][A-Z0-9_]{2,39}$/.test(c.code)||typeof c.name!=='string')||new Set(result.map(c=>c.code)).size!==result.length)throw Error('Lista de igrejas inválida.');
   rows=result.map(({id,code,name})=>({id,code,name}));phase='ready';message=rows.length?'':'Nenhuma igreja está liberada para acesso.';
   if(!selected()&&rows.some(c=>c.code===original))sessionStorage.setItem(key,original);
   return rows;
  }catch(error){rows=[];phase='error';message=error.name==='AbortError'?'A consulta demorou demais. Tente novamente.':error.message;throw error;}
  finally{loading=null;redraw();}})();return loading;
 }
 async function ensure(){
  if(!enabled())return original;if(phase!=='ready')await load();
  if(!ready())throw Error('Selecione uma igreja autorizada antes de entrar.');return selected();
 }
 function selectionPage(){
  if(phase==='idle')queueMicrotask(()=>{void load().catch(()=>{});});
  return `<div class="page-heading"><div><p class="eyebrow">ACESSO</p><h1>Escolha sua igreja</h1><p class="muted">Depois, entre com sua conta autorizada.</p></div></div><section class="panel auth-panel"><p role="${phase==='error'?'alert':'status'}">${h(message||(phase==='ready'?'Selecione a igreja para continuar.':'Carregando igrejas…'))}</p>${phase==='ready'&&rows.length?`<form id="church-select-form"><label for="church-select">Igreja<select id="church-select" name="church" required><option value="">Selecione a igreja</option>${rows.map(c=>`<option value="${h(c.code)}">${h(c.name)}</option>`).join('')}</select></label><button type="submit" class="primary">Continuar</button><p class="form-note">A escolha da igreja não concede acesso aos dados.</p></form>`:phase==='error'?'<button type="button" data-church-retry>Tentar novamente</button>':''}</section>`;
 }
 function selectedLabel(){return enabled()&&ready()?`<p class="church-selected"><strong>${h(current().name)}</strong> <button type="button" data-church-change>Trocar igreja</button></p>`:'';}
 function loginSelector(){
  if(!enabled())return '';
  if(phase==='idle')queueMicrotask(()=>{void load().catch(()=>{});});
  return `<label for="church-select">Igreja<select id="church-select" name="church" required ${phase!=='ready'?'disabled':''}>${!ready()?'<option value="">Selecione a igreja</option>':''}${rows.map(c=>`<option value="${h(c.code)}" ${c.code===selected()?'selected':''}>${h(c.name)}</option>`).join('')}</select></label>${phase==='error'?`<p role="alert">${h(message)}</p><button type="button" data-church-retry>Tentar novamente</button>`:phase!=='ready'?'<p role="status">Carregando igrejas…</p>':!rows.length?'<p role="alert">Nenhuma igreja está liberada para acesso.</p>':''}`;
 }
 async function selectForLogin(code){
  if(!enabled())return original;if(phase!=='ready')await load();
  if(!rows.some(c=>c.code===code))throw Error('Selecione uma igreja autorizada.');
  if(code!==selected()&&window.IASDPIAuth?.identityKey()&&await IASDPIAuth.logout()===false)throw Error('A troca de igreja foi cancelada.');
  sessionStorage.setItem(key,code);return code;
 }
 document.addEventListener('submit',e=>{
  if(e.target.id!=='church-select-form')return;e.preventDefault();const code=new FormData(e.target).get('church');if(phase!=='ready'||!rows.some(c=>c.code===code))return;
  try{sessionStorage.setItem(key,code);location.reload();}catch(_){message='Não foi possível guardar a escolha nesta aba. Permita o armazenamento da sessão e tente novamente.';redraw();}
 });
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-church-retry]')){void load().catch(()=>{});redraw();}
  if(e.target.closest('[data-church-change]')){void (async()=>{try{await IASDPIAuth.logout();sessionStorage.removeItem(key);location.reload();}catch(error){message=error.message;redraw();}})();}
 });
 function switchAuthorized(code){if(!window.IASDPIPortalAccess?.enabled()||!rows.some(c=>c.code===code))throw Error('Igreja não disponível.');sessionStorage.setItem(key,code);location.reload();}
 return {switchAuthorized,enabled,selected,ready,current,headers,storageScope,ensure,load,selectionPage,selectedLabel,loginSelector,selectForLogin};
})();

;
'use strict';
// Paths de GitHub Pages da mesma conta compartilham a origem. Nunca reutilizar
// as chaves do site principal na homologação, nem mesmo para ler configuração.
window.IASDPIStorage = (() => {
  const namespace=window.IASDPIConfig?.storageNamespace || '';
  if(namespace&&!/^[a-z0-9-]{1,80}$/.test(namespace))throw Error('Namespace de armazenamento inválido.');
  const key=name=>namespace?namespace+':'+name:name;
  const scope=name=>key(window.IASDPIChurches?.storageScope(name)||name);
  return Object.freeze({scope,programs:scope('iasdpi-demo-v1'),safety:scope('iasdpi-last-safety-copy-v1'),
    beforeRestore:scope('iasdpi-before-restore-v1'),cloudConfig:key('iasdpi-cloud-config'),pending:scope('iasdpi-cloud-pending'),
    authSession:key('iasdpi-supabase-auth-v1'),dateCorrections:scope('iasdpi-date-correction-backups-v1')});
})();

;
var supabase=(function(e){function t(e,t){var n={};for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.indexOf(r)<0&&(n[r]=e[r]);if(e!=null&&typeof Object.getOwnPropertySymbols==`function`)for(var i=0,r=Object.getOwnPropertySymbols(e);i<r.length;i++)t.indexOf(r[i])<0&&Object.prototype.propertyIsEnumerable.call(e,r[i])&&(n[r[i]]=e[r[i]]);return n}function n(e,t,n,r){function i(e){return e instanceof n?e:new n(function(t){t(e)})}return new(n||=Promise)(function(n,a){function o(e){try{c(r.next(e))}catch(e){a(e)}}function s(e){try{c(r.throw(e))}catch(e){a(e)}}function c(e){e.done?n(e.value):i(e.value).then(o,s)}c((r=r.apply(e,t||[])).next())})}let r=e=>e?(...t)=>e(...t):(...e)=>fetch(...e);var i=class extends Error{constructor(e,t=`FunctionsError`,n){super(e),this.name=t,this.context=n}toJSON(){return{name:this.name,message:this.message,context:this.context}}},a=class extends i{constructor(e){super(`Failed to send a request to the Edge Function`,`FunctionsFetchError`,e)}},o=class extends i{constructor(e){super(`Relay Error invoking the Edge Function`,`FunctionsRelayError`,e)}},s=class extends i{constructor(e){super(`Edge Function returned a non-2xx status code`,`FunctionsHttpError`,e)}},c;(function(e){e.Any=`any`,e.ApNortheast1=`ap-northeast-1`,e.ApNortheast2=`ap-northeast-2`,e.ApSouth1=`ap-south-1`,e.ApSoutheast1=`ap-southeast-1`,e.ApSoutheast2=`ap-southeast-2`,e.CaCentral1=`ca-central-1`,e.EuCentral1=`eu-central-1`,e.EuWest1=`eu-west-1`,e.EuWest2=`eu-west-2`,e.EuWest3=`eu-west-3`,e.SaEast1=`sa-east-1`,e.UsEast1=`us-east-1`,e.UsWest1=`us-west-1`,e.UsWest2=`us-west-2`})(c||={});var l=class{constructor(e,{headers:t={},customFetch:n,region:i=c.Any}={}){this.url=e,this.headers=t,this.region=i,this.fetch=r(n)}setAuth(e){this.headers.Authorization=`Bearer ${e}`}invoke(e){return n(this,arguments,void 0,function*(e,t={}){var n;let r,i,c;try{let{headers:n,method:l,body:u,signal:d,timeout:f}=t,p={},{region:m}=t;m||=this.region;let h=new URL(`${this.url}/${e}`);m&&m!==`any`&&(p[`x-region`]=m,h.searchParams.set(`forceFunctionRegion`,m));let g,ee=!!n&&Object.keys(n).some(e=>e.toLowerCase()===`content-type`);u&&!ee?typeof Blob<`u`&&u instanceof Blob||u instanceof ArrayBuffer?(p[`Content-Type`]=u.type||`application/octet-stream`,g=u):typeof u==`string`?(p[`Content-Type`]=`text/plain`,g=u):typeof FormData<`u`&&u instanceof FormData?g=u:(p[`Content-Type`]=`application/json`,g=JSON.stringify(u)):g=u&&typeof u!=`string`&&!(typeof Blob<`u`&&u instanceof Blob)&&!(u instanceof ArrayBuffer)&&!(typeof FormData<`u`&&u instanceof FormData)?JSON.stringify(u):u;let te=d;f&&(i=new AbortController,r=setTimeout(()=>i.abort(),f),d?(te=i.signal,c=()=>i.abort(),d.addEventListener(`abort`,c)):te=i.signal);let _=yield this.fetch(h.toString(),{method:l||`POST`,headers:Object.assign(Object.assign(Object.assign({},p),this.headers),n),body:g,signal:te}).catch(e=>{throw new a(e)}),ne=_.headers.get(`x-relay-error`);if(ne&&ne===`true`)throw new o(_);if(!_.ok)throw new s(_);let re=(_.headers.get(`Content-Type`)??`text/plain`).split(`;`)[0].trim().toLowerCase(),ie;return ie=re===`application/json`?yield _.json():re===`application/octet-stream`||re===`application/pdf`?yield _.blob():re===`text/event-stream`?_:re===`multipart/form-data`?yield _.formData():yield _.text(),{data:ie,error:null,response:_}}catch(e){return{data:null,error:e,response:e instanceof s||e instanceof o?e.context:void 0}}finally{r&&clearTimeout(r),c&&((n=t.signal)==null||n.removeEventListener(`abort`,c))}})}},u=class extends Error{constructor(e){super(e.message),this.name=`PostgrestError`,this.details=e.details,this.hint=e.hint,this.code=e.code}toJSON(){return{name:this.name,message:this.message,details:this.details,hint:this.hint,code:this.code}}};let d=e=>Math.min(1e3*2**e,3e4),f=[520,503],p=[`GET`,`HEAD`,`OPTIONS`];function m(e){"@babel/helpers - typeof";return m=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},m(e)}function h(e,t){if(m(e)!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||`default`);if(m(r)!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}function g(e){var t=h(e,`string`);return m(t)==`symbol`?t:t+``}function ee(e,t,n){return(t=g(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function te(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable})),n.push.apply(n,r)}return n}function _(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]==null?{}:arguments[t];t%2?te(Object(n),!0).forEach(function(t){ee(e,t,n[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):te(Object(n)).forEach(function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))})}return e}function ne(e,t){return new Promise(n=>{if(t?.aborted){n();return}let r=setTimeout(()=>{t?.removeEventListener(`abort`,i),n()},e);function i(){clearTimeout(r),n()}t?.addEventListener(`abort`,i)})}function re(e,t,n,r){return!(!r||n>=3||!p.includes(e)||!f.includes(t))}async function ie(e,t,n,r){let i=0;for(;;){let a=_({},n.headers);i>0&&(a[`X-Retry-Count`]=String(i));let o;try{o=await e(t,{method:n.method,headers:a,body:n.body,signal:n.signal})}catch(e){if(e?.name===`AbortError`||e?.code===`ABORT_ERR`||e?.name===`TimeoutError`&&n.signal?.aborted||!p.includes(n.method))throw e;if(r&&i<3){let e=d(i);i++,await ne(e,n.signal);continue}throw e}if(re(n.method,o.status,i,r)){let e=o.headers?.get(`Retry-After`)??null,t=e===null?d(i):Math.max(0,parseInt(e,10)||0)*1e3;await o.text(),i++,await ne(t,n.signal);continue}return o}}var ae=class{constructor(e){this.shouldThrowOnError=!1,this.retryEnabled=!0,this.method=e.method,this.url=e.url,this.headers=new Headers(e.headers),this.schema=e.schema,this.body=e.body,this.shouldThrowOnError=e.shouldThrowOnError??!1,this.signal=e.signal,this.isMaybeSingle=e.isMaybeSingle??!1,this.shouldStripNulls=e.shouldStripNulls??!1,this.urlLengthLimit=e.urlLengthLimit??8e3,this.retryEnabled=e.retry??!0,e.fetch?this.fetch=e.fetch:this.fetch=fetch}throwOnError(){return this.shouldThrowOnError=!0,this}stripNulls(){if(this.headers.get(`Accept`)===`text/csv`)throw Error(`stripNulls() cannot be used with csv()`);return this.shouldStripNulls=!0,this}setHeader(e,t){return this.headers=new Headers(this.headers),this.headers.set(e,t),this}retry(e){return this.retryEnabled=e,this}then(e,t){var n=this;if(this.schema===void 0||([`GET`,`HEAD`].includes(this.method)?this.headers.set(`Accept-Profile`,this.schema):this.headers.set(`Content-Profile`,this.schema)),this.method!==`GET`&&this.method!==`HEAD`&&this.headers.set(`Content-Type`,`application/json`),this.shouldStripNulls){let e=this.headers.get(`Accept`);e===`application/vnd.pgrst.object+json`?this.headers.set(`Accept`,`application/vnd.pgrst.object+json;nulls=stripped`):(!e||e===`application/json`)&&this.headers.set(`Accept`,`application/vnd.pgrst.array+json;nulls=stripped`)}let r=this.fetch,i=(async()=>{let e={};n.headers.forEach((t,n)=>{e[n]=t});let t=await ie(r,n.url.toString(),{method:n.method,headers:e,body:JSON.stringify(n.body,(e,t)=>typeof t==`bigint`?t.toString():t),signal:n.signal},n.retryEnabled);return await n.processResponse(t)})();return this.shouldThrowOnError||(i=i.catch(e=>{let t=``,n=``,r=``,i=e?.cause;if(i){let n=i?.message??``,r=i?.code??``;t=`${e?.name??`FetchError`}: ${e?.message}`,t+=`\n\nCaused by: ${i?.name??`Error`}: ${n}`,r&&(t+=` (${r})`),i?.stack&&(t+=`\n${i.stack}`)}else t=e?.stack??``;let a=this.url.toString().length;return e?.name===`AbortError`||e?.code===`ABORT_ERR`?(r=``,n=`Request was aborted (timeout or manual cancellation)`,a>this.urlLengthLimit&&(n+=`. Note: Your request URL is ${a} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`)):(i?.name===`HeadersOverflowError`||i?.code===`UND_ERR_HEADERS_OVERFLOW`)&&(r=``,n=`HTTP headers exceeded server limits (typically 16KB)`,a>this.urlLengthLimit&&(n+=`. Your request URL is ${a} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`)),{success:!1,error:{message:`${e?.name??`FetchError`}: ${e?.message}`,details:t,hint:n,code:r},data:null,count:null,status:0,statusText:``}})),i.then(e,t)}async processResponse(e){var t=this;let n=null,r=null,i=null,a=e.status,o=e.statusText;if(e.ok){if(t.method!==`HEAD`){let i=await e.text();if(i!==``)if(t.headers.get(`Accept`)===`text/csv`)r=i;else if(t.headers.get(`Accept`)&&t.headers.get(`Accept`)?.includes(`application/vnd.pgrst.plan+text`))r=i;else try{r=JSON.parse(i)}catch{if(n={message:i},r=null,t.shouldThrowOnError)throw new u({message:i,details:``,hint:``,code:``})}}let s=t.headers.get(`Prefer`)?.match(/count=(exact|planned|estimated)/),c=e.headers.get(`content-range`)?.split(`/`);if(s&&c&&c.length>1&&(i=parseInt(c[1])),t.isMaybeSingle&&Array.isArray(r))if(r.length>1){if(n={code:`PGRST116`,details:`Results contain ${r.length} rows, application/vnd.pgrst.object+json requires 1 row`,hint:null,message:`JSON object requested, multiple (or no) rows returned`},r=null,i=null,a=406,o=`Not Acceptable`,t.shouldThrowOnError)throw new u(_(_({},n),{},{hint:n.hint??``}))}else r=r.length===1?r[0]:null}else{let i=await e.text();try{n=JSON.parse(i),Array.isArray(n)&&e.status===404&&(r=[],n=null,a=200,o=`OK`)}catch{e.status===404&&i===``?(a=204,o=`No Content`):n={message:i}}if(n&&t.shouldThrowOnError)throw new u(n)}return{success:n===null,error:n,data:r,count:i,status:a,statusText:o}}returns(){return this}overrideTypes(){return this}},oe=class extends ae{throwOnError(){return super.throwOnError()}select(e){let t=!1,n=(e??`*`).split(``).map(e=>/\s/.test(e)&&!t?``:(e===`"`&&(t=!t),e)).join(``);return this.url.searchParams.set(`select`,n),this.headers.append(`Prefer`,`return=representation`),this}order(e,{ascending:t=!0,nullsFirst:n,foreignTable:r,referencedTable:i=r}={}){let a=i?`${i}.order`:`order`,o=this.url.searchParams.get(a);return this.url.searchParams.set(a,`${o?`${o},`:``}${e}.${t?`asc`:`desc`}${n===void 0?``:n?`.nullsfirst`:`.nullslast`}`),this}limit(e,{foreignTable:t,referencedTable:n=t}={}){let r=n===void 0?`limit`:`${n}.limit`;return this.url.searchParams.set(r,`${e}`),this}range(e,t,{foreignTable:n,referencedTable:r=n}={}){let i=r===void 0?`offset`:`${r}.offset`,a=r===void 0?`limit`:`${r}.limit`;return this.url.searchParams.set(i,`${e}`),this.url.searchParams.set(a,`${t-e+1}`),this}abortSignal(e){return this.signal=e,this}single(){return this.headers.set(`Accept`,`application/vnd.pgrst.object+json`),this}maybeSingle(){return this.isMaybeSingle=!0,this}csv(){return this.headers.set(`Accept`,`text/csv`),this}geojson(){return this.headers.set(`Accept`,`application/geo+json`),this}explain({analyze:e=!1,verbose:t=!1,settings:n=!1,buffers:r=!1,wal:i=!1,format:a=`text`}={}){let o=[e?`analyze`:null,t?`verbose`:null,n?`settings`:null,r?`buffers`:null,i?`wal`:null].filter(Boolean).join(`|`),s=this.headers.get(`Accept`)??`application/json`;return this.headers.set(`Accept`,`application/vnd.pgrst.plan+${a}; for="${s}"; options=${o};`),this}rollback(){return this.headers.append(`Prefer`,`tx=rollback`),this}returns(){return this}maxAffected(e){return this.headers.append(`Prefer`,`handling=strict`),this.headers.append(`Prefer`,`max-affected=${e}`),this}};let se=RegExp(`[,()]`);var ce=class extends oe{throwOnError(){return super.throwOnError()}eq(e,t){return this.url.searchParams.append(e,`eq.${t}`),this}neq(e,t){return this.url.searchParams.append(e,`neq.${t}`),this}gt(e,t){return this.url.searchParams.append(e,`gt.${t}`),this}gte(e,t){return this.url.searchParams.append(e,`gte.${t}`),this}lt(e,t){return this.url.searchParams.append(e,`lt.${t}`),this}lte(e,t){return this.url.searchParams.append(e,`lte.${t}`),this}like(e,t){return this.url.searchParams.append(e,`like.${t}`),this}likeAllOf(e,t){return this.url.searchParams.append(e,`like(all).{${t.join(`,`)}}`),this}likeAnyOf(e,t){return this.url.searchParams.append(e,`like(any).{${t.join(`,`)}}`),this}ilike(e,t){return this.url.searchParams.append(e,`ilike.${t}`),this}ilikeAllOf(e,t){return this.url.searchParams.append(e,`ilike(all).{${t.join(`,`)}}`),this}ilikeAnyOf(e,t){return this.url.searchParams.append(e,`ilike(any).{${t.join(`,`)}}`),this}regexMatch(e,t){return this.url.searchParams.append(e,`match.${t}`),this}regexIMatch(e,t){return this.url.searchParams.append(e,`imatch.${t}`),this}is(e,t){return this.url.searchParams.append(e,`is.${t}`),this}isDistinct(e,t){return this.url.searchParams.append(e,`isdistinct.${t}`),this}in(e,t){let n=Array.from(new Set(t)).map(e=>typeof e==`string`&&se.test(e)?`"${e}"`:`${e}`).join(`,`);return this.url.searchParams.append(e,`in.(${n})`),this}notIn(e,t){let n=Array.from(new Set(t)).map(e=>typeof e==`string`&&se.test(e)?`"${e}"`:`${e}`).join(`,`);return this.url.searchParams.append(e,`not.in.(${n})`),this}contains(e,t){return typeof t==`string`?this.url.searchParams.append(e,`cs.${t}`):Array.isArray(t)?this.url.searchParams.append(e,`cs.{${t.join(`,`)}}`):this.url.searchParams.append(e,`cs.${JSON.stringify(t)}`),this}containedBy(e,t){return typeof t==`string`?this.url.searchParams.append(e,`cd.${t}`):Array.isArray(t)?this.url.searchParams.append(e,`cd.{${t.join(`,`)}}`):this.url.searchParams.append(e,`cd.${JSON.stringify(t)}`),this}rangeGt(e,t){return this.url.searchParams.append(e,`sr.${t}`),this}rangeGte(e,t){return this.url.searchParams.append(e,`nxl.${t}`),this}rangeLt(e,t){return this.url.searchParams.append(e,`sl.${t}`),this}rangeLte(e,t){return this.url.searchParams.append(e,`nxr.${t}`),this}rangeAdjacent(e,t){return this.url.searchParams.append(e,`adj.${t}`),this}overlaps(e,t){return typeof t==`string`?this.url.searchParams.append(e,`ov.${t}`):this.url.searchParams.append(e,`ov.{${t.join(`,`)}}`),this}textSearch(e,t,{config:n,type:r}={}){let i=``;r===`plain`?i=`pl`:r===`phrase`?i=`ph`:r===`websearch`&&(i=`w`);let a=n===void 0?``:`(${n})`;return this.url.searchParams.append(e,`${i}fts${a}.${t}`),this}match(e){return Object.entries(e).filter(([e,t])=>t!==void 0).forEach(([e,t])=>{this.url.searchParams.append(e,`eq.${t}`)}),this}not(e,t,n){return this.url.searchParams.append(e,`not.${t}.${n}`),this}or(e,{foreignTable:t,referencedTable:n=t}={}){let r=n?`${n}.or`:`or`;return this.url.searchParams.append(r,`(${e})`),this}filter(e,t,n){return this.url.searchParams.append(e,`${t}.${n}`),this}},le=class{constructor(e,{headers:t={},schema:n,fetch:r,urlLengthLimit:i=8e3,retry:a}){this.url=e,this.headers=new Headers(t),this.schema=n,this.fetch=r,this.urlLengthLimit=i,this.retry=a}cloneRequestState(){return{url:new URL(this.url.toString()),headers:new Headers(this.headers)}}select(e,t){let{head:n=!1,count:r}=t??{},i=n?`HEAD`:`GET`,a=!1,o=(e??`*`).split(``).map(e=>/\s/.test(e)&&!a?``:(e===`"`&&(a=!a),e)).join(``),{url:s,headers:c}=this.cloneRequestState();return s.searchParams.set(`select`,o),r&&c.append(`Prefer`,`count=${r}`),new ce({method:i,url:s,headers:c,schema:this.schema,fetch:this.fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}insert(e,{count:t,defaultToNull:n=!0}={}){let{url:r,headers:i}=this.cloneRequestState();if(t&&i.append(`Prefer`,`count=${t}`),n||i.append(`Prefer`,`missing=default`),Array.isArray(e)){let t=e.reduce((e,t)=>e.concat(Object.keys(t)),[]);if(t.length>0){let e=[...new Set(t)].map(e=>`"${e}"`);r.searchParams.set(`columns`,e.join(`,`))}}return new ce({method:`POST`,url:r,headers:i,schema:this.schema,body:e,fetch:this.fetch??fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}upsert(e,{onConflict:t,ignoreDuplicates:n=!1,count:r,defaultToNull:i=!0}={}){let{url:a,headers:o}=this.cloneRequestState();if(o.append(`Prefer`,`resolution=${n?`ignore`:`merge`}-duplicates`),t!==void 0&&a.searchParams.set(`on_conflict`,t),r&&o.append(`Prefer`,`count=${r}`),i||o.append(`Prefer`,`missing=default`),Array.isArray(e)){let t=e.reduce((e,t)=>e.concat(Object.keys(t)),[]);if(t.length>0){let e=[...new Set(t)].map(e=>`"${e}"`);a.searchParams.set(`columns`,e.join(`,`))}}return new ce({method:`POST`,url:a,headers:o,schema:this.schema,body:e,fetch:this.fetch??fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}update(e,{count:t}={}){let{url:n,headers:r}=this.cloneRequestState();return t&&r.append(`Prefer`,`count=${t}`),new ce({method:`PATCH`,url:n,headers:r,schema:this.schema,body:e,fetch:this.fetch??fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}delete({count:e}={}){let{url:t,headers:n}=this.cloneRequestState();return e&&n.append(`Prefer`,`count=${e}`),new ce({method:`DELETE`,url:t,headers:n,schema:this.schema,fetch:this.fetch??fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}};function ue(e,t){try{let t=JSON.parse(e);if(t&&typeof t==`object`&&!Array.isArray(t))return new u({message:String(t.message??e),details:t.details??``,hint:t.hint??``,code:t.code??``})}catch{}return new u({message:e||t,details:``,hint:``,code:``})}function de(e,t,n){let r=e;return{success:!1,error:new u({message:`${r?.name??`FetchError`}: ${r?.message}`,details:``,hint:``,code:``}),data:null,count:null,status:t,statusText:n}}var fe=class e{constructor(e,{headers:t={},schema:n,fetch:r,timeout:i,urlLengthLimit:a=8e3,retry:o}={}){this.url=e,this.headers=new Headers(t),this.schemaName=n,this.urlLengthLimit=a;let s=r??globalThis.fetch;i!==void 0&&i>0?this.fetch=(e,t)=>{let n=new AbortController,r=setTimeout(()=>n.abort(),i),a=t?.signal;if(a){if(a.aborted)return clearTimeout(r),s(e,t);let i=()=>{clearTimeout(r),n.abort()};return a.addEventListener(`abort`,i,{once:!0}),s(e,_(_({},t),{},{signal:n.signal})).finally(()=>{clearTimeout(r),a.removeEventListener(`abort`,i)})}return s(e,_(_({},t),{},{signal:n.signal})).finally(()=>clearTimeout(r))}:this.fetch=s,this.retry=o}from(e){if(!e||typeof e!=`string`||e.trim()===``)throw Error(`Invalid relation name: relation must be a non-empty string.`);return new le(new URL(`${this.url}/${e}`),{headers:new Headers(this.headers),schema:this.schemaName,fetch:this.fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}schema(t){return new e(this.url,{headers:this.headers,schema:t,fetch:this.fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}async getOpenApiSpec(){var e=this;let t=new Headers(e.headers);t.set(`Accept`,`application/openapi+json`),e.schemaName&&t.set(`Accept-Profile`,e.schemaName);let n={};t.forEach((e,t)=>{n[t]=e});let r=e.fetch??globalThis.fetch,i;try{i=await ie(r,`${e.url}/`,{method:`GET`,headers:n},e.retry??!0)}catch(e){return de(e,0,``)}let a;try{a=await i.text()}catch(e){return de(e,i.status,i.statusText)}if(i.ok)try{return{success:!0,error:null,data:JSON.parse(a),count:null,status:i.status,statusText:i.statusText}}catch{}return{success:!1,error:ue(a,i.statusText),data:null,count:null,status:i.status,statusText:i.statusText}}rpc(e,t={},{head:n=!1,get:r=!1,count:i}={}){let a,o=new URL(`${this.url}/rpc/${e}`),s,c=e=>typeof e==`object`&&!!e&&(!Array.isArray(e)||e.some(c)),l=n&&Object.values(t).some(c);l?(a=`POST`,s=t):n||r?(a=n?`HEAD`:`GET`,Object.entries(t).filter(([e,t])=>t!==void 0).map(([e,t])=>[e,Array.isArray(t)?`{${t.join(`,`)}}`:`${t}`]).forEach(([e,t])=>{o.searchParams.append(e,t)})):(a=`POST`,s=t);let u=new Headers(this.headers);return l?u.set(`Prefer`,i?`count=${i},return=minimal`:`return=minimal`):i&&u.set(`Prefer`,`count=${i}`),new ce({method:a,url:o,headers:u,schema:this.schemaName,body:s,fetch:this.fetch??fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}},pe=class{constructor(){}static detectEnvironment(){if(typeof WebSocket<`u`)return{type:`native`,wsConstructor:WebSocket};let e=globalThis;if(typeof globalThis<`u`&&e.WebSocket!==void 0)return{type:`native`,wsConstructor:e.WebSocket};let t=typeof global<`u`?global:void 0;if(t&&t.WebSocket!==void 0)return{type:`native`,wsConstructor:t.WebSocket};if(typeof globalThis<`u`&&e.WebSocketPair!==void 0&&globalThis.WebSocket===void 0)return{type:`cloudflare`,error:`Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.`,workaround:`Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime.`};if(typeof globalThis<`u`&&e.EdgeRuntime||typeof navigator<`u`&&navigator.userAgent?.includes(`Vercel-Edge`))return{type:`unsupported`,error:`Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.`,workaround:`Use serverless functions or a different deployment target for WebSocket functionality.`};let n=globalThis.process;if(n){let e=n.versions;if(e&&e.node)return{type:`unsupported`,error:`Node.js detected but native WebSocket not found.`,workaround:`Ensure you are running Node.js 22+ or provide a WebSocket implementation via the transport option.`}}return{type:`unsupported`,error:`Unknown JavaScript runtime without WebSocket support.`,workaround:`Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation.`}}static getWebSocketConstructor(){let e=this.detectEnvironment();if(e.wsConstructor)return e.wsConstructor;let t=e.error||`WebSocket not supported in this environment.`;throw e.workaround&&(t+=`\n\nSuggested solution: ${e.workaround}`),Error(t)}static isWebSocketSupported(){try{return this.detectEnvironment().type===`native`}catch{return!1}}};let v={closed:`closed`,errored:`errored`,joined:`joined`,joining:`joining`,leaving:`leaving`},me={close:`phx_close`,error:`phx_error`,join:`phx_join`,reply:`phx_reply`,leave:`phx_leave`,access_token:`access_token`},he={connecting:`connecting`,open:`open`,closing:`closing`,closed:`closed`};var ge=class{constructor(e){this.HEADER_LENGTH=1,this.USER_BROADCAST_PUSH_META_LENGTH=6,this.KINDS={userBroadcastPush:3,userBroadcast:4},this.BINARY_ENCODING=0,this.JSON_ENCODING=1,this.BROADCAST_EVENT=`broadcast`,this.allowedMetadataKeys=[],this.allowedMetadataKeys=e??[]}encode(e,t){if(e.event===this.BROADCAST_EVENT&&!(e.payload instanceof ArrayBuffer)&&typeof e.payload.event==`string`)return t(this._binaryEncodeUserBroadcastPush(e));let n=[e.join_ref,e.ref,e.topic,e.event,e.payload];return t(JSON.stringify(n))}_binaryEncodeUserBroadcastPush(e){return this._isArrayBuffer(e.payload?.payload)?this._encodeBinaryUserBroadcastPush(e):this._encodeJsonUserBroadcastPush(e)}_encodeBinaryUserBroadcastPush(e){let t=e.payload?.payload??new ArrayBuffer(0);return this._encodeUserBroadcastPush(e,this.BINARY_ENCODING,t)}_encodeJsonUserBroadcastPush(e){let t=e.payload?.payload??{},n=new TextEncoder().encode(JSON.stringify(t)).buffer;return this._encodeUserBroadcastPush(e,this.JSON_ENCODING,n)}_encodeUserBroadcastPush(e,t,n){let r=new TextEncoder,i=r.encode(e.topic),a=r.encode(e.ref??``),o=r.encode(e.join_ref??``),s=r.encode(e.payload.event),c=this.allowedMetadataKeys?this._pick(e.payload,this.allowedMetadataKeys):{},l=r.encode(Object.keys(c).length===0?``:JSON.stringify(c));if(o.length>255)throw Error(`joinRef length ${o.length} exceeds maximum of 255`);if(a.length>255)throw Error(`ref length ${a.length} exceeds maximum of 255`);if(i.length>255)throw Error(`topic length ${i.length} exceeds maximum of 255`);if(s.length>255)throw Error(`userEvent length ${s.length} exceeds maximum of 255`);if(l.length>255)throw Error(`metadata length ${l.length} exceeds maximum of 255`);let u=this.USER_BROADCAST_PUSH_META_LENGTH+o.length+a.length+i.length+s.length+l.length,d=new ArrayBuffer(this.HEADER_LENGTH+u),f=new DataView(d),p=new Uint8Array(d),m=0;f.setUint8(m++,this.KINDS.userBroadcastPush),f.setUint8(m++,o.length),f.setUint8(m++,a.length),f.setUint8(m++,i.length),f.setUint8(m++,s.length),f.setUint8(m++,l.length),f.setUint8(m++,t),p.set(o,m),m+=o.length,p.set(a,m),m+=a.length,p.set(i,m),m+=i.length,p.set(s,m),m+=s.length,p.set(l,m),m+=l.length;var h=new Uint8Array(d.byteLength+n.byteLength);return h.set(new Uint8Array(d),0),h.set(new Uint8Array(n),d.byteLength),h.buffer}decode(e,t){if(this._isArrayBuffer(e))return t(this._binaryDecode(e));if(typeof e==`string`){let[n,r,i,a,o]=JSON.parse(e);return t({join_ref:n,ref:r,topic:i,event:a,payload:o})}return t({})}_binaryDecode(e){let t=new DataView(e),n=t.getUint8(0),r=new TextDecoder;switch(n){case this.KINDS.userBroadcast:return this._decodeUserBroadcast(e,t,r)}}_decodeUserBroadcast(e,t,n){let r=t.getUint8(1),i=t.getUint8(2),a=t.getUint8(3),o=t.getUint8(4),s=this.HEADER_LENGTH+4,c=n.decode(e.slice(s,s+r));s+=r;let l=n.decode(e.slice(s,s+i));s+=i;let u=n.decode(e.slice(s,s+a));s+=a;let d=e.slice(s,e.byteLength),f=o===this.JSON_ENCODING?JSON.parse(n.decode(d)):d,p={type:this.BROADCAST_EVENT,event:l,payload:f};return a>0&&(p.meta=JSON.parse(u)),{join_ref:null,ref:null,topic:c,event:this.BROADCAST_EVENT,payload:p}}_isArrayBuffer(e){return e instanceof ArrayBuffer||e?.constructor?.name===`ArrayBuffer`}_pick(e,t){return!e||typeof e!=`object`?{}:Object.fromEntries(Object.entries(e).filter(([e])=>t.includes(e)))}},y;(function(e){e.abstime=`abstime`,e.bool=`bool`,e.date=`date`,e.daterange=`daterange`,e.float4=`float4`,e.float8=`float8`,e.int2=`int2`,e.int4=`int4`,e.int4range=`int4range`,e.int8=`int8`,e.int8range=`int8range`,e.json=`json`,e.jsonb=`jsonb`,e.money=`money`,e.numeric=`numeric`,e.oid=`oid`,e.reltime=`reltime`,e.text=`text`,e.time=`time`,e.timestamp=`timestamp`,e.timestamptz=`timestamptz`,e.timetz=`timetz`,e.tsrange=`tsrange`,e.tstzrange=`tstzrange`})(y||={});let _e=(e,t,n={})=>{let r=n.skipTypes??[];return t?Object.keys(t).reduce((n,i)=>(n[i]=ve(i,e,t,r),n),{}):{}},ve=(e,t,n,r)=>{let i=t.find(t=>t.name===e)?.type,a=n[e];return i&&!r.includes(i)?ye(i,a):be(a)},ye=(e,t)=>{if(e.charAt(0)===`_`)return we(t,e.slice(1,e.length));switch(e){case y.bool:return xe(t);case y.float4:case y.float8:case y.int2:case y.int4:case y.int8:case y.numeric:case y.oid:return Se(t);case y.json:case y.jsonb:return Ce(t);case y.timestamp:return Te(t);case y.abstime:case y.date:case y.daterange:case y.int4range:case y.int8range:case y.money:case y.reltime:case y.text:case y.time:case y.timestamptz:case y.timetz:case y.tsrange:case y.tstzrange:return be(t);default:return be(t)}},be=e=>e,xe=e=>{switch(e){case`t`:return!0;case`f`:return!1;default:return e}},Se=e=>{if(typeof e==`string`){let t=parseFloat(e);if(!Number.isNaN(t))return t}return e},Ce=e=>{if(typeof e==`string`)try{return JSON.parse(e)}catch{return e}return e},we=(e,t)=>{if(typeof e!=`string`)return e;let n=e.length-1,r=e[n];if(e[0]===`{`&&r===`}`){let r,i=e.slice(1,n);try{r=JSON.parse(`[`+i+`]`)}catch{r=i?i.split(`,`):[]}return r.map(e=>ye(t,e))}return e},Te=e=>typeof e==`string`?e.replace(` `,`T`):e,Ee=e=>{let t=new URL(e);return t.protocol=t.protocol.replace(/^ws/i,`http`),t.pathname=t.pathname.replace(/\/+$/,``).replace(/\/socket\/websocket$/i,``).replace(/\/socket$/i,``).replace(/\/websocket$/i,``),t.pathname===``||t.pathname===`/`?t.pathname=`/api/broadcast`:t.pathname+=`/api/broadcast`,t.href};var b=e=>typeof e==`function`?e:function(){return e},De=typeof self<`u`?self:null,Oe=typeof window<`u`?window:null,x=De||Oe||globalThis,ke=`2.0.0`,Ae=1e4,je=1e3,Me=100,S={connecting:0,open:1,closing:2,closed:3},C={closed:`closed`,errored:`errored`,joined:`joined`,joining:`joining`,leaving:`leaving`},w={close:`phx_close`,error:`phx_error`,join:`phx_join`,reply:`phx_reply`,leave:`phx_leave`},Ne={longpoll:`longpoll`,websocket:`websocket`},Pe={complete:4},Fe=`base64url.bearer.phx.`,Ie=class{constructor(e,t,n,r){this.channel=e,this.event=t,this.payload=n||function(){return{}},this.receivedResp=null,this.timeout=r,this.timeoutTimer=null,this.recHooks=[],this.sent=!1,this.ref=void 0}resend(e){this.timeout=e,this.reset(),this.send()}send(){this.hasReceived(`timeout`)||(this.startTimeout(),this.sent=!0,this.channel.socket.push({topic:this.channel.topic,event:this.event,payload:this.payload(),ref:this.ref,join_ref:this.channel.joinRef()}))}receive(e,t){return this.hasReceived(e)&&t(this.receivedResp.response),this.recHooks.push({status:e,callback:t}),this}reset(){this.cancelRefEvent(),this.ref=null,this.refEvent=null,this.receivedResp=null,this.sent=!1}destroy(){this.cancelRefEvent(),this.cancelTimeout()}matchReceive({status:e,response:t,_ref:n}){this.recHooks.filter(t=>t.status===e).forEach(e=>e.callback(t))}cancelRefEvent(){this.refEvent&&this.channel.off(this.refEvent)}cancelTimeout(){clearTimeout(this.timeoutTimer),this.timeoutTimer=null}startTimeout(){this.timeoutTimer&&this.cancelTimeout(),this.ref=this.channel.socket.makeRef(),this.refEvent=this.channel.replyEventName(this.ref),this.channel.on(this.refEvent,e=>{this.cancelRefEvent(),this.cancelTimeout(),this.receivedResp=e,this.matchReceive(e)}),this.timeoutTimer=setTimeout(()=>{this.trigger(`timeout`,{})},this.timeout)}hasReceived(e){return this.receivedResp&&this.receivedResp.status===e}trigger(e,t){this.channel.trigger(this.refEvent,{status:e,response:t})}},Le=class{constructor(e,t){this.callback=e,this.timerCalc=t,this.timer=void 0,this.tries=0}reset(){this.tries=0,clearTimeout(this.timer)}scheduleTimeout(){clearTimeout(this.timer),this.timer=setTimeout(()=>{this.tries+=1,this.callback()},this.timerCalc(this.tries+1))}},Re=class{constructor(e,t,n){this.state=C.closed,this.topic=e,this.params=b(t||{}),this.socket=n,this.bindings=[],this.bindingRef=0,this.timeout=this.socket.timeout,this.joinedOnce=!1,this.joinPush=new Ie(this,w.join,this.params,this.timeout),this.pushBuffer=[],this.stateChangeRefs=[],this.rejoinTimer=new Le(()=>{this.socket.isConnected()&&this.rejoin()},this.socket.rejoinAfterMs),this.stateChangeRefs.push(this.socket.onError(()=>this.rejoinTimer.reset())),this.stateChangeRefs.push(this.socket.onOpen(()=>{this.rejoinTimer.reset(),this.isErrored()&&this.rejoin()})),this.joinPush.receive(`ok`,()=>{this.state=C.joined,this.rejoinTimer.reset(),this.pushBuffer.forEach(e=>e.send()),this.pushBuffer=[]}),this.joinPush.receive(`error`,e=>{this.state=C.errored,this.socket.hasLogger()&&this.socket.log(`channel`,`error ${this.topic}`,e),this.socket.isConnected()&&this.rejoinTimer.scheduleTimeout()}),this.onClose(()=>{this.rejoinTimer.reset(),this.socket.hasLogger()&&this.socket.log(`channel`,`close ${this.topic}`),this.state=C.closed,this.socket.remove(this)}),this.onError(e=>{this.socket.hasLogger()&&this.socket.log(`channel`,`error ${this.topic}`,e),this.isJoining()&&this.joinPush.reset(),this.state=C.errored,this.socket.isConnected()&&this.rejoinTimer.scheduleTimeout()}),this.joinPush.receive(`timeout`,()=>{this.socket.hasLogger()&&this.socket.log(`channel`,`timeout ${this.topic}`,this.joinPush.timeout),new Ie(this,w.leave,b({}),this.timeout).send(),this.state=C.errored,this.joinPush.reset(),this.socket.isConnected()&&this.rejoinTimer.scheduleTimeout()}),this.on(w.reply,(e,t)=>{this.trigger(this.replyEventName(t),e)})}join(e=this.timeout){if(this.joinedOnce)throw Error(`tried to join multiple times. 'join' can only be called a single time per channel instance`);return this.timeout=e,this.joinedOnce=!0,this.rejoin(),this.joinPush}teardown(){this.pushBuffer.forEach(e=>e.destroy()),this.pushBuffer=[],this.rejoinTimer.reset(),this.joinPush.destroy(),this.state=C.closed,this.bindings=[]}onClose(e){this.on(w.close,e)}onError(e){return this.on(w.error,t=>e(t))}on(e,t){let n=this.bindingRef++;return this.bindings.push({event:e,ref:n,callback:t}),n}off(e,t){this.bindings=this.bindings.filter(n=>!(n.event===e&&(t===void 0||t===n.ref)))}canPush(){return this.socket.isConnected()&&this.isJoined()}push(e,t,n=this.timeout){if(t||={},!this.joinedOnce)throw Error(`tried to push '${e}' to '${this.topic}' before joining. Use channel.join() before pushing events`);let r=new Ie(this,e,function(){return t},n);return this.canPush()?r.send():(r.startTimeout(),this.pushBuffer.push(r)),r}leave(e=this.timeout){this.rejoinTimer.reset(),this.joinPush.cancelTimeout(),this.state=C.leaving;let t=()=>{this.socket.hasLogger()&&this.socket.log(`channel`,`leave ${this.topic}`),this.trigger(w.close,`leave`)},n=new Ie(this,w.leave,b({}),e);return n.receive(`ok`,()=>t()).receive(`timeout`,()=>t()),n.send(),this.canPush()||n.trigger(`ok`,{}),n}onMessage(e,t,n){return t}filterBindings(e,t,n){return!0}isMember(e,t,n,r){return this.topic===e?r&&r!==this.joinRef()?(this.socket.hasLogger()&&this.socket.log(`channel`,`dropping outdated message`,{topic:e,event:t,payload:n,joinRef:r}),!1):!0:!1}joinRef(){return this.joinPush.ref}rejoin(e=this.timeout){this.isLeaving()||(this.socket.leaveOpenTopic(this.topic),this.state=C.joining,this.joinPush.resend(e))}trigger(e,t,n,r){let i=this.onMessage(e,t,n,r);if(t&&!i)throw Error(`channel onMessage callbacks must return the payload, modified or unmodified`);let a=this.bindings.filter(r=>r.event===e&&this.filterBindings(r,t,n));for(let e=0;e<a.length;e++)a[e].callback(i,n,r||this.joinRef())}replyEventName(e){return`chan_reply_${e}`}isClosed(){return this.state===C.closed}isErrored(){return this.state===C.errored}isJoined(){return this.state===C.joined}isJoining(){return this.state===C.joining}isLeaving(){return this.state===C.leaving}},ze=class{static request(e,t,n,r,i,a,o){if(x.XDomainRequest){let n=new x.XDomainRequest;return this.xdomainRequest(n,e,t,r,i,a,o)}else if(x.XMLHttpRequest){let s=new x.XMLHttpRequest;return this.xhrRequest(s,e,t,n,r,i,a,o)}else if(x.fetch&&x.AbortController)return this.fetchRequest(e,t,n,r,i,a,o);else throw Error(`No suitable XMLHttpRequest implementation found`)}static fetchRequest(e,t,n,r,i,a,o){let s={method:e,headers:n,body:r},c=null;return i&&(c=new AbortController,setTimeout(()=>c.abort(),i),s.signal=c.signal),x.fetch(t,s).then(e=>e.text()).then(e=>this.parseJSON(e)).then(e=>o&&o(e)).catch(e=>{e.name===`AbortError`&&a?a():o&&o(null)}),c}static xdomainRequest(e,t,n,r,i,a,o){return e.timeout=i,e.open(t,n),e.onload=()=>{let t=this.parseJSON(e.responseText);o&&o(t)},a&&(e.ontimeout=a),e.onprogress=()=>{},e.send(r),e}static xhrRequest(e,t,n,r,i,a,o,s){e.open(t,n,!0),e.timeout=a;for(let[t,n]of Object.entries(r))e.setRequestHeader(t,n);return e.onerror=()=>s&&s(null),e.onreadystatechange=()=>{e.readyState===Pe.complete&&s&&s(this.parseJSON(e.responseText))},o&&(e.ontimeout=o),e.send(i),e}static parseJSON(e){if(!e||e===``)return null;try{return JSON.parse(e)}catch{return console&&console.log(`failed to parse JSON response`,e),null}}static serialize(e,t){let n=[];for(var r in e){if(!Object.prototype.hasOwnProperty.call(e,r))continue;let i=t?`${t}[${r}]`:r,a=e[r];typeof a==`object`?n.push(this.serialize(a,i)):n.push(encodeURIComponent(i)+`=`+encodeURIComponent(a))}return n.join(`&`)}static appendParams(e,t){return Object.keys(t).length===0?e:`${e}${e.match(/\?/)?`&`:`?`}${this.serialize(t)}`}},Be=e=>{let t=``,n=new Uint8Array(e),r=n.byteLength;for(let e=0;e<r;e++)t+=String.fromCharCode(n[e]);return btoa(t)},Ve=class{constructor(e,t){t&&t.length===2&&t[1].startsWith(Fe)&&(this.authToken=atob(t[1].slice(Fe.length))),this.endPoint=null,this.token=null,this.skipHeartbeat=!0,this.reqs=new Set,this.awaitingBatchAck=!1,this.currentBatch=null,this.currentBatchTimer=null,this.batchBuffer=[],this.onopen=function(){},this.onerror=function(){},this.onmessage=function(){},this.onclose=function(){},this.pollEndpoint=this.normalizeEndpoint(e),this.readyState=S.connecting,setTimeout(()=>this.poll(),0)}normalizeEndpoint(e){return e.replace(`ws://`,`http://`).replace(`wss://`,`https://`).replace(RegExp(`(.*)/`+Ne.websocket),`$1/`+Ne.longpoll)}endpointURL(){return ze.appendParams(this.pollEndpoint,{token:this.token})}closeAndRetry(e,t,n){this.close(e,t,n),this.readyState=S.connecting}ontimeout(){this.onerror(`timeout`),this.closeAndRetry(1005,`timeout`,!1)}isActive(){return this.readyState===S.open||this.readyState===S.connecting}poll(){let e={Accept:`application/json`};this.authToken&&(e[`X-Phoenix-AuthToken`]=this.authToken),this.ajax(`GET`,e,null,()=>this.ontimeout(),e=>{if(e){var{status:t,token:n,messages:r}=e;if(t===410&&this.token!==null){this.onerror(410),this.closeAndRetry(3410,`session_gone`,!1);return}this.token=n}else t=0;switch(t){case 200:r.forEach(e=>{setTimeout(()=>this.onmessage({data:e}),0)}),this.poll();break;case 204:this.poll();break;case 410:this.readyState=S.open,this.onopen({}),this.poll();break;case 403:this.onerror(403),this.close(1008,`forbidden`,!1);break;case 0:case 500:this.onerror(500),this.closeAndRetry(1011,`internal server error`,500);break;default:throw Error(`unhandled poll status ${t}`)}})}send(e){typeof e!=`string`&&(e=Be(e)),this.currentBatch?this.currentBatch.push(e):this.awaitingBatchAck?this.batchBuffer.push(e):(this.currentBatch=[e],this.currentBatchTimer=setTimeout(()=>{this.batchSend(this.currentBatch),this.currentBatch=null},0))}batchSend(e,t=0){this.awaitingBatchAck=!0;let n=t+Me,r=e.slice(t,n);this.ajax(`POST`,{"Content-Type":`application/x-ndjson`},r.join(`
`),()=>this.onerror(`timeout`),t=>{!t||t.status!==200?(this.awaitingBatchAck=!1,this.onerror(t&&t.status),this.closeAndRetry(1011,`internal server error`,!1)):n<e.length?this.batchSend(e,n):this.batchBuffer.length>0?(this.batchSend(this.batchBuffer),this.batchBuffer=[]):this.awaitingBatchAck=!1})}close(e,t,n){for(let e of this.reqs)e.abort();this.readyState=S.closed;let r=Object.assign({code:1e3,reason:void 0,wasClean:!0},{code:e,reason:t,wasClean:n});this.batchBuffer=[],clearTimeout(this.currentBatchTimer),this.currentBatchTimer=null,typeof CloseEvent<`u`?this.onclose(new CloseEvent(`close`,r)):this.onclose(r)}ajax(e,t,n,r,i){let a;a=ze.request(e,this.endpointURL(),t,n,this.timeout,()=>{this.reqs.delete(a),r()},e=>{this.reqs.delete(a),this.isActive()&&i(e)}),this.reqs.add(a)}},He=class e{constructor(t,n={}){let r=n.events||{state:`presence_state`,diff:`presence_diff`};this.state=Object.create(null),this.pendingDiffs=[],this.channel=t,this.joinRef=null,this.caller={onJoin:function(){},onLeave:function(){},onSync:function(){}},this.channel.on(r.state,t=>{let{onJoin:n,onLeave:r,onSync:i}=this.caller;this.joinRef=this.channel.joinRef(),this.state=e.syncState(this.state,t,n,r),this.pendingDiffs.forEach(t=>{this.state=e.syncDiff(this.state,t,n,r)}),this.pendingDiffs=[],i()}),this.channel.on(r.diff,t=>{let{onJoin:n,onLeave:r,onSync:i}=this.caller;this.inPendingSyncState()?this.pendingDiffs.push(t):(this.state=e.syncDiff(this.state,t,n,r),i())})}onJoin(e){this.caller.onJoin=e}onLeave(e){this.caller.onLeave=e}onSync(e){this.caller.onSync=e}list(t){return e.list(this.state,t)}inPendingSyncState(){return!this.joinRef||this.joinRef!==this.channel.joinRef()}static syncState(e,t,n,r){let i=this.toNullProtoObj(this.clone(e));t=this.toNullProtoObj(t);let a=Object.create(null),o=Object.create(null);return this.map(i,(e,n)=>{t[e]||(o[e]=n)}),this.map(t,(e,t)=>{let n=i[e];if(n){let r=t.metas.map(e=>e.phx_ref),i=n.metas.map(e=>e.phx_ref),s=t.metas.filter(e=>i.indexOf(e.phx_ref)<0),c=n.metas.filter(e=>r.indexOf(e.phx_ref)<0);s.length>0&&(a[e]=t,a[e].metas=s),c.length>0&&(o[e]=this.clone(n),o[e].metas=c)}else a[e]=t}),this.syncDiff(i,{joins:a,leaves:o},n,r)}static syncDiff(e,t,n,r){e=this.toNullProtoObj(e);let{joins:i,leaves:a}=this.clone(t);return n||=function(){},r||=function(){},this.map(i,(t,r)=>{let i=e[t];if(e[t]=this.clone(r),i){let n=e[t].metas.map(e=>e.phx_ref),r=i.metas.filter(e=>n.indexOf(e.phx_ref)<0);e[t].metas.unshift(...r)}n(t,i,r)}),this.map(a,(t,n)=>{let i=e[t];if(!i)return;let a=n.metas.map(e=>e.phx_ref);i.metas=i.metas.filter(e=>a.indexOf(e.phx_ref)<0),r(t,i,n),i.metas.length===0&&delete e[t]}),e}static list(e,t){return t||=function(e,t){return t},this.map(e,(e,n)=>t(e,n))}static map(e,t){return Object.getOwnPropertyNames(e).map(n=>t(n,e[n]))}static toNullProtoObj(e){if(Object.getPrototypeOf(e)===null)return e;let t=Object.create(null);return Object.getOwnPropertyNames(e).forEach(n=>{t[n]=e[n]}),t}static clone(e){return JSON.parse(JSON.stringify(e))}},Ue={HEADER_LENGTH:1,META_LENGTH:4,KINDS:{push:0,reply:1,broadcast:2},encode(e,t){if(e.payload.constructor===ArrayBuffer)return t(this.binaryEncode(e));{let n=[e.join_ref,e.ref,e.topic,e.event,e.payload];return t(JSON.stringify(n))}},decode(e,t){if(e.constructor===ArrayBuffer)return t(this.binaryDecode(e));{let[n,r,i,a,o]=JSON.parse(e);return t({join_ref:n,ref:r,topic:i,event:a,payload:o})}},binaryEncode(e){let{join_ref:t,ref:n,event:r,topic:i,payload:a}=e,o=new TextEncoder,s=o.encode(t),c=o.encode(n),l=o.encode(i),u=o.encode(r);this.assertFieldSize(s.byteLength,`join_ref`),this.assertFieldSize(c.byteLength,`ref`),this.assertFieldSize(l.byteLength,`topic`),this.assertFieldSize(u.byteLength,`event`);let d=this.META_LENGTH+s.byteLength+c.byteLength+l.byteLength+u.byteLength,f=new ArrayBuffer(this.HEADER_LENGTH+d),p=new Uint8Array(f),m=new DataView(f),h=0;m.setUint8(h++,this.KINDS.push),m.setUint8(h++,s.byteLength),m.setUint8(h++,c.byteLength),m.setUint8(h++,l.byteLength),m.setUint8(h++,u.byteLength),p.set(s,h),h+=s.byteLength,p.set(c,h),h+=c.byteLength,p.set(l,h),h+=l.byteLength,p.set(u,h),h+=u.byteLength;var g=new Uint8Array(f.byteLength+a.byteLength);return g.set(p,0),g.set(new Uint8Array(a),f.byteLength),g.buffer},assertFieldSize(e,t){if(e>255)throw Error(`unable to convert ${t} to binary: must be less than or equal to 255 bytes, but is ${e} bytes`)},binaryDecode(e){let t=new DataView(e),n=t.getUint8(0),r=new TextDecoder;switch(n){case this.KINDS.push:return this.decodePush(e,t,r);case this.KINDS.reply:return this.decodeReply(e,t,r);case this.KINDS.broadcast:return this.decodeBroadcast(e,t,r)}},decodePush(e,t,n){let r=t.getUint8(1),i=t.getUint8(2),a=t.getUint8(3),o=this.HEADER_LENGTH+this.META_LENGTH-1,s=n.decode(e.slice(o,o+r));o+=r;let c=n.decode(e.slice(o,o+i));o+=i;let l=n.decode(e.slice(o,o+a));return o+=a,{join_ref:s,ref:null,topic:c,event:l,payload:e.slice(o,e.byteLength)}},decodeReply(e,t,n){let r=t.getUint8(1),i=t.getUint8(2),a=t.getUint8(3),o=t.getUint8(4),s=this.HEADER_LENGTH+this.META_LENGTH,c=n.decode(e.slice(s,s+r));s+=r;let l=n.decode(e.slice(s,s+i));s+=i;let u=n.decode(e.slice(s,s+a));s+=a;let d=n.decode(e.slice(s,s+o));s+=o;let f={status:d,response:e.slice(s,e.byteLength)};return{join_ref:c,ref:l,topic:u,event:w.reply,payload:f}},decodeBroadcast(e,t,n){let r=t.getUint8(1),i=t.getUint8(2),a=this.HEADER_LENGTH+2,o=n.decode(e.slice(a,a+r));a+=r;let s=n.decode(e.slice(a,a+i));return a+=i,{join_ref:null,ref:null,topic:o,event:s,payload:e.slice(a,e.byteLength)}}},We=class{constructor(e,t={}){this.stateChangeCallbacks={open:[],close:[],error:[],message:[]},this.channels=[],this.sendBuffer=[],this.ref=0,this.fallbackRef=null,this.timeout=t.timeout||Ae,this.transport=t.transport||x.WebSocket||Ve,this.conn=void 0,this.primaryPassedHealthCheck=!1,this.longPollFallbackMs=t.longPollFallbackMs,this.fallbackTimer=null;let n=null;try{n=x&&x.sessionStorage}catch{}this.sessionStore=t.sessionStorage||n,this.establishedConnections=0,this.defaultEncoder=Ue.encode.bind(Ue),this.defaultDecoder=Ue.decode.bind(Ue),this.closeWasClean=!0,this.disconnecting=!1,this.binaryType=t.binaryType||`arraybuffer`,this.connectClock=1,this.pageHidden=!1,this.encode=void 0,this.decode=void 0,this.transport===Ve?(this.encode=this.defaultEncoder,this.decode=this.defaultDecoder):(this.encode=t.encode||this.defaultEncoder,this.decode=t.decode||this.defaultDecoder);let r=null;Oe&&Oe.addEventListener&&(Oe.addEventListener(`pagehide`,e=>{this.conn&&(this.disconnect(),r=this.connectClock)}),Oe.addEventListener(`pageshow`,e=>{r===this.connectClock&&(r=null,this.connect())}),Oe.addEventListener(`visibilitychange`,()=>{document.visibilityState===`hidden`?this.pageHidden=!0:(this.pageHidden=!1,!this.isConnected()&&!this.closeWasClean&&this.teardown(()=>this.connect()))})),this.heartbeatIntervalMs=t.heartbeatIntervalMs||3e4,this.autoSendHeartbeat=t.autoSendHeartbeat??!0,this.heartbeatCallback=t.heartbeatCallback??(()=>{}),this.rejoinAfterMs=e=>t.rejoinAfterMs?t.rejoinAfterMs(e):[1e3,2e3,5e3][e-1]||1e4,this.reconnectAfterMs=e=>t.reconnectAfterMs?t.reconnectAfterMs(e):[10,50,100,150,200,250,500,1e3,2e3][e-1]||5e3,this.logger=t.logger||null,!this.logger&&t.debug&&(this.logger=(e,t,n)=>{console.log(`${e}: ${t}`,n)}),this.longpollerTimeout=t.longpollerTimeout||2e4,this.params=b(t.params||{}),this.endPoint=`${e}/${Ne.websocket}`,this.vsn=t.vsn||ke,this.heartbeatTimeoutTimer=null,this.heartbeatTimer=null,this.heartbeatSentAt=null,this.pendingHeartbeatRef=null,this.reconnectTimer=new Le(()=>{if(this.pageHidden){this.log(`Not reconnecting as page is hidden!`),this.teardown();return}this.teardown(async()=>{t.beforeReconnect&&await t.beforeReconnect(),this.connect()})},this.reconnectAfterMs),this.authToken=t.authToken&&b(t.authToken)}getLongPollTransport(){return Ve}replaceTransport(e){this.connectClock++,this.closeWasClean=!0,clearTimeout(this.fallbackTimer),this.reconnectTimer.reset(),this.conn&&=(this.conn.close(),null),this.transport=e}protocol(){return location.protocol.match(/^https/)?`wss`:`ws`}endPointURL(){let e=ze.appendParams(ze.appendParams(this.endPoint,this.params()),{vsn:this.vsn});return e.charAt(0)===`/`?e.charAt(1)===`/`?`${this.protocol()}:${e}`:`${this.protocol()}://${location.host}${e}`:e}disconnect(e,t,n){this.connectClock++,this.disconnecting=!0,this.closeWasClean=!0,clearTimeout(this.fallbackTimer),this.reconnectTimer.reset(),this.teardown(()=>{this.disconnecting=!1,e&&e()},t,n)}connect(e){e&&(console&&console.log(`passing params to connect is deprecated. Instead pass :params to the Socket constructor`),this.params=b(e)),!(this.conn&&!this.disconnecting)&&(this.longPollFallbackMs&&this.transport!==Ve?this.connectWithFallback(Ve,this.longPollFallbackMs):this.transportConnect())}log(e,t,n){this.logger&&this.logger(e,t,n)}hasLogger(){return this.logger!==null}onOpen(e){let t=this.makeRef();return this.stateChangeCallbacks.open.push([t,e]),t}onClose(e){let t=this.makeRef();return this.stateChangeCallbacks.close.push([t,e]),t}onError(e){let t=this.makeRef();return this.stateChangeCallbacks.error.push([t,e]),t}onMessage(e){let t=this.makeRef();return this.stateChangeCallbacks.message.push([t,e]),t}onHeartbeat(e){this.heartbeatCallback=e}ping(e){if(!this.isConnected())return!1;let t=this.makeRef(),n=Date.now();this.push({topic:`phoenix`,event:`heartbeat`,payload:{},ref:t});let r=this.onMessage(i=>{i.ref===t&&(this.off([r]),e(Date.now()-n))});return!0}transportName(e){switch(e){case Ve:return`LongPoll`;default:return e.name}}transportConnect(){this.connectClock++,this.closeWasClean=!1;let e;this.authToken&&(e=[`phoenix`,`${Fe}${btoa(this.authToken()).replace(/=/g,``)}`]),this.conn=new this.transport(this.endPointURL(),e),this.conn.binaryType=this.binaryType,this.conn.timeout=this.longpollerTimeout,this.conn.onopen=()=>this.onConnOpen(),this.conn.onerror=e=>this.onConnError(e),this.conn.onmessage=e=>this.onConnMessage(e),this.conn.onclose=e=>this.onConnClose(e)}getSession(e){return this.sessionStore&&this.sessionStore.getItem(e)}storeSession(e,t){this.sessionStore&&this.sessionStore.setItem(e,t)}connectWithFallback(e,t=2500){clearTimeout(this.fallbackTimer);let n=!1,r=!0,i,a=this.transportName(e),o=t=>{this.log(`transport`,`falling back to ${a}...`,t),this.off([void 0,i]),r=!1,this.replaceTransport(e),this.transportConnect()};if(this.getSession(`phx:fallback:${a}`))return o(`memorized`);this.fallbackTimer=setTimeout(o,t),i=this.onError(e=>{this.log(`transport`,`error`,e),r&&!n&&(clearTimeout(this.fallbackTimer),o(e))}),this.fallbackRef&&this.off([this.fallbackRef]),this.fallbackRef=this.onOpen(()=>{if(n=!0,!r){let t=this.transportName(e);return this.primaryPassedHealthCheck||this.storeSession(`phx:fallback:${t}`,`true`),this.log(`transport`,`established ${t} fallback`)}clearTimeout(this.fallbackTimer),this.fallbackTimer=setTimeout(o,t),this.ping(e=>{this.log(`transport`,`connected to primary after`,e),this.primaryPassedHealthCheck=!0,clearTimeout(this.fallbackTimer)})}),this.transportConnect()}clearHeartbeats(){clearTimeout(this.heartbeatTimer),clearTimeout(this.heartbeatTimeoutTimer)}onConnOpen(){this.hasLogger()&&this.log(`transport`,`connected to ${this.endPointURL()}`),this.closeWasClean=!1,this.disconnecting=!1,this.establishedConnections++,this.flushSendBuffer(),this.reconnectTimer.reset(),this.autoSendHeartbeat&&this.resetHeartbeat(),this.triggerStateCallbacks(`open`)}heartbeatTimeout(){if(this.pendingHeartbeatRef){this.pendingHeartbeatRef=null,this.heartbeatSentAt=null,this.hasLogger()&&this.log(`transport`,`heartbeat timeout. Attempting to re-establish connection`);try{this.heartbeatCallback(`timeout`)}catch(e){this.log(`error`,`error in heartbeat callback`,e)}this.triggerChanError(Error(`heartbeat timeout`)),this.closeWasClean=!1,this.teardown(()=>this.reconnectTimer.scheduleTimeout(),je,`heartbeat timeout`)}}resetHeartbeat(){this.conn&&this.conn.skipHeartbeat||(this.pendingHeartbeatRef=null,this.clearHeartbeats(),this.heartbeatTimer=setTimeout(()=>this.sendHeartbeat(),this.heartbeatIntervalMs))}teardown(e,t,n){if(!this.conn)return e&&e();let r=this.conn;this.waitForBufferDone(r,()=>{t?r.close(t,n||``):r.close(),this.waitForSocketClosed(r,()=>{this.conn===r&&(this.conn.onopen=function(){},this.conn.onerror=function(){},this.conn.onmessage=function(){},this.conn.onclose=function(){},this.conn=null),e&&e()})})}waitForBufferDone(e,t,n=1){if(n===5||!e.bufferedAmount){t();return}setTimeout(()=>{this.waitForBufferDone(e,t,n+1)},150*n)}waitForSocketClosed(e,t,n=1){if(n===5||e.readyState===S.closed){t();return}setTimeout(()=>{this.waitForSocketClosed(e,t,n+1)},150*n)}onConnClose(e){this.conn&&(this.conn.onclose=()=>{}),this.hasLogger()&&this.log(`transport`,`close`,e),this.triggerChanError(e),this.clearHeartbeats(),this.closeWasClean||this.reconnectTimer.scheduleTimeout(),this.triggerStateCallbacks(`close`,e)}onConnError(e){this.hasLogger()&&this.log(`transport`,`error`,e);let t=this.transport,n=this.establishedConnections;this.triggerStateCallbacks(`error`,e,t,n),(t===this.transport||n>0)&&this.triggerChanError(e)}triggerChanError(e){this.channels.forEach(t=>{t.isErrored()||t.isLeaving()||t.isClosed()||t.trigger(w.error,e)})}connectionState(){switch(this.conn&&this.conn.readyState){case S.connecting:return`connecting`;case S.open:return`open`;case S.closing:return`closing`;default:return`closed`}}isConnected(){return this.connectionState()===`open`}remove(e){this.off(e.stateChangeRefs),this.channels=this.channels.filter(t=>t!==e)}off(e){for(let t in this.stateChangeCallbacks)this.stateChangeCallbacks[t]=this.stateChangeCallbacks[t].filter(([t])=>e.indexOf(t)===-1)}channel(e,t={}){let n=new Re(e,t,this);return this.channels.push(n),n}push(e){if(this.hasLogger()){let{topic:t,event:n,payload:r,ref:i,join_ref:a}=e;this.log(`push`,`${t} ${n} (${a}, ${i})`,r)}this.isConnected()?this.encode(e,e=>this.conn.send(e)):this.sendBuffer.push(()=>this.encode(e,e=>this.conn.send(e)))}makeRef(){let e=this.ref+1;return e===this.ref?this.ref=0:this.ref=e,this.ref.toString()}sendHeartbeat(){if(!this.isConnected()){try{this.heartbeatCallback(`disconnected`)}catch(e){this.log(`error`,`error in heartbeat callback`,e)}return}if(this.pendingHeartbeatRef){this.heartbeatTimeout();return}this.pendingHeartbeatRef=this.makeRef(),this.heartbeatSentAt=Date.now(),this.push({topic:`phoenix`,event:`heartbeat`,payload:{},ref:this.pendingHeartbeatRef});try{this.heartbeatCallback(`sent`)}catch(e){this.log(`error`,`error in heartbeat callback`,e)}this.heartbeatTimeoutTimer=setTimeout(()=>this.heartbeatTimeout(),this.heartbeatIntervalMs)}flushSendBuffer(){this.isConnected()&&this.sendBuffer.length>0&&(this.sendBuffer.forEach(e=>e()),this.sendBuffer=[])}onConnMessage(e){this.decode(e.data,e=>{let{topic:t,event:n,payload:r,ref:i,join_ref:a}=e;if(i&&i===this.pendingHeartbeatRef){let e=this.heartbeatSentAt?Date.now()-this.heartbeatSentAt:void 0;this.clearHeartbeats();try{this.heartbeatCallback(r.status===`ok`?`ok`:`error`,e)}catch(e){this.log(`error`,`error in heartbeat callback`,e)}this.pendingHeartbeatRef=null,this.heartbeatSentAt=null,this.autoSendHeartbeat&&(this.heartbeatTimer=setTimeout(()=>this.sendHeartbeat(),this.heartbeatIntervalMs))}this.hasLogger()&&this.log(`receive`,`${r.status||``} ${t} ${n} ${i&&`(`+i+`)`||``}`.trim(),r);for(let e=0;e<this.channels.length;e++){let o=this.channels[e];o.isMember(t,n,r,a)&&o.trigger(n,r,i,a)}this.triggerStateCallbacks(`message`,e)})}triggerStateCallbacks(e,...t){try{this.stateChangeCallbacks[e].forEach(([n,r])=>{try{r(...t)}catch(t){this.log(`error`,`error in ${e} callback`,t)}})}catch(t){this.log(`error`,`error triggering ${e} callbacks`,t)}}leaveOpenTopic(e){let t=this.channels.find(t=>t.topic===e&&(t.isJoined()||t.isJoining()));t&&(this.hasLogger()&&this.log(`transport`,`leaving duplicate topic "${e}"`),t.leave())}},Ge=class e{constructor(t,n){let r=Je(n);this.presence=new He(t.getChannel(),r),this.presence.onJoin((n,r,i)=>{let a=e.onJoinPayload(n,r,i);t.getChannel().trigger(`presence`,a)}),this.presence.onLeave((n,r,i)=>{let a=e.onLeavePayload(n,r,i);t.getChannel().trigger(`presence`,a)}),this.presence.onSync(()=>{t.getChannel().trigger(`presence`,{event:`sync`})})}get state(){return e.transformState(this.presence.state)}static transformState(e){return e=qe(e),Object.getOwnPropertyNames(e).reduce((t,n)=>{let r=e[n];return t[n]=Ke(r),t},{})}static onJoinPayload(e,t,n){return{event:`join`,key:e,currentPresences:Ye(t),newPresences:Ke(n)}}static onLeavePayload(e,t,n){return{event:`leave`,key:e,currentPresences:Ye(t),leftPresences:Ke(n)}}};function Ke(e){return e.metas.map(e=>{let t=Object.getOwnPropertyDescriptors(e),n=Object.defineProperties({},t);return n.presence_ref=n.phx_ref,delete n.phx_ref,delete n.phx_ref_prev,n})}function qe(e){return JSON.parse(JSON.stringify(e))}function Je(e){return e?.events&&{events:e.events}}function Ye(e){return e?.metas?Ke(e):[]}var Xe;(function(e){e.SYNC=`sync`,e.JOIN=`join`,e.LEAVE=`leave`})(Xe||={});var Ze=class{get state(){return this.presenceAdapter.state}constructor(e,t){this.channel=e,this.presenceAdapter=new Ge(this.channel.channelAdapter,t)}};function Qe(e){if(e instanceof Error)return e;if(typeof e==`string`)return Error(e);if(e&&typeof e==`object`){let t=e;if(typeof t.code==`number`){let n=typeof t.reason==`string`&&t.reason?` (${t.reason})`:``;return Error(`socket closed: ${t.code}${n}`,{cause:e})}return Error(`channel error: transport failure`,{cause:e})}return Error(`channel error: connection lost`)}var $e=class{constructor(e,t,n){let r=et(n);this.channel=e.getSocket().channel(t,r),this.socket=e}get state(){return this.channel.state}set state(e){this.channel.state=e}get joinedOnce(){return this.channel.joinedOnce}get joinPush(){return this.channel.joinPush}get rejoinTimer(){return this.channel.rejoinTimer}on(e,t){return this.channel.on(e,t)}off(e,t){this.channel.off(e,t)}subscribe(e){return this.channel.join(e)}unsubscribe(e){return this.channel.leave(e)}teardown(){this.channel.teardown()}onClose(e){this.channel.onClose(e)}onError(e){return this.channel.onError(e)}push(e,t,n){let r;try{r=this.channel.push(e,t,n)}catch{throw Error(`tried to push '${e}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`)}if(this.channel.pushBuffer.length>100){let e=this.channel.pushBuffer.shift();e.cancelTimeout(),this.socket.log(`channel`,`discarded push due to buffer overflow: ${e.event}`,e.payload())}return r}updateJoinPayload(e){let t=this.channel.joinPush.payload();this.channel.joinPush.payload=()=>Object.assign(Object.assign({},t),e)}canPush(){return this.socket.isConnected()&&this.state===v.joined}isJoined(){return this.state===v.joined}isJoining(){return this.state===v.joining}isClosed(){return this.state===v.closed}isLeaving(){return this.state===v.leaving}updateFilterBindings(e){this.channel.filterBindings=e}updatePayloadTransform(e){this.channel.onMessage=e}getChannel(){return this.channel}};function et(e){return{config:Object.assign({broadcast:{ack:!1,self:!1},presence:{key:``,enabled:!1},private:!1},e.config)}}let tt=/[,()"\\]/,nt=e=>tt.test(e)||e!==e.trim(),rt=e=>`"${e.replace(/\\/g,`\\\\`).replace(/"/g,`\\"`)}"`,it=e=>{let t=e===null?`null`:String(e);return nt(t)?rt(t):t},at=e=>e===null?`null`:String(e),ot=(e,t)=>{if(e===`in`){let e=Array.isArray(t)?t:[t];if(e.length===0)throw Error("Realtime `in` filter requires at least one value.");return`in.(${Array.from(new Set(e)).map(e=>it(e)).join(`,`)})`}return e===`is`?`is.${at(t)}`:`${e}.${it(t)}`};var st=class{constructor(){this.filters=[]}add(e,t,n,r=!1){let i=r?`not.`:``;return this.filters.push(`${e}=${i}${ot(t,n)}`),this}eq(e,t){return this.add(e,`eq`,t)}neq(e,t){return this.add(e,`neq`,t)}gt(e,t){return this.add(e,`gt`,t)}gte(e,t){return this.add(e,`gte`,t)}lt(e,t){return this.add(e,`lt`,t)}lte(e,t){return this.add(e,`lte`,t)}in(e,t){return this.add(e,`in`,t)}like(e,t){return this.add(e,`like`,t)}ilike(e,t){return this.add(e,`ilike`,t)}match(e,t){return this.add(e,`match`,t)}imatch(e,t){return this.add(e,`imatch`,t)}is(e,t){return this.add(e,`is`,t)}isDistinct(e,t){return this.add(e,`isdistinct`,t)}not(e,t,n){return this.add(e,t,n,!0)}build(){return this.filters.join(`,`)}toString(){return this.build()}};let ct=()=>new st;var lt;(function(e){e.ALL=`*`,e.INSERT=`INSERT`,e.UPDATE=`UPDATE`,e.DELETE=`DELETE`})(lt||={});var T;(function(e){e.BROADCAST=`broadcast`,e.PRESENCE=`presence`,e.POSTGRES_CHANGES=`postgres_changes`,e.SYSTEM=`system`})(T||={});var E;(function(e){e.SUBSCRIBED=`SUBSCRIBED`,e.TIMED_OUT=`TIMED_OUT`,e.CLOSED=`CLOSED`,e.CHANNEL_ERROR=`CHANNEL_ERROR`})(E||={});let ut=v;var dt=class e{get state(){return this.channelAdapter.state}set state(e){this.channelAdapter.state=e}get joinedOnce(){return this.channelAdapter.joinedOnce}get timeout(){return this.socket.timeout}get joinPush(){return this.channelAdapter.joinPush}get rejoinTimer(){return this.channelAdapter.rejoinTimer}constructor(e,t={config:{}},n){if(this.topic=e,this.params=t,this.socket=n,this.bindings={},this.subTopic=e.replace(/^realtime:/i,``),this.params.config=Object.assign({broadcast:{ack:!1,self:!1},presence:{key:``,enabled:!1},private:!1},t.config),this.channelAdapter=new $e(this.socket.socketAdapter,e,this.params),this.presence=new Ze(this),this._onClose(()=>{this.socket._remove(this)}),this._updateFilterTransform(),this.broadcastEndpointURL=Ee(this.socket.socketAdapter.endPointURL()),this.private=this.params.config.private||!1,!this.private&&this.params.config?.broadcast?.replay)throw Error(`tried to use replay on public channel '${this.topic}'. It must be a private channel.`)}subscribe(e,t=this.timeout){if(this.socket.isConnected()||this.socket.connect(),this.channelAdapter.isClosed()){let{config:{broadcast:n,presence:r,private:i,postgres_changes_options:a}}=this.params,o=this.bindings.postgres_changes?.map(e=>e.filter)??[],s=!!this.bindings[T.PRESENCE]&&this.bindings[T.PRESENCE].length>0||this.params.config.presence?.enabled===!0,c={},l=Object.assign({broadcast:n,presence:Object.assign(Object.assign({},r),{enabled:s}),postgres_changes:o,private:i},a?{postgres_changes_options:a}:{});this.socket.accessTokenValue&&(c.access_token=this.socket.accessTokenValue),this._onError(t=>{e?.(E.CHANNEL_ERROR,Qe(t))}),this._onClose(()=>e?.(E.CLOSED)),this.updateJoinPayload(Object.assign({config:l},c)),this._updateFilterMessage();let u=a?.wait&&o.length>0?Math.max(t,(a.timeout??15e3)+1e4):t;this.channelAdapter.subscribe(u).receive(`ok`,async({postgres_changes:t})=>{if(this.socket._isManualToken()||this.socket.setAuth(),t===void 0){e?.(E.SUBSCRIBED);return}this._updatePostgresBindings(t,e)}).receive(`error`,t=>{this.state=v.errored;let n=Object.values(t).join(`, `)||`error`;e?.(E.CHANNEL_ERROR,Error(n,{cause:t}))}).receive(`timeout`,()=>{e?.(E.TIMED_OUT)})}return this}_updatePostgresBindings(t,n){let r=this.bindings.postgres_changes,i=r?.length??0,a=[];for(let o=0;o<i;o++){let i=r[o],{filter:{event:s,schema:c,table:l,filter:u}}=i,d=t&&t[o];if(d&&d.event===s&&e.isFilterValueEqual(d.schema,c)&&e.isFilterValueEqual(d.table,l)&&e.isFilterValueEqual(d.filter,u))a.push(Object.assign(Object.assign({},i),{id:d.id}));else{this.unsubscribe(),this.state=v.errored,n?.(E.CHANNEL_ERROR,Error(`mismatch between server and client bindings for postgres changes`));return}}this.bindings.postgres_changes=a,this.state!=v.errored&&n&&n(E.SUBSCRIBED)}presenceState(){return this.presence.state}async track(e,t={}){return await this.send({type:`presence`,event:`track`,payload:e},t)}async untrack(e={}){return await this.send({type:`presence`,event:`untrack`},e)}on(e,t,n){let r=this.channelAdapter.isJoined()||this.channelAdapter.isJoining(),i=e===T.PRESENCE||e===T.POSTGRES_CHANGES;if(r&&i)throw this.socket.log(`channel`,`cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`),Error(`cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`);return this._on(e,t,n)}async httpSend(e,t,n={}){if(t==null)return Promise.reject(Error(`Payload is required for httpSend()`));let r=t instanceof ArrayBuffer||ArrayBuffer.isView(t),i={apikey:this.socket.apiKey?this.socket.apiKey:``,"Content-Type":r?`application/octet-stream`:`application/json`};this.socket.accessTokenValue&&(i.Authorization=`Bearer ${this.socket.accessTokenValue}`);let a=new URL(this.broadcastEndpointURL);a.pathname+=`/${encodeURIComponent(this.subTopic)}/events/${encodeURIComponent(e)}`,this.private&&a.searchParams.set(`private`,`true`);let o={method:`POST`,headers:i,body:r?t:JSON.stringify(t)},s=await this._fetchWithTimeout(a.toString(),o,n.timeout??this.timeout);if(s.status===202)return{success:!0};if(s.status===404)return Promise.reject(Error(`httpSend() requires Realtime server v2.97.0 or newer; the endpoint returned 404. Update your Supabase CLI to a recent version, or upgrade the Realtime server in your self-hosted setup. See https://github.com/supabase/supabase-js/blob/master/packages/core/realtime-js/migrations/httpsend-server-version.md`));let c=s.statusText;try{let e=await s.json();c=e.error||e.message||c}catch{}return Promise.reject(Error(c))}async send(e,t={}){if(!this.channelAdapter.canPush()&&e.type===`broadcast`){let n=`Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.`;this.socket.hasLogger()?this.socket.log(`channel`,n):console.warn(n);let{event:r,payload:i}=e,a={apikey:this.socket.apiKey?this.socket.apiKey:``,"Content-Type":`application/json`};this.socket.accessTokenValue&&(a.Authorization=`Bearer ${this.socket.accessTokenValue}`);let o={method:`POST`,headers:a,body:JSON.stringify({messages:[{topic:this.subTopic,event:r,payload:i,private:this.private}]})};try{let e=await this._fetchWithTimeout(this.broadcastEndpointURL,o,t.timeout??this.timeout);return await e.body?.cancel(),e.ok?`ok`:`error`}catch(e){return e instanceof Error&&e.name===`AbortError`?`timed out`:`error`}}else return new Promise(n=>{let r=this.channelAdapter.push(e.type,e,t.timeout||this.timeout);e.type===`broadcast`&&!this.params?.config?.broadcast?.ack&&n(`ok`),r.receive(`ok`,()=>n(`ok`)),r.receive(`error`,()=>n(`error`)),r.receive(`timeout`,()=>n(`timed out`))})}updateJoinPayload(e){this.channelAdapter.updateJoinPayload(e)}async unsubscribe(e=this.timeout){return new Promise(t=>{this.channelAdapter.unsubscribe(e).receive(`ok`,()=>t(`ok`)).receive(`timeout`,()=>t(`timed out`)).receive(`error`,()=>t(`error`))})}teardown(){this.channelAdapter.teardown()}async _fetchWithTimeout(e,t,n){let r=new AbortController,i=setTimeout(()=>r.abort(),n),a=await this.socket.fetch(e,Object.assign(Object.assign({},t),{signal:r.signal}));return clearTimeout(i),a}_on(t,n,r){let i=t.toLocaleLowerCase(),a=n?.filter;if((a instanceof st||typeof a==`object`&&a&&typeof a.build==`function`)&&(n=Object.assign(Object.assign({},n),{filter:a.build()})),i===T.POSTGRES_CHANGES&&this.bindings[i]?.find(t=>e.isSamePostgresFilter(t.filter,n)))return this.socket.log(`error`,`duplicate \`postgres_changes\` binding for ${this.topic} ignored`,n),this;let o=this.channelAdapter.on(t,r),s={type:i,filter:n,callback:r,ref:o};return this.bindings[i]?this.bindings[i].push(s):this.bindings[i]=[s],this._updateFilterMessage(),this}_onClose(e){this.channelAdapter.onClose(e)}_onError(e){this.channelAdapter.onError(e)}_updateFilterMessage(){this.channelAdapter.updateFilterBindings((e,t,n)=>{let r=e.event.toLocaleLowerCase();if(this._notThisChannelEvent(r,n))return!1;let i=this.bindings[r]?.find(t=>t.ref===e.ref);if(!i)return!0;if([`broadcast`,`presence`,`postgres_changes`].includes(r))if(`id`in i){let e=i.id,n=i.filter?.event;return e&&t.ids?.includes(e)&&(n===`*`||n?.toLocaleLowerCase()===t.data?.type.toLocaleLowerCase())}else{let e=(i?.filter?.event)?.toLocaleLowerCase();return e===`*`||e===(t?.event)?.toLocaleLowerCase()}else return i.type.toLocaleLowerCase()===r})}_notThisChannelEvent(e,t){let{close:n,error:r,leave:i,join:a}=me;return t&&[n,r,i,a].includes(e)&&t!==this.joinPush.ref}_updateFilterTransform(){this.channelAdapter.updatePayloadTransform((e,t,n)=>{if(typeof t==`object`&&`ids`in t){let e=t.data,{schema:n,table:r,commit_timestamp:i,type:a,errors:o}=e,s={schema:n,table:r,commit_timestamp:i,eventType:a,new:{},old:{},errors:o};return Object.assign(Object.assign({},s),this._getPayloadRecords(e))}return t})}copyBindings(e){if(this.joinedOnce)throw Error(`cannot copy bindings into joined channel`);for(let t in e.bindings)for(let n of e.bindings[t])this._on(n.type,n.filter,n.callback)}static isFilterValueEqual(e,t){return(e??void 0)===(t??void 0)}static isSamePostgresFilter(t,n){let r=(t?.select)?.join()??void 0,i=(n?.select)?.join()??void 0;return t?.event===n?.event&&e.isFilterValueEqual(t?.schema,n?.schema)&&e.isFilterValueEqual(t?.table,n?.table)&&e.isFilterValueEqual(t?.filter,n?.filter)&&r===i}_getPayloadRecords(e){let t={new:{},old:{}};return(e.type===`INSERT`||e.type===`UPDATE`)&&(t.new=_e(e.columns,e.record)),(e.type===`UPDATE`||e.type===`DELETE`)&&(t.old=_e(e.columns,e.old_record)),t}},ft=class{constructor(e,t){this.socket=new We(e,t)}get timeout(){return this.socket.timeout}get endPoint(){return this.socket.endPoint}get transport(){return this.socket.transport}get heartbeatIntervalMs(){return this.socket.heartbeatIntervalMs}get heartbeatCallback(){return this.socket.heartbeatCallback}set heartbeatCallback(e){this.socket.heartbeatCallback=e}get heartbeatTimer(){return this.socket.heartbeatTimer}get pendingHeartbeatRef(){return this.socket.pendingHeartbeatRef}get reconnectTimer(){return this.socket.reconnectTimer}get vsn(){return this.socket.vsn}get encode(){return this.socket.encode}get decode(){return this.socket.decode}get reconnectAfterMs(){return this.socket.reconnectAfterMs}get sendBuffer(){return this.socket.sendBuffer}get stateChangeCallbacks(){return this.socket.stateChangeCallbacks}connect(){this.socket.connect()}disconnect(e,t,n,r=1e4){return new Promise(i=>{setTimeout(()=>i(`timeout`),r),this.socket.disconnect(()=>{e(),i(`ok`)},t,n)})}push(e){this.socket.push(e)}log(e,t,n){this.socket.log(e,t,n)}hasLogger(){return this.socket.hasLogger()}makeRef(){return this.socket.makeRef()}onOpen(e){this.socket.onOpen(e)}onClose(e){this.socket.onClose(e)}onError(e){this.socket.onError(e)}onMessage(e){this.socket.onMessage(e)}isConnected(){return this.socket.isConnected()}isConnecting(){return this.socket.connectionState()==he.connecting}isDisconnecting(){return this.socket.connectionState()==he.closing}connectionState(){return this.socket.connectionState()}endPointURL(){return this.socket.endPointURL()}sendHeartbeat(){this.socket.sendHeartbeat()}getSocket(){return this.socket}};let pt={HEARTBEAT_INTERVAL:25e3,RECONNECT_DELAY:10,HEARTBEAT_TIMEOUT_FALLBACK:100},mt=[1e3,2e3,5e3,1e4];function ht(){let e=new Map;return{get length(){return e.size},clear(){e.clear()},getItem(t){return e.has(t)?e.get(t):null},key(t){return Array.from(e.keys())[t]??null},removeItem(t){e.delete(t)},setItem(t,n){e.set(t,String(n))}}}function gt(){try{if(typeof globalThis<`u`&&globalThis.sessionStorage)return globalThis.sessionStorage}catch{}return ht()}var _t=class{get endPoint(){return this.socketAdapter.endPoint}get timeout(){return this.socketAdapter.timeout}get transport(){return this.socketAdapter.transport}get heartbeatCallback(){return this.socketAdapter.heartbeatCallback}get heartbeatIntervalMs(){return this.socketAdapter.heartbeatIntervalMs}get heartbeatTimer(){return this.worker?this._workerHeartbeatTimer:this.socketAdapter.heartbeatTimer}get pendingHeartbeatRef(){return this.worker?this._pendingWorkerHeartbeatRef:this.socketAdapter.pendingHeartbeatRef}get reconnectTimer(){return this.socketAdapter.reconnectTimer}get vsn(){return this.socketAdapter.vsn}get encode(){return this.socketAdapter.encode}get decode(){return this.socketAdapter.decode}get reconnectAfterMs(){return this.socketAdapter.reconnectAfterMs}get sendBuffer(){return this.socketAdapter.sendBuffer}get stateChangeCallbacks(){return this.socketAdapter.stateChangeCallbacks}constructor(e,t){if(this.channels=[],this.accessTokenValue=null,this.accessToken=null,this.apiKey=null,this.httpEndpoint=``,this.headers={},this.params={},this.ref=0,this.serializer=new ge,this._manuallySetToken=!1,this._authPromise=null,this._authGeneration=0,this._workerHeartbeatTimer=void 0,this._pendingWorkerHeartbeatRef=null,this._pendingDisconnectTimer=null,this._disconnectOnEmptyChannelsAfterMs=0,this._resolveFetch=e=>e?(...t)=>e(...t):(...e)=>fetch(...e),!t?.params?.apikey)throw Error(`API key is required to connect to Realtime`);this.apiKey=t.params.apikey,this.socketAdapter=new ft(e,this._initializeOptions(t)),this.httpEndpoint=Ee(e),this.fetch=this._resolveFetch(t?.fetch)}connect(){if(!(this.isConnecting()||this.isDisconnecting()||this.isConnected())){this.accessToken&&!this._authPromise&&this._setAuthSafely(`connect`),this._setupConnectionHandlers();try{this.socketAdapter.connect()}catch(e){let t=e.message;throw Error(`WebSocket not available: ${t}`)}this._handleNodeJsRaceCondition()}}endpointURL(){return this.socketAdapter.endPointURL()}async disconnect(e,t){return this._cancelPendingDisconnect(),this.isDisconnecting()?`ok`:await this.socketAdapter.disconnect(()=>{clearInterval(this._workerHeartbeatTimer),this._terminateWorker()},e,t)}getChannels(){return this.channels}async removeChannel(e){let t=await e.unsubscribe();return t===`ok`&&e.teardown(),t}async removeAllChannels(){let e=this.channels.map(async e=>{let t=await e.unsubscribe();return e.teardown(),t}),t=await Promise.all(e);return await this.disconnect(),t}log(e,t,n){this.socketAdapter.log(e,t,n)}hasLogger(){return this.socketAdapter.hasLogger()}connectionState(){return this.socketAdapter.connectionState()||he.closed}isConnected(){return this.socketAdapter.isConnected()}isConnecting(){return this.socketAdapter.isConnecting()}isDisconnecting(){return this.socketAdapter.isDisconnecting()}channel(e,t={config:{}}){let n=`realtime:${e}`,r=this.getChannels().find(e=>e.topic===n);if(r)return r;{let n=new dt(`realtime:${e}`,t,this);return this._cancelPendingDisconnect(),this.channels.push(n),n}}push(e){this.socketAdapter.push(e)}async setAuth(e=null){let t=++this._authGeneration,n=this._performAuth(e,t);t===this._authGeneration&&(this._authPromise=n);try{await n}finally{this._authPromise===n&&(this._authPromise=null)}}_isManualToken(){return this._manuallySetToken}async sendHeartbeat(){this.socketAdapter.sendHeartbeat()}onHeartbeat(e){this.socketAdapter.heartbeatCallback=this._wrapHeartbeatCallback(e)}_makeRef(){return this.socketAdapter.makeRef()}_remove(e){this.channels=this.channels.filter(t=>t.topic!==e.topic),this.channels.length===0&&(this.log(`transport`,`no channels remaining, scheduling disconnect`),this._schedulePendingDisconnect())}_schedulePendingDisconnect(){if(this._cancelPendingDisconnect(),this._disconnectOnEmptyChannelsAfterMs===0){this.log(`transport`,`disconnecting immediately - no channels`),this.disconnect();return}this._pendingDisconnectTimer=setTimeout(()=>{this._pendingDisconnectTimer=null,this.channels.length===0&&(this.log(`transport`,`deferred disconnect fired - no channels, disconnecting`),this.disconnect())},this._disconnectOnEmptyChannelsAfterMs),this.log(`transport`,`deferred disconnect scheduled in ${this._disconnectOnEmptyChannelsAfterMs}ms`)}_cancelPendingDisconnect(){this._pendingDisconnectTimer!==null&&(this.log(`transport`,`pending disconnect cancelled - channel activity detected`),clearTimeout(this._pendingDisconnectTimer),this._pendingDisconnectTimer=null)}async _performAuth(e,t){let n,r=!1;if(e)n=e,r=!0;else if(this.accessToken)try{n=await this.accessToken()}catch(e){this.log(`error`,`Error fetching access token from callback`,e),n=this.accessTokenValue}else n=this.accessTokenValue;t===this._authGeneration&&(this.accessToken?this._manuallySetToken=!1:r&&(this._manuallySetToken=!0),this.accessTokenValue!=n&&(this.accessTokenValue=n,this.channels.forEach(e=>{let t={access_token:n,version:`realtime-js/2.118.0`};e.updateJoinPayload(t),e.joinedOnce&&e.channelAdapter.isJoined()&&e.channelAdapter.push(me.access_token,{access_token:n})})))}async _waitForAuthIfNeeded(){this._authPromise&&await this._authPromise}_setAuthSafely(e=`general`){this._isManualToken()||this.setAuth().catch(t=>{this.log(`error`,`Error setting auth in ${e}`,t)})}_setupConnectionHandlers(){this.socketAdapter.onOpen(()=>{(this._authPromise||(this.accessToken&&!this.accessTokenValue?this.setAuth():Promise.resolve())).catch(e=>{this.log(`error`,`error waiting for auth on connect`,e)}),this.worker&&!this.workerRef&&this._startWorkerHeartbeat()}),this.socketAdapter.onClose(()=>{this.worker&&this.workerRef&&this._terminateWorker()}),this.socketAdapter.onMessage(e=>{e.ref&&e.ref===this._pendingWorkerHeartbeatRef&&(this._pendingWorkerHeartbeatRef=null)})}_handleNodeJsRaceCondition(){this.socketAdapter.isConnected()&&this.socketAdapter.getSocket().onConnOpen()}_wrapHeartbeatCallback(e){return(t,n)=>{t!==`disconnected`&&(t==`sent`&&this._setAuthSafely(),e&&e(t,n))}}_startWorkerHeartbeat(){this.workerUrl?this.log(`worker`,`starting worker for from ${this.workerUrl}`):this.log(`worker`,`starting default worker`);let e=this._workerObjectUrl(this.workerUrl);this.workerRef=new Worker(e),this.workerRef.onerror=e=>{this.log(`worker`,`worker error`,e.message),this._terminateWorker(),this.disconnect()},this.workerRef.onmessage=e=>{e.data.event===`keepAlive`&&this.sendHeartbeat()},this.workerRef.postMessage({event:`start`,interval:this.heartbeatIntervalMs})}_terminateWorker(){this.workerRef&&=(this.log(`worker`,`terminating worker`),this.workerRef.terminate(),void 0)}_workerObjectUrl(e){let t;if(e)t=e;else{let e=new Blob([`
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`],{type:`application/javascript`});t=URL.createObjectURL(e)}return t}_initializeOptions(e){this.worker=e?.worker??!1,this.accessToken=e?.accessToken??null;let t={};t.timeout=e?.timeout??1e4,t.heartbeatIntervalMs=e?.heartbeatIntervalMs??pt.HEARTBEAT_INTERVAL,this._disconnectOnEmptyChannelsAfterMs=e?.disconnectOnEmptyChannelsAfterMs??2*(e?.heartbeatIntervalMs??pt.HEARTBEAT_INTERVAL),t.transport=e?.transport??pe.getWebSocketConstructor(),t.params=e?.params,t.logger=e?.logger,t.heartbeatCallback=this._wrapHeartbeatCallback(e?.heartbeatCallback),t.sessionStorage=e?.sessionStorage??gt(),t.reconnectAfterMs=e?.reconnectAfterMs??(e=>mt[e-1]||1e4);let n,r,i=e?.vsn??`2.0.0`;switch(i){case`1.0.0`:n=(e,t)=>t(JSON.stringify(e)),r=(e,t)=>t(JSON.parse(e));break;case`2.0.0`:n=this.serializer.encode.bind(this.serializer),r=this.serializer.decode.bind(this.serializer);break;default:throw Error(`Unsupported serializer version: ${t.vsn}`)}if(t.vsn=i,t.encode=e?.encode??n,t.decode=e?.decode??r,t.beforeReconnect=this._reconnectAuth.bind(this),(e?.logLevel||e?.log_level)&&(this.logLevel=e.logLevel||e.log_level,t.params=Object.assign(Object.assign({},t.params),{log_level:this.logLevel})),this.worker){if(typeof window<`u`&&!window.Worker)throw Error(`Web Worker is not supported`);this.workerUrl=e?.workerUrl,t.autoSendHeartbeat=!this.worker}return t}async _reconnectAuth(){await this._waitForAuthIfNeeded(),this.isConnected()||this.connect()}},vt=class extends Error{constructor(e,t){super(e),this.name=`IcebergError`,this.status=t.status,this.icebergType=t.icebergType,this.icebergCode=t.icebergCode,this.details=t.details,this.isCommitStateUnknown=t.icebergType===`CommitStateUnknownException`||[500,502,504].includes(t.status)&&t.icebergType?.includes(`CommitState`)===!0}isNotFound(){return this.status===404}isConflict(){return this.status===409}isAuthenticationTimeout(){return this.status===419}};function yt(e,t,n){let r=new URL(t,e);if(n)for(let[e,t]of Object.entries(n))t!==void 0&&r.searchParams.set(e,t);return r.toString()}async function bt(e){return!e||e.type===`none`?{}:e.type===`bearer`?{Authorization:`Bearer ${e.token}`}:e.type===`header`?{[e.name]:e.value}:e.type===`custom`?await e.getHeaders():{}}function xt(e){let t=e.fetchImpl??globalThis.fetch;return{async request({method:n,path:r,query:i,body:a,headers:o}){let s=yt(e.baseUrl,r,i),c=await bt(e.auth),l=await t(s,{method:n,headers:{...a?{"Content-Type":`application/json`}:{},...c,...o},body:a?JSON.stringify(a):void 0}),u=await l.text(),d=(l.headers.get(`content-type`)||``).includes(`application/json`),f=d&&u?JSON.parse(u):u;if(!l.ok){let e=d?f:void 0,t=e?.error;throw new vt(t?.message??`Request failed with status ${l.status}`,{status:l.status,icebergType:t?.type,icebergCode:t?.code,details:e})}return{status:l.status,headers:l.headers,data:f}}}}function St(e){return e.join(``)}var Ct=class{constructor(e,t=``){this.client=e,this.prefix=t}async listNamespaces(e){let t=e?{parent:St(e.namespace)}:void 0;return(await this.client.request({method:`GET`,path:`${this.prefix}/namespaces`,query:t})).data.namespaces.map(e=>({namespace:e}))}async createNamespace(e,t){let n={namespace:e.namespace,properties:t?.properties};return(await this.client.request({method:`POST`,path:`${this.prefix}/namespaces`,body:n})).data}async dropNamespace(e){await this.client.request({method:`DELETE`,path:`${this.prefix}/namespaces/${St(e.namespace)}`})}async loadNamespaceMetadata(e){return{properties:(await this.client.request({method:`GET`,path:`${this.prefix}/namespaces/${St(e.namespace)}`})).data.properties}}async namespaceExists(e){try{return await this.client.request({method:`HEAD`,path:`${this.prefix}/namespaces/${St(e.namespace)}`}),!0}catch(e){if(e instanceof vt&&e.status===404)return!1;throw e}}async createNamespaceIfNotExists(e,t){try{return await this.createNamespace(e,t)}catch(e){if(e instanceof vt&&e.status===409)return;throw e}}};function wt(e){return e.join(``)}var Tt=class{constructor(e,t=``,n){this.client=e,this.prefix=t,this.accessDelegation=n}async listTables(e){return(await this.client.request({method:`GET`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables`})).data.identifiers}async createTable(e,t){let n={};return this.accessDelegation&&(n[`X-Iceberg-Access-Delegation`]=this.accessDelegation),(await this.client.request({method:`POST`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables`,body:t,headers:n})).data.metadata}async updateTable(e,t){let n=await this.client.request({method:`POST`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables/${e.name}`,body:t});return{"metadata-location":n.data[`metadata-location`],metadata:n.data.metadata}}async dropTable(e,t){await this.client.request({method:`DELETE`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables/${e.name}`,query:{purgeRequested:String(t?.purge??!1)}})}async loadTable(e){let t={};return this.accessDelegation&&(t[`X-Iceberg-Access-Delegation`]=this.accessDelegation),(await this.client.request({method:`GET`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables/${e.name}`,headers:t})).data.metadata}async tableExists(e){let t={};this.accessDelegation&&(t[`X-Iceberg-Access-Delegation`]=this.accessDelegation);try{return await this.client.request({method:`HEAD`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables/${e.name}`,headers:t}),!0}catch(e){if(e instanceof vt&&e.status===404)return!1;throw e}}async createTableIfNotExists(e,t){try{return await this.createTable(e,t)}catch(n){if(n instanceof vt&&n.status===409)return await this.loadTable({namespace:e.namespace,name:t.name});throw n}}},Et=class{constructor(e){let t=`v1`;e.catalogName&&(t+=`/${e.catalogName}`),this.client=xt({baseUrl:e.baseUrl.endsWith(`/`)?e.baseUrl:`${e.baseUrl}/`,auth:e.auth,fetchImpl:e.fetch}),this.accessDelegation=e.accessDelegation?.join(`,`),this.namespaceOps=new Ct(this.client,t),this.tableOps=new Tt(this.client,t,this.accessDelegation)}async listNamespaces(e){return this.namespaceOps.listNamespaces(e)}async createNamespace(e,t){return this.namespaceOps.createNamespace(e,t)}async dropNamespace(e){await this.namespaceOps.dropNamespace(e)}async loadNamespaceMetadata(e){return this.namespaceOps.loadNamespaceMetadata(e)}async listTables(e){return this.tableOps.listTables(e)}async createTable(e,t){return this.tableOps.createTable(e,t)}async updateTable(e,t){return this.tableOps.updateTable(e,t)}async dropTable(e,t){await this.tableOps.dropTable(e,t)}async loadTable(e){return this.tableOps.loadTable(e)}async namespaceExists(e){return this.namespaceOps.namespaceExists(e)}async tableExists(e){return this.tableOps.tableExists(e)}async createNamespaceIfNotExists(e,t){return this.namespaceOps.createNamespaceIfNotExists(e,t)}async createTableIfNotExists(e,t){return this.tableOps.createTableIfNotExists(e,t)}};function Dt(e){"@babel/helpers - typeof";return Dt=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},Dt(e)}function Ot(e,t){if(Dt(e)!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||`default`);if(Dt(r)!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}function kt(e){var t=Ot(e,`string`);return Dt(t)==`symbol`?t:t+``}function At(e,t,n){return(t=kt(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function jt(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable})),n.push.apply(n,r)}return n}function D(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]==null?{}:arguments[t];t%2?jt(Object(n),!0).forEach(function(t){At(e,t,n[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):jt(Object(n)).forEach(function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))})}return e}var Mt=class extends Error{constructor(e,t=`storage`,n,r){super(e),this.__isStorageError=!0,this.namespace=t,this.name=t===`vectors`?`StorageVectorsError`:`StorageError`,this.status=n,this.statusCode=r}toJSON(){return{name:this.name,message:this.message,status:this.status,statusCode:this.statusCode}}};function Nt(e){return typeof e==`object`&&!!e&&`__isStorageError`in e}var Pt=class extends Mt{constructor(e,t,n,r=`storage`,i){super(e,r,t,n),this.name=r===`vectors`?`StorageVectorsApiError`:`StorageApiError`,this.status=t,this.statusCode=n,this.code=i}toJSON(){return D(D({},super.toJSON()),{},{code:this.code})}},Ft=class extends Mt{constructor(e,t,n=`storage`){super(e,n),this.name=n===`vectors`?`StorageVectorsUnknownError`:`StorageUnknownError`,this.originalError=t}};function It(e,t,n){let r=D({},e),i=t.toLowerCase();for(let e of Object.keys(r))e.toLowerCase()===i&&delete r[e];return r[i]=n,r}function Lt(e){let t={};for(let[n,r]of Object.entries(e))t[n.toLowerCase()]=r;return t}let Rt=e=>e?(...t)=>e(...t):(...e)=>fetch(...e),zt=e=>{if(typeof e!=`object`||!e)return!1;let t=Object.getPrototypeOf(e);return(t===null||t===Object.prototype||Object.getPrototypeOf(t)===null)&&!(Symbol.toStringTag in e)&&!(Symbol.iterator in e)},Bt=e=>{if(Array.isArray(e))return e.map(e=>Bt(e));if(typeof e==`function`||e!==Object(e))return e;let t={};return Object.entries(e).forEach(([e,n])=>{let r=e.replace(/([-_][a-z])/gi,e=>e.toUpperCase().replace(/[-_]/g,``));t[r]=Bt(n)}),t},Vt=e=>!e||typeof e!=`string`||e.length===0||e.length>100||e.trim()!==e||e.includes(`/`)||e.includes(`\\`)?!1:/^[\w!.\*'() &$@=;:+,?-]+$/.test(e),Ht=e=>e.split(`/`).map(encodeURIComponent).join(`/`),Ut=e=>{if(typeof e==`object`&&e){let t=e;if(typeof t.msg==`string`)return t.msg;if(typeof t.message==`string`)return t.message;if(typeof t.error_description==`string`)return t.error_description;if(typeof t.error==`string`)return t.error;if(typeof t.error==`object`&&t.error!==null){let e=t.error;if(typeof e.message==`string`)return e.message}}return JSON.stringify(e)},Wt=async(e,t,n,r)=>{if(typeof e==`object`&&e&&`json`in e&&typeof e.json==`function`){let n=e,i=parseInt(String(n.status),10);Number.isFinite(i)||(i=500),n.json().then(e=>{let n=e?.statusCode||e?.code||i+``;t(new Pt(Ut(e),i,n,r,e?.code))}).catch(()=>{let e=i+``;t(new Pt(n.statusText||`HTTP ${i} error`,i,e,r))})}else t(new Ft(Ut(e),e,r))},Gt=(e,t,n,r)=>{let i={method:e,headers:t?.headers||{}};if(e===`GET`||e===`HEAD`||!r)return D(D({},i),n);if(zt(r)){let e=t?.headers||{},n;for(let[t,r]of Object.entries(e))t.toLowerCase()===`content-type`&&(n=r);i.headers=It(e,`Content-Type`,n??`application/json`),i.body=JSON.stringify(r)}else i.body=r;return t?.duplex&&(i.duplex=t.duplex),D(D({},i),n)};async function Kt(e,t,n,r,i,a,o){return new Promise((s,c)=>{e(n,Gt(t,r,i,a)).then(e=>{if(!e.ok)throw e;if(r?.noResolveJson)return e;if(o===`vectors`){let t=e.headers.get(`content-type`);if(e.headers.get(`content-length`)===`0`||e.status===204||!t||!t.includes(`application/json`))return{}}return e.json()}).then(e=>s(e)).catch(e=>Wt(e,c,r,o))})}function qt(e=`storage`){return{get:async(t,n,r,i)=>Kt(t,`GET`,n,r,i,void 0,e),post:async(t,n,r,i,a)=>Kt(t,`POST`,n,i,a,r,e),put:async(t,n,r,i,a)=>Kt(t,`PUT`,n,i,a,r,e),head:async(t,n,r,i)=>Kt(t,`HEAD`,n,D(D({},r),{},{noResolveJson:!0}),i,void 0,e),remove:async(t,n,r,i,a)=>Kt(t,`DELETE`,n,i,a,r,e)}}let{get:O,post:k,put:Jt,head:Yt,remove:A}=qt(`storage`),j=qt(`vectors`);var Xt=class{constructor(e,t={},n,r=`storage`){this.shouldThrowOnError=!1,this.url=e,this.headers=Lt(t),this.fetch=Rt(n),this.namespace=r}throwOnError(){return this.shouldThrowOnError=!0,this}setHeader(e,t){return this.headers=It(this.headers,e,t),this}async handleOperation(e){var t=this;try{return{data:await e(),error:null}}catch(e){if(t.shouldThrowOnError)throw e;if(Nt(e))return{data:null,error:e};throw e}}};let Zt;Zt=Symbol.toStringTag;var Qt=class{constructor(e,t){this.downloadFn=e,this.shouldThrowOnError=t,this[Zt]=`StreamDownloadBuilder`,this.promise=null}then(e,t){return this.getPromise().then(e,t)}catch(e){return this.getPromise().catch(e)}finally(e){return this.getPromise().finally(e)}getPromise(){return this.promise||=this.execute(),this.promise}async execute(){var e=this;try{return{data:(await e.downloadFn()).body,error:null}}catch(t){if(e.shouldThrowOnError)throw t;if(Nt(t))return{data:null,error:t};throw t}}};let $t;$t=Symbol.toStringTag;var en=class{constructor(e,t){this.downloadFn=e,this.shouldThrowOnError=t,this[$t]=`BlobDownloadBuilder`,this.promise=null}asStream(){return new Qt(this.downloadFn,this.shouldThrowOnError)}then(e,t){return this.getPromise().then(e,t)}catch(e){return this.getPromise().catch(e)}finally(e){return this.getPromise().finally(e)}getPromise(){return this.promise||=this.execute(),this.promise}async execute(){var e=this;try{return{data:await(await e.downloadFn()).blob(),error:null}}catch(t){if(e.shouldThrowOnError)throw t;if(Nt(t))return{data:null,error:t};throw t}}};let tn={limit:100,offset:0,sortBy:{column:`name`,order:`asc`}},nn={cacheControl:`3600`,contentType:`text/plain;charset=UTF-8`,upsert:!1};var rn=class extends Xt{constructor(e,t={},n,r){super(e,t,r,`storage`),this.bucketId=n}async uploadOrUpdate(e,t,n,r){var i=this;return i.handleOperation(async()=>{let a,o=D(D({},nn),r),s=D(D({},i.headers),e===`POST`&&{"x-upsert":String(o.upsert)}),c=o.metadata;if(typeof Blob<`u`&&n instanceof Blob||typeof FormData<`u`&&n instanceof FormData?a=i.prepareUploadFormData(n,o):(a=n,s[`cache-control`]=`max-age=${o.cacheControl}`,s[`content-type`]=o.contentType,o.contentEncoding&&(s[`content-encoding`]=o.contentEncoding),c&&(s[`x-metadata`]=i.toBase64(i.encodeMetadata(c))),(typeof ReadableStream<`u`&&a instanceof ReadableStream||a&&typeof a==`object`&&`pipe`in a&&typeof a.pipe==`function`)&&!o.duplex&&(o.duplex=`half`)),r?.headers)for(let[e,t]of Object.entries(r.headers))s=It(s,e,t);let l=i._removeEmptyFolders(t),u=i._getFinalPath(l),d=await(e==`PUT`?Jt:k)(i.fetch,`${i.url}/object/${u}`,a,D({headers:s},o?.duplex?{duplex:o.duplex}:{}));return{path:l,id:d.Id,fullPath:d.Key}})}async upload(e,t,n){return this.uploadOrUpdate(`POST`,e,t,n)}async uploadToSignedUrl(e,t,n,r){var i=this;let a=i._removeEmptyFolders(e),o=i._getFinalPath(a),s=new URL(i.url+`/object/upload/sign/${o}`);return s.searchParams.set(`token`,t),i.handleOperation(async()=>{let e,t=D(D({},nn),r),o=D(D({},i.headers),{"x-upsert":String(t.upsert)}),c=t.metadata;if(typeof Blob<`u`&&n instanceof Blob||typeof FormData<`u`&&n instanceof FormData?e=i.prepareUploadFormData(n,t):(e=n,o[`cache-control`]=`max-age=${t.cacheControl}`,o[`content-type`]=t.contentType,t.contentEncoding&&(o[`content-encoding`]=t.contentEncoding),c&&(o[`x-metadata`]=i.toBase64(i.encodeMetadata(c))),(typeof ReadableStream<`u`&&e instanceof ReadableStream||e&&typeof e==`object`&&`pipe`in e&&typeof e.pipe==`function`)&&!t.duplex&&(t.duplex=`half`)),r?.headers)for(let[e,t]of Object.entries(r.headers))o=It(o,e,t);return{path:a,fullPath:(await Jt(i.fetch,s.toString(),e,D({headers:o},t?.duplex?{duplex:t.duplex}:{}))).Key}})}async createSignedUploadUrl(e,t){var n=this;return n.handleOperation(async()=>{let r=n._getFinalPath(e),i=D({},n.headers);t?.upsert&&(i[`x-upsert`]=`true`);let a=await k(n.fetch,`${n.url}/object/upload/sign/${r}`,{},{headers:i}),o=new URL(n.url+a.url),s=o.searchParams.get(`token`);if(!s)throw new Mt(`No token returned by API`);return{signedUrl:o.toString(),path:e,token:s}})}async update(e,t,n){return this.uploadOrUpdate(`PUT`,e,t,n)}async move(e,t,n){var r=this;return r.handleOperation(async()=>await k(r.fetch,`${r.url}/object/move`,{bucketId:r.bucketId,sourceKey:e,destinationKey:t,destinationBucket:n?.destinationBucket,sourceVersionId:n?.sourceVersionId},{headers:r.headers}))}async copy(e,t,n){var r=this;return r.handleOperation(async()=>{let i=n;return{path:(await k(r.fetch,`${r.url}/object/copy`,{bucketId:r.bucketId,sourceKey:e,destinationKey:t,destinationBucket:n?.destinationBucket,sourceVersionId:n?.sourceVersionId,copyMetadata:typeof i?.copyMetadata==`boolean`?i.copyMetadata:void 0,metadata:i?.copyMetadata===!1?i.metadata:void 0},{headers:r.headers})).Key}})}async createSignedUrl(e,t,n){var r=this;return r.handleOperation(async()=>{let i=r._getFinalPath(e),a=typeof n?.transform==`object`&&n.transform!==null&&Object.keys(n.transform).length>0,o=await k(r.fetch,`${r.url}/object/sign/${i}`,D(D({expiresIn:t},a?{transform:n.transform}:{}),n?.versionId==null?{}:{versionId:n.versionId}),{headers:r.headers}),s=new URLSearchParams;n?.download&&s.set(`download`,n.download===!0?``:n.download),n?.cacheNonce!=null&&s.set(`cacheNonce`,String(n.cacheNonce));let c=s.toString();return{signedUrl:encodeURI(`${r.url}${o.signedURL}${c?`&${c}`:``}`)}})}async createSignedUrls(e,t,n){var r=this;return r.handleOperation(async()=>{let i=await k(r.fetch,`${r.url}/object/sign/${r.bucketId}`,{expiresIn:t,paths:e},{headers:r.headers}),a=new URLSearchParams;n?.download&&a.set(`download`,n.download===!0?``:n.download),n?.cacheNonce!=null&&a.set(`cacheNonce`,String(n.cacheNonce));let o=a.toString();return i.map(e=>D(D({},e),{},{signedUrl:e.signedURL?encodeURI(`${r.url}${e.signedURL}${o?`&${o}`:``}`):null}))})}download(e,t,n){let r=typeof t?.transform==`object`&&t.transform!==null&&Object.keys(t.transform).length>0?`render/image/authenticated`:`object`,i=new URLSearchParams;t?.transform&&this.applyTransformOptsToQuery(i,t.transform),t?.cacheNonce!=null&&i.set(`cacheNonce`,String(t.cacheNonce)),t?.versionId!=null&&i.set(`versionId`,String(t.versionId));let a=i.toString(),o=this._getFinalPath(e);return new en(()=>O(this.fetch,`${this.url}/${r}/${o}${a?`?${a}`:``}`,{headers:this.headers,noResolveJson:!0},n),this.shouldThrowOnError)}async info(e,t){var n=this;let r=n._getFinalPath(e),i=new URLSearchParams;t?.versionId!=null&&i.set(`versionId`,String(t.versionId));let a=i.toString();return n.handleOperation(async()=>Bt(await O(n.fetch,`${n.url}/object/info/${r}${a?`?${a}`:``}`,{headers:n.headers})))}async exists(e){var t=this;let n=t._getFinalPath(e);try{return await Yt(t.fetch,`${t.url}/object/${n}`,{headers:t.headers}),{data:!0,error:null}}catch(e){if(t.shouldThrowOnError)throw e;if(Nt(e)){let t=e instanceof Pt?e.status:e instanceof Ft?e.originalError?.status:void 0;if(t!==void 0&&[400,404].includes(t))return{data:!1,error:e}}throw e}}getPublicUrl(e,t){let n=this._getFinalPath(e),r=new URLSearchParams;t?.download&&r.set(`download`,t.download===!0?``:t.download),t?.transform&&this.applyTransformOptsToQuery(r,t.transform),t?.cacheNonce!=null&&r.set(`cacheNonce`,String(t.cacheNonce)),t?.versionId!=null&&r.set(`versionId`,String(t.versionId));let i=r.toString(),a=typeof t?.transform==`object`&&t.transform!==null&&Object.keys(t.transform).length>0?`render/image`:`object`;return{data:{publicUrl:encodeURI(`${this.url}/${a}/public/${n}`)+(i?`?${i}`:``)}}}async remove(e){var t=this;return t.handleOperation(async()=>await A(t.fetch,`${t.url}/object/${t.bucketId}`,{prefixes:e},{headers:t.headers}))}async purgeCache(e,t,n){var r=this;return r.handleOperation(async()=>{let i=Ht(r._getFinalPath(e)),a=new URLSearchParams;t?.transformations&&a.set(`transformations`,`true`);let o=a.toString();return await A(r.fetch,`${r.url}/cdn/${i}${o?`?${o}`:``}`,{},{headers:r.headers},n)})}async list(e,t,n){var r=this;return r.handleOperation(async()=>{let i=t?.sortBy?D(D({},tn.sortBy),t.sortBy):tn.sortBy,a=D(D(D({},tn),t),{},{sortBy:i,prefix:e||``});return await k(r.fetch,`${r.url}/object/list/${r.bucketId}`,a,{headers:r.headers},n)})}async listV2(e,t){var n=this;return n.handleOperation(async()=>{let r=D({},e);return await k(n.fetch,`${n.url}/object/list-v2/${n.bucketId}`,r,{headers:n.headers},t)})}prepareUploadFormData(e,t){let n=new FormData,r=[];e instanceof FormData?e.forEach((e,t)=>{typeof e==`string`?n.append(t,e):r.push([t,e])}):r.push([``,e]),n.has(`cacheControl`)||n.append(`cacheControl`,t.cacheControl),t.metadata&&!n.has(`metadata`)&&n.append(`metadata`,this.encodeMetadata(t.metadata)),t.contentEncoding&&!n.has(`contentEncoding`)&&n.append(`contentEncoding`,t.contentEncoding);for(let[e,t]of r)n.append(e,t);return n}encodeMetadata(e){return JSON.stringify(e)}toBase64(e){return typeof Buffer<`u`?Buffer.from(e).toString(`base64`):btoa(e)}_getFinalPath(e){return`${this.bucketId}/${e.replace(/^\/+/,``)}`}_removeEmptyFolders(e){return e.replace(/^\/|\/$/g,``).replace(/\/+/g,`/`)}applyTransformOptsToQuery(e,t){return t.width&&e.set(`width`,t.width.toString()),t.height&&e.set(`height`,t.height.toString()),t.resize&&e.set(`resize`,t.resize),t.format&&e.set(`format`,t.format),t.quality&&e.set(`quality`,t.quality.toString()),e}};let an={"X-Client-Info":`storage-js/2.118.0`};var on=class extends Xt{constructor(e,t={},n,r){let i=new URL(e);r?.useNewHostname&&/supabase\.(co|in|red)$/.test(i.hostname)&&!i.hostname.includes(`storage.supabase.`)&&(i.hostname=i.hostname.replace(`supabase.`,`storage.supabase.`));let a=i.href.replace(/\/$/,``),o=D(D({},an),t);super(a,o,n,`storage`)}async listBuckets(e){var t=this;return t.handleOperation(async()=>{let n=t.listBucketOptionsToQueryString(e);return await O(t.fetch,`${t.url}/bucket${n}`,{headers:t.headers})})}async getBucket(e){var t=this;return t.handleOperation(async()=>await O(t.fetch,`${t.url}/bucket/${e}`,{headers:t.headers}))}async createBucket(e,t={public:!1}){var n=this;return n.handleOperation(async()=>await k(n.fetch,`${n.url}/bucket`,{id:e,name:e,type:t.type,public:t.public,file_size_limit:t.fileSizeLimit,allowed_mime_types:t.allowedMimeTypes,versioning_status:t.versioningStatus},{headers:n.headers}))}async updateBucket(e,t){var n=this;return n.handleOperation(async()=>await Jt(n.fetch,`${n.url}/bucket/${e}`,{id:e,name:e,public:t.public,file_size_limit:t.fileSizeLimit,allowed_mime_types:t.allowedMimeTypes,versioning_status:t.versioningStatus},{headers:n.headers}))}async emptyBucket(e){var t=this;return t.handleOperation(async()=>await k(t.fetch,`${t.url}/bucket/${e}/empty`,{},{headers:t.headers}))}async deleteBucket(e){var t=this;return t.handleOperation(async()=>await A(t.fetch,`${t.url}/bucket/${e}`,{},{headers:t.headers}))}async getBucketLifecycle(e){var t=this;return t.handleOperation(async()=>await O(t.fetch,t.bucketLifecycleUrl(e),{headers:t.headers}))}async updateBucketLifecycle(e,t){var n=this;return n.handleOperation(async()=>await Jt(n.fetch,n.bucketLifecycleUrl(e),t,{headers:n.headers}))}async deleteBucketLifecycle(e){var t=this;return t.handleOperation(async()=>await A(t.fetch,t.bucketLifecycleUrl(e),{},{headers:t.headers}))}async purgeBucketCache(e,t,n){var r=this;return r.handleOperation(async()=>{let i=new URLSearchParams;t?.transformations&&i.set(`transformations`,`true`);let a=i.toString();return await A(r.fetch,`${r.url}/cdn/${Ht(e)}${a?`?${a}`:``}`,{},{headers:r.headers},n)})}bucketLifecycleUrl(e){return`${this.url}/bucket/${Ht(e)}/lifecycle`}listBucketOptionsToQueryString(e){let t={};return e&&(`limit`in e&&(t.limit=String(e.limit)),`offset`in e&&(t.offset=String(e.offset)),e.search&&(t.search=e.search),e.sortColumn&&(t.sortColumn=e.sortColumn),e.sortOrder&&(t.sortOrder=e.sortOrder)),Object.keys(t).length>0?`?`+new URLSearchParams(t).toString():``}},sn=class extends Xt{constructor(e,t={},n){let r=e.replace(/\/$/,``),i=D(D({},an),t);super(r,i,n,`storage`)}async createBucket(e){var t=this;return t.handleOperation(async()=>await k(t.fetch,`${t.url}/bucket`,{name:e},{headers:t.headers}))}async listBuckets(e){var t=this;return t.handleOperation(async()=>{let n=new URLSearchParams;e?.limit!==void 0&&n.set(`limit`,e.limit.toString()),e?.offset!==void 0&&n.set(`offset`,e.offset.toString()),e?.sortColumn&&n.set(`sortColumn`,e.sortColumn),e?.sortOrder&&n.set(`sortOrder`,e.sortOrder),e?.search&&n.set(`search`,e.search);let r=n.toString(),i=r?`${t.url}/bucket?${r}`:`${t.url}/bucket`;return await O(t.fetch,i,{headers:t.headers})})}async deleteBucket(e){var t=this;return t.handleOperation(async()=>await A(t.fetch,`${t.url}/bucket/${e}`,{},{headers:t.headers}))}from(e){var t=this;if(!Vt(e))throw new Mt(`Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.`);let n=new Et({baseUrl:this.url,catalogName:e,auth:{type:`custom`,getHeaders:async()=>t.headers},fetch:this.fetch}),r=this.shouldThrowOnError;return new Proxy(n,{get(e,t){let n=e[t];return typeof n==`function`?async(...t)=>{try{return{data:await n.apply(e,t),error:null}}catch(e){if(r)throw e;return{data:null,error:e}}}:n}})}},cn=class extends Xt{constructor(e,t={},n){let r=e.replace(/\/$/,``),i=D(D({},an),{},{"Content-Type":`application/json`},t);super(r,i,n,`vectors`)}async createIndex(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/CreateIndex`,e,{headers:t.headers})||{})}async getIndex(e,t){var n=this;return n.handleOperation(async()=>await j.post(n.fetch,`${n.url}/GetIndex`,{vectorBucketName:e,indexName:t},{headers:n.headers}))}async listIndexes(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/ListIndexes`,e,{headers:t.headers}))}async deleteIndex(e,t){var n=this;return n.handleOperation(async()=>await j.post(n.fetch,`${n.url}/DeleteIndex`,{vectorBucketName:e,indexName:t},{headers:n.headers})||{})}},ln=class extends Xt{constructor(e,t={},n){let r=e.replace(/\/$/,``),i=D(D({},an),{},{"Content-Type":`application/json`},t);super(r,i,n,`vectors`)}async putVectors(e){var t=this;if(e.vectors.length<1||e.vectors.length>500)throw Error(`Vector batch size must be between 1 and 500 items`);return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/PutVectors`,e,{headers:t.headers})||{})}async getVectors(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/GetVectors`,e,{headers:t.headers}))}async listVectors(e){var t=this;if(e.segmentCount!==void 0){if(e.segmentCount<1||e.segmentCount>16)throw Error(`segmentCount must be between 1 and 16`);if(e.segmentIndex!==void 0&&(e.segmentIndex<0||e.segmentIndex>=e.segmentCount))throw Error(`segmentIndex must be between 0 and ${e.segmentCount-1}`)}return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/ListVectors`,e,{headers:t.headers}))}async queryVectors(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/QueryVectors`,e,{headers:t.headers}))}async deleteVectors(e){var t=this;if(e.keys.length<1||e.keys.length>500)throw Error(`Keys batch size must be between 1 and 500 items`);return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/DeleteVectors`,e,{headers:t.headers})||{})}},un=class extends Xt{constructor(e,t={},n){let r=e.replace(/\/$/,``),i=D(D({},an),{},{"Content-Type":`application/json`},t);super(r,i,n,`vectors`)}async createBucket(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/CreateVectorBucket`,{vectorBucketName:e},{headers:t.headers})||{})}async getBucket(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/GetVectorBucket`,{vectorBucketName:e},{headers:t.headers}))}async listBuckets(e={}){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/ListVectorBuckets`,e,{headers:t.headers}))}async deleteBucket(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/DeleteVectorBucket`,{vectorBucketName:e},{headers:t.headers})||{})}},dn=class extends un{constructor(e,t={}){super(e,t.headers||{},t.fetch)}from(e){return new fn(this.url,this.headers,e,this.fetch)}async createBucket(e){var t=()=>super.createBucket,n=this;return t().call(n,e)}async getBucket(e){var t=()=>super.getBucket,n=this;return t().call(n,e)}async listBuckets(e={}){var t=()=>super.listBuckets,n=this;return t().call(n,e)}async deleteBucket(e){var t=()=>super.deleteBucket,n=this;return t().call(n,e)}},fn=class extends cn{constructor(e,t,n,r){super(e,t,r),this.vectorBucketName=n}async createIndex(e){var t=()=>super.createIndex,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName}))}async listIndexes(e={}){var t=()=>super.listIndexes,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName}))}async getIndex(e){var t=()=>super.getIndex,n=this;return t().call(n,n.vectorBucketName,e)}async deleteIndex(e){var t=()=>super.deleteIndex,n=this;return t().call(n,n.vectorBucketName,e)}index(e){return new pn(this.url,this.headers,this.vectorBucketName,e,this.fetch)}},pn=class extends ln{constructor(e,t,n,r,i){super(e,t,i),this.vectorBucketName=n,this.indexName=r}async putVectors(e){var t=()=>super.putVectors,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName,indexName:n.indexName}))}async getVectors(e){var t=()=>super.getVectors,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName,indexName:n.indexName}))}async listVectors(e={}){var t=()=>super.listVectors,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName,indexName:n.indexName}))}async queryVectors(e){var t=()=>super.queryVectors,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName,indexName:n.indexName}))}async deleteVectors(e){var t=()=>super.deleteVectors,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName,indexName:n.indexName}))}},mn=class extends on{constructor(e,t={},n,r){super(e,t,n,r)}from(e){return new rn(this.url,this.headers,e,this.fetch)}get vectors(){return new dn(this.url+`/vector`,{headers:this.headers,fetch:this.fetch})}get analytics(){return new sn(this.url+`/iceberg`,this.headers,this.fetch)}};let hn=``,gn;typeof Deno<`u`?(hn=`deno`,gn=Deno.version?.deno):typeof document<`u`?hn=`web`:typeof navigator<`u`&&navigator.product===`ReactNative`?hn=`react-native`:(hn=`node`,gn=globalThis.process?.version?.replace(/^v/,``));let _n=[`runtime=${hn}`];gn&&_n.push(`runtime-version=${gn}`);let vn={headers:{"X-Client-Info":`supabase-js/2.118.0; ${_n.join(`; `)}`}},yn={schema:`public`},bn={autoRefreshToken:!0,persistSession:!0,detectSessionInUrl:!0,flowType:`implicit`},xn={},Sn={enabled:!1,respectSamplingDecision:!0};function Cn(e){if(!e||typeof e!=`string`)return null;let t=e.split(`-`);if(t.length!==4)return null;let[n,r,i,a]=t;if(n.length!==2||r.length!==32||i.length!==16||a.length!==2)return null;let o=/^[0-9a-f]+$/i;return!o.test(n)||!o.test(r)||!o.test(i)||!o.test(a)||r===`00000000000000000000000000000000`||i===`0000000000000000`?null:{version:n,traceId:r,parentId:i,traceFlags:a,isSampled:(parseInt(a,16)&1)==1}}function wn(e,t){if(!e||!t||t.length===0)return!1;let n;if(e instanceof URL)n=e;else try{n=new URL(e)}catch{return!1}for(let e of t)try{if(typeof e==`string`){if(Tn(n.hostname,e))return!0}else if(e instanceof RegExp){if(e.test(n.hostname))return!0}else if(typeof e==`function`&&e(n))return!0}catch{continue}return!1}function Tn(e,t){if(t===e)return!0;if(t.startsWith(`*.`)){let n=t.slice(2);if(e.endsWith(n)&&(e===n||e.endsWith(`.`+n)))return!0}return!1}function En(e){let t=[];try{let n=new URL(e);t.push(n.hostname)}catch{}return t.push(`*.supabase.co`,`*.supabase.in`),t.push(`localhost`,`127.0.0.1`,`[::1]`),t}let Dn=Symbol.for(`@supabase/supabase-js.traceContextExtractor`);function On(){return globalThis[Dn]}let kn=e=>e?(...t)=>e(...t):(...e)=>fetch(...e),An=()=>Headers,jn=e=>e.startsWith(`sb_publishable_`)||e.startsWith(`sb_secret_`),Mn=new Set,Nn=e=>{if(!e.startsWith(`sb_`)||jn(e)||e.startsWith(`sb_temp_`))return;let t=e.match(/^sb_[a-zA-Z0-9]+_/)?.[0]??`unknown`;Mn.has(t)||(Mn.add(t),console.warn(`@supabase/supabase-js: Unrecognized Supabase API key format. The client will proceed and send this key as-is; if you see authentication errors you may need to upgrade @supabase/supabase-js to a version that recognizes this key type.`))},Pn=(e,t,n,r,i,a)=>{let o=kn(r),s=An(),c=i?.enabled===!0,l=i?.respectSamplingDecision!==!1,u=c?En(t):null,d=!(a?.omitApiKeyAsBearer&&jn(e));return async(t,r)=>{let i=await n(),a=new s(r?.headers);if(a.has(`apikey`)||a.set(`apikey`,e),!a.has(`Authorization`)){let t=i??(d?e:null);t&&a.set(`Authorization`,`Bearer ${t}`)}if(u){let e=Ln(t,u,l);e&&(e.traceparent&&!a.has(`traceparent`)&&a.set(`traceparent`,e.traceparent),e.tracestate&&!a.has(`tracestate`)&&a.set(`tracestate`,e.tracestate),e.baggage&&!a.has(`baggage`)&&a.set(`baggage`,e.baggage))}return o(t,{...r,headers:a})}},Fn=!1,In=!1;function Ln(e,t,n){let r=On();if(!r)return Fn||(Fn=!0,console.warn("@supabase/supabase-js: tracePropagation is enabled but the tracing runtime is not loaded, so trace headers will not be attached. Add `import '@supabase/supabase-js/tracing'` at your application entry point (requires the OpenTelemetry API package to be installed). The CDN/UMD build does not support trace propagation.")),null;if(!wn(typeof e==`string`||e instanceof URL?e:e.url,t))return null;let i=r();if(!i||!i.traceparent){if(i?.carrierKeys?.length&&!In){In=!0;let e=i.carrierKeys.includes(`sentry-trace`)?" Sentry detected: set `propagateTraceparent: true` in Sentry.init() to emit it.":` Configure your tracing SDK to emit W3C trace context on outgoing requests.`;console.warn(`@supabase/supabase-js: tracePropagation is enabled and a tracing SDK is active, but its propagator wrote [${i.carrierKeys.join(`, `)}] and no W3C traceparent header, so trace headers will not be attached.`+e)}return null}if(n){let e=Cn(i.traceparent);if(e&&!e.isSampled)return{traceparent:i.traceparent}}return i}function Rn(e){return typeof e==`boolean`?{enabled:e}:e}function zn(e){return e.endsWith(`/`)?e:e+`/`}let Bn=!1;function Vn(e){Bn||typeof e!=`object`||!e||!(`schema`in e)||e.schema===void 0||(Bn=!0,console.warn(`@supabase/supabase-js: The "schema" option must be nested under "db", e.g. createClient(url, key, { db: { schema: 'myschema' } }). A top-level "schema" is ignored and queries go to the default schema.`))}function Hn(e,t){let{db:n,auth:r,realtime:i,global:a}=e,{db:o,auth:s,realtime:c,global:l}=t,u=Rn(e.tracePropagation),d=Rn(t.tracePropagation),f={db:{...o,...n},auth:{...s,...r},realtime:{...c,...i},storage:{},global:{...l,...a,headers:{...l?.headers??{},...a?.headers??{}}},tracePropagation:{enabled:u?.enabled??d?.enabled??!1,respectSamplingDecision:u?.respectSamplingDecision??d?.respectSamplingDecision??!0},accessToken:async()=>``};return e.accessToken?f.accessToken=e.accessToken:delete f.accessToken,f}function Un(e){let t=e?.trim();if(!t)throw Error(`supabaseUrl is required.`);if(!t.match(/^https?:\/\//i))throw Error(`Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.`);try{return new URL(zn(t))}catch{throw Error(`Invalid supabaseUrl: Provided URL is malformed.`)}}let Wn=`2.118.0`,M=30*1e3,Gn=3*M;2*M;let Kn={"X-Client-Info":`gotrue-js/${Wn}`},qn=`X-Supabase-Api-Version`,Jn={"2024-01-01":{timestamp:Date.parse(`2024-01-01T00:00:00.0Z`),name:`2024-01-01`}},Yn=/^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i,N=`sb_flow_id`;var Xn=class extends Error{constructor(e,t,n){super(e),this.__isAuthError=!0,this.name=`AuthError`,this.status=t,this.code=n}toJSON(){return{name:this.name,message:this.message,status:this.status,code:this.code}}};function P(e){return typeof e==`object`&&!!e&&`__isAuthError`in e}var Zn=class extends Xn{constructor(e,t,n){super(e,t,n),this.name=`AuthApiError`,this.status=t,this.code=n}};function Qn(e){return P(e)&&e.name===`AuthApiError`}var F=class extends Xn{constructor(e,t){super(e),this.name=`AuthUnknownError`,this.originalError=t}},I=class extends Xn{constructor(e,t,n,r){super(e,n,r),this.name=t,this.status=n}},L=class extends I{constructor(){super(`Auth session missing!`,`AuthSessionMissingError`,400,void 0)}};function $n(e){return P(e)&&e.name===`AuthSessionMissingError`}var R=class extends I{constructor(){super(`Auth session or user missing`,`AuthInvalidTokenResponseError`,500,void 0)}},er=class extends I{constructor(e){super(e,`AuthInvalidCredentialsError`,400,void 0)}},tr=class extends I{constructor(e,t=null){super(e,`AuthImplicitGrantRedirectError`,500,void 0),this.details=null,this.details=t}toJSON(){return Object.assign(Object.assign({},super.toJSON()),{details:this.details})}};function nr(e){return P(e)&&e.name===`AuthImplicitGrantRedirectError`}var rr=class extends I{constructor(e,t=null){super(e,`AuthPKCEGrantCodeExchangeError`,500,void 0),this.details=null,this.details=t}toJSON(){return Object.assign(Object.assign({},super.toJSON()),{details:this.details})}},ir=class extends I{constructor(){super(`PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.`,`AuthPKCECodeVerifierMissingError`,400,`pkce_code_verifier_not_found`)}};function ar(e){return P(e)&&e.name===`AuthPKCECodeVerifierMissingError`}var or=class extends I{constructor(e,t){super(e,`AuthRetryableFetchError`,t,void 0)}};function sr(e){return P(e)&&e.name===`AuthRetryableFetchError`}var cr=class extends I{constructor(e=`Refresh result discarded: session state changed mid-flight (e.g., concurrent signOut)`){super(e,`AuthRefreshDiscardedError`,409,void 0)}};function lr(e){return P(e)&&e.name===`AuthRefreshDiscardedError`}var ur=class extends I{constructor(e,t,n){super(e,`AuthWeakPasswordError`,t,`weak_password`),this.reasons=n}toJSON(){return Object.assign(Object.assign({},super.toJSON()),{reasons:this.reasons})}};function dr(e){return P(e)&&e.name===`AuthWeakPasswordError`}var fr=class extends I{constructor(e){super(e,`AuthInvalidJwtError`,400,`invalid_jwt`)}};let pr=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`.split(``),mr=` 	
\r=`.split(``),hr=(()=>{let e=Array(128);for(let t=0;t<e.length;t+=1)e[t]=-1;for(let t=0;t<mr.length;t+=1)e[mr[t].charCodeAt(0)]=-2;for(let t=0;t<pr.length;t+=1)e[pr[t].charCodeAt(0)]=t;return e})();function gr(e,t,n){if(e!==null)for(t.queue=t.queue<<8|e,t.queuedBits+=8;t.queuedBits>=6;)n(pr[t.queue>>t.queuedBits-6&63]),t.queuedBits-=6;else if(t.queuedBits>0)for(t.queue<<=6-t.queuedBits,t.queuedBits=6;t.queuedBits>=6;)n(pr[t.queue>>t.queuedBits-6&63]),t.queuedBits-=6}function _r(e,t,n){let r=hr[e];if(r>-1)for(t.queue=t.queue<<6|r,t.queuedBits+=6;t.queuedBits>=8;)n(t.queue>>t.queuedBits-8&255),t.queuedBits-=8;else if(r===-2)return;else throw Error(`Invalid Base64-URL character "${String.fromCharCode(e)}"`)}function vr(e){let t=[],n=e=>{t.push(String.fromCodePoint(e))},r={utf8seq:0,codepoint:0},i={queue:0,queuedBits:0},a=e=>{xr(e,r,n)};for(let t=0;t<e.length;t+=1)_r(e.charCodeAt(t),i,a);return t.join(``)}function yr(e,t){if(e<=127){t(e);return}else if(e<=2047){t(192|e>>6),t(128|e&63);return}else if(e<=65535){t(224|e>>12),t(128|e>>6&63),t(128|e&63);return}else if(e<=1114111){t(240|e>>18),t(128|e>>12&63),t(128|e>>6&63),t(128|e&63);return}throw Error(`Unrecognized Unicode codepoint: ${e.toString(16)}`)}function br(e,t){for(let n=0;n<e.length;n+=1){let r=e.charCodeAt(n);if(r>55295&&r<=56319){let t=(r-55296)*1024&65535;r=(e.charCodeAt(n+1)-56320&65535|t)+65536,n+=1}yr(r,t)}}function xr(e,t,n){if(t.utf8seq===0){if(e<=127){n(e);return}for(let n=1;n<6;n+=1)if(!(e>>7-n&1)){t.utf8seq=n;break}if(t.utf8seq===2)t.codepoint=e&31;else if(t.utf8seq===3)t.codepoint=e&15;else if(t.utf8seq===4)t.codepoint=e&7;else throw Error(`Invalid UTF-8 sequence`);--t.utf8seq}else if(t.utf8seq>0){if(e<=127)throw Error(`Invalid UTF-8 sequence`);t.codepoint=t.codepoint<<6|e&63,--t.utf8seq,t.utf8seq===0&&n(t.codepoint)}}function Sr(e){let t=[],n={queue:0,queuedBits:0},r=e=>{t.push(e)};for(let t=0;t<e.length;t+=1)_r(e.charCodeAt(t),n,r);return new Uint8Array(t)}function Cr(e){let t=[];return br(e,e=>t.push(e)),new Uint8Array(t)}function z(e){let t=[],n={queue:0,queuedBits:0},r=e=>{t.push(e)};return e.forEach(e=>gr(e,n,r)),gr(null,n,r),t.join(``)}function wr(e){return Math.round(Date.now()/1e3)+e}function Tr(){return Symbol(`auth-callback`)}let B=()=>typeof window<`u`&&typeof document<`u`,V={tested:!1,writable:!1},Er=()=>{if(!B())return!1;try{if(typeof globalThis.localStorage!=`object`)return!1}catch{return!1}if(V.tested)return V.writable;let e=`lswt-${Math.random()}${Math.random()}`;try{globalThis.localStorage.setItem(e,e),globalThis.localStorage.removeItem(e),V.tested=!0,V.writable=!0}catch{V.tested=!0,V.writable=!1}return V.writable};function Dr(e){let t={},n=new URL(e);if(n.hash&&n.hash[0]===`#`)try{new URLSearchParams(n.hash.substring(1)).forEach((e,n)=>{t[n]=e})}catch{}return n.searchParams.forEach((e,n)=>{t[n]=e}),t}let Or=e=>e?(...t)=>e(...t):(...e)=>fetch(...e),kr=e=>typeof e==`object`&&!!e&&`status`in e&&`ok`in e&&`json`in e&&typeof e.json==`function`,H=async(e,t,n)=>{await e.setItem(t,JSON.stringify(n))},U=async(e,t)=>{let n=await e.getItem(t);if(!n)return null;try{return JSON.parse(n)}catch{return null}},W=async(e,t)=>{await e.removeItem(t)};var Ar=class e{constructor(){this.promise=new e.promiseConstructor((e,t)=>{this.resolve=e,this.reject=t})}};Ar.promiseConstructor=Promise;function jr(e){let t=e.split(`.`);if(t.length!==3)throw new fr(`Invalid JWT structure`);for(let e=0;e<t.length;e++)if(!Yn.test(t[e]))throw new fr(`JWT not in base64url format`);return{header:JSON.parse(vr(t[0])),payload:JSON.parse(vr(t[1])),signature:Sr(t[2]),raw:{header:t[0],payload:t[1]}}}async function Mr(e){return await new Promise(t=>{setTimeout(()=>t(null),e)})}function Nr(e,t){return new Promise((n,r)=>{(async()=>{for(let i=0;i<1/0;i++)try{let r=await e(i);if(!t(i,null,r)){n(r);return}}catch(e){if(!t(i,e)){r(e);return}}})()})}function Pr(e){return(`0`+e.toString(16)).substr(-2)}function Fr(){let e=new Uint32Array(56);if(typeof crypto>`u`){let e=``;for(let t=0;t<56;t++)e+=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~`.charAt(Math.floor(Math.random()*66));return e}return crypto.getRandomValues(e),Array.from(e,Pr).join(``)}async function Ir(e){let t=new TextEncoder().encode(e),n=await crypto.subtle.digest(`SHA-256`,t),r=new Uint8Array(n);return Array.from(r).map(e=>String.fromCharCode(e)).join(``)}async function Lr(e){if(!(typeof crypto<`u`&&crypto.subtle!==void 0&&typeof TextEncoder<`u`))return console.warn(`WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.`),e;let t=await Ir(e);return btoa(t).replace(/\+/g,`-`).replace(/\//g,`_`).replace(/=+$/,``)}let Rr=/^[a-zA-Z0-9_-]{8,64}$/;function zr(e){return typeof e==`string`&&Rr.test(e)?e:null}function Br(){if(typeof crypto<`u`&&typeof crypto.getRandomValues==`function`){let e=new Uint8Array(16);return crypto.getRandomValues(e),Array.from(e,Pr).join(``)}let e=``;for(let t=0;t<32;t++)e+=Math.floor(Math.random()*16).toString(16);return e}let Vr=(e,t)=>`${e}-flow-${t}-code-verifier`,Hr=e=>`${e}-flows-code-verifier`;async function Ur(e,t){let n=await U(e,Hr(t));return Array.isArray(n)?n.filter(e=>zr(e)!==null):[]}async function Wr(e,t,n,r,i){await H(e,Vr(t,n),r);let a=(await Ur(e,t)).filter(e=>e!==n);for(a.push(n);a.length>5;){let n=a.shift();await W(e,Vr(t,n)),i?.(n)}await H(e,Hr(t),a),await H(e,`${t}-code-verifier`,r)}async function Gr(e,t,n){if(n){let r=await U(e,Vr(t,n));return{verifier:typeof r==`string`?r:null,flowId:n}}let r=await U(e,`${t}-code-verifier`);return{verifier:typeof r==`string`?r:null,flowId:null}}async function G(e,t,n){let r=`${t}-code-verifier`;if(!n){await W(e,r);return}let i=Vr(t,n),a=await U(e,i);await W(e,i);let o=await Ur(e,t),s=o.filter(e=>e!==n);s.length!==o.length&&(s.length>0?await H(e,Hr(t),s):await W(e,Hr(t))),a!=null&&a===await U(e,r)&&await W(e,r)}async function Kr(e,t){let n=await Ur(e,t);for(let r of n)await W(e,Vr(t,r));await W(e,Hr(t)),await W(e,`${t}-code-verifier`)}function qr(e,t){let n=e.indexOf(`#`),r=n===-1?e:e.slice(0,n),i=n===-1?``:e.slice(n),a=r.indexOf(`?`);if(a!==-1){let e=r.slice(0,a),t=r.slice(a+1).split(`&`).filter(e=>e!==``&&e!==N&&!e.startsWith(`${N}=`));r=t.length>0?`${e}?${t.join(`&`)}`:e}let o=r.includes(`?`)?`&`:`?`;return`${r}${o}${N}=${encodeURIComponent(t)}${i}`}async function Jr(e,t,n=!1,r){let i=Fr(),a=i;n&&(a+=`/recovery`);let o=Br();await Wr(e,t,o,a,r);let s=await Lr(i);return[s,i===s?`plain`:`s256`,o]}let Yr=/^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;function Xr(e){let t=e.headers.get(qn);if(!t||!t.match(Yr))return null;try{return new Date(`${t}T00:00:00.0Z`)}catch{return null}}function Zr(e){if(!e)throw Error(`Missing exp claim`);if(e<=Math.floor(Date.now()/1e3))throw Error(`JWT has expired`)}function Qr(e){switch(e){case`RS256`:return{name:`RSASSA-PKCS1-v1_5`,hash:{name:`SHA-256`}};case`ES256`:return{name:`ECDSA`,namedCurve:`P-256`,hash:{name:`SHA-256`}};default:throw Error(`Invalid alg claim`)}}let $r=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;function K(e){if(!$r.test(e))throw Error(`@supabase/auth-js: Expected parameter to be UUID but is not`)}function ei(e){if(!e.recoveryCodes)throw Error("@supabase/auth-js: the MFA recovery codes API is experimental and disabled by default. Enable it by passing `auth: { experimental: { recoveryCodes: true } }` to createClient (or to the GoTrueClient constructor).")}function ti(){return new Proxy({},{get:(e,t)=>{if(t===`__isUserNotAvailableProxy`)return!0;if(typeof t==`symbol`){let e=t.toString();if(e===`Symbol(Symbol.toPrimitive)`||e===`Symbol(Symbol.toStringTag)`||e===`Symbol(util.inspect.custom)`)return}throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${t}" property of the session object is not supported. Please use getUser() instead.`)},set:(e,t)=>{throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${t}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`)},deleteProperty:(e,t)=>{throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${t}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`)}})}function ni(e,t){return new Proxy(e,{get:(e,n,r)=>{if(n===`__isInsecureUserWarningProxy`)return!0;if(typeof n==`symbol`){let t=n.toString();if(t===`Symbol(Symbol.toPrimitive)`||t===`Symbol(Symbol.toStringTag)`||t===`Symbol(util.inspect.custom)`||t===`Symbol(nodejs.util.inspect.custom)`)return Reflect.get(e,n,r)}return!t.value&&typeof n==`string`&&(console.warn(`Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server.`),t.value=!0),Reflect.get(e,n,r)}})}function ri(e){return JSON.parse(JSON.stringify(e))}let q=e=>{if(typeof e==`object`&&e){let t=e;if(typeof t.msg==`string`)return t.msg;if(typeof t.message==`string`)return t.message;if(typeof t.error_description==`string`)return t.error_description;if(typeof t.error==`string`)return t.error}return JSON.stringify(e)},ii=[500,501,502,503,504,520,521,522,523,524,525,526,527,528,529,530];async function ai(e){if(!kr(e))throw new or(q(e),0);let t;try{t=await e.json()}catch(t){throw ii.includes(e.status)?new or(e.statusText||`HTTP ${e.status}`,e.status):new F(q(t),t)}if(ii.includes(e.status))throw new or(q(t),e.status);let n,r=Xr(e);if(r&&r.getTime()>=Jn[`2024-01-01`].timestamp&&typeof t==`object`&&t&&typeof t.code==`string`?n=t.code:typeof t==`object`&&t&&typeof t.error_code==`string`&&(n=t.error_code),n){if(n===`weak_password`)throw new ur(q(t),e.status,t.weak_password?.reasons||[]);if(n===`session_not_found`)throw new L}else if(typeof t==`object`&&t&&typeof t.weak_password==`object`&&t.weak_password&&Array.isArray(t.weak_password.reasons)&&t.weak_password.reasons.length&&t.weak_password.reasons.reduce((e,t)=>e&&typeof t==`string`,!0))throw new ur(q(t),e.status,t.weak_password.reasons);throw new Zn(q(t),e.status||500,n)}let oi=(e,t,n,r)=>{let i={method:e,headers:t?.headers||{}};return e===`GET`?i:(i.headers=Object.assign({"Content-Type":`application/json;charset=UTF-8`},t?.headers),i.body=JSON.stringify(r),Object.assign(Object.assign({},i),n))};async function J(e,t,n,r){let i=Object.assign({},r?.headers);i[qn]||(i[qn]=Jn[`2024-01-01`].name),r?.jwt&&(i.Authorization=`Bearer ${r.jwt}`);let a=r?.query??{};r?.redirectTo&&(a.redirect_to=r.redirectTo);let o=await si(e,t,n+(Object.keys(a).length?`?`+new URLSearchParams(a).toString():``),{headers:i,noResolveJson:r?.noResolveJson},{},r?.body);return r?.xform?r?.xform(o):{data:Object.assign({},o),error:null}}async function si(e,t,n,r,i,a){let o=oi(t,r,i,a),s;try{s=await e(n,Object.assign({},o))}catch(e){throw new or(q(e),0)}if(s.ok||await ai(s),r?.noResolveJson)return s;try{return await s.json()}catch(e){await ai(e)}}function Y(e){let t=null;fi(e)&&(t=Object.assign({},e),e.expires_at||(t.expires_at=wr(e.expires_in)));let n=e.user??(typeof e?.id==`string`?e:null);return{data:{session:t,user:n},error:null}}function ci(e){let t=Y(e);return!t.error&&e.weak_password&&typeof e.weak_password==`object`&&Array.isArray(e.weak_password.reasons)&&e.weak_password.reasons.length&&e.weak_password.message&&typeof e.weak_password.message==`string`&&e.weak_password.reasons.reduce((e,t)=>e&&typeof t==`string`,!0)&&(t.data.weak_password=e.weak_password),t}function X(e){return{data:{user:e.user??e},error:null}}function li(e){return{data:e,error:null}}function ui(e){let{action_link:n,email_otp:r,hashed_token:i,redirect_to:a,verification_type:o}=e,s=t(e,[`action_link`,`email_otp`,`hashed_token`,`redirect_to`,`verification_type`]);return{data:{properties:{action_link:n,email_otp:r,hashed_token:i,redirect_to:a,verification_type:o},user:Object.assign({},s)},error:null}}function di(e){return e}function fi(e){return!!e.access_token&&!!e.refresh_token&&!!e.expires_in}let pi=[`global`,`local`,`others`];var mi=class{constructor({url:e=``,headers:t={},fetch:n,experimental:r}){this.url=e,this.headers=t,this.fetch=Or(n),this.experimental=r??{},this.mfa={listFactors:this._listFactors.bind(this),deleteFactor:this._deleteFactor.bind(this)},this.oauth={listClients:this._listOAuthClients.bind(this),createClient:this._createOAuthClient.bind(this),getClient:this._getOAuthClient.bind(this),updateClient:this._updateOAuthClient.bind(this),deleteClient:this._deleteOAuthClient.bind(this),regenerateClientSecret:this._regenerateOAuthClientSecret.bind(this)},this.customProviders={listProviders:this._listCustomProviders.bind(this),createProvider:this._createCustomProvider.bind(this),getProvider:this._getCustomProvider.bind(this),updateProvider:this._updateCustomProvider.bind(this),deleteProvider:this._deleteCustomProvider.bind(this)},this.passkey={listPasskeys:this._adminListPasskeys.bind(this),deletePasskey:this._adminDeletePasskey.bind(this)}}async signOut(e,t=pi[0]){if(pi.indexOf(t)<0)throw Error(`@supabase/auth-js: Parameter scope must be one of ${pi.join(`, `)}`);try{return await J(this.fetch,`POST`,`${this.url}/logout?scope=${t}`,{headers:this.headers,jwt:e,noResolveJson:!0}),{data:null,error:null}}catch(e){if(P(e))return{data:null,error:e};throw e}}async inviteUserByEmail(e,t={}){try{return await J(this.fetch,`POST`,`${this.url}/invite`,{body:{email:e,data:t.data},headers:this.headers,redirectTo:t.redirectTo,xform:X})}catch(e){if(P(e))return{data:{user:null},error:e};throw e}}async generateLink(e){try{let{options:n}=e,r=t(e,[`options`]),i=Object.assign(Object.assign({},r),n);return`newEmail`in r&&(i.new_email=r?.newEmail,delete i.newEmail),await J(this.fetch,`POST`,`${this.url}/admin/generate_link`,{body:i,headers:this.headers,xform:ui,redirectTo:n?.redirectTo})}catch(e){if(P(e))return{data:{properties:null,user:null},error:e};throw e}}async createUser(e){try{return await J(this.fetch,`POST`,`${this.url}/admin/users`,{body:e,headers:this.headers,xform:X})}catch(e){if(P(e))return{data:{user:null},error:e};throw e}}async listUsers(e){try{let t={nextPage:null,lastPage:0,total:0},n=await J(this.fetch,`GET`,`${this.url}/admin/users`,{headers:this.headers,noResolveJson:!0,query:{page:(e?.page)?.toString()??``,per_page:(e?.perPage)?.toString()??``},xform:di});if(n.error)throw n.error;let r=await n.json(),i=n.headers.get(`x-total-count`)??0,a=n.headers.get(`link`)?.split(`,`)??[];return a.length>0&&(a.forEach(e=>{let n=parseInt(e.split(`;`)[0].split(`=`)[1].substring(0,1)),r=JSON.parse(e.split(`;`)[1].split(`=`)[1]);t[`${r}Page`]=n}),t.total=parseInt(i)),{data:Object.assign(Object.assign({},r),t),error:null}}catch(e){if(P(e))return{data:{users:[]},error:e};throw e}}async getUserById(e){K(e);try{return await J(this.fetch,`GET`,`${this.url}/admin/users/${e}`,{headers:this.headers,xform:X})}catch(e){if(P(e))return{data:{user:null},error:e};throw e}}async updateUserById(e,t){K(e);try{return await J(this.fetch,`PUT`,`${this.url}/admin/users/${e}`,{body:t,headers:this.headers,xform:X})}catch(e){if(P(e))return{data:{user:null},error:e};throw e}}async deleteUser(e,t=!1){K(e);try{return await J(this.fetch,`DELETE`,`${this.url}/admin/users/${e}`,{headers:this.headers,body:{should_soft_delete:t},xform:X})}catch(e){if(P(e))return{data:{user:null},error:e};throw e}}async _listFactors(e){K(e.userId);try{let{data:t,error:n}=await J(this.fetch,`GET`,`${this.url}/admin/users/${e.userId}/factors`,{headers:this.headers,xform:e=>({data:{factors:e},error:null})});return{data:t,error:n}}catch(e){if(P(e))return{data:null,error:e};throw e}}async _deleteFactor(e){K(e.userId),K(e.id);try{return{data:await J(this.fetch,`DELETE`,`${this.url}/admin/users/${e.userId}/factors/${e.id}`,{headers:this.headers}),error:null}}catch(e){if(P(e))return{data:null,error:e};throw e}}async _listOAuthClients(e){try{let t={nextPage:null,lastPage:0,total:0},n=await J(this.fetch,`GET`,`${this.url}/admin/oauth/clients`,{headers:this.headers,noResolveJson:!0,query:{page:(e?.page)?.toString()??``,per_page:(e?.perPage)?.toString()??``},xform:di});if(n.error)throw n.error;let r=await n.json(),i=n.headers.get(`x-total-count`)??0,a=n.headers.get(`link`)?.split(`,`)??[];return a.length>0&&(a.forEach(e=>{let n=parseInt(e.split(`;`)[0].split(`=`)[1].substring(0,1)),r=JSON.parse(e.split(`;`)[1].split(`=`)[1]);t[`${r}Page`]=n}),t.total=parseInt(i)),{data:Object.assign(Object.assign({},r),t),error:null}}catch(e){if(P(e))return{data:{clients:[]},error:e};throw e}}async _createOAuthClient(e){try{return await J(this.fetch,`POST`,`${this.url}/admin/oauth/clients`,{body:e,headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _getOAuthClient(e){try{return await J(this.fetch,`GET`,`${this.url}/admin/oauth/clients/${e}`,{headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _updateOAuthClient(e,t){try{return await J(this.fetch,`PUT`,`${this.url}/admin/oauth/clients/${e}`,{body:t,headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _deleteOAuthClient(e){try{return await J(this.fetch,`DELETE`,`${this.url}/admin/oauth/clients/${e}`,{headers:this.headers,noResolveJson:!0}),{data:null,error:null}}catch(e){if(P(e))return{data:null,error:e};throw e}}async _regenerateOAuthClientSecret(e){try{return await J(this.fetch,`POST`,`${this.url}/admin/oauth/clients/${e}/regenerate_secret`,{headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _listCustomProviders(e){try{let t={};return e?.type&&(t.type=e.type),await J(this.fetch,`GET`,`${this.url}/admin/custom-providers`,{headers:this.headers,query:t,xform:e=>({data:{providers:e?.providers??[]},error:null})})}catch(e){if(P(e))return{data:{providers:[]},error:e};throw e}}async _createCustomProvider(e){try{return await J(this.fetch,`POST`,`${this.url}/admin/custom-providers`,{body:e,headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _getCustomProvider(e){try{return await J(this.fetch,`GET`,`${this.url}/admin/custom-providers/${e}`,{headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _updateCustomProvider(e,t){try{return await J(this.fetch,`PUT`,`${this.url}/admin/custom-providers/${e}`,{body:t,headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _deleteCustomProvider(e){try{return await J(this.fetch,`DELETE`,`${this.url}/admin/custom-providers/${e}`,{headers:this.headers,noResolveJson:!0}),{data:null,error:null}}catch(e){if(P(e))return{data:null,error:e};throw e}}async _adminListPasskeys(e){K(e.userId);try{return await J(this.fetch,`GET`,`${this.url}/admin/users/${e.userId}/passkeys`,{headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _adminDeletePasskey(e){K(e.userId),K(e.passkeyId);try{return await J(this.fetch,`DELETE`,`${this.url}/admin/users/${e.userId}/passkeys/${e.passkeyId}`,{headers:this.headers,noResolveJson:!0}),{data:null,error:null}}catch(e){if(P(e))return{data:null,error:e};throw e}}};function hi(e={}){return{getItem:t=>e[t]||null,setItem:(t,n)=>{e[t]=n},removeItem:t=>{delete e[t]}}}let Z={debug:!!(globalThis&&Er()&&globalThis.localStorage&&globalThis.localStorage.getItem(`supabase.gotrue-js.locks.debug`)===`true`)};var gi=class extends Error{constructor(e){super(e),this.isAcquireTimeout=!0}},_i=class extends gi{},vi=class extends gi{};async function yi(e,t,n){Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: acquire lock`,e,t);let r=new globalThis.AbortController,i;t>0&&(i=setTimeout(()=>{r.abort(),Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock acquire timed out`,e)},t)),await Promise.resolve();try{return await globalThis.navigator.locks.request(e,t===0?{mode:`exclusive`,ifAvailable:!0}:{mode:`exclusive`,signal:r.signal},async r=>{if(r){clearTimeout(i),Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: acquired`,e,r.name);try{return await n()}finally{Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: released`,e,r.name)}}else if(t===0)throw Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: not immediately available`,e),new _i(`Acquiring an exclusive Navigator LockManager lock "${e}" immediately failed`);else{if(Z.debug)try{let e=await globalThis.navigator.locks.query();console.log(`@supabase/gotrue-js: Navigator LockManager state`,JSON.stringify(e,null,`  `))}catch(e){console.warn(`@supabase/gotrue-js: Error when querying Navigator LockManager state`,e)}return console.warn(`@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request`),clearTimeout(i),await n()}})}catch(a){if(clearTimeout(i),typeof a==`object`&&a&&`name`in a&&a.name===`AbortError`){if(r.signal.aborted)return Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: acquire timeout, recovering by stealing lock`,e),console.warn(`@supabase/gotrue-js: Lock "${e}" was not released within ${t}ms. This may indicate an orphaned lock from a component unmount (e.g., React Strict Mode). Forcefully acquiring the lock to recover.`),await Promise.resolve().then(()=>globalThis.navigator.locks.request(e,{mode:`exclusive`,steal:!0},async t=>{if(t){Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: recovered (stolen)`,e,t.name);try{return await n()}finally{Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: released (stolen)`,e,t.name)}}else return console.warn(`@supabase/gotrue-js: Navigator LockManager returned null lock even with steal: true`),await n()}));throw Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: lock was stolen by another request`,e),new _i(`Lock "${e}" was released because another request stole it`)}throw a}}let bi={};async function xi(e,t,n){let r=bi[e]??Promise.resolve(),i=(async()=>{try{return await r,null}catch{return null}})(),a=(async()=>{let r=null;try{let n=t>=0?new Promise((n,i)=>{r=setTimeout(()=>{console.warn(`@supabase/gotrue-js: Lock "${e}" acquisition timed out after ${t}ms. This may be caused by another operation holding the lock. Consider increasing lockAcquireTimeout or checking for stuck operations.`),i(new vi(`Acquiring process lock with name "${e}" timed out`))},t)}):null;await Promise.race([i,n].filter(e=>e)),r!==null&&clearTimeout(r)}catch(e){if(r!==null&&clearTimeout(r),e instanceof gi)throw e}return await n()})();return bi[e]=(async()=>{try{return await a}catch(e){if(e instanceof gi){try{await r}catch{}return null}throw e}})(),await a}function Si(){if(typeof globalThis!=`object`)try{Object.defineProperty(Object.prototype,`__magic__`,{get:function(){return this},configurable:!0}),__magic__.globalThis=__magic__,delete Object.prototype.__magic__}catch{typeof self<`u`&&(self.globalThis=self)}}function Ci(e){if(!/^0x[a-fA-F0-9]{40}$/.test(e))throw Error(`@supabase/auth-js: Address "${e}" is invalid.`);return e.toLowerCase()}function wi(e){return parseInt(e,16)}function Ti(e){let t=new TextEncoder().encode(e);return`0x`+Array.from(t,e=>e.toString(16).padStart(2,`0`)).join(``)}function Ei(e){let{chainId:t,domain:n,expirationTime:r,issuedAt:i=new Date,nonce:a,notBefore:o,requestId:s,resources:c,scheme:l,uri:u,version:d}=e;if(!Number.isInteger(t))throw Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${t}`);if(!n)throw Error(`@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.`);if(a&&a.length<8)throw Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${a}`);if(!u)throw Error(`@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.`);if(d!==`1`)throw Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${d}`);if(e.statement?.includes(`
`))throw Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${e.statement}`);let f=Ci(e.address),p=`${l?`${l}://${n}`:n} wants you to sign in with your Ethereum account:\n${f}\n\n${e.statement?`${e.statement}\n`:``}`,m=`URI: ${u}\nVersion: ${d}\nChain ID: ${t}${a?`\nNonce: ${a}`:``}\nIssued At: ${i.toISOString()}`;if(r&&(m+=`\nExpiration Time: ${r.toISOString()}`),o&&(m+=`\nNot Before: ${o.toISOString()}`),s&&(m+=`\nRequest ID: ${s}`),c){let e=`
Resources:`;for(let t of c){if(!t||typeof t!=`string`)throw Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${t}`);e+=`\n- ${t}`}m+=e}return`${p}\n${m}`}var Q=class extends Error{constructor({message:e,code:t,cause:n,name:r}){super(e,{cause:n}),this.__isWebAuthnError=!0,this.name=r??(n instanceof Error?n.name:void 0)??`Unknown Error`,this.code=t}toJSON(){return{name:this.name,message:this.message,code:this.code}}},Di=class extends Q{constructor(e,t){super({code:`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`,cause:t,message:e}),this.name=`WebAuthnUnknownError`,this.originalError=t}};function Oi({error:e,options:t}){let{publicKey:n}=t;if(!n)throw Error(`options was missing required publicKey property`);if(e.name===`AbortError`){if(t.signal instanceof AbortSignal)return new Q({message:`Registration ceremony was sent an abort signal`,code:`ERROR_CEREMONY_ABORTED`,cause:e})}else if(e.name===`ConstraintError`){if(n.authenticatorSelection?.requireResidentKey===!0)return new Q({message:`Discoverable credentials were required but no available authenticator supported it`,code:`ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT`,cause:e});if(t.mediation===`conditional`&&n.authenticatorSelection?.userVerification===`required`)return new Q({message:`User verification was required during automatic registration but it could not be performed`,code:`ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE`,cause:e});if(n.authenticatorSelection?.userVerification===`required`)return new Q({message:`User verification was required but no available authenticator supported it`,code:`ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT`,cause:e})}else if(e.name===`InvalidStateError`)return new Q({message:`The authenticator was previously registered`,code:`ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED`,cause:e});else if(e.name===`NotAllowedError`)return new Q({message:e.message,code:`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`,cause:e});else if(e.name===`NotSupportedError`)return n.pubKeyCredParams.filter(e=>e.type===`public-key`).length===0?new Q({message:`No entry in pubKeyCredParams was of type "public-key"`,code:`ERROR_MALFORMED_PUBKEYCREDPARAMS`,cause:e}):new Q({message:`No available authenticator supported any of the specified pubKeyCredParams algorithms`,code:`ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG`,cause:e});else if(e.name===`SecurityError`){let t=window.location.hostname;if(Fi(t)){if(n.rp.id!==t)return new Q({message:`The RP ID "${n.rp.id}" is invalid for this domain`,code:`ERROR_INVALID_RP_ID`,cause:e})}else return new Q({message:`${window.location.hostname} is an invalid domain`,code:`ERROR_INVALID_DOMAIN`,cause:e})}else if(e.name===`TypeError`){if(n.user.id.byteLength<1||n.user.id.byteLength>64)return new Q({message:`User ID was not between 1 and 64 characters`,code:`ERROR_INVALID_USER_ID_LENGTH`,cause:e})}else if(e.name===`UnknownError`)return new Q({message:`The authenticator was unable to process the specified options, or could not create a new credential`,code:`ERROR_AUTHENTICATOR_GENERAL_ERROR`,cause:e});return new Q({message:`a Non-Webauthn related error has occurred`,code:`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`,cause:e})}function ki({error:e,options:t}){let{publicKey:n}=t;if(!n)throw Error(`options was missing required publicKey property`);if(e.name===`AbortError`){if(t.signal instanceof AbortSignal)return new Q({message:`Authentication ceremony was sent an abort signal`,code:`ERROR_CEREMONY_ABORTED`,cause:e})}else if(e.name===`NotAllowedError`)return new Q({message:e.message,code:`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`,cause:e});else if(e.name===`SecurityError`){let t=window.location.hostname;if(Fi(t)){if(n.rpId!==t)return new Q({message:`The RP ID "${n.rpId}" is invalid for this domain`,code:`ERROR_INVALID_RP_ID`,cause:e})}else return new Q({message:`${window.location.hostname} is an invalid domain`,code:`ERROR_INVALID_DOMAIN`,cause:e})}else if(e.name===`UnknownError`)return new Q({message:`The authenticator was unable to process the specified options, or could not create a new assertion signature`,code:`ERROR_AUTHENTICATOR_GENERAL_ERROR`,cause:e});return new Q({message:`a Non-Webauthn related error has occurred`,code:`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`,cause:e})}let Ai=new class{createNewAbortSignal(){if(this.controller){let e=Error(`Cancelling existing WebAuthn API call for new one`);e.name=`AbortError`,this.controller.abort(e)}let e=new AbortController;return this.controller=e,e.signal}cancelCeremony(){if(this.controller){let e=Error(`Manually cancelling existing WebAuthn API call`);e.name=`AbortError`,this.controller.abort(e),this.controller=void 0}}};function ji(e){if(!e)throw Error(`Credential creation options are required`);if(typeof PublicKeyCredential<`u`&&`parseCreationOptionsFromJSON`in PublicKeyCredential&&typeof PublicKeyCredential.parseCreationOptionsFromJSON==`function`)return PublicKeyCredential.parseCreationOptionsFromJSON(e);let{challenge:n,user:r,excludeCredentials:i}=e,a=t(e,[`challenge`,`user`,`excludeCredentials`]),o=Sr(n).buffer,s=Object.assign(Object.assign({},r),{id:Sr(r.id).buffer}),c=Object.assign(Object.assign({},a),{challenge:o,user:s});if(i&&i.length>0){c.excludeCredentials=Array(i.length);for(let e=0;e<i.length;e++){let t=i[e];c.excludeCredentials[e]=Object.assign(Object.assign({},t),{id:Sr(t.id).buffer,type:t.type||`public-key`,transports:t.transports})}}return c}function Mi(e){if(!e)throw Error(`Credential request options are required`);if(typeof PublicKeyCredential<`u`&&`parseRequestOptionsFromJSON`in PublicKeyCredential&&typeof PublicKeyCredential.parseRequestOptionsFromJSON==`function`)return PublicKeyCredential.parseRequestOptionsFromJSON(e);let{challenge:n,allowCredentials:r}=e,i=t(e,[`challenge`,`allowCredentials`]),a=Sr(n).buffer,o=Object.assign(Object.assign({},i),{challenge:a});if(r&&r.length>0){o.allowCredentials=Array(r.length);for(let e=0;e<r.length;e++){let t=r[e];o.allowCredentials[e]=Object.assign(Object.assign({},t),{id:Sr(t.id).buffer,type:t.type||`public-key`,transports:t.transports})}}return o}function Ni(e){if(`toJSON`in e&&typeof e.toJSON==`function`)return e.toJSON();let t=e;return{id:e.id,rawId:e.id,response:{attestationObject:z(new Uint8Array(e.response.attestationObject)),clientDataJSON:z(new Uint8Array(e.response.clientDataJSON))},type:`public-key`,clientExtensionResults:e.getClientExtensionResults(),authenticatorAttachment:t.authenticatorAttachment??void 0}}function Pi(e){if(`toJSON`in e&&typeof e.toJSON==`function`)return e.toJSON();let t=e,n=e.getClientExtensionResults(),r=e.response;return{id:e.id,rawId:e.id,response:{authenticatorData:z(new Uint8Array(r.authenticatorData)),clientDataJSON:z(new Uint8Array(r.clientDataJSON)),signature:z(new Uint8Array(r.signature)),userHandle:r.userHandle?z(new Uint8Array(r.userHandle)):void 0},type:`public-key`,clientExtensionResults:n,authenticatorAttachment:t.authenticatorAttachment??void 0}}function Fi(e){return e===`localhost`||/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(e)}function Ii(){return!!(B()&&`PublicKeyCredential`in window&&window.PublicKeyCredential&&`credentials`in navigator&&typeof(navigator==null?void 0:navigator.credentials)?.create==`function`&&typeof(navigator==null?void 0:navigator.credentials)?.get==`function`)}async function Li(e){try{let t=await navigator.credentials.create(e);return t?t instanceof PublicKeyCredential?{data:t,error:null}:{data:null,error:new Di(`Browser returned unexpected credential type`,t)}:{data:null,error:new Di(`Empty credential response`,t)}}catch(t){return{data:null,error:Oi({error:t,options:e})}}}async function Ri(e){try{let t=await navigator.credentials.get(e);return t?t instanceof PublicKeyCredential?{data:t,error:null}:{data:null,error:new Di(`Browser returned unexpected credential type`,t)}:{data:null,error:new Di(`Empty credential response`,t)}}catch(t){return{data:null,error:ki({error:t,options:e})}}}let zi={hints:[`security-key`],authenticatorSelection:{authenticatorAttachment:`cross-platform`,requireResidentKey:!1,userVerification:`preferred`,residentKey:`discouraged`},attestation:`direct`},Bi={userVerification:`preferred`,hints:[`security-key`],attestation:`direct`};function Vi(...e){let t=e=>typeof e==`object`&&!!e&&!Array.isArray(e),n=e=>e instanceof ArrayBuffer||ArrayBuffer.isView(e),r={};for(let i of e)if(i)for(let e in i){let a=i[e];if(a!==void 0)if(Array.isArray(a))r[e]=a;else if(n(a))r[e]=a;else if(t(a)){let n=r[e];t(n)?r[e]=Vi(n,a):r[e]=Vi(a)}else r[e]=a}return r}function Hi(e,t){return Vi(zi,e,t||{})}function Ui(e,t){return Vi(Bi,e,t||{})}var Wi=class{constructor(e){this.client=e,this.enroll=this._enroll.bind(this),this.challenge=this._challenge.bind(this),this.verify=this._verify.bind(this),this.authenticate=this._authenticate.bind(this),this.register=this._register.bind(this)}async _enroll(e){return this.client.mfa.enroll(Object.assign(Object.assign({},e),{factorType:`webauthn`}))}async _challenge({factorId:e,webauthn:t,friendlyName:n,signal:r},i){try{let{data:a,error:o}=await this.client.mfa.challenge({factorId:e,webauthn:t});if(!a)return{data:null,error:o};let s=r??Ai.createNewAbortSignal();if(a.webauthn.type===`create`){let{user:e}=a.webauthn.credential_options.publicKey;if(!e.name){let t=n;if(t)e.name=`${e.id}:${t}`;else{let t=(await this.client.getUser()).data.user,n=t?.user_metadata?.name||t?.email||t?.id||`User`;e.name=`${e.id}:${n}`}}e.displayName||=e.name}switch(a.webauthn.type){case`create`:{let{data:t,error:n}=await Li({publicKey:Hi(a.webauthn.credential_options.publicKey,i?.create),signal:s});return t?{data:{factorId:e,challengeId:a.id,webauthn:{type:a.webauthn.type,credential_response:t}},error:null}:{data:null,error:n}}case`request`:{let t=Ui(a.webauthn.credential_options.publicKey,i?.request),{data:n,error:r}=await Ri(Object.assign(Object.assign({},a.webauthn.credential_options),{publicKey:t,signal:s}));return n?{data:{factorId:e,challengeId:a.id,webauthn:{type:a.webauthn.type,credential_response:n}},error:null}:{data:null,error:r}}}}catch(e){return P(e)?{data:null,error:e}:{data:null,error:new F(`Unexpected error in challenge`,e)}}}async _verify({challengeId:e,factorId:t,webauthn:n}){return this.client.mfa.verify({factorId:t,challengeId:e,webauthn:n})}async _authenticate({factorId:e,webauthn:{rpId:t=typeof window<`u`?window.location.hostname:void 0,rpOrigins:n=typeof window<`u`?[window.location.origin]:void 0,signal:r}={}},i){if(!t)return{data:null,error:new Xn(`rpId is required for WebAuthn authentication`)};try{if(!Ii())return{data:null,error:new F(`Browser does not support WebAuthn`,null)};let{data:a,error:o}=await this.challenge({factorId:e,webauthn:{rpId:t,rpOrigins:n},signal:r},{request:i});if(!a)return{data:null,error:o};let{webauthn:s}=a;return this._verify({factorId:e,challengeId:a.challengeId,webauthn:{type:s.type,rpId:t,rpOrigins:n,credential_response:s.credential_response}})}catch(e){return P(e)?{data:null,error:e}:{data:null,error:new F(`Unexpected error in authenticate`,e)}}}async _register({friendlyName:e,webauthn:{rpId:t=typeof window<`u`?window.location.hostname:void 0,rpOrigins:n=typeof window<`u`?[window.location.origin]:void 0,signal:r}={}},i){if(!t)return{data:null,error:new Xn(`rpId is required for WebAuthn registration`)};try{if(!Ii())return{data:null,error:new F(`Browser does not support WebAuthn`,null)};let{data:a,error:o}=await this._enroll({friendlyName:e});if(!a)return await this.client.mfa.listFactors().then(t=>t.data?.all.find(t=>t.factor_type===`webauthn`&&t.friendly_name===e&&t.status===`unverified`)).then(e=>e?this.client.mfa.unenroll({factorId:e?.id}):void 0),{data:null,error:o};let{data:s,error:c}=await this._challenge({factorId:a.id,friendlyName:a.friendly_name,webauthn:{rpId:t,rpOrigins:n},signal:r},{create:i});return s?this._verify({factorId:a.id,challengeId:s.challengeId,webauthn:{rpId:t,rpOrigins:n,type:s.webauthn.type,credential_response:s.webauthn.credential_response}}):{data:null,error:c}}catch(e){return P(e)?{data:null,error:e}:{data:null,error:new F(`Unexpected error in register`,e)}}}};Si();let Gi={url:`http://localhost:9999`,storageKey:`supabase.auth.token`,autoRefreshToken:!0,persistSession:!0,detectSessionInUrl:!0,headers:Kn,flowType:`implicit`,debug:!1,hasCustomAuthorizationHeader:!1,throwOnError:!1,lockAcquireTimeout:5e3,skipAutoInitialize:!1,experimental:{}},$={},Ki=!1;var qi=class e{get jwks(){return $[this.storageKey]?.jwks??{keys:[]}}set jwks(e){$[this.storageKey]=Object.assign(Object.assign({},$[this.storageKey]),{jwks:e})}get jwks_cached_at(){return $[this.storageKey]?.cachedAt??-(2**53-1)}set jwks_cached_at(e){$[this.storageKey]=Object.assign(Object.assign({},$[this.storageKey]),{cachedAt:e})}constructor(t){var n;this.userStorage=null,this.memoryStorage=null,this.stateChangeEmitters=new Map,this.autoRefreshTicker=null,this.autoRefreshTickTimeout=null,this.visibilityChangedCallback=null,this.refreshingDeferred=null,this.lastRefreshFailure=null,this._sessionRemovalEpoch=0,this.initializePromise=null,this._pendingInitNotifications=null,this.detectSessionInUrl=!0,this.hasCustomAuthorizationHeader=!1,this.suppressGetSessionWarning=!1,this.lock=null,this.lockAcquired=!1,this.pendingInLock=[],this.broadcastChannel=null,this.logger=console.log;let r=Object.assign(Object.assign({},Gi),t);if(this.storageKey=r.storageKey,this.instanceID=e.nextInstanceID[this.storageKey]??0,e.nextInstanceID[this.storageKey]=this.instanceID+1,this.logDebugMessages=!!r.debug,typeof r.debug==`function`&&(this.logger=r.debug),this.instanceID>0&&B()){let e=`${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;console.warn(e),this.logDebugMessages&&console.trace(e)}if(this.persistSession=r.persistSession,this.autoRefreshToken=r.autoRefreshToken,this.experimental=r.experimental??{},this.admin=new mi({url:r.url,headers:r.headers,fetch:r.fetch,experimental:this.experimental}),this.url=r.url,this.headers=r.headers,this.fetch=Or(r.fetch),this.detectSessionInUrl=r.detectSessionInUrl,this.flowType=r.flowType,this.hasCustomAuthorizationHeader=r.hasCustomAuthorizationHeader,this.throwOnError=r.throwOnError,this.lockAcquireTimeout=r.lockAcquireTimeout,r.lock!=null&&(this.lock=r.lock,Ki||(Ki=!0,console.warn(`${this._logPrefix()} The "lock" option is deprecated and will be removed in v3. The client now coordinates session refreshes without a lock, so most apps can drop the option. See https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/migrations/lockless-coordination.md`))),this.jwks||(this.jwks={keys:[]},this.jwks_cached_at=-(2**53-1)),this.mfa={verify:this._verify.bind(this),enroll:this._enroll.bind(this),unenroll:this._unenroll.bind(this),challenge:this._challenge.bind(this),listFactors:this._listFactors.bind(this),challengeAndVerify:this._challengeAndVerify.bind(this),getAuthenticatorAssuranceLevel:this._getAuthenticatorAssuranceLevel.bind(this),webauthn:new Wi(this),recoveryCodes:{getStatus:this._getRecoveryCodesStatus.bind(this),generate:this._generateRecoveryCodes.bind(this),verify:this._verifyRecoveryCode.bind(this),regenerate:this._regenerateRecoveryCodes.bind(this),unenroll:this._unenrollRecoveryCodes.bind(this)}},this.oauth={getAuthorizationDetails:this._getAuthorizationDetails.bind(this),approveAuthorization:this._approveAuthorization.bind(this),denyAuthorization:this._denyAuthorization.bind(this),listGrants:this._listOAuthGrants.bind(this),revokeGrant:this._revokeOAuthGrant.bind(this)},this.passkey={startRegistration:this._startPasskeyRegistration.bind(this),verifyRegistration:this._verifyPasskeyRegistration.bind(this),startAuthentication:this._startPasskeyAuthentication.bind(this),verifyAuthentication:this._verifyPasskeyAuthentication.bind(this),list:this._listPasskeys.bind(this),update:this._updatePasskey.bind(this),delete:this._deletePasskey.bind(this)},this.persistSession?(r.storage?this.storage=r.storage:Er()?this.storage=globalThis.localStorage:(this.memoryStorage={},this.storage=hi(this.memoryStorage)),r.userStorage&&(this.userStorage=r.userStorage)):(this.memoryStorage={},this.storage=hi(this.memoryStorage)),B()&&globalThis.BroadcastChannel&&this.persistSession&&this.storageKey){try{this.broadcastChannel=new globalThis.BroadcastChannel(this.storageKey)}catch(e){console.error(`Failed to create a new BroadcastChannel, multi-tab state changes will not be available`,e)}(n=this.broadcastChannel)==null||n.addEventListener(`message`,async e=>{this._debug(`received broadcast notification from other tab or client`,e),(e.data.event===`TOKEN_REFRESHED`||e.data.event===`SIGNED_IN`)&&(this.lastRefreshFailure=null);try{await this._notifyAllSubscribers(e.data.event,e.data.session,!1)}catch(e){this._debug(`#broadcastChannel`,`error`,e)}})}r.skipAutoInitialize||this.initialize().catch(e=>{this._debug(`#initialize()`,`error`,e)})}isThrowOnErrorEnabled(){return this.throwOnError}_returnResult(e){if(this.throwOnError&&e&&e.error)throw e.error;return e}_logPrefix(){return`GoTrueClient@${this.storageKey}:${this.instanceID} (${Wn}) ${new Date().toISOString()}`}_debug(...e){return this.logDebugMessages&&this.logger(this._logPrefix(),...e),this}async initialize(){if(this.initializePromise)return await this.initializePromise;this._pendingInitNotifications=[],this.initializePromise=(async()=>this.lock==null?await this._initialize():await this._acquireLock(this.lockAcquireTimeout,async()=>await this._initialize()))();let e=await this.initializePromise,t=this._pendingInitNotifications??[];this._pendingInitNotifications=null;for(let e of t)await this._notifyAllSubscribers(e.event,e.session,e.broadcast);return e}async _initialize(){try{let e={},t=`none`;if(B()&&(e=Dr(window.location.href),this._isImplicitGrantCallback(e)?t=`implicit`:await this._isPKCECallback(e)&&(t=`pkce`)),B()&&this.detectSessionInUrl&&t!==`none`){let{data:n,error:r}=await this._getSessionFromURL(e,t);if(r){if(this._debug(`#_initialize()`,`error detecting session from URL`,r),nr(r)){let e=r.details?.code;if(e===`identity_already_exists`||e===`identity_not_found`||e===`single_identity_not_deletable`)return{error:r}}return{error:r}}let{session:i,redirectType:a}=n;return this._debug(`#_initialize()`,`detected session in URL`,i,`redirect type`,a),await this._saveSession(i),setTimeout(async()=>{a===`recovery`?await this._notifyAllSubscribers(`PASSWORD_RECOVERY`,i):await this._notifyAllSubscribers(`SIGNED_IN`,i)},0),{error:null}}return await this._recoverAndRefresh(),{error:null}}catch(e){return P(e)?this._returnResult({error:e}):this._returnResult({error:new F(`Unexpected error during initialization`,e)})}finally{await this._handleVisibilityChange(),this._debug(`#_initialize()`,`end`)}}async signInAnonymously(e){try{let{data:t,error:n}=await J(this.fetch,`POST`,`${this.url}/signup`,{headers:this.headers,body:{data:e?.options?.data??{},gotrue_meta_security:{captcha_token:e?.options?.captchaToken}},xform:Y});if(n||!t)return this._returnResult({data:{user:null,session:null},error:n});let r=t.session,i=t.user;return t.session&&(await this._saveSession(t.session),await this._notifyAllSubscribers(`SIGNED_IN`,r)),this._returnResult({data:{user:i,session:r},error:null})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signUp(e){let t=null;try{let n;if(`email`in e){let{email:r,password:i,options:a}=e,o=null,s=null;this.flowType===`pkce`&&([o,s,t]=await this._getCodeChallengeAndMethod()),n=await J(this.fetch,`POST`,`${this.url}/signup`,{headers:this.headers,redirectTo:this._maybeAppendFlowIdToRedirect(a?.emailRedirectTo,t),body:{email:r,password:i,data:a?.data??{},gotrue_meta_security:{captcha_token:a?.captchaToken},code_challenge:o,code_challenge_method:s},xform:Y})}else if(`phone`in e){let{phone:t,password:r,options:i}=e;n=await J(this.fetch,`POST`,`${this.url}/signup`,{headers:this.headers,body:{phone:t,password:r,data:i?.data??{},channel:i?.channel??`sms`,gotrue_meta_security:{captcha_token:i?.captchaToken}},xform:Y})}else throw new er(`You must provide either an email or phone number and a password`);let{data:r,error:i}=n;if(i||!r)return await G(this.storage,this.storageKey,t),this._returnResult({data:{user:null,session:null},error:i});let a=r.session,o=r.user;return r.session&&(await this._saveSession(r.session),await this._notifyAllSubscribers(`SIGNED_IN`,a)),this._returnResult({data:{user:o,session:a},error:null})}catch(e){if(await G(this.storage,this.storageKey,t),P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signInWithPassword(e){try{let t;if(`email`in e){let{email:n,password:r,options:i}=e;t=await J(this.fetch,`POST`,`${this.url}/token?grant_type=password`,{headers:this.headers,body:{email:n,password:r,gotrue_meta_security:{captcha_token:i?.captchaToken}},xform:ci})}else if(`phone`in e){let{phone:n,password:r,options:i}=e;t=await J(this.fetch,`POST`,`${this.url}/token?grant_type=password`,{headers:this.headers,body:{phone:n,password:r,gotrue_meta_security:{captcha_token:i?.captchaToken}},xform:ci})}else throw new er(`You must provide either an email or phone number and a password`);let{data:n,error:r}=t;if(r)return this._returnResult({data:{user:null,session:null},error:r});if(!n||!n.session||!n.user){let e=new R;return this._returnResult({data:{user:null,session:null},error:e})}return n.session&&(await this._saveSession(n.session),await this._notifyAllSubscribers(`SIGNED_IN`,n.session)),this._returnResult({data:Object.assign({user:n.user,session:n.session},n.weak_password?{weakPassword:n.weak_password}:null),error:r})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signInWithOAuth(e){return await this._handleProviderSignIn(e.provider,{redirectTo:e.options?.redirectTo,scopes:e.options?.scopes,queryParams:e.options?.queryParams,skipBrowserRedirect:e.options?.skipBrowserRedirect})}async exchangeCodeForSession(e,t){return await this.initializePromise,this.lock==null?this._exchangeCodeForSession(e,t):this._acquireLock(this.lockAcquireTimeout,async()=>this._exchangeCodeForSession(e,t))}async signInWithWeb3(e){let{chain:t}=e;switch(t){case`ethereum`:return await this.signInWithEthereum(e);case`solana`:return await this.signInWithSolana(e);default:throw Error(`@supabase/auth-js: Unsupported chain "${t}"`)}}async signInWithEthereum(e){let t,n;if(`message`in e)t=e.message,n=e.signature;else{let{chain:r,wallet:i,statement:a,options:o}=e,s;if(B())if(typeof i==`object`)s=i;else{let e=window;if(`ethereum`in e&&typeof e.ethereum==`object`&&`request`in e.ethereum&&typeof e.ethereum.request==`function`)s=e.ethereum;else throw Error(`@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.`)}else{if(typeof i!=`object`||!o?.url)throw Error(`@supabase/auth-js: Both wallet and url must be specified in non-browser environments.`);s=i}let c=new URL(o?.url??window.location.href),l=await s.request({method:`eth_requestAccounts`}).then(e=>e).catch(()=>{throw Error(`@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid`)});if(!l||l.length===0)throw Error(`@supabase/auth-js: No accounts available. Please ensure the wallet is connected.`);let u=Ci(l[0]),d=o?.signInWithEthereum?.chainId;d||=wi(await s.request({method:`eth_chainId`})),t=Ei({domain:c.host,address:u,statement:a,uri:c.href,version:`1`,chainId:d,nonce:o?.signInWithEthereum?.nonce,issuedAt:o?.signInWithEthereum?.issuedAt??new Date,expirationTime:o?.signInWithEthereum?.expirationTime,notBefore:o?.signInWithEthereum?.notBefore,requestId:o?.signInWithEthereum?.requestId,resources:o?.signInWithEthereum?.resources}),n=await s.request({method:`personal_sign`,params:[Ti(t),u]})}try{let{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/token?grant_type=web3`,{headers:this.headers,body:Object.assign({chain:`ethereum`,message:t,signature:n},e.options?.captchaToken?{gotrue_meta_security:{captcha_token:e.options?.captchaToken}}:null),xform:Y});if(i)throw i;if(!r||!r.session||!r.user){let e=new R;return this._returnResult({data:{user:null,session:null},error:e})}return r.session&&(await this._saveSession(r.session),await this._notifyAllSubscribers(`SIGNED_IN`,r.session)),this._returnResult({data:Object.assign({},r),error:i})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signInWithSolana(e){let t,n;if(`message`in e)t=e.message,n=e.signature;else{let{chain:r,wallet:i,statement:a,options:o}=e,s;if(B())if(typeof i==`object`)s=i;else{let e=window;if(`solana`in e&&typeof e.solana==`object`&&(`signIn`in e.solana&&typeof e.solana.signIn==`function`||`signMessage`in e.solana&&typeof e.solana.signMessage==`function`))s=e.solana;else throw Error(`@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.`)}else{if(typeof i!=`object`||!o?.url)throw Error(`@supabase/auth-js: Both wallet and url must be specified in non-browser environments.`);s=i}let c=new URL(o?.url??window.location.href);if(`signIn`in s&&s.signIn){let e=await s.signIn(Object.assign(Object.assign(Object.assign({issuedAt:new Date().toISOString()},o?.signInWithSolana),{version:`1`,domain:c.host,uri:c.href}),a?{statement:a}:null)),r;if(Array.isArray(e)&&e[0]&&typeof e[0]==`object`)r=e[0];else if(e&&typeof e==`object`&&`signedMessage`in e&&`signature`in e)r=e;else throw Error(`@supabase/auth-js: Wallet method signIn() returned unrecognized value`);if(`signedMessage`in r&&`signature`in r&&(typeof r.signedMessage==`string`||r.signedMessage instanceof Uint8Array)&&r.signature instanceof Uint8Array)t=typeof r.signedMessage==`string`?r.signedMessage:new TextDecoder().decode(r.signedMessage),n=r.signature;else throw Error(`@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields`)}else{if(!(`signMessage`in s)||typeof s.signMessage!=`function`||!(`publicKey`in s)||typeof s!=`object`||!s.publicKey||!(`toBase58`in s.publicKey)||typeof s.publicKey.toBase58!=`function`)throw Error(`@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API`);t=[`${c.host} wants you to sign in with your Solana account:`,s.publicKey.toBase58(),...a?[``,a,``]:[``],`Version: 1`,`URI: ${c.href}`,`Issued At: ${o?.signInWithSolana?.issuedAt??new Date().toISOString()}`,...o?.signInWithSolana?.notBefore?[`Not Before: ${o.signInWithSolana.notBefore}`]:[],...o?.signInWithSolana?.expirationTime?[`Expiration Time: ${o.signInWithSolana.expirationTime}`]:[],...o?.signInWithSolana?.chainId?[`Chain ID: ${o.signInWithSolana.chainId}`]:[],...o?.signInWithSolana?.nonce?[`Nonce: ${o.signInWithSolana.nonce}`]:[],...o?.signInWithSolana?.requestId?[`Request ID: ${o.signInWithSolana.requestId}`]:[],...o?.signInWithSolana?.resources?.length?[`Resources`,...o.signInWithSolana.resources.map(e=>`- ${e}`)]:[]].join(`
`);let e=await s.signMessage(new TextEncoder().encode(t),`utf8`);if(!e||!(e instanceof Uint8Array))throw Error(`@supabase/auth-js: Wallet signMessage() API returned an recognized value`);n=e}}try{let{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/token?grant_type=web3`,{headers:this.headers,body:Object.assign({chain:`solana`,message:t,signature:z(n)},e.options?.captchaToken?{gotrue_meta_security:{captcha_token:e.options?.captchaToken}}:null),xform:Y});if(i)throw i;if(!r||!r.session||!r.user){let e=new R;return this._returnResult({data:{user:null,session:null},error:e})}return r.session&&(await this._saveSession(r.session),await this._notifyAllSubscribers(`SIGNED_IN`,r.session)),this._returnResult({data:Object.assign({},r),error:i})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async _exchangeCodeForSession(e,t){let n=t?.flowId!=null,r=n?zr(t?.flowId):B()?zr(Dr(window.location.href)[N]):null;n&&!r&&this._debug(`#_exchangeCodeForSession()`,`provided flowId is not a valid flow id`,t?.flowId);let{verifier:i,flowId:a}=n&&!r?{verifier:null,flowId:null}:await Gr(this.storage,this.storageKey,r),[o,s]=(i??``).split(`/`);try{if(!o&&this.flowType===`pkce`)throw new ir;let{data:t,error:n}=await J(this.fetch,`POST`,`${this.url}/token?grant_type=pkce`,{headers:this.headers,body:{auth_code:e,code_verifier:o},xform:Y});if(await G(this.storage,this.storageKey,a),n)throw n;if(!t||!t.session||!t.user){let e=new R;return this._returnResult({data:{user:null,session:null,redirectType:null},error:e})}return t.session&&(await this._saveSession(t.session),await this._notifyAllSubscribers(s===`recovery`?`PASSWORD_RECOVERY`:`SIGNED_IN`,t.session)),this._returnResult({data:Object.assign(Object.assign({},t),{redirectType:s??null}),error:n})}catch(e){if(await G(this.storage,this.storageKey,a),P(e))return this._returnResult({data:{user:null,session:null,redirectType:null},error:e});throw e}}async signInWithIdToken(e){try{let{options:t,provider:n,token:r,access_token:i,nonce:a}=e,{data:o,error:s}=await J(this.fetch,`POST`,`${this.url}/token?grant_type=id_token`,{headers:this.headers,body:{provider:n,id_token:r,access_token:i,nonce:a,gotrue_meta_security:{captcha_token:t?.captchaToken}},xform:Y});if(s)return this._returnResult({data:{user:null,session:null},error:s});if(!o||!o.session||!o.user){let e=new R;return this._returnResult({data:{user:null,session:null},error:e})}return o.session&&(await this._saveSession(o.session),await this._notifyAllSubscribers(`SIGNED_IN`,o.session)),this._returnResult({data:o,error:s})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signInWithOtp(e){let t=null;try{if(`email`in e){let{email:n,options:r}=e,i=null,a=null;this.flowType===`pkce`&&([i,a,t]=await this._getCodeChallengeAndMethod());let{error:o}=await J(this.fetch,`POST`,`${this.url}/otp`,{headers:this.headers,body:{email:n,data:r?.data??{},create_user:r?.shouldCreateUser??!0,gotrue_meta_security:{captcha_token:r?.captchaToken},code_challenge:i,code_challenge_method:a},redirectTo:this._maybeAppendFlowIdToRedirect(r?.emailRedirectTo,t)});return this._returnResult({data:{user:null,session:null},error:o})}if(`phone`in e){let{phone:t,options:n}=e,{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/otp`,{headers:this.headers,body:{phone:t,data:n?.data??{},create_user:n?.shouldCreateUser??!0,gotrue_meta_security:{captcha_token:n?.captchaToken},channel:n?.channel??`sms`}});return this._returnResult({data:{user:null,session:null,messageId:r?.message_id},error:i})}throw new er(`You must provide either an email or phone number.`)}catch(e){if(await G(this.storage,this.storageKey,t),P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async verifyOtp(e){try{let t,n;`options`in e&&(t=e.options?.redirectTo,n=e.options?.captchaToken);let{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/verify`,{headers:this.headers,body:Object.assign(Object.assign({},e),{gotrue_meta_security:{captcha_token:n}}),redirectTo:t,xform:Y});if(i)throw i;if(!r)throw Error(`An error occurred on token verification.`);let a=r.session,o=r.user;return a?.access_token&&(await this._saveSession(a),await this._notifyAllSubscribers(e.type==`recovery`?`PASSWORD_RECOVERY`:`SIGNED_IN`,a)),this._returnResult({data:{user:o,session:a},error:null})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signInWithSSO(e){let t=null;try{let n=null,r=null;this.flowType===`pkce`&&([n,r,t]=await this._getCodeChallengeAndMethod());let i=await J(this.fetch,`POST`,`${this.url}/sso`,{body:Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({},`providerId`in e?{provider_id:e.providerId}:null),`domain`in e?{domain:e.domain}:null),{redirect_to:this._maybeAppendFlowIdToRedirect(e.options?.redirectTo,t)}),e?.options?.captchaToken?{gotrue_meta_security:{captcha_token:e.options.captchaToken}}:null),{skip_http_redirect:!0,code_challenge:n,code_challenge_method:r}),headers:this.headers,xform:li});return i.data?.url&&B()&&!e.options?.skipBrowserRedirect&&window.location.assign(i.data.url),this._returnResult(i)}catch(e){if(await G(this.storage,this.storageKey,t),P(e))return this._returnResult({data:null,error:e});throw e}}async reauthenticate(){return await this.initializePromise,this.lock==null?await this._reauthenticate():await this._acquireLock(this.lockAcquireTimeout,async()=>await this._reauthenticate())}async _reauthenticate(){try{return await this._useSession(async e=>{let{data:{session:t},error:n}=e;if(n)throw n;if(!t)throw new L;let{error:r}=await J(this.fetch,`GET`,`${this.url}/reauthenticate`,{headers:this.headers,jwt:t.access_token});return this._returnResult({data:{user:null,session:null},error:r})})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async resend(e){let t=null;try{let n=`${this.url}/resend`;if(`email`in e){let{email:r,type:i,options:a}=e,o=null,s=null;this.flowType===`pkce`&&([o,s,t]=await this._getCodeChallengeAndMethod());let{error:c}=await J(this.fetch,`POST`,n,{headers:this.headers,body:{email:r,type:i,gotrue_meta_security:{captcha_token:a?.captchaToken},code_challenge:o,code_challenge_method:s},redirectTo:this._maybeAppendFlowIdToRedirect(a?.emailRedirectTo,t)});return c&&await G(this.storage,this.storageKey,t),this._returnResult({data:{user:null,session:null},error:c})}else if(`phone`in e){let{phone:t,type:r,options:i}=e,{data:a,error:o}=await J(this.fetch,`POST`,n,{headers:this.headers,body:{phone:t,type:r,gotrue_meta_security:{captcha_token:i?.captchaToken}}});return this._returnResult({data:{user:null,session:null,messageId:a?.message_id},error:o})}throw new er(`You must provide either an email or phone number and a type`)}catch(e){if(await G(this.storage,this.storageKey,t),P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async getSession(){return await this.initializePromise,this.lock==null?await this._useSession(async e=>e):await this._acquireLock(this.lockAcquireTimeout,async()=>this._useSession(async e=>e))}async _acquireLock(e,t){this._debug(`#_acquireLock`,`begin`,e);try{if(this.lockAcquired){let e=this.pendingInLock.length?this.pendingInLock[this.pendingInLock.length-1]:Promise.resolve(),n=(async()=>(await e,await t()))();return this.pendingInLock.push((async()=>{try{await n}catch{}})()),n}return await this.lock(`lock:${this.storageKey}`,e,async()=>{this._debug(`#_acquireLock`,`lock acquired for storage key`,this.storageKey);try{this.lockAcquired=!0;let e=t();for(this.pendingInLock.push((async()=>{try{await e}catch{}})()),await e;this.pendingInLock.length;){let e=[...this.pendingInLock];await Promise.all(e),this.pendingInLock.splice(0,e.length)}return await e}finally{this._debug(`#_acquireLock`,`lock released for storage key`,this.storageKey),this.lockAcquired=!1}})}finally{this._debug(`#_acquireLock`,`end`)}}async _useSession(e){this._debug(`#_useSession`,`begin`);try{return await e(await this.__loadSession())}finally{this._debug(`#_useSession`,`end`)}}async __loadSession(){this._debug(`#__loadSession()`,`begin`),this.lock!=null&&!this.lockAcquired&&this._debug(`#__loadSession()`,`used outside of an acquired lock!`,Error().stack);try{let e=null,t=await U(this.storage,this.storageKey);if(this._debug(`#getSession()`,`session from storage`,t),t!==null&&(this._isValidSession(t)?e=t:(this._debug(`#getSession()`,`session from storage is not valid`),await this._removeSession())),!e)return{data:{session:null},error:null};let n=e.expires_at?e.expires_at*1e3-Date.now()<Gn:!1;if(this._debug(`#__loadSession()`,`session has${n?``:` not`} expired`,`expires_at`,e.expires_at),!n)return{data:{session:await this._hydrateSessionUser(e)},error:null};let{data:r,error:i}=await this._callRefreshToken(e.refresh_token);if(i){let e=await U(this.storage,this.storageKey);return e&&this._isValidSession(e)&&e.expires_at&&e.expires_at*1e3>Date.now()?this._returnResult({data:{session:await this._hydrateSessionUser(e)},error:null}):this._returnResult({data:{session:null},error:i})}return this._returnResult({data:{session:r},error:null})}finally{this._debug(`#__loadSession()`,`end`)}}async _hydrateSessionUser(e){if(this.userStorage){let t=await U(this.userStorage,this.storageKey+`-user`);e.user=t?.user?t.user:ti()}if(this.storage.isServer&&e.user&&!e.user.__isUserNotAvailableProxy){let t={value:this.suppressGetSessionWarning};e.user=ni(e.user,t),t.value&&(this.suppressGetSessionWarning=!0)}return e}async getUser(e){if(e)return await this._getUser(e);await this.initializePromise;let t;return t=this.lock==null?await this._getUser():await this._acquireLock(this.lockAcquireTimeout,async()=>await this._getUser()),t.data.user&&(this.suppressGetSessionWarning=!0),t}async _getUser(e){try{return e?await J(this.fetch,`GET`,`${this.url}/user`,{headers:this.headers,jwt:e,xform:X}):await this._useSession(async e=>{let{data:t,error:n}=e;if(n)throw n;return!t.session?.access_token&&!this.hasCustomAuthorizationHeader?{data:{user:null},error:new L}:await J(this.fetch,`GET`,`${this.url}/user`,{headers:this.headers,jwt:t.session?.access_token??void 0,xform:X})})}catch(e){if(P(e))return $n(e)&&await this._removeSession(),this._returnResult({data:{user:null},error:e});throw e}}async updateUser(e,t={}){return await this.initializePromise,this.lock==null?await this._updateUser(e,t):await this._acquireLock(this.lockAcquireTimeout,async()=>await this._updateUser(e,t))}async _updateUser(e,t={}){let n=null;try{return await this._useSession(async r=>{let{data:i,error:a}=r;if(a)throw a;if(!i.session)throw new L;let o=i.session,s=null,c=null;this.flowType===`pkce`&&e.email!=null&&([s,c,n]=await this._getCodeChallengeAndMethod());let{data:l,error:u}=await J(this.fetch,`PUT`,`${this.url}/user`,{headers:this.headers,redirectTo:this._maybeAppendFlowIdToRedirect(t?.emailRedirectTo,n),body:Object.assign(Object.assign({},e),{code_challenge:s,code_challenge_method:c}),jwt:o.access_token,xform:X});if(u)throw u;return o.user=l.user,await this._saveSession(o),await this._notifyAllSubscribers(`USER_UPDATED`,o),this._returnResult({data:{user:o.user},error:null})})}catch(e){if(await G(this.storage,this.storageKey,n),P(e))return this._returnResult({data:{user:null},error:e});throw e}}async setSession(e){return await this.initializePromise,this.lock==null?await this._setSession(e):await this._acquireLock(this.lockAcquireTimeout,async()=>await this._setSession(e))}async _setSession(e){try{if(!e.access_token||!e.refresh_token)throw new L;let t=Date.now()/1e3,n=t,r=!0,i=null,{payload:a}=jr(e.access_token);if(a.exp&&(n=a.exp,r=n<=t),r){let{data:t,error:n}=await this._callRefreshToken(e.refresh_token);if(n)return this._returnResult({data:{user:null,session:null},error:n});if(!t)return{data:{user:null,session:null},error:null};i=t}else{let{data:r,error:a}=await this._getUser(e.access_token);if(a)return this._returnResult({data:{user:null,session:null},error:a});i={access_token:e.access_token,refresh_token:e.refresh_token,user:r.user,token_type:`bearer`,expires_in:n-t,expires_at:n},await this._saveSession(i),await this._notifyAllSubscribers(`SIGNED_IN`,i)}return this._returnResult({data:{user:i.user,session:i},error:null})}catch(e){if(P(e))return this._returnResult({data:{session:null,user:null},error:e});throw e}}async refreshSession(e){return await this.initializePromise,this.lock==null?await this._refreshSession(e):await this._acquireLock(this.lockAcquireTimeout,async()=>await this._refreshSession(e))}async _refreshSession(e){try{return await this._useSession(async t=>{if(!e){let{data:n,error:r}=t;if(r)throw r;e=n.session??void 0}if(!e?.refresh_token)throw new L;let{data:n,error:r}=await this._callRefreshToken(e.refresh_token);return r?this._returnResult({data:{user:null,session:null},error:r}):n?this._returnResult({data:{user:n.user,session:n},error:null}):this._returnResult({data:{user:null,session:null},error:null})})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async _getSessionFromURL(e,t){try{if(!B())throw new tr(`No browser detected.`);if(e.error||e.error_description||e.error_code)throw new tr(e.error_description||`Error in URL with unspecified error_description`,{error:e.error||`unspecified_error`,code:e.error_code||`unspecified_code`});switch(t){case`implicit`:if(this.flowType===`pkce`)throw new rr(`Not a valid PKCE flow url.`);break;case`pkce`:if(this.flowType===`implicit`)throw new tr(`Not a valid implicit grant flow url.`);break;default:}if(t===`pkce`){if(this._debug(`#_initialize()`,`begin`,`is PKCE flow`,!0),!e.code)throw new rr(`No code detected.`);let{data:t,error:n}=await this._exchangeCodeForSession(e.code,{flowId:e[N]});if(n)throw n;let r=new URL(window.location.href);return r.searchParams.delete(`code`),r.searchParams.delete(N),window.history.replaceState(window.history.state,``,r.toString()),{data:{session:t.session,redirectType:t.redirectType??null},error:null}}let{provider_token:n,provider_refresh_token:r,access_token:i,refresh_token:a,expires_in:o,expires_at:s,token_type:c}=e;if(!i||!o||!a||!c)throw new tr(`No session defined in URL`);let l=Math.round(Date.now()/1e3),u=parseInt(o),d=l+u;s&&(d=parseInt(s));let f=d-l;f*1e3<=M&&console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${f}s, should have been closer to ${u}s`);let p=d-u;l-p>=120?console.warn(`@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale`,p,d,l):l-p<0&&console.warn(`@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew`,p,d,l);let{data:m,error:h}=await this._getUser(i);if(h)throw h;let g={provider_token:n,provider_refresh_token:r,access_token:i,expires_in:u,expires_at:d,refresh_token:a,token_type:c,user:m.user};return window.location.hash=``,this._debug(`#_getSessionFromURL()`,`clearing window.location.hash`),this._returnResult({data:{session:g,redirectType:e.type},error:null})}catch(e){if(P(e))return this._returnResult({data:{session:null,redirectType:null},error:e});throw e}}_isImplicitGrantCallback(e){return typeof this.detectSessionInUrl==`function`?this.detectSessionInUrl(new URL(window.location.href),e):!!(e.access_token||e.error||e.error_description||e.error_code)}async _isPKCECallback(e){if(!e.code)return!1;let t=zr(e[N]);return t&&await U(this.storage,Vr(this.storageKey,t))?!0:!!await U(this.storage,`${this.storageKey}-code-verifier`)}async signOut(e={scope:`global`}){return await this.initializePromise,this.lock==null?await this._signOut(e):await this._acquireLock(this.lockAcquireTimeout,async()=>await this._signOut(e))}async _signOut({scope:e}={scope:`global`}){return await this._useSession(async t=>{let n=async()=>{await this._removeSession()},{data:r,error:i}=t;if(i&&!$n(i))return this._returnResult({error:i});let a=r.session?.access_token;if(a){let{error:t}=await this.admin.signOut(a,e);if(t&&!(Qn(t)&&(t.status===404||t.status===401||t.status===403)||$n(t)))return e!==`others`&&await n(),this._returnResult({error:t})}return e!==`others`&&await n(),this._returnResult({error:null})})}onAuthStateChange(e){let t=Tr(),n={id:t,callback:e,unsubscribe:()=>{this._debug(`#unsubscribe()`,`state change callback with id removed`,t),this.stateChangeEmitters.delete(t)}};return this._debug(`#onAuthStateChange()`,`registered callback with id`,t),this.stateChangeEmitters.set(t,n),(async()=>{await this.initializePromise,this.lock==null?await this._emitInitialSession(t):await this._acquireLock(this.lockAcquireTimeout,async()=>{this._emitInitialSession(t)})})(),{data:{subscription:n}}}async _emitInitialSession(e){return await this._useSession(async t=>{try{let{data:{session:n},error:r}=t;if(r)throw r;await this.stateChangeEmitters.get(e)?.callback(`INITIAL_SESSION`,n),this._debug(`INITIAL_SESSION`,`callback id`,e,`session`,n)}catch(t){if(await this.stateChangeEmitters.get(e)?.callback(`INITIAL_SESSION`,null),this._debug(`INITIAL_SESSION`,`callback id`,e,`error`,t),lr(t))return;$n(t)||sr(t)||Qn(t)&&(t.code===`refresh_token_not_found`||t.code===`refresh_token_already_used`||t.code===`session_expired`)?console.warn(t):console.error(t)}})}async resetPasswordForEmail(e,t={}){let n=null,r=null,i=null;this.flowType===`pkce`&&([n,r,i]=await this._getCodeChallengeAndMethod(!0));try{return await J(this.fetch,`POST`,`${this.url}/recover`,{body:{email:e,code_challenge:n,code_challenge_method:r,gotrue_meta_security:{captcha_token:t.captchaToken}},headers:this.headers,redirectTo:this._maybeAppendFlowIdToRedirect(t.redirectTo,i)})}catch(e){if(await G(this.storage,this.storageKey,i),P(e))return this._returnResult({data:null,error:e});throw e}}async getUserIdentities(){try{let{data:e,error:t}=await this.getUser();if(t)throw t;return this._returnResult({data:{identities:e.user.identities??[]},error:null})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async linkIdentity(e){return`token`in e?this.linkIdentityIdToken(e):this.linkIdentityOAuth(e)}async linkIdentityOAuth(e){let t=null;try{let{data:n,error:r}=await this._useSession(async n=>{let{data:r,error:i}=n;if(i)throw i;let{url:a,flowId:o}=await this._getUrlForProvider(`${this.url}/user/identities/authorize`,e.provider,{redirectTo:e.options?.redirectTo,scopes:e.options?.scopes,queryParams:e.options?.queryParams,skipBrowserRedirect:!0});return t=o,await J(this.fetch,`GET`,a,{headers:this.headers,jwt:r.session?.access_token??void 0})});if(r)throw r;return B()&&!e.options?.skipBrowserRedirect&&window.location.assign(n?.url),this._returnResult({data:{provider:e.provider,url:n?.url,flowId:t},error:null})}catch(n){if(P(n))return this._returnResult({data:{provider:e.provider,url:null,flowId:t},error:n});throw n}}async linkIdentityIdToken(e){return await this._useSession(async t=>{try{let{error:n,data:{session:r}}=t;if(n)throw n;let{options:i,provider:a,token:o,access_token:s,nonce:c}=e,{data:l,error:u}=await J(this.fetch,`POST`,`${this.url}/token?grant_type=id_token`,{headers:this.headers,jwt:r?.access_token??void 0,body:{provider:a,id_token:o,access_token:s,nonce:c,link_identity:!0,gotrue_meta_security:{captcha_token:i?.captchaToken}},xform:Y});return u?this._returnResult({data:{user:null,session:null},error:u}):!l||!l.session||!l.user?this._returnResult({data:{user:null,session:null},error:new R}):(l.session&&(await this._saveSession(l.session),await this._notifyAllSubscribers(`USER_UPDATED`,l.session)),this._returnResult({data:l,error:u}))}catch(e){if(await G(this.storage,this.storageKey,null),P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}})}async unlinkIdentity(e){try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)throw r;return await J(this.fetch,`DELETE`,`${this.url}/user/identities/${e.identity_id}`,{headers:this.headers,jwt:n.session?.access_token??void 0})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _refreshAccessToken(e){let t=`#_refreshAccessToken()`;this._debug(t,`begin`);try{let n=Date.now();return await Nr(async n=>(n>0&&await Mr(200*2**(n-1)),this._debug(t,`refreshing attempt`,n),await J(this.fetch,`POST`,`${this.url}/token?grant_type=refresh_token`,{body:{refresh_token:e},headers:this.headers,xform:Y})),(e,t)=>{let r=200*2**e;return t&&sr(t)&&Date.now()+r-n<M})}catch(e){if(this._debug(t,`error`,e),P(e))return this._returnResult({data:{session:null,user:null},error:e});throw e}finally{this._debug(t,`end`)}}_isValidSession(e){return typeof e==`object`&&!!e&&`access_token`in e&&`refresh_token`in e&&`expires_at`in e}async _handleProviderSignIn(e,t){let{url:n,flowId:r}=await this._getUrlForProvider(`${this.url}/authorize`,e,{redirectTo:t.redirectTo,scopes:t.scopes,queryParams:t.queryParams});return this._debug(`#_handleProviderSignIn()`,`provider`,e,`options`,t,`url`,n),B()&&!t.skipBrowserRedirect&&window.location.assign(n),{data:{provider:e,url:n,flowId:r},error:null}}async _recoverAndRefresh(){let e=`#_recoverAndRefresh()`;this._debug(e,`begin`);try{let t=await U(this.storage,this.storageKey);if(t&&this.userStorage){let e=await U(this.userStorage,this.storageKey+`-user`);!this.storage.isServer&&Object.is(this.storage,this.userStorage)&&!e&&(e={user:t.user},await H(this.userStorage,this.storageKey+`-user`,e)),t.user=e?.user??ti()}else if(t&&!t.user&&!t.user){let e=await U(this.storage,this.storageKey+`-user`);e&&e?.user?(t.user=e.user,await W(this.storage,this.storageKey+`-user`),await H(this.storage,this.storageKey,t)):t.user=ti()}if(this._debug(e,`session from storage`,t),!this._isValidSession(t)){this._debug(e,`session is not valid`),t!==null&&await this._removeSession();return}let n=(t.expires_at??1/0)*1e3-Date.now()<Gn;if(this._debug(e,`session has${n?``:` not`} expired with margin of ${Gn}s`),n){if(this.autoRefreshToken&&t.refresh_token){let{error:n}=await this._callRefreshToken(t.refresh_token);n&&(lr(n)?this._debug(e,`refresh discarded by commit guard`,n):this._debug(e,`refresh failed`,n))}}else if(t.user&&t.user.__isUserNotAvailableProxy===!0)try{let{data:n,error:r}=await this._getUser(t.access_token);!r&&n?.user?(t.user=n.user,await this._saveSession(t),await this._notifyAllSubscribers(`SIGNED_IN`,t)):this._debug(e,`could not get user data, skipping SIGNED_IN notification`)}catch(t){console.error(`Error getting user data:`,t),this._debug(e,`error getting user data, skipping SIGNED_IN notification`,t)}else await this._notifyAllSubscribers(`SIGNED_IN`,t)}catch(t){this._debug(e,`error`,t),sr(t)?console.warn(t):console.error(t);return}finally{this._debug(e,`end`)}}async _callRefreshToken(e){var t,n;if(!e)throw new L;if(this.refreshingDeferred)return this.refreshingDeferred.promise;if(this.lastRefreshFailure&&this.lastRefreshFailure.refreshToken===e&&Date.now()<this.lastRefreshFailure.expiresAt)return this._debug(`#_callRefreshToken()`,`returning cached failure (cooldown active)`),this.lastRefreshFailure.result;let r=`#_callRefreshToken()`;this._debug(r,`begin`);try{this.refreshingDeferred=new Ar,this.refreshingDeferred.promise.then(void 0,()=>{});let t=await U(this.storage,this.storageKey),{data:n,error:i}=await this._refreshAccessToken(e);if(i)throw i;if(!n.session)throw new L;let a=await U(this.storage,this.storageKey);if(t!==null&&(a===null||a.refresh_token!==t.refresh_token)){this._debug(r,`commit guard: storage changed since refresh started, discarding rotated tokens`,{startedWith:`present`,nowHolds:a?`replaced`:`cleared`});let e={data:null,error:new cr};return this.refreshingDeferred.resolve(e),e}let o=this._sessionRemovalEpoch;if(await this._saveSession(n.session),this._sessionRemovalEpoch!==o){this._debug(r,`commit guard (post-save): _removeSession ran during _saveSession, undoing write`),await W(this.storage,this.storageKey),this.userStorage&&await W(this.userStorage,this.storageKey+`-user`);let e={data:null,error:new cr};return this.refreshingDeferred.resolve(e),e}await this._notifyAllSubscribers(`TOKEN_REFRESHED`,n.session);let s={data:n.session,error:null};return this.lastRefreshFailure=null,this.refreshingDeferred.resolve(s),s}catch(i){if(this._debug(r,`error`,i),P(i)){let n={data:null,error:i};if(!sr(i)){let e=await U(this.storage,this.storageKey);e?.expires_at&&e.expires_at*1e3>Date.now()?this._debug(r,`proactive refresh failed, access token still valid — preserving session`):await this._removeSession()}return this.lastRefreshFailure={refreshToken:e,result:n,expiresAt:Date.now()+6e4},(t=this.refreshingDeferred)==null||t.resolve(n),n}throw(n=this.refreshingDeferred)==null||n.reject(i),i}finally{this.refreshingDeferred=null,this._debug(r,`end`)}}async _notifyAllSubscribers(e,t,n=!0){if(this._pendingInitNotifications!==null&&n){this._pendingInitNotifications.push({event:e,session:t,broadcast:n});return}let r=`#_notifyAllSubscribers(${e})`;this._debug(r,`begin`,t,`broadcast = ${n}`);try{this.broadcastChannel&&n&&this.broadcastChannel.postMessage({event:e,session:t});let r=[],i=Array.from(this.stateChangeEmitters.values()).map(async n=>{try{await n.callback(e,t)}catch(e){r.push(e)}});if(await Promise.all(i),r.length>0){for(let e=0;e<r.length;e+=1)console.error(r[e]);throw r[0]}}finally{this._debug(r,`end`)}}async _saveSession(e){this._debug(`#_saveSession()`,e),this.suppressGetSessionWarning=!0;let t=Object.assign({},e),n=t.user&&t.user.__isUserNotAvailableProxy===!0;if(this.userStorage){!n&&t.user&&await H(this.userStorage,this.storageKey+`-user`,{user:t.user});let e=Object.assign({},t);delete e.user;let r=ri(e);await H(this.storage,this.storageKey,r)}else{let e=ri(t);await H(this.storage,this.storageKey,e)}}async _removeSession(){this._sessionRemovalEpoch+=1,this._debug(`#_removeSession()`),this.lastRefreshFailure=null,this.suppressGetSessionWarning=!1,await W(this.storage,this.storageKey),await Kr(this.storage,this.storageKey),await W(this.storage,this.storageKey+`-user`),this.userStorage&&await W(this.userStorage,this.storageKey+`-user`),await this._notifyAllSubscribers(`SIGNED_OUT`,null)}_removeVisibilityChangedCallback(){this._debug(`#_removeVisibilityChangedCallback()`);let e=this.visibilityChangedCallback;this.visibilityChangedCallback=null;try{e&&B()&&window!=null&&window.removeEventListener&&window.removeEventListener(`visibilitychange`,e)}catch(e){console.error(`removing visibilitychange callback failed`,e)}}async _startAutoRefresh(){await this._stopAutoRefresh(),this._debug(`#_startAutoRefresh()`);let e=setInterval(()=>this._autoRefreshTokenTick(),M);this.autoRefreshTicker=e,e&&typeof e==`object`&&typeof e.unref==`function`?e.unref():typeof Deno<`u`&&typeof Deno.unrefTimer==`function`&&Deno.unrefTimer(e);let t=setTimeout(async()=>{await this.initializePromise,await this._autoRefreshTokenTick()},0);this.autoRefreshTickTimeout=t,t&&typeof t==`object`&&typeof t.unref==`function`?t.unref():typeof Deno<`u`&&typeof Deno.unrefTimer==`function`&&Deno.unrefTimer(t)}async _stopAutoRefresh(){this._debug(`#_stopAutoRefresh()`);let e=this.autoRefreshTicker;this.autoRefreshTicker=null,e&&clearInterval(e);let t=this.autoRefreshTickTimeout;this.autoRefreshTickTimeout=null,t&&clearTimeout(t)}async startAutoRefresh(){this._removeVisibilityChangedCallback(),await this._startAutoRefresh()}async stopAutoRefresh(){this._removeVisibilityChangedCallback(),await this._stopAutoRefresh()}async dispose(){var e;this._removeVisibilityChangedCallback(),await this._stopAutoRefresh(),(e=this.broadcastChannel)==null||e.close(),this.broadcastChannel=null,this.stateChangeEmitters.clear()}async _autoRefreshTokenTick(){if(this._debug(`#_autoRefreshTokenTick()`,`begin`),this.lock!=null){try{await this._acquireLock(0,async()=>{try{let e=Date.now();try{return await this._useSession(async t=>{let{data:{session:n}}=t;if(!n||!n.refresh_token||!n.expires_at){this._debug(`#_autoRefreshTokenTick()`,`no session`);return}let r=Math.floor((n.expires_at*1e3-e)/M);this._debug(`#_autoRefreshTokenTick()`,`access token expires in ${r} ticks, a tick lasts ${M}ms, refresh threshold is 3 ticks`),r<=3&&await this._callRefreshToken(n.refresh_token)})}catch(e){console.error(`Auto refresh tick failed with error. This is likely a transient error.`,e)}}finally{this._debug(`#_autoRefreshTokenTick()`,`end`)}})}catch(e){if(e instanceof gi)this._debug(`auto refresh token tick lock not available`);else throw e}return}if(this.refreshingDeferred!==null){this._debug(`#_autoRefreshTokenTick()`,`refresh already in flight, skipping`);return}try{let e=Date.now();try{await this._useSession(async t=>{let{data:{session:n}}=t;if(!n||!n.refresh_token||!n.expires_at){this._debug(`#_autoRefreshTokenTick()`,`no session`);return}let r=Math.floor((n.expires_at*1e3-e)/M);this._debug(`#_autoRefreshTokenTick()`,`access token expires in ${r} ticks, a tick lasts ${M}ms, refresh threshold is 3 ticks`),r<=3&&await this._callRefreshToken(n.refresh_token)})}catch(e){console.error(`Auto refresh tick failed with error. This is likely a transient error.`,e)}}finally{this._debug(`#_autoRefreshTokenTick()`,`end`)}}async _handleVisibilityChange(){if(this._debug(`#_handleVisibilityChange()`),!B()||!(window!=null&&window.addEventListener))return this.autoRefreshToken&&this.startAutoRefresh(),!1;try{this.visibilityChangedCallback=async()=>{try{await this._onVisibilityChanged(!1)}catch(e){this._debug(`#visibilityChangedCallback`,`error`,e)}},window==null||window.addEventListener(`visibilitychange`,this.visibilityChangedCallback),await this._onVisibilityChanged(!0)}catch(e){console.error(`_handleVisibilityChange`,e)}}async _onVisibilityChanged(e){let t=`#_onVisibilityChanged(${e})`;if(this._debug(t,`visibilityState`,document.visibilityState),document.visibilityState===`visible`){if(this.autoRefreshToken&&this._startAutoRefresh(),!e)if(await this.initializePromise,this.lock!=null)await this._acquireLock(this.lockAcquireTimeout,async()=>{if(document.visibilityState!==`visible`){this._debug(t,`acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting`);return}await this._recoverAndRefresh()});else{if(document.visibilityState!==`visible`){this._debug(t,`visibilityState is no longer visible, skipping recovery`);return}await this._recoverAndRefresh()}}else document.visibilityState===`hidden`&&this.autoRefreshToken&&this._stopAutoRefresh()}async _getUrlForProvider(e,t,n){let r=n?.redirectTo,i=null,a=null,o=null;this.flowType===`pkce`&&([i,a,o]=await this._getCodeChallengeAndMethod(),r=this._maybeAppendFlowIdToRedirect(r,o));let s=[`provider=${encodeURIComponent(t)}`];if(r&&s.push(`redirect_to=${encodeURIComponent(r)}`),n?.scopes&&s.push(`scopes=${encodeURIComponent(n.scopes)}`),i!=null&&a!=null){let e=new URLSearchParams({code_challenge:`${encodeURIComponent(i)}`,code_challenge_method:`${encodeURIComponent(a)}`});s.push(e.toString())}if(n?.queryParams){let e=new URLSearchParams(n.queryParams);s.push(e.toString())}return n?.skipBrowserRedirect&&s.push(`skip_http_redirect=${n.skipBrowserRedirect}`),{url:`${e}?${s.join(`&`)}`,flowId:o}}_maybeAppendFlowIdToRedirect(e,t){return!e||!t||!this.experimental.appendPkceFlowIdToRedirects?e??void 0:qr(e,t)}async _getCodeChallengeAndMethod(e=!1){return Jr(this.storage,this.storageKey,e,e=>this._debug(`#_getCodeChallengeAndMethod()`,`evicted oldest pending PKCE verifier slot`,e))}async _unenroll(e){try{return await this._useSession(async t=>{let{data:n,error:r}=t;return r?this._returnResult({data:null,error:r}):await J(this.fetch,`DELETE`,`${this.url}/factors/${e.factorId}`,{headers:this.headers,jwt:n?.session?.access_token})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _enroll(e){try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)return this._returnResult({data:null,error:r});let i=Object.assign({friendly_name:e.friendlyName,factor_type:e.factorType},e.factorType===`phone`?{phone:e.phone}:e.factorType===`totp`?{issuer:e.issuer}:{}),{data:a,error:o}=await J(this.fetch,`POST`,`${this.url}/factors`,{body:i,headers:this.headers,jwt:n?.session?.access_token});return o?this._returnResult({data:null,error:o}):(e.factorType===`totp`&&a.type===`totp`&&a?.totp?.qr_code&&(a.totp.qr_code=`data:image/svg+xml;utf-8,${a.totp.qr_code}`),this._returnResult({data:a,error:null}))})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _verify(e){let t=async()=>{try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)return this._returnResult({data:null,error:r});let i=Object.assign({challenge_id:e.challengeId},`webauthn`in e?{webauthn:Object.assign(Object.assign({},e.webauthn),{credential_response:e.webauthn.type===`create`?Ni(e.webauthn.credential_response):Pi(e.webauthn.credential_response)})}:{code:e.code}),{data:a,error:o}=await J(this.fetch,`POST`,`${this.url}/factors/${e.factorId}/verify`,{body:i,headers:this.headers,jwt:n?.session?.access_token});return o?this._returnResult({data:null,error:o}):(await this._saveSession(Object.assign({expires_at:Math.round(Date.now()/1e3)+a.expires_in},a)),await this._notifyAllSubscribers(`MFA_CHALLENGE_VERIFIED`,a),this._returnResult({data:a,error:o}))})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}};return this.lock==null?t():this._acquireLock(this.lockAcquireTimeout,t)}async _challenge(e){let t=async()=>{try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)return this._returnResult({data:null,error:r});let i=await J(this.fetch,`POST`,`${this.url}/factors/${e.factorId}/challenge`,{body:e,headers:this.headers,jwt:n?.session?.access_token});if(i.error)return i;let{data:a}=i;if(a.type!==`webauthn`)return{data:a,error:null};switch(a.webauthn.type){case`create`:return{data:Object.assign(Object.assign({},a),{webauthn:Object.assign(Object.assign({},a.webauthn),{credential_options:Object.assign(Object.assign({},a.webauthn.credential_options),{publicKey:ji(a.webauthn.credential_options.publicKey)})})}),error:null};case`request`:return{data:Object.assign(Object.assign({},a),{webauthn:Object.assign(Object.assign({},a.webauthn),{credential_options:Object.assign(Object.assign({},a.webauthn.credential_options),{publicKey:Mi(a.webauthn.credential_options.publicKey)})})}),error:null}}})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}};return this.lock==null?t():this._acquireLock(this.lockAcquireTimeout,t)}async _challengeAndVerify(e){let{data:t,error:n}=await this._challenge({factorId:e.factorId});return n?this._returnResult({data:null,error:n}):await this._verify({factorId:e.factorId,challengeId:t.id,code:e.code})}async _listFactors(){let{data:{user:e},error:t}=await this.getUser();if(t)return{data:null,error:t};let n={all:[],phone:[],totp:[],webauthn:[],recovery_code:[]};for(let t of e?.factors??[])n.all.push(t),t.status===`verified`&&t.factor_type in n&&Array.isArray(n[t.factor_type])&&n[t.factor_type].push(t);return{data:n,error:null}}async _getAuthenticatorAssuranceLevel(e){if(e)try{let{payload:t}=jr(e),n=null;t.aal&&(n=t.aal);let r=n,{data:{user:i},error:a}=await this.getUser(e);if(a)return this._returnResult({data:null,error:a});((i?.factors)?.filter(e=>e.status===`verified`)??[]).length>0&&(r=`aal2`);let o=t.amr||[];return{data:{currentLevel:n,nextLevel:r,currentAuthenticationMethods:o},error:null}}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}let{data:{session:t},error:n}=await this.getSession();if(n)return this._returnResult({data:null,error:n});if(!t)return{data:{currentLevel:null,nextLevel:null,currentAuthenticationMethods:[]},error:null};let{payload:r}=jr(t.access_token),i=null;r.aal&&(i=r.aal);let a=i;(t.user.factors?.filter(e=>e.status===`verified`)??[]).length>0&&(a=`aal2`);let o=r.amr||[];return{data:{currentLevel:i,nextLevel:a,currentAuthenticationMethods:o},error:null}}async _getRecoveryCodesStatus(){ei(this.experimental);try{return await this._useSession(async e=>{let{data:t,error:n}=e;if(n)return this._returnResult({data:null,error:n});let{data:r,error:i}=await J(this.fetch,`GET`,`${this.url}/factors/recovery-codes`,{headers:this.headers,jwt:t?.session?.access_token});return i?this._returnResult({data:null,error:i}):this._returnResult({data:r,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _generateRecoveryCodes(e){ei(this.experimental);try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)return this._returnResult({data:null,error:r});let{data:i,error:a}=await J(this.fetch,`POST`,`${this.url}/factors/recovery-codes`,{body:e?.friendlyName?{friendly_name:e.friendlyName}:void 0,headers:this.headers,jwt:n?.session?.access_token});return a?this._returnResult({data:null,error:a}):this._returnResult({data:i,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _verifyRecoveryCode(e){ei(this.experimental);let t=async()=>{try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)return this._returnResult({data:null,error:r});let{data:i,error:a}=await J(this.fetch,`POST`,`${this.url}/factors/recovery-codes/verify`,{body:{code:e.code},headers:this.headers,jwt:n?.session?.access_token});if(a)return this._returnResult({data:null,error:a});let o=Object.assign({expires_at:wr(i.expires_in)},i);return await this._saveSession(o),await this._notifyAllSubscribers(`MFA_CHALLENGE_VERIFIED`,o),this._returnResult({data:i,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}};return this.lock==null?t():this._acquireLock(this.lockAcquireTimeout,t)}async _regenerateRecoveryCodes(){ei(this.experimental);try{return await this._useSession(async e=>{let{data:t,error:n}=e;if(n)return this._returnResult({data:null,error:n});let{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/factors/recovery-codes/regenerate`,{headers:this.headers,jwt:t?.session?.access_token});return i?this._returnResult({data:null,error:i}):this._returnResult({data:r,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _unenrollRecoveryCodes(){ei(this.experimental);try{return await this._useSession(async e=>{let{data:t,error:n}=e;if(n)return this._returnResult({data:null,error:n});let{data:r,error:i}=await J(this.fetch,`DELETE`,`${this.url}/factors/recovery-codes`,{headers:this.headers,jwt:t?.session?.access_token});return i?this._returnResult({data:null,error:i}):this._returnResult({data:r,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _getAuthorizationDetails(e){try{return await this._useSession(async t=>{let{data:{session:n},error:r}=t;return r?this._returnResult({data:null,error:r}):n?await J(this.fetch,`GET`,`${this.url}/oauth/authorizations/${e}`,{headers:this.headers,jwt:n.access_token,xform:e=>({data:e,error:null})}):this._returnResult({data:null,error:new L})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _approveAuthorization(e,t){try{return await this._useSession(async n=>{let{data:{session:r},error:i}=n;if(i)return this._returnResult({data:null,error:i});if(!r)return this._returnResult({data:null,error:new L});let a=await J(this.fetch,`POST`,`${this.url}/oauth/authorizations/${e}/consent`,{headers:this.headers,jwt:r.access_token,body:{action:`approve`},xform:e=>({data:e,error:null})});return a.data&&a.data.redirect_url&&B()&&!t?.skipBrowserRedirect&&window.location.assign(a.data.redirect_url),a})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _denyAuthorization(e,t){try{return await this._useSession(async n=>{let{data:{session:r},error:i}=n;if(i)return this._returnResult({data:null,error:i});if(!r)return this._returnResult({data:null,error:new L});let a=await J(this.fetch,`POST`,`${this.url}/oauth/authorizations/${e}/consent`,{headers:this.headers,jwt:r.access_token,body:{action:`deny`},xform:e=>({data:e,error:null})});return a.data&&a.data.redirect_url&&B()&&!t?.skipBrowserRedirect&&window.location.assign(a.data.redirect_url),a})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _listOAuthGrants(){try{return await this._useSession(async e=>{let{data:{session:t},error:n}=e;return n?this._returnResult({data:null,error:n}):t?await J(this.fetch,`GET`,`${this.url}/user/oauth/grants`,{headers:this.headers,jwt:t.access_token,xform:e=>({data:e,error:null})}):this._returnResult({data:null,error:new L})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _revokeOAuthGrant(e){try{return await this._useSession(async t=>{let{data:{session:n},error:r}=t;return r?this._returnResult({data:null,error:r}):n?(await J(this.fetch,`DELETE`,`${this.url}/user/oauth/grants`,{headers:this.headers,jwt:n.access_token,query:{client_id:e.clientId},noResolveJson:!0}),{data:{},error:null}):this._returnResult({data:null,error:new L})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async fetchJwk(e,t={keys:[]}){let n=t.keys.find(t=>t.kid===e);if(n)return n;let r=Date.now();if(n=this.jwks.keys.find(t=>t.kid===e),n&&this.jwks_cached_at+6e5>r)return n;let{data:i,error:a}=await J(this.fetch,`GET`,`${this.url}/.well-known/jwks.json`,{headers:this.headers});if(a)throw a;return!i.keys||i.keys.length===0||(this.jwks=i,this.jwks_cached_at=r,n=i.keys.find(t=>t.kid===e),!n)?null:n}async getClaims(e,t={}){try{let n=e;if(!n){let{data:e,error:t}=await this.getSession();if(t||!e.session)return this._returnResult({data:null,error:t});n=e.session.access_token}let{header:r,payload:i,signature:a,raw:{header:o,payload:s}}=jr(n);if(!t?.allowExpired)try{Zr(i.exp)}catch(e){throw new fr(e instanceof Error?e.message:`JWT validation failed`)}let c=!r.alg||r.alg.startsWith(`HS`)||!r.kid||!(`crypto`in globalThis&&`subtle`in globalThis.crypto)?null:await this.fetchJwk(r.kid,t?.keys?{keys:t.keys}:t?.jwks);if(!c){let{error:e}=await this.getUser(n);if(e)throw e;return{data:{claims:i,header:r,signature:a},error:null}}let l=Qr(r.alg),u=await crypto.subtle.importKey(`jwk`,c,l,!0,[`verify`]);if(!await crypto.subtle.verify(l,u,a,Cr(`${o}.${s}`)))throw new fr(`Invalid JWT signature`);return{data:{claims:i,header:r,signature:a},error:null}}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async signInWithPasskey(e){try{if(!Ii())return this._returnResult({data:null,error:new F(`Browser does not support WebAuthn`,null)});let{data:t,error:n}=await this._startPasskeyAuthentication({options:{captchaToken:e?.options?.captchaToken}});if(n||!t)return this._returnResult({data:null,error:n});let{data:r,error:i}=await Ri({publicKey:Mi(t.options),signal:e?.options?.signal??Ai.createNewAbortSignal(),mediation:e?.options?.mediation});if(i||!r)return this._returnResult({data:null,error:i??new F(`WebAuthn ceremony failed`,null)});let a=Pi(r);return this._verifyPasskeyAuthentication({challengeId:t.challenge_id,credential:a})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async registerPasskey(e){try{if(!Ii())return this._returnResult({data:null,error:new F(`Browser does not support WebAuthn`,null)});let{data:t,error:n}=await this._startPasskeyRegistration();if(n||!t)return this._returnResult({data:null,error:n});let{data:r,error:i}=await Li({publicKey:ji(t.options),signal:e?.options?.signal??Ai.createNewAbortSignal()});if(i||!r)return this._returnResult({data:null,error:i??new F(`WebAuthn ceremony failed`,null)});let a=Ni(r);return this._verifyPasskeyRegistration({challengeId:t.challenge_id,credential:a})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _startPasskeyRegistration(){try{return await this._useSession(async e=>{let{data:{session:t},error:n}=e;if(n)return this._returnResult({data:null,error:n});if(!t)return this._returnResult({data:null,error:new L});let{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/passkeys/registration/options`,{headers:this.headers,jwt:t.access_token,body:{}});return i?this._returnResult({data:null,error:i}):this._returnResult({data:r,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _verifyPasskeyRegistration(e){try{return await this._useSession(async t=>{let{data:{session:n},error:r}=t;if(r)return this._returnResult({data:null,error:r});if(!n)return this._returnResult({data:null,error:new L});let{data:i,error:a}=await J(this.fetch,`POST`,`${this.url}/passkeys/registration/verify`,{headers:this.headers,jwt:n.access_token,body:{challenge_id:e.challengeId,credential:e.credential}});return a?this._returnResult({data:null,error:a}):this._returnResult({data:i,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _startPasskeyAuthentication(e){try{let{data:t,error:n}=await J(this.fetch,`POST`,`${this.url}/passkeys/authentication/options`,{headers:this.headers,body:{gotrue_meta_security:{captcha_token:e?.options?.captchaToken}}});return n?this._returnResult({data:null,error:n}):this._returnResult({data:t,error:null})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _verifyPasskeyAuthentication(e){try{let{data:t,error:n}=await J(this.fetch,`POST`,`${this.url}/passkeys/authentication/verify`,{headers:this.headers,body:{challenge_id:e.challengeId,credential:e.credential},xform:Y});return n?this._returnResult({data:null,error:n}):(t.session&&(await this._saveSession(t.session),await this._notifyAllSubscribers(`SIGNED_IN`,t.session)),this._returnResult({data:t,error:null}))}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _listPasskeys(){try{return await this._useSession(async e=>{let{data:{session:t},error:n}=e;if(n)return this._returnResult({data:null,error:n});if(!t)return this._returnResult({data:null,error:new L});let{data:r,error:i}=await J(this.fetch,`GET`,`${this.url}/passkeys`,{headers:this.headers,jwt:t.access_token,xform:e=>({data:e,error:null})});return i?this._returnResult({data:null,error:i}):this._returnResult({data:r,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _updatePasskey(e){try{return await this._useSession(async t=>{let{data:{session:n},error:r}=t;if(r)return this._returnResult({data:null,error:r});if(!n)return this._returnResult({data:null,error:new L});let{data:i,error:a}=await J(this.fetch,`PATCH`,`${this.url}/passkeys/${e.passkeyId}`,{headers:this.headers,jwt:n.access_token,body:{friendly_name:e.friendlyName}});return a?this._returnResult({data:null,error:a}):this._returnResult({data:i,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _deletePasskey(e){try{return await this._useSession(async t=>{let{data:{session:n},error:r}=t;if(r)return this._returnResult({data:null,error:r});if(!n)return this._returnResult({data:null,error:new L});let{error:i}=await J(this.fetch,`DELETE`,`${this.url}/passkeys/${e.passkeyId}`,{headers:this.headers,jwt:n.access_token,noResolveJson:!0});return i?this._returnResult({data:null,error:i}):this._returnResult({data:null,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}};qi.nextInstanceID={};var Ji=qi,Yi=mi,Xi=Ji,Zi=class extends Xi{constructor(e){super(e)}},Qi=class{constructor(e,t,n){this.supabaseUrl=e,this.supabaseKey=t;let r=Un(e);if(!t)throw Error(`supabaseKey is required.`);Nn(t),Vn(n),this.realtimeUrl=new URL(`realtime/v1`,r),this.realtimeUrl.protocol=this.realtimeUrl.protocol.replace(`http`,`ws`),this.authUrl=new URL(`auth/v1`,r),this.storageUrl=new URL(`storage/v1`,r),this.functionsUrl=new URL(`functions/v1`,r);let i=`sb-${r.hostname.split(`.`)[0]}-auth-token`,a={db:yn,realtime:xn,auth:{...bn,storageKey:i},global:vn,tracePropagation:Sn},o=Hn(n??{},a);this.settings=o,this.storageKey=o.auth.storageKey??``,this.headers=o.global.headers??{},o.accessToken?(this.accessToken=o.accessToken,this.auth=new Proxy({},{get:(e,t)=>{throw Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(t)} is not possible`)}})):this.auth=this._initSupabaseAuthClient(o.auth??{},this.headers,o.global.fetch),this.fetch=Pn(t,e,this._getSessionToken.bind(this),o.global.fetch,o.tracePropagation),this.functionsFetch=Pn(t,e,this._getSessionToken.bind(this),o.global.fetch,o.tracePropagation,{omitApiKeyAsBearer:!0}),this.realtime=this._initRealtimeClient({headers:this.headers,accessToken:this._getAccessToken.bind(this),fetch:this.fetch,...o.realtime}),this.accessToken&&Promise.resolve(this.accessToken()).then(e=>this.realtime.setAuth(e)).catch(e=>console.warn(`Failed to set initial Realtime auth token:`,e)),this.rest=new fe(new URL(`rest/v1`,r).href,{headers:this.headers,schema:o.db.schema,fetch:this.fetch,timeout:o.db.timeout,urlLengthLimit:o.db.urlLengthLimit,retry:o.db.retry}),this.storage=new mn(this.storageUrl.href,this.headers,this.fetch,n?.storage),o.accessToken||this._listenForAuthEvents()}get functions(){return new l(this.functionsUrl.href,{headers:this.headers,customFetch:this.functionsFetch})}from(e){return this.rest.from(e)}schema(e){return this.rest.schema(e)}getOpenApiSpec(){return this.rest.getOpenApiSpec()}rpc(e,t={},n={head:!1,get:!1,count:void 0}){return this.rest.rpc(e,t,n)}channel(e,t={config:{}}){return this.realtime.channel(e,t)}getChannels(){return this.realtime.getChannels()}removeChannel(e){return this.realtime.removeChannel(e)}removeAllChannels(){return this.realtime.removeAllChannels()}async _getSessionToken(){if(this.accessToken)return await this.accessToken();let{data:e}=await this.auth.getSession();return e.session?.access_token??null}async _getAccessToken(){return await this._getSessionToken()??this.supabaseKey}_initSupabaseAuthClient({autoRefreshToken:e,persistSession:t,detectSessionInUrl:n,storage:r,userStorage:i,storageKey:a,flowType:o,lock:s,debug:c,throwOnError:l,experimental:u,lockAcquireTimeout:d,skipAutoInitialize:f},p,m){let h={Authorization:`Bearer ${this.supabaseKey}`,apikey:`${this.supabaseKey}`};return new Zi({url:this.authUrl.href,headers:{...h,...p},storageKey:a,autoRefreshToken:e,persistSession:t,detectSessionInUrl:n,storage:r,userStorage:i,flowType:o,lock:s,debug:c,throwOnError:l,experimental:u,fetch:m,lockAcquireTimeout:d,skipAutoInitialize:f,hasCustomAuthorizationHeader:Object.keys(this.headers).some(e=>e.toLowerCase()===`authorization`)})}_initRealtimeClient(e){return new _t(this.realtimeUrl.href,{...e,params:{apikey:this.supabaseKey,...e?.params}})}_listenForAuthEvents(){return this.auth.onAuthStateChange((e,t)=>{this._handleTokenChanged(e,`CLIENT`,t?.access_token)})}_handleTokenChanged(e,t,n){(e===`TOKEN_REFRESHED`||e===`SIGNED_IN`||e===`INITIAL_SESSION`)&&this.changedAccessToken!==n?(this.changedAccessToken=n,this.realtime.setAuth(n)):e===`SIGNED_OUT`&&(this.realtime.setAuth(),t==`STORAGE`&&this.auth.signOut(),this.changedAccessToken=void 0)}};let $i=(e,t,n)=>new Qi(e,t,n);function ea(){if(typeof window<`u`||globalThis.Deno!==void 0)return!1;let e=globalThis.process;if(!e)return!1;let t=e.version;if(t==null)return!1;let n=t.match(/^v(\d+)\./);return n?parseInt(n[1],10)<=20:!1}return ea()&&console.warn(`⚠️  Node.js 20 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 22 or later. For more information, visit: https://github.com/orgs/supabase/discussions/45715`),e.AuthAdminApi=Yi,e.AuthApiError=Zn,e.AuthClient=Xi,e.AuthError=Xn,e.AuthImplicitGrantRedirectError=tr,e.AuthInvalidCredentialsError=er,e.AuthInvalidJwtError=fr,e.AuthInvalidTokenResponseError=R,e.AuthPKCECodeVerifierMissingError=ir,e.AuthPKCEGrantCodeExchangeError=rr,e.AuthRefreshDiscardedError=cr,e.AuthRetryableFetchError=or,e.AuthSessionMissingError=L,e.AuthUnknownError=F,e.AuthWeakPasswordError=ur,e.CustomAuthError=I,Object.defineProperty(e,`FunctionRegion`,{enumerable:!0,get:function(){return c}}),e.FunctionsError=i,e.FunctionsFetchError=a,e.FunctionsHttpError=s,e.FunctionsRelayError=o,e.GoTrueAdminApi=mi,e.GoTrueClient=Ji,e.NavigatorLockAcquireTimeoutError=_i,e.PostgrestError=u,e.REALTIME_CHANNEL_STATES=ut,Object.defineProperty(e,`REALTIME_LISTEN_TYPES`,{enumerable:!0,get:function(){return T}}),Object.defineProperty(e,`REALTIME_POSTGRES_CHANGES_LISTEN_EVENT`,{enumerable:!0,get:function(){return lt}}),Object.defineProperty(e,`REALTIME_PRESENCE_LISTEN_EVENTS`,{enumerable:!0,get:function(){return Xe}}),Object.defineProperty(e,`REALTIME_SUBSCRIBE_STATES`,{enumerable:!0,get:function(){return E}}),e.RealtimeChannel=dt,e.RealtimeClient=_t,e.RealtimePostgresFilterBuilder=st,e.RealtimePresence=Ze,e.SIGN_OUT_SCOPES=pi,e.StorageApiError=Pt,e.SupabaseClient=Qi,e.WebSocketFactory=pe,e.createClient=$i,e.isAuthApiError=Qn,e.isAuthError=P,e.isAuthImplicitGrantRedirectError=nr,e.isAuthPKCECodeVerifierMissingError=ar,e.isAuthRefreshDiscardedError=lr,e.isAuthRetryableFetchError=sr,e.isAuthSessionMissingError=$n,e.isAuthWeakPasswordError=dr,e.lockInternals=Z,e.navigatorLock=yi,e.postgresChangesFilter=ct,e.processLock=xi,e})({});
;
'use strict';
window.IASDPIAuth = (() => {
  let client=null, session=null, access=null, verification=null, generation=0, recovery=null;
  let scopedUser=null,accessChurch=null,identityChurch=null;
  const churchCode=()=>window.IASDPIChurches?.selected()||'IASD_PI';
  let phase='recovering', statusMessage='Recuperando sessão…', signingIn=false, expiryTimer=null;
  const publicPages=new Set(['organization','agendas','login','invite','forgot-password','reset-password','schedule-setup','schedule-calendar','schedule-build','schedule-members','schedule-settings','access-admin','access-audit','access-request','controlled-reset','events']);
  const rememberKey=IASDPIStorage.authSession+':remember';
  let remember=true;try{remember=localStorage.getItem(rememberKey)!=='false';}catch(_){}
  const remembers=()=>{try{return localStorage.getItem(rememberKey)!=='false';}catch(_){return remember;}};
  const sessionStore={getItem:key=>(remembers()?localStorage:sessionStorage).getItem(key),setItem:(key,value)=>{const keep=remembers();(keep?localStorage:sessionStorage).setItem(key,value);(keep?sessionStorage:localStorage).removeItem(key);},removeItem:key=>{localStorage.removeItem(key);sessionStorage.removeItem(key);}};
  function setRemember(value){remember=value;localStorage.setItem(rememberKey,String(value));}
  function rememberField(){return `<label class="checkbox auth-remember"><input type="checkbox" name="remember" ${remember?'checked':''}> Manter conectado</label>`;}
  function config(){
    let saved={};try{saved=JSON.parse(localStorage.getItem(IASDPIStorage.cloudConfig)||'{}');}catch(_){}
    return {url:window.IASDPIConfig?.supabaseUrl || '',key:window.IASDPIConfig?.supabasePublishableKey || saved.key || ''};
  }
  function validateConfig(value){
    const parsed=new URL(value.url);
    if(parsed.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(parsed.host)||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)throw Error('Configure a URL pública do Supabase.');
    if(!value.key.startsWith('sb_publishable_')&&!value.key.startsWith('eyJ'))throw Error('Configure somente a chave pública publishable/anon.');
    if(value.key.startsWith('eyJ')){try{if(JSON.parse(atob(value.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role!=='anon')throw Error();}catch(_){throw Error('Use somente a chave pública anon, nunca service_role.');}}
  }
  function remoteRequestAllowed(path,method='GET'){
    if(window.IASDPIConfig?.remoteDisabled===true)return false;
    if(!window.IASDPIConfig?.remoteReadOnly)return true;
    if(method==='GET')return /^\/auth\/v1\/(health|settings|user)$/.test(path)||/^\/rest\/v1\/(iasdpi_access|iasdpi_templates|culto_archives)(?:\?|$)/.test(path);
    if(method!=='POST')return false;
    return path==='/functions/v1/alias-login'||path==='/auth/v1/token?grant_type=password'||path==='/auth/v1/token?grant_type=refresh_token'||path==='/auth/v1/logout?scope=local'||
      ['/rest/v1/rpc/iasdpi_event_preview','/rest/v1/rpc/iasdpi_schedule_visible','/rest/v1/rpc/iasdpi_events_visible','/rest/v1/rpc/iasdpi_events_catalog','/rest/v1/rpc/iasdpi_event_history','/rest/v1/rpc/iasdpi_events_published','/rest/v1/rpc/iasdpi_registry_identity_preview','/rest/v1/rpc/iasdpi_registry_audit','/rest/v1/rpc/iasdpi_registry_history','/rest/v1/rpc/iasdpi_registry_public','/rest/v1/rpc/iasdpi_registry_people','/rest/v1/rpc/iasdpi_registry_catalog','/rest/v1/rpc/iasdpi_schedule_department_days','/rest/v1/rpc/iasdpi_schedule_elder_workspace','/rest/v1/rpc/iasdpi_schedule_elder_versions','/rest/v1/rpc/iasdpi_portal_context','/rest/v1/rpc/iasdpi_my_churches','/rest/v1/rpc/iasdpi_schedule_published','/rest/v1/rpc/iasdpi_governance_catalog','/rest/v1/rpc/iasdpi_governance_history','/rest/v1/rpc/iasdpi_department_members','/rest/v1/rpc/iasdpi_access_requests','/rest/v1/rpc/iasdpi_access_request_options','/rest/v1/rpc/iasdpi_alias_list','/rest/v1/rpc/iasdpi_list_churches','/rest/v1/rpc/iasdpi_schedule_catalog','/rest/v1/rpc/iasdpi_schedule_person_details','/rest/v1/rpc/iasdpi_schedule_rotation_context','/rest/v1/rpc/iasdpi_schedule_workspace','/rest/v1/rpc/iasdpi_schedule_plan_version','/rest/v1/rpc/iasdpi_schedule_settings_get','/rest/v1/rpc/iasdpi_schedule_members','/rest/v1/rpc/iasdpi_schedule_person_history','/rest/v1/rpc/iasdpi_schedule_exceptions','/rest/v1/rpc/iasdpi_list_users','/rest/v1/rpc/iasdpi_list_invites','/rest/v1/rpc/iasdpi_find_account'].includes(path);
  }
  function rpcPath(path){return window.IASDPIConfig?.isolatedPilot?path.replace(/^\/rest\/v1\/rpc\/iasdpi_(?=(?:schedule_|registry_|events_|event_|(?:portal_context|my_churches|list_churches|current_church_id|initial_status)(?:$|\?)))/,'/rest/v1/rpc/iasdpi_pilot_'):path;}
  async function jsonRequest(path,options={}){
    if(window.IASDPIConfig?.initialOperational&&path.startsWith('/rest/v1/rpc/')&&!['/rest/v1/rpc/iasdpi_initial_status','/rest/v1/rpc/iasdpi_list_churches'].includes(path))await window.IASDPIInitialConnection?.check();
    if(!remoteRequestAllowed(path,(options.method||'GET').toUpperCase()))throw Error(window.IASDPIConfig?.remoteDisabled?'Conexão preparada; acesso remoto ainda desativado.':'Homologação em modo de consulta: alterações remotas estão bloqueadas.');
    // Esta RPC é pública por RLS. O contexto original só é utilizado se constar
    // na lista pública autorizada; não seleciona igreja nem amplia acesso privado.
    const publicRegistry=['/rest/v1/rpc/iasdpi_registry_public','/rest/v1/rpc/iasdpi_events_published'].includes(path)&&window.IASDPIChurches?.enabled()&&!IASDPIChurches.selected();
    if(publicRegistry){const churches=await IASDPIChurches.load();if(!churches.some(c=>c.code==='IASD_PI'))throw Error('Igreja original indisponível para consulta pública.');}
    else if(path.startsWith('/rest/v1/')&&window.IASDPIChurches)await IASDPIChurches.ensure();
    const cfg=config();validateConfig(cfg);
    const churchHeaders=publicRegistry?{'x-iasdpi-church':'IASD_PI'}:path.startsWith('/rest/v1/')?(window.IASDPIChurches?.headers()||{}):{};
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(cfg.url+rpcPath(path),{...options,signal:controller.signal,headers:{apikey:cfg.key,...options.headers,...churchHeaders}});
      if(!response.ok){
        if(path.startsWith('/rest/v1/rpc/')){
          let error={};try{error=await response.json();}catch(_){}
          if(path.startsWith('/rest/v1/rpc/iasdpi_schedule_')){
            const departmentDays=path==='/rest/v1/rpc/iasdpi_schedule_department_days'||path==='/rest/v1/rpc/iasdpi_schedule_department_days_save';
            if(error.code==='PGRST202'&&departmentDays){const failure=Error('Dias do departamento indisponíveis: revise a instalação da migração 016.');failure.code=error.code;throw failure;}
            const management=['iasdpi_schedule_rotation_context','iasdpi_schedule_workspace','iasdpi_schedule_plan_version','iasdpi_schedule_event_create','iasdpi_schedule_plan_save','iasdpi_schedule_settings_get','iasdpi_schedule_settings_save','iasdpi_schedule_generate_days','iasdpi_schedule_members','iasdpi_schedule_member_save','iasdpi_schedule_person_history','iasdpi_schedule_exceptions','iasdpi_schedule_exception_save'].some(name=>path==='/rest/v1/rpc/'+name);
            const messages={PGRST202:management?'Montagem indisponível: revise a instalação das migrações 005, 006 e 007.':'Cadastros indisponíveis: revise a instalação da migração 005.',23505:management?'Já existe um evento, escala ou atribuição com essa identificação. Reabra o existente; os dados não foram sobrescritos.':'Este vínculo, função ou conta já está cadastrado. Reutilize o cadastro existente.',23503:'Vínculo incompatível ou cadastro de referência inexistente.',23502:'Preencha os campos necessários ao cadastro.', '22P02':'Identificador ou valor inválido. Revise os campos.',22007:'Data ou horário inválido.',22008:'Data ou horário fora do intervalo permitido.'};
            if(messages[error.code]){const failure=Error(messages[error.code]);failure.code=error.code;throw failure;}
          }
          if(['42501','23514','23505','23P01','22023','40001'].includes(error.code)){const failure=Error(String(error.message).slice(0,250));failure.code=error.code;throw failure;}
        }
        throw Error(response.status===401?'Sessão inválida ou expirada. Entre novamente.':'Não foi possível confirmar o acesso. Verifique a conexão e a configuração do Supabase.');
      }
      return response.status===204?null:await response.json();
    }catch(error){if(window.IASDPIConfig?.initialOperational&&(error.name==='AbortError'||error instanceof TypeError))throw Error(error.name==='AbortError'?'O banco demorou para responder. Verifique antes de tentar salvar novamente.':'Não foi possível acessar o banco. Nenhuma gravação foi confirmada.');throw error;}finally{clearTimeout(timer);}
  }

  function status(next,message){phase=next;statusMessage=message;window.dispatchEvent(new Event('iasdpi-session-status'));}
  function allowed(){return Boolean(session&&access&&access.user_id===session.user.id&&accessChurch===churchCode()&&session.expires_at*1000>Date.now());}
  function invalidate(next='expired',message='Sessão expirada. Entre novamente.',dropSession=false){
    generation++;access=null;accessChurch=null;identityChurch=null;verification=null;clearTimeout(expiryTimer);
    if(dropSession){session=null;scopedUser=null;window.dispatchEvent(new Event('iasdpi-identity-ended'));}
    status(next,message);window.dispatchEvent(new Event('iasdpi-auth-changed'));
  }
  function adopt(value){
    const changedUser=Boolean(session?.user.id&&value?.user.id&&session.user.id!==value.user.id);
    if(session?.access_token!==value?.access_token){generation++;verification=null;}
    if(session?.user.id!==value?.user.id)scopedUser=null;
    session=value;
    if(changedUser){access=null;verification=null;window.dispatchEvent(new Event('iasdpi-identity-ended'));window.dispatchEvent(new Event('iasdpi-auth-changed'));}
    clearTimeout(expiryTimer);
    if(value)expiryTimer=setTimeout(()=>{void restore().catch(()=>{});},Math.max(100,Math.min(value.expires_at*1000-Date.now()+50,2147483647)));
  }
  function getClient(){
    if(client)return client;
    const cfg=config();validateConfig(cfg);
    if(!window.supabase?.createClient)throw Error('Não foi possível carregar a autenticação. Recarregue a página.');
    client=window.supabase.createClient(cfg.url,cfg.key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
        storageKey:IASDPIStorage.authSession,storage:sessionStore,flowType:'pkce'},
      global:{fetch:async(input,options={})=>{
        const url=new URL(typeof input==='string'?input:input.url);
        if(url.origin!==cfg.url||!remoteRequestAllowed(url.pathname+url.search,(options.method||'GET').toUpperCase()))throw Error('Operação remota bloqueada no modo de consulta.');
        return fetch(input,options);
      }}
    });
    client.auth.onAuthStateChange((event,value)=>{
      // Callback síncrono: chamadas Auth dentro deste callback podem bloquear o SDK.
      if(event==='PASSWORD_RECOVERY'){
        adopt(value);access=null;recoveryMetadata({uid:value.user.id,until:Math.min(Date.now()+900000,value.expires_at*1000)});status('recovering','Defina sua nova senha.');
      }else if(event==='SIGNED_OUT'){
        recoveryMetadata(null);
        const existed=Boolean(session);adopt(null);
        invalidate(existed?'expired':'anonymous',existed?'Sessão expirada. Entre novamente.':'Entre com uma conta autorizada.',true);
      }else{
        const changed=session?.access_token!==value?.access_token;adopt(value);
        if(value&&changed&&!signingIn&&!passwordRecoveryActive())setTimeout(()=>{void restore().catch(()=>{});},0);
      }
    });
    return client;
  }
  async function verify(){
    if(!session||session.expires_at*1000<=Date.now())throw Error('Sessão expirada. Entre novamente.');
    if(verification)return verification;
    const ticket=generation,token=session.access_token,church=churchCode();
    verification=(async()=>{
      try{
        const headers={Authorization:'Bearer '+token};
        const user=await jsonRequest('/auth/v1/user',{headers});
        if(user.is_anonymous!==false||!user.id)throw Error('Conta sem autorização.');
        await credentialGate(token);
        const rows=await jsonRequest('/rest/v1/iasdpi_access?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id,role,enabled&limit=1',{headers});
        if(!Array.isArray(rows)||rows.length!==1||rows[0].user_id!==user.id||rows[0].enabled!==true||!['admin','leader'].includes(rows[0].role))throw Error('Conta sem autorização. Solicite acesso à administração.');
        if(ticket!==generation||church!==churchCode())throw Error('Sessão ou igreja alterada. Tente novamente.');
        const previousRole=access?.role;access=rows[0];accessChurch=church;identityChurch=church;session.user=user;status('authenticated','Sessão ativa.');
        if(previousRole&&previousRole!==access.role)window.dispatchEvent(new Event('iasdpi-role-changed'));
        return {token,role:access.role,user};
      }catch(error){if(ticket===generation)invalidate(scopedUser===session?.user.id?'scoped':'unavailable',scopedUser===session?.user.id?'Sessão ministerial ativa. As demais áreas exigem autorização própria.':error.message);throw error;}
      finally{if(ticket===generation)verification=null;}
    })();
    return verification;
  }
  async function restore(){
    if(recovery)return recovery;
    recovery=Promise.resolve().then(async()=>{
      if(!allowed())status('recovering','Recuperando sessão…');
      try{
        if(window.IASDPIChurches)await IASDPIChurches.ensure();
        const {data,error}=await getClient().auth.getSession();
        if(error)throw error;
        adopt(data.session);
        if(!session){invalidate('anonymous','Entre com uma conta autorizada.',true);return null;}
        if(passwordRecoveryActive()){status('recovering','Defina sua nova senha.');return null;}
        return await verify();
      }catch(error){
        const expired=error.status===400||error.status===401||/refresh_token|expirada/i.test(error.code||error.message||'');
        const denied=/Conta sem autorização/.test(error.message||'');
        invalidate(denied&&scopedUser===session?.user.id?'scoped':denied?'unauthorized':expired?'expired':'unavailable',denied&&scopedUser===session?.user.id?'Sessão ministerial ativa. As demais áreas exigem autorização própria.':denied?error.message:expired?'Sessão expirada. Entre novamente.':window.IASDPIConfig?.remoteDisabled?'Conexão preparada; acesso remoto ainda desativado.':'Não foi possível recuperar a sessão. Verifique sua conexão e tente novamente.');
        throw error;
      }finally{recovery=null;}
    });
    return recovery;
  }
  async function requireAccess(){
    if(passwordRecoveryActive())throw Error('Conclua a recuperação de senha antes de acessar os registros.');
    if(!session||session.expires_at*1000<=Date.now())await restore();
    return verify();
  }
  // Identidade não concede autorização global. Cada módulo verifica seu escopo no servidor.
  async function credentialGate(token){
    if(!window.IASDPIConfig?.responsibilityGovernanceEnabled)return;
    const result=await jsonRequest('/rest/v1/rpc/iasdpi_password_change_context',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
    if(result.must_change_password){access=null;passwordMessage='Altere sua senha provisória para continuar.';location.hash='#reset-password';throw Error(passwordMessage);}
  }
  async function requireIdentity(){
    if(passwordRecoveryActive())throw Error('Conclua a recuperação de senha.');
    if(window.IASDPIChurches)await IASDPIChurches.ensure();
    const {data,error}=await getClient().auth.getSession();
    if(error||!data.session)throw Error('Entre com uma conta autorizada para este departamento.');
    adopt(data.session);
    const ticket=generation,token=session.access_token,church=churchCode();
    const user=await jsonRequest('/auth/v1/user',{headers:{Authorization:'Bearer '+token}});
    if(ticket!==generation||church!==churchCode()||!user.id||user.id!==session?.user.id||user.is_anonymous!==false)throw Error('Sessão alterada ou inválida. Entre novamente.');
    await credentialGate(token);identityChurch=church;return {token,user};
  }
  const aliasEnabled=()=>window.IASDPIConfig?.aliasLoginEnabled===true;
  function loginIdentifierField(){return aliasEnabled()?field('Identificador ou e-mail','email','','text',true,'autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="254"'):field('E-mail','email','','email',true,'autocomplete="username"');}
  async function aliasSession(identifier,password,cfg){
    const failure=()=>Error('Não foi possível entrar. Confira a identificação e a senha ou tente mais tarde.');
    if(!aliasEnabled()||!window.IASDPIChurches?.enabled())throw Error('Login institucional ainda não ativado. Utilize seu e-mail.');
    identifier=identifier.trim().toLowerCase();if(!/^[a-z][a-z0-9._-]{2,63}$/.test(identifier))throw failure();
    const church=await IASDPIChurches.ensure(),path='/functions/v1/alias-login';
    if(!remoteRequestAllowed(path,'POST'))throw failure();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    let response;try{response=await fetch(cfg.url+path,{method:'POST',redirect:'error',signal:controller.signal,headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({church,identifier,password})});}catch{throw failure();}finally{clearTimeout(timer);}
    if(!response.ok)throw failure();let tokens;try{tokens=await response.json();}catch{throw failure();}
    if(!tokens||typeof tokens.access_token!=='string'||typeof tokens.refresh_token!=='string'||!tokens.access_token||!tokens.refresh_token||church!==IASDPIChurches.selected())throw failure();
    // Persistência e renovação exclusivamente pelo cliente Supabase já existente.
    const result=await getClient().auth.setSession({access_token:tokens.access_token,refresh_token:tokens.refresh_token});
    if(result.error)throw failure();return result;
  }
  async function login(email,password,key,inviteToken,identityOnly=false,options={}){
    if(options.church&&window.IASDPIChurches)await IASDPIChurches.selectForLogin(options.church);
    if(window.IASDPIChurches)await IASDPIChurches.ensure();
    const cfg=config();if(key)cfg.key=key.trim();validateConfig(cfg);
    if(client&&cfg.key!==config().key)throw Error('Recarregue a página após alterar a chave pública.');
    localStorage.setItem(IASDPIStorage.cloudConfig,JSON.stringify(cfg));
    const previousRemember=remember;if(typeof options.remember==='boolean')setRemember(options.remember);
    signingIn=true;status('recovering','Confirmando acesso…');
    try{
      const identifier=String(email||'').trim();
      const {data,error}=identifier.includes('@')?await getClient().auth.signInWithPassword({email:identifier,password}):await aliasSession(identifier,password,cfg);
      if(error)throw Error('Não foi possível entrar. Confira e-mail, senha e conexão.');
      adopt(data.session);
      if(inviteToken)await jsonRequest('/rest/v1/rpc/iasdpi_accept_invite',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_token:inviteToken})});
      if(identityOnly)await requireIdentity();else await verify();window.dispatchEvent(new Event('iasdpi-auth-changed'));
    }catch(error){if(!session)setRemember(previousRemember);invalidate('unavailable',error.message);throw error;}
    finally{signingIn=false;}
  }
  async function signup(email,password,key){
    if(window.IASDPIConfig?.responsibilityGovernanceEnabled)throw Error('Contas individuais são criadas somente pela administração.');
    if(!remoteRequestAllowed('/auth/v1/signup','POST'))throw Error('Cadastro bloqueado no modo de consulta.');
    const cfg=config();if(key)cfg.key=key.trim();validateConfig(cfg);
    localStorage.setItem(IASDPIStorage.cloudConfig,JSON.stringify(cfg));
    const {error}=await getClient().auth.signUp({email,password});if(error)throw Error('Não foi possível concluir o cadastro. Verifique sua conexão.');
  }
  async function logout(){
    if(window.IASDPIScheduleManagement&&!IASDPIScheduleManagement.canLeave())return false;
    if(window.IASDPISchedules&&!IASDPISchedules.canLeave())return false;
    if(window.IASDPIDrafts&&!await IASDPIDrafts.confirmLogout())return false;
    const draftOwner=session?.user.id;
    const {error}=await getClient().auth.signOut({scope:'local'});
    if(error)throw Error('Não foi possível encerrar a sessão. Verifique a conexão e tente novamente.');
    await window.IASDPIDrafts?.clearUser(draftOwner);
    adopt(null);invalidate('anonymous','Sessão encerrada.',true);
    return true;
  }
  // O SDK guarda o verificador PKCE e a sessão. Aqui só há metadados temporários.
  const passwordMarker=IASDPIStorage.authSession+':password-recovery-v1';
  let passwordContext=null,passwordRequestAt=0,passwordMessage='Link ausente, inválido ou expirado. Solicite um novo e abra no mesmo navegador.';
  function recoveryMetadata(value){
    passwordContext=value;
    try{if(value)sessionStorage.setItem(passwordMarker,JSON.stringify(value));else sessionStorage.removeItem(passwordMarker);}catch(_){}
  }
  function passwordRecoveryActive(){
    if(!passwordContext)try{passwordContext=JSON.parse(sessionStorage.getItem(passwordMarker)||'null');}catch(_){}
    return Boolean(session&&passwordContext?.uid===session.user.id&&passwordContext.until>Date.now()&&session.expires_at*1000>Date.now());
  }
  function passwordRedirect(){
    const url=new URL(location.href);
    if(!['https:','http:'].includes(url.protocol)||(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('A recuperação exige o site HTTPS ou uma prévia local autorizada.');
    url.search='';url.hash='reset-password';
    if(url.origin!==location.origin||url.username||url.password)throw Error('Endereço de recuperação inválido.');
    return url.href;
  }
  async function requestPasswordReset(email){
    if(!remoteRequestAllowed('/auth/v1/recover','POST'))throw Error('Envio de e-mail bloqueado nesta prévia de consulta. Use o ambiente de testes autorizado.');
    const redirectTo=passwordRedirect();
    if(Date.now()-passwordRequestAt<60000)throw Error('Aguarde um minuto antes de solicitar outro link.');
    passwordRequestAt=Date.now();
    const {error}=await getClient().auth.resetPasswordForEmail(email,{redirectTo});
    if(error&&error.status===429)throw Error('Muitas solicitações. Aguarde antes de tentar novamente.');
    if(error&&!['user_not_found','email_not_found'].includes(error.code))throw Error('Não foi possível solicitar a recuperação agora. Verifique a conexão e tente novamente mais tarde.');
    return 'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha. Verifique também o spam. Abra o link neste mesmo navegador.';
  }
  async function handlePasswordCallback(){
    const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1));
    const recoveryRoute=url.hash==='#reset-password',implicit=hash.get('type')==='recovery';
    if(!recoveryRoute&&!implicit&&!hash.has('error')&&!hash.has('error_code'))return false;
    const codes=url.searchParams.getAll('code'),code=codes[0],hasError=url.searchParams.has('error')||hash.has('error')||url.searchParams.has('error_code')||hash.has('error_code');
    const flowId=url.searchParams.get('sb_flow_id');
    // Remover códigos/erros antes de qualquer navegação, consulta ou mensagem.
    if(codes.length||hasError||implicit){url.search='';url.hash='reset-password';window.history.replaceState(null,'',url.pathname+url.hash);}
    if(!codes.length&&!hasError&&!implicit)return false;
    recoveryMetadata(null);
    passwordMessage='Conferindo o link de recuperação…';signingIn=true;
    try{
      if(hasError||implicit||codes.length!==1||!code||code.length>2048)throw Error();
      const {data,error}=await getClient().auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
      if(error||data?.redirectType!=='recovery'||!data.session)throw Error();
      adopt(data.session);recoveryMetadata({uid:session.user.id,until:Math.min(Date.now()+900000,session.expires_at*1000)});
      passwordMessage='Link confirmado. Defina sua nova senha.';status('recovering',passwordMessage);
    }catch(_){recoveryMetadata(null);passwordMessage='Link inválido, já utilizado ou expirado. Solicite outro e abra no mesmo navegador da solicitação.';}
    finally{signingIn=false;}
    return true;
  }
  async function updatePassword(password){
    const sdk=getClient(),{data,error}=await sdk.auth.getSession();
    if(error||!data.session){recoveryMetadata(null);passwordMessage='A recuperação expirou. Solicite um novo link.';throw Error(passwordMessage);}
    adopt(data.session);
    if(!passwordRecoveryActive())throw Error('Link inválido ou expirado. Solicite um novo link.');
    if(typeof password!=='string'||password.length<12)throw Error('Use uma senha com pelo menos 12 caracteres.');
    if(window.IASDPIConfig?.responsibilityGovernanceEnabled){await changeOwnPassword(password);recoveryMetadata(null);passwordMessage='Senha redefinida. Aguarde dois segundos e entre novamente.';return;}
    const result=await sdk.auth.updateUser({password});
    if(result.error){if([401,403].includes(result.error.status)){recoveryMetadata(null);passwordMessage='Link expirado. Solicite um novo link.';}throw Error('Não foi possível redefinir a senha. Verifique a conexão, a validade do link e os requisitos de senha do projeto.');}
    recoveryMetadata(null);passwordMessage='Senha redefinida. Entre novamente com a nova senha.';
    const signedOut=await sdk.auth.signOut({scope:'local'});
    adopt(null);invalidate('anonymous',passwordMessage,true);
    if(signedOut.error)throw Error('Senha alterada, mas não foi possível encerrar a sessão local. Recarregue e entre com a nova senha.');
  }
  function forgotPasswordPage(){
    if(bootInProgress)return heading('ACESSO','Recuperar senha')+'<p role="status">Preparando formulário de recuperação…</p>';
    return heading('ACESSO','Recuperar senha','Informe seu e-mail. Esta solicitação não concede autorização de acesso à igreja.')+`<section class="panel auth-panel"><form id="password-request-form">${field('E-mail','email','','email',true,'autocomplete="email"')}<button type="submit" class="primary">Enviar link de recuperação</button><p class="password-feedback" role="status" aria-live="polite"></p></form><p><a href="#login" data-auth-page="login">Voltar para Entrar</a></p></section>`;
  }
  async function changeOwnPassword(password){
    if(!session||!window.IASDPIConfig?.responsibilityGovernanceEnabled)throw Error('Entre para alterar sua senha.');
    const cfg=config(),token=session.access_token;
    if(!remoteRequestAllowed('/functions/v1/access-assistance','POST'))throw Error('Alteração remota bloqueada neste ambiente.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(cfg.url+'/functions/v1/access-assistance',{method:'POST',redirect:'error',signal:controller.signal,headers:{apikey:cfg.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'change_password',church:await IASDPIChurches.ensure(),password})});
      if(!response.ok)throw Error('Não foi possível concluir a alteração. Tente entrar novamente ou procure a administração.');
      const result=await response.json();if(result.completed!==true)throw Error('Alteração não confirmada.');
      await getClient().auth.signOut({scope:'local'});adopt(null);invalidate('anonymous','Senha alterada. Aguarde dois segundos e entre novamente.',true);location.hash='#login';
    }finally{clearTimeout(timer);}
  }
  function resetPasswordPage(){
    if(window.IASDPIConfig?.responsibilityGovernanceEnabled&&session&&!passwordRecoveryActive())return heading('MINHA CONTA','Alterar senha')+`<section class="panel auth-panel"><p role="status">${esc(passwordMessage||'Defina uma senha individual. Não use seu apelido como senha.')}</p><form id="own-password-form">${field('Nova senha','password','','password',true,'minlength="12" maxlength="256" autocomplete="new-password"')}${field('Confirmar nova senha','repeat','','password',true,'minlength="12" maxlength="256" autocomplete="new-password"')}<button class="primary">Alterar senha</button><p role="status" data-password-feedback></p></form></section>`;
    if(bootInProgress)return heading('ACESSO','Definir nova senha')+'<p role="status">Conferindo sessão de recuperação…</p>';
    return heading('ACESSO','Definir nova senha','A redefinição usa uma sessão de recuperação do Supabase e não altera as permissões da conta.')+`<section class="panel auth-panel"><p role="status">${esc(passwordRecoveryActive()?'Link confirmado. Defina sua nova senha.':passwordMessage)}</p>${passwordRecoveryActive()?`<form id="password-reset-form">${field('Nova senha','password','','password',true,'minlength="12" maxlength="256" autocomplete="new-password"')}${field('Confirmar nova senha','repeat','','password',true,'minlength="12" maxlength="256" autocomplete="new-password"')}<button type="submit" class="primary">Definir nova senha</button></form>`:`<p><a href="#forgot-password" data-auth-page="forgot-password">Solicitar novo link</a></p>`}<p><a href="#login" data-auth-page="login">Voltar para Entrar</a></p></section>`;
  }

  function loginPage(){
    return heading('ACESSO RESTRITO','Entrar no IASDPI','Cronogramas, registros, histórico e backups são exclusivos de administradores e líderes autorizados.')+
      `<section class="panel auth-panel"><p role="status">${esc(statusMessage)}</p><form id="auth-login-form">${window.IASDPIChurches?.loginSelector()||''}${loginIdentifierField()}${field('Senha','password','','password',true,'autocomplete="current-password"')}${rememberField()}${`<details ${config().key?'':'open'}><summary>Configuração da conexão</summary><p class="muted">Informe somente a chave pública do projeto.</p>${field('Chave pública publishable/anon','public-key','','text',!config().key,'autocomplete="off"')}</details>`}<button class="primary" type="submit">Entrar</button><p><a href="#forgot-password" data-auth-page="forgot-password">Esqueci minha senha</a></p>${window.IASDPIConfig?.governanceEnabled?'<p><a href="#access-request" data-auth-page="access-request">Solicitar acesso ou recuperação</a></p>':''}<p class="muted">Use Sair em dispositivos compartilhados. A autorização depende da administração da igreja.</p></form></section>`;
  }
  document.addEventListener('submit',e=>{if(e.target.id!=='own-password-form')return;e.preventDefault();e.stopPropagation();const f=e.target,data=new FormData(f),feedback=f.querySelector('[data-password-feedback]'),button=f.querySelector('button');if(data.get('password')!==data.get('repeat')){feedback.textContent='As senhas precisam ser iguais.';return;}button.disabled=true;void changeOwnPassword(String(data.get('password'))).catch(error=>feedback.textContent=error.message).finally(()=>{f.reset();button.disabled=false;});},true);
  document.addEventListener('visibilitychange',()=>{
    if(!client)return;
    if(document.hidden)client.auth.stopAutoRefresh();
    else{client.auth.startAutoRefresh();void restore().catch(()=>{});}
  });
  setInterval(()=>{if(session&&!document.hidden)void requireAccess().catch(()=>{});},60000);
  return {identityKey:()=>session&&!passwordRecoveryActive()&&session.expires_at*1000>Date.now()?session.user.id:null,identityCurrent:token=>session?.access_token===token&&identityChurch===churchCode(),scopeValidated:()=>{scopedUser=session?.user.id;status('scoped','Sessão ministerial ativa. As demais áreas exigem autorização própria.');},requireIdentity,loginIdentifierField,rememberField,loginIdentity:(email,password,options)=>login(email,password,null,null,true,options),rpcPath,config,remoteRequestAllowed,allowed,isAdmin:()=>allowed()&&access.role==='admin',requireAccess,jsonRequest,login,signup,logout,loginPage,restore,requestPasswordReset,handlePasswordCallback,updatePassword,passwordRecoveryActive,forgotPasswordPage,resetPasswordPage,
    status:()=>({phase,message:statusMessage}),isPublic:page=>publicPages.has(page)||Boolean(window.IASDPIPortalAccess?.enabled()&&IASDPIPortalAccess.isPublic(page)),session:()=>allowed()?session:null};
})();

;
'use strict';
// Leitura tolerante, sem mutações. Valores desconhecidos não viram horários fictícios.
const recordClockPattern=/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/;
function validRecordClock(value){return typeof value==='string'&&recordClockPattern.test(value);}
function recordDay(value){
  if(typeof value!=='string')return '';
  let day=value;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(day))day=day.split('/').reverse().join('-');
  if(/^\d{4}-\d{2}-\d{2}$/.test(day)){
    const date=new Date(day+'T12:00:00Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day?day:'';
  }
  if(/^\d{4}-\d{2}-\d{2}[T ]/.test(day)){
    const instant=inspectRecordTime(day);
    return instant.valid?instant.day:'';
  }
  return '';
}
const recordFormatters=Object.freeze({
  civil:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}),
  clock:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}),
  day:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'})
});
function saoPauloInstant(day,clock){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!recordClockPattern.test(clock||''))return null;
  const full=clock.length===5?clock+':00':clock;
  const target=Date.parse(day+'T'+full.slice(0,8)+'Z');if(!Number.isFinite(target))return null;
  let epoch=target;
  const formatter=recordFormatters.civil;
  for(let n=0;n<4;n++){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(p=>[p.type,p.value]));
    const shown=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    if(shown===target){
      const offset=(target-epoch)/60000,absolute=Math.abs(offset);
      return day+'T'+full+(offset>=0?'+':'-')+String(Math.floor(absolute/60)).padStart(2,'0')+':'+String(absolute%60).padStart(2,'0');
    }
    epoch+=target-shown;
  }
  return null; // Horário civil inexistente na mudança de fuso: revisão manual.
}
function inspectRecordTime(value,day){
  const empty=value===null||value===undefined||value==='';
  if(empty)return {valid:false,empty:true,clock:'',epoch:null,iso:null};
  if(value instanceof Date){if(!Number.isFinite(value.getTime()))return {valid:false,empty:false,clock:'',epoch:null,iso:null};value=value.toISOString();}
  if(typeof value!=='string')return {valid:false,empty:false,clock:String(value),epoch:null,iso:null};
  if(recordClockPattern.test(value)){
    const iso=saoPauloInstant(day,value);
    return {valid:true,empty:false,clock:value.length===5?value+':00':value,epoch:iso?Date.parse(iso):null,iso,day,absolute:false};
  }
  const match=value.match(/^(\d{4}-\d{2}-\d{2})[T ]((?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/i);
  if(!match||!recordDay(match[1]))return {valid:false,empty:false,clock:value,epoch:null,iso:null};
  const full=match[2].length===5?match[2]+':00':match[2];
  let offset=match[3]||'';
  if(/^[+-]\d{2}$/.test(offset))offset+=':00';
  if(/^[+-]\d{4}$/.test(offset))offset=offset.slice(0,3)+':'+offset.slice(3);
  const iso=offset?match[1]+'T'+full+offset.toUpperCase():saoPauloInstant(match[1],full);
  const epoch=iso?Date.parse(iso):NaN;
  if(!Number.isFinite(epoch))return {valid:false,empty:false,clock:value,epoch:null,iso:null};
  const clock=recordFormatters.clock.format(new Date(epoch))+(full.match(/\.\d+$/)?.[0]||'');
  return {valid:true,empty:false,clock,epoch,iso,absolute:Boolean(offset),day:recordFormatters.day.format(new Date(epoch))};
}
function recordClock(value,day){const parsed=inspectRecordTime(value,day);return parsed.empty?'':parsed.valid?parsed.clock:String(value);}
function recordEpoch(value,day){const result=inspectRecordTime(value,day);return result.valid?result.epoch:null;}
// Validação compartilhada por backups e indicadores; não normaliza o documento.
function recordInterval(start,end,day){
  const a=inspectRecordTime(start,day),b=inspectRecordTime(end,day);
  const invalid=[a,b].some(v=>!v.empty&&(!v.valid||v.epoch===null||(day&&v.day!==day)));
  if(invalid)return {state:'invalid',minutes:null};
  if(a.empty||b.empty)return {state:'missing',minutes:null};
  if(b.epoch<a.epoch)return {state:'invalid',minutes:null};
  return {state:'valid',minutes:(b.epoch-a.epoch)/60000,start:a.iso,end:b.iso};
}
function activitySamples(original){
  const p=programForMetrics(original),day=recordDay(p.plan.date);
  return p.plan.items.map((item,index)=>{
    const raw=original.plan.items[index],e=original.executions?.[item.id]||{};
    const actual=recordInterval(e.started,e.ended??original.actual_details?.[item.id]?.partial_end,day);
    const planned=recordInterval(raw.planned_start||raw.start,raw.planned_end||raw.end,day);
    const state=actual.state==='invalid'||planned.state==='invalid'?'invalid':actual.state==='missing'||planned.state==='missing'?'missing':'valid';
    return {item,actual,planned,state};
  });
}
function sampleCounts(samples){
  return {considered:samples.filter(s=>s.state==='valid').length,missing:samples.filter(s=>s.state==='missing').length,invalid:samples.filter(s=>s.state==='invalid').length,total:samples.length};
}
function recordInstant(day,clock){
  const parsed=inspectRecordTime(clock,recordDay(day));
  if(!parsed.valid||!parsed.iso)throw Error('Horário ou data inconsistente. Corrija o campo antes de salvar.');
  return parsed.iso;
}
function plannedClock(value){return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d:00(?:\.0+)?$/.test(value)?value.slice(0,5):value;}
function programForMetrics(original){
  const p={...original},rawPlan=original?.plan||{},day=recordDay(rawPlan.date);
  const instant=(value,fallback)=>value===null||value===undefined||value===''?(fallback?saoPauloInstant(day,fallback):null):inspectRecordTime(value,day).iso;
  p.plan={...rawPlan,items:(Array.isArray(rawPlan.items)?rawPlan.items:[]).map(item=>({...item,planned_start:instant(item.planned_start,item.start),planned_end:instant(item.planned_end,item.end)}))};
  p.executions=Object.fromEntries(Object.entries(original?.executions||{}).map(([id,e])=>[id,{...e,started:instant(e?.started),ended:instant(e?.ended)}]));
  p.planned_start=instant(original?.planned_start,rawPlan.start);p.planned_end=instant(original?.planned_end,rawPlan.end);
  return p;
}
function importedTimeWarning(value,day){
  const parsed=inspectRecordTime(value,recordDay(day));
  if(parsed.empty)return '';
  if(!parsed.valid)return 'Horário importado inválido. Revise o valor original e digite HH:mm:ss.';
  if(parsed.day&&recordDay(day)&&parsed.day!==recordDay(day))return 'Horário em outra data. Confira a data do culto e corrija este horário manualmente.';
  return '';
}

// Formatação de apresentação: nunca altera os documentos ou sua precisão original.
function displayPlannedTime(value){
  const parsed=inspectRecordTime(value);
  return parsed.empty?'':parsed.valid?parsed.clock.slice(0,5):String(value);
}
function displayRecordTimestamp(value){
  const parsed=inspectRecordTime(value);
  return parsed.valid&&parsed.day?parsed.day.split('-').reverse().join('/')+' '+parsed.clock.slice(0,8):'Data não informada';
}

;
'use strict';
// Motor compartilhado de regras; o adaptador local continua disponível para rollback.
window.IASDPILocalAdapter = (() => {
    const key = IASDPIStorage.programs;
    const zone = 'America/Sao_Paulo';
    const clone = data => JSON.parse(JSON.stringify(data));
    const date = time => new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(new Date(time));
    const time = stamp => new Intl.DateTimeFormat('pt-BR', { timeZone: zone, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(stamp));
    const instant = (day, clock) => recordInstant(day,clock);
    const stamp = () => new Date().toISOString();
    const id = () => crypto.randomUUID();
    function prepare(input) {
      const p = clone(input);
      if (!p.name?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || date(instant(p.date, '12:00')) !== p.date) throw Error('Informe nome e data válidos.');
      const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
      const emptyFree=p.execution_mode==='manual'&&p.template_id==='free'&&Array.isArray(p.items)&&!p.items.length;
      if (!(emptyFree&&!p.start&&!p.end)&&(!validTime(p.start) || !validTime(p.end) || p.end <= p.start)) throw Error('Informe horários válidos, com término depois do início.');
      if (!Array.isArray(p.items) || (!p.items.length&&!emptyFree) || p.items.length > 100) throw Error('Cadastre entre 1 e 100 atividades.');
      let previous = p.start, previousItem = null;
      const ids = new Set();
      p.items = p.items.map((item, index) => {
        const parallel = p.execution_mode === 'manual' && item.parallel && previousItem?.parallel && item.start === previousItem.start && item.end === previousItem.end;
        if (!validTime(item.start) || !validTime(item.end) || (item.start < previous && !parallel) || item.end <= item.start || item.end > p.end) throw Error(`Atividade ${index+1}: horários sobrepostos, fora de ordem ou fora da programação.`);
        if (!item.activity?.trim() || !item.block?.trim()) throw Error('Informe atividade e bloco.');
        previous = item.end; previousItem = item;
        const identifier = item.id || id();
        if (ids.has(identifier)) throw Error('Identificador de atividade duplicado.');
        ids.add(identifier);
        return {...item, id:identifier, order:index+1, planned_start:instant(p.date,item.start), planned_end:instant(p.date,item.end)};
      });
      return {name:p.name, date:p.date, start:p.start, end:p.end, items:p.items, team:p.team || {},...(p.template_id?{template_id:p.template_id}:{})};
    }
    function make(input, status = 'Planejamento') {
      const plan = prepare(input);
      return {id:id(), execution_mode:input.execution_mode || 'live', plan, status, version:1, note:'', incident:'', paused:false, executions:{}, planned_start:plan.start?instant(plan.date,plan.start):null, planned_end:plan.end?instant(plan.date,plan.end):null};
    }
    function isTestProgram(p) {
      return p.sample_set === 'adherence-v1' ||
        ['Culto · demonstração', 'Próximo culto · exemplo', 'Culto de sábado · exemplo'].includes(p.plan?.name);
    }
    // Não carregar nem modificar registros antes da autorização.
    let memory = [], storageAvailable = true, simulation=false;
    function save(writeSafety=true) {
      if(simulation)return;
      try { const previous=localStorage.getItem(key);if(writeSafety&&previous!==null)localStorage.setItem(IASDPIStorage.safety,previous);localStorage.setItem(key,JSON.stringify(memory)); storageAvailable=true; }
      catch (_) { throw Error('O navegador não permitiu salvar a demonstração. Libere o armazenamento local.'); }
    }
    function performRequest(path, method, body = {}) {
      if (path === 'health') return {status:'ok',timezone:zone,server_time:stamp()};
      if (path === 'programs' && method === 'GET') return clone(memory);
      if (path === 'programs' && method === 'POST') {
        const p=make(body); memory.unshift(p); save(); return clone(p);
      }
      const [,identifier,route] = path.split('/');
      const p = memory.find(p => p.id === identifier);
      if (!p) throw Error('Programação não encontrada.');
      if (method === 'GET') return clone(p);
      if (route === 'duplicate') {
        const plan=clone(p.plan); plan.date=body.date; plan.execution_mode=p.execution_mode || 'live';
        plan.items.forEach(i => {i.id=id();});
        const copy=make(plan); memory.unshift(copy); save(); return clone(copy);
      }
      if(body.version!==p.version){const error=Error('Esta programação mudou. Atualize antes de continuar.');error.code='40001';throw error;}
      if (route === 'correct-date') {
        if(simulation)throw Error('Corrija a data pela edição do registro.');
        if(body.expected!==JSON.stringify(p))throw Error('O registro mudou após a conferência. Reabra a prévia antes de confirmar.');
        const corrected=correctedCultoDate(p);corrected.version++;
        const raw=localStorage.getItem(IASDPIStorage.dateCorrections);
        const backups=raw===null?{version:1,records:[]}:JSON.parse(raw);
        if(backups?.version!==1||!Array.isArray(backups.records))throw Error('Cópia de segurança de data inválida. Nada foi alterado.');
        if(!backups.records.some(entry=>entry.id===p.id)){
          backups.records.push({id:p.id,captured_at:stamp(),program:clone(p)});
          localStorage.setItem(IASDPIStorage.dateCorrections,JSON.stringify(backups));
        }
        memory[memory.indexOf(p)]=corrected;save(false);return clone(corrected);
      }
      if (route === 'actuals') {
        if (p.execution_mode !== 'manual') throw Error('Use uma programação de registro manual.');
        const records = body.executions;
        if (!records || Object.keys(records).length !== p.plan.items.length) throw Error('Envie todos os itens.');
        const nextPlan=recordEditPlan(p,body);
        const executions = {}, details = structuredClone(p.actual_details||{});
        for (const item of p.plan.items) {
          const e=records[item.id];
          if(!e || typeof e.start!=='string' || typeof e.end!=='string') throw Error('Registro de horário inválido.');
          const note=e.note ?? p.actual_details?.[item.id]?.note ?? '', responsible=e.responsible ?? p.actual_details?.[item.id]?.responsible ?? '';
          if(typeof note!=='string'||note.length>2000||typeof responsible!=='string'||responsible.length>200)throw Error('Observação ou responsável inválido.');
          const old=p.actual_details?.[item.id]||{};
          const checked=validateActivityRecord({...e,subactivities:e.subactivities??old.subactivities??[]},item.id);
          details[item.id]={...old,note,responsible,subactivities:checked.subactivities};
          // Status histórico é metadado, nunca requisito ou critério de conclusão.
          if(old.status===undefined&&e.status!==undefined)details[item.id].status=e.status;
          delete details[item.id].partial_end;
          if(!e.start){if(e.end)details[item.id].partial_end=e.end;continue;}
          const prior=p.executions?.[item.id];
          const preserve=(clock,raw)=>raw&&recordDay(nextPlan.date)===recordDay(p.plan.date)&&inspectRecordTime(raw,nextPlan.date).absolute&&inspectRecordTime(raw,nextPlan.date).day===nextPlan.date&&clock===storedActualClock(raw)?raw:instant(nextPlan.date,clock);
          executions[item.id]={...(prior||{}),started:preserve(e.start,prior?.started),ended:e.end?preserve(e.end,prior?.ended):null};
        }
        const complete = p.plan.items.every(item=>executions[item.id]?.started&&executions[item.id]?.ended);
        if(body.finalize&&!p.plan.items.length)throw Error('Adicione atividades antes de finalizar.');
        if(body.finalize && !complete) throw Error('Preencha todas as atividades antes de finalizar.');
        const extraEvents=validateExtraEvents(p,body.extra_events ?? p.extra_events ?? [],Boolean(body.finalize));
        const info=body.record_info??p.record_info??'';if(typeof info!=='string'||info.length>5000)throw Error('Informações complementares inválidas.');
        const wasFinished=p.status==='Finalizada';p.plan=nextPlan;p.planned_start=nextPlan.start?instant(nextPlan.date,nextPlan.start):null;p.planned_end=nextPlan.end?instant(nextPlan.date,nextPlan.end):null;p.record_info=info;
        p.extra_events=extraEvents;p.executions=executions;p.actual_details=details;p.note=body.note??p.note??'';p.incident=body.incident??p.incident??'';
        p.status=body.finalize||wasFinished?'Finalizada':(Object.keys(executions).length||extraEvents.some(e=>e.start))?'Em andamento':'Planejamento';p.paused=false;
      }
      else if (route === 'notes') { p.note=body.note ?? p.note ?? ''; p.incident=body.incident ?? p.incident ?? ''; }
      else if (!route && method === 'PUT') {
        if (!['Planejamento','Pronta'].includes(p.status)) throw Error('O plano fica protegido após o início.');
        const incoming={...body,execution_mode:p.execution_mode || 'live',team:{...p.plan.team,...body.team},items:Array.isArray(body.items)?body.items.map(item=>({...p.plan.items.find(old=>old.id===item.id),...item})):body.items};
        const plan={...p.plan,...prepare(incoming)};p.plan=plan;p.planned_start=plan.start?instant(plan.date,plan.start):null;p.planned_end=plan.end?instant(plan.date,plan.end):null;p.status='Planejamento';
      } else if (route === 'action') {
        if(p.execution_mode==='manual')throw Error('Use o formulário de realizado.');
        const active = p.plan.items.find(i => p.executions[i.id] && !p.executions[i.id].ended);
        const next = p.plan.items.find(i => !p.executions[i.id]);
        const now=stamp();
        if (body.action==='ready' && p.status==='Planejamento') p.status='Pronta';
        else if (body.action==='start' && p.status==='Pronta') {
          if(p.plan.date!==date(new Date())) throw Error('O acompanhamento só pode começar na data da programação.');
          p.executions[p.plan.items[0].id]={started:now,ended:null};p.status='Em andamento';
        } else if (body.action==='next' && active && !p.paused) {
          p.executions[active.id].ended=now;
          if(next) p.executions[next.id]={started:now,ended:null}; else p.status='Finalizada';
        } else if (['pause','resume'].includes(body.action) && p.status==='Em andamento') p.paused=body.action==='pause';
        else throw Error('Ação indisponível para o estado atual.');
      } else throw Error('Operação indisponível.');
      p.version++; save(); return clone(p);
    }
    async function request(path, method, body = {}) {
      if (path === 'health') return performRequest(path, method, body);
      await window.IASDPIAuth.requireAccess();
      if(path==='chronogram'&&method==='GET'){
        const rows=await window.IASDPIAuth.jsonRequest('/rest/v1/iasdpi_templates?id=eq.culto-03102026&select=plan',{headers:{Authorization:'Bearer '+window.IASDPIAuth.session().access_token}});
        if(!rows[0]?.plan)throw Error('Cronograma não configurado. Os registros existentes permanecem preservados.');
        return rows[0].plan;
      }
      const apply=()=>{
      let before;
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          const stored = JSON.parse(raw);
          if (!Array.isArray(stored)) throw Error('Os dados salvos estão inválidos. Não serão sobrescritos.');
          memory = stored;
        }else memory=[];
        before = clone(memory);
        return performRequest(path, method, body);
      } catch (error) {
        if (before) memory = before;
        if (error instanceof SyntaxError) throw Error('Os dados salvos estão inválidos. Não serão sobrescritos.');
        if (error.name === 'SecurityError') throw Error('O navegador bloqueou o armazenamento local. Libere-o para salvar os dados.');
        throw error;
      }
      };
      if(method!=='GET'&&navigator.locks)return navigator.locks.request('iasdpi-records:'+key,apply);
      return apply();
    }

    document.addEventListener('DOMContentLoaded', () => {
      if(!window.IASDPIDemo)return;
      const banner=document.createElement('aside');banner.className='demo-banner';
      banner.textContent='ARMAZENAMENTO LOCAL · Os registros permanecem neste navegador. Guarde uma cópia em Arquivo e banco.' + (storageAvailable ? '' : ' O salvamento está bloqueado neste navegador.');
      document.querySelector('.header').after(banner);
    });
    window.addEventListener('iasdpi-auth-changed',()=>{if(!window.IASDPIAuth.allowed())memory=[];});
    function apply(programs,path,method,body){
      const previous=memory;memory=clone(programs);simulation=true;
      try{return performRequest(path,method,body);}finally{memory=previous;simulation=false;}
    }
    return {request,apply};
})();
if(window.IASDPIConfig?.storageMode!=='supabase'&&(location.hostname.endsWith('.github.io')||new URLSearchParams(location.search).get('demo')==='1'||window.IASDPIConfig?.storageMode==='browser'))window.IASDPIDemo=window.IASDPILocalAdapter;

;
'use strict';
// Banco operacional. Nunca usa localStorage como fallback para leituras/gravações.
if(window.IASDPIConfig?.storageMode==='supabase')window.IASDPIOperational=(()=>{
  const pending=new Map();let templates=[],preview=null,recoveries=[],lastActor=null;
  async function remote(path,method='GET',body,expectedActor=null){
    const access=await IASDPIAuth.requireAccess();
    if(expectedActor&&access.user.id!==expectedActor)throw Error('Este envio pertence a outra sessão. Reentre com a conta original.');
    lastActor=access.user.id;
    try{
      const result=await IASDPIAuth.jsonRequest('/rest/v1/'+path,{method,headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(IASDPIAuth.session()?.access_token!==access.token)throw Error('Sessão alterada. Entre novamente para consultar o resultado.');
      return result;
    }catch(error){
      if(error.code==='40001')throw error;
      throw Error(error.message+(method==='GET'?' Não foi possível concluir a consulta. Os dados já carregados foram preservados.':' Os campos não foram descartados. Nenhuma confirmação de gravação foi recebida.'));
    }
  }
  function outboxDb(){return new Promise((resolve,reject)=>{
    const opening=indexedDB.open(window.IASDPIStorage?.scope?.('iasdpi-pending-writes-v1')||'iasdpi-pending-writes-v1',1);
    opening.onupgradeneeded=()=>opening.result.createObjectStore('writes',{keyPath:'key'});
    opening.onsuccess=()=>resolve(opening.result);opening.onerror=()=>reject(Error('Não foi possível preservar o envio pendente neste dispositivo.'));
  });}
  async function outbox(mode,value,actor=null){
    const db=await outboxDb(),uid=actor||IASDPIAuth.session()?.user.id;
    if(!uid){db.close();throw Error('Entre novamente.');}
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('writes',mode==='list'?'readonly':'readwrite'),store=tx.objectStore('writes');
      const op=mode==='list'?store.getAll():mode==='put'?store.put({...value,key:uid+':'+value.args.p_request_id,uid}):store.delete(uid+':'+value);
      let result;op.onsuccess=()=>result=op.result;
      tx.oncomplete=()=>{db.close();resolve(mode==='list'?result.filter(row=>row.uid===uid):result);};
      tx.onerror=()=>{db.close();reject(Error('Não foi possível atualizar a recuperação local do envio.'));};
    });
  }
  async function commit(document,expected,importing=false,key=document.id){
    const uid=IASDPIAuth.session()?.user.id||lastActor,signature=JSON.stringify([document,expected,importing]);
    let entry=pending.get(key);
    if(entry&&(entry.signature!==signature||entry.uid!==uid)){
      throw Error('Há um envio anterior sem confirmação. Abra Arquivo e banco para conferir ou recuperar esse envio antes de alterar seu conteúdo.');
    }
    if(!entry){entry={uid,signature,args:{p_id:document.id,p_expected_version:expected,p_document:document,p_request_id:crypto.randomUUID(),p_import:importing}};pending.set(key,entry);}
    // Fila de recuperação, não banco operacional. Falha aqui não impede gravar no servidor.
    let recoveryAvailable=true;try{await outbox('put',entry,uid);}catch(_){recoveryAvailable=false;}
    let result;
    try{result=await remote('rpc/iasdpi_save_program','POST',entry.args,entry.uid);}
    catch(error){
      const failure=Error(error.message+(recoveryAvailable?' Envio pendente disponível em Arquivo e banco.':' Recuperação local indisponível: mantenha esta aba aberta para não perder as alterações.'));
      if(error.code==='40001'){failure.code='40001';failure.conflict={id:document.id,expectedVersion:expected,requestId:entry.args.p_request_id,uid:entry.uid,document:structuredClone(document)};}
      throw failure;
    }
    pending.delete(key);try{await outbox('delete',entry.args.p_request_id);}catch(_){/* RPC idempotente permite reconferir após uma resposta confirmada. */}
    return result;
  }
  async function list(){
    const all=[];
    for(let offset=0;;offset+=500){
      const rows=await remote('iasdpi_programs?select=document&deleted_at=is.null&order=id&limit=500&offset='+offset);
      all.push(...rows.map(row=>row.document));if(rows.length<500)break;
    }
    return all;
  }
  async function get(id){
    const rows=await remote('iasdpi_programs?id=eq.'+encodeURIComponent(id)+'&select=document&deleted_at=is.null');
    if(!rows[0])throw Error('Registro não encontrado no Supabase.');return rows[0].document;
  }
  async function request(path,method='GET',body={}){
    if(path==='health')return {timezone:'America/Sao_Paulo',server_time:new Date().toISOString()};
    if(method==='GET')await IASDPIAuth.requireAccess();
    if(path==='chronogram')path='templates/liturgy-i';
    if(path.startsWith('templates/')){
      const id=path.slice(10),rows=await remote('iasdpi_templates?id=eq.'+encodeURIComponent(id)+'&select=plan');
      if(!rows[0])throw Error('Modelo não configurado. Confira a migração 003.');return rows[0].plan;
    }
    if(path==='programs'&&method==='GET')return list();
    const [,id,route]=path.split('/');
    if(id&&method==='GET')return get(id);
    if(route==='correct-date')throw Error('Altere a data pela edição do registro, preservando o mesmo ID.');
    const key=id&&route!=='duplicate'?id:'create:'+path;
    let candidate,expected;
    if(!pending.has(key)){
      try{const queued=(await outbox('list',null,lastActor)).find(row=>row.source===JSON.stringify([path,body]));if(queued)pending.set(key,queued);}catch(_){/* Sem fila local, a confirmação continua dependendo do servidor. */}
    }
    const existingPending=pending.get(key);
    if(existingPending){
      if(existingPending.source!==JSON.stringify([path,body])){
        const failure=Error('Há um envio pendente. Confira-o em Arquivo e banco antes de continuar.');
        if((state.programs.find(p=>p.id===id)?.version||0)>existingPending.args.p_expected_version){failure.code='40001';failure.conflict={id,expectedVersion:existingPending.args.p_expected_version,requestId:existingPending.args.p_request_id,uid:existingPending.uid,document:structuredClone(existingPending.args.p_document)};}
        throw failure;
      }
      candidate=existingPending.args.p_document;expected=existingPending.args.p_expected_version;
    }else{
      const current=id?(state.programs.find(p=>p.id===id)||await get(id)):null;
      candidate=IASDPILocalAdapter.apply(current?[current]:[],path,method,body);
      expected=(path==='programs'||route==='duplicate')?0:body.version;
    }
    const saving=commit(candidate,expected,false,key);
    if(pending.has(key))pending.get(key).source=JSON.stringify([path,body]);
    const saved=await saving;return saved.document;
  }
  async function releaseConflict(info,version){
    const access=await IASDPIAuth.requireAccess();
    if(info.uid!==access.user.id)throw Error('O envio pertence a outra conta.');
    const latest=await get(info.id);
    if(latest.version!==version||latest.version<=info.expectedVersion)throw Error('O registro mudou novamente. Reabra a comparação antes de reaplicar.');
    const queued=(await outbox('list',null,info.uid)).find(row=>row.args.p_request_id===info.requestId&&row.args.p_id===info.id&&row.args.p_expected_version===info.expectedVersion);
    if(queued)await outbox('delete',info.requestId,info.uid);
    for(const [key,value] of pending)if(value.uid===info.uid&&value.args.p_request_id===info.requestId&&value.args.p_id===info.id)pending.delete(key);
  }
  async function refreshTemplates(){
    templates=await remote('iasdpi_templates?select=id,plan,version,display_name&order=id');
    const visible=templates.filter(t=>t.display_name);
    if(!visible.some(t=>t.id==='liturgy-i')||!visible.some(t=>t.id==='free'))throw Error('Modelos Liturgia I/Livre indisponíveis; confira a migração 003.');
    cultoTemplates=visible.sort((a,b)=>(a.id==='liturgy-i'?-1:b.id==='liturgy-i'?1:a.id==='free'?-1:b.id==='free'?1:a.display_name.localeCompare(b.display_name))).map(t=>({id:t.id,label:t.display_name,name:t.plan.name||t.display_name,source:'templates/'+t.id}));
  }
  function panel(){
    return `<section class="panel"><h2>Persistência centralizada</h2><p>Registros e revisões ficam no Supabase e podem ser abertos em outro dispositivo autorizado. As cópias em culto_archives são independentes. Backup manual do navegador não é necessário a cada publicação.</p><div class="actions">${button('Atualizar registros do banco','operational-refresh')}${button('Conferir registros antigos deste navegador','operational-preview')}${button('Conferir envios pendentes','operational-pending')}</div>
    ${preview?`<h3>Prévia de importação opcional</h3>${preview.adjustments.length?`<p class="form-note" role="status">Compatibilidade: ${preview.adjustments.length} registros exigem adaptação explícita de formato para o banco (previstos HH:mm; horários reais associados à data em America/Sao_Paulo). Nenhum instante é deslocado. O documento original integral também será preservado no campo backup_source, além do backup de origem.</p><details><summary>Conferir adaptações antes de confirmar</summary><ul>${preview.adjustments.map(a=>`<li>${esc(a.id)}: ${esc([...new Set(a.changes)].join('; '))}</li>`).join('')}</ul></details>`:''}<p>Nenhum registro existente será sobrescrito. A cópia local será mantida integralmente.</p><div class="table-scroll"><table><thead><tr><th>Importar</th><th>Culto</th><th>Data / ID</th><th>Situação</th></tr></thead><tbody>${preview.rows.map(row=>`<tr><td>${row.status==='new'?`<input type="checkbox" data-import-id="${esc(row.id)}" checked aria-label="Importar ${esc(row.name)}">`:'—'}</td><td>${esc(row.name)}</td><td>${esc(displayDate(row.date))}<small>${esc(row.id)}</small></td><td>${esc({unavailable:'Indisponível: consulte um administrador',new:'Novo',exists:'Já importado',conflict:'Conflito: versão do banco preservada',duplicate:'Duplicado: já existe com outro ID',imported:'Importação confirmada'}[row.status]||row.status)}${row.reason?`<small>${esc(row.reason)}</small>`:''}</td></tr>`).join('')}</tbody></table></div>${button('Confirmar importação dos selecionados','operational-import','','class="primary"')}`:''}
    ${recoveries.length?`<h3>Envios pendentes neste dispositivo</h3><p>Reenviar reconfirma a mesma operação. Em caso de conflito, a versão do banco será preservada.</p><ul>${recoveries.map(row=>`<li>${esc(row.args.p_document.plan.name)} · ${esc(displayDate(row.args.p_document.plan.date))} ${button('Reenviar / conferir','operational-retry',row.args.p_request_id)} ${button('Descartar somente este envio','operational-discard',row.args.p_request_id)}</li>`).join('')}</ul>`:''}</section>
    ${templatePanel()}`;
  }
  function templatePanel(){
    if(!IASDPIAuth.isAdmin())return '';
    return `<section class="panel"><h2>Modelos de liturgia</h2><p>Administradores podem salvar a programação prevista de um culto como modelo. A execução real não é copiada.</p><form id="operational-template-form">${field('ID do modelo','model-id','','text',true,'pattern="[a-z0-9_-]{1,100}" placeholder="ex.: liturgia-ii"')}${field('Nome na lista','model-name','','text',true,'maxlength="200"')}<label>Programação de referência<select name="program-id">${state.programs.map(p=>`<option value="${esc(p.id)}">${esc(p.plan.name)} · ${esc(displayDate(p.plan.date))}</option>`).join('')}</select></label><button type="submit">Salvar modelo</button></form></section>`;
  }

  async function prepareImport(documents,raw=null){
    backupValidate({format:'IASDPI-backup',version:1,programs:documents});
    const candidates=[],blocked=[],adjustments=[];
    for(const original of documents){
      try{const candidate=operationalImportCandidate(original);candidates.push(candidate.document);if(candidate.changes.length)adjustments.push({id:original.id,changes:candidate.changes});}
      catch(error){blocked.push({id:original.id,name:original.plan.name,date:original.plan.date,status:'unavailable',reason:error.message});}
    }
    const rows=candidates.length?await remote('rpc/iasdpi_preview_import','POST',{p_documents:candidates}):[];
    preview={documents:candidates,rows:[...rows,...blocked],raw,adjustments};render();
  }
  async function importDocuments(documents){await prepareImport(documents);return {added:0,copies:0,preview:true};}
  async function action(action,id){
    await IASDPIAuth.requireAccess();
    if(action==='operational-refresh'){await loadPrograms();render();toast('Registros atualizados do Supabase.');}
    else if(action==='operational-preview'){
      const raw=localStorage.getItem(IASDPIStorage.programs);
      if(!raw)throw Error('Não há registros antigos neste navegador. Você pode cadastrar novos cultos normalmente.');
      await prepareImport(JSON.parse(raw),raw);
    }else if(action==='operational-import'){
      if(!preview)throw Error('Confira a prévia primeiro.');
      if(preview.raw!==null&&localStorage.getItem(IASDPIStorage.programs)!==preview.raw)throw Error('Os dados locais mudaram. Reabra a prévia.');
      const ids=[...document.querySelectorAll('[data-import-id]:checked')].map(input=>input.dataset.importId);
      for(const id of ids){
        const row=preview.rows.find(row=>row.id===id);if(row.status!=='new')continue;
        const result=await commit(preview.documents.find(p=>p.id===id),0,true,'import:'+id);
        row.status=result.status;render();
      }
      await loadPrograms();render();toast('Importações selecionadas confirmadas no Supabase. A cópia local foi preservada.');
    }else if(action==='operational-pending'){
      recoveries=await outbox('list');render();if(!recoveries.length)toast('Nenhum envio pendente neste dispositivo.');
    }else if(action==='operational-retry'){
      const row=recoveries.find(row=>row.args.p_request_id===id);if(!row)throw Error('Envio não encontrado.');
      await remote('rpc/iasdpi_save_program','POST',row.args);
      await outbox('delete',id);for(const [key,value] of pending)if(value.args.p_request_id===id)pending.delete(key);
      recoveries=await outbox('list');await loadPrograms();render();toast('Gravação reconfirmada pelo Supabase.');
    }else if(action==='operational-discard'){
      if(!confirm('Descartar apenas este envio pendente? O registro no Supabase não será alterado.'))return;
      await outbox('delete',id);for(const [key,value] of pending)if(value.args.p_request_id===id)pending.delete(key);
      recoveries=await outbox('list');render();
    }
  }
  async function saveTemplate(form){
    await refreshTemplates();
    const id=form.elements['model-id'].value,prior=templates.find(t=>t.id===id),program=await get(form.elements['program-id'].value);
    if(prior&&!confirm('Atualizar o modelo existente? Os cultos já registrados não serão alterados.'))return;
    await remote('rpc/iasdpi_save_template','POST',{p_id:id,p_expected_version:prior?.version||0,p_name:form.elements['model-name'].value,p_plan:program.plan});
    await refreshTemplates();toast('Modelo confirmado no Supabase.');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(window.IASDPIConfig?.initialOperational)return;
    const banner=document.createElement('aside');banner.className='demo-banner';banner.textContent='SUPABASE · Registros compartilhados da IASD Parada Inglesa. Alterações são confirmadas pelo banco.';document.querySelector('.header').after(banner);
  });
  window.addEventListener('iasdpi-auth-changed',()=>{if(!IASDPIAuth.allowed()){pending.clear();templates=[];preview=null;recoveries=[];lastActor=null;}});
  return {request,refreshTemplates,panel,action,importDocuments,saveTemplate,releaseConflict,templatePanel};
})();

;
'use strict';
// Carregado somente por uma fonte autorizada, nunca incluído no HTML público.
window.IASDPIChronogram = null;
function cultoForDate(template,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!recordDay(date))throw Error('Selecione uma data válida para o culto.');
  const plan=structuredClone(template);plan.date=date;
  plan.name=plan.name.replace(/03\/10\/2026|2026-10-03/g,'').replace(/\s*[·—-]\s*$/,'').trim()||'Culto de sábado';
  for(const item of plan.items){delete item.planned_start;delete item.planned_end;}
  delete plan.planned_start;delete plan.planned_end;
  return plan;
}
function correctedCultoDate(original){
  if(original.execution_mode!=='manual'||original.plan.date!=='2026-10-03')throw Error('Este registro não corresponde à correção de 03/10 para 10/10/2026.');
  backupValidate({format:'IASDPI-backup',version:1,programs:[original]});
  const p=structuredClone(original),zone='America/Sao_Paulo';
  const shift=value=>{
    if(value==null)return value;
    if(typeof value!=='string'||!Number.isFinite(new Date(value).getTime()))throw Error('Há um horário inválido; nada será alterado.');
    const day=new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date(value));
    if(day==='2026-10-10')return value;
    if(day!=='2026-10-03')throw Error('Há horários em outra data. Revise o registro antes de corrigir; nada foi alterado.');
    const prefix=new Date(new Date(value.slice(0,10)+'T12:00:00Z').getTime()+7*86400000).toISOString().slice(0,10);
    return prefix+value.slice(10);
  };
  p.plan.date='2026-10-10';
  p.plan.name=p.plan.name.replace(/03\/10\/2026/g,'10/10/2026').replace(/2026-10-03/g,'2026-10-10');
  for(const field of ['planned_start','planned_end'])if(p[field]!=null)p[field]=shift(p[field]);
  for(const item of p.plan.items)for(const field of ['planned_start','planned_end'])if(item[field]!=null)item[field]=shift(item[field]);
  for(const execution of Object.values(p.executions))for(const field of ['started','ended'])if(execution[field]!=null)execution[field]=shift(execution[field]);
  return p;
}
let cultoTemplates=[
  {id:'liturgy-i',label:'Liturgia I — Padrão',source:'chronogram',name:'Culto · Liturgia I'},
  {id:'free',label:'Livre — Sem atividades',source:null,name:'Culto livre'}
];
function saoPauloToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());}
async function draftFromTemplate(id){
  const model=cultoTemplates.find(model=>model.id===id);if(!model)throw Error('Selecione um modelo válido.');
  const date=saoPauloToday();
  const draft=window.IASDPIOperational?cultoForDate(await api('templates/'+id),date):model.source?cultoForDate(await api(model.source),date):{date,start:'',end:'',items:[],team:{}};
  return {...draft,name:model.name,template_id:model.id,execution_mode:'manual'};
}
function newCultoForm(){
  return heading('REGISTRO DO CULTO','Registro do Culto','Escolha um modelo e crie um registro com a data atual de São Paulo. A data poderá ser alterada.')+
    `<form id="new-record-form" class="panel"><label>Modelo da programação<select name="template-id">${cultoTemplates.map(model=>`<option value="${model.id}">${esc(model.label)}</option>`).join('')}</select></label><button class="primary" type="submit">Novo registro</button></form>`+
    `${state.programs.some(p=>p.execution_mode==='manual')?`<form id="open-record-form" class="panel"><label>Registro existente<select name="record-id">${state.programs.filter(p=>p.execution_mode==='manual').map(p=>`<option value="${esc(p.id)}">${esc(p.plan.name)} · ${esc(displayDate(p.plan.date))}</option>`).join('')}</select></label><button type="submit">Editar registro</button></form>`:''}`;
}
function actualClock(value) {
  const parsed=inspectRecordTime(value);return parsed.valid?parsed.clock.slice(0,8):'';
}
// Frações antigas são preservadas no dado; a interface sempre mostra HH:mm:ss.
const validActualTime=validRecordClock;
const displayActualTime=value=>{const parsed=inspectRecordTime(value);return parsed.empty?'':parsed.valid?parsed.clock.slice(0,8):String(value);};
const timeSeconds=value=>value?value.split(':').reduce((sum,part)=>sum*60+Number(part),0)*(value.length===5?60:1):null;
function storedActualClock(value){return recordClock(value);}
function actualRecordTimes(p,id){
  const extra=p?.extra_events?.find(e=>e.id===id),e=p?.executions?.[id];
  return extra?{...extra,start:recordClock(extra.start,p?.plan?.date),end:recordClock(extra.end,p?.plan?.date)}:{start:recordClock(e?.started,p?.plan?.date),end:recordClock(e?.ended,p?.plan?.date)||recordClock(p?.actual_details?.[id]?.partial_end,p?.plan?.date)};
}
function readActualTime(input,previous=''){
  const value=input.value.trim();
  if(input.dataset.timeEdited!=='true'&&validRecordClock(input.dataset.conflictClock)&&value===displayActualTime(input.dataset.conflictClock))return input.dataset.conflictClock;
  if(input.dataset.timeEdited!=='true'&&value===displayActualTime(previous)){
    const day=tryReadDate(input.closest('form')?.elements['record-date']?.value||'');
    if(importedTimeWarning(previous)||((!day||day===input.dataset.originalDay)&&importedTimeWarning(input.dataset.originalTime,day)))throw fieldError(input,'Corrija o horário importado inválido antes de salvar.');
    return previous;
  }
  if(value&&!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value))throw fieldError(input,'Use o formato 24 horas HH:mm:ss, com segundos (ex.: 14:05:35).');
  return displayActualTime(value);
}
function actualTimeField(label,name,value,index=0,day,context=`atividade ${index+1}`) {
  const warning=importedTimeWarning(value,day),warningId='time-warning-'+crypto.randomUUID();
  const control=field(label,name,displayActualTime(value),'text',false,`maxlength="8" placeholder="HH:mm:ss" inputmode="text" data-real-time="true" data-original-time="${esc(value??'')}" data-original-day="${esc(recordDay(day))}" autocomplete="off" aria-label="${label} — ${context}" ${warning?`aria-invalid="true" aria-describedby="${warningId}"`:''}`);
  return `<div class="actual-time-field">${control.replace('</label>',`${warning?`<span class="field-error" id="${warningId}" role="alert">${esc(warning)}</span>`:''}</label>`)}<button type="button" data-action="time-now" data-field="${name}" aria-label="Preencher ${label.toLowerCase()} — ${context} com a hora atual">Agora</button></div>`;
}
function transitions(p) {
  const original=p,day=recordDay(p.plan.date);
  const edge=(item,key)=>{
    const extra=original.extra_events?.find(e=>e.id===item.id);
    const raw=extra?{started:extra.start,ended:extra.end}:original.executions?.[item.id]||{};
    const parsed=inspectRecordTime(raw[key],day);
    return recordInterval(raw.started,raw.ended,day).state==='invalid'||!day||parsed.day!==day?null:parsed.epoch;
  };
  p=programForMetrics(p);
  if(p.extra_events?.length)p={...p,...registrationData(p)};
  const groups=[];
  for (const item of p.plan.items) {
    const previous=groups.at(-1);
    if(item.parallel && previous?.items[0].parallel && previous.items[0].start===item.start && previous.items[0].end===item.end)previous.items.push(item);
    else groups.push({items:[item]});
  }
  return groups.slice(1).map((group,index)=>{
    const prior=groups[index];
    const ends=prior.items.map(i=>edge(i,'ended'));
    const starts=group.items.map(i=>edge(i,'started'));
    const seconds=ends.every(v=>v!==null&&Number.isFinite(v))&&starts.every(v=>v!==null&&Number.isFinite(v))?(Math.min(...starts)-Math.max(...ends))/1000:null;
    return {from:prior.items.map(i=>i.activity).join(' / '),to:group.items.map(i=>i.activity).join(' / '),seconds};
  });
}
function transitionView(programs) {
  const all=programs.flatMap(p=>transitions(p).map(t=>({...t,event:p.plan.name}))),rows=all.filter(t=>t.seconds!==null&&Number.isFinite(t.seconds));
  return `<section class="section"><h2>Transição entre atividades</h2><p class="muted">Do término da atividade anterior ao início da próxima. Alerta acima de 30 segundos. Itens simultâneos formam um único grupo. ${rows.length} transições consideradas; ${all.length-rows.length} desconsideradas por horários ausentes ou inválidos.</p>${rows.length?`<div class="table-scroll"><table><thead><tr><th>Evento</th><th>De → Para</th><th>Transição</th><th>Situação</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.event)}</td><td>${esc(t.from)} → ${esc(t.to)}</td><td>${Math.round(Math.abs(t.seconds))} s</td><td><span class="badge ${t.seconds>30?'critical':t.seconds<0?'warning':'good'}">${t.seconds>30?'Alerta: acima de 30 s':t.seconds<0?'Sobreposição':'Dentro de 30 s'}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Preencha o término de uma atividade e o início da próxima para calcular a transição.</p>'}</section>`;
}
const ministryOptions=['Min. Louvor','Min. Mordomia','Min. Louvor e/ou Ancianato'];
function activityLabel(plan,index) {
  const name=String(plan.items[index].activity||'Atividade sem título').replace(/^(Música Congregacional[^:]*):.*$/, '$1');
  if(!name.startsWith('Música Congregacional'))return name;
  const number=plan.items.slice(0,index+1).filter(i=>String(i.activity||'').startsWith('Música Congregacional')).length;
  return `${number}ª ${name}`;
}
function activityDetailsField(p,item,index) {
  const detail=p?.actual_details?.[item.id] || {};
  const defaultMinistry={'Ministério de Louvor':'Min. Louvor','Ministério Louvor':'Min. Louvor','Ministério da Mordomia':'Min. Mordomia','Ministério de Louvor e/ou Ancianato':'Min. Louvor e/ou Ancianato'}[item.responsible] || '';
  const responsible=detail.responsible ?? (defaultMinistry || item.responsible || '');
  const custom=responsible && !ministryOptions.includes(responsible);
  return `<div class="activity-details"><label>Observação<textarea name="activity-note" maxlength="2000" rows="1" placeholder="Observação da atividade" aria-label="Observação da atividade ${index+1}">${esc(detail.note ?? item.note ?? '')}</textarea></label><div><label>Responsável<select name="responsible-option" aria-label="Responsável da atividade ${index+1}"><option value="">Selecionar</option>${ministryOptions.map(name=>`<option value="${esc(name)}" ${responsible===name?'selected':''}>${esc(name)}</option>`).join('')}<option value="other" ${custom?'selected':''}>Outro responsável</option></select></label><input name="responsible-name" value="${esc(custom?responsible:'')}" maxlength="200" placeholder="Nome do responsável" aria-label="Nome do responsável da atividade ${index+1}" ${custom?'':'hidden'}></div></div>`;
}
function validateExtraEvents(p,input,finalize) {
  if(!Array.isArray(input)||input.length+p.plan.items.length>100)throw Error('Lista de eventos inválida ou maior que 100 atividades.');
  const ids=new Set(p.plan.items.map(i=>i.id)),positions=new Set();
  return input.map(e=>{
    if(!e || typeof e.id!=='string'||!e.id||e.id.length>200||ids.has(e.id)||!Number.isInteger(e.position)||e.position<0||e.position>=p.plan.items.length+input.length||positions.has(e.position))throw Error('Identificador ou posição de evento inválido.');
    ids.add(e.id);positions.add(e.position);
    for(const [name,limit] of [['activity',200],['note',2000],['responsible',200]])if(typeof e[name]!=='string'||e[name].length>limit)throw Error('Tema, observação ou responsável inválido.');
    if(!e.activity.trim())throw Error('Informe o tema do evento.');
    const valid=validActualTime;
    if(typeof e.start!=='string'||typeof e.end!=='string'||(e.start&&!valid(e.start))||(e.end&&(!valid(e.end)||(e.start&&timeSeconds(e.end)<timeSeconds(e.start)))))throw Error('Informe horários reais válidos para o evento.');
    const detail=validateActivityRecord(e,e.id);
    if(finalize&&(!e.start||!e.end))throw Error('Resolva os eventos extras antigos antes de finalizar.');
    return {...e,...detail,activity:e.activity,note:e.note,responsible:e.responsible};
  });
}
function registrationData(p) {
  const view=p?programForMetrics(p):{plan:IASDPIChronogram,executions:{}};
  const plan=structuredClone(view.plan),executions={...view.executions};
  for(const extra of [...(p?.extra_events || [])].sort((a,b)=>a.position-b.position)){
    plan.items.splice(Math.min(extra.position,plan.items.length),0,{id:extra.id,activity:extra.activity,block:'Culto',unplanned:true});
    if(extra.start)executions[extra.id]={started:inspectRecordTime(extra.start,recordDay(plan.date)).iso,ended:inspectRecordTime(extra.end,recordDay(plan.date)).iso};
  }
  return {plan,executions};
}
function actualRow(p,plan,i,index,executions) {
  const e=executions[i.id];
  const extra=(p?.extra_events || []).find(event=>event.id===i.id);
  const details=extra?{actual_details:{[i.id]:extra}}:p;
  return `<fieldset class="actual-row" data-id="${esc(i.id)}" ${i.unplanned?'data-extra="true"':`data-planned="${(validActualTime(i.start)&&validActualTime(i.end)?(timeSeconds(i.end)-timeSeconds(i.start))/60:'')}"`}><legend><span class="actual-number">${index+1}</span>. ${esc(i.block)}</legend><div class="actual-description">${i.unplanned?field('Tema do evento','extra-theme',i.activity,'text',true,'maxlength="200" placeholder="Ex.: 4ª música — tema"'):`<h3>${esc(activityLabel(plan,index))}</h3>`}<span class="muted">Previsto: ${i.unplanned?'Fora da liturgia':esc(displayPlannedTime(i.start))+' → '+(i.end_inferred?'não informado (referência: '+esc(displayPlannedTime(i.end))+')':esc(displayPlannedTime(i.end)))}</span>${activityDetailsField(details,i,index)}</div><div class="actual-inputs">${actualTimeField('Início real','start',extra?.start??p?.executions?.[i.id]?.started??'',index,plan.date)}${actualTimeField('Término real','end',extra?.end??p?.executions?.[i.id]?.ended??p?.actual_details?.[i.id]?.partial_end??'',index,plan.date)}<output class="actual-difference muted">Aguardando horários</output></div><div class="actual-row-actions">${button('Adicionar subatividade','add-subactivity')}${i.unplanned?button('Remover evento','remove-extra','','class="danger-text"'):''}</div><div class="subactivities" aria-label="Subatividades de ${esc(i.activity)}">${(details?.actual_details?.[i.id]?.subactivities||[]).map(child=>subactivityRow(child,i.id,plan.date)).join('')}</div></fieldset>`;
}
function addExtraEvent(target) {
  const form=document.querySelector('#actuals-form'),rows=form.querySelectorAll('.actual-row');
  if(rows.length>=100)throw Error('Limite de 100 atividades por culto.');
  const item={id:crypto.randomUUID(),activity:'',block:'Culto',unplanned:true};
  const row=target.closest('.actual-row');
  const html=actualRow(null,{items:[item]},item,0,{});
  if(row)row.insertAdjacentHTML('afterend',html);else form.querySelector('.actuals-list').insertAdjacentHTML('beforeend',html);
  const added=row?row.nextElementSibling:form.querySelector('.actuals-list').lastElementChild;
  form.querySelectorAll('.actual-number').forEach((n,index)=>n.textContent=index+1);
  added.querySelector('[name="extra-theme"]').focus();updateActuals();
}
function summaryActivityRows(p){
  const {plan,executions}=registrationData(p);
  return plan.items.map((i,index)=>{
    const e=executions[i.id],extra=p.extra_events?.find(x=>x.id===i.id),details=extra||p.actual_details?.[i.id]||{};
    const source=extra?{started:extra.start,ended:extra.end}:p.executions?.[i.id]||{};
    const actual=recordInterval(source.started,source.ended??details.partial_end,recordDay(p.plan.date));
    const planned=i.unplanned?null:recordInterval(i.planned_start,i.planned_end,recordDay(p.plan.date)).minutes,real=actual.minutes;
    return `<tr><td>${esc(activityLabel(plan,index))}${i.unplanned?'<small>Fora da liturgia</small>':''}<small>${esc(details.responsible??i.responsible??'')}</small>${details.note?`<small>${esc(details.note)}</small>`:''}${subactivitiesSummary(details)}</td><td>${i.unplanned?'Fora da liturgia':esc(displayPlannedTime(i.start))+' → '+esc(displayPlannedTime(i.end))}</td><td>${displayActualTime(actualClock(e?.started))||'—'} → ${displayActualTime(actualClock(e?.ended))||'—'}</td><td>${planned===null?'—':duration(planned)}</td><td>${real===null?'—':duration(real)}</td><td>${real===null||planned===null?'—':badge(real-planned,signed(real-planned))}</td></tr>`;
  }).join('');
}
function extraEventsSummary(p) {
  if(!p.extra_events?.length)return '';
  return `<section class="section"><h2>Eventos fora da liturgia</h2><div class="table-scroll"><table><thead><tr><th>Tema</th><th>Horários reais</th><th>Responsável / observação</th></tr></thead><tbody>${p.extra_events.map(e=>`<tr><td>${esc(e.activity)}<small>Previsto: Fora da liturgia</small></td><td>${esc(displayActualTime(e.start) || '—')} → ${esc(displayActualTime(e.end) || '—')}</td><td>${esc(e.responsible)}${e.note?`<small>${esc(e.note)}</small>`:''}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function actualsForm(p) {
  if(!p&&!window.IASDPIChronogram)return newCultoForm();
  const {plan,executions}=registrationData(p);
  return heading('REGISTRO DO CULTO', 'Registrar culto', `${esc(dateLabel(plan.date))} · ${esc(plan.name)}`, `<div class="actions">${p?button('Editar registro','edit-record',p.id):''}${!p||['Planejamento','Pronta'].includes(p.status)?button('Editar programação prevista','edit-record-plan',p?.id||''):''}${button('Voltar às programações','programs')}</div>`) +
    `<section class="planned-bar"><span>Previsto <strong>${esc(displayPlannedTime(plan.start||'—'))} → ${esc(displayPlannedTime(plan.end||'—'))}</strong></span><span class="badge neutral">Registro manual</span></section>
    <details class="panel"><summary>Equipe da programação</summary><dl class="team-read">${roles.map(role => `<div><dt>${esc(role==='Responsável pela programação'?'Ministração do Culto':role)}</dt><dd>${esc((plan.team||{})[role] || 'Não informado')}</dd></div>`).join('')}</dl></details>
    ${plan.items.some(i=>i.end_inferred) ? '<p class="form-note">O término dos anúncios não foi informado no cronograma. A referência de 10:05, início do próximo item, será usada apenas para comparar a duração. Os itens das 10:10 são simultâneos.</p>' : ''}
    <form id="actuals-form" data-id="${esc(p?.id || '')}" data-version="${p?.version || ''}">
      <section class="registration-savebar" data-state="${p?'saved':'dirty'}" role="region" aria-label="Salvar registro do culto">
        <p id="registration-save-status" role="status" aria-live="polite" aria-atomic="true">${p?(window.IASDPIOperational?'Registro existente · salvo no Supabase.':window.IASDPIDemo?'Registro existente · salvo neste navegador.':'Registro existente · salvo no servidor local.'):'Novo registro · ainda não salvo.'}</p>
        <button type="submit" name="save" formnovalidate class="primary">Salvar alterações</button>
      </section>
      <div class="notes-grid">${field('Nome do culto','record-name',plan.name,'text',true,'maxlength="200"')}${field('Data do culto','record-date',plan.date,'date',true)}${!recordDay(plan.date)?'<span class="field-error" role="alert">Data importada inválida. Informe a data do culto para salvar.</span>':''}</div>

      <div class="section-heading"><h2>O que aconteceu no culto?</h2><span id="actuals-progress" class="muted"></span></div>
      <p class="muted">Para finalizar, preencha início e término de cada atividade no formato 24 horas HH:mm:ss. Durante o culto, os horários podem ficar em branco. Subatividades não alteram o planejamento nem somam duração. Responsável e observação são opcionais. Salvar registro permite guardar o preenchimento parcial e continuar depois.</p>
      <div class="actuals-list">${plan.items.map((i,index)=>actualRow(p,plan,i,index,executions)).join('')}</div>

      <div id="actual-transitions"></div>
      <section class="section"><h2>Observações</h2><div class="notes-grid"><div><label for="manual-note">Observações do culto</label><textarea id="manual-note" name="note" maxlength="5000" rows="3">${esc(p?.note || '')}</textarea></div><div><label for="manual-incident">Ocorrência não prevista</label><textarea id="manual-incident" name="incident" maxlength="5000" rows="3">${esc(p?.incident || '')}</textarea></div></div></section>
      <section class="section"><label>Informações complementares<textarea name="record-info" rows="2" maxlength="5000">${esc(p?.record_info||'')}</textarea></label></section>
      <div class="actions manual-actions">${button('Cancelar edição','cancel-record',p?.id||'')}<button type="submit" class="primary" name="finalize">Finalizar e ver resumo</button></div>
    </form>`;
}
function updateActuals() {
  const form=document.querySelector('#actuals-form');if(!form)return;
  refreshSubactivityLabels();
  let completed=0;
  const rows=[...form.querySelectorAll('.actual-row')];
  rows.forEach(row=>{
    const start=row.querySelector('[name="start"]').value, end=row.querySelector('[name="end"]').value;
    const output=row.querySelector('output');output.className='actual-difference muted';
    if(start && end && validActualTime(start) && validActualTime(end)){
      const real=(timeSeconds(end)-timeSeconds(start))/60;
      if(real<0){output.textContent='Término anterior ao início';output.className='actual-difference critical';}
      else if(row.dataset.extra){completed++;output.textContent=`${duration(real)} realizados · Fora da liturgia`;}
      else if(row.dataset.planned===''){output.textContent='Horário previsto inconsistente. Revise a programação.';}
      else{completed++;const diff=real-Number(row.dataset.planned);output.textContent=`${duration(real)} realizados · ${signed(diff)} de diferença`;output.className=`actual-difference ${statusTone(diff)}`;}
    }else output.textContent=end&&!start?'Informe o início real':start?'Falta o término real':'Aguardando horários';
  });
  const originalPlan=selected()?.plan || window.IASDPIChronogram;if(!originalPlan)return;
  const plan=structuredClone(originalPlan);plan.date=tryReadDate(form.elements['record-date'].value)||plan.date;
  plan.items=rows.map(row=>plan.items.find(i=>i.id===row.dataset.id)||{id:row.dataset.id,activity:row.querySelector('[name="extra-theme"]').value || 'Novo evento',unplanned:true});
  const executions=Object.fromEntries(rows.map(row=>[row.dataset.id,Object.fromEntries([['start','started'],['end','ended']].map(([name,key])=>{const v=row.querySelector(`[name="${name}"]`).value;return [key,v&&validActualTime(v)?inspectRecordTime(v,recordDay(plan.date)).iso:null];}))]));
  document.querySelector('#actual-transitions').innerHTML=transitionView([{plan,executions}]);
  document.querySelector('#actuals-progress').textContent=`${completed} de ${rows.length} atividades completas`;
  refreshScrollableTables();
}
async function saveActuals(form,finalize,draftSave=window.IASDPIDrafts?.beginSave(form)){
  let p=state.programs.find(record=>record.id===form.dataset.id)||null;
  const base=p||{plan:window.IASDPIChronogram};
  const date=readDateField(form.elements['record-date']);
  let recordPlan;try{recordPlan=recordEditPlan(base,{record_name:form.elements['record-name'].value,record_date:date});}
  catch(error){throw fieldError(form.elements['record-name'],error.message);}
  if(finalize&&!recordPlan.items.length)throw Error('Adicione atividades na edição da programação prevista antes de finalizar.');
  const records={},extra_events=[];
  const rows=[...form.querySelectorAll('.actual-row')];
  for(const [position,row] of rows.entries()){
    const id=row.dataset.id,previous=actualRecordTimes(p,id);
    for(const title of row.querySelectorAll('.subactivity [name="sub-title"]'))if(!title.value.trim())throw fieldError(title,'Informe o título da subatividade.');
    const subactivities=[...row.querySelectorAll('.subactivity')].map(child=>({...((p?.actual_details?.[id]||p?.extra_events?.find(e=>e.id===id))?.subactivities?.find(s=>s.id===child.dataset.subId)||{}),id:child.dataset.subId,parent_id:child.dataset.parentId,title:child.querySelector('[name="sub-title"]').value,responsible:child.querySelector('[name="sub-responsible"]').value,note:child.querySelector('[name="sub-note"]').value,start:readActualTime(child.querySelector('[name="sub-start"]'),recordClock((p?.actual_details?.[id]||p?.extra_events?.find(e=>e.id===id))?.subactivities?.find(s=>s.id===child.dataset.subId)?.start,p?.plan?.date)),end:readActualTime(child.querySelector('[name="sub-end"]'),recordClock((p?.actual_details?.[id]||p?.extra_events?.find(e=>e.id===id))?.subactivities?.find(s=>s.id===child.dataset.subId)?.end,p?.plan?.date))}));
    let record={start:readActualTime(row.querySelector('[name="start"]'),previous.start),end:readActualTime(row.querySelector('[name="end"]'),previous.end),note:row.querySelector('[name="activity-note"]').value,responsible:row.querySelector('[name="responsible-option"]').value==='other'?row.querySelector('[name="responsible-name"]').value:row.querySelector('[name="responsible-option"]').value,subactivities};
    if(record.start&&record.end&&timeSeconds(record.end)<timeSeconds(record.start))throw fieldError(row.querySelector('[name="end"]'),'O término real não pode ser anterior ao início.');
    record=validateActivityRecord(record,id);
    if(finalize&&(!record.start||!record.end))throw fieldError(row.querySelector(record.start?'[name="end"]':'[name="start"]'),'Preencha início e término desta atividade para finalizar.');
    if(row.dataset.extra){
      const previous=p?.extra_events?.find(e=>e.id===id)||{};
      extra_events.push({...previous,id,position,activity:row.querySelector('[name="extra-theme"]').value,...record});
    }else records[id]=record;
  }
  // Todas as validações precedem a criação de um registro novo.
  validateExtraEvents({plan:recordPlan},extra_events,finalize);
  if(!form.dataset.id){
    p=await api('programs','POST',{...structuredClone(window.IASDPIChronogram),name:recordPlan.name,date:recordPlan.date});
    replaceProgram(p);state.selected=p.id;form.dataset.id=p.id;form.dataset.version=p.version;
    await window.IASDPIDrafts?.bind(form,p,draftSave?.context);
    IASDPINavigation.identify('actuals',p.id);
  }
  p=await api(`programs/${form.dataset.id}/actuals`,'PUT',{version:Number(form.dataset.version),executions:records,extra_events,record_name:recordPlan.name,record_date:recordPlan.date,record_info:form.elements['record-info'].value,note:form.elements.note.value,incident:form.elements.incident.value,finalize});
  const newer=await window.IASDPIDrafts?.saved(draftSave,p);
  if(!newer)registrationDirty=false;
  const stillEditing=form.isConnected,previousSelected=state.selected;replaceProgram(p);
  if(!stillEditing)state.selected=previousSelected;else if(!newer)navigate(finalize?'summary':'actuals',p.id,{replace:!finalize,refresh:true});
  const message=window.IASDPIOperational?'Alterações confirmadas e salvas no Supabase.':window.IASDPIDemo?'Alterações salvas neste navegador. Nenhuma gravação na nuvem.':'Alterações salvas no servidor local.';
  const currentForm=stillEditing&&!newer&&!finalize?document.querySelector('#actuals-form'):form;
  setRegistrationSaveState(currentForm,newer?'dirty':'saved',newer?'Envio confirmado. Alterações mais recentes continuam em rascunho local.':message);
  toast(message);
}
let registrationDirty=false;
function validateSubactivities(input,parentId,start,end){
  if(!Array.isArray(input)||input.length>50)throw Error('Limite de 50 subatividades por atividade.');
  const ids=new Set();const valid=validActualTime;
  return input.map(s=>{
    if(!s||typeof s.id!=='string'||!s.id||s.id.length>200||ids.has(s.id)||s.parent_id!==parentId)throw Error('Vínculo de subatividade inválido.');ids.add(s.id);
    for(const [key,limit] of [['title',200],['responsible',200],['note',2000]])if(typeof s[key]!=='string'||s[key].length>limit)throw Error('Dados da subatividade inválidos.');
    if(!s.title.trim())throw Error('Informe o título da subatividade.');
    if(typeof s.start!=='string'||typeof s.end!=='string'||(s.start&&!valid(s.start))||(s.end&&!valid(s.end)))throw Error('Horários da subatividade inválidos.');
    if((s.start||s.end)&&(!start||!end))throw Error('Preencha o intervalo real completo da atividade principal antes de informar horários da subatividade.');
    if((s.start&&(timeSeconds(s.start)<timeSeconds(start)||timeSeconds(s.start)>timeSeconds(end)))||(s.end&&(timeSeconds(s.end)<timeSeconds(start)||timeSeconds(s.end)>timeSeconds(end)))||(s.start&&s.end&&timeSeconds(s.end)<timeSeconds(s.start)))throw Error('Os horários da subatividade devem ficar dentro do intervalo real da atividade principal.');
    return {...s};
  });
}
function validateActivityRecord(record,id){
  if(record.partial_end!==undefined&&(typeof record.partial_end!=='string'||(record.partial_end&&!validActualTime(record.partial_end))))throw Error('Horário parcial inválido.');
  if((record.start&&!validActualTime(record.start))||(record.end&&!validActualTime(record.end)))throw Error('Horários reais inválidos.');
  if(record.start&&record.end&&timeSeconds(record.end)<timeSeconds(record.start))throw Error('Término anterior ao início.');
  const subactivities=validateSubactivities(record.subactivities??[],id,record.start,record.end);
  return {...record,subactivities};
}
function recordEditPlan(p,body){
  const plan=structuredClone(p.plan),date=recordDay(body.record_date??plan.date),name=body.record_name??plan.name;
  plan.start=plannedClock(plan.start);plan.end=plannedClock(plan.end);
  for(const item of plan.items){item.start=plannedClock(item.start);item.end=plannedClock(item.end);}
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!recordDay(date))throw Error('Data do culto inválida.');
  if(typeof name!=='string'||!name.trim()||name.length>200)throw Error('Nome do culto inválido.');
  if(date!==plan.date)for(const item of plan.items){item.planned_start=recordInstant(date,item.start);item.planned_end=recordInstant(date,item.end);}
  plan.date=date;plan.name=name===p.plan.name?name:name.trim();return plan;
}
function subactivityRow(s={},parentId,day){
  return `<fieldset class="subactivity" data-sub-id="${esc(s.id||crypto.randomUUID())}" data-parent-id="${esc(s.parent_id??parentId)}"><legend>Subatividade</legend><div class="notes-grid">${field('Título','sub-title',s.title||'','text',true,'maxlength="200"')}${field('Responsável','sub-responsible',s.responsible||'','text',false,'maxlength="200"')}${actualTimeField('Início real (opcional)','sub-start',s.start||'',0,day)}${actualTimeField('Término real (opcional)','sub-end',s.end||'',0,day)}</div><label>Observação<textarea name="sub-note" rows="2" maxlength="2000">${esc(s.note||'')}</textarea></label><button type="button" data-action="remove-subactivity" class="danger-text">Excluir subatividade</button></fieldset>`;
}
function refreshSubactivityLabels(){
  document.querySelectorAll('#actuals-form .actual-row').forEach((row,parentIndex)=>{
    const activity=row.querySelector('.actual-description h3')?.textContent||row.querySelector('[name="extra-theme"]')?.value||'Atividade sem título';
    row.querySelectorAll('.subactivity').forEach((child,index)=>{
      const title=child.querySelector('[name="sub-title"]')?.value||'sem título';
      const context=`Atividade ${parentIndex+1}: ${activity} / Subatividade ${index+1}: ${title}`;
      child.querySelector('legend').textContent=`Subatividade ${index+1}`;
      const labels={'sub-title':'Título','sub-responsible':'Responsável','sub-note':'Observação','sub-start':'Início real (opcional)','sub-end':'Término real (opcional)'};
      for(const [name,label] of Object.entries(labels))child.querySelector(`[name="${name}"]`)?.setAttribute('aria-label',`${label} — ${context}`);
      child.querySelectorAll('[data-action="time-now"]').forEach(button=>button.setAttribute('aria-label',`Preencher ${labels[button.dataset.field]} — ${context} com a hora atual`));
      child.querySelector('[data-action="remove-subactivity"]')?.setAttribute('aria-label',`Excluir ${context}`);
    });
  });
}
function subactivitiesSummary(detail){
  if(!detail?.subactivities?.length)return '';
  return `<ul class="subactivities-summary">${detail.subactivities.map(s=>`<li><strong>${esc(s.title)}</strong>${s.start||s.end?` · ${esc(displayActualTime(s.start)||'—')} → ${esc(displayActualTime(s.end)||'—')}`:''}${s.responsible?`<small>${esc(s.responsible)}</small>`:''}${s.note?`<small>${esc(s.note)}</small>`:''}</li>`).join('')}</ul>`;
}
function markRegistrationDirty(){registrationDirty=true;const form=document.querySelector('#actuals-form');const saving=form?.querySelector('.registration-savebar')?.dataset.state==='saving';setRegistrationSaveState(form,saving?'saving':'dirty',saving?'Envio em andamento. Há alterações mais recentes pendentes.':'Alterações pendentes · ainda não salvas.');}
function canLeaveRegistration(){
  if(window.IASDPIEvents&&!IASDPIEvents.canLeave())return false;
  if(window.IASDPIScheduleManagement&&!IASDPIScheduleManagement.canLeave())return false;
  if(window.IASDPISchedules&&!IASDPISchedules.canLeave())return false;
  if(window.IASDPIDrafts)return IASDPIDrafts.canLeave();
  if(!registrationDirty)return true;
  if(!window.confirm('Descartar as alterações não salvas deste registro?'))return false;
  registrationDirty=false;return true;
}
window.addEventListener('beforeunload',event=>{if(!window.IASDPIDrafts&&registrationDirty){event.preventDefault();event.returnValue='';}});

// Somente apresentação: o envio continua no mesmo formulário e nas mesmas RPCs.
function setRegistrationSaveState(form,phase,message){
  const bar=form?.querySelector('.registration-savebar'),status=bar?.querySelector('#registration-save-status');
  if(!bar||!status)return;
  bar.dataset.state=phase;bar.setAttribute('aria-busy',String(phase==='saving'));
  status.setAttribute('aria-live',phase==='error'?'assertive':'polite');
  status.textContent=message;
}
function refreshScrollableTables(){
  for(const wrapper of document.querySelectorAll('.table-scroll')){
    const scrollable=wrapper.scrollWidth>wrapper.clientWidth+1;
    if(scrollable){
      wrapper.tabIndex=0;wrapper.setAttribute('role','region');
      const title=wrapper.closest('section')?.querySelector('h2')?.textContent||wrapper.querySelector('th')?.textContent||'Dados';
      wrapper.setAttribute('aria-label',`Tabela: ${title}. Rolagem horizontal disponível.`);
    }else{wrapper.removeAttribute('tabindex');wrapper.removeAttribute('role');wrapper.removeAttribute('aria-label');}
  }
}
const pageLayout=(()=>{
  let resizeObserver=null,draftObserver=null;
  function floating(){const candidate=document.querySelector('.registration-savebar,.execution-actions .big');return candidate&&getComputedStyle(candidate).position==='fixed'?candidate:null;}
  function measure(){
    const bar=floating(),root=document.documentElement;
    if(!bar){root.style.removeProperty('--registration-bar-height');root.style.removeProperty('--registration-viewport-inset');return;}
    const viewport=window.visualViewport;
    const inset=viewport&&viewport.scale===1?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
    root.style.setProperty('--registration-viewport-inset',inset+'px');
    root.style.setProperty('--registration-bar-height',Math.ceil(bar.getBoundingClientRect().height)+'px');
  }
  function revealField(){
    const input=document.activeElement,bar=floating();
    if(!bar||!input?.matches('input,select,textarea')||!input.closest('#actuals-form,#notes-form'))return;
    const bounds=input.getBoundingClientRect(),top=(window.visualViewport?.offsetTop||0)+12,bottom=bar.getBoundingClientRect().top-12;
    if(bounds.bottom>bottom)window.scrollBy({top:bounds.bottom-bottom,behavior:'instant'});
    else if(bounds.top<top)window.scrollBy({top:bounds.top-top,behavior:'instant'});
  }
  function resized(){measure();refreshScrollableTables();requestAnimationFrame(revealField);}
  function mount(){
    resizeObserver?.disconnect();draftObserver?.disconnect();
    const form=document.querySelector('#actuals-form'),bar=form?.querySelector('.registration-savebar');
    const control=floating();if(control){resizeObserver=new ResizeObserver(measure);resizeObserver.observe(control);}
    if(bar){
      draftObserver=new MutationObserver(()=>{
        if(form.isConnected&&registrationDirty&&bar.dataset.state==='saved'&&form.querySelector('.draft-feedback'))
          setRegistrationSaveState(form,'dirty','Rascunho recuperado ou alterado · ainda não salvo.');
      });
      draftObserver.observe(form,{childList:true,subtree:true});
    }
    measure();refreshScrollableTables();
  }
  window.addEventListener('resize',resized);
  window.visualViewport?.addEventListener('resize',resized);
  window.visualViewport?.addEventListener('scroll',measure);
  document.addEventListener('focusin',()=>requestAnimationFrame(revealField));
  return {mount};
})();

;
'use strict';
const agendaInitialDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
const agendaState={month:agendaInitialDate.slice(0,7),area:'church',department:'all',view:'calendar',showPeople:true,day:agendaInitialDate};
const ministrySchedules={'Comunicação':[],'Sonoplastia':[]};
const soundScheduleInfo={title:'Escala de Sonoplastia — Outubro de 2026',instruction:'Em caso de impedimento, avisar antecipadamente no grupo responsável.'};
function agendaWeekday(date){const name=new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));return name[0].toLocaleUpperCase('pt-BR')+name.slice(1);}
function agendaSource(){return window.IASDPIAgendaData || {status:'pending',events:[]};}
const agendaDateAdd=(day,amount)=>new Date(new Date(day+'T12:00:00Z').getTime()+amount*86400000).toISOString().slice(0,10);
function agendaPeriod(e){return e.startDate===e.endDate?programDate(e.startDate):`${programDate(e.startDate)} → ${programDate(e.endDate)}`;}
function agendaOverlaps(e,start,end){return e.startDate<=end && e.endDate>=start;}
function agendaMonthBounds(month){const first=month+'-01',date=new Date(first+'T12:00:00Z');return [first,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0,12)).toISOString().slice(0,10)];}
function agendaEvents(){
  const grouped=[];
  for(const e of agendaSource().events.filter(e=>e.kind==='event').sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title))){
    const previous=grouped.findLast(p=>(p.allDay||p.wholeDay)&&(e.allDay||e.wholeDay)&&p.title===e.title&&p.department===e.department&&p.location===e.location&&agendaDateAdd(p.endDate,1)===e.startDate);
    if(previous){previous.end=e.end;previous.endDate=e.endDate;previous.sourceIds.push(e.id);}
    else grouped.push({...e,sourceIds:[e.id]});
  }
  return grouped.sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
}
function agendaIssues(e,events){
  const flags=[];
  if(!(e.allDay||e.wholeDay)&&events.some(other=>other.id!==e.id&&!(other.allDay||other.wholeDay)&&new Date(e.start)<new Date(other.end)&&new Date(e.end)>new Date(other.start)))flags.push('Horários simultâneos · conferir');
  if(events.some(other=>other.id!==e.id&&e.title===other.title&&e.startDate===other.startDate&&e.start!==other.start))flags.push('Mesmo nome em horários diferentes');
  const anniversary=e.title.match(/(\d+)\s*Anos da Escola Sabatina/i);
  if(anniversary&&events.some(other=>{const match=other.title.match(/(\d+)\s*Anos da Escola Sabatina/i);return match&&match[1]!==anniversary[1]&&other.startDate===e.startDate;}))flags.push('Número do aniversário divergente');
  return flags;
}
function agendaEventList(events,allMonth){
  if(!events.length)return empty('Nenhum evento neste período','Escolha outro departamento, dia ou mês.');
  return `<ul class="church-events">${events.map(e=>`<li><div class="church-event-date"><span>${esc(agendaPeriod(e))}</span><strong>${e.allDay||e.wholeDay?'Dia inteiro':esc(displayPlannedTime(e.start)+' → '+displayPlannedTime(e.end))}</strong></div><div class="church-event-body"><h3>${esc(e.title)}</h3><p>${esc(e.department || 'Departamento não informado')}${e.location?' · '+esc(e.location):''}</p>${e.sourceIds.length>1?`<small class="muted">Período agrupado · ${e.sourceIds.length} registros da fonte preservados</small>`:''}<div class="agenda-flags">${agendaIssues(e,allMonth).map(flag=>`<span class="badge warning">${esc(flag)}</span>`).join('')}</div></div></li>`).join('')}</ul>`;
}
function agendaResponsibles(start,end){
  const month=agendaSource().events.filter(e=>e.kind==='monthly'&&agendaOverlaps(e,start,end));
  const weekly=agendaSource().events.filter(e=>e.kind==='weekly'&&agendaOverlaps(e,start,end)).sort((a,b)=>a.start.localeCompare(b.start));
  const selected=weekly.filter(e=>agendaOverlaps(e,agendaState.day,agendaState.day));
  const names=e=>agendaState.showPeople?esc(e.person):'Escala definida';
  return `<section class="agenda-responsibles" aria-label="Anciãos responsáveis"><div class="panel"><p class="eyebrow">ANCIÃO DO MÊS</p>${month.length?month.map(e=>`<h2>${names(e)}</h2><p class="muted">${esc(agendaPeriod(e))}</p>`).join(''):'<p>Não informado no calendário para este mês.</p>'}</div><div class="panel"><p class="eyebrow">ANCIÃO DA SEMANA · DATA SELECIONADA</p>${selected.length?selected.map(e=>`<h2>${names(e)}</h2><p class="muted">${esc(agendaPeriod(e))}</p>`).join(''):'<p>Não informado para a data selecionada.</p>'}</div></section>
  <details class="panel agenda-weeks" ${agendaState.month!==today().slice(0,7)?'open':''}><summary>Escalas semanais do mês · ${weekly.length}</summary>${weekly.length?`<ul>${weekly.map(e=>`<li><strong>${names(e)}</strong><span>${esc(agendaPeriod(e))}</span></li>`).join('')}</ul>`:'<p class="muted">Nenhuma escala semanal neste período.</p>'}</details>`;
}
// Origem dos dados, sem atribuir uma sincronização oficial às escalas manuais.
function agendaProvenance(area,source=agendaSource()){
  if(area==='communication'||area==='sound'){
    const ministry=area==='communication'?'Comunicação':'Sonoplastia',dates=ministrySchedules[ministry].map(e=>e.date).sort();
    return `<section class="agenda-source form-note" aria-label="Fonte da escala" data-source="manual"><strong>Origem: escala manual de ${esc(ministry)}${area==='sound'?' fornecida pela liderança':''}</strong><p>${area==='sound'?'Fornecida pela liderança.':'Informada à aplicação e mantida no código.'} Não é sincronizada automaticamente com o calendário oficial.</p><p>Última atualização da escala: não informada. Vigência: ${dates.length?esc(displayDate(dates[0])+' a '+displayDate(dates.at(-1))):'não definida; nenhuma escala cadastrada'}.</p>${area==='sound'&&dates.length?`<p>Documento: Outubro de 2026 · ${dates.length} datas. Inclui também 01/11/2026 e 04/11/2026; selecione novembro para consultar essas datas.</p><p class="schedule-instruction">${esc(soundScheduleInfo.instruction)}</p>`:''}</section>`;
  }
  const valid=source.syncedAt&&inspectRecordTime(source.syncedAt).valid,stale=valid&&currentTime()-new Date(source.syncedAt)>86400000;
  return `<section class="agenda-source muted" aria-label="Fonte da agenda" data-source="official"><strong>Origem: calendário oficial da igreja (Google Calendar)</strong><p>${source.status==='synced'&&valid?`Fonte oficial consultada em ${esc(displayRecordTimestamp(source.syncedAt))}.${stale?' A última sincronização tem mais de 24 horas.':''}`:'Aguardando sincronização com o calendário oficial.'} Esta página usa uma cópia publicada; abrir ou atualizar o navegador não consulta novamente o calendário.</p><p>Período importado: ${source.fromMonth&&source.toMonth?esc(source.fromMonth.split('-').reverse().join('/')+' a '+source.toMonth.split('-').reverse().join('/')):'não informado'}. <a href="https://iasd-paradainglesa.netlify.app/" target="_blank" rel="noopener noreferrer">Consultar fonte oficial ↗</a></p></section>`;
}
function agendasPage(){
  if(window.IASDPIConfig?.calendarPrivacyEnabled)return IASDPIScheduleCalendar.page();
  const {month,area,department,view,day,showPeople}=agendaState,[start,end]=agendaMonthBounds(month);
  const source=agendaSource(),allMonth=agendaEvents().filter(e=>agendaOverlaps(e,start,end));
  const events=allMonth.filter(e=>department==='all'||e.department===department);
  const departments=[...new Set(agendaSource().events.filter(e=>e.kind==='event').map(e=>e.department||'Não informado'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const ministry=area==='elders'?'Anciãos':area==='communication'?'Comunicação':'Sonoplastia';
  const scale=area==='elders'?source.events.filter(e=>e.kind==='weekly'&&agendaOverlaps(e,start,end)).sort((a,b)=>a.start.localeCompare(b.start)).map(e=>({...e,date:e.startDate<start?start:e.startDate})):area==='church'?[]:ministrySchedules[ministry].filter(e=>e.date.startsWith(month));
  const monthDate=new Date(start+'T12:00:00Z'),monthTitle=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(monthDate);
  return heading('ORGANIZAÇÃO','Escalas e agendas','Anciãos, programação da igreja e escalas dos ministérios.')+
    '<p><a href="#schedule-calendar">Calendário mensal de escalas</a> · <a href="#schedule-setup">Cadastros de escalas — pessoas, departamentos e funções</a></p>'+
    `${agendaProvenance(area,source)}${!['communication','sound'].includes(area)&&source.fromMonth && (month<source.fromMonth||month>source.toMonth)?'<p class="form-note">Este mês está fora do período importado. Uma nova sincronização é necessária para verificar os registros.</p>':''}
    <section class="panel agenda-filters"><label for="agenda-area">Consultar<select id="agenda-area"><option value="church" ${area==='church'?'selected':''}>Agenda da igreja</option><option value="communication" ${area==='communication'?'selected':''}>Escala de Comunicação</option><option value="elders" ${area==='elders'?'selected':''}>Escala de Anciãos</option><option value="sound" ${area==='sound'?'selected':''}>Escala de Sonoplastia</option></select></label>${area==='church'?`<label for="agenda-department">Departamento<select id="agenda-department"><option value="all">Todos os departamentos</option>${departments.map(name=>`<option value="${esc(name)}" ${name===department?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`:''}<label class="checkbox"><input id="agenda-show-people" type="checkbox" ${showPeople?'checked':''}> Mostrar pessoa escalada</label></section>
    <section class="panel agenda-toolbar"><div class="agenda-month"><button type="button" data-action="agenda-previous" aria-label="Mês anterior">‹</button><h2 id="agenda-month-title">${esc(monthTitle)}</h2><button type="button" data-action="agenda-next" aria-label="Próximo mês">›</button></div><div class="agenda-controls"><label for="agenda-month-picker">Mês e ano<input id="agenda-month-picker" type="month" value="${month}"></label>${button('Mês atual','agenda-current')}<div class="agenda-view" aria-label="Visualização">${button('Calendário','agenda-calendar','','aria-pressed="'+(view==='calendar')+'"')}${button('Lista','agenda-list','','aria-pressed="'+(view==='list')+'"')}</div></div></section>
    ${area==='church'||area==='elders'?agendaResponsibles(start,end):''}
    ${view==='calendar'?`<section class="agenda-calendar" aria-label="Calendário de ${esc(monthTitle)}"><div class="calendar-weekdays" aria-hidden="true">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-days">${Array.from({length:monthDate.getUTCDay()},()=>'<span aria-hidden="true"></span>').join('')}${Array.from({length:Number(end.slice(-2))},(_,index)=>{
      const date=month+'-'+String(index+1).padStart(2,'0'),appointments=events.filter(e=>agendaOverlaps(e,date,date)),entry=scale.find(e=>e.startDate?agendaOverlaps(e,date,date):e.date===date);
      const count=area==='church'?appointments.length:entry?1:0;
      return `<button type="button" class="calendar-day ${count?'scheduled':''} ${date===day?'selected-day':''}" data-action="agenda-day" data-id="${date}" aria-pressed="${date===day}" ${date===today()?'aria-current="date"':''} aria-label="${esc(programDate(date))} · ${count} ${area==='church'?'eventos':'escalas'}"><span class="calendar-number">${index+1}</span>${area==='church'?appointments.length?`<span class="calendar-person">${appointments.length} evento${appointments.length>1?'s':''}</span><span class="calendar-event-title">${esc(appointments[0].title)}${appointments[0].startDate!==date?' · continuação':''}</span>`:'':entry?`<span class="calendar-person">${showPeople?esc(entry.person):'Escala definida'}</span>`:''}</button>`;
    }).join('')}</div></section>`:''}
    <section class="section"><div class="section-heading"><h2>${area==='church'?view==='calendar'?'Eventos · '+esc(programDate(day)):'Programação da igreja':area==='sound'?esc(soundScheduleInfo.title):`Escala de ${esc(ministry)}`}</h2><span class="muted">${area==='church'?events.length+' eventos no mês':scale.length+' datas com escala'}</span></div>${area==='church'?agendaEventList(view==='calendar'?events.filter(e=>agendaOverlaps(e,day,day)):events,allMonth):scale.length?`<ul class="agenda-list">${scale.map(e=>`<li><button type="button" ${e.startDate?'':'class="ministry-shift" data-schedule-date="'+e.date+'"'} data-action="agenda-day" data-id="${e.date}">${e.startDate?`<span>${esc(agendaPeriod(e))}</span>`:`<span class="ministry-shift-date"><time datetime="${e.date}">${esc(displayDate(e.date))}</time><small>${esc(agendaWeekday(e.date))}</small></span><span class="ministry-shift-department">${esc(ministry)}</span>`}<strong>${showPeople?esc(e.person):'Escala definida'}</strong></button></li>`).join('')}</ul>`:empty('Nenhuma escala cadastrada neste mês',`Ainda não há nomes informados para ${esc(ministry)} neste período.`)}</section>`;
}
function selectAgendaMonth(month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1000)throw Error('Selecione um mês e ano válidos.');
  agendaState.month=month;agendaState.day=month===today().slice(0,7)?today():month+'-01';render();
}
function changeAgendaMonth(amount){const date=new Date(agendaState.month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+amount);selectAgendaMonth(date.toISOString().slice(0,7));document.querySelector(`[data-action="${amount>0?'agenda-next':'agenda-previous'}"]`).focus();}

// Calendário de consulta: sem escrita ou inferência de atribuições.
window.IASDPIScheduleCalendar=(()=>{
 const zone='America/Sao_Paulo';
 const dayNow=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date());
 const ui={month:dayNow().slice(0,7),day:dayNow(),departments:null,person:'all'};
 const colors=Object.assign(Object.create(null),{'Sonoplastia':['#e6f0ff','#174c8a'],'Diaconato':['#e5f5eb','#185b35'],'Música':['#f1e8ff','#61368a'],'Ancionato':['#fff3cd','#6c4e00'],'Comunicação':['#fff0df','#8c420b']});
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dateText=d=>d.split('-').reverse().join('/');
 const addDays=(d,n)=>new Date(new Date(d+'T12:00:00Z').getTime()+n*86400000).toISOString().slice(0,10);
 const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(new Date(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 function icon(department){
  const paths={Sonoplastia:'M5 3v18M12 3v18M19 3v18M2 8h6M9 15h6M16 7h6',Música:'M9 18V5l11-2v13M9 5l11-2M9 18c0 2-6 3-6 0s6-3 6 0M20 16c0 2-6 3-6 0s6-3 6 0',Diaconato:'M2 13l5-5 5 3 5-3 5 5-6 7H8zM7 8l5-4 5 4M8 14l4 3 4-3',Ancionato:'M12 5c-3-2-7-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1v15',Comunicação:'M3 10h5l12-6v16L8 14H3zM8 14l2 7h4l-3-8M20 9h2v6h-2'};
  return `<svg class="scale-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${(Object.hasOwn(paths,department)?paths[department]:null)||'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8 12h8M12 8v8'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
 }
 function legacy(){
  if(window.IASDPIConfig?.calendarPrivacyEnabled)return [];
  if(window.IASDPIPortalAccess?.enabled()&&IASDPIChurches.selected()&&IASDPIChurches.selected()!=='IASD_PI')return [];
  const rows=window.IASDPICalendarSource?window.IASDPICalendarSource():Object.entries(ministrySchedules).flatMap(([department,entries])=>entries.map(r=>({id:'legacy:'+department+':'+r.date+':'+r.person,date:r.date,department,person:r.person,role:null,origin:'Escala manual informada'})));
  return rows.map(r=>window.IASDPIRegistry?.historical({...r})||{...r});
 }
 function officialSource(){if(window.IASDPIConfig?.initialOperational)return {events:[]};if(window.IASDPIPortalAccess?.enabled()&&IASDPIChurches.selected()&&IASDPIChurches.selected()!=='IASD_PI')return {events:[]};return window.IASDPICalendarOfficialSource?window.IASDPICalendarOfficialSource():window.IASDPIAgendaData||{events:[]};}
 function periods(){
  const seen=new Set();
  const valid=e=>['monthly','weekly'].includes(e.kind)&&validDay(e.startDate)&&validDay(e.endDate)&&e.endDate>=e.startDate;
  const feed=window.IASDPIPortalAccess?.enabled()?IASDPIPortalAccess.feedRows(ui.month):[];
  const managed=[...(!window.IASDPIConfig?.initialOperational?(window.IASDPICalendarManagedPeriodsSource?.()||[]):[]),...feed.filter(e=>e.kind)].filter(valid),key=e=>e.kind+':'+e.startDate+':'+e.endDate,managedKeys=new Set(managed.map(key));
  const official=(officialSource().events||[]).filter(valid).filter(e=>!managedKeys.has(key(e)));
  return [...official.map(e=>({...e,calendarId:'official:'+(e.id||[e.kind,e.startDate,e.endDate,e.person||''].join(':')),calendarOrigin:'Agenda oficial · cópia publicada'})),...managed.map(e=>({...e,calendarId:'managed:'+e.id,calendarOrigin:e.origin||'Escala publicada no sistema'}))].map(e=>({id:e.calendarId,date:e.startDate,startDate:e.startDate,endDate:e.endDate,kind:e.kind,department:'Ancionato',person:e.person||null,role:e.kind==='monthly'?'Ancião do Mês':'Ancião da Semana',origin:e.calendarOrigin})).filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true;});
 }
 function data(){return [...legacy(),...periods().map(r=>window.IASDPIRegistry?.historical(r)||r),...(window.IASDPIPortalAccess?.enabled()?IASDPIPortalAccess.feedRows(ui.month).filter(e=>!e.kind).map(r=>window.IASDPIRegistry?.historical(r)||r):[])];}
 const departments=()=>[...new Set([...Object.keys(colors),...data().map(r=>r.department)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const active=d=>ui.departments===null||ui.departments.has(d);
 const unified=()=>window.IASDPIEvents?.enabled()===true;
 const refine={mode:'home',departments:new Set(),people:new Set(),categories:new Set(),panel:false,open:null,search:''};
 const publicGuest=()=>window.IASDPIConfig?.calendarPrivacyEnabled&&!IASDPIAuth.identityKey();
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const chosen=(set,value)=>!set.size||set.has(value);
 const eventDepartment=e=>e.department_name||e.department||'';
 const eventCategory=e=>e.program_category||'pending';
 const categoryOptions=[['general','Programação Geral'],['departmental','Programação Departamental'],['reserved','Atividade Reservada'],['pending','Pendente de revisão']];
 function matchesEvent(e){return refine.mode==='home'||(refine.mode!=='scales'&&chosen(refine.departments,eventDepartment(e))&&(refine.mode!=='events'||chosen(refine.categories,eventCategory(e))));}
 const matches=r=>unified()?(refine.mode==='home'?r.department==='Ancionato':refine.mode!=='events'&&chosen(refine.departments,r.department)&&(refine.mode!=='scales'||chosen(refine.people,r.person||'__unassigned__'))):active(r.department)&&(ui.person==='all'||(r.person||'__unassigned__')===ui.person);
 function filterOptions(){
  const events=window.IASDPIEvents?.allRows(ui.month)||[],rows=data();
  return {departments:[...new Set([...departments(),...events.map(eventDepartment),...refine.departments].filter(d=>d&&(!publicGuest()||d==='Ancionato'||refine.mode==='events'&&events.some(e=>eventDepartment(e)===d))))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>[v,v]),
   people:[...new Set([...rows.map(r=>r.person||(r.role?'__unassigned__':null)),...refine.people].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>[v,v==='__unassigned__'?'A definir':v]),
   categories:categoryOptions};
 }
 function refinements(){return [['departments','Departamento'],...(refine.mode==='scales'?[['people','Pessoa']]:[]),...(refine.mode==='events'?[['categories','Categoria do evento']]:[])];}
 function filterCount(){return refinements().reduce((sum,[key])=>sum+refine[key].size,0);}
 function clearRefinements(){for(const key of ['departments','people','categories'])refine[key].clear();refine.search='';refine.open=null;}
 function multiselect(key,label,options){
  const selected=refine[key];return `<details class="calendar-multiselect" data-refine-list="${key}" ${refine.open===key?'open':''}><summary id="calendar-${key}-summary"><span>${label}</span><span class="calendar-filter-count">${selected.size?selected.size+' selecionado'+(selected.size===1?'':'s'):'Todos'}</span><span aria-hidden="true">⌄</span></summary><div class="calendar-options-panel" role="group" aria-label="${label}">${key==='people'?`<label class="calendar-person-search">Pesquisar pessoas<input type="search" id="calendar-person-search" autocomplete="off" value="${escape(refine.search)}" placeholder="Digite parte do nome"></label><p class="calendar-option-note">Nomes presentes nas escalas autorizadas.</p>`:''}<div class="calendar-options">${options.map(([value,name],i)=>`<label class="calendar-check-option" ${key==='people'&&!normalize(name).includes(normalize(refine.search))?'hidden':''} data-search-name="${escape(normalize(name))}"><input type="checkbox" id="calendar-${key}-${i}" data-calendar-filter="${key}" value="${escape(value)}" ${selected.has(value)?'checked':''}><span>${escape(name)}</span></label>`).join('')}</div>${key==='people'?`<p class="calendar-search-empty" role="status" ${options.some(([,name])=>normalize(name).includes(normalize(refine.search)))?'hidden':''}>Nenhuma pessoa corresponde à pesquisa.</p>`:''}</div></details>`;
 }
 function quickDepartments(){
  if(refine.mode!=='scales')return '';
  const quick=publicGuest()?['Ancionato']:departments();
  return `<div class="calendar-quick-departments" role="group" aria-label="Filtros rápidos de departamentos"><button type="button" class="calendar-quick-all" data-calendar-quick-all aria-pressed="${refine.departments.size===0}">Todos</button>${quick.map(d=>`<button type="button" class="scale-tag calendar-quick-filter" data-calendar-quick-department="${escape(d)}" data-scale-color="${escape(d)}" aria-pressed="${refine.departments.has(d)}">${icon(d)}<span>${escape(d)}</span>${refine.departments.has(d)?'<span aria-hidden="true">✓</span>':''}</button>`).join('')}</div>`;
 }
 function refinementControls(){
  const options=filterOptions(),count=filterCount(),classified=window.IASDPIEvents.allRows(ui.month).some(e=>e.program_category);
  const chips=refinements().flatMap(([key,label])=>[...refine[key]].map(value=>{const name=options[key].find(([v])=>v===value)?.[1]||value;return `<button type="button" class="calendar-filter-chip" data-calendar-remove="${key}" data-value="${escape(value)}" aria-label="Remover ${escape(label.toLowerCase()+': '+name)}" title="${escape(label+': '+name)}"><span>${escape(name)}</span><span aria-hidden="true">×</span></button>`;})).join('');
  return `<div class="calendar-filter-toolbar"><div class="calendar-modes" role="group" aria-label="Mostrar no calendário">${[['home','Início'],['all','Tudo'],['scales','Escalas'],['events','Eventos']].map(([mode,label])=>`<button type="button" id="calendar-mode-${mode}" data-calendar-mode="${mode}" aria-pressed="${refine.mode===mode}">${label}</button>`).join('')}</div><button type="button" id="calendar-filters-toggle" aria-expanded="${refine.panel}" aria-controls="calendar-refine-panel" data-calendar-toggle><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M10 15v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Filtros${count?' ('+count+')':''}</button></div>
   ${quickDepartments()}
   <section class="calendar-refine-panel" id="calendar-refine-panel" aria-labelledby="calendar-refine-title" ${refine.panel?'':'hidden'}><h3 id="calendar-refine-title">Refinar calendário</h3><div class="calendar-filter-fields">${refinements().map(([key,label])=>multiselect(key,label,options[key])).join('')}</div><p class="calendar-filter-hint">Sem seleção, todas as opções são consideradas.${refine.departments.size?' As atividades estão restritas aos departamentos selecionados.':''}</p>${refine.mode==='events'&&!classified?'<p class="calendar-option-note">Classificação pendente de revisão. Os dados anteriores permanecem preservados.</p>':''}<div class="calendar-filter-actions"><button type="button" data-calendar-clear>Limpar filtros</button><button type="button" data-events-feed-retry="${escape(ui.month)}">Atualizar calendário</button><button type="button" class="primary" data-calendar-done>Concluir</button></div></section>
   ${chips?`<div class="calendar-active-filters" role="group" aria-label="Filtros ativos">${chips}</div>`:''}`;
 }
 document.addEventListener('toggle',e=>{const el=e.target;if(!unified()||!el.isConnected||!el.matches('details[data-refine-list]'))return;if(el.open){refine.open=el.dataset.refineList;document.querySelectorAll('details[data-refine-list][open]').forEach(other=>{if(other!==el)other.open=false;});}else if(refine.open===el.dataset.refineList)refine.open=null;},true);
 document.addEventListener('input',e=>{if(e.target.id!=='calendar-person-search'||!unified())return;refine.search=e.target.value;const dropdown=e.target.closest('details');let visible=0;dropdown.querySelectorAll('[data-search-name]').forEach(row=>{row.hidden=!row.dataset.searchName.includes(normalize(refine.search));if(!row.hidden)visible++;});dropdown.querySelector('.calendar-search-empty').hidden=visible>0;});
 document.addEventListener('change',e=>{const el=e.target;if(!unified()||!el.matches('[data-calendar-filter]'))return;const set=refine[el.dataset.calendarFilter];if(!set)return;if(el.checked)set.add(el.value);else set.delete(el.value);refine.open=el.closest('details').dataset.refineList;redraw(el.id);});
 document.addEventListener('click',e=>{const el=e.target.closest('[data-calendar-quick-all],[data-calendar-quick-department],[data-calendar-mode],[data-calendar-toggle],[data-calendar-done],[data-calendar-clear],[data-calendar-remove]');if(!unified()||!el)return;e.preventDefault();
  if(el.hasAttribute('data-calendar-quick-all')){refine.departments.clear();redraw();document.querySelector('[data-calendar-quick-all]')?.focus({preventScroll:true});return;}
  if(el.dataset.calendarQuickDepartment){const department=el.dataset.calendarQuickDepartment;if(refine.departments.has(department))refine.departments.delete(department);else refine.departments.add(department);redraw();[...document.querySelectorAll('[data-calendar-quick-department]')].find(button=>button.dataset.calendarQuickDepartment===department)?.focus({preventScroll:true});return;}
  if(el.dataset.calendarMode){refine.mode=el.dataset.calendarMode;if(refine.mode!=='scales'){refine.people.clear();refine.search='';}if(refine.mode!=='events')refine.categories.clear();refine.open=null;redraw('calendar-mode-'+refine.mode);return;}
  if(el.hasAttribute('data-calendar-toggle')){refine.panel=!refine.panel;if(!refine.panel)refine.open=null;redraw('calendar-filters-toggle');return;}
  if(el.hasAttribute('data-calendar-done')){refine.panel=false;refine.open=null;redraw('calendar-filters-toggle');return;}
  if(el.hasAttribute('data-calendar-clear')){clearRefinements();redraw('calendar-filters-toggle');return;}
  if(el.dataset.calendarRemove){refine[el.dataset.calendarRemove]?.delete(el.dataset.value);redraw('calendar-filters-toggle');}
 });
 document.addEventListener('keydown',e=>{if(!unified()||e.key!=='Escape')return;const dropdown=e.target.closest('details[data-refine-list]');if(dropdown?.open){dropdown.open=false;refine.open=null;dropdown.querySelector('summary').focus();e.preventDefault();e.stopPropagation();}else if(e.target.closest('#calendar-refine-panel')){refine.panel=false;refine.open=null;redraw('calendar-filters-toggle');e.preventDefault();}});
 document.addEventListener('click',e=>{if(!unified()||!refine.open||e.target.closest('details[data-refine-list]'))return;document.querySelectorAll('details[data-refine-list][open]').forEach(el=>el.open=false);refine.open=null;});
 for(const ev of ['iasdpi-church-changed','iasdpi-auth-changed','iasdpi-identity-ended'])window.addEventListener(ev,()=>{clearRefinements();refine.mode='home';refine.panel=false;});
 const overlaps=(r,start,end)=>r.startDate?r.startDate<=end&&r.endDate>=start:r.date>=start&&r.date<=end;
 const compareNames=(a,b)=>window.IASDPIScheduleRules?.compareNames(a,b)??String(a||'').localeCompare(String(b||''),'pt-BR',{sensitivity:'base'});
 const sort=rows=>rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||compareNames(a.person||'\uffff',b.person||'\uffff')||compareNames(a.department,b.department)||String(a.id||'').localeCompare(String(b.id||'')));
 function monthDays(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1000)throw Error('Selecione um mês válido.');return new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0,12)).getUTCDate();}
 function changeMonth(value){monthDays(value);ui.month=value;ui.day=value===dayNow().slice(0,7)?dayNow():value+'-01';}
 function shift(n){const d=new Date(ui.month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);changeMonth(d.toISOString().slice(0,7));}
 const personText=r=>r.person||(r.role?'A definir'+(r.vacancy_count>1?' ('+r.vacancy_count+' vagas)':''):'Responsável não informado');
 const label=r=>`${r.department} — ${personText(r)} · ${r.role||'Função não informada'}`;
 function tag(r,compact=false){if(r.isEvent)return IASDPIEvents.chip(r);return `<span class="scale-tag ${compact?'scale-chip':''}" data-scale-color="${escape(r.department)}" title="${escape(label(r))}">${icon(r.department)}<span class="scale-person-name">${escape(compact?personText(r):r.department+' — '+personText(r))}</span>${compact?`<span class="sr-only">${escape(r.department+' · '+(r.role||'Função não informada'))}</span>`:''}</span>`;}
 let detailHelpId=0;
 function list(rows,emptyText){return rows.length?`<ul class="scale-details">${rows.map(r=>r.isEvent?`<li>${IASDPIEvents.details(r)}</li>`:`<li>${tag(r)}<small>${r.startDate?dateText(r.startDate)+' a '+dateText(r.endDate):dateText(r.date)}${window.IASDPIScheduleUI?.isReview()?(r.role?' · '+escape(r.role):''):' · '+escape(r.role||'Função não informada')+' · '+escape(r.origin)}</small>${window.IASDPIScheduleUI?.isReview()?IASDPIScheduleUI.help('calendar-details-'+(++detailHelpId),'Origem: '+String(r.origin||'Não informada').replace(/SIMULAÇÃO LOCAL · não publicada no site oficial|Escala publicada nesta demonstração · memória da aba/,'Publicação nesta aba')+'.','Detalhes de '+label(r)):''}</li>`).join('')}</ul>`:`<p class="muted">${escape(emptyText)}</p>`;}

 // Cada intervalo é recortado por semana. Faixas sobrepostas recebem linhas próprias.
 function segments(rows,weekStart,monthStart,monthEnd){
  const start=weekStart<monthStart?monthStart:weekStart,end=addDays(weekStart,6)>monthEnd?monthEnd:addDays(weekStart,6);
  return rows.filter(r=>r.startDate&&overlaps(r,start,end)).map(r=>{const from=r.startDate>start?r.startDate:start,to=r.endDate<end?r.endDate:end;return {record:r,from,to,column:Math.round((new Date(from+'T12:00:00Z')-new Date(weekStart+'T12:00:00Z'))/86400000),span:Math.round((new Date(to+'T12:00:00Z')-new Date(from+'T12:00:00Z'))/86400000)+1};}).sort((a,b)=>a.record.kind.localeCompare(b.record.kind)||a.column-b.column||a.record.id.localeCompare(b.record.id));
 }
 function bandRows(rows,weekStart,monthStart,monthEnd){
  const parts=segments(rows,weekStart,monthStart,monthEnd),output=[];
  for(const kind of ['weekly']){
   const lanes=[];
   for(const part of parts.filter(p=>p.record.kind===kind)){let lane=lanes.find(l=>l.at(-1).column+l.at(-1).span<=part.column);if(!lane){lane=[];lanes.push(lane);}lane.push(part);}
   for(const lane of lanes){let cursor=0,cells='';for(const part of lane){const r=part.record;if(part.column>cursor)cells+=`<td colspan="${part.column-cursor}" class="scale-band-gap"></td>`;
    cells+=`<td colspan="${part.span}" class="scale-band-cell"><button type="button" class="scale-band scale-${kind}" data-scale-action="period" data-start-date="${part.from}" data-scale-id="${escape(r.id)}" data-scale-kind="${kind}" data-scale-color="Ancionato" data-from="${part.from}" data-to="${part.to}" aria-label="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}" title="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}">${icon('Ancionato')}<span class="scale-band-label">${kind==='monthly'?'Mês':'Semana'}:</span><span class="scale-person-name">${escape(personText(r))}</span></button></td>`;cursor=part.column+part.span;}
    if(cursor<7)cells+=`<td colspan="${7-cursor}" class="scale-band-gap"></td>`;
    output.push(`<tr class="scale-band-row" data-band-kind="${kind}">${cells}</tr>`);
   }
  }
  return output.join('');
 }
 function page(){
  const publicStatus=window.IASDPIPortalAccess?.enabled()?IASDPIPortalAccess.feedStatus(ui.month):'';
  const rows=data(),filtered=sort(rows.filter(matches)),monthStart=ui.month+'-01',days=monthDays(ui.month),monthEnd=ui.month+'-'+days;
  const eventsEnabled=window.IASDPIEvents?.enabled(),eventRows=eventsEnabled?IASDPIEvents.rows(ui.month):[];
  const monthly=filtered.filter(r=>overlaps(r,monthStart,monthEnd)),selected=[...filtered.filter(r=>overlaps(r,ui.day,ui.day)),...eventRows.filter(e=>IASDPIEvents.onDay(e,ui.day))];
  const people=[...new Set(rows.map(r=>r.person).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const title=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(monthStart+'T12:00:00Z'));
  const offset=new Date(monthStart+'T12:00:00Z').getUTCDay(),first=addDays(monthStart,-offset),weekCount=Math.ceil((offset+days)/7);
  const weeks=Array.from({length:weekCount},(_,week)=>{
   const weekStart=addDays(first,week*7);
   const bands=bandRows(monthly,weekStart,monthStart,monthEnd);
   const numbers=bands?`<tr class="scale-number-row">${Array.from({length:7},(_,col)=>{const day=addDays(weekStart,col);return day.startsWith(ui.month)?`<td><span class="scale-day-number ${day===dayNow()?'scale-today-number':''}" aria-hidden="true">${Number(day.slice(-2))}</span></td>`:'<td class="scale-outside" aria-hidden="true"></td>';}).join('')}</tr>`:'';
   const cells=Array.from({length:7},(_,col)=>{const day=addDays(weekStart,col);if(!day.startsWith(ui.month))return '<td class="scale-outside" aria-hidden="true"></td>';
    const dayEvents=eventRows.filter(e=>IASDPIEvents.onDay(e,day)),items=[...monthly.filter(r=>!r.startDate&&r.date===day),...dayEvents],all=[...monthly.filter(r=>overlaps(r,day,day)),...dayEvents];
    return `<td data-scale-day="${day}"><button type="button" class="scale-day" data-scale-action="day" data-date="${day}" aria-label="${escape(dateText(day)+' · '+all.length+' entradas'+(all.length?': '+all.map(r=>r.isEvent?r.title+' · '+IASDPIEvents.categoryText(r):label(r)).join('; '):''))}" aria-pressed="${day===ui.day}" ${day===dayNow()?'aria-current="date"':''}>${bands?'':`<span class="scale-day-number">${Number(day.slice(-2))}</span>`}${items.map(r=>tag(r,true)).join('')}</button></td>`;
   }).join('');
   return `<tbody class="scale-week-group ${bands?'scale-week-with-periods':''}">${numbers}${bands}<tr class="scale-days-row" data-week-start="${weekStart}">${cells}</tr></tbody>`;
  }).join('');
  const missing=monthly.filter(r=>!r.person&&r.role),pointCount=monthly.filter(r=>!r.startDate).length,source=officialSource();
  const managementLinks=!window.IASDPIConfig?.initialOperational||window.IASDPIPortalAccess?.can('schedule-build');
  return `<div class="scale-heading"><div><p class="eyebrow">GESTÃO DE ESCALAS · CONSULTA</p><h1>${eventsEnabled?'Calendário IASDPI':'Calendário de escalas'}</h1></div>${eventsEnabled&&managementLinks?'<a class="button" href="#events" data-page="events">Gestão de Eventos</a>':''}${managementLinks?`<div><a href="#schedule-setup" data-calendar-nav>Cadastros de pessoas e funções</a>${window.IASDPIScheduleManagement?'<a href="#schedule-build" class="button primary" data-calendar-nav>Criar escala</a>':'<button type="button" class="primary" disabled aria-describedby="scale-create-note">Criar escala</button>'}</div>`:''}</div>
   ${window.IASDPIScheduleUI?.isReview()?'':`<p id="scale-create-note" class="muted">${window.IASDPIScheduleManagement?'Montagem manual disponível para administradores e gestores ministeriais autorizados.':'Criação de escalas em preparação. Nesta etapa não há gravação da Fase B.'}</p>`}
   ${window.IASDPIScheduleUI?.isReview()?'':`<details class="scale-provenance"><summary>Origem das escalas</summary><p>Sonoplastia: 15 registros manuais de outubro/início de novembro de 2026. Comunicação: cinco registros manuais de outubro. Grafias preservadas; sem sincronização automática dessas listas.</p><p>Anciãos: cópia da Agenda oficial${source.syncedAt?' atualizada em '+escape(dateText(source.syncedAt.slice(0,10))):'; atualização não informada'}. Datas finais inclusivas conforme a fonte. Nenhum ancião é inferido nos períodos sem escala.</p><p>Horários não informados; esta consulta não valida conflitos de horário.</p></details>`}
   ${eventsEnabled?IASDPIEvents.controls(ui.month):''}${publicStatus}${!window.IASDPIScheduleUI?.isReview()&&window.IASDPICalendarManagedPeriodsSource?'<p class="muted">Somente publicações confirmadas aparecem aqui. Uma nova revisão em rascunho mantém a última publicação no calendário. Nesta demonstração, as alterações ficam apenas na aba.</p>':''}<section class="panel scale-month-panel"><div class="scale-month-actions"><button type="button" data-scale-action="previous" aria-label="Mês anterior">‹</button><h2 id="scale-month-title">${escape(title)}</h2><button type="button" data-scale-action="next" aria-label="Próximo mês">›</button>${window.IASDPIScheduleUI?.isReview()?IASDPIScheduleUI.monthPicker('scale-month',ui.month):`<label>Mês<input type="month" id="scale-month" value="${ui.month}"></label>`}<button type="button" data-scale-action="today">Hoje</button></div>
   ${eventsEnabled?refinementControls():''}
   ${!eventsEnabled?`<div class="scale-filter-bar" role="group" aria-label="Filtrar departamentos"><button type="button" class="scale-all-filter" data-scale-action="all" aria-pressed="${departments().every(active)}">Todos</button>${departments().map(d=>`<button type="button" class="scale-filter scale-tag" data-scale-action="department" data-department="${escape(d)}" data-scale-color="${escape(d)}" aria-pressed="${active(d)}">${icon(d)}<span>${escape(d)}</span><span class="scale-filter-state" aria-hidden="true">${active(d)?'✓':'—'}</span></button>`).join('')}</div>`:''}
   ${monthly.some(r=>r.kind==='monthly')?`<div class="scale-month-responsibles" role="group" aria-label="Responsáveis do mês">${monthly.filter(r=>r.kind==='monthly').map(r=>`<button type="button" class="scale-monthly" data-scale-action="period" data-start-date="${r.startDate>monthStart?r.startDate:monthStart}" data-scale-id="${escape(r.id)}" data-scale-kind="monthly" data-scale-color="${escape(r.department)}" data-from="${r.startDate>monthStart?r.startDate:monthStart}" data-to="${r.endDate<monthEnd?r.endDate:monthEnd}" aria-label="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}" title="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}">${icon(r.department)}<span class="scale-month-role">${escape(r.role)}:</span><span class="scale-person-name">${escape(personText(r))}</span></button>`).join('')}</div>`:''}
   <table class="scale-calendar"><caption class="sr-only">${escape(title)} — semanas de domingo a sábado, com faixas de anciãos da semana</caption><thead><tr>${['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'].map(d=>`<th scope="col"><abbr title="${d}">${d.slice(0,3)}</abbr></th>`).join('')}</tr></thead>${weeks}</table>
   ${!eventsEnabled?`<div class="scale-filters scale-person-filters"><label>Pessoa<select id="scale-person"><option value="all">Todas</option>${people.map(p=>`<option value="${escape(p)}" ${ui.person===p?'selected':''}>${escape(p)}</option>`).join('')}${rows.some(r=>!r.person&&r.role)?`<option value="__unassigned__" ${ui.person==='__unassigned__'?'selected':''}>A definir</option>`:''}</select></label><div class="scale-help-control"><button type="button" class="scale-help-button" aria-label="Ajuda sobre os filtros" aria-controls="scale-help-tip" aria-describedby="scale-help-tip" aria-expanded="false">?</button><span id="scale-help-tip" role="tooltip" hidden>Toque nos departamentos para mostrar ou ocultar. Selecione um dia ou faixa para ver os detalhes completos.${window.IASDPIScheduleUI?.isReview()?' Sonoplastia e Comunicação usam escalas manuais; Ancionato também mantém referências da Agenda. Só as escalas publicadas nesta aba aparecem no calendário; rascunhos não aparecem.':''}</span></div></div>`:''}
   <p class="scale-result" role="status" aria-live="polite">${pointCount} escalas pontuais e ${monthly.length-pointCount} períodos de anciãos${eventsEnabled?' · '+eventRows.filter(e=>e.date<=monthEnd&&e.end_date>=monthStart).length+' eventos':''} neste mês com os filtros aplicados.</p></section>
   <section class="panel" id="scale-selected" tabindex="-1" aria-labelledby="scale-selected-title"><h2 id="scale-selected-title">${eventsEnabled?'Agenda de':'Escalas de'} ${dateText(ui.day)}</h2>${list(selected,eventsEnabled?'Nenhuma escala ou evento corresponde aos filtros nesta data.':'Nenhuma escala corresponde aos filtros nesta data.')}</section>
   <div class="scale-overview"><section class="panel"><h2>Próximas escalas</h2><p class="muted">A partir de ${dateText(dayNow())}${window.IASDPIScheduleUI?.isReview()?'':', com os filtros aplicados; inclui períodos em andamento.'}</p>${list(filtered.filter(r=>(r.endDate||r.date)>=dayNow()).slice(0,6),'Não há próximas escalas informadas com estes filtros.')}</section>
   <section class="panel"><h2>Departamentos</h2><p>${escape(departments().filter(active).join(' · ')||'Nenhum selecionado')}</p><h2>Pessoas escaladas</h2><p>${escape([...new Set(monthly.map(r=>r.person).filter(Boolean))].sort(compareNames).join(' · ')||'Nenhuma na escala informada neste filtro')}</p><h2>Funções ainda sem responsável</h2>${list(missing,'Nenhuma função sem responsável foi informada nesta seleção.')}${window.IASDPIScheduleUI?.isReview()?'':'<p class="muted">Funções ausentes da fonte não são inferidas.</p>'}</section></div>`;
 }
 function mount(){
  window.IASDPIScheduleUI?.mount();
  const extras=departments().filter(d=>!Object.hasOwn(colors,d));
  document.querySelectorAll('[data-scale-color]').forEach(el=>{const d=el.dataset.scaleColor,[bg,fg]=colors[d]||[`hsl(${(extras.indexOf(d)*137.508+24)%360} 65% 91%)`,'#24313b'];el.style.backgroundColor=el.matches('.scale-filter[aria-pressed="false"],.calendar-quick-filter[aria-pressed="false"]')?'#fff':el.dataset.scaleKind==='weekly'?'#f2e1aa':bg;el.style.color=fg;el.style.borderColor=fg;});
  document.querySelectorAll('.scale-help-control').forEach(help=>{
   const button=help.querySelector('button'),tip=help.querySelector('[role=tooltip]');let pinned=false;
   const show=open=>{tip.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open&&help.classList.contains('schedule-help-control')){const rect=button.getBoundingClientRect(),bounds=tip.getBoundingClientRect(),width=bounds.width,height=bounds.height,above=rect.top-height-6;tip.style.left=Math.max(16,Math.min(rect.left,innerWidth-width-16))+'px';tip.style.top=Math.max(8,help.classList.contains('schedule-help-compact')&&above>=8?above:rect.bottom+height+12<innerHeight?rect.bottom+6:above)+'px';}};
   help.onmouseenter=()=>show(true);
   help.onmouseleave=()=>{if(!pinned&&!button.matches(':focus-visible'))show(false);};
   button.onfocus=()=>{if(button.matches(':focus-visible'))show(true);};
   button.onblur=()=>{pinned=false;show(false);};
   button.onclick=()=>{pinned=!pinned;show(pinned);};
   button.onkeydown=e=>{if(e.key==='Escape'){pinned=false;show(false);e.preventDefault();e.stopPropagation();}};
  });
 }
 function redraw(focus){if(state.page!=='schedule-calendar'&&!(window.IASDPIConfig?.calendarPrivacyEnabled&&state.page==='agendas'))return;render();mount();if(focus)document.getElementById(focus)?.focus({preventScroll:true});}
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-scale-action]');if(!b)return;e.preventDefault();
  try{const a=b.dataset.scaleAction;
   if(a==='previous')shift(-1);if(a==='next')shift(1);if(a==='today'){changeMonth(dayNow().slice(0,7));ui.day=dayNow();}
   if(a==='day'||a==='period')ui.day=a==='period'?b.dataset.startDate:b.dataset.date;
   if(a==='all')ui.departments=departments().every(active)?new Set():null;
   if(a==='department'){if(ui.departments===null)ui.departments=new Set(departments());const d=b.dataset.department;if(ui.departments.has(d))ui.departments.delete(d);else ui.departments.add(d);}
   redraw(a==='day'||a==='period'?'scale-selected':null);
   if(a==='day'||a==='period')document.getElementById('scale-selected')?.scrollIntoView({block:'nearest'});
   else [...document.querySelectorAll('[data-scale-action]')].find(el=>el.dataset.scaleAction===a&&(a!=='department'||el.dataset.department===b.dataset.department))?.focus({preventScroll:true});
  }catch(error){toast(error.message,true);}
 });
 document.addEventListener('change',e=>{if(!['scale-month','scale-person'].includes(e.target.id))return;try{if(e.target.id==='scale-month')changeMonth(e.target.value);else ui.person=e.target.value;redraw(e.target.id);}catch(error){toast(error.message,true);}});
 function show({month,department}){changeMonth(month);const allowed=department&&(!publicGuest()||department==='Ancionato')?department:null;ui.departments=allowed?new Set([allowed]):null;ui.person='all';if(unified()){clearRefinements();refine.mode=allowed?'scales':'home';refine.departments=allowed?new Set([allowed]):new Set();}}
 return {page,mount,legacy,data,periods,segments,monthDays,dayNow,show,matchesEvent};
})();

// E2: planejamento puro, sem persistência ou autorização implícita.
window.IASDPIEventPlanning=(()=>{
 const day=d=>d.toISOString().slice(0,10),date=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||'')||isNaN(new Date(s+'T12:00:00Z'))||day(new Date(s+'T12:00:00Z'))!==s)throw Error('Informe uma data válida.');return new Date(s+'T12:00:00Z');};
 function yearEnd(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(now)+'-12-31';}
 function occurrences(e,until=yearEnd()){
  const start=date(e.date),last=date(until),end=date(e.end_date||e.date),span=Math.round((end-start)/86400000),frequency=e.recurrence||'none',weekday=e.recurrence_weekday==null?start.getUTCDay():Number(e.recurrence_weekday),ordinal=Number(e.recurrence_ordinal||1),out=[];
  if(span<0||span>366||!['none','weekly','monthly'].includes(frequency))throw Error('Revise as datas e a recorrência.');
  if(frequency==='none')return [{...e,end_date:e.end_date||e.date}];
  if(start>last||end>last)throw Error('A data inicial/final ultrapassa o limite da recorrência: '+until.split('-').reverse().join('/')+'.');
  if(!Number.isInteger(weekday)||weekday<0||weekday>6||![-1,1,2,3,4].includes(ordinal)||last-start>7000*86400000)throw Error('Revise o dia e a posição da recorrência.');
  for(let d=new Date(start);d.getTime()+span*86400000<=last;d.setUTCDate(d.getUTCDate()+1)){
   const monthEnd=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(),nth=Math.floor((d.getUTCDate()-1)/7)+1;
   if(d.getUTCDay()===weekday&&(frequency==='weekly'||ordinal===-1&&d.getUTCDate()+7>monthEnd||ordinal===nth))out.push({...e,date:day(d),end_date:day(new Date(d.getTime()+span*86400000))});
  }
  if(!out.length||out.length>1000)throw Error('Nenhuma ocorrência válida ou série muito extensa. Revise as datas.');return out;
 }
 function interval(e){const a=e.all_day?recordEpoch('00:00',e.date):recordEpoch(e.start_time,e.date),end=e.end_date||e.date,b=e.all_day?recordEpoch('00:00',day(new Date(date(end).getTime()+86400000))):recordEpoch(e.end_time,end);if(a===null||b===null)return null;if(b<=a)throw Error('O término deve ocorrer após o início.');return [a,b];}
 function conflicts(e,others,spaces){
  const r=interval(e);if(!r)return [];const exclusive=new Set(spaces.filter(s=>s.exclusive).map(s=>s.code));
  return others.flatMap(other=>{
   const common=(e.spaces||[]).filter(code=>exclusive.has(code)&&(other.spaces||[]).includes(code));
   if(!common.length||other.id===e.id||other.date>(e.end_date||e.date)||(other.end_date||other.date)<e.date)return [];
   let b=null,timePending=false;try{b=interval(other);}catch(_){}if(!b){timePending=true;b=interval({...other,all_day:true});}
   return b&&r[0]<b[1]&&b[0]<r[1]?common.map(code=>({space_code:code,space_name:spaces.find(s=>s.code===code).name,date:e.date,event_title:other.title,time_pending:timePending,occupied:timePending?'Horário pendente de revisão':other.all_day?'Dia inteiro':other.start_time+' → '+other.end_time})):[];
  });
 }

 return {occurrences,yearEnd,interval,conflicts};
})();

// E1: publicação editorial separada dos eventos técnicos usados nas escalas.
// Máscaras restritas ao formulário de eventos; não alteram a Cronoanálise.
window.IASDPIEventInputs=(()=>{
 const previous=new WeakMap(),dateNames=new Set(['date','end_date']),timeNames=new Set(['start_time','end_time']);
 const kind=e=>e?.closest?.('#event-editor')?(dateNames.has(e.name)?'date':timeNames.has(e.name)?'time':null):null;
 function date(value){const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(iso)return iso[3]+'/'+iso[2]+'/'+iso[1];const d=String(value).replace(/\D/g,'').slice(0,8);return [d.slice(0,2),d.slice(2,4),d.slice(4)].filter(Boolean).join('/');}
 function time(value){const d=String(value).replace(/\D/g,'').slice(0,4);return [d.slice(0,2),d.slice(2)].filter(Boolean).join(':');}
 function valid(value,type){if(!value)return true;if(type==='time')return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);if(!m)return false;const iso=m[3]+'-'+m[2]+'-'+m[1],d=new Date(iso+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===iso;}
 document.addEventListener('beforeinput',e=>{if(kind(e.target))previous.set(e.target,{value:e.target.value,start:e.target.selectionStart});},true);
 document.addEventListener('input',e=>{const el=e.target,type=kind(el);if(!type)return;let raw=el.value,pos=el.selectionStart??raw.length,n=raw.slice(0,pos).replace(/\D/g,'').length;const old=previous.get(el);
  if(old&&e.inputType==='deleteContentBackward'&&raw.replace(/\D/g,'').length===old.value.replace(/\D/g,'').length&&old.start>0&&/[/ :]/.test(old.value[old.start-1])){const digits=raw.replace(/\D/g,'');raw=digits.slice(0,Math.max(0,n-1))+digits.slice(n);n=Math.max(0,n-1);}
  const formatted=type==='date'?date(raw):time(raw);el.value=formatted;let cursor=0,seen=0;while(cursor<formatted.length&&seen<n){if(/\d/.test(formatted[cursor]))seen++;cursor++;}el.setSelectionRange(cursor,cursor);el.setCustomValidity('');el.removeAttribute('aria-invalid');previous.delete(el);
 },true);
 document.addEventListener('blur',e=>{const type=kind(e.target);if(!type)return;const ok=valid(e.target.value,type);e.target.setCustomValidity(ok?'':type==='date'?'Informe uma data válida: DD/MM/AAAA.':'Informe um horário válido: HH:MM.');if(!ok)e.target.setAttribute('aria-invalid','true');else e.target.removeAttribute('aria-invalid');},true);
 return {date,time,valid};
})();
window.IASDPIEvents=(()=>{
 const enabled=()=>window.IASDPIConfig?.eventsEnabled===true,h=v=>esc(v),feeds=new Map();
 const s={phase:'idle',catalog:null,error:'',message:'',row:null,values:null,dirty:new Set(),request:crypto.randomUUID(),saving:false,history:null,sourceOpen:false,owner:'',generation:0};
 const sourceWarning=e=>/\d+\s*Anos da Escola Sabatina/i.test(e.title)&&sources().some(other=>other.date===e.date&&/\d+\s*Anos da Escola Sabatina/i.test(other.title)&&other.title!==e.title)?'Divergência na fonte: confirme o número do aniversário.':'';
 const church=()=>IASDPIChurches?.selected()||'IASD_PI',key=m=>church()+':'+m+(window.IASDPIConfig?.calendarPrivacyEnabled?':'+(IASDPIAuth.identityKey()||'public'):'');
 const redraw=()=>{if(enabled()&&['events','schedule-calendar',...(window.IASDPIConfig?.calendarPrivacyEnabled?['agendas']:[])].includes(state.page))render();};
 async function rpc(name,args={},publicCall=false){
  const identity=publicCall?null:await IASDPIAuth.requireIdentity();
  const value=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',...(identity?{Authorization:'Bearer '+identity.token}:{})},body:JSON.stringify(args)});
  if(identity&&!IASDPIAuth.identityCurrent(identity.token))throw Error('Sessão ou igreja alterada. Suas alterações não foram enviadas novamente.');return value;
 }
 async function refreshFeed(month){const k=key(month),f={phase:'loading',events:[],suppressed:[],error:''};feeds.set(k,f);
  try{const signed=!window.IASDPIConfig?.initialOperational&&window.IASDPIConfig?.calendarPrivacyEnabled&&IASDPIAuth.identityKey();const v=await rpc(signed?'iasdpi_events_visible':'iasdpi_events_published',{p_month:month+'-01'},!signed);
   if(!v||!Array.isArray(v.events)||!Array.isArray(v.suppressed_source_keys)||v.events.some(e=>!e||e.status!=='published'||!validDate(e.date)||!validDate(e.end_date)||typeof e.title!=='string'))throw Error('Resposta pública de eventos inválida.');
   if(feeds.get(k)!==f)return;Object.assign(f,{phase:'ready',events:v.events,suppressed:v.suppressed_source_keys});
  }catch(e){if(feeds.get(k)===f)Object.assign(f,{phase:'error',error:e.code==='PGRST202'?'Eventos gerenciados indisponíveis: a migração 020 ainda não foi instalada.':e.message});}
  finally{if(k===key(month))redraw();}
 }
 function validDate(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(new Date(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
 const same=(a,b)=>String(a.title||'').trim().normalize('NFC').toLocaleLowerCase('pt-BR')===String(b.title||'').trim().normalize('NFC').toLocaleLowerCase('pt-BR')&&a.date===b.date&&a.end_date===b.end_date&&String(a.start_time||'').slice(0,5)===String(b.start_time||'').slice(0,5)&&String(a.location||'').trim()===String(b.location||'').trim();
 function sources(includeStatic=false){if(window.IASDPIConfig?.calendarPrivacyEnabled&&!includeStatic||church()!=='IASD_PI')return [];const seen=new Set();return (agendaSource().events||[]).filter(e=>e.kind==='event'&&validDate(e.startDate)&&validDate(e.endDate)&&!seen.has(e.id)&&seen.add(e.id)).map(e=>{
   const timed=!(e.allDay||e.wholeDay),clock=value=>{try{if(!value||!/[T]/.test(value)||isNaN(new Date(value)))return null;return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value));}catch{return null;}};
   return {id:'official-event:'+e.id,source_key:e.id,source_url:'https://iasd-paradainglesa.netlify.app/',title:e.title,date:e.startDate,end_date:e.endDate,start_time:timed?clock(e.start):null,end_time:timed?clock(e.end):null,
    location:e.location||'',description:'',all_day:Boolean(e.allDay||e.wholeDay),category:e.department&&e.department!=='Não informado'?'department':null,department_name:e.department&&e.department!=='Não informado'?e.department:'',department_id:null,status:'published',origin:'Agenda oficial · cópia publicada',isEvent:true};
  });}
 function feed(month){const k=key(month);if(!feeds.has(k)){feeds.set(k,{phase:'loading',events:[],suppressed:[],error:''});queueMicrotask(()=>refreshFeed(month));}return feeds.get(k);}
 function allRows(month){if(!enabled())return [];const f=feed(month),suppressed=new Set(f.suppressed);return [...sources().filter(e=>!suppressed.has(e.source_key)),...f.events.map(e=>({...e,isEvent:true,origin:'Publicado no IASDPI'}))];}
 function rows(month){return allRows(month).filter(e=>IASDPIScheduleCalendar.matchesEvent(e));}
 const onDay=(e,day)=>e.date<=day&&e.end_date>=day;
 function category(e){return {general:'Programação Geral',departmental:'Programação Departamental',reserved:'Atividade Reservada'}[e.program_category]||'Classificação pendente de revisão';}
 function chip(e){return `<span class="event-chip event-${e.program_category||'pending'}" title="${h(category(e)+' · '+e.title)}"><span aria-hidden="true">◇</span> ${h(e.title)}<span class="sr-only"> · ${h(category(e))}</span></span>`;}
 function details(e){return `<article class="event-details"><h3>${h(e.title)}</h3><p>${h(category(e))}${e.department_name?' · '+h(e.department_name):''}</p><p>${h(displayDate(e.date))}${e.end_date!==e.date?' a '+h(displayDate(e.end_date)):''} · ${e.all_day?'Dia inteiro':e.start_time?h(displayPlannedTime(e.start_time))+(e.end_time?' → '+h(displayPlannedTime(e.end_time)):''):'Horário não informado'}</p>${e.responsible_name?`<p>Responsável: ${h(e.responsible_name)}</p>`:''}<p>Local: ${h((Array.isArray(e.space_names)?e.space_names.join(' · '):'')||e.location||'Não informado')}</p><p>${h(e.description||'Descrição não informada')}</p><small>${h(e.origin||'Publicado no IASDPI')}</small>${sourceWarning(e)?`<p class="form-note">${h(sourceWarning(e))}</p>`:''}${e.source_key?'<p class="muted">Dados da fonte preservados; divergências precisam de confirmação.</p>':''}</article>`;}

 function controls(month){if(!enabled())return '';const f=feed(month);return `${f.phase==='loading'?'<p role="status">Carregando eventos gerenciados…</p>':f.phase==='error'?`<p role="alert">${h(f.error)} <button type="button" data-events-feed-retry="${h(month)}">Tentar novamente</button></p>`:''}`;}
 function select(row=null){s.pendingPlan=null;s.seriesRequestId=null;s.seriesBaseline=null;s.row=row;s.values=row?{...row}:{id:crypto.randomUUID(),title:'',date:IASDPIScheduleCalendar.dayNow(),end_date:IASDPIScheduleCalendar.dayNow(),start_time:'',end_time:'',all_day:false,program_category:null,organizer_kind:null,audience:null,is_restricted:false,organizer_department_id:null,location:'',description:'',category:s.catalog?.is_admin?'church':'department',department_id:s.catalog?.is_admin?'':s.catalog?.departments.find(d=>d.can_edit)?.id||'',source_key:null,source_url:null};s.dirty=new Set(row?[]:['title','date','end_date','start_time','end_time','all_day','program_category','organizer_kind','audience','is_restricted','organizer_department_id','location','description','category','department_id','source_key','source_url'].filter(k=>window.IASDPIConfig?.calendarPrivacyEnabled||!['program_category','organizer_kind','audience','is_restricted','organizer_department_id'].includes(k)));if(planningEnabled()){const series=s.catalog.series?.find(x=>x.id===row?.series_id);s.seriesBaseline=series?structuredClone(series):null;Object.assign(s.values,{spaces:row?.spaces??[],recurrence:series?.definition.recurrence||'none',recurrence_weekday:series?.definition.recurrence_weekday??new Date(s.values.date+'T12:00:00Z').getUTCDay(),recurrence_ordinal:series?.definition.recurrence_ordinal||1,edit_scope:'occurrence'});if(!row){s.values.organizer_kind=null;s.dirty.add('spaces');}s.dirty.delete('audience');}s.history=null;s.request=crypto.randomUUID();s.error='';s.message='';}
 async function load(){const ticket=++s.generation;s.phase='loading';redraw();try{
  const identity=await IASDPIAuth.requireIdentity(),c=await rpc('iasdpi_events_catalog');
  if(ticket!==s.generation)return;if(!c||typeof c.is_admin!=='boolean'||!Array.isArray(c.events)||!Array.isArray(c.departments))throw Error('Resposta de eventos inválida.');
  if(s.owner&&s.owner!==identity.user.id){s.values=null;s.dirty.clear();s.row=null;}
  s.owner=identity.user.id;s.catalog=c;if(c.event_management_v2&&s.values?.series_id&&!s.dirty.size)s.seriesBaseline=structuredClone(c.series?.find(x=>x.id===s.values.series_id)||null);s.phase='ready';s.error='';
 }catch(e){if(ticket===s.generation){s.phase='error';s.error=e.code==='PGRST202'?'Gestão indisponível: revise a instalação da migração 020.':e.message;}}finally{if(ticket===s.generation)redraw();}}
 const statuses={draft:'Rascunho',published:'Publicado',cancelled:'Cancelado'};
 function canEdit(e=s.values){return s.catalog?.is_admin||e?.category==='church'&&e?.program_category==='general'&&s.catalog?.can_submit_general&&(!e.created_by||e.created_by===s.owner)||e?.category==='department'&&s.catalog?.departments.some(d=>d.id===e.department_id&&d.can_edit);}
 function canPublish(e=s.values){return s.catalog?.is_admin||e?.category==='church'&&e?.program_category==='general'&&s.catalog?.can_submit_general&&(!e.created_by||e.created_by===s.owner)||e?.category==='department'&&s.catalog?.departments.some(d=>d.id===e.department_id&&d.can_publish);}
 const dateUi=v=>validDate(v)?displayDate(v):v||'';
 const input=(label,name,value,attrs='')=>`<label>${h(label)}<input name="${name}" value="${h(value??'')}" ${attrs}></label>`;
 function eventSelect(label,name,value,options){return `<label>${h(label)}<select name="${name}"><option value="">Pendente de revisão</option>${options.map(([id,text])=>`<option value="${h(id)}" ${value===id?'selected':''}>${h(text)}</option>`).join('')}</select></label>`;}
 function planningEnabled(){return s.catalog?.event_management_v2===true;}
 function organizerValue(v){return v.organizer_kind==='department'&&v.organizer_department_id?'department:'+v.organizer_department_id:v.organizer_kind||'';}
 function searchableChoice(label,name,value,options){return `<div class="event-search-choice"><label>${h('Buscar '+label.toLocaleLowerCase('pt-BR'))}<input type="search" data-event-choice-search="${h(name)}" placeholder="Buscar por nome" autocomplete="off" aria-controls="choice-${h(name)}"></label><label>${h(label)}<select id="choice-${h(name)}" name="${h(name)}">${options.map(([id,text])=>`<option value="${h(id)}" ${String(value||'')===String(id)?'selected':''}>${h(text)}</option>`).join('')}</select></label></div>`;}
 function choiceOptions(name){if(name==='responsible_person_id')return [['','Não definido'],...(s.catalog.responsible_people||[]).filter(p=>p.active||p.id===s.values?.responsible_person_id).map(p=>[p.id,p.display_name||p.name])];return [['','Pendente de revisão'],...(s.catalog.organizer_options||[]).filter(o=>s.catalog.is_admin||s.catalog.can_submit_general&&o.value==='local_church'||o.value.startsWith('department:')||o.value===organizerValue(s.values)).map(o=>[o.value,o.label])];}
 function searchChoice(e){const name=e.target.dataset?.eventChoiceSearch;if(!name)return false;const select=e.target.form?.elements[name];if(!select)return true;const term=String(e.target.value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR'),selected=select.value;select.innerHTML=choiceOptions(name).filter(([id,text])=>!id||id===selected||text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').includes(term)).map(([id,text])=>`<option value="${h(id)}" ${id===selected?'selected':''}>${h(text)}</option>`).join('');return true;}
 function planningEditor(){
  const v=s.values,series=s.seriesBaseline||s.catalog.series?.find(x=>x.id===v.series_id),recurrence=(s.dirty.has('recurrence')?v.recurrence:series?.definition.recurrence)||v.recurrence||'none',week=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const select=(label,name,value,options,extra='')=>`<label>${h(label)}<select name="${name}" ${extra}>${options.map(([id,text])=>`<option value="${h(id)}" ${String(value)===String(id)?'selected':''}>${h(text)}</option>`).join('')}</select></label>`;
  const conflictList=plan=>`<ul class="event-conflicts">${(plan.occurrences||[{reservation_conflicts:plan.conflicts||[]}]).flatMap(e=>(e.reservation_conflicts||[]).map(c=>`<li><strong>${h(c.space_name)} · ${h(displayDate(c.date||e.date))}</strong><span>${h(c.event_title)} · ${h(c.time_pending?'Horário pendente de revisão':c.period_label||c.occupied||'Dia inteiro')}</span></li>`)).join('')}</ul>`;
  return `<form id="event-editor" class="panel event-editor-v2" novalidate aria-busy="${s.saving}"><fieldset class="event-form-fields" ${s.saving?'disabled':''}><legend class="sr-only">Dados do evento</legend><div class="event-editor-heading"><h2>${s.row?'Editar evento':'Novo evento'}</h2><span class="badge neutral">${h(s.catalog?.event_approval_required&&v.approval_status==='pending'?'Aguardando aprovação':statuses[v.status]||'Rascunho')}</span></div>
  ${series?select('Aplicar alterações','edit_scope',v.edit_scope||'occurrence',[['occurrence','Somente esta ocorrência'],['following','Esta e as próximas ocorrências'],['all','Toda a série']]):''}
  <section class="event-form-section"><h3>Informações do evento</h3><div class="event-fields">${input('Título do evento','title',v.title,'required maxlength="160"')}${input('Data inicial','date',dateUi(v.date),'placeholder="DD/MM/AAAA" inputmode="numeric" maxlength="10" required')}${input('Data final — opcional','end_date',dateUi(v.end_date),'placeholder="DD/MM/AAAA" inputmode="numeric" maxlength="10"')}</div><div class="event-time-fields">${input('Horário inicial','start_time',v.start_time?displayPlannedTime(v.start_time):'','placeholder="HH:MM" inputmode="numeric" maxlength="5" '+(v.all_day?'disabled':''))}${input('Horário final','end_time',v.end_time?displayPlannedTime(v.end_time):'','placeholder="HH:MM" inputmode="numeric" maxlength="5" '+(v.all_day?'disabled':''))}<label class="checkbox"><input type="checkbox" name="all_day" ${v.all_day?'checked':''}> Dia inteiro</label></div>
  <div class="event-fields">${select('Recorrência','recurrence',recurrence,(series?[['weekly','Semanalmente'],['monthly','Mensalmente']]:[['none','Não repetir'],['weekly','Semanalmente'],['monthly','Mensalmente']]),s.row&&(!series||v.edit_scope==='occurrence')?'disabled':'')}${recurrence==='monthly'?select('Posição no mês','recurrence_ordinal',(s.dirty.has('recurrence_ordinal')?v.recurrence_ordinal:series?.definition.recurrence_ordinal)||v.recurrence_ordinal||1,[[1,'1ª'],[2,'2ª'],[3,'3ª'],[4,'4ª'],[-1,'Última']],s.row&&v.edit_scope==='occurrence'?'disabled':''):''}${recurrence!=='none'?select('Dia da semana','recurrence_weekday',(s.dirty.has('recurrence_weekday')?v.recurrence_weekday:series?.definition.recurrence_weekday)??v.recurrence_weekday??new Date(v.date+'T12:00:00Z').getUTCDay(),week.map((text,id)=>[id,text]),s.row&&v.edit_scope==='occurrence'?'disabled':''):''}</div>${recurrence!=='none'?`<p class="muted">Esta recorrência será programada até ${h(displayDate(series?.until_date||IASDPIEventPlanning.yearEnd()))}.</p>`:''}
  <label>Descrição — opcional<textarea name="description" maxlength="5000">${h(v.description||'')}</textarea></label></section>
  <section class="event-form-section"><h3>Organização</h3><div class="event-fields">${s.catalog.responsible_people_enabled?searchableChoice('Responsável','responsible_person_id',v.responsible_person_id,choiceOptions('responsible_person_id')):''}${searchableChoice('Organização','event_organizer',organizerValue(v),choiceOptions('event_organizer'))}</div></section>
  <section class="event-form-section"><h3>Locais e reservas</h3><details class="event-space-picker"><summary>${v.spaces?.length?h(s.catalog.spaces.filter(x=>v.spaces.includes(x.code)).map(x=>x.name).join(' · ')):'Selecionar locais'}</summary><fieldset><legend class="sr-only">Locais utilizados</legend>${s.catalog.spaces.map(space=>`<label class="checkbox"><input type="checkbox" data-event-space value="${h(space.code)}" ${v.spaces?.includes(space.code)?'checked':''}>${h(space.name)}${space.exclusive?'<small>Reserva exclusiva</small>':''}</label>`).join('')}</fieldset></details>${s.row?.spaces==null&&s.row?.location?`<p class="muted">Local anterior preservado: ${h(s.row.location)}. Confirme os locais para validar reservas.</p>`:''}</section>
  <section class="event-form-section"><h3>Participação e visibilidade</h3>${select('Público-alvo','program_category',v.program_category,[['','Pendente de revisão'],['general','Programação Geral'],['departmental','Programação Departamental'],['reserved','Atividade Reservada']])}<label class="checkbox"><input type="checkbox" name="is_restricted" ${v.is_restricted?'checked':''}> Restrito — não mostrar no calendário público</label></section>
  ${s.pendingPlan?`<section class="event-conflict-panel" role="alert"><h3>Conflitos de reserva</h3><p>Resolva os conflitos de reserva antes de publicar. Você pode salvar um rascunho.</p>${conflictList(s.pendingPlan)}<button type="button" data-event-confirm>Salvar como rascunho</button></section>`:''}
  <p id="event-save-state" role="status">${s.saving?'Aguardando confirmação…':h(s.message||(s.dirty.size?'Alterações pendentes.':'Sem alterações pendentes.'))}</p><div class="actions">${canEdit()?'<button type="submit" value="draft">Salvar rascunho</button>':''}${canPublish()?`<button type="submit" class="primary" value="published">${s.catalog?.event_approval_required&&v.program_category==='general'&&!s.catalog?.can_approve_general?'Enviar para aprovação':'Publicar'}</button>`:''}${s.row&&(s.catalog?.is_admin||s.row.category!=='church'&&canEdit()||s.row.created_by===s.owner)?'<button type="button" data-event-history>Histórico</button>':''}${s.row&&canPublish()?'<button type="button" data-event-cancel>Cancelar evento</button>':''}<button type="button" data-event-close>Fechar</button></div>
  ${s.row&&(s.row.audience||s.row.category||s.row.location)?`<details class="event-legacy"><summary>Informações anteriores preservadas</summary><p>Gestão: ${h(({church:'Igreja',department:'Departamento'})[s.row.category]||'Não informada')} · Público-alvo anterior: ${h(({whole_church:'Toda a igreja',specific:'Público específico',restricted:'Restrito/Convidados'})[s.row.audience]||'Não informado')} · Local: ${h(s.row.location||'Não informado')}</p><p>Esses dados permanecem no histórico; não são reclassificados automaticamente.</p></details>`:''}${s.history?`<ol class="event-history">${s.history.map(v=>`<li>Versão ${v.version} · ${h(statuses[v.status])} · ${h(displayRecordTimestamp(v.captured_at))} · autor ${h(v.actor_id||'Não informado')}</li>`).join('')}</ol>`:''}</fieldset></form>`;
 }
 function planningChange(e){
  const f=e.target,v=s.values;
  if(f.hasAttribute('data-event-space')){const codes=new Set(v.spaces||[]);if(f.checked)codes.add(f.value);else codes.delete(f.value);v.spaces=[...codes];s.dirty.add('spaces');s.pendingPlan=null;s.request=crypto.randomUUID();redraw();return true;}
  if(f.name==='event_organizer'){
   if(f.value!==organizerValue(v)){const isDepartment=f.value.startsWith('department:');v.organizer_kind=isDepartment?'department':f.value||null;v.organizer_department_id=isDepartment?f.value.slice(11):null;v.category=isDepartment?'department':'church';v.department_id=isDepartment?v.organizer_department_id:null;for(const name of ['organizer_kind','organizer_department_id','category','department_id'])s.dirty.add(name);}
   s.request=crypto.randomUUID();s.pendingPlan=null;redraw();return true;
  }
  if(['recurrence','recurrence_weekday','recurrence_ordinal','edit_scope','program_category'].includes(f.name)){v[f.name]=f.value;s.dirty.add(f.name);s.pendingPlan=null;s.request=crypto.randomUUID();redraw();return true;}
  return false;
 }
 async function planningSave(status,accept=false){
  const v=s.values,series=s.seriesBaseline||s.catalog.series?.find(x=>x.id===v.series_id),scope=v.edit_scope||'occurrence',isSeries=Boolean(series&&scope!=='occurrence'||!s.row&&v.recurrence&&v.recurrence!=='none'),patch={};
  if(s.saving)return;
  for(const name of s.dirty)if(!['recurrence','recurrence_weekday','recurrence_ordinal','edit_scope','event_organizer'].includes(name))patch[name]=v[name];
  if(patch.date!==undefined)patch.date=readDate(patch.date);if(patch.end_date!==undefined)patch.end_date=patch.end_date?readDate(patch.end_date):(patch.date||s.row?.date);
  for(const name of ['start_time','end_time'])if(name in patch){if(patch[name]&&!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(patch[name]))throw Error('Informe horário de 24 horas no formato HH:mm.');patch[name]=patch[name]||null;}
  for(const name of ['department_id','organizer_department_id','responsible_person_id','program_category','organizer_kind'])if(name in patch)patch[name]=patch[name]||null;
  patch.status=status;
  const data={...v,...patch,date:patch.date||v.date,end_date:patch.end_date||v.end_date||v.date};
  if(String(v.title||'').trim().length<2)throw Error('Informe um título de pelo menos dois caracteres.');
  if(!s.row&&(!v.organizer_kind||!v.program_category))throw Error('Confirme Responsável / Organizador e Público-alvo.');
  if(isSeries){delete patch.source_key;delete patch.source_url;for(const name of ['recurrence','recurrence_weekday','recurrence_ordinal'])if(s.dirty.has(name))patch[name]=name==='recurrence'?v[name]:Number(v[name]);if(!series)Object.assign(patch,{recurrence:v.recurrence,recurrence_weekday:Number(v.recurrence_weekday),recurrence_ordinal:Number(v.recurrence_ordinal)});IASDPIEventPlanning.occurrences(series?{...series.definition,...patch}:data,series?.until_date);}
  s.saving=true;s.error='';redraw();try{
   if(!accept&&status!=='cancelled'){
    const previewData=isSeries&&series?{...series.definition,...patch,recurrence_until:series.until_date,...(scope==='following'?{preview_from:v.occurrence_on}:{})}:isSeries?data:{...data,recurrence:'none'};
    const exclude=isSeries&&series?s.catalog.events.filter(e=>e.series_id===series.id&&(scope==='all'||e.occurrence_on>=v.occurrence_on)).map(e=>e.id):s.row?[v.id]:[];
    const plan=await rpc('iasdpi_event_preview',{p_data:previewData,p_exclude:exclude});
    if(plan.conflict_count&&status==='published'){s.pendingPlan=plan;s.intent='draft';return;}
   }
   let result;
   if(isSeries){s.seriesRequestId=s.seriesRequestId||crypto.randomUUID();result=await rpc('iasdpi_event_series_save',{p_id:series?.id||s.seriesRequestId,p_expected_version:series?.version||0,p_patch:patch,p_request_id:s.request,p_scope:scope==='occurrence'?'all':scope,p_occurrence:series?v.id:null,p_accept_conflicts:accept});}
   else result=await rpc('iasdpi_event_submit',{p_id:v.id,p_expected_version:s.row?.version||0,p_patch:patch,p_request_id:s.request,p_accept_conflicts:accept});
   if(result.requires_confirmation){s.pendingPlan=result;s.intent='draft';return;}
   s.pendingPlan=null;const saved=result.event||result.events?.find(e=>e.occurrence_on===v.occurrence_on)||result.events?.[0];
   if(!saved||typeof saved.id!=='string'||!Number.isInteger(saved.version)||saved.version<1
    ||(!isSeries&&(saved.id!==v.id||saved.version!==(s.row?.version||0)+1))
    ||(isSeries&&(!result.series||result.series.version!==(series?.version||0)+1))
    ||(saved.status!==status&&!(s.catalog?.event_approval_required&&saved.status==='draft'&&saved.approval_status==='pending')))
    throw Error('Confirmação de evento inválida. Consulte a versão no banco antes de repetir.');
   select(saved);s.message=s.catalog?.event_approval_required&&saved?.approval_status==='pending'?'Enviado para aprovação.':saved?.status==='published'?'Publicação confirmada.':saved?.status==='cancelled'?'Cancelamento confirmado; histórico preservado.':'Rascunho salvo. Confirmação recebida.';
   feeds.clear();await load();
  }catch(e){s.error=e.message;s.message='Alterações mantidas nesta tela. Nenhuma nova gravação foi confirmada.';}finally{s.saving=false;redraw();}
 }

 function editor(){if(planningEnabled()&&s.values)return planningEditor();const modern=window.IASDPIConfig?.calendarPrivacyEnabled===true;const v=s.values;if(!v)return '';return `<form id="event-editor" class="panel" novalidate aria-busy="${s.saving}"><fieldset class="event-form-fields" ${s.saving?'disabled':''}><legend class="sr-only">Dados do evento</legend><h2>${s.row?'Editar evento':'Novo evento'}</h2><div class="form-grid">${input('Título','title',v.title,'maxlength="160" required')}${input('Data — dd/mm/aaaa','date',dateUi(v.date),'placeholder="DD/MM/AAAA" inputmode="numeric" maxlength="10" required')}${input('Data final — opcional','end_date',dateUi(v.end_date),'placeholder="DD/MM/AAAA" inputmode="numeric" maxlength="10"')}${input('Horário inicial — opcional, HH:mm','start_time',v.start_time?displayPlannedTime(v.start_time):'','inputmode="text" maxlength="5" placeholder="HH:mm"')}${input('Horário final — opcional, HH:mm','end_time',v.end_time?displayPlannedTime(v.end_time):'','inputmode="text" maxlength="5" placeholder="HH:mm"')}<label>Gestão do evento<select name="category"><option value="">Pendente de confirmação</option>${s.catalog.is_admin?`<option value="church" ${v.category==='church'?'selected':''}>Evento da Igreja</option>`:''}<option value="department" ${v.category==='department'?'selected':''}>Evento de Departamento</option></select></label><label>Departamento responsável<select name="department_id" ${v.category!=='department'?'disabled':''}><option value="">Pendente de confirmação</option>${s.catalog.departments.map(d=>`<option value="${h(d.id)}" ${v.department_id===d.id?'selected':''}>${h(d.name)}</option>`).join('')}</select></label>${input('Local — opcional','location',v.location,'maxlength="500"')}</div>${modern?`<div class="form-grid">${eventSelect('Classificação','program_category',v.program_category,[['general','Programação Geral'],['departmental','Programação Departamental'],['reserved','Atividade Reservada']])}${eventSelect('Organizador','organizer_kind',v.organizer_kind,[['local_church','Igreja Local'],['association','Associação'],['school','Escola Adventista'],['department','Departamento'],['other','Outro']])}${eventSelect('Público-alvo','audience',v.audience,[['whole_church','Toda a igreja'],['specific','Público específico'],['restricted','Restrito/Convidados']])}${v.organizer_kind==='department'?eventSelect('Departamento organizador','organizer_department_id',v.organizer_department_id,s.catalog.departments.map(d=>[d.id,d.name])):''}</div><label class="checkbox"><input type="checkbox" name="is_restricted" ${v.is_restricted?'checked':''}> Restrito — não mostrar no calendário público</label><p class="form-note">Classificação e organizador não alteram permissões. “Restrito” controla a visibilidade pública, independentemente da classificação e do público-alvo.</p>`:''}<label class="checkbox"><input type="checkbox" name="all_day" ${v.all_day?'checked':''}> Dia inteiro</label><label>Descrição — opcional<textarea name="description" maxlength="5000">${h(v.description||'')}</textarea></label><p id="event-save-state" role="status">${s.saving?'Aguardando confirmação…':s.message||(s.dirty.size?'Alterações pendentes.':'Sem alterações pendentes.')}</p><div class="actions">${canEdit()?'<button type="submit" value="draft" '+(s.saving?'disabled':'')+'>Salvar rascunho</button>':''}${canPublish()?'<button type="submit" class="primary" value="published" '+(s.saving?'disabled':'')+'>Publicar</button>':''}${s.row?'<button type="button" data-event-history>Histórico</button>':''}${s.row&&canPublish()?'<button type="button" data-event-cancel '+(s.saving?'disabled':'')+'>Cancelar evento</button>':''}<button type="button" data-event-close ${s.saving?'disabled':''}>Fechar</button></div>${s.history?`<ol class="event-history">${s.history.map(v=>`<li>Versão ${v.version} · ${h(statuses[v.status])} · ${h(displayRecordTimestamp(v.captured_at))} · autor ${h(v.actor_id)}${v.snapshot?details({...v.snapshot,origin:'Histórico · '+statuses[v.status]}):''}</li>`).join('')}</ol>`:''}</fieldset></form>`;}
 function sourcePreview(){const c=s.catalog;if(!c)return '';const list=sources().filter(e=>e.date.startsWith(agendaState.month));return `<details class="panel" id="events-source-preview" ${s.sourceOpen?'open':''}><summary>Conferir eventos da Agenda antes de cadastrar</summary><label>Mês de referência<input type="month" id="events-source-month" value="${h(agendaState.month)}"></label><p class="muted">Importação cria rascunho para revisão. Datas e IDs da Agenda são preservados. Categoria, local e horários desconhecidos ficam pendentes.</p><ul class="event-source-list">${list.map(e=>{const linked=c.events.find(x=>x.source_key===e.source_key),candidates=c.events.filter(x=>same(x,e));return `<li><strong>${h(displayDate(e.date)+' · '+e.title)}</strong><span>${h(e.department_name||'Departamento não informado')}</span>${sourceWarning(e)?`<span class="form-note">${h(sourceWarning(e))}</span>`:''}${linked?`<button type="button" data-event-open="${h(linked.id)}">Abrir registro existente</button>`:candidates.length?`<span>Possível correspondência: revisar o registro existente.</span>${candidates.map(x=>`<button type="button" data-event-open="${h(x.id)}">${h(x.title)} · versão ${x.version}</button>${c.is_admin&&!x.source_key?`<button type="button" data-event-associate="${h(x.id)}" data-source-key="${h(e.source_key)}">Associar fonte a este registro</button>`:''}`).join('')}`:c.is_admin?`<button type="button" data-event-import="${h(e.source_key)}">Revisar cadastro</button>`:'<span>Associação da fonte requer administrador.</span>'}</li>`;}).join('')||'<li>Nenhum evento da fonte neste mês.</li>'}</ul></details>`;}
 function page(){if(!enabled())return '<section class="panel"><h1>Gestão de Eventos</h1><p>Ativação pendente neste ambiente.</p></section>';if(s.phase==='idle'){queueMicrotask(load);return '<p role="status">Carregando eventos…</p>';}
  return heading('IASDPI','Gestão de Eventos','Eventos da igreja e dos departamentos.',(s.catalog?.is_admin||s.catalog?.can_submit_general||s.catalog?.departments.some(d=>d.can_edit)?'<button type="button" class="primary" data-event-new>Novo evento</button>':'')+'<button type="button" data-events-retry>Atualizar lista</button>')+
   `${s.error?`<p role="alert">${h(s.error)} <button type="button" data-events-retry>Tentar novamente</button></p>`:''}${s.phase==='loading'?'<p role="status">Carregando eventos…</p>':''}${s.message?`<p role="status">${h(s.message)}</p>`:''}${editor()}${s.catalog?`<section class="panel"><h2>Eventos cadastrados</h2>${s.catalog.events.length?`<ul class="event-manager-list">${s.catalog.events.map(e=>`<li><strong>${h(displayDate(e.date)+' · '+e.title)}</strong><span>${h(s.catalog?.event_approval_required&&e.approval_status==='pending'?'Aguardando aprovação':statuses[e.status])} · v${e.version}</span>${s.catalog?.can_approve_general&&e.approval_status==='pending'&&e.program_category==='general'?`<button type="button" class="primary" data-event-approve="${h(e.id)}" data-version="${e.version}">Aprovar e publicar</button>${window.IASDPIConfig?.governanceAdministrationEnabled?`<button type="button" data-event-reject="${h(e.id)}" data-version="${e.version}">Rejeitar</button>`:''}`:''}<button type="button" data-event-open="${h(e.id)}">Abrir</button></li>`).join('')}</ul>`:'<p>Nenhum evento cadastrado.</p>'}</section>${sourcePreview()}`:''}`;
 }
 async function save(status){if(planningEnabled())return planningSave(status);if(s.saving)return;const v=s.values,patch={};for(const name of s.dirty)patch[name]=v[name];
  if(patch.date!==undefined)patch.date=readDate(patch.date);if(patch.end_date!==undefined)patch.end_date=patch.end_date?readDate(patch.end_date):(patch.date||s.row?.date);
  for(const name of ['start_time','end_time'])if(Object.hasOwn(patch,name)){if(patch[name]&&!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(patch[name]))throw Error('Informe horário de 24 horas no formato HH:mm.');patch[name]=patch[name]||null;}
  for(const name of ['department_id','category','program_category','organizer_kind','audience','organizer_department_id'])if(Object.hasOwn(patch,name))patch[name]=patch[name]||null;
  patch.status=status;if(status==='published'&&v.end_time&&!v.start_time)throw Error('Horário inicial pendente. Confirme antes de publicar.');if(status==='published'&&(!v.category||v.category==='department'&&!v.department_id))throw Error('Confirme a categoria e o departamento antes de publicar.');
  if(String(v.title||'').trim().length<2)throw Error('Informe um título de pelo menos dois caracteres.');
  s.saving=true;s.error='';redraw();try{const saved=await rpc('iasdpi_event_save',{p_id:v.id,p_expected_version:s.row?.version||0,p_patch:patch,p_request_id:s.request});if(saved?.id!==v.id||saved.version!==(s.row?.version||0)+1||saved.status!==status)throw Error('Confirmação de evento inválida. Consulte a versão no banco antes de repetir.');select(saved);s.message=status==='published'?'Publicação confirmada.':status==='cancelled'?'Cancelamento confirmado; histórico preservado.':'Rascunho salvo. Confirmação recebida.';feeds.clear();await load();}
  catch(e){s.error=e.message;s.message='Alterações mantidas nesta tela. Nenhuma nova gravação foi confirmada.';}
  finally{s.saving=false;redraw();}
 }
 function canLeave(){if(state.page!=='events'||!s.dirty.size)return true;if(s.saving){toast('Aguarde a confirmação da gravação.',true);return false;}if(!confirm('Descartar alterações não salvas deste evento?'))return false;s.dirty.clear();s.values=null;return true;}
 function failure(e){s.error=e.message;redraw();}
 document.addEventListener('toggle',e=>{if(e.target.id==='events-source-preview')s.sourceOpen=e.target.open;},true);
 document.addEventListener('input',e=>{if(e.target.closest('#event-editor')&&searchChoice(e))return;if(e.target.closest('#event-editor')&&e.target.name){if(e.target.name==='date'&&s.values.end_date===s.values.date){s.values.end_date=e.target.value;s.dirty.add('end_date');e.target.form.elements.end_date.value=e.target.value;}s.values[e.target.name]=e.target.type==='checkbox'?e.target.checked:e.target.value;s.dirty.add(e.target.name);s.pendingPlan=null;document.querySelector('.event-conflict-panel')?.remove();s.request=crypto.randomUUID();const hint=document.getElementById('event-save-state');if(hint)hint.textContent='Alterações pendentes.';}});
 document.addEventListener('change',e=>{if(e.target.closest('#event-editor')&&e.target.dataset?.eventChoiceSearch)return;if(e.target.closest('#event-editor')){if(planningEnabled()&&planningChange(e))return;s.values[e.target.name]=e.target.type==='checkbox'?e.target.checked:e.target.value;s.dirty.add(e.target.name);s.request=crypto.randomUUID();if(e.target.name==='all_day'&&e.target.checked){if((s.values.start_time||s.values.end_time)&&!confirm('Remover os horários desta edição e marcar dia inteiro? A alteração depende de salvar.')){s.values.all_day=false;e.target.checked=false;return;}s.values.start_time='';s.values.end_time='';s.dirty.add('start_time');s.dirty.add('end_time');redraw();}if(e.target.name==='all_day'&&!e.target.checked)redraw();if(e.target.name==='organizer_kind'){s.values.organizer_department_id=null;s.dirty.add('organizer_department_id');redraw();}if(e.target.name==='category'){s.values.department_id='';s.dirty.add('department_id');redraw();}}if(e.target.id==='events-source-month'){agendaState.month=e.target.value;redraw();}});
 document.addEventListener('submit',e=>{if(e.target.id!=='event-editor')return;e.preventDefault();e.stopImmediatePropagation();void save(e.submitter?.value||'draft').catch(failure);},true);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-event-reject],[data-event-approve],[data-event-confirm],[data-events-feed-retry],[data-events-retry],[data-event-new],[data-event-open],[data-event-import],[data-event-close],[data-event-cancel],[data-event-history],[data-event-associate]');if(!b||!enabled())return;e.preventDefault();
  if(b.dataset.eventReject){const reason=prompt('Motivo da rejeição (mínimo 10 caracteres):');if(reason===null)return;if(reason.trim().length<10){failure(Error('Informe um motivo de pelo menos 10 caracteres.'));return;}void rpc('iasdpi_event_reject',{p_id:b.dataset.eventReject,p_expected_version:Number(b.dataset.version),p_reason:reason,p_request_id:crypto.randomUUID()}).then(async()=>{feeds.clear();s.message='Evento rejeitado; rascunho e histórico preservados.';await load();}).catch(failure);return;}
  if(b.dataset.eventApprove){if(!confirm('Aprovar e publicar este evento geral após validar as reservas?'))return;void rpc('iasdpi_event_approve',{p_id:b.dataset.eventApprove,p_expected_version:Number(b.dataset.version),p_request_id:crypto.randomUUID()}).then(async()=>{feeds.clear();s.message='Evento aprovado e publicado.';await load();}).catch(failure);return;}  if(b.hasAttribute('data-event-confirm')){void planningSave(s.intent||'published',true).catch(failure);return;}if(b.dataset.eventsFeedRetry){void refreshFeed(b.dataset.eventsFeedRetry);if(window.IASDPIPortalAccess?.enabled())void IASDPIPortalAccess.refreshFeed(b.dataset.eventsFeedRetry);return;}if(b.hasAttribute('data-events-retry')){void load();return;}
  if(b.hasAttribute('data-event-history')){void rpc('iasdpi_event_history',{p_id:s.row.id}).then(v=>{s.history=v;redraw();}).catch(failure);return;}
  if(b.hasAttribute('data-event-cancel')){if(!confirm(planningEnabled()&&s.values?.series_id?(s.values.edit_scope==='all'?'Cancelar toda a série? O histórico será preservado.':s.values.edit_scope==='following'?'Cancelar esta e as próximas ocorrências? O histórico será preservado.':'Cancelar somente esta ocorrência? O restante da série será preservado.'):'Cancelar este evento? O histórico será preservado.'))return;s.values.cancellation_reason=prompt('Motivo do cancelamento (opcional):')||'';s.dirty.add('cancellation_reason');void save('cancelled').catch(failure);return;}
  if(!canLeave())return;
  if(b.dataset.eventAssociate){const source=sources().find(x=>x.source_key===b.dataset.sourceKey),row=s.catalog.events.find(x=>x.id===b.dataset.eventAssociate);if(!source||!row||!s.catalog.is_admin)return;select(row);s.values.source_key=source.source_key;s.values.source_url=source.source_url;s.dirty.add('source_key');s.dirty.add('source_url');}
  if(b.hasAttribute('data-event-new'))select();if(b.dataset.eventOpen)select(s.catalog.events.find(x=>x.id===b.dataset.eventOpen));
  if(b.dataset.eventImport){const source=sources().find(x=>x.source_key===b.dataset.eventImport);if(!source)return;const existing=s.catalog.events.find(x=>x.source_key===source.source_key||same(x,source));if(existing)select(existing);else{select();Object.assign(s.values,source,{id:crypto.randomUUID(),department_id:s.catalog.departments.find(d=>d.name===source.department_name)?.id||''});s.values.status='draft';}}
  if(b.hasAttribute('data-event-close')){s.values=null;s.row=null;s.dirty.clear();}redraw();
 });
 for(const name of ['iasdpi-identity-ended','iasdpi-church-changed'])window.addEventListener(name,()=>{s.generation++;s.phase='idle';s.catalog=null;s.values=null;s.row=null;s.dirty.clear();s.owner='';feeds.clear();});
 for(const name of ['iasdpi-auth-changed','iasdpi-role-changed'])window.addEventListener(name,()=>{feeds.clear();if(['schedule-calendar','agendas'].includes(state.page))queueMicrotask(redraw);});
 window.addEventListener('beforeunload',e=>{if(state.page==='events'&&s.dirty.size){e.preventDefault();e.returnValue='';}});
 return {enabled,page,rows,controls,allRows,onDay,chip,details,categoryText:category,sources,same,validDate,refreshFeed,load,canLeave};
})();

;
'use strict';
const archiveKey=IASDPIStorage.programs;
const cloudState={session:null,archives:[],loaded:false,loading:false,error:'',busy:false,dirty:false};
function backupValidate(data){
  if(!data || data.format!=='IASDPI-backup'||data.version!==1||!Array.isArray(data.programs))throw Error('Arquivo de backup incompatível. Nada foi alterado.');
  const ids=new Set();
  for(const p of data.programs){
    if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||!p.plan||typeof p.plan.name!=='string'||!Array.isArray(p.plan.items)||!p.executions||typeof p.executions!=='object'||!Number.isInteger(p.version)||p.version<1)throw Error('Registro inválido no backup. Nada foi alterado.');
    ids.add(p.id);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.plan.date)||p.plan.items.some(i=>!i||typeof i.id!=='string'||typeof i.activity!=='string'))throw Error('Cronograma inválido no backup. Nada foi alterado.');
    const day=recordDay(p.plan.date),clock={test:validRecordClock};
    const validTime=value=>typeof value==='string'&&inspectRecordTime(value,day).valid;
    const emptyFree=p.execution_mode==='manual'&&p.plan.template_id==='free'&&!p.plan.items.length&&p.plan.start===''&&p.plan.end===''&&p.planned_start===null&&p.planned_end===null;
    if(!day||(!emptyFree&&(!clock.test(p.plan.start)||!clock.test(p.plan.end)||!validTime(p.planned_start)||!validTime(p.planned_end)))||!['Planejamento','Pronta','Em andamento','Finalizada'].includes(p.status))throw Error('Datas, horários ou status inválidos no backup.');
    const itemIds=new Set();
    for(const item of p.plan.items){if(itemIds.has(item.id)||!clock.test(item.start)||!clock.test(item.end)||typeof item.block!=='string'||!validTime(item.planned_start)||!validTime(item.planned_end))throw Error('Atividade inválida no backup.');itemIds.add(item.id);}
    if(Array.isArray(p.executions))throw Error('Execução inválida no backup.');
    for(const [id,e] of Object.entries(p.executions)){if(!itemIds.has(id)||!e||(e.started!=null&&e.started!==''&&!validTime(e.started))||(e.ended!=null&&e.ended!==''&&!validTime(e.ended)))throw Error('Horários realizados inválidos no backup.');}
    for(const item of p.plan.items){const detail=p.actual_details?.[item.id];if(detail&&(detail.status!==undefined||detail.subactivities!==undefined||detail.partial_end!==undefined)){const e=p.executions[item.id];validateActivityRecord({...detail,start:storedActualClock(e?.started),end:storedActualClock(e?.ended)||detail.partial_end||''},item.id);}}
    if(p.extra_events)validateExtraEvents(p,p.extra_events,false);
  }
  return data;
}
async function backupPayload(){
  await IASDPIAuth.requireAccess();
  const raw=window.IASDPIDemo?localStorage.getItem(archiveKey):null;
  const programs=window.IASDPIDemo?(raw===null?[]:JSON.parse(raw)):await api('programs');
  return backupValidate({format:'IASDPI-backup',version:1,programs,
    dateCorrectionBackupsRaw:window.IASDPIDemo?localStorage.getItem(IASDPIStorage.dateCorrections):null});
}
// O schema operacional exige previstos HH:mm e execuções com data. A adaptação
// só ocorre na importação confirmada; exportação/restauração local são exatas.
function operationalImportCandidate(original){
  const document=structuredClone(original),changes=[],day=recordDay(document.plan.date);
  const planned=(object,key)=>{
    const value=object[key],converted=plannedClock(value);
    if(converted!==value){object[key]=converted;changes.push('previsto '+value+' → '+converted);}
    if(value&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(converted))throw Error('Horário previsto com segundos não nulos: revise a programação antes de importar. O backup original foi preservado.');
  };
  for(const object of [document.plan,...document.plan.items])for(const key of ['start','end'])planned(object,key);
  for(const e of Object.values(document.executions))for(const key of ['started','ended']){
    const value=e[key];
    if(validRecordClock(value)){e[key]=recordInstant(day,value);changes.push('horário real associado à data do culto, no fuso America/Sao_Paulo');}
  }
  if(changes.length)document.backup_source={format:'IASDPI-backup',version:1,document:structuredClone(original)};
  return {document,changes};
}
const toBase64=bytes=>{let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text);};
const fromBase64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
async function backupCipher(password,salt){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptBackup(data,password){
  if(password.length<10)throw Error('Use uma senha de backup com pelo menos 10 caracteres.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await backupCipher(password,salt);
  const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(data)));
  return {format:'IASDPI-encrypted-backup',version:1,salt:toBase64(salt),iv:toBase64(iv),data:toBase64(new Uint8Array(bytes))};
}
async function decryptBackup(data,password){
  if(data.format!=='IASDPI-encrypted-backup')return backupValidate(data);
  if(data.version!==1)throw Error('Versão de backup incompatível.');
  try{const key=await backupCipher(password,fromBase64(data.salt));const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(data.iv)},key,fromBase64(data.data));return backupValidate(JSON.parse(new TextDecoder().decode(bytes)));}
  catch(_){throw Error('Senha incorreta ou arquivo danificado. Nada foi alterado.');}
}
async function downloadBackup(data){
  await IASDPIAuth.requireAccess();
  const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='IASDPI-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function restoreBackup(data){
  await IASDPIAuth.requireAccess();
  backupValidate(data);
  if(window.IASDPIOperational)return IASDPIOperational.importDocuments(data.programs);
  if(!window.IASDPIDemo)throw Error('A restauração pelo navegador está disponível no Pages/HTML local. A base SQLite não foi alterada.');
  const raw=localStorage.getItem(archiveKey),current=raw?JSON.parse(raw):[];
  backupValidate({format:'IASDPI-backup',version:1,programs:current});
  const merged=structuredClone(current),ids=new Set(current.map(p=>p.id));let added=0,copies=0;
  for(const p of data.programs){const existing=merged.find(e=>e.id===p.id);if(existing&&JSON.stringify(existing)===JSON.stringify(p))continue;const copy=structuredClone(p);if(ids.has(copy.id)){copy.id=crypto.randomUUID();copy.plan.name+=' (cópia restaurada)';copies++;}ids.add(copy.id);merged.push(copy);added++;}
  if(raw!==null)localStorage.setItem(IASDPIStorage.beforeRestore,raw);
  localStorage.setItem(archiveKey,JSON.stringify(merged));
  state.programs=merged;return {added,copies};
}
function cloudConfig(){return IASDPIAuth.config();}
function archivePage(){
  const account=IASDPIAuth.session();
  if(!account)return IASDPIAuth.loginPage();
  return heading('PROTEÇÃO DOS REGISTROS','Arquivo e banco',window.IASDPIOperational?'Supabase é a fonte principal. Publicações do site não substituem os registros do banco.':'Guarde uma cópia fora do celular. Os registros existentes permanecem no navegador.')+
  (window.IASDPIOperational?IASDPIOperational.panel():'')+
  `<section class="panel"><h2>${window.IASDPIOperational?'Backup adicional opcional':'Baixar backup protegido'}</h2><p class="muted">Inclui programações, horários, atividades extras, responsáveis e observações. Guarde o arquivo no Drive/OneDrive e mantenha a senha em local separado. Sem essa senha, o arquivo não poderá ser recuperado.</p><form id="backup-export-form"><div class="notes-grid">${field('Senha do backup','password','','password',true,'minlength="10" autocomplete="new-password"')}${field('Repetir senha','repeat','','password',true,'minlength="10" autocomplete="new-password"')}</div><button type="submit" class="primary">Baixar backup</button></form></section>
  <section class="panel"><h2>Restaurar uma cópia</h2><p class="muted">${window.IASDPIOperational?'Registros existentes no Supabase nunca serão substituídos pela restauração; conflitos serão informados.':'Os registros atuais não são substituídos. Versões diferentes do mesmo culto entram como cópias identificadas.'}</p><form id="backup-restore-form"><label>Arquivo de backup<input type="file" name="file" accept=".json,application/json" required></label>${field('Senha do arquivo protegido','password','','password',false,'autocomplete="off"')}<button type="submit">Restaurar sem substituir registros</button></form></section>
  <section class="panel"><h2>Arquivos históricos · Supabase</h2><p class="muted">${window.IASDPIOperational?'Cópias imutáveis adicionais em culto_archives, independentes do banco operacional. Não é necessário arquivar manualmente cada edição ou publicação.':'Conecte um projeto com a tabela culto_archives e políticas de acesso instaladas. Administradores e líderes autorizados acessam as cópias da igreja; as versões arquivadas não podem ser alteradas ou apagadas pelo site.'}</p><p>Conectado como ${esc(account.user.email)}.</p><div class="actions">${button('Arquivar registros no banco','cloud-save','','class="primary"')}${button('Consultar arquivos','cloud-list')}${button('Sair','cloud-signout')}</div><div class="section">${cloudState.loading?'<p role="status">Carregando arquivos…</p>':cloudState.error?`<p role="alert" class="form-error">Erro ao carregar arquivos: ${esc(cloudState.error)} ${button('Tentar novamente','cloud-list')}</p>`:cloudState.archives.length?`<ul class="agenda-list">${cloudState.archives.map(row=>`<li>${button('Restaurar cópia de '+displayRecordTimestamp(row.created_at),'cloud-restore',row.id)}</li>`).join('')}</ul>`:cloudState.loaded?'<p>Nenhum arquivo histórico encontrado.</p>':'<p>Use Consultar arquivos para carregar as cópias históricas.</p>'}</div></section>`;
}
async function refreshArchives(){
  cloudState.loading=true;cloudState.error='';render();
  try{
    const rows=await cloudRequest('/rest/v1/culto_archives?select=id,created_at&order=created_at.desc&limit=30');
    if(!Array.isArray(rows))throw Error('Resposta inválida ao consultar arquivos.');
    cloudState.archives=rows;cloudState.loaded=true;
  }catch(error){cloudState.error=error.message;throw error;}
  finally{cloudState.loading=false;render();}
}
async function cloudRequest(path,options={}){
  const authorization=await IASDPIAuth.requireAccess();
  if(!IASDPIAuth.remoteRequestAllowed(path,(options.method||'GET').toUpperCase()))throw Error('Homologação em modo de consulta: arquivamento remoto bloqueado.');
  const config=cloudConfig();
  const response=await fetch(config.url+path,{...options,headers:{apikey:config.key,Authorization:'Bearer '+authorization.token,'Content-Type':'application/json',...options.headers,...(window.IASDPIChurches?.headers()||{})}});
  if(IASDPIAuth.session()?.access_token!==authorization.token)throw Error('Sessão encerrada.');
  if(!response.ok)throw Error(response.status===401?'Sessão expirada. Saia e conecte novamente.':'O banco não confirmou a operação. Verifique a tabela e as políticas de acesso. Os dados locais foram preservados.');
  return response.status===204?null:response.json();
}
async function cloudSave(){
  const {user}=await IASDPIAuth.requireAccess();
  const payload=await backupPayload(),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));const digest=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
  await cloudRequest('/rest/v1/culto_archives?on_conflict=owner_id,digest',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({digest,payload})});
  const rows=await cloudRequest('/rest/v1/culto_archives?owner_id=eq.'+encodeURIComponent(user.id)+'&digest=eq.'+digest+'&select=id,digest,payload');
  const comparable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
  if(!Array.isArray(rows)||!rows.some(r=>r.digest===digest&&comparable(r.payload)===comparable(payload)))throw Error('Não foi possível confirmar o conteúdo da cópia no banco. Os dados locais permanecem preservados.');
  localStorage.removeItem(IASDPIStorage.pending);toast('Cópia arquivada e confirmada no banco.');
}
async function cloudAutoArchive(){
  if(window.IASDPIOperational||!cloudState.session||window.IASDPIConfig?.remoteReadOnly)return;cloudState.dirty=true;if(cloudState.busy)return;cloudState.busy=true;
  try{while(cloudState.dirty){cloudState.dirty=false;await cloudSave();}}
  catch(_){try{localStorage.setItem(IASDPIStorage.pending,'true');}catch(_){}toast('Registro local preservado. Arquivamento no banco pendente; tente novamente em Arquivo e banco.',true);}
  finally{cloudState.busy=false;}
}

;
'use strict';
const churchOrganization = [
  {name:'Adriano', departments:['Tesouraria','Desbravadores','Escola Sabatina']},
  {name:'Lucas', departments:['Adolescente','Vida e Saúde','Ministério 3ª Idade']},
  {name:'Elmo', departments:['Mordomia','ASA','Publicações']},
  {name:'Márcia', departments:['Família','Ministério da Mulher','Recepção']},
  {name:'Márcio', departments:['Patrimônio','Diaconato','Secretaria']},
  {name:'Raphael', departments:['Sonoplastia','Liberdade Religiosa','Ministério das Possibilidades']},
  {name:'Samuel', departments:['Ministério Pessoal','Música','Ministério dos Homens']},
  {name:'Victoria', departments:['Aventureiros','Gol da Esperança','Ministério Infantil']},
  {name:'Rosana', departments:['Comunicação','Ministério Recuperação','Jovens']}
];

// Responsáveis dos ministérios, separados do acompanhamento pelos anciãos.
const churchMinistries = [
  {name:'Diaconato — Diaconisas',responsibles:['Rose']},
  {name:'Diaconato — Diáconos',responsibles:['Marciano']},
  {name:'Ancionato',responsibles:[]},
  {name:'Ministério da Criança',responsibles:['Luciana Abdias']},
  {name:'Ministério dos Adolescentes',responsibles:['Taislane']},
  {name:'Comunicação',responsibles:['Henrique']},
  {name:'Ministério da Família',responsibles:['Luana','Raphael']},
  {name:'Ministério da Saúde',responsibles:['Simone Cristina']},
  {name:'Ministério de Publicações',responsibles:['Glaucia']},
  {name:'Ministério da Música',responsibles:['Alexandre']},
  {name:'Escola Sabatina',responsibles:['Renato']},
  {name:'Mordomia Cristã',responsibles:['Samuel']},
  {name:'Ministério Pessoal',responsibles:['Rosana']},
  {name:'Ação Solidária Adventista (ASA)',responsibles:['João Pedro']},
  {name:'Ministério Adventista das Possibilidades',responsibles:['João Pedro']},
  {name:'Liberdade Religiosa',responsibles:['João Pedro']},
  {name:'Ministério da Mulher',responsibles:['Gislaine']},
  {name:'Recepção',responsibles:['Nilce']},
  {name:'Ministério Jovem',responsibles:['Cauê']},
  {name:'Clube de Desbravadores',responsibles:['Victoria']},
  {name:'Clube de Aventureiros',responsibles:['Valeska']},
  {name:'Terceira Idade',responsibles:['Sandra']},
  {name:'Sonoplastia',responsibles:['Luan']},
  {name:'Patrimônio',responsibles:['Sérgio']},
  {name:'Ministério dos Homens',responsibles:['Paulo Scarpelini']},
  {name:'Gol da Esperança',responsibles:['Nelson']}
];
const organizationDepartmentNames = {
  'Desbravadores':'Clube de Desbravadores','Adolescente':'Ministério dos Adolescentes',
  'Vida e Saúde':'Ministério da Saúde','Ministério 3ª Idade':'Terceira Idade',
  'Mordomia':'Mordomia Cristã','ASA':'Ação Solidária Adventista (ASA)',
  'Publicações':'Ministério de Publicações','Família':'Ministério da Família',
  'Ministério das Possibilidades':'Ministério Adventista das Possibilidades',
  'Música':'Ministério da Música','Aventureiros':'Clube de Aventureiros',
  'Ministério Infantil':'Ministério da Criança','Jovens':'Ministério Jovem'
};
const organizationState = {query:''};
const organizationSearchText = value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
const ministryPeople = ministry=>ministry.responsibles.length?new Intl.ListFormat('pt-BR',{type:'conjunction'}).format(ministry.responsibles):'Não informado';
const organizationCountText = count=>`${count} ${count===1?'resultado encontrado':'resultados encontrados'}.`;
function organizationDepartments(elder){
  return elder.departments.flatMap(original=>{
    const names=original==='Diaconato'?['Diaconato — Diaconisas','Diaconato — Diáconos']:[organizationDepartmentNames[original]||original];
    return names.map(name=>{const stored=churchMinistries.find(entry=>entry.name===name);const ministry=window.IASDPIRegistry?.ministry(stored||{name,responsibles:[]})||stored;return {name,original,responsibles:ministry?.responsibles||[]};});
  });
}
function organizationResults(){
  const query=organizationSearchText(organizationState.query);
  const matches=ministry=>!ministry.archived&&(!query||organizationSearchText([ministry.name,ministry.original||'',ministryPeople(ministry)].join(' ')).includes(query));
  const oldAncionato=churchMinistries.find(ministry=>ministry.name==='Ancionato');const ancionato=window.IASDPIRegistry?.ministry(oldAncionato)||oldAncionato;
  const showAncionato=matches(ancionato);
  const groups=churchOrganization.map(elder=>({...elder,departments:organizationDepartments(elder).filter(matches)})).filter(elder=>elder.departments.length);
  const represented=new Set(['Ancionato',...groups.flatMap(e=>e.departments.map(d=>d.name)),...(groups.some(e=>e.departments.some(d=>d.name.startsWith('Diaconato')))?['Diaconato']:[])]);const extras=(window.IASDPIRegistry?.publicDepartments?.()||[]).filter(d=>!represented.has(d.name)&&matches(d));
  const count=groups.reduce((total,elder)=>total+elder.departments.length,0)+Number(showAncionato)+extras.length;
  const ministryHtml=ministry=>`<h3 class="organization-ministry-name">${esc(ministry.name)}</h3><p class="organization-responsible"><span class="muted">${ministry.responsibles.length>1?'Responsáveis':'Responsável'}:</span> <strong>${esc(ministryPeople(ministry))}</strong></p>`;
  return {count,html:count?`${showAncionato?`<section class="organization-ancionato" data-ministry="Ancionato">${ministryHtml(ancionato)}</section>`:''}
    ${groups.length?`<p class="organization-level">Anciãos e departamentos sob seu acompanhamento</p><ul class="organization-elders">${groups.map(elder=>`<li class="organization-elder"><div class="organization-elder-heading"><span class="eyebrow">${['Márcia','Victoria','Rosana'].includes(elder.name)?'ANCIÃ':'ANCIÃO'} · ACOMPANHAMENTO</span><h2>${esc(elder.name)}</h2></div><ul class="organization-departments">${elder.departments.map(ministry=>`<li data-ministry="${esc(ministry.name)}">${ministryHtml(ministry)}</li>`).join('')}</ul></li>`).join('')}</ul>`:''}${extras.length?`<section class="panel"><h2>Ministérios sem acompanhamento definido</h2>${extras.map(d=>`<div data-ministry="${esc(d.name)}">${ministryHtml(d)}</div>`).join('')}</section>`:''}`:empty('Nenhum ministério encontrado','Revise o nome do ministério ou responsável, ou limpe a pesquisa.')};
}
function organizationPage() {
  const results=organizationResults();
  return (window.IASDPIRegistry?.publicStatus()||'')+heading('NOSSA IGREJA','Organograma da igreja','Ministérios, seus responsáveis e o acompanhamento pastoral e dos anciãos.') +
    `<section class="panel organization-search" role="search" aria-label="Pesquisa de ministérios"><label for="organization-query">Pesquisar ministério ou responsável<input type="search" id="organization-query" maxlength="200" autocomplete="off" placeholder="Ex.: Música ou Alexandre" value="${esc(organizationState.query)}" aria-controls="organization-results"></label><button type="button" id="organization-clear">Limpar pesquisa</button><p id="organization-count" class="muted" role="status" aria-live="polite">${organizationCountText(results.count)}</p></section>`+
    `<section class="organization" aria-label="Hierarquia da liderança da igreja">
      <div class="organization-pastor"><span class="eyebrow">PASTOR</span><h2>Luciano</h2><p>Acompanhamento de todos os anciãos</p></div>
      <div id="organization-results">${results.html}</div>
    </section>`;
}
function updateOrganizationSearch(){
  const target=document.getElementById('organization-results');if(!target)return;
  const results=organizationResults();target.innerHTML=results.html;
  document.getElementById('organization-count').textContent=organizationCountText(results.count);
}
document.addEventListener('input',event=>{if(event.target.id==='organization-query'){organizationState.query=event.target.value;updateOrganizationSearch();}});
document.addEventListener('click',event=>{if(event.target.closest('#organization-clear')){organizationState.query='';const input=document.getElementById('organization-query');input.value='';updateOrganizationSearch();input.focus();}});

;
'use strict';
const usersState={rows:[],invites:[],offset:0,loaded:false,loading:false,error:'',found:null,inviteLink:'',inviteToken:''};
function resetUsers(){usersState.rows=[];usersState.invites=[];usersState.found=null;usersState.loaded=false;usersState.loading=false;usersState.error='';usersState.offset=0;usersState.inviteLink='';}
async function usersRpc(name,body={}){
  const authorization=await IASDPIAuth.requireAccess();
  if(authorization.role!=='admin')throw Error('Acesso exclusivo de administradores.');
  const result=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+authorization.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(IASDPIAuth.session()?.access_token!==authorization.token||!IASDPIAuth.isAdmin())throw Error('Acesso administrativo encerrado.');
  return result;
}
async function refreshUsers(){
  usersState.loading=true;usersState.error='';render();
  try{
    const [rows,invites]=await Promise.all([usersRpc('iasdpi_list_users',{p_offset:usersState.offset}),usersRpc('iasdpi_list_invites')]);
    if(!Array.isArray(rows)||!Array.isArray(invites))throw Error('Resposta inválida ao consultar usuários.');
    usersState.rows=rows;usersState.invites=invites;usersState.loaded=true;
  }catch(error){usersState.error=error.message;throw error;}
  finally{usersState.loading=false;render();}
}
function usersPage(){return window.IASDPIGovernance?.enabled()?IASDPIGovernance.page():legacyUsersPage();}
function legacyUsersPage(){
  if(!IASDPIAuth.isAdmin())return heading('ADMINISTRAÇÃO','Acesso restrito','Somente administradores podem gerenciar usuários.');
  return heading('ADMINISTRAÇÃO','Usuários','IASD Parada Inglesa · autorizações e convites.',button('Atualizar lista','users-refresh'))+
    (window.IASDPIConfig?.remoteReadOnly?'<p class="form-note">Modo de consulta: listagem e busca disponíveis; alterações de acesso e convites bloqueadas nesta interface.</p>':'')+
    `<section class="panel"><h2>Autorizar conta existente</h2><p class="muted">Busque pelo e-mail exato. A conta precisa ter o e-mail confirmado.</p><form id="users-find-form" class="users-inline">${field('E-mail','email','','email',true)}<button type="submit">Buscar conta</button></form>${usersState.found?`<div class="users-result"><p>${esc(usersState.found.email)} · ${usersState.found.confirmed?'E-mail confirmado':'E-mail ainda não confirmado'}</p>${usersState.found.confirmed&&!usersState.found.authorized?button('Autorizar como líder','users-authorize',usersState.found.user_id,'class="primary"'):'<p class="muted">Se a conta já está na lista, altere seu perfil abaixo.</p>'}</div>`:''}</section>
    <section class="panel"><h2>Convidar novo líder</h2><p class="muted">O convite é individual, válido por 48 horas e só pode ser aceito pela conta com o e-mail confirmado correspondente. Não concede perfil administrador.</p><form id="users-invite-form" class="users-inline">${field('E-mail do convidado','email','','email',true)}<button type="submit">Gerar convite</button></form>${usersState.inviteLink?`<label>Link do convite<input id="users-invite-link" readonly value="${esc(usersState.inviteLink)}"></label><p class="muted">Copie e envie por um canal privado. Este link não será exibido novamente ao recarregar.</p>${button('Copiar link','users-copy')}`:''}</section>
    <section class="section"><h2>Usuários autorizados</h2><p class="muted">Administrador pode gerenciar acessos. Líder pode operar cultos e backups. Desmarcar “Acesso ativo” revoga a autorização. O último administrador não pode ser removido ou rebaixado.</p>${usersState.loading?'<p role="status">Carregando usuários…</p>':usersState.error?`<p role="alert" class="form-error">Erro ao carregar usuários: ${esc(usersState.error)} ${button('Tentar novamente','users-refresh')}</p>`:usersState.loaded?usersState.rows.length?`<ul class="users-list">${usersState.rows.map(row=>`<li><form class="user-access-form" data-user-id="${esc(row.user_id)}"><div><strong>${esc(row.email)}</strong><small>${row.user_id===IASDPIAuth.session()?.user.id?'Sua conta':'Conta autorizada'}</small></div><label>Perfil<select name="role"><option value="leader" ${row.role==='leader'?'selected':''}>Líder</option><option value="admin" ${row.role==='admin'?'selected':''}>Administrador</option></select></label><label class="checkbox"><input name="enabled" type="checkbox" ${row.enabled?'checked':''}> Acesso ativo</label><button type="submit">Salvar acesso</button></form></li>`).join('')}</ul>`:'<p>Nenhum usuário nesta página.</p>':'<p class="muted">Atualize a lista para consultar as autorizações.</p>'}<div class="actions">${button('Anterior','users-previous','',''+(usersState.offset===0?'disabled':''))}${button('Próxima','users-next','',''+(usersState.rows.length<50?'disabled':''))}</div></section>
    <section class="section"><h2>Convites pendentes</h2>${usersState.loading?'<p role="status">Carregando convites…</p>':usersState.error?'<p>Não foi possível consultar os convites. Tente novamente.</p>':usersState.invites.length?`<ul class="users-list">${usersState.invites.map(i=>`<li class="users-inline"><div><strong>${esc(i.email)}</strong><small>Expira em ${esc(displayRecordTimestamp(i.expires_at))}</small></div>${button('Revogar convite','users-revoke-invite',i.id)}</li>`).join('')}</ul>`:usersState.loaded?'<p class="muted">Nenhum convite pendente.</p>':'<p class="muted">Atualize a lista para consultar os convites.</p>'}</section>`;
}
function captureInvite(fragment){
  if(window.IASDPIGovernance?.captureReset(fragment))return;
  if(/(?:^|&)(?:error|error_code)=/.test(fragment)||/(?:^|&)type=recovery(?:&|$)/.test(fragment)){void IASDPIAuth.handlePasswordCallback();return;}
  // Confirmação de e-mail pode redirecionar com tokens no fragmento.
  // Este fluxo usa login por senha: não importar nem deixar tokens na URL.
  if(/(?:^|&)(?:access_token|refresh_token)=/.test(fragment)){
    window.history.replaceState(null,'','#organization');return;
  }
  const [page,token]=fragment.split('/');
  if(page==='invite'&&token){
    usersState.inviteToken=/^[a-f0-9]{64}$/.test(token)?token:'';
    window.history.replaceState(null,'','#invite');
  }
}
function invitePage(){
  return heading('CONVITE','Acesso à IASD Parada Inglesa','Confirme seu e-mail antes de aceitar. O convite só autoriza a conta indicada pelo administrador.')+
    (usersState.inviteToken?`<section class="panel auth-panel"><form id="invite-login-form"><h2>Já tenho uma conta</h2>${field('E-mail','email','','email',true,'autocomplete="username"')}${field('Senha','password','','password',true,'autocomplete="current-password"')}${IASDPIAuth.config().key?'':field('Chave pública da conexão','public-key','','text',true)}<button type="submit" class="primary">Entrar e aceitar convite</button></form><hr><form id="invite-signup-form"><h2>Criar minha conta</h2>${field('E-mail','email','','email',true,'autocomplete="username"')}${field('Nova senha','password','','password',true,'minlength="12" autocomplete="new-password"')}${IASDPIAuth.config().key?'':field('Chave pública da conexão','public-key','','text',true)}<button type="submit">Cadastrar e confirmar e-mail</button><p class="muted">Após confirmar pelo e-mail recebido, reabra o convite original e entre com sua senha. O cadastro sozinho não autoriza o acesso.</p></form></section>`:'<p class="panel">Abra o link individual enviado pelo administrador. Se o convite expirou, solicite outro.</p>');
}
async function handleUsersAction(action,id){
  if(action==='users-copy'){await navigator.clipboard.writeText(usersState.inviteLink);toast('Link copiado. Envie apenas ao convidado.');return;}
  if(action==='users-authorize'){
    await usersRpc('iasdpi_set_access',{p_user_id:id,p_role:'leader',p_enabled:true});usersState.found=null;toast('Líder autorizado.');
  }else if(action==='users-revoke-invite'){
    await usersRpc('iasdpi_revoke_invite',{p_id:id});usersState.inviteLink='';toast('Convite revogado.');
  }else if(action==='users-next')usersState.offset+=50;
  else if(action==='users-previous')usersState.offset=Math.max(0,usersState.offset-50);
  await refreshUsers();
}
async function submitUsersForm(form){
  if(form.id==='users-find-form'){
    const rows=await usersRpc('iasdpi_find_account',{p_email:form.elements.email.value});
    usersState.found=rows[0]||null;render();if(!usersState.found)toast('Conta não encontrada. Você pode gerar um convite.');
  }else if(form.id==='users-invite-form'){
    if(location.protocol==='file:')throw Error('Gere convites no endereço do site. Um link de arquivo local não pode ser enviado ao convidado.');
    const [invite]=await usersRpc('iasdpi_create_invite',{p_email:form.elements.email.value});
    usersState.inviteLink=location.href.split('#')[0]+'#invite/'+invite.token;await refreshUsers();
  }else if(form.classList.contains('user-access-form')){
    await usersRpc('iasdpi_set_access',{p_user_id:form.dataset.userId,p_role:form.elements.role.value,p_enabled:form.elements.enabled.checked});
    await IASDPIAuth.requireAccess();toast('Acesso atualizado.');
    if(IASDPIAuth.isAdmin())await refreshUsers();else{resetUsers();navigate('home');}
  }
}

;
'use strict';
// Ações administrativas confirmadas por RPC; nunca excluem definitivamente.
const trashState={rows:null,detail:null,error:'',loading:false,requests:new Map()};
async function trashRPC(name,args={}){
  const access=await IASDPIAuth.requireAccess();
  if(!IASDPIAuth.isAdmin())throw Error('Acesso administrativo necessário.');
  return IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify(args)}).then(result=>{
    if(IASDPIAuth.session()?.access_token!==access.token)throw Error('Sessão alterada. Entre novamente e atualize a lista.');
    return result;
  });
}
async function refreshTrash(){
  trashState.loading=true;trashState.error='';if(state.page==='trash')render();
  try{
    const rows=[];
    for(let offset=0;;offset+=100){const page=await trashRPC('iasdpi_list_trash',{p_offset:offset});rows.push(...page);if(page.length<100)break;}
    trashState.rows=rows;trashState.error='';
  }catch(error){trashState.error=error.message+' Confira se a migração 004 foi instalada.';}
  trashState.loading=false;if(state.page==='trash')render();
}
function trashWhen(value){const parsed=inspectRecordTime(value);return parsed.valid?`${displayDate(parsed.day)} ${displayActualTime(value)}`:'Data não informada';}
function trashPage(){
  if(!IASDPIAuth.isAdmin())return empty('Acesso administrativo necessário','Somente administradores podem consultar e restaurar cultos da lixeira.');
  const detail=trashState.detail,p=detail?.document;
  return heading('ADMINISTRAÇÃO','Lixeira de cultos','Os registros permanecem recuperáveis. Não existe exclusão definitiva.',`<div class="actions">${button('Atualizar lixeira','trash-refresh')}${button('Voltar às programações','programs')}</div>`)+
    (trashState.error?`<p class="form-error" role="alert">${esc(trashState.error)} ${button('Tentar novamente','trash-refresh')}</p>`:'')+
    (p?`<section class="panel"><h2>${esc(p.plan?.name)}</h2><p>${esc(displayDate(p.plan?.date))} · ID: ${esc(p.id)}</p><p>Movido em ${esc(trashWhen(detail.deleted_at))} por ${esc(detail.deleted_by_email||detail.deleted_by)}.</p><p>Motivo: ${esc(detail.deletion_reason||'Não informado')}</p><p>Status anterior: ${esc(p.status)} · Versão ${esc(detail.version)}</p><p>Observações: ${esc(p.note||'—')}</p><p>Ocorrências: ${esc(p.incident||'—')}</p><p>Informações complementares: ${esc(p.record_info||'—')}</p><div class="table-scroll"><table><thead><tr><th>Atividade / responsável / observações</th><th>Previsto</th><th>Real</th><th>Duração prevista</th><th>Duração real</th><th>Diferença</th></tr></thead><tbody>${summaryActivityRows(p)}</tbody></table></div><div class="actions">${button('Restaurar culto','trash-restore',p.id,'class="primary"')}${button('Fechar detalhes','trash-close')}</div><details><summary>Histórico da lixeira</summary><ul>${(detail.audit||[]).map(a=>`<li>${esc(a.action==='trash'?'Movido para a lixeira':'Restaurado')} · ${esc(trashWhen(a.happened_at))} · ${esc(a.actor_id)} · versão ${esc(a.to_version)}${a.reason?' · '+esc(a.reason):''}</li>`).join('')}</ul></details></section>`:'')+
    (trashState.loading?'<p role="status">Carregando lixeira…</p>':trashState.error?'':trashState.rows===null?'<p>Use Atualizar lixeira para consultar o Supabase.</p>':trashState.rows.length?`<div class="table-scroll"><table><thead><tr><th>Culto</th><th>Excluído em / por</th><th>Motivo</th><th>Ações</th></tr></thead><tbody>${trashState.rows.map(row=>`<tr><td>${esc(row.document.plan?.name)}<small>${esc(displayDate(row.document.plan?.date))} · ${esc(row.id)}</small></td><td>${esc(trashWhen(row.deleted_at))}<small>${esc(row.deleted_by_email||row.deleted_by)}</small></td><td>${esc(row.deletion_reason||'—')}</td><td>${button('Ver detalhes','trash-detail',row.id)}${button('Restaurar','trash-restore',row.id)}</td></tr>`).join('')}</tbody></table></div>`:empty('Lixeira vazia','Nenhum culto foi movido para a lixeira.'));
}
async function handleTrashAction(action,id){
  await IASDPIAuth.requireAccess();if(!IASDPIAuth.isAdmin())throw Error('Acesso administrativo necessário.');
  if(!window.IASDPIOperational)throw Error('A lixeira exige persistência Supabase e a migração 004.');
  if(action==='trash-refresh'){trashState.detail=null;await refreshTrash();return;}
  if(action==='trash-open'){if(navigate('trash')===false)return;await refreshTrash();return;}
  if(action==='trash-detail'){trashState.detail=await trashRPC('iasdpi_trash_detail',{p_id:id});render();return;}
  if(action==='trash-close'){trashState.detail=null;render();return;}
  if(action==='trash-move'){
    const p=state.programs.find(row=>row.id===id);if(!p)throw Error('Atualize as programações antes de continuar.');
    if(!confirm(`Mover para a lixeira o culto “${p.plan.name}” de ${displayDate(p.plan.date)}?\nID: ${p.id}\nAs atividades e os horários serão preservados e poderão ser restaurados.`))return;
    const reason=prompt('Motivo da exclusão (opcional, até 2000 caracteres):','');if(reason===null)return;
    if(reason.length>2000)throw Error('O motivo deve ter até 2000 caracteres.');
    await trashChange('iasdpi_trash_program',p.id,p.version,reason);
    toast('Supabase confirmou: culto movido para a lixeira.');
  }else if(action==='trash-restore'){
    const row=trashState.detail?.id===id?trashState.detail:trashState.rows?.find(row=>row.id===id);
    if(!row)throw Error('Atualize a lixeira antes de continuar.');
    if(!confirm(`Restaurar “${row.document.plan.name}” de ${displayDate(row.document.plan.date)}?\nID: ${id}`))return;
    await trashChange('iasdpi_restore_program',id,row.version);
    toast('Supabase confirmou: culto restaurado nas programações.');
  }
}
async function trashChange(rpc,id,version,reason){
  const key=JSON.stringify([IASDPIAuth.session()?.user.id,rpc,id,version,reason]);
  const request=trashState.requests.get(key)||crypto.randomUUID();trashState.requests.set(key,request);
  await trashRPC(rpc,{p_id:id,p_expected_version:version,p_request_id:request,...(reason===undefined?{}:{p_reason:reason})});
  trashState.requests.delete(key);trashState.detail=null;
  await loadPrograms();if(state.selected===id)state.selected=null;
  if(state.page==='trash')await refreshTrash();else render();
}
window.addEventListener('iasdpi-auth-changed',()=>{if(!IASDPIAuth.isAdmin()){trashState.rows=null;trashState.detail=null;trashState.error='';trashState.requests.clear();}});

;
'use strict';
// Recuperação local de edição; nunca substitui confirmação do servidor.
window.IASDPIDrafts=(()=>{
  const ttl=24*60*60*1000, forms=new Set(['actuals-form','program-form','notes-form']);
  const scope=JSON.stringify([location.pathname,IASDPIConfig.supabaseUrl,IASDPIConfig.storageNamespace||'',IASDPIConfig.storageMode||'browser']);
  let active=null, observer=null, queue=Promise.resolve(), preferred=null, memoryOnly=false;
  const memory=new Map(),keys=new Map(),labels={'actuals-form':'Registro do culto','program-form':'Programação','notes-form':'Observações do resumo'};
  let tab;
  try{tab=sessionStorage.getItem('iasdpi-draft-tab-v1')||crypto.randomUUID();sessionStorage.setItem('iasdpi-draft-tab-v1',tab);}catch(_){tab=crypto.randomUUID();}
  const actor=()=>IASDPIAuth.session()?.user.id||null;
  const group=uid=>JSON.stringify([scope,uid]);
  const draftKey=(uid,kind,id)=>JSON.stringify([scope,uid,kind,id,tab]);
  const aad=row=>new TextEncoder().encode(JSON.stringify([row.key,row.revision,row.baseVersion,row.expiresAt]));
  function enqueue(job){const task=queue.then(job);queue=task.catch(()=>{});return task;}
  function open(){return new Promise((resolve,reject)=>{
    const request=indexedDB.open(window.IASDPIStorage?.scope?.('iasdpi-edit-drafts-v1')||'iasdpi-edit-drafts-v1',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('drafts',{keyPath:'key'});request.result.createObjectStore('keys',{keyPath:'key'});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Armazenamento local indisponível.'));
  });}
  async function storage(store,mode,operation){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,mode),request=operation(tx.objectStore(store));
      tx.oncomplete=()=>{db.close();resolve(request.result);};
      tx.onabort=tx.onerror=()=>{db.close();reject(Error('Não foi possível preservar o rascunho neste navegador.'));};
    });
  }
  async function keyFor(uid){
    const id=group(uid);if(keys.has(id))return keys.get(id);
    let row;
    if(!memoryOnly)try{row=await storage('keys','readonly',s=>s.get(id));}catch(_){memoryOnly=true;}
    if(!row){
      row={key:id,value:await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])};
      // add, e não put: duas abas não podem trocar a chave que cifra o mesmo usuário.
      if(!memoryOnly)try{await storage('keys','readwrite',s=>s.add(row));}
      catch(_){try{row=await storage('keys','readonly',s=>s.get(id))||row;}catch(_){memoryOnly=true;}}
    }
    keys.set(id,row.value);return row.value;
  }
  async function rows(){
    if(!memoryOnly)try{return await storage('drafts','readonly',s=>s.getAll());}catch(_){memoryOnly=true;}
    return [...memory.values()];
  }
  async function write(row){
    memory.set(row.key,row);
    if(!memoryOnly)try{await storage('drafts','readwrite',s=>s.put(row));}catch(_){memoryOnly=true;}
  }
  async function remove(key,revision=null){
    if(!revision||memory.get(key)?.revision===revision)memory.delete(key);
    if(memoryOnly)return;
    const db=await open();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),read=store.get(key);
      read.onsuccess=()=>{if(read.result&&(!revision||read.result.revision===revision))store.delete(key);};
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(Error('Não foi possível limpar o rascunho local.'));};
    });
  }
  async function owned(uid){
    const all=await rows(),now=Date.now(),valid=[];
    for(const row of all){
      if(row.scope!==scope)continue;
      if(row.expiresAt<=now){await remove(row.key,row.revision);continue;}
      if(row.uid===uid)valid.push(row);
    }
    return valid.sort((a,b)=>b.updatedAt-a.updatedAt);
  }
  function controls(root,exclude){
    return [...root.querySelectorAll('input,select,textarea')].filter(e=>e.name&&!['password','file'].includes(e.type)&&(!exclude||!e.closest(exclude))).map(e=>({
      name:e.name,value:e.value,checked:e.type==='checkbox'?e.checked:undefined,
      edited:e.dataset.timeEdited,original:e.dataset.originalTime,day:e.dataset.originalDay,reapplied:e.dataset.conflictClock
    }));
  }
  function snapshot(form){
    const kind=form.id,rowSelector=kind==='actuals-form'?'.actual-row':kind==='program-form'?'.item-editor':null;
    const data={fields:controls(form,rowSelector),rows:[]};
    if(rowSelector)data.rows=[...form.querySelectorAll(rowSelector)].map(row=>({
      id:kind==='actuals-form'?row.dataset.id:row.dataset.itemId,extra:row.dataset.extra==='true',
      fields:controls(row,kind==='actuals-form'?'.subactivity':null),
      children:[...row.querySelectorAll('.subactivity')].map(child=>({id:child.dataset.subId,parent:child.dataset.parentId,fields:controls(child)}))
    }));
    return data;
  }
  function feedback(message,error=false){
    if(!active?.form.isConnected)return;
    let target=active.form.querySelector('.draft-feedback');
    if(!target){target=document.createElement('p');target.className='draft-feedback form-note';target.setAttribute('role','status');active.form.prepend(target);}
    target.textContent=message;target.classList.toggle('form-error',error);
  }
  function persist(context,required=false){
    const row={key:context.key,scope,uid:context.uid,kind:context.kind,id:context.id,page:context.page,baseVersion:context.version,
      revision:context.revision,updatedAt:Date.now(),expiresAt:Date.now()+ttl};
    const data=structuredClone(context.data);
    return enqueue(async()=>{
      row.iv=crypto.getRandomValues(new Uint8Array(12));
      row.cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv:row.iv,additionalData:aad(row)},await keyFor(row.uid),new TextEncoder().encode(JSON.stringify(data)));
      await write(row);
      if(required&&memoryOnly)throw Error('Cópia de recuperação persistente indisponível. Mantenha esta edição aberta.');
      if(active?.key===row.key&&active.revision===row.revision){
        feedback(memoryOnly?'Rascunho somente nesta aba: recuperação após recarregar indisponível. Mantenha a aba aberta.':'Rascunho local protegido por até 24 horas. Ainda não salvo no servidor.');
      }
      await refreshNotice();
    }).catch(error=>{if(active?.key===row.key)feedback('Falha ao preservar o rascunho. Mantenha esta aba aberta. '+error.message,true);if(required)throw Error('Não foi possível preservar a cópia anterior. Nenhuma seleção foi reaplicada. '+error.message);});
  }
  function changed(){
    if(!active?.form.isConnected)return;
    const data=snapshot(active.form),serial=JSON.stringify(data);
    if(serial===active.serial)return;
    active.data=data;active.serial=serial;active.revision=crypto.randomUUID();active.dirty=true;active.leaving=false;
    if(active.kind==='actuals-form')registrationDirty=true;
    feedback('Alterações não salvas. Preservando rascunho local…');
    void persist(active);
  }
  function suspend(){
    changed();observer?.disconnect();active=null;
    const notice=document.querySelector('#drafts-notice');if(notice)notice.replaceChildren();
    if(notice)notice.hidden=true;
  }
  async function refreshNotice(){
    const uid=actor();let host=document.querySelector('#drafts-notice');
    if(!uid){if(host)host.hidden=true;return;}
    const list=await owned(uid);if(actor()!==uid)return;
    if(!host){host=document.createElement('aside');host.id='drafts-notice';host.className='drafts-notice';document.querySelector('#app').before(host);}
    host.replaceChildren();host.hidden=!list.length;if(!list.length)return;
    const details=document.createElement('details'),title=document.createElement('summary');
    title.textContent='Rascunhos locais ('+list.length+') · não enviados ao servidor';details.append(title);
    const explanation=document.createElement('p');explanation.textContent='Disponíveis por até 24 horas neste navegador. Sair da conta remove estes rascunhos.';details.append(explanation);
    for(const row of list){
      const button=document.createElement('button');button.type='button';
      button.textContent='Retomar '+labels[row.kind]+(row.id?' · '+row.id.slice(0,12):' · novo')+' · '+new Date(row.updatedAt).toLocaleString('pt-BR',{hourCycle:'h23'});
      button.onclick=()=>guarded(async()=>{
        await IASDPIAuth.requireAccess();if(actor()!==uid)throw Error('Entre com a conta original.');
        if(!canLeave())return;
        if(row.id&&!state.programs.some(p=>p.id===row.id))throw Error('Este registro não está disponível. O rascunho foi preservado.');
        preferred=row.key;state.selected=row.id||null;navigate(row.page,row.id||undefined,{refresh:true});
      },button);
      details.append(button);
    }
    host.append(details);
  }
  function formContext(form){
    const uid=actor(),kind=form?.id;if(!uid||!forms.has(kind))return null;
    const id=form.dataset.id||'';
    return {uid,kind,id,key:draftKey(uid,kind,id),page:state.page,version:Number(form.dataset.version||0),form,
      baseline:JSON.stringify(snapshot(form)),serial:JSON.stringify(snapshot(form)),data:snapshot(form),revision:null,dirty:false,leaving:false,source:null};
  }
  function mount(){
    if(active?.form.isConnected)return;
    observer?.disconnect();
    const form=document.querySelector('#actuals-form,#program-form,#notes-form');
    active=formContext(form);
    if(active){observer=new MutationObserver(()=>changed());observer.observe(form,{childList:true,subtree:true});}
    const context=active;
    void enqueue(async()=>{
      await refreshNotice();if(!context||active!==context||actor()!==context.uid)return;
      const list=await owned(context.uid);
      const row=list.find(r=>r.key===preferred&&r.kind===context.kind&&r.id===context.id)||list.find(r=>r.key===context.key)||list.find(r=>r.kind===context.kind&&r.id===context.id);
      preferred=null;if(!row||active!==context||actor()!==context.uid||context.dirty)return;
      const panel=document.createElement('section');panel.className='draft-offer form-note';
      const message=document.createElement('p');
      message.textContent=row.baseVersion===context.version?'Existe um rascunho local. A recuperação não grava no servidor.':'A versão do registro mudou. O rascunho foi preservado para consulta; não será aplicado sobre a versão atual.';
      panel.append(message);
      const restore=document.createElement('button');restore.type='button';restore.dataset.draftRestore='true';restore.textContent='Recuperar rascunho';restore.disabled=row.baseVersion!==context.version;
      restore.onclick=()=>guarded(()=>recover(row,context),restore);panel.append(restore);
      if(row.baseVersion!==context.version){const compare=document.createElement('button');compare.type='button';compare.textContent='Comparar com versão atual';compare.dataset.draftCompare='true';compare.onclick=()=>guarded(async()=>{const data=await unlock(row,context);await IASDPIConflicts.openDraft(context.form,{data,version:row.baseVersion,uid:row.uid});},compare);panel.append(compare);}
      const inspect=document.createElement('button');inspect.type='button';inspect.textContent='Consultar rascunho';
      inspect.onclick=()=>guarded(async()=>{
        const data=await unlock(row,context);const pre=document.createElement('pre');pre.className='draft-preview';pre.textContent=JSON.stringify(data,null,2);panel.append(pre);inspect.remove();
      },inspect);panel.append(inspect);
      const discard=document.createElement('button');discard.type='button';discard.textContent='Descartar este rascunho';
      discard.onclick=()=>guarded(async()=>{
        await IASDPIAuth.requireAccess();if(actor()!==row.uid)throw Error('Entre com a conta original.');
        if(!confirm('Descartar somente este rascunho local? O registro salvo não será alterado.'))return;
        await enqueue(()=>remove(row.key,row.revision));panel.remove();await refreshNotice();
      },discard);panel.append(discard);context.form.prepend(panel);
    }).catch(error=>feedback(error.message,true));
  }
  async function unlock(row,context){
    await IASDPIAuth.requireAccess();
    if(actor()!==row.uid||active!==context||row.scope!==scope)throw Error('Rascunho indisponível para esta sessão.');
    const current=(await owned(row.uid)).find(r=>r.key===row.key&&r.revision===row.revision);
    if(!current)throw Error('Rascunho expirou ou foi atualizado. Reabra a edição.');
    const value=await crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv,additionalData:aad(row)},await keyFor(row.uid),row.cipher);
    if(actor()!==row.uid||active!==context)throw Error('Sessão alterada.');
    return JSON.parse(new TextDecoder().decode(value));
  }
  function fill(root,fields,exclude){
    if(!Array.isArray(fields))throw Error('Rascunho incompatível.');
    const inputs=[...root.querySelectorAll('input,select,textarea')].filter(e=>!exclude||!e.closest(exclude));
    for(const saved of fields){
      const input=inputs.find(e=>e.name===saved.name);if(!input||typeof saved.value!=='string'||['password','file'].includes(input.type))continue;
      input.value=saved.value;if(input.type==='checkbox')input.checked=Boolean(saved.checked);
      for(const [name,value] of [['timeEdited',saved.edited],['originalTime',saved.original],['originalDay',saved.day],['conflictClock',saved.reapplied]]){
        if(typeof value==='string')input.dataset[name]=value;else delete input.dataset[name];
      }
    }
  }
  const values=fields=>Object.fromEntries(fields.map(f=>[f.name,f.value]));
  async function recover(row,context){
    const data=await unlock(row,context);
    if(row.baseVersion!==context.version)throw Error('A versão do registro mudou. Consulte o rascunho antes de reaplicar seus dados.');
    applyData(context,data,{key:row.key,revision:row.revision});
  }
  function applyData(context,data,source=null){
    if(!Array.isArray(data.rows)||!Array.isArray(data.fields))throw Error('Rascunho incompatível.');
    if(context.kind==='actuals-form'){
      const rows=[...context.form.querySelectorAll('.actual-row')],planned=rows.filter(r=>!r.dataset.extra).map(r=>r.dataset.id).sort();
      if(JSON.stringify(planned)!==JSON.stringify(data.rows.filter(r=>!r.extra).map(r=>r.id).sort()))throw Error('As atividades da programação mudaram. O rascunho permanece disponível para consulta.');
      const list=context.form.querySelector('.actuals-list'),fragment=document.createDocumentFragment();
      for(const saved of data.rows){
        let target=rows.find(r=>r.dataset.id===saved.id);
        if(!target&&saved.extra){
          const item={id:saved.id,activity:values(saved.fields)['extra-theme']||'',block:'Culto',unplanned:true};
          const holder=document.createElement('div');holder.innerHTML=actualRow(null,{items:[item]},item,0,{});target=holder.firstElementChild;
        }
        if(!target)throw Error('Atividade não encontrada. Rascunho preservado.');
        fill(target,saved.fields,'.subactivity');
        target.querySelector('.subactivities').innerHTML=saved.children.map(child=>subactivityRow({...values(child.fields),id:child.id,parent_id:child.parent,title:values(child.fields)['sub-title'],responsible:values(child.fields)['sub-responsible'],note:values(child.fields)['sub-note'],start:'',end:''},saved.id)).join('');
        [...target.querySelectorAll('.subactivity')].forEach((child,index)=>fill(child,saved.children[index].fields));
        fragment.append(target);
      }
      list.replaceChildren(fragment);list.querySelectorAll('.actual-number').forEach((e,i)=>e.textContent=i+1);
    }else if(context.kind==='program-form'){
      context.form.querySelector('#items-editor').innerHTML=data.rows.map((r,i)=>itemEditor({...values(r.fields),id:r.id},i)).join('');
    }
    fill(context.form,data.fields,context.kind==='actuals-form'?'.actual-row':context.kind==='program-form'?'.item-editor':null);
    context.form.querySelector('.draft-offer')?.remove();
    context.source=source;context.serial='';changed();
    for(const select of context.form.querySelectorAll('[name="responsible-option"]'))select.closest('.actual-row').querySelector('[name="responsible-name"]').hidden=select.value!=='other';
    updateWeekday();updateActuals();feedback('Rascunho recuperado localmente, ainda não salvo no servidor. Revise os campos e salve para enviar.');
  }
  function comparison(form){
    if(!IASDPIAuth.allowed()||active?.form!==form||active.uid!==actor())throw Error('Edição indisponível para esta conta.');
    changed();return {uid:active.uid,version:active.version,baseline:JSON.parse(active.baseline),data:snapshot(form)};
  }
  async function preserveConflict(form,data,version,pendingDocument){
    const access=await IASDPIAuth.requireAccess(),context=active;
    if(context?.form!==form||context.uid!==access.user.id)throw Error('Edição indisponível para esta conta.');
    const copy=structuredClone(data);if(pendingDocument)copy.pendingDocument=structuredClone(pendingDocument);
    await persist({...context,key:context.key+':conflict:'+crypto.randomUUID(),version,data:copy,revision:crypto.randomUUID()},true);
  }
  function rebase(form,data){
    if(!IASDPIAuth.allowed()||active?.form!==form||active.uid!==actor())throw Error('Edição indisponível para esta conta.');
    applyData(active,data);feedback('Seleção reaplicada somente nesta edição. Revise e salve para gravar. O rascunho anterior foi preservado para consulta.');
  }
  function canLeave(){
    changed();if(!active?.dirty||active.leaving)return true;
    if(!confirm('Há alterações não salvas. Sair desta edição mantendo um rascunho local para recuperação? Nada será enviado ao servidor.'))return false;
    active.leaving=true;registrationDirty=false;return true;
  }
  function beforeRender(){changed();observer?.disconnect();active=null;}
  function beginSave(form){
    if(!forms.has(form.id))return null;
    changed();if(active?.form!==form)return null;
    return {context:active,key:active.key,revision:active.revision,uid:active.uid,source:active.source};
  }
  async function bind(form,program,context=active){
    if(context?.form!==form)return;
    const oldKey=context.key,revision=context.revision;
    context.version=program.version;context.id=program.id;context.key=draftKey(context.uid,context.kind,program.id);
    form.dataset.version=program.version;form.dataset.id=program.id;
    if(context.dirty)await persist(context);
    if(oldKey!==context.key&&revision)await enqueue(()=>remove(oldKey,revision));
  }
  async function saved(ticket,program){
    if(!ticket)return false;
    const context=ticket.context;
    await enqueue(async()=>{
      if(ticket.revision)await remove(ticket.key,ticket.revision);
      if(context.key!==ticket.key&&ticket.revision)await remove(context.key,ticket.revision);
      if(ticket.source)await remove(ticket.source.key,ticket.source.revision);
    });
    if(context.revision!==ticket.revision){
      await bind(context.form,program,context);return true;
    }
    context.version=program.version;context.dirty=false;context.baseline=context.serial;context.leaving=true;
    if(context.kind==='actuals-form')registrationDirty=false;
    await refreshNotice();return false;
  }
  async function discardCurrent(){
    changed();if(!active?.dirty)return true;
    if(!confirm('Descartar somente as alterações não salvas desta edição? O registro salvo não será alterado.'))return false;
    const context=active;observer?.disconnect();active=null;registrationDirty=false;
    await enqueue(async()=>{await remove(context.key,context.revision);if(context.source)await remove(context.source.key,context.source.revision);});
    await refreshNotice();return true;
  }
  async function clearUser(uid){
    if(!uid)return;suspend();
    await enqueue(async()=>{
      for(const row of memory.values())if(row.scope===scope&&row.uid===uid)memory.delete(row.key);
      keys.delete(group(uid));
      // Tentar também quando houve fallback em memória: pode haver uma cópia
      // persistida de antes da falha. Não afirmar limpeza se o navegador a negar.
      try{
        const db=await open();
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(['drafts','keys'],'readwrite'),store=tx.objectStore('drafts'),read=store.getAll();
          read.onsuccess=()=>{for(const row of read.result)if(row.scope===scope&&row.uid===uid)store.delete(row.key);};
          tx.objectStore('keys').delete(group(uid));
          tx.oncomplete=()=>{db.close();resolve();};
          tx.onabort=tx.onerror=()=>{db.close();reject(Error('Limpeza local indisponível.'));};
        });
      }catch(_){throw Error('Sessão encerrada, mas o navegador impediu a limpeza dos rascunhos cifrados. Em dispositivo compartilhado, limpe os dados deste site no navegador.');}
    });
  }
  async function confirmLogout(){
    changed();const uid=actor();if(!uid)return true;
    const list=await enqueue(()=>owned(uid));
    return !list.length&&!active?.dirty||confirm('Sair da conta removerá os rascunhos locais deste usuário neste site. Alterações ainda não enviadas serão descartadas. Salve no servidor antes de sair se quiser mantê-las. Continuar?');
  }
  document.addEventListener('input',event=>{if(forms.has(event.target.closest('form')?.id))changed();});
  document.addEventListener('change',event=>{if(forms.has(event.target.closest('form')?.id))changed();});
  window.addEventListener('iasdpi-auth-changed',()=>{if(!actor()||(active&&active.uid!==actor()))suspend();});
  window.addEventListener('beforeunload',event=>{changed();if(active?.dirty){event.preventDefault();event.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)changed();});
  return {mount,beforeRender,changed,canLeave,beginSave,bind,saved,discardCurrent,clearUser,confirmLogout,comparison,preserveConflict,rebase,capture:form=>{if(!IASDPIAuth.allowed()||!forms.has(form?.id))throw Error('Acesso necessário.');return snapshot(form);},flush:()=>queue};
})();

;
'use strict';
// Histórico da interface; autorização e dados continuam nos serviços existentes.
window.IASDPINavigation=(()=>{
  const pages=new Set(['home','programs','tracking','history','edit','summary','actuals','agendas','archive','organization','login','users','invite','plan-edit','trash','models','forgot-password','reset-password','schedule-setup','schedule-calendar','schedule-build','schedule-members','schedule-settings','access-admin','access-audit','access-request','controlled-reset','church-home','portal-login','events']);
  const records=new Set(['edit','summary','tracking','actuals','plan-edit']);
  let current=null,restoring=null;
  function parse(){
    captureInvite(location.hash.slice(1));
    const parts=location.hash.slice(1).split('/');let id;
    try{id=parts[1]?decodeURIComponent(parts[1]):null;}catch(_){return null;}
    return pages.has(parts[0])&&parts.length<=2?{page:parts[0],id:records.has(parts[0])?id:null}:null;
  }
  function route(page,id){return '#'+page+(records.has(page)&&id?'/'+encodeURIComponent(id):'');}
  function entry(){return window.history.state?.iasdpiNavigation;}
  function stamp(position,hash,scroll=0){window.history.replaceState({...window.history.state,iasdpiNavigation:{position,hash,scroll}},'',hash);}
  function choose(page,id){
    state.page=page;
    if(id)state.selected=id;
    else if(['actuals','edit','plan-edit','summary'].includes(page))state.selected=null;
    else if(page==='tracking'&&!selected())state.selected=state.programs.find(p=>p.status==='Em andamento')?.id||state.programs.find(p=>p.status==='Pronta')?.id||null;
  }
  function display(page,id,scroll=0){
    window.IASDPIConflicts?.close();choose(page,id);render();app.focus({preventScroll:true});window.scrollTo({top:scroll,behavior:'instant'});
    if(page==='users'&&IASDPIAuth.isAdmin()&&!usersState.loaded)void guarded(()=>refreshUsers());
    if(page==='trash'&&IASDPIAuth.isAdmin()&&trashState.rows===null)void guarded(()=>refreshTrash());
  }
  function start(){
    let parsed=parse()||{page:state.page,id:null};
    if(parsed.page==='login'&&IASDPIAuth.allowed())parsed={page:'home',id:null};
    choose(parsed.page,parsed.id);
    const hash=route(parsed.page,parsed.id),position=Number.isInteger(entry()?.position)?entry().position:current?.position||0;
    current={position,hash};restoring=null;stamp(position,hash,entry()?.scroll||0);
  }
  function navigate(page,id,{replace=false,refresh=false}={}){
    if(restoring)return false;
    if(!pages.has(page))return false;
    const recordId=id||(records.has(page)&&!['actuals','edit'].includes(page)?state.selected:null);
    const hash=route(page,recordId);
    if(current?.hash===hash&&!refresh){app.focus({preventScroll:true});return true;}
    if(!canLeaveRegistration())return false;
    if(!current)start();
    stamp(current.position,current.hash,window.scrollY);
    const replaceEntry=replace||current.hash===hash,position=replaceEntry?current.position:current.position+1;
    if(replaceEntry)stamp(position,hash);else window.history.pushState({iasdpiNavigation:{position,hash,scroll:0}},'',hash);
    current={position,hash};display(page,recordId);return true;
  }
  function identify(page,id){
    const hash=route(page,id),position=current?.position??entry()?.position??0;
    current={position,hash};stamp(position,hash,window.scrollY);
  }
  function traversed(){
    if(!current)return;
    const parsed=parse()||{page:IASDPIAuth.allowed()?'home':'organization',id:null};
    const hash=route(parsed.page,parsed.id),metadata=entry();
    if(restoring){
      if(metadata?.position===restoring.position&&hash===restoring.hash){restoring=null;return;}
      // Uma única travessia de retorno está em trânsito. Não enfileirar outro go.
      return;
    }
    if(hash===current.hash&&metadata?.position===current.position)return;
    const position=Number.isInteger(metadata?.position)?metadata.position:current.position+1;
    if(!canLeaveRegistration()){
      restoring={...current};
      const delta=current.position-position;
      if(delta)window.history.go(delta);else{stamp(current.position,current.hash,window.scrollY);restoring=null;}
      return;
    }
    current={position,hash};stamp(position,hash,metadata?.scroll||0);display(parsed.page,parsed.id,metadata?.scroll||0);
  }
  window.addEventListener('popstate',traversed);
  // Travessias e alterações de fragmento já disparam popstate. hashchange da
  // mesma travessia não representa outra intenção do usuário.
  document.querySelector('.skip-link')?.addEventListener('click',event=>{event.preventDefault();app.focus({preventScroll:true});app.scrollIntoView({block:'start'});});
  return {start,navigate,identify,pending:()=>Boolean(restoring)};
})();

;
'use strict';
// Compara controles por IDs estáveis. Reaplicar prepara uma edição; nunca grava.
window.IASDPIConflicts=(()=>{
  let current=null,dialog=null;
  const kinds=new Set(['actuals-form','program-form','notes-form']);
  const captions={'record-name':'Nome do culto','record-date':'Data do culto','record-info':'Informações complementares',note:'Observação',incident:'Ocorrência',name:'Nome da programação',date:'Data',start:'Início',end:'Término',activity:'Atividade',block:'Bloco',responsible:'Responsável',ready:'Marcar como pronta','extra-theme':'Tema da atividade extra','activity-note':'Observação da atividade','sub-title':'Título','sub-responsible':'Responsável','sub-note':'Observação','sub-start':'Início real','sub-end':'Término real',responsavel:'Responsável'};
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function groups(fields=[]){
    const result=new Map();
    for(const field of fields||[]){const key=['responsible-option','responsible-name'].includes(field.name)?'responsavel':field.name;if(!result.has(key))result.set(key,[]);result.get(key).push(field);}
    return result;
  }
  function semantic(fields){return fields?.map(f=>({name:f.name,value:f.value,checked:f.checked??null,precision:f.original===undefined?null:f.edited==='true'?'editado':f.reapplied||f.original}));}
  function text(fields){
    if(!fields)return 'Não existe nesta versão';
    if(fields.some(f=>f.name==='responsible-option')){const option=fields.find(f=>f.name==='responsible-option')?.value;return option==='other'?fields.find(f=>f.name==='responsible-name')?.value||'Em branco':option||'Em branco';}
    return fields.map(f=>f.checked!==undefined?(f.checked?'Sim':'Não'):(f.value||'Em branco')+(f.original&&f.edited!=='true'&&/\.\d+/.test(f.reapplied||f.original)?' (precisão original: '+(f.reapplied||f.original)+')':'')).join(' · ');
  }
  function describeRows(rows=[]){return rows.map(row=>text(row.fields)).join('\n');}
  function differences(baseline,mine,remote,kind,latest,blocked){
    const changes=[];
    function controls(base,local,saved,path,label){
      const old=groups(base),a=groups(local),b=groups(saved);
      for(const key of new Set([...a.keys(),...b.keys()])){
        const source=a.get(key),target=b.get(key);if(equal(semantic(source),semantic(target)))continue;
        const localChange=base===null||!equal(semantic(source),semantic(old.get(key)));
        changes.push({type:'fields',path,key,label:label+(key.startsWith('team-')?roles[Number(key.slice(5))]:captions[key]||key),mine:source,remote:target,local:localChange,enabled:!blocked&&localChange&&Boolean(source&&target),reason:!localChange?'Alterado somente no banco; será mantido.':!target?'Campo removido no banco; ajuste manual necessário.':blocked?'A programação prevista está protegida após o início.':''});
      }
    }
    function collection(base,local,saved,path,isChild=false){
      const old=new Map((base||[]).map(r=>[r.id,r])),a=new Map(local.map(r=>[r.id,r])),b=new Map(saved.map(r=>[r.id,r]));
      const title=row=>row?.fields?.find(f=>['activity','extra-theme','sub-title'].includes(f.name))?.value||latest.plan.items.find(i=>i.id===row?.id)?.activity||row?.id||'Sem título';
      for(const id of new Set([...a.keys(),...b.keys()])){
        const source=a.get(id),target=b.get(id),previous=old.get(id),index=local.findIndex(r=>r.id===id)+1;
        const label=(isChild?'Subatividade ':'Atividade ')+(index||saved.findIndex(r=>r.id===id)+1)+': '+title(source||target)+' / ';
        if(source&&target){
          controls(previous?.fields??(baseline===null?null:[]),source.fields,target.fields,[...path,id],label);
          if(!isChild)collection(previous?.children??(baseline===null?null:[]),source.children||[],target.children||[],[...path,id,'children'],true);
        }else{
          const addition=Boolean(source&&!previous),removal=Boolean(!source&&previous),allowed=isChild||kind==='program-form'||(source||previous)?.extra;
          changes.push({type:addition?'add':removal?'remove':'unavailable',path,id,label:label+(addition?'Adicionar':removal?'Excluir':'Removida ou adicionada no banco'),mine:source,remote:target,local:addition||removal,enabled:!blocked&&allowed&&(addition||removal),reason:blocked?'A programação prevista está protegida após o início.':!addition&&!removal?'Estrutura alterada no banco; será preservada.':!allowed?'Atividades previstas só podem mudar na edição da programação.':''});
        }
      }
      const ordered=rows=>(rows||[]).map(r=>r.id).filter(id=>a.has(id)&&b.has(id));
      if(base&& !equal(ordered(base),ordered(local)))changes.push({type:'order',path,label:'Ordem das atividades / subatividades',mine:local,remote:saved,local:true,enabled:false,reason:'Reordene manualmente após comparar; a ordem recente não será substituída.'});
    }
    controls(baseline?.fields??null,mine.fields,remote.fields,[],'');
    collection(baseline?.rows??null,mine.rows,remote.rows,[]);
    return changes;
  }
  function snapshotFor(program,kind){
    const protectedPlan=kind==='program-form'&&!['Planejamento','Pronta'].includes(program.status);
    const template=document.createElement('template');
    template.innerHTML=kind==='actuals-form'?actualsForm(program):kind==='notes-form'?notes(program):editor(protectedPlan?{...program,status:'Planejamento'}:program,true);
    const form=template.content.querySelector('#'+kind);if(!form)throw Error('O tipo de registro mudou; reabra a programação para editar.');
    return {data:IASDPIDrafts.capture(form),blocked:protectedPlan||kind==='actuals-form'&&program.execution_mode!=='manual'};
  }
  function ensureDialog(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.dataset.conflictDialog='true';dialog.className='conflict-dialog';dialog.setAttribute('aria-labelledby','conflict-title');document.body.append(dialog);
    dialog.addEventListener('close',()=>{if(dialog.open)return;const target=current?.form;current=null;dialog.replaceChildren();if(document.activeElement===document.body&&target?.isConnected)target.querySelector('button[type="submit"]')?.focus();});
  }
  function run(task,button){return guarded(async()=>{try{await task();}catch(error){const target=dialog?.querySelector('.conflict-feedback');if(dialog?.open&&target){target.setAttribute('role','alert');target.textContent=error.message;}throw error;}},button);}
  function draw(notice=''){
    const review=current;if(!review)return;
    const value=change=>change.type==='fields'?text(change.mine):change.mine?describeRows(Array.isArray(change.mine)?change.mine:[change.mine]):'Removida nesta edição';
    const saved=change=>change.type==='fields'?text(change.remote):change.remote?describeRows(Array.isArray(change.remote)?change.remote:[change.remote]):'Não existe nesta versão';
    dialog.innerHTML=`<h2 id="conflict-title">Comparar versões do registro</h2><p><strong>Banco: versão ${review.latest.version}</strong> · Sua edição: versão ${review.version}. ${esc(review.latest.plan.name)}</p><p>Nada será gravado nesta janela. Selecione somente as alterações que deseja reaplicar, confirme e depois revise e salve o formulário. Campos não selecionados manterão a versão do banco. A cópia local anterior será preservada como rascunho protegido.</p>${review.baseline===null?'<p class="form-note">Rascunho antigo: não há uma base confiável para identificar quais campos foram alterados originalmente. Revise cada diferença; nenhuma seleção é automática.</p>':''}${notice?`<p role="alert" class="form-error">${esc(notice)}</p>`:''}${review.blocked?'<p class="form-error" role="status">A programação prevista está protegida após o início. As diferenças são apenas para consulta.</p>':''}
      <p id="conflict-scroll-hint" class="muted">Se as colunas não couberem, deslize a tabela na horizontal. Com teclado, foque a tabela e use as setas para consultar as duas versões.</p><div class="table-scroll" tabindex="0" role="region" aria-describedby="conflict-scroll-hint" aria-label="Diferenças entre sua edição e a versão salva no banco"><table><thead><tr><th>Reaplicar</th><th>Campo</th><th>Versão salva no banco</th><th>Sua edição local</th></tr></thead><tbody>${review.changes.map((change,index)=>`<tr><td><label class="conflict-choice"><input type="checkbox" data-conflict-choice="${index}" ${change.enabled?'':'disabled'} aria-label="Reaplicar ${esc(change.label)}"></label></td><th scope="row">${esc(change.label)}<small>${esc(change.reason)}</small></th><td><pre>${esc(saved(change))}</pre></td><td><pre>${esc(value(change))}</pre></td></tr>`).join('')}</tbody></table></div>${!review.changes.length?'<p role="status">Não há campos divergentes. Você pode carregar a versão atual para continuar.</p>':''}
      <p class="conflict-feedback" role="status" aria-live="polite">Nenhuma alteração selecionada.</p><div class="actions conflict-actions"><button type="button" data-conflict-close>Voltar à edição</button><button type="button" data-conflict-refresh>Atualizar comparação</button><button type="button" data-conflict-load>Usar versão atual do banco</button><button type="button" class="primary" data-conflict-apply disabled>Reaplicar seleção na edição</button></div>`;
    dialog.querySelectorAll('[data-conflict-choice]').forEach(input=>input.addEventListener('change',()=>{const count=dialog.querySelectorAll('[data-conflict-choice]:checked').length;dialog.querySelector('[data-conflict-apply]').disabled=!count;dialog.querySelector('.conflict-feedback').textContent=count?`${count} alterações selecionadas. Ainda não reaplicadas.`:'Nenhuma alteração selecionada.';}));
    dialog.querySelector('[data-conflict-close]').onclick=close;
    dialog.querySelector('[data-conflict-refresh]').onclick=event=>run(()=>refresh(review),event.currentTarget);
    dialog.querySelector('[data-conflict-apply]').onclick=event=>run(()=>apply(review,false),event.currentTarget);
    dialog.querySelector('[data-conflict-load]').onclick=event=>run(()=>apply(review,true),event.currentTarget);
  }
  async function load(form,error,source=null,notice=''){
    const access=await IASDPIAuth.requireAccess(),context=IASDPIDrafts.comparison(form),uid=source?.uid||context.uid;
    if(uid!==access.user.id)throw Error('A edição pertence a outra conta.');
    const id=form.dataset.id;if(!id)throw Error('O registro precisa existir para comparar versões.');
    const fingerprint=JSON.stringify(IASDPIDrafts.capture(form)),latest=await api('programs/'+encodeURIComponent(id));
    if(!form.isConnected||IASDPIAuth.session()?.user.id!==uid)throw Error('A edição ou a sessão mudou.');
    const reference=snapshotFor(latest,form.id);
    current={form,page:state.page,kind:form.id,id,uid,error,source,version:source?.version??context.version,baseline:source?null:context.baseline,mine:structuredClone(source?.data||context.data),fingerprint,latest,remote:reference.data,blocked:reference.blocked};
    current.changes=differences(current.baseline,current.mine,current.remote,current.kind,latest,current.blocked);
    ensureDialog();draw(notice);if(!dialog.open)dialog.showModal();dialog.querySelector('[data-conflict-close]').focus();
  }
  async function open(form,error){await load(form,error);}
  async function openDraft(form,source){await load(form,null,source);}
  async function refresh(review,notice='Comparação atualizada. Revise novamente as seleções.'){
    if(current!==review||!dialog.open)return;
    await load(review.form,review.error,review.source,notice);
  }
  function fieldsAt(snapshot,path){
    if(!path.length)return snapshot;
    const row=snapshot.rows.find(r=>r.id===path[0]);
    return path.length===1?row:row?.children?.find(c=>c.id===path[2]);
  }
  function collectionAt(snapshot,path){return !path.length?snapshot.rows:snapshot.rows.find(r=>r.id===path[0])?.children;}
  function copiedField(field){const copy=structuredClone(field);if(copy.original&&copy.edited!=='true'){const clock=recordClock(copy.reapplied||copy.original);if(validRecordClock(clock))copy.reapplied=clock;}return copy;}
  function copiedRow(row){return {...structuredClone(row),fields:row.fields.map(copiedField),children:(row.children||[]).map(copiedRow)};}
  function patch(snapshot,change){
    if(change.type==='fields'){
      const target=fieldsAt(snapshot,change.path);if(!target)throw Error('A estrutura mudou; reabra a comparação.');
      for(const field of change.mine){
        const copy=copiedField(field);
        const index=target.fields.findIndex(f=>f.name===copy.name);if(index>=0)target.fields[index]=copy;
      }
    }else if(change.type==='add'||change.type==='remove'){
      const target=collectionAt(snapshot,change.path);if(!target)throw Error('A atividade principal foi removida.');
      if(change.type==='add'){if(target.some(r=>r.id===change.id))throw Error('Identificador já existente.');target.push(copiedRow(change.mine));}
      else{const index=target.findIndex(r=>r.id===change.id);if(index>=0)target.splice(index,1);}
    }
  }
  async function apply(review,remoteOnly){
    if(current!==review||!dialog.open)throw Error('Comparação encerrada.');
    const selected=remoteOnly?[]:[...dialog.querySelectorAll('[data-conflict-choice]:checked')].map(input=>review.changes[Number(input.dataset.conflictChoice)]);
    if(!remoteOnly&&(!selected.length||selected.some(c=>!c.enabled)))throw Error('Selecione alterações válidas.');
    if(!confirm(remoteOnly?'Carregar a versão atual sem reaplicar alterações? Sua cópia local será preservada para consulta. Nada será gravado no banco.':`Reaplicar ${selected.length} alterações selecionadas sobre a versão ${review.latest.version}? As demais informações do banco serão mantidas. Você ainda deverá revisar e salvar.`))return;
    const access=await IASDPIAuth.requireAccess();if(access.user.id!==review.uid)throw Error('A conta mudou.');
    if(!review.form.isConnected||JSON.stringify(IASDPIDrafts.capture(review.form))!==review.fingerprint)throw Error('A edição local mudou. Atualize a comparação antes de reaplicar.');
    const latest=await api('programs/'+encodeURIComponent(review.id));
    if(latest.version!==review.latest.version){await refresh(review,'O banco mudou novamente. Nenhuma seleção foi reaplicada. Revise a nova versão.');return;}
    const data=structuredClone(review.remote);for(const change of selected)patch(data,change);
    await IASDPIDrafts.preserveConflict(review.form,review.mine,review.version,review.error?.conflict?.document);
    if(review.error?.conflict&&window.IASDPIOperational)await IASDPIOperational.releaseConflict(review.error.conflict,latest.version);
    if(current!==review||!dialog.open||IASDPIAuth.session()?.user.id!==review.uid||!IASDPIAuth.allowed())throw Error('A comparação ou sessão foi encerrada.');
    state.page=review.kind==='actuals-form'?(latest.execution_mode==='manual'?'actuals':'tracking'):review.kind==='program-form'?'plan-edit':review.page;
    replaceProgram(latest);IASDPINavigation.identify(state.page,latest.id);render();
    const form=document.querySelector('#'+review.kind);if(!form){if(remoteOnly){close();app.focus({preventScroll:true});toast('Versão atual carregada para consulta. Nenhuma gravação foi realizada.');return;}throw Error('A programação mudou de estado; reabra o registro.');}
    if(!remoteOnly){IASDPIDrafts.rebase(form,data);if(review.kind==='actuals-form')setRegistrationSaveState(form,'dirty','Seleção reaplicada nesta edição · ainda não salva.');}
    close();form.querySelector('input,textarea,select')?.focus();toast(remoteOnly?'Versão atual carregada. Nenhuma gravação foi realizada.':'Seleção reaplicada somente na edição. Revise e clique em Salvar.');
  }
  function close(){if(dialog?.open)dialog.close();}
  window.addEventListener('iasdpi-auth-changed',()=>{if(current&&(!IASDPIAuth.allowed()||IASDPIAuth.session()?.user.id!==current.uid))close();});
  return {open,openDraft,close};
})();

;
'use strict';
// Apenas consulta: os mesmos registros e cálculos dos Lotes 1–4.
window.IASDPIHistory=(()=>{
  let owner=null,filters={query:'',from:'',to:''},timer=null;
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
  function filter(programs,values=filters){
    const from=values.from?recordDay(values.from):'',to=values.to?recordDay(values.to):'',query=normalize(values.query);
    const error=values.from&&!from?{field:'history-from',message:'Informe uma data inicial válida em dd/mm/aaaa.'}:values.to&&!to?{field:'history-to',message:'Informe uma data final válida em dd/mm/aaaa.'}:from&&to&&from>to?{field:'history-to',message:'A data final não pode ser anterior à inicial.'}:null;
    const all=programs.filter(p=>p.status==='Finalizada');
    if(error)return {error,all,rows:[],excluded:all.length};
    const rows=all.filter(p=>{const day=recordDay(p.plan.date);return (!from||day&&day>=from)&&(!to||day&&day<=to)&&(!query||normalize(p.plan.name).includes(query)||normalize(displayDate(p.plan.date)).includes(query)||String(p.plan.date||'').includes(query));}).sort((a,b)=>String(b.plan.date||'').localeCompare(String(a.plan.date||'')));
    return {error:null,all,rows,excluded:all.length-rows.length,from,to};
  }
  function results(){
    const result=filter(state.programs);
    if(result.error)return `<p role="alert" class="form-error">${esc(result.error.message)} Os indicadores não foram calculados com filtros inválidos.</p>`;
    const {rows,all,excluded,from,to}=result,days=rows.map(p=>recordDay(p.plan.date)).filter(Boolean).sort();
    const period=from||to?`${from?displayDate(from):'Sem limite inicial'} a ${to?displayDate(to):'sem limite final'}`:days.length?`${displayDate(days[0])} a ${displayDate(days.at(-1))}`:'Todos os períodos';
    const ends=endStatistics(rows),badDates=all.filter(p=>!recordDay(p.plan.date)).length;
    const info=`<p class="history-context" role="status" aria-live="polite">Período analisado: <strong>${esc(period)}</strong>. ${rows.length} de ${all.length} cultos finalizados neste recorte; ${excluded} fora dos filtros. Indicadores de término: ${ends.considered} considerados e ${ends.excluded} desconsiderados por dados insuficientes ou inválidos.${badDates?` ${badDates} cultos com data inconsistente${from||to?', excluídos do filtro por período':''}.`:''}</p>`;
    if(!rows.length)return info+empty(all.length?'Nenhum culto corresponde aos filtros':'Ainda não há programações finalizadas',all.length?'Revise a pesquisa ou use Limpar filtros.':'Os registros aparecerão aqui após a finalização.');
    return info+adherenceOverview(rows)+programTable(rows,true);
  }
  function page(){
    const uid=IASDPIAuth.session()?.user.id;if(owner!==uid){owner=uid;filters={query:'',from:'',to:''};}
    return heading('MEMÓRIA','Histórico','Pesquise cultos finalizados e analise os indicadores do período selecionado.')+
      `<form id="history-filters" class="panel"><div class="history-filters-grid"><label>Pesquisar por nome ou data<input type="search" name="history-query" value="${esc(filters.query)}" maxlength="200" placeholder="Ex.: sábado ou 10/10/2026" autocomplete="off"></label>${field('De','history-from',filters.from,'text',false,'data-date-input placeholder="dd/mm/aaaa" inputmode="numeric"')}${field('Até','history-to',filters.to,'text',false,'data-date-input placeholder="dd/mm/aaaa" inputmode="numeric"')}</div><div class="actions"><button type="submit" class="primary">Aplicar filtros</button><button type="button" data-action="history-clear">Limpar filtros</button></div><p class="muted">A pesquisa por nome ou data é combinada com o período. Os limites de data são inclusivos.</p></form><section id="history-results" aria-label="Resultados do Histórico">${results()}</section>`;
  }
  function apply(form=document.querySelector('#history-filters')){
    clearTimeout(timer);if(!form?.isConnected)return;
    filters={query:form.elements['history-query'].value,from:form.elements['history-from'].value.trim(),to:form.elements['history-to'].value.trim()};
    form.querySelectorAll('[aria-invalid="true"]').forEach(clearFieldError);
    const result=filter(state.programs),target=document.querySelector('#history-results');
    if(target)target.innerHTML=results();
    if(result.error)fieldError(form.elements[result.error.field],result.error.message);else pageLayout.mount();
  }
  function input(input){
    if(input.closest('form')?.id!=='history-filters')return;
    clearTimeout(timer);const form=input.form;timer=setTimeout(()=>apply(form),180);
  }
  function clear(){
    clearTimeout(timer);filters={query:'',from:'',to:''};
    const form=document.querySelector('#history-filters');if(!form)return;
    for(const input of form.querySelectorAll('input')){input.value='';clearFieldError(input);}
    apply(form);form.elements['history-query'].focus();
  }
  return {page,apply,input,clear,filter};
})();

;
'use strict';
// Fase A: cadastros. Escalas legadas e calendário oficial mantêm fontes próprias.
window.IASDPISchedules=(()=>{
  const model={status:'idle',catalog:null,error:'',tab:window.IASDPIConfig?.portalAccessEnabled?'departments':'people',query:'',department:'',editor:null,dirty:false,saving:false,feedback:'',generation:0};
  const tables={department:'departments',person:'people',role:'roles',membership:'memberships',availability:'availability',access:'access'};
  const titles={department:'Departamento',person:'Pessoa',role:'Função',membership:'Vínculo e habilitações',availability:'Disponibilidade',access:'Permissão ministerial'};
  const weekdays=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const suggestions={sonoplastia:['Operador de áudio','Projeção/multimídia','Apoio técnico'],diaconato:['Diácono','Diaconisa','Recepção ou apoio'],musica:['Direção musical','Instrumentista','Vocalista','Equipe de louvor'],ancionato:['Ancião responsável pelo culto','Ancião da semana','Ancião do mês']};
  const references={sonoplastia:'Luan',diaconato:'Diáconos: Marciano · Diaconisas: Rose',musica:'Alexandre',ancionato:'Consulte os anciãos no organograma; funções a confirmar.'};
  const h=value=>esc(value),find=(entity,id)=>model.catalog?.[tables[entity]]?.find(r=>r.id===id);
  function button(label,action,id='',extra=''){return `<button type="button" data-schedule-action="${action}" data-id="${h(id)}" ${extra}>${h(label)}</button>`;}
  async function rpc(name,body={}){
    if(window.IASDPISchedulePreview)return IASDPISchedulePreview.request(name,body);
    const {token}=await IASDPIAuth.requireIdentity();
    const result=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!IASDPIAuth.identityCurrent(token))throw Error('Sessão alterada. Recarregue antes de continuar.');
    return result;
  }
  function redraw(){if(state.page==='schedule-setup')render();lockRelations();}
  function lockRelations(){if(!model.editor?.version)return;for(const name of ['department_id','person_id','user_id']){const field=document.querySelector('#schedule-editor [name="'+name+'"]');if(field&&model.editor.entity!=='person')field.disabled=true;}}
  async function load(){
    const ticket=++model.generation;model.status='loading';model.error='';redraw();
    try{
      const data=await rpc('iasdpi_schedule_catalog');
      if(ticket!==model.generation)return;
      if(!data||!data.actor_id||typeof data.is_admin!=='boolean'||Object.values(tables).some(k=>!Array.isArray(data[k])))throw Error('Resposta de cadastros inválida.');
      model.catalog=data;model.status='ready';if(!window.IASDPISchedulePreview&&!IASDPIAuth.allowed())IASDPIAuth.scopeValidated();redraw();
    }catch(e){if(ticket!==model.generation)return;model.status='error';model.error=e.message;model.catalog=null;redraw();}
  }
  function canLeave(){
    if(model.saving){window.alert('Aguarde a confirmação do salvamento.');return false;}
    if(!model.dirty)return true;
    if(!window.confirm('Descartar somente as alterações ainda não salvas deste cadastro?'))return false;
    model.editor=null;model.dirty=false;return true;
  }
  function deptOptions(selected,managed=false,blank=false){return (blank?'<option value="">Todos / geral</option>':'')+(model.catalog?.departments||[]).filter(d=>!managed||(d.can_manage_members??d.can_manage)).map(d=>`<option value="${h(d.id)}" ${d.id===selected?'selected':''}>${h(d.name)}${d.active?'':' (inativo)'}</option>`).join('');}
  function personName(id){return model.catalog?.people.find(p=>p.id===id)?.display_name||'Pessoa indisponível';}
  function deptName(id){return model.catalog?.departments.find(d=>d.id===id)?.name||'Geral';}
  const check=(label,name,value)=>`<label class="checkbox"><input type="checkbox" name="${name}" ${value?'checked':''}> ${h(label)}</label>`;
  function input(label,name,value='',type='text',attrs=''){return `<label>${h(label)}<input name="${name}" type="${type}" value="${h(value??'')}" ${attrs}></label>`;}
  function select(label,name,options){return `<label>${h(label)}<select name="${name}">${options}</select></label>`;}
  const text=(label,name,value='')=>`<label>${h(label)}<textarea name="${name}" rows="2">${h(value)}</textarea></label>`;
  const formatDay=day=>day?displayDate(day):'Sem limite';
  function page(){
    const title=heading('ESCALAS · FUNDAÇÃO','Cadastros de escalas',model.catalog?.availability_enabled===false?'Organize pessoas, departamentos e vínculos. Disponibilidade temporariamente desativada.':'Organize pessoas, departamentos, funções e disponibilidades. Pessoas e funções são reutilizadas na montagem manual das escalas.');
    if(model.status==='idle'){queueMicrotask(load);return title+'<p role="status">Recuperando acesso aos cadastros…</p>';}
    const preview=!window.IASDPIScheduleUI?.isReview()&&window.IASDPISchedulePreview?'<p class="demo-banner">Prévia com dados fictícios. Alterações apenas em memória; não grava no Supabase e reinicia ao recarregar.</p>':'';
    if(model.status==='loading')return title+preview+'<p role="status">Carregando cadastros e permissões…</p>';
    if(model.status==='error')return title+preview+`<section class="panel"><p role="alert" class="form-error">${h(model.error)}</p><p>Se a migração 005 ainda não foi instalada, solicite sua revisão e ativação. Não há substituição por dados locais.</p>${button('Tentar novamente','refresh')}<form id="schedule-login" class="schedule-grid"><h2>Entrar nos cadastros</h2>${window.IASDPIAuth?.loginIdentifierField?IASDPIAuth.loginIdentifierField():input('E-mail','email','','email','required autocomplete="username"')}${input('Senha','password','','password','required autocomplete="current-password"')}<button class="primary" type="submit">Entrar</button><p class="schedule-feedback" role="status"></p></form><p><a href="#forgot-password">Esqueci minha senha</a></p></section>`;
    const c=model.catalog,manage=c.is_admin||c.departments.some(d=>(d.can_manage_members??d.can_manage));
    if(c.availability_enabled===false&&model.tab==='availability')model.tab='people';
    const tabs=[['people','Pessoas'],['departments','Departamentos'],['roles','Funções'],['memberships','Vínculos'],['availability','Disponibilidade'],...(c.is_admin&&!window.IASDPIConfig?.isolatedPilot&&!window.IASDPIGovernance?.enabled()?[['access','Permissões']]:[]),['sources','Fontes atuais']].filter(([key])=>key!=='availability'||c.availability_enabled!==false);
    return title+preview+`<div class="schedule-toolbar"><p>${c.is_admin?'Administrador':manage?'Gestão ministerial autorizada':'Consulta autorizada'} · ${button('Atualizar','refresh')}${button('Sair','logout')}</p><p role="status" class="schedule-feedback">${h(model.feedback)}</p></div>
    <nav class="schedule-tabs" aria-label="Cadastros de escalas">${tabs.map(([key,label])=>button(label,'tab',key,model.tab===key?'aria-current="page"':'')).join('')}</nav>
    ${window.IASDPIGovernance?.enabled()?'<p><a href="#access-admin" data-page="access-admin">Gestão de acessos por departamento</a></p>':''}${model.editor?editor():''}
    ${model.tab==='sources'?sources():`<section class="panel"><div class="schedule-toolbar"><h2>${h(tabs.find(t=>t[0]===model.tab)?.[1]||'Pessoas')}</h2>${canCreate(model.tab)?button('Cadastrar '+({people:'pessoa',departments:'departamento',roles:'função',memberships:'vínculo',availability:'disponibilidade',access:'permissão'}[model.tab]),'create',Object.keys(tables).find(k=>tables[k]===model.tab),'class="primary"'):''}</div>
    <form id="schedule-search" class="schedule-grid">${input('Pesquisar nome, pessoa ou departamento','query',model.query,'search')}${select('Departamento','filter',deptOptions(model.department,false,true))}<button type="submit">Pesquisar</button>${button('Limpar filtros','clear')}</form>
    ${list()}</section>`}`;
  }
  function canCreate(tab){if(tab==='availability'&&model.catalog.availability_enabled===false)return false;return model.catalog.is_admin||(['people','roles','memberships','availability'].includes(tab)&&model.catalog.departments.some(d=>(d.can_manage_members??d.can_manage)));}
  function rowCanEdit(entity,r){if(entity==='availability'&&model.catalog.availability_enabled===false)return false;return model.catalog.is_admin||(entity!=='person'&&entity!=='department'&&entity!=='access'&&model.catalog.departments.some(d=>d.id===r.department_id&&(d.can_manage_members??d.can_manage)));}
  function list(){
    const entity=Object.keys(tables).find(k=>tables[k]===model.tab),q=model.query.toLocaleLowerCase('pt-BR');
    const rows=model.catalog[model.tab].filter(r=>{
      const deps=r.department_id?[r.department_id]:model.tab==='departments'?[r.id]:model.catalog.memberships.filter(m=>m.person_id===r.id).map(m=>m.department_id);
      return (!model.department||deps.includes(model.department))&&[r.name,r.display_name,r.person_id?personName(r.person_id):'',...deps.map(deptName)].join(' ').toLocaleLowerCase('pt-BR').includes(q);
    });
    if(!rows.length)return '<p class="empty">Nenhum cadastro encontrado com estes filtros.</p>';
    return `<ul class="schedule-list">${rows.map(r=>{
      const label=entity==='availability'?`${personName(r.person_id)} · ${r.kind==='available'?'Disponível':'Indisponível'}`:entity==='membership'?personName(r.person_id):entity==='access'?`${r.user_id} · ${r.access_level==='manager'?'Gestor':'Visualizador'}`:r.display_name||r.name;
      let detail=deptName(r.department_id);
      if(entity==='department'){const heads=model.catalog.memberships.filter(m=>m.department_id===r.id&&m.active&&m.is_ministry_head).map(m=>personName(m.person_id));detail=heads.length?'Responsáveis cadastrados: '+heads.join(', '):references[r.code]?'Referência no organograma: '+references[r.code]+' · Vínculos ministeriais a confirmar.':'Sem responsável ministerial cadastrado.';}
      if(entity==='person')detail=model.catalog.memberships.filter(m=>m.person_id===r.id).map(m=>deptName(m.department_id)+(m.is_ministry_head?' · Responsável ministerial':'')+(m.active?'':' (vínculo inativo)')).join(' · ')||'Sem departamento';
      if(entity==='membership')detail+=' · '+(model.catalog.qualifications.filter(q=>q.membership_id===r.id).map(q=>model.catalog.roles.find(role=>role.id===q.role_id)?.name).filter(Boolean).join(', ')||'Funções a confirmar');
      if(entity==='availability')detail+=` · ${r.pattern==='weekly'?(r.weekdays||[]).map(d=>weekdays[d]).join(', '):formatDay(r.starts_on)+' a '+formatDay(r.ends_on)} · ${r.start_time?r.start_time.slice(0,5)+'–'+r.end_time.slice(0,5):'Dia inteiro'}${r.pattern==='weekly'?' · Vigência: '+formatDay(r.valid_from)+' a '+formatDay(r.valid_until):''}`;
      return `<li><div><strong>${h(label)}</strong><small>${h(detail)}</small><small>${r.active===false||r.enabled===false?'Inativo':'Ativo'} · versão ${r.version}</small></div>${rowCanEdit(entity,r)?button('Editar','edit',entity+':'+r.id,'aria-label="Editar '+h(label)+'"'):''}</li>`;
    }).join('')}</ul>`;
  }
  function sources(){
    const sound=ministrySchedules.Sonoplastia,communication=ministrySchedules.Comunicação;
    return `<section class="panel"><h2>Fontes preservadas</h2><p>As escalas antigas continuam na Agenda. Esta consulta não importa nem altera pessoas ou escalas.</p><ul><li>Sonoplastia: escala manual da liderança · ${sound.length} registros de outubro/início de novembro de 2026.</li><li>Comunicação: escala manual · ${communication.length} registros.</li><li>Anciãos: calendário oficial, fonte independente. <a href="#agendas">Consultar a Agenda</a>.</li></ul><p>Rafa e Raphael são identidades diferentes até confirmação explícita. Não há fusão por semelhança.</p><div class="table-scroll"><table><caption>Prévia das escalas manuais, sem importação</caption><thead><tr><th>Data</th><th>Departamento</th><th>Pessoa informada</th></tr></thead><tbody>${[['Sonoplastia',sound],['Comunicação',communication]].flatMap(([dep,rows])=>rows.map(r=>`<tr><td>${h(displayDate(r.date))}</td><td>${h(dep)}</td><td>${h(r.person)}</td></tr>`)).join('')}</tbody></table></div><p>A importação idempotente de atribuições será proposta na Fase B, com confirmação de identidades e prévia de alterações.</p></section>`;
  }
  async function openEditor(entity,id){
    if(!canLeave())return;
    const row=id?find(entity,id):null,c=model.catalog;
    if(id&&(!row||!rowCanEdit(entity,row)))throw Error('Sem permissão para editar este cadastro.');
    const initial=structuredClone(row||{active:true,enabled:true,department_id:c.departments.find(d=>(d.can_manage_members??d.can_manage))?.id||'',kind:'unavailable',pattern:'period',access_level:'viewer'});
    if(entity==='person'&&id&&c.is_admin)Object.assign(initial,await rpc('iasdpi_schedule_person_details',{p_id:id}));
    if(entity==='membership')initial.role_ids=c.qualifications.filter(q=>q.membership_id===id).map(q=>q.role_id);
    model.editor={entity,id:id||crypto.randomUUID(),version:row?.version||0,values:initial,request:crypto.randomUUID()};model.dirty=false;model.feedback='';redraw();document.querySelector('#schedule-editor input, #schedule-editor select')?.focus();
  }
  function editor(){
    const e=model.editor,v=e.values,a=model.catalog.is_admin,selected=(value,key)=>value===key?'selected':'';
    const dep=select('Departamento','department_id',deptOptions(v.department_id,true,e.entity==='availability'&&a));
    const person=select('Pessoa','person_id',model.catalog.people.map(p=>`<option value="${h(p.id)}" ${selected(p.id,v.person_id)}>${h(p.display_name)}${p.active?'':' (inativa)'}</option>`).join(''));
    const accountLookup=a?`<div class="schedule-account-lookup">${input('Buscar conta pelo e-mail exato (opcional)','lookup_email','','email')}${button('Buscar conta existente','lookup-account')}<p class="schedule-lookup-result" role="status"></p></div>`:'';
    let fields='';
    if(e.entity==='department')fields=input('Nome do departamento','name',v.name,'text','required maxlength="120"')+input('Código único (ex.: sonoplastia)','code',v.code,'text','required pattern="[a-z][a-z0-9-]{1,59}"');
    if(e.entity==='person')fields=input('Nome completo','name',v.name,'text','required maxlength="160"')+input('Nome de exibição','display_name',v.display_name,'text','required maxlength="160"')+(!e.version?dep:'')+(a?`${accountLookup}${input('Conta Supabase opcional (UUID)','auth_user_id',v.auth_user_id,'text','pattern="[0-9a-fA-F-]{36}"')}${input('Contato privado — somente admin','contact',v.contact,'text','maxlength="1000"')}${text('Observações privadas — somente admin','notes',v.notes)}${check('Confirmo que é outra pessoa com o mesmo nome','confirm_homonym',v.confirm_homonym)}${input('Justificativa do homônimo (se confirmado)','reason',v.reason,'text','maxlength="1000"')}`:'<p>A identidade compartilhada será administrada centralmente. Pessoas não precisam ter login.</p>');
    if(e.entity==='role'){
      const code=model.catalog.departments.find(d=>d.id===v.department_id)?.code;
      fields=dep+input('Nome da função','name',v.name,'text','required maxlength="120" list="schedule-role-examples"')+`<datalist id="schedule-role-examples">${(suggestions[code]||[]).map(n=>`<option value="${h(n)}"></option>`).join('')}</datalist><p>Exemplos opcionais; confirme as práticas locais antes de cadastrar.</p>`+text('Descrição','description',v.description)+input('Quantidade de referência (opcional)','default_required_count',v.default_required_count,'number','min="0" max="100"');
    }
    if(e.entity==='membership')fields=person+dep+check('Responsável ministerial — não concede acesso ao site','is_ministry_head',v.is_ministry_head)+`<fieldset><legend>Funções que esta pessoa pode exercer</legend>${model.catalog.roles.filter(r=>r.department_id===v.department_id).map(r=>check(r.name,'role:'+r.id,(v.role_ids||[]).includes(r.id))).join('')||'<p>Cadastre as funções confirmadas deste departamento primeiro.</p>'}</fieldset>`+input('Participações mensais desejadas (opcional)','desired_monthly_count',v.desired_monthly_count,'number','min="0" max="100"')+input('Limite mensal (opcional)','max_monthly_count',v.max_monthly_count,'number','min="0" max="100"')+input('Limite de participações consecutivas (opcional)','max_consecutive',v.max_consecutive,'number','min="1" max="100"')+text('Preferências de participação','preferences',v.preferences);
    if(e.entity==='availability')fields=person+dep+select('Tipo','kind',`<option value="unavailable" ${selected(v.kind,'unavailable')}>Indisponível</option><option value="available" ${selected(v.kind,'available')}>Disponível / preferência</option>`)+select('Repetição','pattern',`<option value="period" ${selected(v.pattern,'period')}>Data ou período</option><option value="weekly" ${selected(v.pattern,'weekly')}>Semanal</option>`)+(v.pattern==='weekly'?`<fieldset><legend>Dias da semana</legend>${weekdays.map((d,i)=>check(d,'weekday:'+i,(v.weekdays||[]).includes(i))).join('')}</fieldset>${input('Válida a partir de (opcional)','valid_from',v.valid_from?displayDate(v.valid_from):'')}${input('Válida até (opcional)','valid_until',v.valid_until?displayDate(v.valid_until):'')}`:input('Data inicial','starts_on',v.starts_on?displayDate(v.starts_on):'')+input('Data final','ends_on',v.ends_on?displayDate(v.ends_on):''))+input('Hora inicial — HH:mm (opcional)','start_time',v.start_time?.slice(0,5),'text','inputmode="numeric" placeholder="09:30" pattern="([01][0-9]|2[0-3]):[0-5][0-9]"')+input('Hora final — HH:mm (opcional)','end_time',v.end_time?.slice(0,5),'text','inputmode="numeric" placeholder="11:30" pattern="([01][0-9]|2[0-3]):[0-5][0-9]"')+'<p>Datas: dd/mm/aaaa. Horas locais de America/Sao_Paulo. Deixe ambas as horas vazias para dia inteiro. Disponibilidade cadastrada ainda não é uma escala.</p>';
    if(e.entity==='access')fields=accountLookup+dep+input('UUID da conta existente e confirmada','user_id',v.user_id,'text','required pattern="[0-9a-fA-F-]{36}"')+select('Permissão no departamento','access_level',`<option value="viewer" ${selected(v.access_level,'viewer')}>Visualizador</option><option value="manager" ${selected(v.access_level,'manager')}>Gestor ministerial</option>`)+check('Acesso ministerial ativo','enabled',v.enabled)+'<p>Consulte o UUID em Administração → Usuários ou Supabase Auth. Isso não concede o perfil global leader/admin. Não existe cadastro ou promoção automática.</p>';
    return `<section class="panel schedule-editor-panel" aria-labelledby="schedule-editor-title"><h2 id="schedule-editor-title">${e.version?'Editar':'Cadastrar'} ${h(titles[e.entity])}</h2><form id="schedule-editor" class="schedule-grid">${fields}${e.version&&['role','membership','availability','access'].includes(e.entity)?'<p>O vínculo não pode ser transferido. Para outra pessoa ou departamento, inative este cadastro e crie outro.</p>':''}<p class="schedule-similar" role="status"></p>${e.entity!=='access'?check('Cadastro ativo','active',v.active):''}<div class="actions"><button type="submit" class="primary" ${model.saving?'disabled':''}>${model.saving?'Salvando…':'Salvar cadastro'}</button>${button('Cancelar','cancel','',''+(model.saving?'disabled':''))}</div><p class="schedule-feedback" role="status" aria-live="polite">${model.saving?'Aguardando confirmação do Supabase…':model.dirty?'Alterações pendentes, ainda não salvas.':''}</p><p class="schedule-error" role="alert">${h(e.error||'')}</p></form></section>`;
  }
  function capture(form){
    const v=model.editor.values;
    for(const el of form.elements){if(!el.name||el.name==='lookup_email')continue;if(el.name.startsWith('role:')||el.name.startsWith('weekday:'))continue;v[el.name]=el.type==='checkbox'?el.checked:el.value;}
    v.role_ids=Array.from(form.querySelectorAll('[name^="role:"]:checked')).map(el=>el.name.slice(5));
    v.weekdays=Array.from(form.querySelectorAll('[name^="weekday:"]:checked')).map(el=>Number(el.name.slice(8)));
  }
  function payload(){
    const e=model.editor,v=e.values,p={};
    const sets={department:['name','code','active'],person:['name','display_name','active'],role:['department_id','name','description','default_required_count','active'],membership:['person_id','department_id','active','is_ministry_head','desired_monthly_count','max_monthly_count','max_consecutive','preferences','role_ids'],availability:['person_id','department_id','kind','pattern','active','start_time','end_time'],access:['department_id','user_id','access_level','enabled']};
    for(const k of sets[e.entity])if(v[k]!==undefined)p[k]=v[k];
    for(const k of ['default_required_count','desired_monthly_count','max_monthly_count','max_consecutive'])if(k in p)p[k]=p[k]===''||p[k]===null?null:Number(p[k]);
    if(e.entity==='person'){
      if(!e.version)p.department_id=v.department_id||null;
      if(model.catalog.is_admin){p.auth_user_id=v.auth_user_id||null;p.contact=v.contact||'';p.notes=v.notes||'';if(v.confirm_homonym){p.confirm_homonym=true;p.reason=v.reason||'';}}
    }
    if(e.entity==='availability'){
      p.department_id=p.department_id||null;p.start_time=p.start_time||null;p.end_time=p.end_time||null;
      if(Boolean(p.start_time)!==Boolean(p.end_time))throw Error('Informe as duas horas ou deixe ambas vazias.');
      for(const k of ['starts_on','ends_on','valid_from','valid_until'])p[k]=null;p.weekdays=null;
      const date=key=>{const raw=v[key];if(!raw)return null;const iso=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:tryReadDate(raw);if(!iso)throw Error('Revise a data: use dd/mm/aaaa.');return iso;};
      if(p.pattern==='weekly'){p.weekdays=v.weekdays;p.valid_from=date('valid_from');p.valid_until=date('valid_until');if(!p.weekdays.length)throw Error('Selecione ao menos um dia da semana.');}
      else{p.starts_on=date('starts_on');p.ends_on=date('ends_on');if(!p.starts_on||!p.ends_on)throw Error('Informe as datas inicial e final.');}
    }
    return p;
  }
  async function save(form){
    capture(form);const data=payload(),e=model.editor;model.saving=true;redraw();
    try{
      const row=await rpc('iasdpi_schedule_save',{p_entity:e.entity,p_id:e.id,p_expected_version:e.version,p_data:data,p_request_id:e.request});
      if(!row||row.id!==e.id||!Number.isInteger(row.version))throw Error('Confirmação inválida. Consulte o cadastro antes de tentar novamente.');
      model.editor=null;model.dirty=false;model.feedback=window.IASDPIScheduleUI?.isReview()?'Cadastro salvo nesta aba.':window.IASDPISchedulePreview?'Cadastro atualizado apenas nesta prévia fictícia.':'Cadastro confirmado pelo Supabase.';
      window.dispatchEvent(new Event('iasdpi-registry-saved'));await load();
    }catch(err){
      model.feedback='';e.error=err.message+(err.code==='40001'?' Seus campos continuam no formulário. Cancele e atualize a lista para comparar antes de reaplicar.':'');
    }finally{model.saving=false;redraw();}
  }
  document.addEventListener('submit',event=>{
    const form=event.target;if(!['schedule-login','schedule-editor','schedule-search'].includes(form.id))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(form.id==='schedule-search'){model.query=form.elements.query.value;model.department=form.elements.filter.value;redraw();return;}
    if(form.id==='schedule-editor'){if(!model.saving)void save(form).catch(e=>{form.querySelector('.schedule-error').textContent=e.message;});return;}
    const feedback=form.querySelector('.schedule-feedback'),submit=form.querySelector('button');submit.disabled=true;feedback.textContent='Confirmando identidade…';
    const email=form.elements.email.value,password=form.elements.password.value;form.elements.password.value='';
    void IASDPIAuth.loginIdentity(email,password).then(load).catch(e=>{feedback.textContent=e.message;}).finally(()=>{submit.disabled=false;});
  },true);
  document.addEventListener('input',event=>{const form=event.target.closest('#schedule-editor');if(!form||model.saving)return;capture(form);model.dirty=true;model.editor.request=crypto.randomUUID();form.querySelector('.schedule-feedback').textContent='Alterações pendentes, ainda não salvas.';
    if(event.target.name==='name'&&model.editor.entity==='person'){const norm=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();const name=norm(event.target.value);const matches=name.length>1?model.catalog.people.filter(p=>p.id!==model.editor.id&&(norm(p.name).includes(name)||name.includes(norm(p.name)))):[];form.querySelector('.schedule-similar').textContent=matches.length?'Confira os cadastros semelhantes antes de criar: '+matches.map(p=>p.name).join(', ')+'. Nenhuma fusão automática.':'';}});
  document.addEventListener('change',event=>{
    const form=event.target.closest('#schedule-editor');if(!form)return;capture(form);model.dirty=true;
    if(event.target.name==='pattern'||(event.target.name==='department_id'&&['membership','role'].includes(model.editor.entity))){if(model.editor.entity==='membership')model.editor.values.role_ids=[];redraw();}
  });
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-schedule-action]');if(!b)return;
    event.preventDefault();const action=b.dataset.scheduleAction,id=b.dataset.id;
    void(async()=>{
      if(action==='refresh'){if(canLeave())await load();}
      if(action==='tab'){if(canLeave()){model.tab=id;model.query='';model.department='';redraw();}}
      if(action==='create')await openEditor(id);
      if(action==='edit'){const [entity,key]=id.split(':');await openEditor(entity,key);}
      if(action==='lookup-account'){const form=document.querySelector('#schedule-editor'),target=form.querySelector('.schedule-lookup-result');capture(form);const email=form.elements.lookup_email.value.trim();if(!email)throw Error('Informe o e-mail exato da conta.');const rows=await rpc('iasdpi_find_account',{p_email:email});const account=rows?.[0];if(account?.confirmed){const field=form.elements[model.editor.entity==='person'?'auth_user_id':'user_id'];field.value=account.user_id;capture(form);model.dirty=true;model.editor.request=crypto.randomUUID();target.textContent='Conta confirmada identificada. Revise e salve para vincular; nenhum acesso foi concedido ainda.';}else target.textContent='Conta confirmada não encontrada. Solicite cadastro e confirmação antes de vincular.';}
      if(action==='cancel'){if(canLeave()){model.editor=null;redraw();}}
      if(action==='clear'){model.query='';model.department='';redraw();}
      if(action==='logout'&&canLeave()){await IASDPIAuth.logout();reset();redraw();}
    })().catch(e=>toast(e.message,true));
  });
  function reset(){model.generation++;model.catalog=null;model.status='idle';model.editor=null;model.dirty=false;model.feedback='';}
  window.addEventListener('iasdpi-identity-ended',()=>{reset();redraw();});
  window.addEventListener('iasdpi-registry-saved',()=>{if(state.page!=='schedule-setup'&&!model.dirty&&!model.saving){model.status='idle';model.catalog=null;}});
  window.addEventListener('beforeunload',event=>{if(model.dirty||model.saving){event.preventDefault();event.returnValue='';}});
  async function editPerson(id){await load();if(model.status!=='ready'||!model.catalog?.is_admin)throw Error('Dados privados exigem administrador da igreja.');model.tab='people';await openEditor('person',id);}
  return {page,canLeave,load,request:rpc,editPerson};
})();

// G8.2 — projeções do cadastro normalizado; nenhum cadastro de pessoas paralelo.
window.IASDPIRegistry=(()=>{
 const enabled=()=>window.IASDPIConfig?.centralRegistryEnabled===true,h=v=>esc(v),rpc=(n,b={})=>IASDPISchedules.request(n,b),week=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
 const m={phase:'idle',catalog:null,people:[],department:'',pending:new Map(),saving:false,error:'',message:'',generation:0,history:null,requests:new Map(),forms:new Map(),newPersonId:'',query:'',personStatus:'all',personDepartment:'all',focusPerson:'',identities:null,audit:null,identityEpoch:0};
 const pub={key:'',phase:'idle',heads:[],configured:[],links:[],confirmed_names:[],error:'',generation:0};
 const redraw=()=>{if(['schedule-members','organization','schedule-calendar'].includes(state.page))render();};
 const managed=()=>m.catalog?.departments.filter(d=>d.active&&(m.catalog.is_admin||d.can_manage_members))||[];
 function canLeave(){if(m.saving){alert('Aguarde a confirmação do cadastro.');return false;}if((m.pending.size||m.forms.size)&&!confirm('Descartar somente as alterações do cadastro ainda não salvas?'))return false;m.pending.clear();m.forms.clear();m.newPersonId='';return true;}
 async function load(preserve=false){const ticket=++m.generation;m.phase='loading';m.error='';redraw();try{
  const [c,people]=await Promise.all([rpc('iasdpi_registry_catalog'),rpc('iasdpi_registry_people',{p_search:''})]);if(ticket!==m.generation)return;
  if(!Array.isArray(c.memberships)||!Array.isArray(c.profiles)||!Array.isArray(people))throw Error('Resposta do Cadastro Geral inválida.');
  const identities=c.identity_registry&&c.is_admin?await rpc('iasdpi_registry_identity_preview'):null;if(ticket!==m.generation)return;
  if(m.catalog?.actor_id&&m.catalog.actor_id!==c.actor_id)m.pending.clear();m.catalog=c;m.people=people;m.identities=identities;
  if(!managed().some(d=>d.id===m.department))m.department=managed()[0]?.id||'';
  if(!preserve)m.pending.clear();m.phase='ready';
 }catch(e){if(ticket===m.generation){m.error=e.message;m.phase='error';}}finally{if(ticket===m.generation)redraw();}}
 function profile(link){return {weekdays:Object.fromEntries(week.map((_,i)=>[i,'unknown'])),...m.catalog.profiles.find(p=>p.membership_id===link.id)};}
 function changes(form){
  const fd=new FormData(form),get=n=>fd.has(n),link=m.catalog.memberships.find(l=>l.id===form.dataset.registryForm),oldRoles=m.catalog.qualifications.filter(q=>q.membership_id===link.id).map(q=>q.role_id),hidden=oldRoles.filter(id=>!m.catalog.roles.some(r=>r.id===id&&r.active));
  const values={active:get('active'),is_ministry_head:get('is_ministry_head'),leadership_scope:fd.has('leadership_scope')?String(fd.get('leadership_scope')||''):(link.leadership_scope||''),participation_confirmed:get('participation_confirmed'),availability_override:get('availability_override'),max_monthly_count:fd.get('max_monthly_count')===''?null:Number(fd.get('max_monthly_count')),role_ids:[...fd.getAll('role_ids'),...hidden].sort(),weekdays:Object.fromEntries(week.map((_,i)=>[i,String(fd.get('day_'+i))]))};
  const before={...link,role_ids:[...oldRoles].sort(),weekdays:profile(link).weekdays};return Object.fromEntries(Object.entries(values).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(before[k])));
 }
 function row(link){const p=m.people.find(p=>p.id===link.person_id)||m.catalog.people.find(p=>p.id===link.person_id),d=m.catalog.departments.find(d=>d.id===link.department_id),f='registry-link-'+link.id,attrs=`form="${h(f)}" ${m.saving?'disabled':''}`,q={...link,role_ids:m.catalog.qualifications.filter(q=>q.membership_id===link.id).map(q=>q.role_id),weekdays:profile(link).weekdays,...m.pending.get(link.id)?.patch};
  const label=(text,input)=>`<label>${h(text)}${input}</label>`,flag=(text,name)=>label(text,`<input ${attrs} type="checkbox" name="${name}" ${q[name]?'checked':''} aria-label="${h(text+' · '+p.display_name+' · '+d.name)}">`);
  const pending=(!q.participation_confirmed?'Participação; ':'')+(!q.role_ids.length?'Habilitação; ':'')+(Object.values(q.weekdays).some(v=>v==='unknown')?'Disponibilidade; ':'');
  return `<tr data-registry-member="${h(link.id)}"><th scope="row">${h(p.display_name)}<small>${h(d.name)}</small></th><td>${flag('Responsável no Organograma público','is_ministry_head')}${flag('Participante confirmado','participation_confirmed')}${flag('Dias específicos do departamento','availability_override')}${d.code==='diaconato'?label('Liderança',`<select ${attrs} name="leadership_scope">${[...new Set(['','Diaconato — Diáconos','Diaconato — Diaconisas',...(q.leadership_scope?[q.leadership_scope]:[])])].map(v=>`<option value="${h(v)}" ${q.leadership_scope===v?'selected':''}>${h(v||'Sem subdivisão')}</option>`).join('')}</select>`):''}${flag('Vínculo ativo','active')}</td><td>${m.catalog.roles.filter(r=>r.department_id===d.id&&r.active).map(r=>label(r.name,`<input ${attrs} type="checkbox" name="role_ids" value="${h(r.id)}" ${q.role_ids.includes(r.id)?'checked':''} aria-label="${h('Habilitado: '+r.name+' · '+p.display_name)}">`)).join('')||'Nenhuma função cadastrada'}</td>${week.map((day,i)=>`<td>${label(day,`<select ${attrs} name="day_${i}" aria-label="${h(day+' · '+p.display_name+' · '+d.name)}">${[['unknown','Pendente'],['available','Disponível'],['unavailable','Indisponível']].map(([v,l])=>`<option value="${v}" ${q.weekdays[i]===v?'selected':''}>${l}</option>`).join('')}</select>`)}</td>`).join('')}<td>${label('Máximo mensal',`<input ${attrs} type="number" name="max_monthly_count" min="0" max="100" value="${h(q.max_monthly_count??'')}" aria-label="${h('Limite · '+p.display_name+' · '+d.name)}" placeholder="Não informado">`)}<small>Dias distintos</small></td><td>${h(pending?'Pendente de confirmação: '+pending.replace(/; $/,'.'):'Confirmações preenchidas')}<small>Regras por data/período anteriores continuam aplicadas.</small></td><td><button ${attrs} type="submit" ${m.saving?'disabled':''}>Salvar vínculo</button><button type="button" data-registry-history="${h(link.person_id)}" data-registry-history-department="${h(link.department_id)}" ${m.saving?'disabled':''}>Histórico</button><p role="status">${m.pending.has(link.id)?'Alterações pendentes':''}</p></td></tr>`;
 }
 const searchText=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
 function visiblePeople(){
  const ids=new Set(managed().map(d=>d.id)),q=searchText(m.query);
  return m.people.filter(p=>{const links=m.catalog.memberships.filter(l=>l.person_id===p.id&&ids.has(l.department_id));
   return (m.catalog.is_admin||links.length)&&(!q||searchText(p.name+' '+p.display_name+' '+(p.aliases||[]).join(' ')).includes(q))&&
    (m.personStatus==='all'||(m.personStatus==='active'?p.active:!p.active))&&
    (m.personDepartment==='all'||(m.personDepartment==='none'?!m.catalog.memberships.some(l=>l.person_id===p.id):links.some(l=>l.department_id===m.personDepartment)));
  });
 }
 function directory(){
  const people=visiblePeople(),ds=managed(),church=window.IASDPIChurches?.current()?.name||window.IASDPIChurches?.selected()||'IASD_PI';
  return `<section class="panel registry-directory"><h2>Pessoas cadastradas</h2><form id="registry-filters" role="search" class="schedule-grid"><label>Pesquisar por nome ou apelido<input id="registry-search" type="search" maxlength="160" autocomplete="off" value="${h(m.query)}" aria-controls="registry-people-results"></label><label>Status da pessoa<select id="registry-person-status">${[['all','Todos'],['active','Ativas'],['inactive','Inativas']].map(([v,l])=>`<option value="${v}" ${v===m.personStatus?'selected':''}>${l}</option>`).join('')}</select></label><label>Departamento da pessoa<select id="registry-person-department"><option value="all">Todos os autorizados</option>${m.catalog.is_admin?`<option value="none" ${m.personDepartment==='none'?'selected':''}>Sem departamento</option>`:''}${ds.map(d=>`<option value="${h(d.id)}" ${d.id===m.personDepartment?'selected':''}>${h(d.name)}</option>`).join('')}</select></label><button type="button" data-registry-clear-filters>Limpar filtros</button></form><p role="status" data-registry-result-count>${people.length} ${people.length===1?'pessoa encontrada':'pessoas encontradas'}.</p>
  <div id="registry-people-results">${people.length?`<div class="table-scroll" tabindex="0" aria-label="Pessoas da igreja"><table class="registry-directory-table"><thead><tr><th>Nome completo</th><th>Nome preferido</th><th>Igreja</th><th>Status da pessoa</th><th>Vínculos</th><th>Ações</th></tr></thead><tbody>${people.map(p=>{const links=m.catalog.memberships.filter(l=>l.person_id===p.id&&ds.some(d=>d.id===l.department_id));return `<tr data-registry-person-row="${h(p.id)}"><th scope="row">${h(p.name)}</th><td>${h(p.display_name)}${p.aliases?.length?`<small>Apelidos históricos: ${p.aliases.map(h).join(', ')}</small>`:''}</td><td>${h(church)}</td><td>${p.active?'Ativa':'Inativa'}</td><td>${links.map(l=>h(ds.find(d=>d.id===l.department_id)?.name)+(l.active?'':' (vínculo inativo)')).join('<br>')||'Sem vínculo nos departamentos exibidos'}</td><td><button type="button" data-registry-person-links="${h(p.id)}">Vínculos</button>${m.catalog.is_admin?`<button type="button" data-registry-edit-person="${h(p.id)}">Editar pessoa</button>${m.catalog.identity_registry?`<button type="button" data-registry-audit="${h(p.id)}">Histórico cadastral</button>`:''}`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<p>Nenhuma pessoa corresponde aos filtros. Os cadastros foram carregados.</p>'}</div></section>`;
 }
 function identities(){
  if(!m.identities)return '';
  const groups=m.identities.groups.filter(g=>g.people.length),duplicates=m.identities.possible_duplicates||[],duplicateCount=new Set([...groups.filter(g=>g.people.length>1),...duplicates].map(g=>g.people.map(p=>p.id).sort().join(':'))).size,labels={schedule_memberships:'Vínculos',schedule_availability:'Regras de disponibilidade',schedule_assignments:'Atribuições',schedule_day_exceptions:'Exceções',schedule_legacy_commitments:'Compromissos históricos',schedule_elder_periods:'Períodos de anciãos',schedule_source_links:'Fontes associadas',people:'Cadastros',private_details:'Fichas privadas',qualifications:'Habilitações',confirmed_days:'Dias comprometidos',aliases:'Apelidos'};
  return `<details class="panel registry-identities"><summary>Nomes confirmados e possíveis duplicidades · ${duplicateCount}</summary><p>Confira as referências e escolha o identificador que será mantido. Conflitos exigem revisão; nenhum histórico será apagado.</p><button type="button" data-registry-identities-reload>Atualizar prévia</button>
  ${groups.length?groups.map((g,i)=>`<section class="registry-identity-group" data-identity-group="${h(g.name)}"><h3>${h(g.name)}</h3><p>${g.people.map(p=>h(p.name)+(p.departments?.length?' ('+p.departments.map(d=>h(d.name)).join(', ')+')':'')).join(' · ')}${g.department?' · Somente Desbravadores para o apelido Victoria':''}</p><p class="muted">${Object.entries(g.references).filter(([,n])=>n&&n!==0).map(([k,n])=>h(labels[k]||k)+': '+n).join(' · ')||'Sem referências vinculadas'}</p>${g.blockers.length?`<ul role="status">${g.blockers.map(b=>`<li>${h(b)}</li>`).join('')}</ul>`:''}<label>Identificador a manter<select data-identity-canonical="${i}" ${g.blockers.length?'disabled':''}>${g.people.map(p=>`<option value="${h(p.id)}">${h(p.name+(p.departments?.length?' — '+p.departments.map(d=>d.name).join(', '):'')+' · ID '+p.id.slice(0,8))}</option>`).join('')}</select></label><button type="button" data-registry-consolidate="${h(g.name)}" ${g.blockers.length?'disabled':''}>${g.people.length>1?'Confirmar consolidação':'Confirmar nome e apelidos'}</button></section>`).join(''):'<p>Não há correspondências confirmadas nesta igreja.</p>'}
  ${duplicates.length?`<h3>Possíveis homônimos</h3><ul>${duplicates.map(g=>`<li>${g.people.map(p=>h(p.name+(p.departments?.length?' — '+p.departments.map(d=>d.name).join(', '):'')+' · ID '+p.id.slice(0,8))).join(' / ')}. Confirme a identidade; sem mesclagem automática.</li>`).join('')}</ul>`:''}</details>`;
 }
 function auditPanel(){return m.audit?`<section class="panel" id="registry-audit"><h2>Histórico cadastral</h2><p>${h(m.people.find(p=>p.id===m.audit.person)?.name||'Pessoa')}</p>${m.audit.rows.length?`<div class="table-scroll" tabindex="0" aria-label="Histórico de alterações cadastrais"><table><thead><tr><th>Data</th><th>Ação</th><th>Autor (ID)</th><th>Versão</th><th>Campos</th></tr></thead><tbody>${m.audit.rows.map(r=>`<tr><td>${h(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'}).format(new Date(r.captured_at)))}</td><td>${h(r.entity)}</td><td>${h(r.actor_id)}</td><td>${h(r.version)}</td><td>${(r.changed_fields||[]).map(h).join(', ')}</td></tr>`).join('')}</tbody></table></div>`:'<p>Nenhuma alteração cadastral registrada.</p>'}</section>`:'';}
 function openPerson(id){const p=m.people.find(p=>p.id===id),form=document.getElementById('registry-person');if(!p||!form)return;
  if(m.forms.has('registry-person')&&form.elements.person.value!==id&&!confirm('Descartar apenas as alterações da pessoa ainda não salvas?'))return;
  m.forms.delete('registry-person');form.elements.person.value=p.id;form.elements.name.value=p.name;form.elements.display_name.value=p.display_name;form.elements.active.checked=p.active;form.dataset.displayEdited='false';form.querySelector('[data-registry-private-person]').disabled=false;form.closest('details').open=true;form.elements.name.focus();
 }
 function sources(){
  const rows=[];
  if(typeof churchMinistries!=='undefined')for(const d of churchMinistries)for(const name of d.responsibles)rows.push({key:'ministry:'+d.name+':'+name,name,department:d.name,origin:'Organograma informado'});
  if(typeof ministrySchedules!=='undefined')for(const [department,entries] of Object.entries(ministrySchedules))for(const e of entries)rows.push({key:'legacy:'+department+':'+e.date+':'+e.person,name:e.person,department,starts_on:e.date,ends_on:e.date,kind:'daily',origin:displayDate(e.date)});
  for(const e of window.IASDPIAgendaData?.events||[])if(e.person&&['weekly','monthly'].includes(e.kind))rows.push({key:'official:'+(e.id||[e.kind,e.startDate,e.endDate,e.person].join(':')),name:e.person,department:'Ancionato',starts_on:e.startDate,ends_on:e.endDate,kind:e.kind,origin:'Agenda oficial · '+(e.startDate||'')});
  return [...new Map(rows.map(r=>[r.key,r])).values()];
 }
 function page(){
  if(!enabled())return '';
  if(m.phase==='idle'){queueMicrotask(()=>load());return '<p role="status">Carregando Cadastro Geral…</p>';}
  if(m.phase==='loading')return '<p role="status">Carregando pessoas e vínculos…</p>';
  if(m.phase==='error')return `<section class="panel"><p role="alert">${h(m.error)}</p><button data-registry-retry>Tentar novamente</button></section>`;
  queueMicrotask(()=>{for(const [id,entries] of m.forms){const form=document.getElementById(id);if(!form)continue;for(const field of form.elements){if(!field.name)continue;const values=entries.filter(([k])=>k===field.name).map(([,v])=>v);if(field.type==='checkbox')field.checked=values.includes(field.value);else if(values.length)field.value=values[0];}form.closest('details')?.setAttribute('open','');if(form.id==='registry-person')form.querySelector('[data-registry-private-person]').disabled=!form.elements.person.value;}});
  const c=m.catalog,ds=managed(),links=c.memberships.filter(l=>(m.focusPerson?l.person_id===m.focusPerson&&ds.some(d=>d.id===l.department_id):l.department_id===m.department)),unmatched=sources().filter(r=>!c.source_links.some(l=>l.source_key===r.key)),options=m.people.map(p=>`<option value="${h(p.id)}">${h(p.display_name+(p.active?'':' · Inativa'))}</option>`).join('');
  return heading('PESSOAS E MINISTÉRIOS','Cadastro Geral de Membros','Uma pessoa, vários departamentos. Confirmações e limites pertencem a cada vínculo.')+`<p role="status" data-registry-status>${h(m.message)}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}<fieldset class="registry-controls" ${m.saving?'disabled':''}><legend class="sr-only">Cadastro e vínculos</legend>${directory()}${identities()}${auditPanel()}<section class="panel"><label>Departamento<select id="registry-department" ${m.saving?'disabled':''}>${ds.map(d=>`<option value="${h(d.id)}" ${m.department===d.id?'selected':''}>${h(d.name)}</option>`).join('')}</select></label></section>
  <section class="panel"><h2>${m.focusPerson?'Vínculos de '+h(m.people.find(p=>p.id===m.focusPerson)?.display_name||'pessoa'):'Pessoas do departamento'}</h2>${m.focusPerson?'<button type="button" data-registry-back-department>Voltar ao departamento</button>':''}<p class="muted">Deslize a tabela para consultar os dias e salvar cada vínculo.</p>${links.length?`${links.map(l=>`<form id="registry-link-${h(l.id)}" data-registry-form="${h(l.id)}"></form>`).join('')}<div class="table-scroll" tabindex="0" aria-label="Pessoas, habilitações e disponibilidade por departamento"><table class="registry-table"><thead><tr><th>Pessoa</th><th>Condição e status</th><th>Funções habilitadas</th>${week.map(w=>'<th>'+w+'</th>').join('')}<th>Limite</th><th>Pendências</th><th>Ações</th></tr></thead><tbody>${links.map(row).join('')}</tbody></table></div>`:'<p>Nenhuma pessoa vinculada a este departamento.</p>'}</section>
  <details class="panel"><summary>Vincular pessoa a departamentos</summary><form id="registry-add-links"><label>Pessoa existente<select name="person" required><option value="">Selecione no cadastro central</option>${options}</select></label><fieldset><legend>Departamentos — um único cadastro de pessoa</legend>${ds.map(d=>`<label class="checkbox"><input type="checkbox" name="departments" value="${h(d.id)}">${h(d.name)}</label>`).join('')}</fieldset><p>Vínculos existentes são preservados. Novos vínculos ficam pendentes de confirmação.</p><button ${m.saving?'disabled':''}>Salvar novos vínculos</button></form></details>
  ${c.is_admin?`<details class="panel"><summary>Cadastrar ou atualizar pessoa</summary><form id="registry-person"><label>Pessoa<select name="person"><option value="">Novo cadastro</option>${options}</select></label><label>Nome completo<input name="name" required maxlength="160"></label><label>Nome preferido (exibição)<input name="display_name" required maxlength="160"></label><label class="checkbox"><input name="active" type="checkbox" checked>Pessoa ativa</label><p>Vínculo com a igreja: ${h(window.IASDPIChurches?.current()?.name||window.IASDPIChurches?.selected()||'IASD_PI')}.</p><button type="button" data-registry-private-person disabled>Editar contatos privados</button><p>Antes de cadastrar, confira a lista. Homônimos e nomes semelhantes não são associados automaticamente.</p><button ${m.saving?'disabled':''}>Salvar pessoa</button></form></details><details class="panel"><summary>Associações pendentes · ${unmatched.length}</summary><p>Associe somente após confirmar a identidade. A fonte histórica original será preservada.</p>${unmatched.length?`<form id="registry-associate"><label>Registro de origem<select name="source" required>${unmatched.map(r=>`<option value="${h(r.key)}">${h(r.department+' · '+r.name+' · '+r.origin)}</option>`).join('')}</select></label><label>Pessoa confirmada<select name="person" required><option value="">Selecione</option>${options}</select></label><button ${m.saving?'disabled':''}>Confirmar associação</button></form>`:'<p>Nenhuma associação pendente nas fontes locais disponíveis.</p>'}</details>`:''}
  ${m.history?`<section class="panel" id="registry-history"><h2>Histórico de escalas</h2><ul>${m.history.current.map(r=>`<li>${h(displayDate(r.assigned_on))} · ${h(r.department)} · ${h(r.role)} · ${h(r.status)}</li>`).join('')||'<li>Nenhuma atribuição nos departamentos autorizados.</li>'}</ul><p>${m.history.versions.length} versões registradas nos departamentos autorizados.</p></section>`:''}</fieldset>`;
 }
 async function save(person,patch,links,key){
  if(m.saving)return;
  if(!confirm('Confirmar alterações '+(links.length?'em '+links.length+' vínculo(s)':'no cadastro da pessoa')+'? Os demais vínculos serão preservados.'))return;
  const identity=m.catalog.actor_id,ticket=m.generation;let request=m.requests.get(key);
  const previous=m.people.find(p=>p.id===person),args={p_person:person,p_expected_person_version:previous?.version||0,p_person_patch:patch,p_links:links};
  const signature=JSON.stringify(args);if(!request||request.signature!==signature){request={signature,id:crypto.randomUUID()};m.requests.set(key,request);}m.saving=true;m.error='';m.message='Aguardando confirmação…';redraw();
  try{const result=await rpc('iasdpi_registry_save',{...args,p_request_id:request.id});if(ticket!==m.generation||m.catalog?.actor_id!==identity)return;
   if(result.person?.id!==person||!Array.isArray(result.memberships))throw Error('Confirmação do cadastro inválida.');
   if(key.startsWith('row:'))m.pending.delete(key.slice(4));m.requests.delete(key);if(key.startsWith('links:'))m.forms.delete('registry-add-links');if(key.startsWith('person:')){m.forms.delete('registry-person');m.newPersonId='';}m.message=window.IASDPISchedulePreview?'Alterações confirmadas nesta demonstração.':'Alterações confirmadas pelo Supabase.';
   window.dispatchEvent(new Event('iasdpi-registry-saved'));await load(true);
  }catch(e){if(ticket===m.generation){m.error=e.message+' Suas alterações pendentes foram preservadas.';m.message='';}}finally{m.saving=false;redraw();}
 }
 function rememberForm(e){if(!enabled()||m.saving)return;const form=e.target.form;if(form?.id==='registry-person'&&e.type==='input'){if(e.target.name==='display_name')form.dataset.displayEdited='true';if(e.target.name==='name'&&form.dataset.displayEdited!=='true')form.elements.display_name.value=form.elements.name.value;}if(form?.matches('#registry-add-links,#registry-person,#registry-associate'))m.forms.set(form.id,[...new FormData(form)]);}
 document.addEventListener('input',e=>{rememberForm(e);const f=e.target.form;if(!enabled()||m.saving||!f?.dataset.registryForm)return;const id=f.dataset.registryForm,link=m.catalog.memberships.find(l=>l.id===id);m.pending.set(id,{department_id:link.department_id,expected_version:link.version,patch:changes(f)});document.querySelector('[data-registry-member="'+id+'"] [role=status]').textContent='Alterações pendentes.';});
 document.addEventListener('change',e=>{
  if(!enabled()||m.saving)return;
  if(e.target.id==='registry-department'){if(canLeave()){m.focusPerson='';m.department=e.target.value;m.history=null;redraw();}else e.target.value=m.department;return;}
  const form=e.target.form;if(form?.dataset.registryForm){const id=form.dataset.registryForm,member=m.catalog.memberships.find(l=>l.id===id);m.pending.set(id,{department_id:member.department_id,expected_version:member.version,patch:changes(form)});const row=document.querySelector('[data-registry-member="'+id+'"]');row.querySelector('[role=status]').textContent='Alterações pendentes.';}
  if(form?.id==='registry-person'&&e.target.name==='person'){const p=m.people.find(p=>p.id===e.target.value);form.elements.name.value=p?.name||'';form.elements.display_name.value=p?.display_name||'';form.elements.active.checked=p?.active!==false;form.querySelector('[data-registry-private-person]').disabled=!p;form.dataset.displayEdited='false';}
  rememberForm(e);
 });
 document.addEventListener('submit',e=>{if(!enabled())return;const f=e.target;if(!f.matches('[data-registry-form],#registry-add-links,#registry-person,#registry-associate'))return;e.preventDefault();e.stopImmediatePropagation();if(m.saving)return;const fd=new FormData(f);
  if(f.dataset.registryForm){const id=f.dataset.registryForm,l=m.catalog.memberships.find(l=>l.id===id),entry={department_id:l.department_id,expected_version:l.version,patch:changes(f)};if(!Object.keys(entry.patch).length){m.pending.delete(id);m.message='Nenhuma alteração neste vínculo.';redraw();return;}m.pending.set(id,entry);void save(l.person_id,{},[entry],'row:'+id);}
  if(f.id==='registry-add-links'){const person=String(fd.get('person')),deps=fd.getAll('departments');const known=m.catalog.memberships.filter(l=>l.person_id===person);const links=deps.filter(d=>!known.some(l=>l.department_id===d)).map(d=>({department_id:d,expected_version:0,patch:{}}));if(!links.length){m.error='Selecione ao menos um departamento ainda não vinculado.';redraw();return;}void save(person,{},links,'links:'+person);}
  if(f.id==='registry-person')void save(String(fd.get('person')||(m.newPersonId||=crypto.randomUUID())),{name:String(fd.get('name')),display_name:String(fd.get('display_name')),active:fd.has('active')},[],'person:'+fd.get('person'));
  if(f.id==='registry-associate'){
   if(!confirm('Confirmou a identidade e o departamento? Escalas de dias/semanas passarão a contar nos compromissos. A fonte histórica original será preservada.'))return;
   const key=String(fd.get('source')),person=String(fd.get('person')),source=sources().find(r=>r.key===key),code={Sonoplastia:'sonoplastia','Comunicação':'comunicacao',Ancionato:'ancionato'}[source?.department],department=m.catalog.departments.find(d=>d.code===code||d.name===source?.department);if(source?.starts_on&&!department){m.error='Cadastre o departamento antes de conciliar esta escala.';redraw();return;}m.saving=true;m.error='';const request=crypto.randomUUID(),reference=source?.starts_on?{department_id:department.id,starts_on:source.starts_on,ends_on:source.ends_on,kind:source.kind,original_name:source.name}:{};void rpc('iasdpi_registry_source_save',{p_source_key:key,p_person:person,p_expected_version:0,p_request_id:request,p_reference:reference}).then(()=>{m.forms.delete('registry-associate');m.message=window.IASDPISchedulePreview?'Associação confirmada nesta demonstração.':'Associação confirmada pelo Supabase.';window.dispatchEvent(new Event('iasdpi-registry-saved'));return load(true);}).catch(err=>{m.error=err.message;}).finally(()=>{m.saving=false;redraw();});
  }
 },true);
 document.addEventListener('click',e=>{if(!enabled())return;if(e.target.closest('[data-registry-retry]')){void load(true);return;}const b=e.target.closest('[data-registry-history]');if(b&&!m.saving)void rpc('iasdpi_registry_history',{p_person:b.dataset.registryHistory,p_department:b.dataset.registryHistoryDepartment||m.department}).then(v=>{m.history=v;redraw();document.getElementById('registry-history')?.scrollIntoView({block:'nearest'});}).catch(err=>{m.error=err.message;redraw();});});
 document.addEventListener('input',e=>{if(!enabled()||m.saving||e.target.id!=='registry-search')return;m.query=e.target.value;const caret=e.target.selectionStart;redraw();const field=document.getElementById('registry-search');field?.focus({preventScroll:true});if(field&&caret!=null)field.setSelectionRange(caret,caret);});
 document.addEventListener('change',e=>{if(!enabled()||m.saving)return;if(e.target.id==='registry-person-status')m.personStatus=e.target.value;else if(e.target.id==='registry-person-department')m.personDepartment=e.target.value;else return;redraw();document.getElementById(e.target.id)?.focus({preventScroll:true});});
 document.addEventListener('submit',e=>{if(e.target.id==='registry-filters')e.preventDefault();});
 document.addEventListener('click',e=>{if(!enabled()||m.saving)return;
  const edit=e.target.closest('[data-registry-edit-person]'),show=e.target.closest('[data-registry-person-links]'),priv=e.target.closest('[data-registry-private-person]');
  if(e.target.closest('[data-registry-identities-reload]')){if(canLeave())void load(true);return;}
  const audit=e.target.closest('[data-registry-audit]');if(audit){const ticket=m.generation,identity=m.catalog.actor_id;void rpc('iasdpi_registry_audit',{p_person:audit.dataset.registryAudit}).then(rows=>{if(ticket!==m.generation||m.catalog?.actor_id!==identity)return;m.audit={person:audit.dataset.registryAudit,rows};redraw();document.getElementById('registry-audit')?.scrollIntoView({block:'nearest'});}).catch(err=>{if(ticket===m.generation){m.error=err.message;redraw();}});return;}
  const merge=e.target.closest('[data-registry-consolidate]');if(merge){const group=m.identities?.groups.find(g=>g.name===merge.dataset.registryConsolidate);if(!group||group.blockers.length||!canLeave())return;const canonical=merge.closest('[data-identity-group]').querySelector('select').value;
   if(!confirm('Confirmar '+group.people.map(p=>p.name).join(' + ')+' → '+group.name+'? O ID '+canonical+' será mantido. Vínculos e referências serão consolidados; históricos anteriores serão preservados.'))return;
   const ticket=m.generation,identity=m.catalog.actor_id,epoch=m.identityEpoch;m.saving=true;m.error='';m.message='Aguardando confirmação…';redraw();const key=group.name+':'+canonical+':'+group.token;let request=m.requests.get(key);if(!request){request={id:crypto.randomUUID()};m.requests.set(key,request);}
   void rpc('iasdpi_registry_identity_apply',{p_name:group.name,p_canonical:canonical,p_token:group.token,p_request_id:request.id}).then(()=>{if(ticket!==m.generation||m.catalog?.actor_id!==identity)return;m.requests.delete(key);m.message=window.IASDPISchedulePreview?'Consolidação confirmada nesta demonstração.':'Consolidação confirmada pelo Supabase.';window.dispatchEvent(new Event('iasdpi-registry-saved'));return load(true);}).catch(err=>{if(ticket===m.generation)m.error=err.message;}).finally(()=>{if(epoch===m.identityEpoch){m.saving=false;redraw();}});return;
  }
  if(edit){openPerson(edit.dataset.registryEditPerson);return;}
  if(show){if(!canLeave())return;m.focusPerson=show.dataset.registryPersonLinks;m.history=null;redraw();document.querySelector('.registry-table')?.scrollIntoView({block:'nearest'});return;}
  if(e.target.closest('[data-registry-back-department]')){if(canLeave()){m.focusPerson='';redraw();}return;}
  if(e.target.closest('[data-registry-clear-filters]')){m.query='';m.personStatus='all';m.personDepartment='all';redraw();return;}
  if(priv){const person=document.getElementById('registry-person')?.elements.person.value;if(!person)return;void(async()=>{if(await IASDPINavigation.navigate('schedule-setup'))await IASDPISchedules.editPerson(person);})().catch(err=>{m.error=err.message;if(typeof toast==='function')toast(err.message,true);redraw();});}
 });
 function publicKey(){return window.IASDPIChurches?.selected()||'IASD_PI';}
 async function refreshPublic(){const key=publicKey(),ticket=++pub.generation;pub.key=key;pub.phase='loading';pub.error='';try{
  const result=await IASDPIAuth.jsonRequest('/rest/v1/rpc/iasdpi_registry_public',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(ticket!==pub.generation||key!==publicKey())return;if(!Array.isArray(result.heads)||!Array.isArray(result.links)||(result.confirmed_names!==undefined&&!Array.isArray(result.confirmed_names)))throw Error('Resposta do organograma inválida.');Object.assign(pub,result,{confirmed_names:result.confirmed_names||[],phase:'ready'});
 }catch(e){if(ticket===pub.generation){pub.phase='error';pub.error=e.message;}}finally{if(ticket===pub.generation)redraw();}}
 function publicState(){if(!enabled())return null;if(pub.key!==publicKey()||pub.phase==='idle'){pub.key=publicKey();pub.phase='loading';queueMicrotask(refreshPublic);}return pub;}
 function periodReasons(c,d,r,person){
  const member=c.memberships.find(m=>m.person_id===person&&m.department_id===d),need=r.kind==='weekly'?'semana':'mes',out=[];
  if(member?.participation_confirmed!==true)out.push('Participação — Pendente de confirmação');
  if(!c.roles.some(role=>role.department_id===d&&role.active&&role.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(need)&&c.qualifications.some(q=>q.membership_id===member?.id&&q.role_id===role.id)))out.push('Habilitação do período — Pendente de confirmação');
  if(window.IASDPIScheduleRules?.availabilityEnabled(c)??c.availability_enabled!==false)for(const day of IASDPIElderPeriods.range(r.starts_on,r.ends_on)){const state=c.registry_days?.find(v=>v.person_id===person&&v.date===day)?.state;if(state!=='available'){out.push(state==='unavailable'?'Indisponível no período':'Disponibilidade — Pendente de confirmação');break;}}
  return out;
 }
 function confirmedName(name,department){const s=publicState();if(s?.phase!=='ready')return name;const code=searchText(department).replace(/[^a-z0-9]+/g,'-');return s.confirmed_names?.find(a=>searchText(a.alias)===searchText(name)&&(!a.department||a.department===code))?.name||name;}
 function personName(catalog,id){const target=catalog?.identity_redirects?.find(p=>p.id===id)?.canonical_id||id;return catalog?.people?.find(p=>p.id===target)?.display_name||null;}
 const map={musica:'Ministério da Música','ministerio-da-familia':'Ministério da Família','ministerio-da-crianca':'Ministério da Criança'};
 function ministry(entry){const s=publicState();if(s?.phase!=='ready')return entry;const d=(s.departments||[]).find(d=>(map[d.code]||d.name)===entry.name||d.name===entry.name||entry.name.startsWith('Diaconato')&&d.code==='diaconato');const heads=s.heads.filter(r=>(r.scope||map[r.department_code]||r.department)===entry.name);return {...entry,archived:d?.active===false,responsibles:heads.length||(s.configured||[]).some(r=>(r.scope||map[r.department_code]||r.department)===entry.name)?[...new Set(heads.map(r=>r.name))]:entry.responsibles.map(name=>s.links.find(l=>l.source_key==='ministry:'+entry.name+':'+name)?.display_name||confirmedName(name,entry.name))};}
 function historical(row){const s=publicState(),link=s?.phase==='ready'?s.links.find(l=>l.source_key===row.id):null;const name=link?.display_name||confirmedName(row.person,row.department);return name!==row.person?{...row,original_person:row.original_person||row.person,person:name}:row;}
 function publicStatus(){const p=publicState();if(!p)return '';return p.phase==='loading'?'<p role="status">Carregando vínculos de liderança…</p>':p.phase==='error'?`<p role="alert">${h(p.error)} Exibindo as referências históricas preservadas. <button data-registry-public-retry>Tentar novamente</button></p>`:'';}
 document.addEventListener('click',e=>{if(e.target.closest('[data-registry-public-retry]'))void refreshPublic();});
 window.addEventListener('iasdpi-registry-saved',()=>{pub.phase='idle';if(state.page!=='schedule-members'&&!m.pending.size&&!m.forms.size)m.phase='idle';});
 window.addEventListener('iasdpi-identity-ended',()=>{m.generation++;m.catalog=null;m.people=[];m.phase='idle';m.pending.clear();m.requests.clear();m.forms.clear();m.newPersonId='';m.query='';m.personStatus='all';m.personDepartment='all';m.focusPerson='';m.history=null;m.identities=null;m.audit=null;m.saving=false;m.identityEpoch++;});
 window.addEventListener('beforeunload',e=>{if(m.pending.size||m.forms.size||m.saving){e.preventDefault();e.returnValue='';}});
 return {enabled,page,canLeave,sources,ministry,historical,publicStatus,refreshPublic,periodReasons,personName,publicDepartments:()=>{const s=publicState();return s?.phase==='ready'?(s.departments||[]).map(d=>ministry({name:map[d.code]||d.name,responsibles:[]})):[];}};
})();

;
'use strict';
// Apresentação compacta opcional; os contratos de dados e autorização são os mesmos.
window.IASDPIScheduleUI=(()=>{
 const isReview=()=>Boolean(window.IASDPIKnownPreviewSeed?.review_ready||window.IASDPIPortalAccess?.enabled());
 function help(id,text,label='Ajuda sobre a escala',compact=false){return `<span class="scale-help-control schedule-help-control${compact?' schedule-help-compact':''}"><button type="button" class="scale-help-button" aria-label="${esc(label)}" aria-controls="${esc(id)}" aria-describedby="${esc(id)}" aria-expanded="false">?</button><span id="${esc(id)}" role="tooltip" hidden>${esc(text)}</span></span>`;}
 function feedback(text){if(!isReview())return text;return String(text||'').replace(/Alterações confirmadas (?:apenas na memória desta demonstração|somente na memória desta demonstração)\./g,'Alterações salvas nesta aba.').replace('Abra Ver no calendário.','').replace(/Proposta editável: (\d+) vagas sugeridas; (\d+) pendentes\. Atribuições existentes preservadas\. Revise antes de salvar ou publicar\./,'$1 vagas sugeridas · $2 pendentes.').replace(/Proposta editável: (\d+) períodos sugeridos\. Revise antes de salvar\./,'$1 períodos sugeridos.').trim();}
 function departments(catalog){if(window.IASDPIPortalAccess?.enabled()){const priority=IASDPIPortalAccess.departments().map(d=>d.id);return catalog.departments.filter(d=>d.active&&(d.can_manage||d.can_roster)&&(!window.IASDPIConfig?.isolatedPilot||['sonoplastia','ancionato','comunicacao','ministerio-da-familia','ministerio-da-crianca','musica','diaconato'].includes(d.code)||catalog.roles.some(r=>r.department_id===d.id&&r.active))).sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id));}const rows=catalog.departments.filter(d=>d.active&&(d.can_manage||d.can_roster));if(!isReview())return rows;const main=['sonoplastia','ancionato','comunicacao','ministerio-da-familia','ministerio-da-crianca','musica'];return main.map(code=>rows.find(d=>d.code===code)).filter(Boolean);}
 const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
 let pendingFocus='';
 const monthLabel=value=>months[Number(value.slice(5))-1]+' de '+value.slice(0,4);
 function monthPicker(id,value,disabled=false){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)||Number(value.slice(0,4))<1000||Number(value.slice(0,4))>9998)throw Error('Mês inválido.');
  return `<div class="schedule-month-picker" data-month-picker="${esc(id)}" data-picker-year="${value.slice(0,4)}"><span class="schedule-picker-label" id="${esc(id)}-label">Mês e ano</span><input type="hidden" id="${esc(id)}" name="month" value="${esc(value)}" ${disabled?'disabled':''}><button type="button" class="schedule-month-trigger" data-month-open aria-labelledby="${esc(id)}-label ${esc(id)}-value" aria-haspopup="dialog" aria-controls="${esc(id)}-popup" aria-expanded="false" ${disabled?'disabled':''}><span id="${esc(id)}-value" data-month-label>${esc(monthLabel(value))}</span><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 10h18M8 3v5M16 3v5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button><div class="schedule-month-popup" id="${esc(id)}-popup" role="dialog" aria-label="Escolher mês e ano" hidden><div class="schedule-picker-year"><button type="button" data-month-year="-1" aria-label="Ano anterior">‹</button><strong data-picker-year-label>${value.slice(0,4)}</strong><button type="button" data-month-year="1" aria-label="Próximo ano">›</button></div><div class="schedule-picker-months">${months.map((name,index)=>`<button type="button" data-month-option="${String(index+1).padStart(2,'0')}" aria-pressed="${index+1===Number(value.slice(5))}">${name}</button>`).join('')}</div></div></div>`;
 }
 function yearSelect(id,value,disabled=false){const year=Number(value);return `<label>Ano<select id="${esc(id)}" name="year" data-auto-year ${disabled?'disabled':''}>${Array.from({length:11},(_,i)=>year-5+i).filter(y=>y>=1000&&y<=9998).map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></label>`;}
 function updatePicker(host,value){
  const input=host.querySelector('input');if(value){input.value=value;host.dataset.pickerYear=value.slice(0,4);host.querySelector('[data-month-label]').textContent=monthLabel(value);}
  const year=Number(host.dataset.pickerYear);host.querySelector('[data-picker-year-label]').textContent=year;
  host.querySelectorAll('[data-month-option]').forEach(button=>button.setAttribute('aria-pressed',String(year+'-'+button.dataset.monthOption===input.value)));
  host.querySelector('[data-month-year="-1"]').disabled=year<=1000;host.querySelector('[data-month-year="1"]').disabled=year>=9998;
 }
 function closePicker(host,focus=false){host.querySelector('[role=dialog]').hidden=true;host.querySelector('[data-month-open]').setAttribute('aria-expanded','false');if(focus)host.querySelector('[data-month-open]').focus({preventScroll:true});}
 function restoreMonth(form,value){const host=form.querySelector('[data-month-picker]');if(host){updatePicker(host,value);closePicker(host,true);pendingFocus='';}}
 function mount(){if(!pendingFocus)return;const year=document.getElementById(pendingFocus);if(year?.matches('[data-auto-year]')){pendingFocus='';year.focus({preventScroll:true});return;}const host=document.querySelector('[data-month-picker="'+pendingFocus+'"]');if(host){pendingFocus='';host.querySelector('[data-month-open]').focus({preventScroll:true});}}
 document.addEventListener('click',e=>{
  const host=e.target.closest('[data-month-picker]');document.querySelectorAll('[data-month-picker]').forEach(other=>{if(other!==host)closePicker(other);});if(!host||host.querySelector('input').disabled)return;
  const button=e.target.closest('button');if(!button||button.disabled)return;
  if(button.hasAttribute('data-month-open')){const popup=host.querySelector('[role=dialog]'),open=popup.hidden;if(open){updatePicker(host,host.querySelector('input').value);popup.hidden=false;button.setAttribute('aria-expanded','true');host.querySelector('[data-month-option][aria-pressed=true]')?.focus();}else closePicker(host);return;}
  if(button.hasAttribute('data-month-year')){const year=Number(host.dataset.pickerYear)+Number(button.dataset.monthYear);if(year>=1000&&year<=9998){host.dataset.pickerYear=year;updatePicker(host);}return;}
  if(button.hasAttribute('data-month-option')){const input=host.querySelector('input'),value=host.dataset.pickerYear+'-'+button.dataset.monthOption;if(value===input.value){closePicker(host,true);return;}pendingFocus=host.dataset.monthPicker;input.value=value;closePicker(host);host.querySelector('[data-month-label]').textContent=monthLabel(value);input.dispatchEvent(new Event('change',{bubbles:true}));mount();}
 });
 document.addEventListener('change',e=>{if(!e.target.matches('[data-month-picker] input,[data-auto-year]'))return;const form=e.target.closest('form');if(form?.matches('#b1-scope,#elder-month,#elder-year')){if(e.target.matches('[data-auto-year]'))pendingFocus=e.target.id;form.requestSubmit();mount();}});
 document.addEventListener('keydown',e=>{
  const host=e.target.closest('[data-month-picker]');if(!host||host.querySelector('[role=dialog]').hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePicker(host,true);return;}
  if(e.target.hasAttribute('data-month-option')){const buttons=[...host.querySelectorAll('[data-month-option]')],index=buttons.indexOf(e.target),delta={ArrowRight:1,ArrowLeft:-1,ArrowDown:3,ArrowUp:-3}[e.key];if(delta||e.key==='Home'||e.key==='End'){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?11:(index+delta+12)%12].focus();}}
 });
 document.addEventListener('focusout',e=>{const host=e.target.closest('[data-month-picker]');if(host&&e.relatedTarget&&!host.contains(e.relatedTarget))closePicker(host);});
 return {isReview,help,feedback,departments,monthPicker,monthLabel,yearSelect,restoreMonth,mount};
})();
// Seleção de equipe reutilizada pelas escalas diárias e do Ancionato.
window.IASDPIRotationTeam=(()=>{
 const states=new Map(),h=v=>esc(v),key=(actor,department,mode)=>[actor,department,mode].join(':');
 function team(catalog,department){const central=window.IASDPIConfig?.centralRegistryEnabled||catalog.central_registry;return catalog.people.filter(p=>p.active&&catalog.memberships.some(m=>m.person_id===p.id&&m.department_id===department&&m.active&&(!central||m.participation_confirmed===true))).sort((a,b)=>String(a.display_name||a.name).localeCompare(String(b.display_name||b.name),'pt-BR',{sensitivity:'base'})||a.id.localeCompare(b.id));}
 function model(catalog,department,id){let s=states.get(id);const people=team(catalog,department);if(!s){s={from:'',to:'',index:0,excluded:new Set(),open:false};states.set(id,s);}s.catalog=catalog;s.department=department;s.people=people;if(!people.some(p=>p.id===s.from))s.from=people[0]?.id||'';if(!people.some(p=>p.id===s.to))s.to=people.at(-1)?.id||'';return s;}
 function range(s){const from=s.people.findIndex(p=>p.id===s.from),to=s.people.findIndex(p=>p.id===s.to);return from>=0&&to>=from?s.people.slice(from,to+1):[];}
 function selected(catalog,department,id,strict=false){const s=model(catalog,department,id);if(strict&&s.people.length&&!range(s).length)throw Error('O início do intervalo deve vir antes do final.');return range(s).filter(p=>!s.excluded.has(p.id)).map(p=>p.id);}
 function view(catalog,department,id,disabled=false){const s=model(catalog,department,id),rows=range(s),chosen=rows.filter(p=>!s.excluded.has(p.id)),options=value=>s.people.map(p=>`<option value="${h(p.id)}" ${p.id===value?'selected':''}>${h(p.display_name||p.name)}</option>`).join('');s.index=rows.length?Math.min(s.index,rows.length-1):0;const p=rows[s.index],attrs=disabled?'disabled':'';
  return `<details class="rotation-team" data-rotation-team="${h(id)}" ${s.open?'open':''}><summary>Pessoas do rodízio · ${chosen.length}</summary>${s.people.length?`<div class="rotation-range"><label>De<select data-rotation-range="from" ${attrs}>${options(s.from)}</select></label><label>Até<select data-rotation-range="to" ${attrs}>${options(s.to)}</select></label></div>${p?`<div class="rotation-carousel" aria-label="Revisar participantes do rodízio"><button type="button" data-rotation-nav="-1" aria-label="Pessoa anterior" ${attrs}>‹</button><div><strong>${h(p.display_name||p.name)}</strong><small>${s.index+1} de ${rows.length} · ordem alfabética</small><label class="checkbox"><input type="checkbox" data-rotation-include ${!s.excluded.has(p.id)?'checked':''} ${attrs}> Incluir no automático</label></div><button type="button" data-rotation-nav="1" aria-label="Próxima pessoa" ${attrs}>›</button></div>`:'<p role="alert">Revise a ordem do intervalo.</p>'}`:'<p>Nenhum participante confirmado nesta equipe. <a href="#schedule-members" data-b1-nav="schedule-members">Conferir Cadastro Geral</a></p>'}</details>`;
 }
 const redraw=()=>{if(window.state?.page==='schedule-build'||typeof state!=='undefined'&&state.page==='schedule-build')render();};
 document.addEventListener('toggle',e=>{const id=e.target.dataset?.rotationTeam;if(id&&states.has(id))states.get(id).open=e.target.open;},true);
 document.addEventListener('change',e=>{const host=e.target.closest('[data-rotation-team]'),s=host&&states.get(host.dataset.rotationTeam);if(!s)return;if(e.target.dataset.rotationRange){s[e.target.dataset.rotationRange]=e.target.value;s.index=0;redraw();}if(e.target.hasAttribute('data-rotation-include')){const p=range(s)[s.index];if(p){if(e.target.checked)s.excluded.delete(p.id);else s.excluded.add(p.id);redraw();}}});
 document.addEventListener('click',e=>{const button=e.target.closest('[data-rotation-nav]'),host=button?.closest('[data-rotation-team]'),s=host&&states.get(host.dataset.rotationTeam);if(!s||button.disabled)return;const rows=range(s);if(rows.length){s.index=(s.index+Number(button.dataset.rotationNav)+rows.length)%rows.length;redraw();}});
 window.addEventListener('iasdpi-identity-ended',()=>states.clear());
 return {key,team,selected,view};
})();
// B1.2: motor puro de proposta. A confirmação transacional continua no PostgreSQL.
window.IASDPIScheduleEditWindow=(()=>{
 const localDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function bounds(settings={}){const today=settings.editable_from||settings.today||localDay(),month=today.slice(0,7),count=Number(settings.planning_months)||1,last=new Date(month+'-01T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+count+1,0);return {from:today,until:settings.editable_until||last.toISOString().slice(0,10),month};}
 function day(date,settings){if(!settings?.schedule_edit_policy)return true;const b=bounds(settings);return Boolean(date&&date>=b.from&&date<=b.until);}
 function month(value,settings){if(!settings?.schedule_edit_policy)return true;const b=bounds(settings);return value>=b.month&&value<=b.until.slice(0,7);}
 function period(row,settings){if(!settings?.schedule_edit_policy)return true;const b=bounds(settings);return row.ends_on>=b.from&&row.starts_on<=b.until;}
 return {bounds,day,month,period};
})();
// Regras comuns de apresentação e compatibilidade; IDs e ordem persistida não mudam.
window.IASDPIScheduleRules=(()=>{
 const compareNames=(a,b)=>String(a||'').localeCompare(String(b||''),'pt-BR',{sensitivity:'base',numeric:true})||String(a||'').localeCompare(String(b||''),'pt-BR');
 const comparePeople=(a,b)=>compareNames(a.display_name||a.name,b.display_name||b.name)||String(a.id||'').localeCompare(String(b.id||''));
 const communication=(catalog,id)=>catalog?.departments?.some(d=>d.id===id&&d.code==='comunicacao')||false;
 const departmentsConflict=(catalog,a,b)=>!(a&&b&&a===b)&&!communication(catalog,a)&&!communication(catalog,b);
 const availabilityEnabled=context=>!(window.IASDPIConfig?.isolatedPilot&&window.IASDPIConfig.pilotAvailabilityChecks===false)&&context?.availability_enabled!==false;
 return {compareNames,comparePeople,communication,departmentsConflict,availabilityEnabled};
})();
window.IASDPIScheduleRotation=(()=>{
 const editWindow=window.IASDPIScheduleEditWindow||{day:()=>true,bounds:()=>({})};
 const event=(s,r)=>s.events.find(e=>e.id===r.event_id);
 function days(s,r,a){
  if(a?.timing_mode==='timed'&&a.starts_at&&a.ends_at){
   const local=value=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
   // Date.parse corta microssegundos; só recua se não houver fração residual.
   const residual=/\.(\d+)/.exec(a.ends_at)?.[1]?.slice(3)||'',first=local(a.starts_at),last=local(new Date(Date.parse(a.ends_at)-(/[1-9]/.test(residual)?0:1))),out=[];
   for(let d=new Date(first+'T12:00:00Z');d.toISOString().slice(0,10)<=last;d.setUTCDate(d.getUTCDate()+1))out.push(d.toISOString().slice(0,10));return out;
  }
  return event(s,r)?[event(s,r).scheduled_on]:[];
 }
 function usage(s,person,skip){const month=s.context?.month?.slice(0,7)||s.events[0]?.scheduled_on.slice(0,7);return new Set(s.plan.requirements.flatMap(r=>r.assignments.filter(a=>a.person_id===person&&a.id!==skip).flatMap(a=>days(s,r,a))).filter(day=>day.slice(0,7)===month));}
 function reasons(s,r,person,skip,manual=false){
  const p=s.catalog.people.find(p=>p.id===person),member=s.catalog.memberships.find(m=>m.person_id===person&&m.department_id===s.department),role=s.catalog.roles.find(role=>role.id===r.role_id),context=s.context?.people.find(p=>p.person_id===person),date=event(s,r)?.scheduled_on,out=[];
  if(!p?.active)out.push('Pessoa inativa');
  if(!member?.active)out.push('Sem vínculo ativo');
  if(!role?.active||role.department_id!==s.department||((!role.general_assignment||(s.context?.central_registry&&!manual))&&!s.catalog.qualifications.some(q=>q.membership_id===member?.id&&q.role_id===r.role_id)))out.push('Sem habilitação para a função — Pendente de confirmação');
  if(s.context?.central_registry&&!manual&&member?.participation_confirmed!==true)out.push('Participação — Pendente de confirmação');
  if(!date)out.push('Evento não encontrado');
  if(!editWindow.day(date,s.context))out.push(date<editWindow.bounds(s.context).from?'Data encerrada':'Data fora do período de edição');
  const detail=context?.days.find(d=>d.date===date);
  const advisory=manual&&s.context?.availability_advisory,defaultAvailable=!s.context?.central_registry&&s.context?.availability_default==='available';
  if((window.IASDPIScheduleRules?.availabilityEnabled(s.context)??s.context?.availability_enabled!==false)&&!advisory&&detail?.state!=='available'&&!(defaultAvailable&&(!detail?.state||detail.state==='unknown')))out.push(detail?.state==='unavailable'?'Indisponível nesta data':'Disponibilidade desconhecida — Pendente de confirmação');
  if(detail?.conflict&&!window.IASDPIScheduleRules?.communication(s.catalog,s.department))out.push('Conflito com outro departamento nesta data');
  if((s.batchAssignments||[]).some(a=>a.person_id===person&&a.date===date&&(window.IASDPIScheduleRules?window.IASDPIScheduleRules.departmentsConflict(s.catalog,a.department_id,s.department):a.department_id!==s.department)))out.push('Conflito com proposta deste lote em outro departamento');
  if(r.assignments.some(a=>a.person_id===person&&a.id!==skip))out.push('Já ocupa esta função no evento');
  const used=usage(s,person,skip);if(date)used.add(date);
  const global=new Set([...(context?.global_days||[]),...used]),department=new Set([...(context?.department_days||[]),...used]);
  if(!advisory&&p?.max_monthly_count!=null&&global.size>p.max_monthly_count)out.push('Limite mensal da pessoa atingido');
  if(!advisory&&member?.max_monthly_count!=null&&department.size>member.max_monthly_count)out.push('Limite mensal do departamento atingido');
  return out;
 }
 function candidates(s,r,skip){return s.catalog.people.filter(p=>s.catalog.memberships.some(m=>m.person_id===p.id&&m.department_id===s.department)).map(p=>({person:p,reasons:reasons(s,r,p.id,skip)}));}
 function warnings(s,r,person){const date=event(s,r)?.scheduled_on,detail=s.context?.people.find(p=>p.person_id===person)?.days.find(d=>d.date===date);return detail?.draft_dispute?['Possível disputa com outro rascunho; não é compromisso confirmado. Revalidar ao publicar.']:[];}
 function propose(source){
  if(!source.context||source.context.basis_version!==source.plan.version)throw Error('Atualize os dados do rodízio antes de sugerir.');
  const plan=structuredClone(source.plan),s={...source,plan},round=new Set(),order=s.context.people.map(p=>p.person_id).sort();let added=0;
  const latest=[...s.context.people].filter(p=>p.last_day).sort((a,b)=>b.last_day.localeCompare(a.last_day)||a.person_id.localeCompare(b.person_id))[0];
  let cursor=latest?(order.indexOf(latest.person_id)+1)%order.length:0;
  const rows=[...plan.requirements].sort((a,b)=>(event(s,a)?.scheduled_on||'').localeCompare(event(s,b)?.scheduled_on||'')||a.role_id.localeCompare(b.role_id)||a.id.localeCompare(b.id));
  const allowed=r=>!Array.isArray(s.context.planning_weekdays)||s.context.planning_weekdays.includes(new Date(event(s,r)?.scheduled_on+'T12:00:00Z').getUTCDay())||(s.context.extra_dates||[]).includes(event(s,r)?.scheduled_on);
  for(const r of rows)while(allowed(r)&&editWindow.day(event(s,r)?.scheduled_on,s.context)&&r.assignments.length<r.required_count){
   let eligible=candidates(s,r).filter(c=>!c.reasons.length&&(!Array.isArray(s.allowedPeople)||s.allowedPeople.includes(c.person.id)));if(!eligible.length)break;
   if(eligible.every(c=>round.has(c.person.id)))round.clear();
   const rank=p=>{const c=s.context.people.find(c=>c.person_id===p.id),count=new Set([...(c.department_days||[]),...usage(s,p.id)]).size;return [warnings(s,r,p.id).length,count,round.has(p.id)?1:0,c.history_count||0,(order.indexOf(p.id)-cursor+order.length)%order.length,p.id];};
   eligible.sort((a,b)=>{const x=rank(a.person),y=rank(b.person);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]<y[i]?-1:1;}return 0;});
   const p=eligible[0].person;r.assignments.push({id:crypto.randomUUID(),person_id:p.id,timing_mode:'day',starts_at:null,ends_at:null});round.add(p.id);cursor=(order.indexOf(p.id)+1)%order.length;added++;
  }
  return {plan,added};
 }
 function proposeBatch(sources){
  const commitments=sources.flatMap(s=>s.plan.requirements.flatMap(r=>r.assignments.flatMap(a=>days(s,r,a).map(date=>({person_id:a.person_id,department_id:s.department,date}))))),result=[];
  for(const source of sources){const proposal=propose({...source,batchAssignments:[...(source.batchAssignments||[]),...commitments]});result.push(proposal);for(const r of proposal.plan.requirements)for(const a of r.assignments)for(const date of days(source,r,a))commitments.push({person_id:a.person_id,department_id:source.department,date});}
  return result;
 }
 const manualReasons=(s,r,p,skip)=>reasons(s,r,p,skip,true);
 const preferences=(s,r,p,skip)=>reasons(s,r,p,skip).filter(reason=>!manualReasons(s,r,p,skip).includes(reason));
 function metrics(s){const rows=s.plan.requirements.filter(r=>editWindow.day(event(s,r)?.scheduled_on,s.context)),total=rows.reduce((n,r)=>n+r.required_count,0),filled=rows.reduce((n,r)=>n+r.assignments.length,0),people=new Map();let conflicts=0,advisories=0;
  for(const r of rows)for(const a of r.assignments){people.set(a.person_id,(people.get(a.person_id)||0)+1);if(manualReasons(s,r,a.person_id,a.id).length)conflicts++;if(preferences(s,r,a.person_id,a.id).length)advisories++;}
  return {total,filled,pending:Math.max(0,total-filled),people:[...people].map(([id,count])=>({id,count})),conflicts,advisories};
 }
 return {propose,proposeBatch,candidates,reasons,manualReasons,preferences,warnings,metrics};
})();
// B1 — montagem manual. Cadastros e autorização reutilizam a Fase A.
window.IASDPIScheduleManagement=(()=>{
 const m={monthly:false,context:null,day:'',layout:'monthly',settings:null,availability:[],periodInitialized:false,status:'idle',catalog:null,department:'',month:currentMonth(),events:[],plan:null,versions:[],dirty:false,saving:false,error:'',feedback:'',generation:0,selected:[],remote:null,history:null,request:crypto.randomUUID(),owner:null,
  form:{title:'Culto',start:'',end:'',days:[3,6,0],extraTitle:'',extraDate:'',extraEndDate:'',extraStart:'',extraEnd:'',role:'',count:'1'}};
 const h=value=>esc(value),rpc=(name,args={})=>IASDPISchedules.request(name,args);
 function currentMonth(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date());return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;}
 function dates(month,weekdays){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1000||!Array.isArray(weekdays)||weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Mês ou dias da semana inválidos.');
  const first=new Date(month+'-01T12:00:00Z'),rows=[];
  for(let d=new Date(first);d.toISOString().slice(0,7)===month;d.setUTCDate(d.getUTCDate()+1))if(weekdays.includes(d.getUTCDay()))rows.push(d.toISOString().slice(0,10));
  return rows;
 }
 const hour=value=>{const d=new Date(value);return value&&!isNaN(d)?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d):'Horário inválido';};
 const eventName=e=>e?`${displayDate(e.scheduled_on)} · ${e.title}${e.timing_mode==='day'?'':` · ${hour(e.starts_at)}–${hour(e.ends_at)}${m.settings?' (horário histórico)':''}`}`:'Evento indisponível';
 const lookup=(list,id)=>m.catalog?.[list]?.find(r=>r.id===id);
 const available=(person,event)=>m.availability.find(a=>a.person_id===person&&a.date===event?.scheduled_on)?.state||'unknown';
 const canPublish=()=>IASDPIScheduleEditWindow.month(m.month,m.settings)&&m.catalog?.departments.some(d=>d.id===m.department&&(d.can_publish??d.can_manage)&&d.active);
 const editable=()=>IASDPIScheduleEditWindow.month(m.month,m.settings)&&m.catalog?.departments.some(d=>d.id===m.department&&(d.can_edit??d.can_manage)&&d.active)&&(m.plan?.status!=='published'||canPublish());
 const simple=()=>Boolean(m.settings?.simplified_daily);
 const clean=IASDPIScheduleUI.isReview;
 const musicAutomaticDisabled=()=>lookup('departments',m.department)?.code==='musica';
 const canStartMonth=()=>m.settings&&(m.settings.future_months.includes(m.month+'-01')||m.month===(m.settings.today||'').slice(0,7));
 const canEditDay=day=>editable()&&IASDPIScheduleEditWindow.day(day,m.settings);
 const b=(text,action,extra='')=>`<button type="button" data-b1-action="${action}" ${clean()&&action==='prefill'?'class="schedule-auto-fill"':''} ${extra}>${h(text)}</button>`;
 const input=(label,name,value='',extra='')=>`<label>${h(label)}<input name="${name}" value="${h(value)}" ${extra}></label>`;
 const time=(label,name,value)=>input(label+' — HH:mm',name,value,'type="text" inputmode="numeric" placeholder="09:30" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" required');
 const select=(label,name,options)=>`<label>${h(label)}<select name="${name}">${options}</select></label>`;
 const opt=(value,label,chosen)=>`<option value="${h(value)}" ${value===chosen?'selected':''}>${h(label)}</option>`;
 function redraw(){if(state.page==='schedule-build'){render();positionMusicPickers();}}
 function draft(row){return {id:row?.id||crypto.randomUUID(),department_id:m.department,month:m.month+'-01',title:row?.title||'Escala mensal',status:row?.status||'draft',version:row?.version||0,requirements:(row?.requirements||[]).map(r=>({id:r.id,event_id:r.event_id,role_id:r.role_id,required_count:r.required_count,notes:r.notes||'',assignments:(r.assignments||[]).map(a=>({id:a.id,person_id:a.person_id,starts_at:a.starts_at,ends_at:a.ends_at,...(a.timing_mode?{timing_mode:a.timing_mode}:{})}))}))};}
 function adopt(workspace){
  if(!workspace||!Array.isArray(workspace.events)||!Array.isArray(workspace.versions)||(workspace.plan&&!Array.isArray(workspace.plan.requirements)))throw Error('Resposta de escala inválida.');
  m.monthly=Boolean(workspace.monthly);m.context=workspace.rotation_context||null;m.settings=workspace.settings||null;m.availability=workspace.availability||[];m.events=workspace.events;m.versions=workspace.versions;m.plan=draft(workspace.plan);m.rotationReasons=[];m.dirty=false;m.selected=[];m.remote=null;m.history=null;m.request=crypto.randomUUID();
 }
 async function load(){
  const ticket=++m.generation;m.status='loading';m.error='';redraw();
  try{
   const catalog=await rpc('iasdpi_schedule_catalog');
   if(ticket!==m.generation)return;
   if(!catalog?.actor_id||['departments','roles','people','memberships','qualifications'].some(key=>!Array.isArray(catalog[key])))throw Error('Resposta de permissões inválida.');
   if(m.owner&&m.owner!==catalog.actor_id){m.plan=null;m.dirty=false;m.events=[];m.department='';m.selected=[];m.remote=null;m.history=null;}
   m.owner=catalog.actor_id;m.catalog=catalog;
   const preferred=window.IASDPIPortalAccess?.enabled()?IASDPIPortalAccess.preferred():'';if(catalog.departments.some(d=>d.id===preferred))m.department=preferred;
   const departments=IASDPIScheduleUI.departments(catalog);
   if(!departments.some(d=>d.id===m.department))m.department=departments[0]?.id||'';
   if(!m.department)throw Error('Solicite ao administrador acesso de gestão ou consulta a um departamento.');
   const workspaceForMonth=async()=>{const settings=lookup('departments',m.department)?.code==='ancionato'?await rpc('iasdpi_schedule_settings_get'):null;return settings?.elder_periods?{settings,events:[],versions:[],plan:null}:rpc('iasdpi_schedule_workspace',{p_department:m.department,p_month:m.month+'-01'});};
   let workspace=await workspaceForMonth();
   if(workspace.settings&&!m.periodInitialized){m.month=workspace.settings.schedule_edit_policy?workspace.settings.today.slice(0,7):workspace.settings.future_months[0].slice(0,7);m.periodInitialized=true;workspace=await workspaceForMonth();}
   if(ticket!==m.generation)return;
   m.settings=workspace.settings||null;
   if(!(workspace.settings?.elder_periods&&lookup('departments',m.department)?.code==='ancionato')&&workspace.settings?.simplified_daily&&editable()&&!m.catalog.roles.some(r=>r.department_id===m.department&&r.general_assignment&&r.active)){
    const role=await rpc('iasdpi_schedule_daily_role',{p_department:m.department});if(ticket!==m.generation)return;m.catalog.roles.push(role);
   }
   if(!m.dirty)adopt(workspace);else{m.events=workspace.events;m.versions=workspace.versions;m.settings=workspace.settings||null;m.availability=workspace.availability||[];m.context=workspace.rotation_context||null;}
   ensureDailySlots();
   if(simple()&&m.settings?.schedule_edit_policy&&editable()&&canStartMonth()&&!m.plan.requirements.some(r=>IASDPIScheduleEditWindow.day(m.events.find(e=>e.id===r.event_id)?.scheduled_on,m.settings))){await createDays(false);if(ticket!==m.generation)return;}
   m.status='ready';redraw();
  }catch(e){if(ticket!==m.generation)return;m.status='error';m.error=e.message;redraw();}
 }
 function canLeave(){
  if(window.IASDPIRegistry&&!IASDPIRegistry.canLeave())return false;
  if(window.IASDPIScheduleDepartmentDays&&!IASDPIScheduleDepartmentDays.canLeave())return false;
  if(window.IASDPIScheduleElders&&!IASDPIScheduleElders.canLeave())return false;
  if(window.IASDPIScheduleDailyAdmin&&!IASDPIScheduleDailyAdmin.canLeave())return false;
  if(m.saving){alert('Aguarde a confirmação do salvamento da escala.');return false;}
  if(m.dirty&&!confirm('Descartar somente as alterações ainda não salvas desta escala?'))return false;
  if(m.dirty){m.dirty=false;m.plan=null;m.status='idle';}return true;
 }
 function dirty(){m.rotationReasons=[];m.dirty=true;m.request=crypto.randomUUID();m.feedback='Alterações pendentes, ainda não salvas.';m.remote=null;}
 function vacancies(plan=m.plan){return (plan?.requirements||[]).filter(r=>IASDPIScheduleEditWindow.day(m.events.find(e=>e.id===r.event_id)?.scheduled_on,m.settings)).reduce((sum,r)=>sum+Math.max(0,r.required_count-r.assignments.length),0);}
 function eligible(role){const general=lookup('roles',role)?.general_assignment;return (m.catalog?.people||[]).filter(p=>p.active&&m.catalog.memberships.some(member=>member.person_id===p.id&&member.department_id===m.department&&member.active&&(general||m.catalog.qualifications.some(q=>q.membership_id===member.id&&q.role_id===role))));}
 function departmentDay(event){const weekdays=m.settings?.department_weekdays?.[m.department];return !weekdays||weekdays.includes(new Date(event.scheduled_on+'T12:00:00Z').getUTCDay())||(m.settings.extra_dates||[]).includes(event.scheduled_on);}
 function ensureDailySlots(){
  if(!simple()||!editable()||!m.plan||m.plan.status==='published'&&!m.settings.schedule_edit_policy)return;
  const role=m.catalog.roles.find(r=>r.department_id===m.department&&r.active&&r.general_assignment);if(!role)return;
  let added=0;for(const e of m.events.filter(e=>e.scheduled_on.slice(0,7)===m.month&&e.timing_mode==='day'&&departmentDay(e)&&IASDPIScheduleEditWindow.day(e.scheduled_on,m.settings)))if(!m.plan.requirements.some(r=>r.event_id===e.id)){m.plan.requirements.push({id:crypto.randomUUID(),event_id:e.id,role_id:role.id,required_count:1,notes:'',assignments:[]});added++;}
  if(added&&(!m.settings.schedule_edit_policy||m.plan.version>0))dirty();
 }
 function rotationSource(strict=false){return {catalog:m.catalog,context:m.context,department:m.department,events:m.events,plan:m.plan,allowedPeople:IASDPIRotationTeam.selected(m.catalog,m.department,IASDPIRotationTeam.key(m.owner,m.department,'monthly'),strict)};}
 function volunteerField(r,slot,prefix,compact=false){
  const event=m.events.find(e=>e.id===r.event_id),people=eligible(r.role_id),a=r.assignments[slot],current=lookup('people',a?.person_id),choices=m.monthly?m.catalog.people.filter(p=>m.catalog.memberships.some(member=>member.person_id===p.id&&member.department_id===m.department)):[...people];
  if(current&&!choices.some(p=>p.id===current.id))choices.push(current);choices.sort(IASDPIScheduleRules.comparePeople);
  const options=opt('','Vaga pendente',a?.person_id||'')+choices.map(p=>{
   const status=available(p.id,event),reasons=m.monthly?IASDPIScheduleRotation.manualReasons(rotationSource(),r,p.id,a?.id):[];
   const blocked=Boolean(m.monthly?reasons.length:m.settings&&status!=='available'),warning=blocked||status==='unavailable';
   return opt(p.id,p.display_name+(warning?' · ⚠ Indisponível':''),a?.person_id).replace('<option ','<option '+(warning?'class="schedule-person-unavailable" ':'')+(blocked&&p.id!==a?.person_id?'disabled ':''));
  }).join('');
  return select(compact?'Pessoa'+(r.required_count>1?' '+(slot+1):''):'Voluntário '+(slot+1),'volunteer',options).replace('<select ','<select '+(compact?'data-calendar-volunteer ':'')+'aria-label="'+h((compact?'Calendário · ':'')+'Voluntário '+(slot+1)+' · '+prefix)+'" data-slot="'+slot+'" '+(m.saving?'disabled ':''));
 }
 function musicTeam(row){return simple()&&lookup('departments',m.department)?.code==='musica'&&lookup('roles',row.role_id)?.general_assignment;}
 function musicPeople(row,prefix){
  const choices=m.catalog.people.filter(person=>m.catalog.memberships.some(member=>member.person_id===person.id&&member.department_id===m.department));
  for(const assignment of row.assignments)if(!choices.some(person=>person.id===assignment.person_id))choices.push(m.catalog.people.find(person=>person.id===assignment.person_id)||{id:assignment.person_id,display_name:'Pessoa não encontrada'});
  choices.sort(IASDPIScheduleRules.comparePeople);
  const names=row.assignments.map(a=>choices.find(p=>p.id===a.person_id)?.display_name).filter(Boolean).sort(IASDPIScheduleRules.compareNames),label=names.length===1?names[0]:names.length+' membros';
  return `<details class="music-picker" data-music-picker="${h(row.id)}" ${m.musicPicker===row.id?'open':''}><summary aria-label="${h('Selecionar membros · '+prefix+(names.length?' · '+names.join(', '):''))}"><span>${names.length?h(label):'Selecionar membros'}</span><span aria-hidden="true">⌄</span></summary><fieldset class="music-team"><legend class="sr-only">Pessoas escaladas · ${h(prefix)}</legend>${choices.map(person=>{const current=row.assignments.find(a=>a.person_id===person.id),reasons=IASDPIScheduleRotation.manualReasons(rotationSource(),row,person.id,current?.id),warning=reasons.length||available(person.id,m.events.find(e=>e.id===row.event_id))==='unavailable';return `<div class="music-person"><label class="checkbox"><input type="checkbox" name="music-volunteer" data-music-volunteer value="${h(person.id)}" aria-label="${h(person.display_name+' · '+prefix)}" ${current?'checked':''} ${m.saving||!editable()||reasons.length&&!current?'disabled':''}><span>${h(person.display_name)}${warning?'<small class="schedule-person-unavailable"> ⚠ Indisponível</small>':''}</span></label></div>`;}).join('')||'<p>Nenhuma pessoa vinculada à Música.</p>'}</fieldset></details>`;
 }
 function positionMusicPickers(){
  for(const picker of document.querySelectorAll('.music-picker[open]')){
   const panel=picker.querySelector('.music-team'),rect=picker.querySelector('summary').getBoundingClientRect(),width=Math.min(300,innerWidth-24),below=innerHeight-rect.bottom-12,above=rect.top-12,height=Math.min(320,Math.max(below,above));
   panel.style.width=width+'px';panel.style.maxHeight=Math.max(100,height)+'px';panel.style.left=Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px';
   if(below>=Math.min(200,above)){panel.style.top=Math.max(12,rect.bottom+4)+'px';panel.style.bottom='auto';}else{panel.style.top='auto';panel.style.bottom=Math.max(12,innerHeight-rect.top+4)+'px';}
  }
 }
 document.addEventListener('toggle',e=>{if(!e.target.matches('.music-picker')||!e.target.isConnected)return;const picker=e.target;if(picker.open){m.musicPicker=picker.dataset.musicPicker;document.querySelectorAll('.music-picker[open]').forEach(other=>{if(other!==picker)other.open=false;});positionMusicPickers();}else if(m.musicPicker===picker.dataset.musicPicker)m.musicPicker='';},true);
 document.addEventListener('click',e=>{if(e.target.closest('.music-picker'))return;document.querySelectorAll('.music-picker[open]').forEach(p=>p.open=false);});
 document.addEventListener('keydown',e=>{const picker=e.target.closest('.music-picker[open]');if(e.key==='Escape'&&picker){picker.open=false;picker.querySelector('summary').focus();e.preventDefault();}});
 window.addEventListener('resize',positionMusicPickers);document.addEventListener('scroll',positionMusicPickers,true);
 function metricsView(stats){return `<dl class="monthly-metrics"><div><dt>Total de vagas</dt><dd>${stats.total}</dd></div><div><dt>Preenchidas</dt><dd>${stats.filled}</dd></div><div><dt>Pendentes</dt><dd>${stats.pending}</dd></div><div><dt>Pessoas escaladas</dt><dd>${stats.people.length}</dd></div><div><dt>Atribuições com impedimentos</dt><dd>${m.context?stats.conflicts:'Não verificado'}</dd></div>${simple()&&(!clean()||m.settings.availability_enabled!==false)?`<div><dt>Escolhas fora das preferências</dt><dd>${stats.advisories}</dd></div>`:''}</dl>`;}
 function requirements(plan=m.plan,readOnly=false,onlyDay=''){
  if(!plan?.requirements.length)return '<p class="empty">Nenhuma função incluída. Selecione eventos e adicione uma função.</p>';
  return plan.requirements.filter(r=>!onlyDay||m.events.find(e=>e.id===r.event_id)?.scheduled_on===onlyDay).map(r=>{
   const role=lookup('roles',r.role_id),event=m.events.find(e=>e.id===r.event_id),people=eligible(r.role_id);
   const prefix=eventName(event)+(role?.general_assignment?'':' · '+(role?.name||'Função indisponível'));
   return `<fieldset class="b1-requirement" data-requirement="${h(r.id)}"><legend>${h(prefix)}</legend><p>${r.assignments.length}/${r.required_count} vagas preenchidas</p>${readOnly?`<ul>${r.assignments.map(a=>`<li>${h(window.IASDPIRegistry?.personName(m.catalog,a.person_id)||lookup('people',a.person_id)?.display_name||'Pessoa indisponível')}${a.timing_mode==='day'?' · Por dia':' · '+hour(a.starts_at||event?.starts_at)+'–'+hour(a.ends_at||event?.ends_at)}</li>`).join('')}</ul><p>${h(r.notes)}</p>`:
    `<div class="schedule-grid">${Array.from({length:r.required_count},(_,slot)=>volunteerField(r,slot,prefix)).join('')}</div>${m.monthly?`<details><summary>Sugestões e impedimentos</summary><ul>${IASDPIScheduleRotation.candidates(rotationSource(),r).map(c=>{const message=c.reasons.join('; ')||IASDPIScheduleRotation.warnings(rotationSource(),r,c.person.id).join('; ');return `<li>${h(c.person.display_name)}${message?': '+h(message):''}</li>`;}).join('')}</ul></details>`:''}${input('Observações','notes',r.notes,'maxlength="2000" aria-label="'+h('Observações · '+prefix)+'"')}${simple()&&role?.general_assignment?'':b('Remover função','remove','data-id="'+h(r.id)+'"')}${simple()?'':`<small>${m.settings?'Nova atribuição por dia, sem horário. Valores históricos são preservados.':'O horário integral do evento é usado para novas atribuições; intervalos existentes são preservados.'} ${simple()?'Preferências orientam o automático; a escolha manual fora delas é permitida com aviso. Conflitos e permissões são revalidados no banco.':'Habilitação, disponibilidade e conflitos são revalidados no banco.'}</small>`}`}</fieldset>`;
  }).join('');
 }
 function page(){if(m.status==='ready'&&m.settings?.elder_periods&&lookup('departments',m.department)?.code==='ancionato')return IASDPIScheduleElders.page(m.catalog,m.settings,m.department,m.month,month=>{m.month=month;m.periodInitialized=true;redraw();});return m.status==='ready'&&m.monthly&&m.layout==='monthly'?monthlyPage():manualPage();}
 function distributionTable(stats){
  const people=m.catalog.people.filter(p=>m.catalog.memberships.some(member=>member.person_id===p.id&&member.department_id===m.department)).sort(IASDPIScheduleRules.comparePeople);
  const monthLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(m.month+'-01T12:00:00Z'));
  return `<section class="panel"><h2>Pessoas e distribuição${clean()?IASDPIScheduleUI.help('distribution-help','Atribuições contam vagas; dias contam datas distintas no mês. O histórico considera os dias publicados antes do mês selecionado.','Ajuda sobre a distribuição'):''}</h2><div class="table-scroll schedule-distribution-scroll" tabindex="0" aria-label="Distribuição de escalas por pessoa"><table class="schedule-distribution"><caption>${h(monthLabel)}${clean()?'':' · histórico publicado antes de '+h(displayDate(m.month+'-01'))}</caption><thead><tr><th scope="col">Pessoa</th><th scope="col">Atribuições no mês</th><th scope="col">Dias no mês</th><th scope="col">Histórico anterior (dias)</th></tr></thead><tbody>${people.map(p=>{const count=stats.people.find(row=>row.id===p.id)?.count||0,days=new Set(m.plan.requirements.filter(r=>r.assignments.some(a=>a.person_id===p.id)).map(r=>m.events.find(e=>e.id===r.event_id)?.scheduled_on).filter(Boolean)).size,history=m.context?.people.find(row=>row.person_id===p.id)?.history_count;return `<tr><th scope="row">${h(p.display_name)}</th><td>${count}</td><td>${days}</td><td>${history==null?'—':h(history)}</td></tr>`;}).join('')||'<tr><td colspan="4">Nenhuma pessoa cadastrada neste departamento.</td></tr>'}</tbody></table></div><small class="schedule-table-hint">Deslize a tabela para ver todas as colunas.</small></section>`;
 }
 function publishBar(){
  return `<section class="panel schedule-publishbar" aria-label="Salvar e publicar escala"><div><strong>${m.dirty?'Escala em edição':m.plan.status==='published'?'Escala publicada':'Escala em rascunho'}</strong><p role="status">${h(m.error||(m.saving?'Aguardando confirmação…':vacancies()?vacancies()+' vagas pendentes.':m.dirty?'Alterações pendentes. Pronta para publicar.':m.plan.status==='published'?'Publicação confirmada.':'Rascunho salvo. Publique para exibir no calendário.'))}</p>${clean()?'':`<small>${window.IASDPISchedulePreview?'Demonstração: publicação visível no calendário desta aba.':'Rascunhos não são públicos.'}</small>`}</div><div class="schedule-publish-actions">${editable()?b('Salvar rascunho','save',m.saving?'disabled':''):''}${canPublish()?b(m.saving?'Aguardando confirmação…':'Publicar escala','publish','class="primary" '+(m.saving?'disabled':'')):''}<a class="button schedule-secondary" href="#schedule-calendar" data-b1-nav="schedule-calendar" data-schedule-month="${h(m.month)}" data-schedule-department="${h(lookup('departments',m.department)?.name||'')}">${clean()?'Ver calendário':'Ver no calendário'}</a></div></section>`;
 }
 function monthlyPage(){
  const dept=lookup('departments',m.department),roles=m.catalog.roles.filter(r=>r.active&&r.department_id===m.department),days=dates(m.month,[0,1,2,3,4,5,6]),monthLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(m.month+'-01T12:00:00Z'));
  if(!days.includes(m.day))m.day=m.events[0]?.scheduled_on||days[0];
  const dayEvents=m.events.filter(e=>e.scheduled_on===m.day),stats=IASDPIScheduleRotation.metrics(rotationSource()),heads=m.context?.heads||[];
  const reference=typeof churchMinistries==='undefined'?[]:churchMinistries.filter(x=>x.name===dept.name||(dept.code==='musica'&&x.name==='Ministério da Música')||(dept.code==='diaconato'&&x.name.startsWith('Diaconato —'))).flatMap(x=>x.responsibles);
  const responsibles=heads.length?heads:reference;
  const color=['sonoplastia','diaconato','musica','ancionato','comunicacao'].includes(dept.code)?dept.code:'other';
  const calendar=days.map(day=>{
   const events=m.events.filter(e=>e.scheduled_on===day&&(!simple()||departmentDay(e)||m.plan.requirements.some(r=>r.event_id===e.id))),rows=m.plan.requirements.filter(r=>events.some(e=>e.id===r.event_id)),names=rows.flatMap(r=>r.assignments.map(a=>lookup('people',a.person_id)?.display_name||'Pessoa não encontrada')).sort(IASDPIScheduleRules.compareNames),pending=rows.reduce((n,r)=>n+r.required_count-r.assignments.length,0);
   const label=displayDate(day)+(events.length?' · '+events.map(e=>e.title).join(', '):' · Sem evento')+(names.length?' · '+names.join(', '):'')+(pending?' · '+pending+' vagas pendentes':'');
   const inline=canEditDay(day)&&rows.length;
   const selectors=inline?'<div class="monthly-inline-selectors">'+rows.map(r=>{const role=lookup('roles',r.role_id),event=events.find(e=>e.id===r.event_id),prefix=(dept?.name||'')+' · '+eventName(event)+' · '+(role?.general_assignment?'Pessoa escalada':role?.name||'Função indisponível');return `<div data-requirement="${h(r.id)}">${rows.length>1?`<span class="monthly-slot-role" title="${h((event?.title||'')+' · '+(role?.name||''))}">${h(role?.general_assignment?'Pessoa escalada':role?.name||'Função')}</span>`:''}${musicTeam(r)?musicPeople(r,prefix):Array.from({length:r.required_count},(_,slot)=>volunteerField(r,slot,prefix,true)).join('')}${simple()&&event?.scheduled_on===m.day?`<details class="monthly-note"><summary>Observações${r.notes?' •':''}</summary><label><span class="sr-only">${h('Observações · '+prefix)}</span><textarea name="notes" rows="2" aria-label="${h('Observações · '+prefix)}">${h(r.notes)}</textarea></label></details>`:''}</div>`;}).join('')+'</div>':'';
   return `<div class="monthly-cell ${events.length?'has-events':''} ${inline?'has-selectors':''} ${!IASDPIScheduleEditWindow.day(day,m.settings)?'is-locked':''}"><button type="button" class="monthly-day ${events.length?'has-events':''}" data-b1-action="day" data-day="${day}" aria-label="${h(label)}" aria-pressed="${day===m.day}"><span class="monthly-number">${Number(day.slice(8))}</span><span class="monthly-weekday">${h(new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:'America/Sao_Paulo'}).format(new Date(day+'T12:00:00Z')))}</span>${names.slice(0,3).map(name=>`<span class="monthly-name ${inline?'sr-only':''}">${h(name)}</span>`).join('')}${names.length>3?`<small>+${names.length-3}</small>`:''}${!IASDPIScheduleEditWindow.day(day,m.settings)?'<small class="schedule-date-locked">'+(day<IASDPIScheduleEditWindow.bounds(m.settings).from?'Encerrado':'Fora do período')+'</small>':''}${pending&&IASDPIScheduleEditWindow.day(day,m.settings)?`<small class="monthly-pending">${pending} pendente${pending>1?'s':''}</small>`:!rows.length&&events.length?'<small>Definir funções</small>':''}</button>${selectors}</div>`;
  }).join('');
  return heading('ESCALAS · MONTAGEM MENSAL',dept.name,'Responsável ministerial: '+(responsibles.join(' · ')||'Não informado no cadastro')+'.')+
   (!clean()&&window.IASDPISchedulePreview?`<p class="demo-banner">${window.IASDPIKnownPreviewSeed?.catalog.reference_preview?(window.IASDPIKnownPreviewSeed?.elder_periods?'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidade temporariamente desativada.':window.IASDPIKnownPreviewSeed?.simplified_daily?'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidade padrão para o automático.':'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidades pendentes de confirmação.'):'DEMONSTRAÇÃO — DADOS FICTÍCIOS.'} Salvamento em memória; reinicia ao recarregar.</p>`:'')+
   `<nav class="monthly-departments" aria-label="Departamentos das escalas">${IASDPIScheduleUI.departments(m.catalog).map(d=>b(d.name,'department','data-department="'+h(d.id)+'" aria-pressed="'+(d.id===m.department)+'"')).join('')}</nav>
   <section class="panel"><form id="b1-scope" class="schedule-grid"><input type="hidden" name="department" value="${h(m.department)}">${clean()?IASDPIScheduleUI.monthPicker('schedule-month',m.month,m.saving):input('Mês e ano','month',m.month,'type="month" required')+'<button type="submit">Abrir mês</button>'}</form><div class="monthly-toolbar">${b('Mês anterior','month','data-direction="-1"')}${b('Próximo mês','month','data-direction="1"')}${m.catalog.is_admin?'<a class="button schedule-secondary" href="#schedule-settings" data-b1-nav="schedule-settings">Período de edição</a>':''}${editable()?b(simple()?'Preencher automaticamente':'Pré-preencher por rodízio','prefill','aria-describedby="rotation-requirements-help" '+(m.saving||musicAutomaticDisabled()||(!m.plan.requirements.length&&(!simple()||!canStartMonth()))?'disabled':'')+(musicAutomaticDisabled()?' title="Preenchimento automático da Música temporariamente desativado"':''))+b('Limpar escala','clear','class="schedule-clear" '+(m.saving||!m.plan.requirements.some(r=>r.assignments.length)?'disabled':''))+(simple()?'':b('Salvar rascunho','save',m.saving?'disabled':'')+(canPublish()?b('Publicar escala','publish',m.saving?'disabled':''):'')):''}${!editable()&&canPublish()?b('Publicar escala','publish',m.saving?'disabled':''):''}${b(clean()?'Recarregar escala':window.IASDPISchedulePreview?'Atualizar escala':'Atualizar do banco','reload',m.saving?'disabled':'')}</div>
   ${window.IASDPIScheduleDepartmentDays?.page(m.catalog,m.settings,m.department,m.month)||''}${editable()?IASDPIRotationTeam.view(m.catalog,m.department,IASDPIRotationTeam.key(m.owner,m.department,'monthly'),m.saving):''}
   ${clean()?IASDPIScheduleUI.help('rotation-requirements-help','O preenchimento automático propõe nomes para as vagas vazias. Revise as escolhas antes de salvar. Salvar mantém um rascunho; publicar o exibe no calendário. Limpar escala retira somente os nomes do mês e departamento atuais, mantendo datas, vagas e observações. Recarregar escala recupera a última versão salva e pede confirmação se houver alterações pendentes.','Ajuda sobre a montagem da escala'):`${m.catalog.is_admin?'<p><a href="#schedule-members" data-b1-nav="schedule-members">'+(m.settings.availability_enabled===false?'Membros — disponibilidade desativada':'Dias e restrições por voluntário')+'</a></p>':''}<p id="rotation-requirements-help">${!m.plan.requirements.length?(simple()?'Comece a escala deste mês para escolher as pessoas, ou use Preencher automaticamente para receber uma proposta.':'Para habilitar o rodízio, gere ou cadastre os eventos e adicione as funções e vagas nas datas. Abra “Preparar eventos e informações da escala” abaixo.'):'O rodízio preenche apenas as vagas vazias. Revise a proposta antes de salvar.'}</p><p role="status" id="b1-feedback">${h(m.feedback||(m.dirty?'Alterações pendentes.':'Nenhuma alteração pendente.'))}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}<p>${m.plan.status==='published'?'Publicada':'Rascunho'} · versão ${m.plan.version}. Pré-preencher somente propõe; salvar não publica. ${!window.IASDPISchedulePreview?'Integração de novas escalas com o calendário público aguarda autorização.':''}</p>`}
   ${clean()?'':metricsView(stats)}</section>
   ${simple()&&!m.plan.requirements.length&&editable()&&canStartMonth()?b('Começar escala','start',m.saving?'disabled':''):''}<section class="panel monthly-calendar ${simple()?'simple-daily-calendar':''} monthly-${color}" aria-label="Calendário mensal de ${h(dept.name)}"><h2>${h(monthLabel)}</h2><div class="calendar-weekdays">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<span>${d}</span>`).join('')}</div><div class="monthly-days">${'<span aria-hidden="true"></span>'.repeat(new Date(m.month+'-01T12:00:00Z').getUTCDay())}${calendar}</div></section>
   ${clean()?`<section class="panel schedule-summary" aria-label="Resumo da escala"><h2>Resumo da escala</h2><p role="status" id="b1-feedback">${h(IASDPIScheduleUI.feedback(m.feedback)||(m.dirty?'Alterações pendentes.':''))}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}${m.rotationReasons?.length?'<div class="schedule-rotation-reasons"><a class="button schedule-secondary" href="#schedule-members" data-b1-nav="schedule-members">Conferir equipe</a>'+IASDPIScheduleUI.help('rotation-empty-reasons',m.rotationReasons.join('; '),'Por que não houve sugestões')+'</div>':''}${metricsView(stats)}</section>`:''}
   ${simple()?'':`<section class="panel" id="monthly-day-details" tabindex="-1"><h2>${displayDate(m.day)} — detalhes</h2>${dayEvents.length?'':'<p>Nenhuma escala prevista nesta data.</p>'}${requirements(m.plan,!editable(),m.day)||'<p>Nenhuma função definida nesta data.</p>'}
   ${editable()&&!simple()?`<fieldset ${m.saving?'disabled':''}><legend>Adicionar função no dia</legend><div class="b1-event-list">${dayEvents.map(e=>`<label class="checkbox"><input type="checkbox" name="event" value="${h(e.id)}" ${m.selected.includes(e.id)?'checked':''}>${h(e.title)}</label>`).join('')}</div><form id="b1-add" class="schedule-grid">${select('Função necessária','role',roles.map(r=>opt(r.id,r.name,m.form.role)).join(''))}${input('Vagas por evento','count',m.form.count,'type="number" min="1" max="100" required')}<button type="submit" ${dayEvents.length&&roles.length?'':'disabled'}>Adicionar função aos eventos selecionados</button></form></fieldset>`:''}</section>`}
   ${distributionTable(stats)}
   ${editable()&&!simple()?`<details class="panel"><summary>Preparar eventos e informações da escala</summary><p>Período futuro: ${m.settings.future_months.map(displayDate).join(' · ')}. Não há distribuição automática ao gerar datas.</p><form id="b1-recurring" class="schedule-grid">${input('Nome dos cultos','title',m.form.title,'required maxlength="160"')}<button type="submit" ${m.saving||!m.settings.future_months.includes(m.month+'-01')?'disabled':''}>Gerar dias do período</button></form><form id="b1-extra" class="schedule-grid">${input('Nome do evento','extraTitle',m.form.extraTitle,'required maxlength="160"')}${input('Data — dd/mm/aaaa','extraDate',m.form.extraDate,'required placeholder="10/11/2026"')}<button type="submit" ${m.saving?'disabled':''}>Adicionar evento extraordinário</button></form>${input('Título da escala','planTitle',m.plan.title,'required maxlength="160"')}</details>`:''}
   ${simple()?'':`<p><a href="#schedule-setup" data-b1-nav="schedule-setup">Cadastros e habilitações</a> · <a href="#schedule-calendar" data-b1-nav="schedule-calendar">Calendário público preservado</a>${m.catalog.is_admin?' · <a href="#schedule-members" data-b1-nav="schedule-members">Membros</a> · <a href="#schedule-settings" data-b1-nav="schedule-settings">Configurações</a>':''}</p>`}${simple()?publishBar()+`<details class="panel"><summary>Versões anteriores</summary>${m.versions.length?m.versions.map(v=>b('Consultar versão '+v.version,'version','data-version="'+v.version+'"')).join(''):'<p>Nenhuma versão salva.</p>'}${m.history?requirements(m.history,true):''}</details>`:b('Montagem em lista e versões anteriores','layout')}`;
 }
 function manualPage(){
  const title=heading('ESCALAS · MONTAGEM MANUAL','Montar escala',m.settings?'Escolha o departamento e o mês; preencha as vagas por dia, com disponibilidade confirmada.':'Escolha o departamento e o mês, confirme os horários e preencha as vagas.');
  if(m.status==='idle'){queueMicrotask(load);return title+'<p role="status">Recuperando acesso às escalas…</p>';}
  const preview=!clean()&&window.IASDPISchedulePreview?'<p class="demo-banner">DEMONSTRAÇÃO — DADOS FICTÍCIOS. Alterações somente na memória desta aba; reiniciam ao recarregar. Não há conexão com Supabase.</p>':'';
  const links='<p><a href="#schedule-calendar" data-b1-nav="schedule-calendar">Calendário</a> · <a href="#schedule-setup" data-b1-nav="schedule-setup">Pessoas, funções e disponibilidades</a></p>';
  if(m.status==='loading')return title+preview+links+'<p role="status">Carregando escala e permissões…</p>';
  if(m.status==='error')return title+preview+links+`<section class="panel"><p role="alert">${h(m.error)}</p><p>As migrações 005 e 006 precisam estar instaladas em ambiente autorizado. Seus campos pendentes permanecem em memória para a mesma conta.</p>${b('Tentar novamente','retry')}<form id="b1-login" class="schedule-grid">${window.IASDPIAuth?.loginIdentifierField?IASDPIAuth.loginIdentifierField():input('E-mail','email','','type="email" required autocomplete="username"')}${input('Senha','password','','type="password" required autocomplete="current-password"')}<button type="submit">Entrar</button><p role="status"></p></form><a href="#forgot-password">Esqueci minha senha</a></section>`;
  const adminLinks=m.settings&&m.catalog.is_admin?'<p><a href="#schedule-settings" data-b1-nav="schedule-settings">Configurar período e dias</a> · <a href="#schedule-members" data-b1-nav="schedule-members">Planilha de membros</a></p>':'';
  const roles=m.catalog.roles.filter(r=>r.active&&r.department_id===m.department),f=m.form;
  return title+preview+links+adminLinks+(m.monthly?b('Voltar à visão mensal','layout'):'')+`<section class="panel"><form id="b1-scope" class="schedule-grid">${select('Departamento','department',m.catalog.departments.filter(d=>d.active&&(d.can_manage||d.can_roster)).map(d=>opt(d.id,d.name,m.department)).join(''))}${input('Mês e ano','month',m.month,'type="month" required')}<button type="submit" ${m.saving?'disabled':''}>Abrir escala</button></form></section>
  <section class="panel b1-status"><h2>${h(m.plan.title)}</h2><p>${m.plan.status==='published'?'Publicada':'Rascunho'} · versão ${m.plan.version} · <strong>${vacancies()} vagas pendentes</strong></p><p role="status" id="b1-feedback">${h(m.feedback||(m.dirty?'Alterações pendentes.':'Nenhuma alteração pendente.'))}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}</section>
  ${editable()?`<fieldset class="b1-controls" ${m.saving?'disabled':''}><legend class="sr-only">Montagem manual da escala</legend><section class="panel"><h2>1. Cultos e eventos</h2><form id="b1-recurring" class="schedule-grid">${input('Nome dos cultos','title',f.title,'required maxlength="160"')}${m.settings?'':time('Início','start',f.start)+time('Término','end',f.end)}<fieldset><legend>Gerar datas neste mês</legend>${(m.settings?(m.settings.department_weekdays?.[m.department]||m.settings.weekdays||[]).map(day=>[day,['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][day]]):[[3,'Quartas-feiras'],[6,'Sábados'],[0,'Domingos']]).map(([day,label])=>`<label class="checkbox"><input type="checkbox" name="weekday" value="${day}" ${m.settings?'checked disabled':f.days.includes(day)?'checked':''}> ${label}</label>`).join('')}</fieldset><button type="submit" ${m.settings&&!m.settings.future_months.includes(m.month+'-01')?'disabled':''}>${m.settings?'Gerar dias do período':'Gerar datas'}</button></form><p>${m.settings?'Período de geração (sempre a partir do próximo mês): '+m.settings.future_months.map(displayDate).join(' · ')+'. Dias definidos pelo administrador. Escalas existentes não serão apagadas.':'Horários de America/Sao_Paulo, informados por você. Gere grupos separados para cultos com horários diferentes. Eventos iguais já cadastrados são reutilizados.'}</p>
  <details><summary>Adicionar evento extraordinário</summary><form id="b1-extra" class="schedule-grid">${input('Nome do evento','extraTitle',f.extraTitle,'required maxlength="160"')}${input('Data — dd/mm/aaaa','extraDate',f.extraDate,'required placeholder="10/10/2026"')}${m.settings?'':time('Início do evento','extraStart',f.extraStart)+time('Término do evento','extraEnd',f.extraEnd)+input('Data final — opcional, dd/mm/aaaa','extraEndDate',f.extraEndDate,'placeholder="11/10/2026"')}<button type="submit">Adicionar evento</button></form></details></section>
  <section class="panel"><h2>${simple()?'2. Pessoas escaladas':'2. Funções e voluntários'}</h2><div class="b1-event-list">${m.events.map(e=>`<label class="checkbox"><input type="checkbox" name="event" value="${h(e.id)}" ${m.selected.includes(e.id)?'checked':''}> ${h(eventName(e))}</label>`).join('')||'<p>Nenhum evento cadastrado neste mês. Gere datas ou adicione um evento acima.</p>'}</div>${simple()?'':`<form id="b1-add" class="schedule-grid">${select('Função necessária','role',roles.map(r=>opt(r.id,r.name,f.role)).join(''))}${input('Vagas por evento','count',f.count,'type="number" min="1" max="100" required')}<button type="submit" ${roles.length?'':'disabled'}>Adicionar função aos eventos selecionados</button></form>`}${!roles.length?'<p>Cadastre as funções confirmadas deste departamento em Cadastros antes de continuar.</p>':''}${input('Título da escala','planTitle',m.plan.title,'required maxlength="160"')}<div id="b1-requirements">${requirements()}</div></section></fieldset>`:`<section class="panel"><p>Consulta autorizada. Somente administradores e gestores do departamento podem alterar esta escala.</p>${requirements(m.plan,true)}</section>`}
  <section class="panel b1-save"><p>Salvar rascunho não publica. Publicar exige cobertura completa e confirmação.</p>${editable()?b(m.saving?'Aguardando confirmação…':'Salvar rascunho','save','class="primary" '+(m.saving?'disabled':''))+(canPublish()?b('Publicar escala','publish',m.saving?'disabled':''):''):''}${!editable()&&canPublish()?b('Publicar escala','publish',m.saving?'disabled':''):''}${b('Atualizar do banco','reload',m.saving?'disabled':'')}${b('Comparar versão salva','compare',m.saving?'disabled':'')}</section>
  ${m.remote?`<section class="panel"><h2>Versão salva no banco — ${m.remote.version}</h2><p>Seu formulário não foi substituído. Atualize do banco somente após revisar as diferenças.</p>${requirements(m.remote,true)}</section>`:''}
  <section class="panel"><h2>Histórico de versões</h2>${m.versions.length?m.versions.map(v=>b('Consultar versão '+v.version,'version','data-version="'+v.version+'"')).join(''):'<p>A primeira versão será criada após confirmar o salvamento.</p>'}${m.history?`<h3>Versão ${m.history.version} · ${h(m.history.title)}</h3>${requirements(m.history,true)}`:''}</section>`;
 }
 function capture(form){const data=new FormData(form);for(const key of Object.keys(m.form))if(key!=='days'&&data.has(key))m.form[key]=String(data.get(key));if(form.id==='b1-recurring')m.form.days=data.getAll('weekday').map(Number);}
 async function createEvents(extra=false){
  if(m.settings)return createDays(extra);
  const f=m.form,parse=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v:tryReadDate(v);
  const date=extra?parse(f.extraDate):null,endDate=extra&&f.extraEndDate?parse(f.extraEndDate):null;
  if(extra&&(!date||(f.extraEndDate&&!endDate)||date.slice(0,7)!==m.month))throw Error('Revise a data do evento: deve pertencer ao mês selecionado.');
  const days=extra?[date]:dates(m.month,f.days);if(!days.length)throw Error('Selecione pelo menos um dia da semana.');
  const start=extra?f.extraStart:f.start,end=extra?f.extraEnd:f.end;
  if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end)||(!endDate&&end<=start))throw Error('Informe início e término válidos em HH:mm. Para atravessar a meia-noite, use um evento extraordinário com data final.');
  m.saving=true;m.error='';m.feedback='Confirmando eventos…';redraw();let count=0;
  try{for(const day of days){
   const event=await rpc('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:m.department,title:extra?f.extraTitle:f.title,date:day,start_time:start,end_time:end,...(endDate?{end_date:endDate}:{})},p_request_id:crypto.randomUUID()});
   if(!event?.id||!event.starts_at||!event.ends_at)throw Error('Resposta de evento inválida. Consulte a lista antes de repetir.');
   if(!m.events.some(e=>e.id===event.id))m.events.push(event);count++;
  }m.events.sort((a,b)=>a.starts_at.localeCompare(b.starts_at));m.feedback=count+' eventos confirmados'+(window.IASDPISchedulePreview?' nesta demonstração.':' pelo Supabase.');
  }catch(e){m.error=e.message+' '+count+' eventos já confirmados; os restantes não foram confirmados. Repetir reutiliza eventos existentes.';}finally{m.saving=false;redraw();}
 }
 async function createDays(extra){
  const f=m.form,date=/^\d{4}-\d{2}-\d{2}$/.test(f.extraDate)?f.extraDate:tryReadDate(f.extraDate);
  if(extra&&(!date||date.slice(0,7)!==m.month))throw Error('Informe uma data válida do mês selecionado.');
  m.saving=true;m.error='';m.feedback='Confirmando dias…';redraw();
  try{
   if(!extra&&!canStartMonth())throw Error('Selecione o mês atual ou um mês do período de planejamento.');
   let result;
   if(!extra&&m.settings.schedule_edit_policy){result=await rpc('iasdpi_schedule_prepare_month',{p_department:m.department,p_month:m.month+'-01',p_request_id:crypto.randomUUID(),p_title:f.title});}
   else if(!extra&&m.month===(m.settings.today||'').slice(0,7)){
    const weekdays=m.settings.department_weekdays?.[m.department]||m.settings.weekdays,events=[];
    const days=[...new Set([...dates(m.month,weekdays),...(m.settings.extra_dates||[]).filter(day=>day.slice(0,7)===m.month)])].sort();
    for(const day of days)events.push(await rpc('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:m.department,title:f.title,date:day},p_request_id:crypto.randomUUID()}));
    result={events};
   }else result=extra?await rpc('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:m.department,title:f.extraTitle,date},p_request_id:crypto.randomUUID()}):await rpc('iasdpi_schedule_generate_days',{p_department:m.department,p_title:f.title,p_request_id:crypto.randomUUID()});
   const events=extra?[result]:result.events;if(!Array.isArray(events))throw Error('Resposta de geração inválida.');
   m.events=[...new Map([...m.events,...events.filter(e=>e.scheduled_on.slice(0,7)===m.month)].map(e=>[e.id,e])).values()];
   const workspace=await rpc('iasdpi_schedule_workspace',{p_department:m.department,p_month:m.month+'-01'});m.events=workspace.events;m.settings=workspace.settings;m.availability=workspace.availability||[];m.context=workspace.rotation_context||null;ensureDailySlots();
   m.feedback=events.length+' dias confirmados'+(window.IASDPISchedulePreview?' somente na demonstração.':' pelo Supabase.')+(m.dirty?' Revise e salve as vagas pendentes.':'');
  }catch(e){m.error=e.message+' Confira a lista antes de repetir a operação.';}finally{m.saving=false;redraw();}
 }
 function addRequirements(){
  const chosen=lookup('roles',m.form.role),role=chosen?.department_id===m.department&&chosen.active?chosen:m.catalog.roles.find(r=>r.department_id===m.department&&r.active),count=Number(m.form.count);
  if(!m.selected.length||!role||role.department_id!==m.department||!Number.isInteger(count)||count<1||count>100)throw Error('Selecione eventos, uma função e de 1 a 100 vagas.');
  let added=0;for(const event_id of m.selected)if(!m.plan.requirements.some(r=>r.event_id===event_id&&r.role_id===role.id)){m.plan.requirements.push({id:crypto.randomUUID(),event_id,role_id:role.id,required_count:count,notes:'',assignments:[]});added++;}
  if(added)dirty();else m.feedback='As funções selecionadas já estão neste plano; nenhum item foi duplicado.';redraw();
 }
 async function save(status){
  if((status==='published'?!canPublish():!editable())||m.saving)return;
  if(!m.plan.title.trim())throw Error('Informe o título da escala.');
  if(status==='published'&&!confirm(vacancies()&&m.settings?.allow_pending_publication?'Publicar esta escala com '+vacancies()+' vaga(s) pendente(s)? Elas aparecerão como A definir.':'Publicar esta escala após validar os conflitos?'))return;
  if(status==='draft'&&m.plan.status==='published'&&!confirm(window.IASDPISchedulePreview?'Salvar esta revisão como rascunho? A publicação anterior continua no calendário e no histórico até publicar novamente.':'Salvar a revisão como rascunho? A publicação anterior continua no calendário até publicar novamente.'))return;
  const id=m.plan.id,expected=m.plan.version;
  const data=editable()?{department_id:m.department,month:m.month+'-01',title:m.plan.title,status,requirements:structuredClone(m.plan.requirements)}:{status};
  const signature=JSON.stringify(data);if(m.signature&&m.signature!==signature)m.request=crypto.randomUUID();m.signature=signature;const request=m.request;
  m.saving=true;m.error='';m.feedback='Aguardando confirmação do salvamento…';redraw();
  try{
   const row=await rpc('iasdpi_schedule_plan_save',{p_id:id,p_expected_version:expected,p_data:data,p_request_id:request});
   if(row?.id!==id||!Number.isInteger(row.version)||row.version!==expected+1||!Array.isArray(row.requirements))throw Error('Confirmação inválida. Consulte a versão salva antes de repetir.');
   m.plan=draft(row);if(status==='published')window.dispatchEvent(new Event('iasdpi-schedule-published'));m.dirty=false;m.request=crypto.randomUUID();m.remote=null;
   m.versions.unshift({version:row.version});m.feedback=window.IASDPISchedulePreview?'Alterações confirmadas apenas na memória desta demonstração.'+(status==='published'?' Escala publicada. Abra Ver no calendário.':' Rascunho salvo; ainda não publicado.'):(status==='published'?'Publicação':'Rascunho')+' confirmada pelo Supabase.';
   if(m.monthly){m.context=null;try{m.context=await rpc('iasdpi_schedule_rotation_context',{p_department:m.department,p_month:m.month+'-01'});}catch(_){m.feedback+=' O rodízio precisa atualizar seus dados antes de uma nova sugestão.';}}
  }catch(e){m.error=e.message+' Seus campos continuam no formulário; nenhuma confirmação de gravação foi recebida.';m.feedback='';}
  finally{m.saving=false;redraw();}
 }
 document.addEventListener('submit',e=>{
  const form=e.target;if(!['b1-scope','b1-recurring','b1-extra','b1-add','b1-login'].includes(form.id))return;e.preventDefault();e.stopImmediatePropagation();
  if(m.saving)return;
  void(async()=>{
   if(form.id==='b1-scope'){const data=new FormData(form),month=String(data.get('month'));dates(month,[]);if(clean()&&month===m.month&&String(data.get('department'))===m.department)return;if(!canLeave()){IASDPIScheduleUI.restoreMonth(form,m.month);return;}m.department=String(data.get('department'));m.month=month;m.periodInitialized=true;m.plan=null;m.dirty=false;m.feedback='';await load();return;}
   if(form.id==='b1-login'){const email=form.elements.email.value,password=form.elements.password.value;form.elements.password.value='';await IASDPIAuth.loginIdentity(email,password);await load();return;}
   if(!editable())throw Error('Sem gestão deste departamento.');capture(form);
   if(form.id==='b1-recurring')await createEvents();if(form.id==='b1-extra')await createEvents(true);if(form.id==='b1-add')addRequirements();
  })().catch(error=>{m.error=error.message;redraw();});
 },true);
 document.addEventListener('input',e=>{
  if(state.page!=='schedule-build'||m.saving)return;const field=e.target,form=field.closest('form');if(form)capture(form);
  if(field.name==='planTitle'){m.plan.title=field.value;dirty();}
  if(field.name==='notes'){const r=m.plan.requirements.find(r=>r.id===field.closest('[data-requirement]')?.dataset.requirement);if(r&&canEditDay(m.events.find(e=>e.id===r.event_id)?.scheduled_on)){r.notes=field.value;dirty();}}
  const feedback=document.getElementById('b1-feedback');if(feedback&&m.dirty)feedback.textContent=m.feedback;
 });
 document.addEventListener('change',e=>{
  if(state.page!=='schedule-build'||m.saving)return;const field=e.target,form=field.closest('form');if(form)capture(form);
  if(field.name==='event')m.selected=[...document.querySelectorAll('.b1-event-list input:checked')].map(el=>el.value);
  if(field.hasAttribute('data-music-volunteer')){
   const row=m.plan.requirements.find(r=>r.id===field.closest('[data-requirement]')?.dataset.requirement);if(!row||!musicTeam(row)||!canEditDay(m.events.find(e=>e.id===row.event_id)?.scheduled_on)){redraw();return;}
   m.musicPicker=row.id;
   const existing=row.assignments.find(a=>a.person_id===field.value);
   if(field.checked&&!existing){const reasons=IASDPIScheduleRotation.manualReasons(rotationSource(),row,field.value);if(reasons.length||row.assignments.length>=100){m.error=reasons.join('; ')||'Máximo de 100 pessoas por atividade.';redraw();return;}row.assignments.push({id:crypto.randomUUID(),person_id:field.value,timing_mode:'day',starts_at:null,ends_at:null});}
   else if(!field.checked)row.assignments=row.assignments.filter(a=>a.person_id!==field.value);
   else return;
   row.required_count=Math.max(1,row.assignments.length);m.day=m.events.find(event=>event.id===row.event_id)?.scheduled_on||m.day;dirty();m.error='';redraw();document.querySelector('[data-requirement="'+row.id+'"] [data-music-volunteer][value="'+field.value+'"]')?.focus({preventScroll:true});return;
  }
  if(field.name==='volunteer'){
   const r=m.plan.requirements.find(r=>r.id===field.closest('[data-requirement]')?.dataset.requirement),slot=Number(field.dataset.slot);if(!r||!canEditDay(m.events.find(e=>e.id===r.event_id)?.scheduled_on)){redraw();return;}
   const scope=field.closest('.monthly-inline-selectors')?'.monthly-inline-selectors':field.closest('#monthly-day-details')?'#monthly-day-details':'#b1-requirements';
   if(scope==='.monthly-inline-selectors'){m.day=m.events.find(e=>e.id===r.event_id)?.scheduled_on||m.day;m.selected=m.events.filter(e=>e.scheduled_on===m.day).map(e=>e.id);}
   if(field.value){const existing=r.assignments[slot];r.assignments[slot]=existing?.person_id===field.value?existing:{id:crypto.randomUUID(),person_id:field.value,...(m.settings?{timing_mode:'day'}:{})};}
   else r.assignments.splice(slot,1);
   r.assignments=r.assignments.filter(Boolean);dirty();redraw();document.querySelector(scope+' [data-requirement="'+r.id+'"] select[data-slot="'+Math.min(slot,r.required_count-1)+'"]')?.focus({preventScroll:true});
  }
 });
 document.addEventListener('click',e=>{
  const link=e.target.closest('[data-b1-nav]');if(link&&window.IASDPINavigation){e.preventDefault();if(link.dataset.scheduleMonth)IASDPIScheduleCalendar.show({month:link.dataset.scheduleMonth,department:link.dataset.scheduleDepartment});void IASDPINavigation.navigate(link.dataset.b1Nav);return;}
  const button=e.target.closest('[data-b1-action]');if(!button||m.saving)return;e.preventDefault();
  void(async()=>{
   const action=button.dataset.b1Action;
   if(action==='start'&&editable())await createDays(false);
   if(action==='layout'){m.layout=m.layout==='monthly'?'list':'monthly';redraw();}
   if(action==='day'){m.day=button.dataset.day;m.selected=m.events.filter(e=>e.scheduled_on===m.day).map(e=>e.id);redraw();if(simple())document.querySelector('[data-b1-action=day][data-day="'+m.day+'"]')?.focus({preventScroll:true});else document.querySelector('#monthly-day-details')?.focus();}
   if(action==='department'||action==='month'){
    if(!canLeave())return;
    if(action==='department')m.department=button.dataset.department;
    else{const date=new Date(m.month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+Number(button.dataset.direction));m.month=date.toISOString().slice(0,7);}
    m.periodInitialized=true;m.day='';m.plan=null;m.feedback='';await load();
   }
   if(action==='clear'&&editable()){
    if(!m.plan?.requirements.some(r=>r.assignments.length))return;
    const department=lookup('departments',m.department)?.name||'este departamento',month=m.month.slice(5)+'/'+m.month.slice(0,4);
    if(!confirm('Limpar os nomes da escala de '+department+' de '+month+'? Datas, vagas e observações serão mantidas. A limpeza ficará pendente até salvar.'))return;
    for(const row of m.plan.requirements)if(canEditDay(m.events.find(e=>e.id===row.event_id)?.scheduled_on))row.assignments=[];
    dirty();m.error='';m.feedback='Nomes removidos. Salve o rascunho para confirmar.';redraw();document.querySelector('[data-b1-action=prefill]')?.focus({preventScroll:true});
   }
   if(action==='prefill'&&editable()&&!musicAutomaticDisabled()){
    if(simple()&&!m.plan.requirements.length){await createDays(false);if(m.error)throw Error(m.error);}
    const ticket=m.generation;m.saving=true;m.error='';m.feedback='Consultando disponibilidade, histórico e conflitos…';redraw();
    try{
     const catalog=await rpc('iasdpi_schedule_catalog');if(ticket!==m.generation)return;
     if(catalog.actor_id!==m.owner||!catalog.departments.some(d=>d.id===m.department&&(d.can_edit??d.can_manage)&&d.active))throw Error('Permissão de gestão mudou. Seu formulário foi preservado.');
     const context=await rpc('iasdpi_schedule_rotation_context',{p_department:m.department,p_month:m.month+'-01'});
     if(ticket!==m.generation)return;
     if(context.department_id!==m.department||context.month!==m.month+'-01')throw Error('Contexto do rodízio inválido; seu formulário foi preservado.');
     m.catalog=catalog;m.context=context;const proposal=IASDPIScheduleRotation.propose(rotationSource(true));m.plan=proposal.plan;
     if(proposal.added)dirty();
     m.rotationReasons=[];if(!proposal.added&&vacancies()){const reasons=m.plan.requirements.filter(r=>r.assignments.length<r.required_count&&canEditDay(m.events.find(e=>e.id===r.event_id)?.scheduled_on)).flatMap(r=>IASDPIScheduleRotation.candidates(rotationSource(),r).flatMap(c=>c.reasons));m.rotationReasons=[...new Set(reasons)];}
     m.feedback=proposal.added?`Proposta editável: ${proposal.added} vagas sugeridas; ${vacancies()} pendentes. Atribuições existentes preservadas. Revise antes de salvar ou publicar.`:vacancies()?'0 vagas sugeridas. Nenhuma pessoa elegível.':'0 vagas sugeridas. Nenhuma vaga pendente neste período.';
    }catch(error){m.error=error.message;}finally{m.saving=false;redraw();}
   }
   if(action==='retry')await load();
   if(action==='reload'){if(canLeave()){m.plan=null;m.dirty=false;m.feedback='';await load();}}
   if(action==='save'||action==='publish')await save(action==='publish'?'published':'draft');
   if(action==='remove'&&editable()&&confirm('Remover esta função e suas atribuições somente do rascunho em edição?')){m.plan.requirements=m.plan.requirements.filter(r=>r.id!==button.dataset.id);dirty();redraw();}
   if(action==='compare'){const data=await rpc('iasdpi_schedule_workspace',{p_department:m.department,p_month:m.month+'-01'});m.remote=data.plan;m.feedback=data.plan?'Comparação carregada. Seu formulário foi preservado.':'Ainda não existe uma versão salva no banco.';redraw();}
   if(action==='version'){m.history=await rpc('iasdpi_schedule_plan_version',{p_id:m.plan.id,p_version:Number(button.dataset.version)});redraw();}
  })().catch(error=>{m.error=error.message;redraw();});
 });
 window.addEventListener('iasdpi-registry-saved',()=>{if(state.page!=='schedule-build'){m.status='idle';m.catalog=null;}else if(!m.dirty&&!m.saving)void load();});
 window.addEventListener('iasdpi-department-days-saved',e=>{const row=e.detail;if(!m.settings||!row)return;m.settings.department_weekdays[row.department_id]=row.weekdays;m.settings.department_days_versions[row.department_id]=row.version;if(m.department===row.department_id&&m.context)m.context.planning_weekdays=row.weekdays;const d=m.catalog?.departments.find(d=>d.id===row.department_id);if(d)d.version=row.version;redraw();});
 window.addEventListener('beforeunload',e=>{if(m.dirty||m.saving){e.preventDefault();e.returnValue='';}});
 window.addEventListener('iasdpi-identity-ended',()=>{m.generation++;m.status='idle';m.catalog=null;m.context=null;m.remote=null;m.history=null;redraw();});
 window.addEventListener('iasdpi-portal-context',()=>{m.generation++;m.status='idle';m.catalog=null;});
 return {page,load,canLeave,dates};
})();

// B1.1 — projeção administrativa dos cadastros normalizados, sem cadastro paralelo.
window.IASDPIScheduleDailyAdmin=(()=>{
 const m={page:'',status:'idle',data:null,pending:new Map(),saving:false,error:'',feedback:'',generation:0,history:null,person:''};
 const rpc=(name,args={})=>IASDPISchedules.request(name,args),h=v=>esc(v),week=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
 const b=(text,action,extra='')=>`<button type="button" data-daily-action="${action}" ${extra}>${h(text)}</button>`;
 const option=(value,label,chosen)=>`<option value="${h(value)}" ${value===chosen?'selected':''}>${h(label)}</option>`;
 const dates=text=>[...new Set(text.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean).map(value=>{const day=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:tryReadDate(value);if(!day)throw Error('Revise as datas: dd/mm/aaaa, separadas por vírgula.');return day;}))];
 function redraw(){if(['schedule-members','schedule-settings'].includes(state.page))render();}
 async function load(page=m.page){
  const ticket=++m.generation;m.page=page;m.status='loading';m.error='';redraw();
  try{
   const [settings,catalog]=await Promise.all([rpc('iasdpi_schedule_settings_get'),rpc('iasdpi_schedule_catalog')]);
   if(!catalog.is_admin||!settings.can_edit)throw Error('Área restrita aos administradores.');
   const content=await rpc(page==='schedule-members'?'iasdpi_schedule_members':'iasdpi_schedule_exceptions');if(ticket!==m.generation)return;
   m.data={settings,catalog,...(page==='schedule-members'?content:{exceptions:content})};
   if(page==='schedule-members'&&settings.availability_default==='available')m.data.members=m.data.members.map(p=>({...p,weekdays:Object.fromEntries(Array.from({length:7},(_,i)=>[i,p.weekdays?.[i]&&p.weekdays[i]!=='unknown'?p.weekdays[i]:'available']))}));
   m.status='ready';redraw();
  }catch(e){if(ticket!==m.generation)return;m.error=e.message;m.status='error';redraw();}
 }
 function canLeave(){if(m.saving){alert('Aguarde a confirmação administrativa.');return false;}if(m.pending.size&&!confirm('Descartar somente as alterações administrativas ainda não salvas?'))return false;m.pending.clear();return true;}
 function page(which){
  if(which==='schedule-members'&&window.IASDPIRegistry?.enabled())return IASDPIRegistry.page();
  if(m.page!==which||m.status==='idle'){m.page=which;queueMicrotask(()=>load(which));return '<p role="status">Carregando administração das escalas…</p>';}
  const title=heading('ADMINISTRAÇÃO · ESCALAS',which==='schedule-members'?(m.data?.settings.availability_enabled===false?'Membros':'Membros e disponibilidades'):'Período, dias e exceções',IASDPIScheduleUI.isReview()?'':'Cadastros e contas de login são entidades separadas. Somente administradores podem alterar esta página.');
  const nav='<p><a href="#schedule-build" data-b1-nav="schedule-build">Montar escala</a> · <a href="#schedule-members" data-b1-nav="schedule-members">Membros</a> · <a href="#schedule-settings" data-b1-nav="schedule-settings">Configurações</a> · <a href="#schedule-setup" data-b1-nav="schedule-setup">Vínculos e funções</a></p>';
  if(m.status==='loading')return title+nav+'<p role="status">Carregando dados confirmados…</p>';
  if(m.status==='error')return title+nav+`<p role="alert">${h(m.error)}</p><p>Esta área depende da migração 007. Entre com uma conta administradora pela tela de montagem.</p>${b('Tentar novamente','reload')}`;
  const banner=!IASDPIScheduleUI.isReview()&&window.IASDPISchedulePreview?`<p class="demo-banner">${window.IASDPIKnownPreviewSeed?.catalog.reference_preview?(window.IASDPIKnownPreviewSeed?.elder_periods?'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidade temporariamente desativada.':window.IASDPIKnownPreviewSeed?.simplified_daily?'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidade padrão para o automático.':'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidades pendentes de confirmação.'):'DEMONSTRAÇÃO — DADOS FICTÍCIOS.'} Gravação apenas na memória desta aba.</p>`:'';
  return title+banner+nav+`<p role="status">${h(m.feedback)}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}`+(which==='schedule-members'?members():settings());
 }
 function members(){
  if(m.data.settings.availability_enabled===false)return membersWithoutAvailability();
  const c=m.data.catalog;
  const selected=m.data.members.find(p=>p.id===m.person);
  return `<section class="panel daily-person-picker"><h2>Dias e restrições por voluntário</h2><label>Voluntário<select id="daily-person" ${m.saving?'disabled':''}>${option('','Todos — visualizar planilha',m.person)}${c.people.map(p=>option(p.id,p.display_name,m.person)).join('')}</select></label><p>${m.data.settings.availability_advisory?'Todos começam disponíveis por padrão. Dias bloqueados e limites orientam somente o preenchimento automático; a escolha manual é permitida com aviso. Datas específicas indisponíveis prevalecem no automático.':'Selecione uma pessoa para editar seus dias sem rolar a planilha. Marque disponível ou indisponível; sem marcação significa <strong>Pendente de confirmação</strong>. Datas específicas indisponíveis prevalecem sobre os dias disponíveis.'}</p></section>${selected?personDays(m.pending.get(selected.id)||selected):''}<p>Uma pessoa mantém um único UUID em vários ministérios. Edite departamentos e funções pelos cadastros existentes. Limite mensal conta dias distintos; vazio significa não informado.</p><p>${m.data.settings.availability_advisory?'Sem restrição cadastrada = disponível por padrão para o automático. Escolhas manuais fora das preferências recebem aviso. Conflitos entre departamentos e permissões continuam sendo validados.':'Nenhuma flag marcada = disponibilidade desconhecida — Pendente de confirmação. Regras manuais/históricas permanecem preservadas e podem prevalecer sobre as flags.'}</p><details class="panel"><summary>Confirmar habilitação de uma pessoa</summary><p>Liderança ministerial e participação histórica não confirmam uma função. Informe somente a função verificada; a disponibilidade é confirmada separadamente nas flags abaixo.</p><form id="daily-qualification-confirm" class="schedule-grid"><label>Pessoa<select name="person_id">${c.people.filter(p=>p.active).map(p=>option(p.id,p.display_name,'')).join('')}</select></label><label>Departamento<select name="department_id">${c.departments.filter(d=>d.active).map(d=>option(d.id,d.name,'')).join('')}</select></label><label>Função confirmada<input name="role_name" required maxlength="120" placeholder="Informe a função verificada" list="daily-confirmed-roles"></label><datalist id="daily-confirmed-roles">${c.roles.filter(r=>r.active).map(r=>`<option value="${h(r.name)}"></option>`).join('')}</datalist><label class="checkbox"><input name="confirmed" type="checkbox" required>Confirmo que esta pessoa está habilitada para a função informada.</label><button type="submit">Confirmar habilitação</button></form></details><p><a href="#schedule-setup" data-b1-nav="schedule-setup">Cadastrar pessoa / editar vínculos e habilitações</a></p>${m.data.members.map(p=>`<form id="member-${h(p.id)}" data-member-form="${h(p.id)}"></form>`).join('')}
  ${selected?'':`<div class="table-scroll daily-member-scroll" tabindex="0" aria-label="Planilha de membros, rolagem horizontal"><table class="daily-member-table"><caption>Membros da igreja — dados dos cadastros de pessoas, vínculos, habilitações e disponibilidade</caption><thead><tr><th scope="col">Nome</th><th scope="col">Departamentos e funções</th>${week.map(d=>`<th scope="col">${d}</th>`).join('')}<th scope="col">Datas indisponíveis</th><th scope="col">Limite mensal</th><th scope="col">Ativo</th><th scope="col">Ações e histórico</th></tr></thead><tbody>${m.data.members.map(original=>{
   const p=m.pending.get(original.id)||original,form='member-'+p.id,attrs=`form="${h(form)}"`,memberships=c.memberships.filter(member=>member.person_id===p.id),links=memberships.map(member=>{const dep=c.departments.find(d=>d.id===member.department_id);const roles=c.qualifications.filter(q=>q.membership_id===member.id).map(q=>c.roles.find(r=>r.id===q.role_id)?.name).filter(Boolean);return (dep?.name||'Departamento indisponível')+' · '+(member.is_ministry_head?'Responsável ministerial; ':'')+(roles.join(', ')||'Habilitação: Pendente de confirmação')+(member.active?'':' (vínculo inativo)');});
   return `<tr data-member="${h(p.id)}"><td><label>Nome<input ${attrs} name="name" aria-label="Nome · ${h(p.name)}" value="${h(p.name)}" required maxlength="160"></label><small>Exibição: ${h(p.display_name)}</small></td><td>${links.map(h).join('<br>')||'Sem vínculos'}<small>${p.manual_rules||0} regras manuais preservadas</small></td>${week.map((day,i)=>`<td><label class="checkbox"><input ${attrs} type="checkbox" name="available_${i}" aria-label="Disponível ${day} · ${h(p.name)}" ${p.weekdays?.[i]==='available'?'checked':''}> Disponível</label><label class="checkbox"><input ${attrs} type="checkbox" name="unavailable_${i}" aria-label="Indisponível ${day} · ${h(p.name)}" ${p.weekdays?.[i]==='unavailable'?'checked':''}> Indisponível</label></td>`).join('')}<td><label>Datas — dd/mm/aaaa<textarea ${attrs} name="dates" aria-label="Datas indisponíveis · ${h(p.name)}" rows="2">${h(p.raw_dates??(p.unavailable_dates||[]).map(displayDate).join(', '))}</textarea></label></td><td><label>Dias distintos<input ${attrs} type="number" name="max_monthly_count" aria-label="Limite mensal · ${h(p.name)}" min="0" max="100" value="${h(p.max_monthly_count??'')}" placeholder="Pendente de confirmação"></label></td><td><input ${attrs} name="active" type="checkbox" aria-label="Ativo · ${h(p.name)}" ${p.active?'checked':''}></td><td><button type="submit" aria-label="Salvar ${h(p.name)}" ${attrs} ${m.saving?'disabled':''}>Salvar linha</button>${b('Histórico','history','data-person="'+h(p.id)+'" aria-label="Histórico de '+h(p.name)+'"')}<p role="status" data-member-status="${h(p.id)}">${m.pending.has(p.id)?'Alterações pendentes':''}</p></td></tr>`;
  }).join('')}</tbody></table></div>`}${m.history?`<section class="panel" id="daily-history" tabindex="-1"><h2>Histórico de escalas</h2><ul>${m.history.current.map(row=>`<li>${h(displayDate(row.assigned_on))} · ${h(row.department)} · ${h(row.role)} · ${h(row.status)}</li>`).join('')||'<li>Sem atribuições atuais.</li>'}</ul><h3>Versões registradas</h3><ul>${m.history.versions.map(row=>`<li>${h(row.title)} · versão ${row.version} · ${h(row.status)}</li>`).join('')||'<li>Sem versões para esta pessoa.</li>'}</ul></section>`:''}`;
 }
 function membersWithoutAvailability(){
  const c=m.data.catalog,selected=m.data.members.find(p=>p.id===m.person),visible=selected?[selected]:m.data.members;
  return `<section class="panel"><h2>Membros</h2>${IASDPIScheduleUI.isReview()?'':'<p id="availability-paused" role="status">Disponibilidade temporariamente desativada. Os dados anteriores estão preservados e não são usados no preenchimento automático.</p>'}<label>Voluntário<select id="daily-person">${option('','Todos — visualizar planilha',m.person)}${c.people.map(p=>option(p.id,p.display_name,m.person)).join('')}</select></label></section>${m.data.members.map(p=>`<form id="member-${h(p.id)}" data-member-form="${h(p.id)}"></form>`).join('')}
  <div class="table-scroll daily-member-scroll" tabindex="0" aria-label="Cadastro de membros"><table class="daily-member-table members-core"><caption>Pessoas, vínculos e limites mensais — disponibilidade desativada</caption><thead><tr><th>Nome</th><th>Departamentos</th><th>Limite mensal</th><th>Ativo</th><th>Salvar</th></tr></thead><tbody>${visible.map(original=>{const p=m.pending.get(original.id)||original,attrs=`form="member-${h(p.id)}"`;return `<tr data-member="${h(p.id)}"><td><label>Nome<input ${attrs} name="name" value="${h(p.name)}" required maxlength="160"></label></td><td>${c.memberships.filter(member=>member.person_id===p.id).map(member=>h(c.departments.find(d=>d.id===member.department_id)?.name||'Departamento indisponível')).join('<br>')}</td><td><label>Dias distintos<input ${attrs} name="max_monthly_count" type="number" min="0" max="100" value="${h(p.max_monthly_count??'')}" placeholder="Não informado"></label></td><td><label><input ${attrs} name="active" type="checkbox" ${p.active?'checked':''}>Ativo</label></td><td><button ${attrs} type="submit" ${m.saving?'disabled':''}>Salvar linha</button><p role="status" data-member-status="${h(p.id)}">${m.pending.has(p.id)?'Alterações pendentes':''}</p></td></tr>`;}).join('')}</tbody></table></div>`;
 }
 function personDays(p){
  const attrs=`form="member-${h(p.id)}"`;
  return `<section class="panel daily-person-days" data-member="${h(p.id)}"><h2>Dias e restrições — ${h(p.display_name)}</h2><input ${attrs} type="hidden" name="name" value="${h(p.name)}"><fieldset><legend>Dias da semana — ${h(p.display_name)}</legend><div class="daily-week-grid">${week.map((day,i)=>`<fieldset><legend>${day}</legend><label class="checkbox"><input ${attrs} type="checkbox" name="available_${i}" aria-label="Disponível ${day} · ${h(p.name)}" ${p.weekdays?.[i]==='available'?'checked':''}>Disponível</label><label class="checkbox"><input ${attrs} type="checkbox" name="unavailable_${i}" aria-label="Indisponível ${day} · ${h(p.name)}" ${p.weekdays?.[i]==='unavailable'?'checked':''}>Indisponível</label></fieldset>`).join('')}</div></fieldset><div class="schedule-grid"><label>Datas indisponíveis — dd/mm/aaaa<textarea ${attrs} name="dates" aria-label="Datas indisponíveis · ${h(p.name)}" rows="3" placeholder="Ex.: 15/11/2026, 22/11/2026">${h(p.raw_dates??(p.unavailable_dates||[]).map(displayDate).join(', '))}</textarea></label><label>Limite mensal — dias distintos<input ${attrs} type="number" name="max_monthly_count" min="0" max="100" value="${h(p.max_monthly_count??'')}" placeholder="Pendente de confirmação"></label></div><label class="checkbox"><input ${attrs} name="active" type="checkbox" ${p.active?'checked':''}>Voluntário ativo</label><p>${p.manual_rules||0} regras manuais preservadas. ${m.data.settings.availability_advisory?'Restrições orientam somente o automático e não bloqueiam a escolha manual.':'Restrições valem para todos os departamentos; habilitações são confirmadas separadamente.'}</p><button type="submit" ${attrs} ${m.saving?'disabled':''}>Salvar restrições</button><p role="status" data-member-status="${h(p.id)}">${m.pending.has(p.id)?'Alterações pendentes':''}</p></section>`;
 }
 function settings(){
  const s=m.data.settings,c=m.data.catalog;
  return `<section class="panel"><form id="daily-settings"><h2>Período de edição das escalas</h2><label>Meses futuros liberados<select name="planning_months">${[1,2,3,6].map(n=>option(n,n+' '+(n===1?'mês':'meses'),s.planning_months)).join('')}</select></label><p>O mês atual fica sempre aberto a partir de hoje. Futuros: ${s.future_months.map(value=>IASDPIScheduleUI.monthLabel(value.slice(0,7))).join(' · ')}.</p>${IASDPIScheduleUI.help('edit-window-settings','Dias encerrados ficam somente para consulta. Esta configuração libera os meses seguintes para criação e edição; a geração do período continua começando no próximo mês, sem apagar escalas existentes.','Como funciona o período de edição')}${s.department_days_enabled?'<p>Configure os dias na tela de cada departamento.</p>':`<fieldset><legend>Dias usados na geração</legend>${week.map((day,i)=>`<label class="checkbox"><input type="checkbox" name="weekday" value="${i}" ${s.weekdays.includes(i)?'checked':''}> ${day}</label>`).join('')}</fieldset>`}<label>Datas extraordinárias — dd/mm/aaaa, separadas por vírgula<textarea name="extra_dates" rows="2">${h(s.extra_dates.map(displayDate).join(', '))}</textarea></label><button type="submit" ${m.saving?'disabled':''}>Salvar configuração</button></form></section>
  <section class="panel"><h2>Autorizar exceção entre departamentos</h2><p>A autorização é por pessoa, data e par de departamentos. Não dispensa habilitação, disponibilidade confirmada ou limite mensal.</p><form id="daily-exception" class="schedule-grid"><label>Pessoa<select name="person_id">${c.people.filter(p=>p.active).map(p=>option(p.id,p.display_name,'')).join('')}</select></label><label>Data — dd/mm/aaaa<input name="day" required placeholder="10/11/2026"></label>${['a','b'].map((key,i)=>`<label>Departamento ${i+1}<select name="department_${key}">${c.departments.filter(d=>d.active).map((d,j)=>option(d.id,d.name,c.departments[i]?.id)).join('')}</select></label>`).join('')}<label>Justificativa<input name="reason" required minlength="10" maxlength="2000"></label><button type="submit" ${m.saving?'disabled':''}>Autorizar exceção</button></form><ul>${m.data.exceptions.map(x=>`<li>${h(displayDate(x.day))} · ${h(c.people.find(p=>p.id===x.person_id)?.display_name||x.person_id)} · ${h(x.reason)} · ${x.enabled?'Ativa':'Revogada'}<small>Autorizada por ${h(x.approved_by)} em ${h(x.approved_at)}</small>${x.enabled?b('Revogar','revoke','data-id="'+h(x.id)+'"'):''}</li>`).join('')||'<li>Nenhuma exceção autorizada.</li>'}</ul></section>`;
 }
 function collect(id,parse=false){const original=m.data.members.find(p=>p.id===id),form=document.getElementById('member-'+id),fd=new FormData(form),flags={};for(let i=0;i<7;i++)flags[i]=fd.has('unavailable_'+i)?'unavailable':fd.has('available_'+i)?'available':'unknown';return {...original,name:String(fd.get('name')),active:fd.has('active'),weekdays:m.data.settings.availability_enabled===false?original.weekdays:flags,raw_dates:m.data.settings.availability_enabled===false?original.raw_dates:String(fd.get('dates')),unavailable_dates:m.data.settings.availability_enabled===false?original.unavailable_dates:parse?dates(String(fd.get('dates'))):original.unavailable_dates,max_monthly_count:fd.get('max_monthly_count')===''?null:Number(fd.get('max_monthly_count'))};}
 document.addEventListener('change',e=>{if(e.target.id==='daily-person'&&!m.saving){m.person=e.target.value;redraw();document.getElementById('daily-person')?.focus();}});
 document.addEventListener('input',e=>{
  const form=e.target.form;if(!form||m.saving)return;
  if(form.dataset.memberForm){const id=form.dataset.memberForm;if(e.target.type==='checkbox'&&/^(un)?available_/.test(e.target.name)&&e.target.checked){const other=e.target.name.startsWith('unavailable_')?e.target.name.replace('unavailable_','available_'):e.target.name.replace('available_','unavailable_');form.elements[other].checked=false;}
   try{m.pending.set(id,collect(id));}catch(_){m.pending.set(id,{...m.data.members.find(p=>p.id===id)});}document.querySelector('[data-member-status="'+id+'"]').textContent='Alterações pendentes';
  }else if(['daily-settings','daily-exception','daily-qualification-confirm'].includes(form.id))m.pending.set(form.id,true);
 });
 document.addEventListener('submit',e=>{
  const form=e.target;if(!form.dataset.memberForm&&!['daily-settings','daily-exception','daily-qualification-confirm'].includes(form.id))return;e.preventDefault();e.stopImmediatePropagation();if(m.saving)return;
  void(async()=>{
   m.saving=true;m.error='';const submit=form.dataset.memberForm?document.querySelector('button[form="'+form.id+'"]'):form.querySelector('button[type=submit]');submit.disabled=true;
   if(form.id==='daily-qualification-confirm'){
    try{
     const data=new FormData(form),department=String(data.get('department_id')),person=String(data.get('person_id')),name=String(data.get('role_name')||'').trim();
     if(!data.has('confirmed')||name.length<2)throw Error('Confirme explicitamente a habilitação e informe a função.');
     let role=m.data.catalog.roles.find(r=>r.department_id===department&&r.name.trim().toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));
     if(role&&!role.active)throw Error('A função está inativa. Revise o cadastro antes de confirmar.');
     if(!role)role=await rpc('iasdpi_schedule_save',{p_entity:'role',p_id:crypto.randomUUID(),p_expected_version:0,p_data:{department_id:department,name},p_request_id:crypto.randomUUID()});
     const member=m.data.catalog.memberships.find(x=>x.person_id===person&&x.department_id===department),roles=[...new Set([...m.data.catalog.qualifications.filter(q=>q.membership_id===member?.id).map(q=>q.role_id),role.id])];
     await rpc('iasdpi_schedule_save',{p_entity:'membership',p_id:member?.id||crypto.randomUUID(),p_expected_version:member?.version||0,p_data:{person_id:person,department_id:department,active:true,role_ids:roles},p_request_id:crypto.randomUUID()});
     m.pending.delete(form.id);m.feedback=window.IASDPISchedulePreview?'Habilitação confirmada somente nesta prévia local.':'Habilitação confirmada pelo Supabase.';await load();
    }catch(error){m.error=error.message;let alert=form.querySelector('[role=alert]');if(!alert){alert=document.createElement('p');alert.setAttribute('role','alert');form.append(alert);}alert.textContent=error.message;}
    finally{m.saving=false;submit.disabled=false;if(m.status==='ready'&&!m.error)redraw();}
    return;
   }
   try{
    if(form.dataset.memberForm){const id=form.dataset.memberForm,p=collect(id,true);await rpc('iasdpi_schedule_member_save',{p_id:id,p_expected_version:p.version,p_data:{name:p.name,display_name:p.display_name,active:p.active,max_monthly_count:p.max_monthly_count,...(m.data.settings.availability_enabled===false?{}:{weekdays:p.weekdays,unavailable_dates:p.unavailable_dates})},p_request_id:crypto.randomUUID()});m.pending.delete(id);}
    if(form.id==='daily-settings'){const fd=new FormData(form);await rpc('iasdpi_schedule_settings_save',{p_expected_version:m.data.settings.version,p_data:{planning_months:Number(fd.get('planning_months')),...(m.data.settings.department_days_enabled?{}:{weekdays:fd.getAll('weekday').map(Number)}),extra_dates:dates(String(fd.get('extra_dates')))}});m.pending.delete(form.id);}
    if(form.id==='daily-exception'){if(!confirm('Autorizar explicitamente esta pessoa nos dois departamentos nesta data?'))return;const fd=new FormData(form);await rpc('iasdpi_schedule_exception_save',{p_id:crypto.randomUUID(),p_expected_version:0,p_data:{person_id:fd.get('person_id'),day:dates(String(fd.get('day')))[0],department_a:fd.get('department_a'),department_b:fd.get('department_b'),reason:fd.get('reason')}});m.pending.delete(form.id);}
    m.feedback=IASDPIScheduleUI.isReview()?'Alterações salvas nesta aba.':window.IASDPISchedulePreview?'Gravação simulada na memória desta aba.':'Alteração confirmada pelo Supabase.';await load();
   }catch(error){m.error=error.message;if(form.dataset.memberForm)document.querySelector('[data-member-status="'+form.dataset.memberForm+'"]').textContent=error.message;else{let alert=form.querySelector('[role=alert]');if(!alert){alert=document.createElement('p');alert.setAttribute('role','alert');form.append(alert);}alert.textContent=error.message;}}
   finally{m.saving=false;submit.disabled=false;if(m.status==='ready'&&!m.error)redraw();}
  })();
 },true);
 document.addEventListener('click',e=>{const el=e.target.closest('[data-daily-action]');if(!el||m.saving)return;e.preventDefault();void(async()=>{
  if(el.dataset.dailyAction==='reload'){if(canLeave())await load();}
  if(el.dataset.dailyAction==='history'){m.history=await rpc('iasdpi_schedule_person_history',{p_person:el.dataset.person});redraw();document.getElementById('daily-history')?.focus();}
  if(el.dataset.dailyAction==='revoke'&&confirm('Revogar esta autorização? Se estiver em uso, o banco impedirá a revogação.')){const x=m.data.exceptions.find(x=>x.id===el.dataset.id);await rpc('iasdpi_schedule_exception_save',{p_id:x.id,p_expected_version:x.version,p_data:{enabled:false}});await load();}
 })().catch(error=>{m.error=error.message;redraw();});});
 window.addEventListener('beforeunload',e=>{if(m.pending.size||m.saving){e.preventDefault();e.returnValue='';}});
 window.addEventListener('iasdpi-identity-ended',()=>{m.generation++;m.status='idle';m.data=null;m.pending.clear();m.history=null;redraw();});
 return {page,canLeave};
})();

'use strict';
// Períodos civis inclusivos. Uma semana conserva a identidade ao atravessar meses.
window.IASDPIElderPeriods=(()=>{
 const day=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('Data do período inválida.');const d=new Date(value+'T12:00:00Z');if(isNaN(d)||d.toISOString().slice(0,10)!==value)throw Error('Data do período inválida.');return d;};
 const iso=d=>d.toISOString().slice(0,10),add=(value,n)=>{const d=day(value);d.setUTCDate(d.getUTCDate()+n);return iso(d);};
 function range(start,end){const first=day(start),last=day(end);if(last<first||last-first>32*86400000)throw Error('Intervalo do período inválido.');const out=[];for(let d=new Date(first);d<=last;d.setUTCDate(d.getUTCDate()+1))out.push(iso(d));return out;}
 function periods(month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||'')||Number(month.slice(0,4))<1000||Number(month.slice(0,4))>9998)throw Error('Mês inválido.');
  day(month+'-01');const first=month+'-01',lastDate=day(first);lastDate.setUTCMonth(lastDate.getUTCMonth()+1);lastDate.setUTCDate(0);const last=iso(lastDate),rows=[];
  for(let start=add(first,-day(first).getUTCDay());start<=last;start=add(start,7))rows.push({kind:'weekly',starts_on:start,ends_on:add(start,6)});
  return [...rows,{kind:'monthly',starts_on:first,ends_on:last}];
 }
 const key=row=>row.kind+':'+row.starts_on;
 // Ancião do mês é uma referência de responsabilidade; não reserva os dias do mês.
 const conflictsEnabled=row=>row.kind!=='monthly';
 function reasons(catalog,department,row,person,commitments,automatic=false,pending=[]){
  const p=catalog.people.find(p=>p.id===person),m=catalog.memberships.find(m=>m.person_id===person&&m.department_id===department),out=[],days=range(row.starts_on,row.ends_on);
  if(!p?.active||!m?.active)out.push('Pessoa inativa ou sem vínculo ativo no Ancionato');
  if(conflictsEnabled(row)&&commitments.some(a=>conflictsEnabled(a)&&a.person_id===person&&(window.IASDPIScheduleRules?.departmentsConflict(catalog,a.department_id,department)??a.department_id!==department)&&a.status==='published'&&days.includes(a.date)))out.push('Conflito com outro departamento em uma data deste período');
  if(automatic&&catalog.central_registry)out.push(...IASDPIRegistry.periodReasons(catalog,department,row,person));
  if(automatic)for(const [maximum,onlyDepartment] of [[p?.max_monthly_count,false],[m?.max_monthly_count,true]]){if(maximum==null)continue;const dates=new Set([...commitments.filter(a=>a.person_id===person&&a.status==='published'&&(!onlyDepartment||a.department_id===department)),...pending.filter(a=>a.person_id===person).flatMap(a=>range(a.starts_on,a.ends_on).map(date=>({date})))].map(a=>a.date));for(const date of days)dates.add(date);if([...new Set(days.map(d=>d.slice(0,7)))].some(mon=>[...dates].filter(d=>d.slice(0,7)===mon).length>maximum))out.push('Limite mensal informado: período não sugerido automaticamente');}
  return out;
 }
 function propose(rows,catalog,department,commitments,history=[],allowedPeople=null){
  const people=catalog.people.filter(p=>p.active&&(!Array.isArray(allowedPeople)||allowedPeople.includes(p.id))&&catalog.memberships.some(m=>m.person_id===p.id&&m.department_id===department&&m.active)),result=structuredClone(rows);let added=0;
  const used=new Map(),round=new Set(result.filter(r=>r.person_id).map(r=>r.person_id));for(const r of [...history,...result])if(r.person_id)used.set(r.person_id,(used.get(r.person_id)||0)+1);
  const ordered=people.map(p=>p.id).sort(),previous=[...history].filter(r=>r.person_id).sort((a,b)=>b.starts_on.localeCompare(a.starts_on))[0];let cursor=previous?(ordered.indexOf(previous.person_id)+1)%ordered.length:0;
  for(const row of result){if(row.person_id)continue;const choices=people.filter(p=>!reasons(catalog,department,row,p.id,commitments,true,result).length);if(choices.length&&choices.every(p=>round.has(p.id)))round.clear();choices.sort((a,b)=>Number(round.has(a.id))-Number(round.has(b.id))||(used.get(a.id)||0)-(used.get(b.id)||0)||((ordered.indexOf(a.id)-cursor+ordered.length)%ordered.length)-((ordered.indexOf(b.id)-cursor+ordered.length)%ordered.length)||a.id.localeCompare(b.id));
   if(choices.length){row.person_id=choices[0].id;round.add(row.person_id);used.set(row.person_id,(used.get(row.person_id)||0)+1);cursor=(ordered.indexOf(row.person_id)+1)%ordered.length;added++;}
  }return {rows:result,added};
 }
 function year(year){if(!/^\d{4}$/.test(String(year))||Number(year)<1000||Number(year)>9998)throw Error('Ano inválido.');return Array.from({length:12},(_,index)=>periods(year+'-'+String(index+1).padStart(2,'0')).find(r=>r.kind==='monthly'));}
 return {periods,year,range,key,reasons,propose,conflictsEnabled};
})();

window.IASDPIScheduleElders=(()=>{
 const m={key:'',generation:0,status:'idle',catalog:null,settings:null,department:'',month:'',kind:'weekly',rows:[],history:[],commitments:[],pending:new Map(),saving:false,error:'',feedback:'',versions:[],historyKey:'',request:crypto.randomUUID(),signature:''};
 const h=v=>esc(v),rpc=(name,args)=>IASDPISchedules.request(name,args),engine=IASDPIElderPeriods,clean=()=>!window.IASDPISchedulePreview||IASDPIScheduleUI.isReview();
 const redraw=()=>{if(state.page==='schedule-build')render();};
 const action=(label,name,extra='')=>`<button type="button" data-elder-action="${name}" ${clean()&&name==='prefill'?'class="schedule-auto-fill"':''} ${m.saving?'disabled':''} ${extra}>${h(label)}</button>`;
 const rows=()=>m.rows.filter(r=>r.kind===m.kind).map(r=>m.pending.get(engine.key(r))||r);
 async function load(){const ticket=++m.generation;m.status='loading';m.error='';redraw();try{
  const result=await rpc('iasdpi_schedule_elder_workspace',{p_department:m.department,p_month:m.month+'-01',p_year:Number(m.month.slice(0,4))});if(ticket!==m.generation)return;
  if(!Array.isArray(result.periods)||!Array.isArray(result.commitments)||!Array.isArray(result.history))throw Error('Resposta de períodos inválida.');
  if(result.central_registry){m.catalog.central_registry=true;m.catalog.registry_days=result.availability_days||[];}m.catalog.availability_enabled=m.settings?.availability_enabled??result.availability_enabled??true;
  m.rows=result.periods;m.commitments=result.commitments;m.history=result.history;m.status='ready';redraw();
 }catch(e){if(ticket!==m.generation)return;m.status='error';m.error=e.message;redraw();}}
 function canLeave(){if(m.saving){alert('Aguarde a confirmação da escala de anciãos.');return false;}if(m.pending.size&&!confirm('Descartar somente as alterações de anciãos ainda não salvas?'))return false;m.pending.clear();return true;}
 function periodContents(row,manage,people){
  manage=manage&&IASDPIScheduleEditWindow.period(row,m.settings);
  const label=displayDate(row.starts_on)+' a '+displayDate(row.ends_on),conflicts=row.person_id?engine.reasons(m.catalog,m.department,row,row.person_id,m.commitments):[],weekly=row.kind==='weekly';
  return `<div class="elder-period-assignment"><div class="elder-period-top"><label for="elder-person-${h(row.id)}">${weekly?'Ancião da semana':'Ancião do mês'}</label>${clean()?IASDPIScheduleUI.help('period-help-'+row.id,(weekly?'Domingo a sábado.':'Independente da escala semanal.')+' Versão '+row.version+'.','Detalhes do período '+label,true):''}</div><select id="elder-person-${h(row.id)}" data-elder-person aria-label="${h((weekly?'Ancião da semana':'Ancião do mês')+' · '+label)}" ${!manage||m.saving?'disabled':''}><option value="">A definir</option>${people.map(p=>{const reasons=engine.reasons(m.catalog,m.department,row,p.id,m.commitments);return `<option value="${h(p.id)}" ${row.person_id===p.id?'selected':''} ${reasons.length&&row.person_id!==p.id?'disabled':''}>${h(p.display_name+(reasons.length?' · '+reasons.join('; '):''))}</option>`;}).join('')}</select>${clean()?`<div class="elder-period-meta"><small>${h(row.starts_on.slice(8)+'/'+row.starts_on.slice(5,7)+' – '+row.ends_on.slice(8)+'/'+row.ends_on.slice(5,7))} · ${row.status==='published'?'Publicado':'Rascunho'}</small></div>`:`<small>${h(label)} · ${row.status==='published'?'Publicado':'Rascunho'} · versão ${row.version}</small>`}${!clean()&&row.source_name?`<small>Referência da Agenda: ${h(row.source_name)}. A fonte original não é alterada.</small>`:''}${!clean()&&weekly&&row.starts_on.slice(0,7)!==row.ends_on.slice(0,7)?'<small>A mesma semana aparece nos dois meses, com uma única atribuição.</small>':''}${conflicts.length?`<p role="alert">${h(conflicts.join('; '))}</p>`:''}${row.version?`<button type="button" data-elder-history="${h(engine.key(row))}" ${m.saving?'disabled':''}>Histórico</button>`:''}</div>`;
 }
 function calendar(list,manage,people){
  if(m.kind==='monthly')return `<div class="elder-year-calendar" aria-label="Calendário anual de anciãos · ${h(m.month.slice(0,4))}">${list.map(row=>{const monthName=new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'America/Sao_Paulo'}).format(new Date(row.starts_on+'T12:00:00Z'));return `<article class="elder-period elder-month-card" data-elder-period="${h(engine.key(row))}"><h3>${h(monthName)}</h3><span class="sr-only">Primeiro ao último dia do mês</span>${periodContents(row,manage,people)}</article>`;}).join('')}</div>`;
  return `<div class="elder-week-calendar monthly-calendar monthly-ancionato" aria-label="Calendário mensal · ancião por semana"><div class="calendar-weekdays" aria-hidden="true">${['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(day=>'<span>'+day+'</span>').join('')}</div>${list.map(row=>`<article class="elder-period elder-week-row" data-elder-period="${h(engine.key(row))}"><div class="elder-week-days">${engine.range(row.starts_on,row.ends_on).map(day=>`<div class="elder-calendar-day ${day.slice(0,7)===m.month?'':'is-outside'}" ${day===m.settings.today?'aria-current="date"':''}><time datetime="${day}" aria-label="${h(displayDate(day))}">${Number(day.slice(8))}</time></div>`).join('')}</div>${periodContents(row,manage,people)}</article>`).join('')}</div>`;
 }
 function page(catalog,settings,department,month,openMonth){
  m.openMonth=openMonth;m.catalog=catalog;m.settings=settings;
  const next=catalog.actor_id+':'+department+':'+month;
  if(next!==m.key){m.key=next;m.catalog=catalog;m.settings=settings;m.department=department;m.month=month;m.status='idle';m.rows=[];m.pending.clear();m.feedback='';m.versions=[];m.historyKey='';m.request=crypto.randomUUID();m.signature='';}
  const manage=catalog.departments.some(d=>d.id===department&&d.active&&(d.can_edit??d.can_manage)),publish=catalog.departments.some(d=>d.id===department&&d.active&&(d.can_publish??d.can_manage)),title=heading('ESCALAS · ANCIONATO','Escalas de anciãos',clean()?'':'Calendário mensal por semana e calendário anual para o ancião de cada mês.');
  const nav=`<nav class="monthly-departments" aria-label="Departamentos das escalas">${IASDPIScheduleUI.departments(catalog).map(d=>`<button type="button" data-b1-action="department" data-department="${h(d.id)}" aria-pressed="${d.id===department}" ${m.saving?'disabled':''}>${h(d.name)}</button>`).join('')}</nav>`;
  if(m.status==='idle'){queueMicrotask(load);return title+nav+'<p role="status">Carregando semanas e escala mensal…</p>';}
  if(m.status==='loading')return title+nav+'<p role="status">Carregando semanas e escala mensal…</p>';
  if(m.status==='error')return title+nav+`<p role="alert">${h(m.error)}</p>${action('Tentar novamente','reload')}`;
  const list=rows(),filled=list.filter(r=>r.person_id).length,people=catalog.people.filter(p=>catalog.memberships.some(member=>member.department_id===department&&member.person_id===p.id&&member.active)).sort(IASDPIScheduleRules.comparePeople);
  return title+nav+`${clean()?'':'<p class="demo-banner">PRÉVIA — alterações somente na memória desta aba. Disponibilidade temporariamente desativada; dados anteriores preservados.</p>'}
  <section class="panel"><div class="elder-tabs" role="group" aria-label="Tipo de escala do Ancionato">${action('Ancião da semana','kind','data-kind="weekly" aria-pressed="'+(m.kind==='weekly')+'"')}${action('Ancião do mês — ano','kind','data-kind="monthly" aria-pressed="'+(m.kind==='monthly')+'"')}</div>
  ${m.kind==='weekly'?`<form id="elder-month" class="schedule-grid">${clean()?IASDPIScheduleUI.monthPicker('elder-month-value',month,m.saving):`<label>Mês e ano<input type="month" name="month" value="${h(month)}" required ${m.saving?'disabled':''}></label><button type="submit" ${m.saving?'disabled':''}>Abrir mês</button>`}</form><div class="monthly-toolbar">${action('Mês anterior','month','data-direction="-1"')}${action('Próximo mês','month','data-direction="1"')}</div>`:`<form id="elder-year" class="schedule-grid">${clean()?IASDPIScheduleUI.yearSelect('elder-year-value',month.slice(0,4),m.saving):`<label>Ano<input type="number" name="year" min="1000" max="9998" step="1" value="${h(month.slice(0,4))}" required ${m.saving?'disabled':''}></label><button type="submit" ${m.saving?'disabled':''}>Abrir ano</button>`}</form><div class="monthly-toolbar">${action('Ano anterior','year','data-direction="-1"')}${action('Próximo ano','year','data-direction="1"')}</div>`}
  ${clean()?IASDPIScheduleUI.help('elder-guide',m.kind==='weekly'?'Escolha um ancião para cada semana, de domingo a sábado. A mesma semana mantém uma única escolha na virada do mês. Conflitos com outros departamentos são verificados antes de salvar.':'Escolha um ancião em cada mês. O Ancião do mês não bloqueia a participação em outros departamentos. Salvar e publicar esta aba não altera as semanas.','Ajuda sobre a escala de anciãos'):`<p>${m.kind==='weekly'?'Uma única seleção por semana, de domingo a sábado. Os dias de outros meses aparecem discretamente para completar a semana.':'Uma seleção por mês, de janeiro a dezembro. Conflitos do Ancião do mês desativados: esta responsabilidade não bloqueia a participação em outros departamentos. A proteção semanal permanece ativa.'}</p>`}</section>
  ${window.IASDPIScheduleDepartmentDays?.page(catalog,settings,department)||''}${manage?IASDPIRotationTeam.view(catalog,department,IASDPIRotationTeam.key(catalog.actor_id,department,'elder-'+m.kind),m.saving):''}
  <section class="panel" aria-label="${m.kind==='weekly'?'Escala semanal de anciãos':'Escala anual de anciãos por mês'}"><h2>${h(m.kind==='weekly'?new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(month+'-01T12:00:00Z')):'Ancião do mês · '+month.slice(0,4))}</h2>${calendar(list,manage,people)}<p class="elder-summary">${filled} de ${list.length} períodos preenchidos.</p>
  <div class="monthly-toolbar schedule-publishbar" aria-label="Salvar e publicar escala de anciãos">${manage?action('Preencher automaticamente','prefill')+action('Limpar escala','clear','class="schedule-clear" '+(!m.saving&&!list.some(r=>r.person_id)?'disabled':''))+action('Salvar '+(m.kind==='weekly'?'semanas':'ano'),'save'):''}${publish?action('Publicar '+(m.kind==='weekly'?'semanas':'ano'),'publish','class="primary"'):''}${action(clean()?'Recarregar escala':'Atualizar períodos','reload')}<a class="button schedule-secondary" href="#schedule-calendar" data-b1-nav="schedule-calendar" data-schedule-month="${h(m.month)}" data-schedule-department="Ancionato">${clean()?'Ver calendário':'Ver no calendário'}</a></div><p role="status" id="elder-feedback">${h(IASDPIScheduleUI.feedback(m.feedback)||(m.pending.size?'Alterações pendentes.':clean()?'':'Nenhuma alteração pendente.'))}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}${m.historyKey?`<details class="elder-history" open><summary>Histórico · ${m.historyKey.startsWith('weekly')?'Semana':'Mês'} de ${h(displayDate(m.historyKey.split(':')[1]))}</summary>${m.versions.length?m.versions.map(v=>`<p>Versão ${h(v.version)} · ${v.snapshot.status==='published'?'Publicada':'Rascunho'} · ${h(window.IASDPIRegistry?.personName(m.catalog,v.snapshot.person_id)||m.catalog.people.find(p=>p.id===v.snapshot.person_id)?.display_name||'A definir')}<small>${h(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'}).format(new Date(v.captured_at)))} · Autor: ${h(v.actor_id)}</small></p>`).join(''):'<p>Nenhuma versão.</p>'}</details>`:''}${clean()?'':'<p>Salvar e publicar nesta prévia são simulações. Cada aba é salva separadamente; recarregar a página reinicia a demonstração.</p>'}</section>`;
 }
 document.addEventListener('change',e=>{if(!e.target.matches('[data-elder-person]')||m.saving)return;const key=e.target.closest('[data-elder-period]').dataset.elderPeriod,row=m.pending.get(key)||m.rows.find(r=>engine.key(r)===key);if(!row||!IASDPIScheduleEditWindow.period(row,m.settings)){redraw();return;}m.pending.set(key,{...row,person_id:e.target.value||null});m.error='';m.feedback='Alterações pendentes.';redraw();document.querySelector('[data-elder-period="'+key+'"] select')?.focus({preventScroll:true});});
 async function save(status){
  const d=m.catalog?.departments.find(d=>d.id===m.department);if(!d||!(status==='published'?(d.can_publish??d.can_manage):(d.can_edit??d.can_manage)))throw Error('Sem permissão para esta ação do Ancionato.');
  if(status==='published'&&!confirm(clean()?'Publicar os períodos desta aba?':'Publicar somente esta escala de anciãos na demonstração? A outra aba não será alterada.'))return;
  const changes=rows().filter(r=>IASDPIScheduleEditWindow.period(r,m.settings)&&(status==='published'||m.pending.has(engine.key(r))));if(!changes.length){m.feedback='Nenhuma alteração para salvar nesta aba.';redraw();return;}
  const signature=JSON.stringify({department:m.department,status,changes});if(m.signature&&m.signature!==signature)m.request=crypto.randomUUID();m.signature=signature;
  m.saving=true;m.error='';m.feedback='Aguardando confirmação…';redraw();try{
   const result=await rpc('iasdpi_schedule_elder_save',{p_department:m.department,p_status:status,p_rows:changes.map(r=>({id:r.id,kind:r.kind,starts_on:r.starts_on,ends_on:r.ends_on,person_id:r.person_id,expected_version:r.version})),p_request_id:m.request});
   if(!Array.isArray(result.periods)||result.periods.length!==changes.length||new Set(result.periods.map(engine.key)).size!==changes.length||result.periods.some(row=>!changes.some(change=>change.id===row.id&&engine.key(change)===engine.key(row)&&change.ends_on===row.ends_on&&(change.person_id||null)===(row.person_id||null)&&row.version===change.version+1&&row.status===status)))throw Error('Confirmação de gravação inválida.');
   for(const row of result.periods){const key=engine.key(row);m.pending.delete(key);m.rows=m.rows.map(r=>engine.key(r)===key?row:r);}
   m.request=crypto.randomUUID();m.signature='';if(status==='published')window.dispatchEvent(new Event('iasdpi-schedule-published'));
   m.feedback=(window.IASDPISchedulePreview?'Alterações confirmadas somente na memória desta demonstração.':'Alterações confirmadas pelo Supabase.')+(status==='published'?' Escala publicada. Abra Ver no calendário.':' Rascunho salvo; ainda não publicado.');
  }catch(e){m.error=e.message+' Suas alterações foram preservadas.';m.feedback='';}finally{m.saving=false;redraw();}
 }
 document.addEventListener('click',e=>{const button=e.target.closest('[data-elder-history]');if(!button||m.saving)return;const row=m.rows.find(r=>engine.key(r)===button.dataset.elderHistory);if(!row)return;void rpc('iasdpi_schedule_elder_versions',{p_department:m.department,p_kind:row.kind,p_starts_on:row.starts_on}).then(list=>{if(!Array.isArray(list))throw Error('Histórico inválido.');m.historyKey=engine.key(row);m.versions=list;redraw();}).catch(e=>{m.error=e.message;redraw();});});
 document.addEventListener('submit',e=>{if(e.target.id!=='elder-month')return;e.preventDefault();e.stopImmediatePropagation();if(m.saving)return;const value=new FormData(e.target).get('month');try{engine.periods(value);if(clean()&&value===m.month)return;if(canLeave())m.openMonth(value);else IASDPIScheduleUI.restoreMonth(e.target,m.month);}catch(error){m.error=error.message;redraw();}},true);
 document.addEventListener('submit',e=>{if(e.target.id!=='elder-year')return;e.preventDefault();e.stopImmediatePropagation();if(m.saving)return;const year=String(new FormData(e.target).get('year'));try{engine.year(year);if(clean()&&year===m.month.slice(0,4))return;if(canLeave())m.openMonth(year+m.month.slice(4));else if(clean())e.target.elements.year.value=m.month.slice(0,4);}catch(error){m.error=error.message;redraw();}},true);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-elder-action]');if(!b||m.saving)return;e.preventDefault();void(async()=>{
  if(b.dataset.elderAction==='kind'){m.kind=b.dataset.kind;m.error='';m.feedback='';redraw();document.querySelector('[data-elder-action=kind][data-kind="'+m.kind+'"]')?.focus();}
  if(b.dataset.elderAction==='month'){if(!canLeave())return;const d=new Date(m.month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(b.dataset.direction));m.openMonth(d.toISOString().slice(0,7));}
  if(b.dataset.elderAction==='year'){const year=String(Number(m.month.slice(0,4))+Number(b.dataset.direction));engine.year(year);if(canLeave())m.openMonth(year+m.month.slice(4));}
  if(b.dataset.elderAction==='reload'&&canLeave())await load();
  if(b.dataset.elderAction==='clear'){
   if(!m.catalog.departments.some(d=>d.id===m.department&&d.active&&(d.can_edit??d.can_manage)))return;
   const filled=rows().filter(r=>r.person_id&&IASDPIScheduleEditWindow.period(r,m.settings));if(!filled.length)return;
   const scope=m.kind==='weekly'?'das semanas exibidas em '+m.month.slice(5)+'/'+m.month.slice(0,4):'dos 12 meses de '+m.month.slice(0,4),other=m.kind==='weekly'?'A escala mensal':'A escala semanal';
   if(!confirm('Limpar os nomes '+scope+'? '+other+' será preservada. A limpeza ficará pendente até salvar.'))return;
   for(const row of filled)m.pending.set(engine.key(row),{...row,person_id:null});
   m.error='';m.feedback='Nomes removidos. Salve para confirmar.';redraw();document.querySelector('[data-elder-action=prefill]')?.focus({preventScroll:true});
  }
  if(b.dataset.elderAction==='prefill'){const proposal=engine.propose(rows().filter(r=>IASDPIScheduleEditWindow.period(r,m.settings)),m.catalog,m.department,m.commitments,m.history.filter(r=>r.kind===m.kind),IASDPIRotationTeam.selected(m.catalog,m.department,IASDPIRotationTeam.key(m.catalog.actor_id,m.department,'elder-'+m.kind),true));for(const row of proposal.rows)if(row.person_id!==(m.pending.get(engine.key(row))||m.rows.find(r=>engine.key(r)===engine.key(row)))?.person_id)m.pending.set(engine.key(row),row);m.feedback=`Proposta editável: ${proposal.added} períodos sugeridos. Revise antes de salvar.`;redraw();}
  if(b.dataset.elderAction==='save'||b.dataset.elderAction==='publish')await save(b.dataset.elderAction==='publish'?'published':'draft');
 })().catch(error=>{m.error=error.message;redraw();});});
 window.addEventListener('beforeunload',e=>{if(m.pending.size||m.saving){e.preventDefault();e.returnValue='';}});
 window.addEventListener('iasdpi-identity-ended',()=>{m.generation++;m.key='';m.rows=[];m.pending.clear();m.catalog=null;m.status='idle';});
 return {page,canLeave};
})();

// G7: configuração administrativa do departamento; sem reconstruir sua escala.
window.IASDPIScheduleDepartmentDays=(()=>{
 const m={key:'',row:null,days:[],dirty:false,saving:false,message:'',error:'',request:crypto.randomUUID()},week=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
 const redraw=()=>{if(state.page==='schedule-build')render();};
 function page(catalog,settings,department,month){
  if(!settings?.department_days_enabled)return '';
  const key=catalog.actor_id+':'+(window.IASDPIChurches?.selected()||'IASD_PI')+':'+department;
  const row={department_id:department,weekdays:settings.department_weekdays?.[department],version:settings.department_days_versions?.[department],can_edit:settings.department_days_can_edit?.[department]===true};
  if(!Array.isArray(row.weekdays)||!Number.isInteger(row.version))return '<p role="alert">Configuração dos dias indisponível. Recarregue a escala.</p>';
  if(key!==m.key){m.key=key;m.row=row;m.days=[...row.weekdays];m.dirty=false;m.message='';m.error='';m.request=crypto.randomUUID();}
  else if(!m.dirty&&!m.saving){m.row=row;m.days=[...row.weekdays];}
  const dept=catalog.departments.find(d=>d.id===department),name=dept?.name||'Departamento';
  const generate=dept?.code!=='ancionato'&&(dept?.can_edit??dept?.can_manage)&&settings.future_months.includes(month+'-01')?`<button type="button" data-b1-action="start" data-days-generate ${m.saving||m.dirty?'disabled':''}>Gerar dias do período</button>`:'';
  return `<details class="panel department-days" ${m.dirty||m.message||m.error?'open':''}><summary>Dias de escala · ${esc(name)}</summary>${IASDPIScheduleUI.help('department-days-help','Altera somente a geração diária e as propostas automáticas futuras. Escalas e atribuições existentes são preservadas. Semanas e meses do Ancionato mantêm seus intervalos completos.','Como os dias afetam a geração')}<form id="department-days-form"><fieldset ${!row.can_edit||m.saving?'disabled':''}><legend>Dias usados na geração</legend><div class="schedule-grid">${week.map((label,i)=>`<label class="checkbox"><input type="checkbox" name="weekday" value="${i}" ${m.days.includes(i)?'checked':''}>${esc(label)}</label>`).join('')}</div>${row.can_edit?`<button type="submit" ${m.saving?'disabled':''}>Salvar dias do departamento</button>`:''}</fieldset>${generate}<p role="status" data-days-status>${esc(m.saving?'Aguardando confirmação…':m.message||(m.dirty?'Alterações pendentes.':''))}</p>${m.error?`<p role="alert">${esc(m.error)}</p>`:''}</form></details>`;
 }
 function canLeave(){if(m.saving){alert('Aguarde a confirmação dos dias de escala.');return false;}if(m.dirty&&!confirm('Descartar somente os dias de escala ainda não salvos?'))return false;m.dirty=false;return true;}
 document.addEventListener('change',e=>{if(e.target.form?.id!=='department-days-form'||m.saving)return;m.days=[...e.target.form.querySelectorAll('[name=weekday]:checked')].map(x=>Number(x.value));m.dirty=true;m.message='';m.error='';m.request=crypto.randomUUID();e.target.form.querySelector('[data-days-status]').textContent='Alterações pendentes.';const generate=e.target.form.querySelector('[data-days-generate]');if(generate)generate.disabled=true;});
 document.addEventListener('submit',e=>{if(e.target.id!=='department-days-form')return;e.preventDefault();e.stopImmediatePropagation();if(m.saving||!m.row?.can_edit)return;const key=m.key,old=m.row,days=[...m.days];m.saving=true;m.error='';redraw();void(async()=>{try{
  const row=await IASDPISchedules.request('iasdpi_schedule_department_days_save',{p_department:old.department_id,p_expected_version:old.version,p_weekdays:days,p_request_id:m.request});
  if(m.key!==key)return;
  if(!row||row.department_id!==old.department_id||row.version!==old.version+1||!Array.isArray(row.weekdays)||JSON.stringify([...row.weekdays].sort())!==JSON.stringify([...days].sort()))throw Error('Confirmação dos dias inválida.');
  m.row=row;m.days=[...row.weekdays];m.dirty=false;m.request=crypto.randomUUID();m.message=window.IASDPISchedulePreview?'Dias salvos nesta demonstração.':'Dias confirmados pelo Supabase.';
  window.dispatchEvent(new CustomEvent('iasdpi-department-days-saved',{detail:row}));
 }catch(err){if(m.key===key)m.error=err.message+' Sua seleção foi preservada.';}finally{m.saving=false;redraw();}})();},true);
 window.addEventListener('beforeunload',e=>{if(m.dirty||m.saving){e.preventDefault();e.returnValue='';}});
 window.addEventListener('iasdpi-identity-ended',()=>{m.key='';m.row=null;m.dirty=false;m.message='';m.error='';});
 return {page,canLeave};
})();

;
'use strict';
// G3: apresentação; autorização é revalidada pelas RPCs/Edge, nunca pelos botões.
window.IASDPIGovernance=(()=>{
 const enabled=()=>window.IASDPIConfig?.governanceEnabled===true,h=v=>esc(v);
 const s={status:'idle',catalog:null,requests:[],history:[],tab:'users',error:'',message:'',saving:false,link:'',offset:0,historyOffset:0,members:[],memberDepartment:'',found:null,searched:false,generation:0,selectedUser:'',selectedPerson:'',credential:null};
 let code='',resetChurch='',resetMessage='',requestId='',requestSignature='',options=null,optionsError='';
 const caps=[['view','Visualizar'],['edit','Editar escalas'],['publish','Publicar escalas'],['members','Administrar membros'],['access','Delegar acessos'],['requests','Tratar solicitações']];
 const labels={active:'Ativo',suspended:'Suspenso',revoked:'Revogado',pending:'Pendente',verified:'Identidade verificada',rejected:'Rejeitada',resetting:'Redefinição em curso',resolved:'Concluída',failed:'Precisa de revisão'};
 const redraw=()=>{if(['users','access-admin','access-audit','access-request','controlled-reset'].includes(state.page))render();};
 async function rpc(name,body={}){
  const auth=await IASDPIAuth.requireIdentity();const result=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+auth.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!IASDPIAuth.identityCurrent(auth.token))throw Error('Sessão ou igreja alterada. Recarregue.');return result;
 }
 async function load(){const ticket=++s.generation;s.status='loading';s.error='';redraw();try{
  const c=await rpc('iasdpi_governance_catalog');if(!c||!Array.isArray(c.users)||!Array.isArray(c.departments)||!Array.isArray(c.access)||!Array.isArray(c.aliases))throw Error('Resposta de gestão inválida.');
  const [requests,history]=await Promise.all([rpc('iasdpi_access_requests',{p_offset:s.offset}),rpc('iasdpi_governance_history',{p_offset:s.historyOffset})]);if(ticket!==s.generation)return;if(!Array.isArray(requests)||!Array.isArray(history))throw Error('Resposta de fila inválida.');if(!IASDPIAuth.allowed())IASDPIAuth.scopeValidated();s.catalog=c;s.requests=requests;s.history=history;s.status='ready';
 }catch(error){if(ticket===s.generation){s.status='error';s.error=error.message;}}finally{if(ticket===s.generation)redraw();}}
 const userOptions=(chosen='',allowEmpty=true)=>`${allowEmpty?'<option value="">Sem vínculo</option>':''}${[...s.catalog.users,...(s.catalog.is_admin&&s.found?.confirmed&&!s.catalog.users.some(u=>u.user_id===s.found.user_id)?[{user_id:s.found.user_id,name:'Conta identificada · '+s.found.email}]:[])].map(u=>`<option value="${h(u.user_id)}" ${u.user_id===chosen?'selected':''}>${h(u.name)}</option>`).join('')}`;
 const deptOptions=(chosen='',only='can_access')=>s.catalog.departments.filter(d=>d[only]).map(d=>`<option value="${h(d.id)}" ${d.id===chosen?'selected':''}>${h(d.name)}</option>`).join('');
 const legacyToolbar=()=>`<nav class="governance-tabs" aria-label="Gestão de acessos">${[['users','Usuários'],['aliases','Apelidos'],['permissions','Permissões'],['members','Membros'],['requests','Solicitações'],['history','Histórico'],...(s.catalog.is_admin?[['legacy','Contas e convites']]:[])].filter(([tab])=>tab!=='aliases'||s.catalog.is_admin).map(([tab,label])=>`<button type="button" data-gov-tab="${tab}" aria-pressed="${s.tab===tab}">${h(label)}</button>`).join('')}<button type="button" data-gov-action="reload">Atualizar</button></nav>`;
 function legacyUsers(){return `${s.catalog.is_admin?`<section class="panel"><h2>Vincular conta existente</h2><form data-gov-form="find"><label>E-mail exato da conta, inclusive institucional<input name="email" type="email" autocomplete="off" required maxlength="254"></label><button>Localizar conta</button></form>${s.searched?(s.found?s.found.confirmed?'<p role="status">Conta confirmada. Nenhum acesso foi concedido. Escolha o departamento e as permissões para concluir.</p><button data-gov-tab="permissions">Definir permissões</button>':'<p role="status">Confirme a conta no Supabase Auth antes de conceder acesso.</p>':'<p role="status">Nenhuma conta identificada. Utilize um convite individual ou o procedimento institucional de cadastro.</p>'):''}</section>`:''}<section class="panel"><h2>Identidades da igreja</h2><div class="governance-table" tabindex="0" role="region" aria-label="Usuários e situação"><table><thead><tr><th>Nome ou identificador</th><th>Perfil geral</th><th>Situação</th>${s.catalog.is_admin?'<th>Ação</th>':''}</tr></thead><tbody>${s.catalog.users.map(u=>`<tr><td>${h(u.name)}</td><td>${h(u.role==='admin'?'Administrador geral':u.role==='leader'?'Líder geral':'Apenas permissões ministeriais')}</td><td>${h(u.reset_blocked?'Redefinição pendente':labels[u.status]||u.status)}</td>${s.catalog.is_admin?`<td><form data-gov-form="identity" data-user="${h(u.user_id)}"><label>Situação de ${h(u.name)}<select name="status">${['active','suspended','revoked'].map(v=>`<option value="${v}" ${u.status===v?'selected':''}>${labels[v]}</option>`).join('')}</select></label><label>Motivo<input name="reason" minlength="10" maxlength="500" required></label><button type="submit">Salvar situação</button></form></td>`:''}</tr>`).join('')}</tbody></table></div><p class="form-note">Ancião é uma função ministerial; não concede perfil de administrador.</p>${s.catalog.is_admin?`<details><summary>Alterar perfil geral</summary><form data-gov-form="role" class="schedule-grid"><label>Identidade<select name="user" required>${userOptions('',false)}</select></label><label>Perfil<select name="role"><option value="leader">Líder geral</option><option value="admin">Administrador geral</option></select></label><button>Salvar perfil</button></form></details>`:''}</section>`;}

 const modern=()=>s.catalog?.administration_version===11;
 const personOptions=(chosen='',user='')=>'<option value="">Selecione a pessoa</option>'+ (s.catalog.people||[]).filter(p=>p.active&&(!p.auth_user_id||p.auth_user_id===user)).map(p=>`<option value="${h(p.id)}" data-version="${p.version}" ${p.id===chosen?'selected':''}>${h(p.name)}</option>`).join('');
 function toolbar(){if(!modern())return legacyToolbar();if(state.page==='access-audit')return '<p><a href="#access-admin" data-page="access-admin">Usuários e Acessos</a></p>';return `<nav class="governance-tabs" aria-label="Usuários e acessos">${[['users','Usuários'],['permissions','Ministérios e permissões'],['aliases','Apelidos'],['requests','Solicitações']].map(([key,label])=>`<button data-gov-tab="${key}" aria-pressed="${s.tab===key}">${label}</button>`).join('')}<button data-gov-action="reload">Atualizar</button></nav>`;}
 function users(){
  if(!modern())return legacyUsers();const selected=s.catalog.users.find(u=>u.user_id===s.selectedUser),pending=(s.catalog.account_plan||[]).filter(p=>!p.auth_user_id);
  return `<section class="panel"><div class="section-heading"><h2>Usuários da igreja</h2><button data-gov-action="new-account">Nova conta individual</button></div><label>Pesquisar usuário<input type="search" data-gov-search placeholder="Nome, apelido ou ministério"></label><p role="status" data-gov-search-status hidden></p><div class="governance-table" tabindex="0" role="region" aria-label="Usuários e acessos"><table><thead><tr><th>Pessoa</th><th>Apelidos</th><th>Ministérios</th><th>Situação</th><th>Último acesso</th><th>Ações</th></tr></thead><tbody>${s.catalog.users.map(u=>`<tr data-gov-user-row><td><strong>${h(u.name)}</strong><br><small>${u.role==='admin'?'Administrador da igreja':u.person_id?'Cadastro Geral vinculado':'Pessoa ainda não vinculada'}</small></td><td>${s.catalog.aliases.filter(a=>a.user_id===u.user_id).map(a=>h(a.identifier)+(a.enabled?'':' · desativado')).join('<br>')||'—'}</td><td>${(u.departments||[]).map(d=>h(d.name)+' · '+h(labels[d.status]||d.status)).join('<br>')||'Sem permissão ministerial'}</td><td>${h(labels[u.status]||u.status)}${u.must_change_password?'<br><small>Troca de senha obrigatória</small>':''}</td><td>${u.last_sign_in_at?h(displayRecordTimestamp(u.last_sign_in_at)):'Não informado'}</td><td><button data-gov-action="edit-user" data-user="${h(u.user_id)}">Editar</button><button data-gov-action="user-permissions" data-user="${h(u.user_id)}">Permissões</button></td></tr>`).join('')}</tbody></table></div></section>
  ${selected?`<section class="panel"><h2>${h(selected.name)}</h2><form data-gov-form="account-link" data-user="${h(selected.user_id)}"><label>Pessoa do Cadastro Geral<select name="person" required>${personOptions(selected.person_id,selected.user_id)}</select></label><button>Salvar vínculo</button><a href="#schedule-members" data-page="schedule-members">Editar pessoa no Cadastro Geral</a></form><form data-gov-form="identity" data-user="${h(selected.user_id)}"><label>Situação<select name="status">${['active','suspended','revoked'].map(v=>`<option value="${v}" ${selected.status===v?'selected':''}>${labels[v]}</option>`).join('')}</select></label><label>Motivo<input name="reason" required minlength="10" maxlength="500"></label><button>Salvar situação</button></form></section>`:''}
  <section class="panel" id="gov-create-account" ${s.selectedPerson?'':'hidden'}><h2>Nova conta individual</h2><form data-gov-form="create-account"><label>Pessoa do Cadastro Geral<select name="person" required>${personOptions(s.selectedPerson)}</select></label><label>Apelido individual<input name="identifier" pattern="[a-z][a-z0-9._-]{2,63}" maxlength="64" required placeholder="nome-sobrenome.iasdpi"></label><label>E-mail institucional — opcional<input name="email" type="email" maxlength="254"></label><p class="form-note">Sem e-mail pessoal: o servidor usa o domínio institucional configurado.</p><label class="checkbox"><input name="confirmed" type="checkbox" required> Confirmei a identidade desta pessoa</label><button class="primary">Criar conta individual</button><p role="status" data-form-feedback></p></form></section>
  ${s.credential?`<section class="panel" role="status"><h2>Credencial provisória individual</h2><p>${h(s.credential.identifier)} · troca obrigatória no primeiro acesso</p><label>Senha provisória<input id="gov-temporary-password" type="password" readonly autocomplete="off" value="${h(s.credential.password)}"></label><button data-gov-action="reveal-credential">Mostrar/ocultar</button><button data-gov-action="close-credential">Fechar credencial</button><p class="form-note">Entregue por canal privado. Não será exibida novamente.</p></section>`:''}
  <section class="panel"><h2>Responsáveis sem conta</h2>${pending.length?`<ul>${pending.map(p=>`<li>${h(p.name)} · ${(p.departments||[]).map(d=>h(d.name||s.catalog.departments.find(x=>x.id===(d.department_id||d.id))?.name||'Ministério')).join(', ')} <button data-gov-action="prepare-person" data-person="${p.person_id}">Preparar conta</button></li>`).join('')}</ul>`:'<p>Nenhum responsável confirmado sem conta.</p>'}<p class="form-note">Participar ou liderar não concede acesso automaticamente.</p>${(s.catalog.pending_accounts||[]).map(r=>`<p>Tentativa pendente: ${h(r.identifier)} <button data-gov-action="cancel-creation" data-id="${r.id}">Encerrar tentativa</button></p>`).join('')}</section>
  <section class="panel"><details><summary>Vincular conta Auth existente</summary><form data-gov-form="find"><label>E-mail exato<input name="email" type="email" required maxlength="254"></label><button>Localizar conta</button></form>${s.searched?(s.found?.confirmed?`<form data-gov-form="account-link" data-user="${h(s.found.user_id)}"><label>Pessoa<select name="person" required>${personOptions('',s.found.user_id)}</select></label><button>Vincular identidade</button></form>`:'<p role="status">Conta inexistente ou não confirmada.</p>'):''}</details><details><summary>Ferramentas anteriores da Cronoanálise</summary><button data-gov-tab="legacy">Contas e convites da Cronoanálise</button></details></section>`;
 }
 function permissions(){if(!modern())return legacyPermissions();return `<section><h2>Ministérios e permissões</h2><label>Identidade<select data-gov-permission-user><option value="">Selecione a identidade</option>${userOptions(s.selectedUser,false)}</select></label>${s.selectedUser?`<details open><summary>Conceder acesso a outro ministério</summary>${permissionForm(null)}</details>${s.catalog.access.filter(a=>a.user_id===s.selectedUser).map(permissionForm).join('')}`:'<p>Escolha uma identidade para consultar e alterar seus ministérios.</p>'}</section>`;}
 document.addEventListener('change',e=>{if(e.target.matches('[data-gov-permission-user]')){s.selectedUser=e.target.value;redraw();}if(e.target.matches('[data-gov-form="permissions"] [name=kind]')&&e.target.value!=='manual')for(const name of ['view','edit','publish'])e.target.form.elements[name].checked=true;});
 function permissionForm(acl){if(!modern())return legacyPermissionForm(acl);return `<form data-gov-form="permissions" data-version="${acl?.version||0}" class="panel"><div class="schedule-grid"><label>Ministério<select name="department" ${acl?'disabled':''}>${deptOptions(acl?.department_id)}</select></label><label>Identidade<select name="user" ${acl?'disabled':''}>${userOptions(acl?.user_id||s.selectedUser||'',false)}</select></label><label>Perfil<select name="kind">${[['manual','Membro · permissões explícitas'],['leader','Líder confirmado'],['elder','Ancião confirmado']].map(([v,l])=>`<option value="${v}" ${(acl?.responsibility_kind||'manual')===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Situação<select name="status">${['active','suspended','revoked'].map(v=>`<option value="${v}" ${acl?.status===v?'selected':''}>${labels[v]}</option>`).join('')}</select></label></div><fieldset class="governance-caps"><legend>Permissões neste ministério</legend>${caps.slice(0,4).map(([key,label])=>`<label class="checkbox"><input name="${key}" type="checkbox" ${acl?.['can_'+({members:'manage_members'}[key]||key)]?'checked':''}>${key==='edit'?'Editar eventos e escalas':key==='publish'?'Publicar eventos e escalas':label}</label>`).join('')}<label class="checkbox"><input name="approve_general" type="checkbox" ${acl?.can_approve_general_events?'checked':''}> Aprovar eventos gerais — Ancionato autorizado</label></fieldset><button>Salvar permissões</button></form>`;}
 document.addEventListener('input',e=>{if(!e.target.matches('[data-gov-search]'))return;const norm=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),term=norm(e.target.value);const rows=[...document.querySelectorAll('[data-gov-user-row]')];rows.forEach(row=>row.hidden=!norm(row.textContent).includes(term));const note=document.querySelector('[data-gov-search-status]');if(note){const count=rows.filter(row=>!row.hidden).length;note.hidden=!term;note.textContent=count?count+' usuários encontrados.':'Nenhum usuário corresponde à pesquisa.';}});
 document.addEventListener('change',e=>{if(!e.target.matches('[data-gov-form="create-account"] [name=person]'))return;const p=(s.catalog?.account_plan||[]).find(p=>p.person_id===e.target.value);if(p)e.target.form.elements.identifier.value=p.suggested_alias||'';});
 window.addEventListener('hashchange',()=>{s.credential=null;});
 function aliases(){return `<section class="panel"><h2>Apelidos institucionais</h2>${s.catalog.aliases.map(a=>`<form class="governance-alias" data-gov-form="alias" data-identifier="${h(a.identifier)}" data-version="${a.version}" data-original-user="${h(a.user_id||'')}"><strong>${h(a.identifier)}</strong><label>Identidade para ${h(a.identifier)}<select name="user">${userOptions(a.user_id||'')}</select></label><label class="checkbox"><input type="checkbox" name="enabled" ${a.enabled?'checked':''}> Entrada habilitada</label><label>Motivo do vínculo<input name="reason" minlength="10" maxlength="500" required></label><button>Salvar apelido</button></form>`).join('')}<details><summary>Novo identificador</summary><form data-gov-form="alias" data-version="0"><label>Identificador<input name="identifier" pattern="[a-z][a-z0-9._-]{2,63}" maxlength="64" required></label><label>Identidade<select name="user">${userOptions()}</select></label><label class="checkbox"><input name="enabled" type="checkbox"> Entrada habilitada</label><label>Motivo<input name="reason" required minlength="10" maxlength="500"></label><button>Cadastrar identificador</button></form></details></section>`;}
 function legacyPermissionForm(acl){const u=s.catalog.users.find(u=>u.user_id===acl?.user_id),d=s.catalog.departments.find(d=>d.id===acl?.department_id);return `<form data-gov-form="permissions" data-version="${acl?.version||0}" class="panel"><div class="schedule-grid"><label>Departamento<select name="department" ${acl?'disabled':''}>${deptOptions(acl?.department_id)}</select></label><label>Identidade<select name="user" ${acl?'disabled':''}>${userOptions(acl?.user_id||'',false)}</select></label><label>Situação<select name="status">${['active','suspended','revoked'].map(v=>`<option value="${v}" ${acl?.status===v?'selected':''}>${labels[v]}</option>`).join('')}</select></label></div><fieldset class="governance-caps"><legend>Permissões ${h(u?.name||'da identidade')} · ${h(d?.name||'departamento selecionado')}</legend>${caps.map(([key,label])=>`<label class="checkbox"><input name="${key}" type="checkbox" ${(acl?.['can_'+({view:'view',edit:'edit',publish:'publish',members:'manage_members',access:'manage_access',requests:'handle_requests'}[key])])?'checked':''} ${!s.catalog.is_admin&&['access','requests'].includes(key)?'disabled':''}>${h(label)}</label>`).join('')}</fieldset><button>Salvar permissões</button></form>`;}
 function legacyPermissions(){return `<section><h2>Permissões por departamento</h2>${s.catalog.departments.some(d=>d.can_access)?`<details><summary>Conceder acesso</summary>${permissionForm(null)}</details>`:'<p>Consulta de permissões. Alterações dependem de delegação específica.</p>'}${s.catalog.access.filter(a=>s.catalog.departments.some(d=>d.id===a.department_id&&d.can_access)).map(permissionForm).join('')}</section>`;}
 function queue(){return `<section><h2>Solicitações</h2>${s.requests.length?s.requests.map(r=>`<article class="panel"><h3>${h(r.requester_name)} · ${h(r.kind==='password'?'Recuperação de acesso':'Solicitação de acesso')}</h3><p>${h(r.identifier)} · ${h(labels[r.status]||r.status)}</p><p>${h(r.message)}</p><small>${h(displayRecordTimestamp(r.created_at))}</small>${['pending','verified','rejected','failed'].includes(r.status)?`<form data-gov-form="review" data-id="${r.id}" data-version="${r.version}"><label>Procedimento de verificação da identidade<textarea name="verification" required minlength="10" maxlength="1000" placeholder="Registre a confirmação feita fora do site; não inclua documentos ou senhas.">${h(r.verification)}</textarea></label><label>Decisão<select name="status"><option value="verified">Identidade verificada</option><option value="rejected">Rejeitar</option>${r.kind==='access'?'<option value="resolved">Concluir atendimento</option>':''}</select></label><label class="checkbox"><input type="checkbox" required> Confirmei a identidade por canal confiável</label><button>Registrar decisão</button></form>`:''}${r.kind==='password'&&r.status==='verified'?(r.can_reset?`<button type="button" data-gov-action="issue" data-id="${r.id}" data-version="${r.version}">Gerar link de redefinição</button>`:'<p class="form-note">Encaminhe a redefinição ao administrador geral ou operador da identidade compartilhada.</p>'):''}</article>`).join(''):'<p>Nenhuma solicitação nesta página.</p>'}<div class="actions"><button data-gov-action="previous" ${s.offset===0?'disabled':''}>Anterior</button><button data-gov-action="next" ${s.requests.length<50?'disabled':''}>Próxima</button></div></section>`;}
 function members(){return `<section class="panel"><h2>Membros do departamento</h2><form data-gov-form="members-load"><label>Departamento<select name="department">${deptOptions(s.memberDepartment,'can_members')}</select></label><button>Consultar membros</button></form>${s.members.map(m=>`<form data-gov-form="member" data-id="${m.id}" data-version="${m.version}" class="users-inline"><strong>${h(m.name)}</strong><label class="checkbox"><input name="active" type="checkbox" ${m.active?'checked':''}> Vínculo ativo</label><button>Salvar vínculo</button></form>`).join('')}<a href="#schedule-setup" data-page="schedule-setup">Cadastros e habilitações</a></section>`;}
 function legacyHistory(){return `<section class="panel"><h2>Histórico de alterações</h2><div class="governance-table" role="region" tabindex="0" aria-label="Auditoria de acessos"><table><thead><tr><th>Data</th><th>Ação</th><th>Usuário responsável</th>${window.IASDPIConfig?.responsibilityGovernanceEnabled?'<th>Registro e alterações</th>':''}</tr></thead><tbody>${s.history.map(a=>`<tr><td>${h(displayRecordTimestamp(a.created_at))}</td><td>${h(a.action)}</td><td>${h(s.catalog.users.find(u=>u.user_id===a.actor_id)?.name||a.actor_id)}</td>${window.IASDPIConfig?.responsibilityGovernanceEnabled?`<td>${h(a.target_id||'—')}<details><summary>Ver alterações</summary><pre>${h(JSON.stringify(a.details||{},null,2))}</pre></details></td>`:''}</tr>`).join('')}</tbody></table></div><div class="actions"><button data-gov-action="history-previous" ${s.historyOffset===0?'disabled':''}>Anterior</button><button data-gov-action="history-next" ${s.history.length<50?'disabled':''}>Próxima</button></div></section>`;}

 function history(){if(!modern())return legacyHistory();const actions={institutional_access_saved:'Responsável ou permissões alterados',department_archived:'Departamento arquivado',department_saved:'Departamento atualizado',person_created:'Pessoa cadastrada',person_updated:'Pessoa alterada',person_changed:'Cadastro pessoal alterado',membership_changed:'Vínculo ministerial alterado',schedule_department_access_insert:'Permissão ministerial concedida',schedule_department_access_update:'Permissões ministeriais alteradas',iasdpi_access_update:'Perfil geral alterado',identity_states_insert:'Situação de acesso registrada',identity_states_update:'Situação de acesso alterada',department_access_active:'Permissões ministeriais concedidas',department_access_suspended:'Permissões ministeriais suspensas',department_access_revoked:'Permissões ministeriais revogadas',event_approval_requested:'Evento enviado para aprovação',event_approved_and_published:'Evento aprovado e publicado',event_submitted:'Evento enviado para aprovação',event_saved:'Evento salvo',elder_draft:'Rascunho do Ancionato',account_created:'Conta individual criada',account_linked:'Pessoa e identidade vinculadas',account_creation_requested:'Criação de conta solicitada',account_creation_cancelled:'Tentativa de criação encerrada',event_rejected:'Evento rejeitado',event_approved:'Evento aprovado',event_published:'Evento publicado',event_draft:'Rascunho de evento',event_cancelled:'Evento cancelado',schedule_published:'Escala publicada',schedule_draft:'Rascunho de escala',elder_published:'Ancionato publicado',identity_suspended:'Acesso suspenso',identity_revoked:'Acesso revogado',alias_binding:'Apelido vinculado',own_password_changed:'Senha própria alterada',reset_issue:'Redefinição autorizada',reset_complete:'Redefinição concluída'};
 const fields={status:'Situação',approval_status:'Aprovação',enabled:'Acesso ativo',role:'Perfil geral',can_view:'Visualizar',can_edit:'Editar',can_publish:'Publicar',can_manage_members:'Administrar membros',responsibility_kind:'Responsabilidade',can_approve_general_events:'Aprovar eventos gerais',version:'Versão',name:'Nome',display_name:'Nome preferido',title:'Título',active:'Ativo',date:'Data',end_date:'Data final',starts_on:'Início',ends_on:'Fim',kind:'Modalidade',is_restricted:'Restrito',person_id:'Responsável',department_id:'Departamento'};
 const value=v=>s.catalog.people?.find(p=>p.id===v)?.display_name||s.catalog.departments.find(d=>d.id===v)?.name||(v===true?'Sim':v===false?'Não':v==null?'—':labels[v]||({published:'Publicado',draft:'Rascunho',cancelled:'Cancelado',approved:'Aprovado',rejected:'Rejeitado',pending:'Pendente',manual:'Permissões explícitas',leader:'Líder',elder:'Ancião',admin:'Administrador'})[v]||String(v));
 return `<section class="panel"><h2>Histórico administrativo</h2>${s.history.length?'':'<p role="status">Nenhuma alteração registrada.</p>'}<div class="governance-table" role="region" tabindex="0" aria-label="Auditoria administrativa"><table><thead><tr><th>Data</th><th>Ação</th><th>Responsável</th><th>Registro</th><th>Alterações</th></tr></thead><tbody>${s.history.map(a=>{const before=a.details?.before||{},after=a.details?.after||{},recorded=(a.details?.changed_fields||[]).filter(k=>fields[k]),changes=Object.keys(fields).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));return `<tr><td>${h(displayRecordTimestamp(a.created_at))}</td><td>${h(actions[a.action]||a.action.replaceAll('_',' '))}</td><td>${h(s.catalog.users.find(u=>u.user_id===a.actor_id)?.name||a.actor_id||'Não informado')}</td><td>${h(s.catalog.users.find(u=>u.user_id===a.target_id)?.name||s.catalog.people.find(p=>p.id===a.target_id)?.name||a.target_id||'—')}</td><td>${changes.length?`<details><summary>Ver alterações</summary><dl>${changes.map(k=>`<dt>${fields[k]}</dt><dd>${h(value(before[k]))} → ${h(value(after[k]))}</dd>`).join('')}</dl></details>`:recorded.length?'Campos: '+recorded.map(k=>h(fields[k])).join(', '):'Alteração registrada'}</td></tr>`;}).join('')}</tbody></table></div><div class="actions"><button data-gov-action="history-previous" ${s.historyOffset===0?'disabled':''}>Anterior</button><button data-gov-action="history-next" ${s.history.length<50?'disabled':''}>Próxima</button></div></section>`;
 }
 function page(){if(state.page==='access-admin'&&window.IASDPIInstitutionalAccess?.enabled())return IASDPIInstitutionalAccess.page();if(modern()){if(state.page==='access-audit')s.tab='history';else if(s.tab==='history')s.tab='users';}if(!enabled())return heading('ADMINISTRAÇÃO','Gestão de acessos','Módulo aguardando ativação.');if(s.status==='idle'){queueMicrotask(load);return '<p role="status">Carregando acessos…</p>';}if(s.status==='loading')return '<p role="status">Carregando acessos…</p>';if(s.status==='error')return `<section class="panel"><h1>Gestão de acessos</h1><p role="alert">${h(s.error)}</p><button data-gov-action="reload">Tentar novamente</button><form data-gov-form="login">${IASDPIAuth.loginIdentifierField()}${field('Senha','password','','password',true,'autocomplete="current-password"')}<button>Entrar</button></form></section>`;
 return heading('ADMINISTRAÇÃO',modern()?(state.page==='access-audit'?'Auditoria':'Usuários e Acessos'):'Gestão de acessos',IASDPIChurches.current()?.name||IASDPIChurches.selected())+toolbar()+`<p role="status">${h(s.message)}</p>${s.error?`<p role="alert">${h(s.error)}</p>`:''}${s.link?`<section class="panel"><label>Link privado · validade de 15 minutos<input readonly value="${h(s.link)}"></label><p class="form-note">Entregue somente ao solicitante cuja identidade foi verificada.</p><button data-gov-action="copy">Copiar link</button></section>`:''}`+(s.tab==='legacy'?legacyUsersPage():({users,aliases,permissions,members,requests:queue,history}[s.tab]||users)());}
 async function edge(body,authenticated=false){if(window.IASDPIConfig?.remoteReadOnly||window.IASDPIConfig?.remoteDisabled)throw Error('Modo de consulta: alterações bloqueadas.');const cfg=IASDPIAuth.config(),auth=authenticated?await IASDPIAuth.requireIdentity():null;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);let response;try{response=await fetch(cfg.url+'/functions/v1/access-assistance',{method:'POST',redirect:'error',headers:{apikey:cfg.key,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth.token}:{})},body:JSON.stringify(body),signal:controller.signal});}finally{clearTimeout(timer);}if(!response.ok)throw Error('Não foi possível concluir. Confira os dados ou procure a administração.');if(auth&&!IASDPIAuth.identityCurrent(auth.token))throw Error('Sessão alterada.');return response.json();}
 async function loadOptions(){try{options=await IASDPIAuth.jsonRequest('/rest/v1/rpc/iasdpi_access_request_options',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!Array.isArray(options))throw Error('Resposta inválida.');optionsError='';}catch(e){options=null;optionsError=e.message;}finally{redraw();}}
 function requestPage(){if(!enabled())return heading('ACESSO','Solicitações','Módulo aguardando ativação.');if(options===null&&!optionsError){options='loading';queueMicrotask(loadOptions);}if(options==='loading')return '<p role="status">Carregando departamentos…</p>';if(optionsError)return `<section class="panel"><h1>Solicitações</h1><p role="alert">${h(optionsError)}</p><button data-gov-action="options">Tentar novamente</button></section>`;return heading('ACESSO','Solicitar acesso ou recuperação',IASDPIChurches.current()?.name||IASDPIChurches.selected())+`<section class="panel">${optionsError?`<p role="alert">${h(optionsError)}</p><button data-gov-action="options">Tentar novamente</button>`:''}<form data-gov-form="request">${field('Seu nome','name','','text',true,'maxlength="100"')}${field('Identificador ou e-mail institucional','identifier','','text',true,'maxlength="254" autocomplete="username"')}<label>Departamento<select name="department"><option value="">Administração geral</option>${(options||[]).map(d=>`<option value="${h(d.id)}">${h(d.name)}</option>`).join('')}</select></label><label>O que precisa?<select name="kind"><option value="access">Solicitar acesso</option><option value="password">Recuperar acesso / senha</option></select></label><label>Mensagem<textarea name="message" maxlength="1000"></textarea></label><p class="form-note">Não informe senhas nem documentos. A administração verificará sua identidade.</p><button>Enviar solicitação</button><p role="status" data-form-feedback></p></form></section>`;}
 function captureReset(fragment){const m=/^controlled-reset\/([A-Z][A-Z0-9_]{2,39})\/([a-f0-9]{64})$/.exec(fragment);if(!m)return false;resetChurch=m[1];code=m[2];resetMessage='';historyReplace();return true;}
 function historyReplace(){window.history.replaceState(null,'','#controlled-reset');}
 function resetPage(){return heading('ACESSO','Definir nova senha','Redefinição autorizada pela administração.')+`<section class="panel">${resetMessage?`<p role="status" data-form-feedback>${h(resetMessage)}</p>`:enabled()&&code?`<form data-gov-form="reset">${field('Nova senha','password','','password',true,'minlength="12" maxlength="256" autocomplete="new-password"')}${field('Confirmar nova senha','repeat','','password',true,'minlength="12" maxlength="256" autocomplete="new-password"')}<button>Redefinir senha</button><p role="status" data-form-feedback></p></form>`:'<p>Reabra o link privado recebido da administração. Ele pode ter expirado ou já sido utilizado.</p>'}<a href="#login" data-auth-page="login">Entrar</a></section>`;}
 document.addEventListener('click',e=>{if(!enabled())return;const tab=e.target.closest('[data-gov-tab]'),button=e.target.closest('[data-gov-action]');if(!tab&&!button)return;e.preventDefault();if(s.saving)return;if(button&&['new-account','prepare-person','edit-user','user-permissions','reveal-credential','close-credential'].includes(button.dataset.govAction)){const action=button.dataset.govAction;if(action==='new-account'||action==='prepare-person'){s.selectedPerson=button.dataset.person||(s.catalog.people||[]).find(p=>p.active&&!p.auth_user_id)?.id||'';s.tab='users';}if(action==='edit-user'){s.selectedUser=button.dataset.user;s.tab='users';}if(action==='user-permissions'){s.selectedUser=button.dataset.user;s.tab='permissions';}if(action==='close-credential')s.credential=null;if(action==='reveal-credential'){const input=document.getElementById('gov-temporary-password');if(input)input.type=input.type==='password'?'text':'password';return;}redraw();return;}if(button?.dataset.govAction==='cancel-creation'){if(confirm('Encerrar a tentativa? Confira o Auth antes de tentar criar novamente; nenhuma conta será excluída.'))void rpc('iasdpi_account_creation_cancel',{p_id:button.dataset.id}).then(load).catch(e=>{s.error=e.message;redraw();});return;}if(tab){s.tab=tab.dataset.govTab;s.error='';redraw();return;}void(async()=>{const a=button.dataset.govAction;if(a==='copy'){await navigator.clipboard.writeText(s.link);s.message='Link copiado para envio privado.';redraw();return;}if(a==='options'){await loadOptions();return;}if(a==='issue'){if(!confirm('A identidade foi verificada? Entregue o link apenas à pessoa correta.'))return;const result=await edge({action:'issue',church:await IASDPIChurches.ensure(),request_id:button.dataset.id,version:Number(button.dataset.version)},true);s.link=location.href.split('#')[0]+'#controlled-reset/'+IASDPIChurches.selected()+'/'+result.code;s.message='Link de uso único emitido. Não é uma senha.';}if(a==='previous')s.offset=Math.max(0,s.offset-50);if(a==='next')s.offset+=50;if(a==='history-previous')s.historyOffset=Math.max(0,s.historyOffset-50);if(a==='history-next')s.historyOffset+=50;await load();})().catch(err=>{s.error=err.message;redraw();});});
 document.addEventListener('submit',e=>{const f=e.target;if(!enabled()||!f.dataset.govForm)return;e.preventDefault();e.stopImmediatePropagation();if(s.saving)return;s.saving=true;const data=new FormData(f),mode=f.dataset.govForm;const feedback=f.querySelector('[data-form-feedback]');const buttons=[...f.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);void(async()=>{
 if(mode==='login'){const password=String(data.get('password'));f.elements.password.value='';await IASDPIAuth.loginIdentity(String(data.get('email')),password);await load();return;}
 if(mode==='request'){const payload={action:'submit',church:await IASDPIChurches.ensure(),name:String(data.get('name')),identifier:String(data.get('identifier')),department:String(data.get('department'))||null,kind:String(data.get('kind')),message:String(data.get('message'))};const signature=JSON.stringify(payload);if(signature!==requestSignature){requestId=crypto.randomUUID();requestSignature=signature;}await edge({...payload,id:requestId});feedback.textContent='Solicitação recebida para verificação administrativa.';return;}
 if(mode==='reset'){if(data.get('password')!==data.get('repeat'))throw Error('As senhas precisam ser iguais.');await edge({action:'complete',church:resetChurch,code,password:String(data.get('password'))});code='';f.reset();resetMessage='Senha redefinida. Aguarde dois segundos e entre novamente. As sessões anteriores foram encerradas.';feedback.textContent=resetMessage;redraw();void IASDPIAuth.restore().catch(()=>{});return;}
 if(mode==='account-link'){const option=f.elements.person.selectedOptions[0];await rpc('iasdpi_account_link',{p_person:String(data.get('person')),p_expected_version:Number(option.dataset.version),p_user:f.dataset.user});s.message='Pessoa vinculada, sem concessão automática de permissões.';await load();return;}
 if(mode==='create-account'){const originPage=state.page,ticket=s.generation;if(!confirm('Criar conta individual? Nenhuma permissão ministerial será concedida automaticamente.'))return;const option=f.elements.person.selectedOptions[0];const result=await edge({action:'create_account',church:await IASDPIChurches.ensure(),person:String(data.get('person')),version:Number(option.dataset.version),identifier:String(data.get('identifier')).trim().toLowerCase(),email:String(data.get('email')||''),request_id:f.dataset.request||=crypto.randomUUID()},true);if(result.completed!==true)throw Error('Criação não confirmada.');if(ticket!==s.generation||originPage!==state.page)return;s.credential=result.credential_available?{identifier:result.identifier,password:result.password}:null;s.selectedPerson='';setTimeout(()=>{s.credential=null;redraw();},120000);s.message='Conta criada. Configure as permissões nos ministérios autorizados.';await load();return;}
 if(mode==='find'){const rows=await rpc('iasdpi_find_account',{p_email:String(data.get('email'))});if(!Array.isArray(rows))throw Error('Resposta de conta inválida.');s.found=rows[0]||null;s.searched=true;redraw();return;}
 if(mode==='alias'){const user=String(data.get('user'))||null;if(f.dataset.originalUser&&f.dataset.originalUser!==user&&!confirm('Desvincular ou substituir a identidade deste apelido?'))return;await rpc('iasdpi_alias_save',{p_identifier:f.dataset.identifier||String(data.get('identifier')),p_user_id:user,p_enabled:data.has('enabled')&&Boolean(user),p_expected_version:Number(f.dataset.version),p_reason:String(data.get('reason'))});}
 if(mode==='permissions'){const flags=Object.fromEntries((modern()?caps.slice(0,4):caps).map(([key])=>[key,Boolean(f.elements[key].checked)]));await rpc(modern()?'iasdpi_governance_permission_save':'iasdpi_department_access_save',{p_department:f.elements.department.value,p_user:f.elements.user.value,p_flags:flags,p_status:String(data.get('status')),p_expected_version:Number(f.dataset.version),...(modern()?{p_kind:String(data.get('kind')),p_approve_general:data.has('approve_general')}:{})});}
 if(mode==='identity'){if(!confirm('Confirmar alteração da situação de acesso?'))return;await rpc(modern()?'iasdpi_account_state_save':'iasdpi_identity_state_save',{p_user:f.dataset.user,p_status:String(data.get('status')),p_reason:String(data.get('reason'))});}
 if(mode==='role'){if(!confirm('Alterar o perfil geral desta identidade?'))return;await rpc('iasdpi_set_access',{p_user_id:String(data.get('user')),p_role:String(data.get('role')),p_enabled:true});}
 if(mode==='review')await rpc('iasdpi_access_request_review',{p_id:f.dataset.id,p_expected_version:Number(f.dataset.version),p_status:String(data.get('status')),p_verification:String(data.get('verification'))});
 if(mode==='members-load'){s.memberDepartment=String(data.get('department'));s.members=await rpc('iasdpi_department_members',{p_department:s.memberDepartment});redraw();return;}
 if(mode==='member'){await rpc('iasdpi_schedule_save',{p_entity:'membership',p_id:f.dataset.id,p_expected_version:Number(f.dataset.version),p_data:{active:data.has('active')},p_request_id:crypto.randomUUID()});s.members=await rpc('iasdpi_department_members',{p_department:s.memberDepartment});redraw();return;}
 if(['identity','role'].includes(mode))await IASDPIAuth.requireAccess().catch(()=>{});s.message='Alteração confirmada pelo servidor.';await load();
 })().catch(err=>{if(feedback)feedback.textContent=err.message;else{let note=f.querySelector('[data-gov-error]');if(!note){note=document.createElement('p');note.setAttribute('role','alert');note.dataset.govError='';f.append(note);}note.textContent=err.message;}}).finally(()=>{s.saving=false;buttons.forEach(b=>b.disabled=false);});},true);
 function clearPrivate(){s.generation++;s.catalog=null;s.requests=[];s.history=[];s.members=[];s.status='idle';s.link='';s.error='';s.message='';s.offset=0;s.historyOffset=0;s.memberDepartment='';s.found=null;s.searched=false;s.credential=null;s.selectedUser='';s.selectedPerson='';}
 window.addEventListener('iasdpi-identity-ended',clearPrivate);
 for(const event of ['iasdpi-auth-changed','iasdpi-role-changed'])window.addEventListener(event,()=>{clearPrivate();if(['users','access-admin','access-audit'].includes(state.page))redraw();});
 return {enabled,page,requestPage,resetPage,captureReset,load};
})();

// Tabela institucional: pessoas e permissões continuam nos cadastros/RPCs existentes.
window.IASDPIInstitutionalAccess=(()=>{
 const enabled=()=>IASDPIConfig.institutionalAccessEnabled===true,h=v=>esc(v);
 const m={phase:'idle',catalog:null,error:'',message:'',drafts:new Map(),busy:false,epoch:0,secrets:0,reset:null};
 const redraw=()=>{if(state.page==='access-admin')render();};
 async function rpc(name,data={}){const i=await IASDPIAuth.requireIdentity();const r=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+i.token,'Content-Type':'application/json'},body:JSON.stringify(data)});if(!IASDPIAuth.identityCurrent(i.token))throw Error('Sessão alterada. Entre novamente.');return r;}
 async function load(){const ticket=++m.epoch;m.phase='loading';redraw();try{const c=await rpc('iasdpi_institutional_catalog');if(ticket!==m.epoch)return;if(!c?.is_admin||!Array.isArray(c.slots)||!Array.isArray(c.people))throw Error('Somente administrador pode gerenciar acessos.');m.catalog=c;m.phase='ready';}catch(e){if(ticket===m.epoch){m.error=e.message;m.phase='error';}}finally{if(ticket===m.epoch)redraw();}}
 const rowValue=row=>m.drafts.get(row.identifier)||{person_id:row.person_id||'',departments:[...(row.departments||[])],approve_general:Boolean(row.approve_general)};
 function row(row){const v=rowValue(row),people=m.catalog.people.filter(p=>p.active||p.id===v.person_id).sort((a,b)=>a.display_name.localeCompare(b.display_name,'pt-BR')),departments=m.catalog.departments.filter(d=>d.active||v.departments.includes(d.id)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return `<tr data-institutional-row="${h(row.identifier)}"><th scope="row"><strong>${h(row.identifier)}</strong><small>${h(row.label)}${row.archived?' · Arquivado':''}</small></th><td><details class="institutional-people"><summary>${h(people.find(p=>p.id===v.person_id)?.display_name||'Selecionar responsável')}</summary><label>Pesquisar pessoa<input type="search" data-slot-search autocomplete="off" aria-label="Pesquisar responsável de ${h(row.identifier)}"></label><select data-slot-person size="5" aria-label="Responsável de ${h(row.identifier)}" ${row.archived?'disabled':''}><option value="">Sem responsável</option>${people.map(p=>`<option value="${h(p.id)}" ${p.id===v.person_id?'selected':''}>${h(p.display_name)}</option>`).join('')}</select></details>${row.credential_pending?'<small class="warning">Redefinição de credencial pendente</small>':!row.user_id?'<small>Acesso pendente de ativação</small>':''}${row.kind==='member'?'<small>Conta de leitura compartilhada; responsável pela custódia.</small>':''}</td><td>${row.kind==='admin'?'<span>Controle completo da igreja</span>':`<details class="institutional-permissions"><summary>${v.departments.length} ${row.kind==='member'?(v.departments.length===1?'departamento para consulta':'departamentos para consulta'):(v.departments.length===1?'departamento autorizado':'departamentos autorizados')}</summary><fieldset ${row.archived?'disabled':''}><legend class="sr-only">Permissões de ${h(row.identifier)}</legend>${departments.map(d=>`<label class="checkbox"><input type="checkbox" data-slot-department value="${h(d.id)}" ${v.departments.includes(d.id)?'checked':''}>${h(d.name)}${d.active?'':' (arquivado)'}</label>`).join('')}${row.kind==='elder'?`<label class="checkbox"><input type="checkbox" data-slot-approval ${v.approve_general?'checked':''}>Aprovar eventos gerais</label>`:''}</fieldset></details>`}</td><td><button type="button" data-slot-reset title="A redefinição vale para todos os logins da mesma identidade." ${!row.user_id||!row.person_id||row.archived||m.busy?'disabled':''}>Redefinir senha</button></td><td><button type="button" data-slot-save ${row.archived||m.busy?'disabled':''}>Salvar</button></td></tr>`;}
 function page(){if(!enabled())return '';if(m.phase==='idle'){queueMicrotask(load);return '<p role="status">Carregando usuários e acessos…</p>';}if(m.phase==='loading')return '<p role="status">Carregando usuários e acessos…</p>';if(m.phase==='error')return heading('ADMINISTRAÇÃO','Usuários e Acessos','')+`<p role="alert">${h(m.error)}</p><button data-institutional-reload>Tentar novamente</button>`;
 const active=m.catalog.slots.filter(r=>!r.archived),archived=m.catalog.slots.filter(r=>r.archived);
 const table=rows=>`<div class="table-scroll" tabindex="0" role="region" aria-label="Logins institucionais"><table class="institutional-table"><thead><tr><th>Login</th><th>Responsável</th><th>Permissões</th><th>Redefinir senha</th><th>Salvar</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div>`;
 return heading('ADMINISTRAÇÃO','Usuários e Acessos','')+`<p role="status">${h(m.message)}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}<section class="panel institutional-panel">${table(active)}${archived.length?`<details><summary>Arquivados (${archived.length})</summary>${table(archived)}</details>`:''}</section>${m.reset?`<section class="panel" role="status"><label>Link privado de redefinição<input readonly autocomplete="off" data-institutional-reset-link value="${h(m.reset)}"></label><small>Uso único · 15 minutos. Entregue somente ao responsável confirmado.</small><button data-institutional-close-reset>Fechar</button></section>`:''}<details class="panel"><summary>Departamentos</summary><form data-institutional-department><label>Nome do departamento<input name="name" maxlength="120" minlength="2" required></label><button ${m.busy?'disabled':''}>Criar departamento</button></form><div class="institutional-departments">${m.catalog.departments.map(d=>`<div><span>${h(d.name)}${d.active?'':' · Arquivado'}</span><button data-institutional-archive="${h(d.id)}" ${m.busy?'disabled':''}>${d.active?'Arquivar':'Reativar'}</button></div>`).join('')}</div></details>`;
 }
 function remember(el){const tr=el.closest('[data-institutional-row]');if(!tr)return;const id=tr.dataset.institutionalRow,row=m.catalog.slots.find(r=>r.identifier===id);m.drafts.set(id,{person_id:tr.querySelector('[data-slot-person]').value,departments:[...tr.querySelectorAll('[data-slot-department]:checked')].map(e=>e.value),approve_general:Boolean(tr.querySelector('[data-slot-approval]')?.checked)});return row;}
 document.addEventListener('input',e=>{if(!e.target.matches('[data-slot-search]'))return;const norm=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const term=norm(e.target.value);for(const option of e.target.closest('details').querySelector('select').options)option.hidden=Boolean(option.value)&&!norm(option.textContent).includes(term);});
 document.addEventListener('change',e=>{if(!e.target.matches('[data-slot-person],[data-slot-department],[data-slot-approval]'))return;remember(e.target);if(e.target.matches('[data-slot-person]')){const details=e.target.closest('details');details.querySelector('summary').textContent=e.target.selectedOptions[0].textContent;details.open=false;}if(e.target.matches('[data-slot-department]')){const details=e.target.closest('details');const count=details.querySelectorAll(':checked').length;details.querySelector('summary').textContent=count+(count===1?' departamento autorizado':' departamentos autorizados');}});
 async function mutate(work){if(m.busy)return;m.busy=true;m.error='';const ticket=m.epoch;try{const msg=await work();if(ticket!==m.epoch)return;m.message=msg;await load();}catch(e){if(ticket===m.epoch)m.error=e.message;}finally{m.busy=false;redraw();}}
 document.addEventListener('click',e=>{if(!enabled())return;const b=e.target.closest('[data-slot-save],[data-slot-reset],[data-institutional-reload],[data-institutional-close-reset],[data-institutional-archive]');if(!b)return;e.preventDefault();if(b.hasAttribute('data-institutional-reload')){void load();return;}if(b.hasAttribute('data-institutional-close-reset')){m.reset=null;redraw();return;}if(m.busy)return;
 if(b.dataset.institutionalArchive){const d=m.catalog.departments.find(d=>d.id===b.dataset.institutionalArchive);if(!confirm((d.active?'Arquivar':'Reativar')+' '+d.name+'? O histórico será preservado.'))return;void mutate(async()=>{await rpc('iasdpi_institutional_department_save',{p_id:d.id,p_expected_version:d.version,p_name:d.name,p_active:!d.active});window.dispatchEvent(new Event('iasdpi-registry-saved'));window.dispatchEvent(new Event('iasdpi-role-changed'));return 'Departamento atualizado; histórico preservado.';});return;}
 const tr=b.closest('[data-institutional-row]'),row=remember(b),v=m.drafts.get(row.identifier);
 if(b.hasAttribute('data-slot-save')){const changed=(row.person_id||'')!==v.person_id;if(changed&&!confirm('Trocar responsável? Será obrigatória a redefinição de credencial, com bloqueio das sessões anteriores. A autoria histórica será preservada.'))return;const elevated=(row.kind==='admin'&&(changed||!row.user_id&&v.person_id))||v.approve_general&&!row.approve_general;if(elevated&&!confirm(row.kind==='admin'?'Conceder controle ADMINISTRATIVO COMPLETO da igreja à pessoa selecionada?':'Autorizar esta conta de ancião a APROVAR eventos gerais?'))return;void mutate(async()=>{const result=await rpc('iasdpi_institutional_save',{p_identifier:row.identifier,p_expected_version:row.version,p_person:v.person_id||null,p_departments:v.departments,p_approve_general:v.approve_general,p_confirm_reset:changed,p_confirm_elevated:elevated});if(m.drafts.get(row.identifier)===v)m.drafts.delete(row.identifier);window.dispatchEvent(new Event('iasdpi-registry-saved'));return result.credential_pending?'Salvo. Redefina a credencial antes do novo acesso.':'Permissões salvas.';});return;}
 if(!confirm('Confirmei a identidade do responsável. Emitir link de redefinição e bloquear as sessões anteriores?'))return;
 void mutate(async()=>{const secretTicket=m.secrets,auth=await IASDPIAuth.requireIdentity(),response=await fetch(IASDPIAuth.config().url+'/functions/v1/access-assistance',{method:'POST',headers:{Authorization:'Bearer '+auth.token,'Content-Type':'application/json',apikey:IASDPIAuth.config().key},body:JSON.stringify({action:'institutional_reset',church:await IASDPIChurches.ensure(),identifier:row.identifier,version:row.version})});if(!IASDPIAuth.identityCurrent(auth.token)||secretTicket!==m.secrets)throw Error('Sessão ou página alterada.');if(!response.ok)throw Error('Redefinição não concluída. Confira o responsável e tente novamente.');const result=await response.json();if(result.self_change){navigate('reset-password');return 'Altere sua própria senha.';}if(!/^[a-f0-9]{64}$/.test(result.code))throw Error('Resposta inválida.');m.reset=location.href.split('#')[0]+'#controlled-reset/'+IASDPIChurches.selected()+'/'+result.code;setTimeout(()=>{m.reset=null;redraw();},120000);return 'Link privado emitido. Nenhuma senha foi exibida.';});
 });
 document.addEventListener('submit',e=>{if(!enabled()||!e.target.matches('[data-institutional-department]'))return;e.preventDefault();const name=e.target.elements.name.value;void mutate(async()=>{await rpc('iasdpi_institutional_department_save',{p_id:crypto.randomUUID(),p_expected_version:0,p_name:name,p_active:true});window.dispatchEvent(new Event('iasdpi-registry-saved'));window.dispatchEvent(new Event('iasdpi-role-changed'));return 'Departamento criado.';});});
 function clear(){m.epoch++;m.phase='idle';m.catalog=null;m.drafts.clear();m.reset=null;m.message='';m.error='';}
 for(const event of ['iasdpi-identity-ended','iasdpi-auth-changed'])window.addEventListener(event,clear);
 window.addEventListener('hashchange',()=>{m.reset=null;m.secrets++;});
 return {enabled,page};
})();

;
'use strict';
// Portal público da homologação. A cronoanálise continua no módulo oficial autenticado.
window.IASDPIChurchPortal=(()=>{
 const integrated=()=>window.IASDPIPortalAccess?.enabled();
 const cronoUrl='https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/#home';
 const h=value=>esc(value),zone='America/Sao_Paulo';
 const link=(page,label,extra='')=>`<a href="#${page}" ${integrated()?'data-page':'data-demo-view'}="${page}" ${extra}>${h(label)}</a>`;
 const crono=(label='Abrir cronoanálise')=>`<a class="schedule-secondary" href="${integrated()?'#home':cronoUrl}" ${integrated()?'data-page="home"':'target="_blank" rel="noopener noreferrer"'} aria-label="${h(label+' · acesso com login'+(integrated()?'':', abre em outra aba'))}">${h(label)} <svg class="portal-external-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`;
 const group=page=>page.startsWith('schedule-')?'schedule-calendar':page;
 function home(){
  if(integrated())return portalHome();
  const other=integrated()&&IASDPIChurches.selected()&&IASDPIChurches.selected()!=='IASD_PI';
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date()),events=(other?[]:agendaEvents()).filter(e=>e.endDate>=today).slice(0,4);
  return (integrated()?IASDPIPortalAccess.workspace():'')+heading('IGREJA ADVENTISTA DO SÉTIMO DIA',integrated()?(IASDPIChurches.current()?.name||'IASD Parada Inglesa'):'Parada Inglesa','Agenda e ministérios.')+`<section class="church-portal-cards" aria-label="Áreas da igreja"><article class="panel"><h2>Escalas</h2><p>Equipes e responsabilidades.</p>${link('schedule-calendar','Ver escalas','class="schedule-secondary"')}${link('schedule-build','Montar escala','class="church-inline-link"')}</article><article class="panel"><h2>Organograma</h2><p>Ministérios e responsáveis.</p>${link('organization','Ver organograma','class="schedule-secondary"')}</article><article class="panel"><h2>Agenda</h2><p>Compromissos da igreja.</p>${link('agendas','Ver agenda','class="schedule-secondary"')}</article><article class="panel"><h2>Cronoanálise <span class="badge neutral">Com login</span></h2><p>Programação e horários dos cultos.</p>${crono()}</article></section><section class="panel"><div class="section-heading"><h2>Próximos compromissos</h2>${link('agendas','Ver agenda')}</div>${agendaSource().status==='synced'?(events.length?`<ul class="portal-upcoming">${events.map(e=>`<li><time datetime="${h(e.startDate)}">${h(displayDate(e.startDate))}</time><span>${h(e.title)}</span></li>`).join('')}</ul>`:'<p>Nenhum compromisso futuro nesta cópia da agenda.</p>'):'<p role="status">A agenda não está disponível nesta cópia.</p>'}</section>`;
 }
 function portalHome(){
  const access=IASDPIPortalAccess,other=IASDPIChurches.selected()&&IASDPIChurches.selected()!=='IASD_PI',today=new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date()),events=(other?[]:agendaEvents()).filter(e=>e.endDate>=today).slice(0,4);
  const card=(title,text,page,label,cls='')=>`<article class="portal-home-card ${cls}"><h2>${h(title)}</h2><p>${h(text)}</p>${link(page,label,'class="'+(cls?'primary portal-home-action':'church-inline-link')+'"')}</article>`;
  return heading('IASD PARADA INGLESA','A vida da igreja, em um só lugar.','Consulte a programação e acompanhe os ministérios.')+`<section class="church-portal-cards portal-home-grid" aria-label="Áreas da igreja">${card('Calendário','Eventos e escalas publicadas, organizados por dia.','schedule-calendar','Ver calendário','portal-home-featured')}${card('Organograma','Conheça os ministérios, responsáveis e equipes.','organization','Conhecer os ministérios')}${access.valid()?`${access.can('schedule-build')?card('Escalas','Monte as equipes e revise as escalas antes de publicar.','schedule-build','Montar escala'):''}${window.IASDPIEvents?.enabled()&&access.can('events')?card('Eventos','Organize os eventos da igreja e dos departamentos.','events','Gerenciar eventos'):''}${card('Cronoanálise','Planejamento, registro e acompanhamento dos cultos.','home','Abrir Cronoanálise')}`:''}</section>${window.IASDPIConfig?.initialOperational?'':`<section class="panel portal-next-events"><div class="section-heading"><h2>Próximas programações</h2>${link('schedule-calendar','Ver calendário')}</div>${agendaSource().status==='synced'?(events.length?`<ul class="portal-upcoming">${events.map(e=>`<li><time datetime="${h(e.startDate)}">${h(displayDate(e.startDate))}</time><span>${h(e.title)}</span></li>`).join('')}</ul>`:'<p>Nenhuma programação futura nesta cópia da agenda.</p>'):'<p role="status">A agenda não está disponível nesta cópia.</p>'}</section>`}`;
 }
 function moduleNav(page){return `<nav class="portal-module-nav" aria-label="Área de escalas">${[['schedule-build','Montar escala'],['schedule-calendar','Calendário'],['schedule-members','Cadastro Geral'],['schedule-setup','Cadastros'],['schedule-settings','Configurações']].map(([target,label])=>`<button type="button" data-demo-view="${target}" ${page===target?'aria-current="page"':''}>${h(label)}</button>`).join('')}</nav>`;}
 function page(page){
  if(page==='church-home')return home();
  if(page==='organization')return organizationPage();
  if(page==='agendas')return agendasPage();
  const content=page==='schedule-build'?IASDPIScheduleManagement.page():['schedule-members','schedule-settings'].includes(page)?IASDPIScheduleDailyAdmin.page(page):page==='schedule-calendar'?IASDPIScheduleCalendar.page():IASDPISchedules.page();
  return moduleNav(page)+content;
 }
 function agendaProvenance(area,source){
  const manual=['communication','sound'].includes(area),department=area==='communication'?'Comunicação':'Sonoplastia',dates=manual?ministrySchedules[department].map(e=>e.date).sort():[];
  const title=manual?'Escala manual de '+department:'Agenda oficial · cópia publicada';
  const description=manual?'Informação fornecida pela liderança, sem sincronização automática. Vigência: '+displayDate(dates[0])+' a '+displayDate(dates.at(-1))+'.':(source.status==='synced'?'Fonte consultada em '+displayRecordTimestamp(source.syncedAt)+'.':'Fonte ainda não disponível.')+' Abrir esta página não atualiza o calendário de origem.';
  return `<section class="portal-source" aria-label="Fonte da agenda" data-source="${manual?'manual':'official'}"><span>${h(title)}</span>${IASDPIScheduleUI.help('portal-agenda-source',description,'Origem das informações da agenda')}</section>`;
 }
 document.addEventListener('click',e=>{
  if(integrated()||!window.IASDPISchedulePreview||state.page!=='agendas')return;const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(!action.startsWith('agenda-'))return;e.preventDefault();
  if(action==='agenda-current')selectAgendaMonth(today().slice(0,7));
  else if(['agenda-calendar','agenda-list'].includes(action)){agendaState.view=action==='agenda-calendar'?'calendar':'list';render();}
  else if(['agenda-previous','agenda-next'].includes(action)){changeAgendaMonth(action==='agenda-next'?1:-1);return;}
  else if(action==='agenda-day'){agendaState.day=button.dataset.id;render();document.querySelector('.calendar-day[data-id="'+agendaState.day+'"]')?.focus();return;}
  document.querySelector('[data-action="'+action+'"]')?.focus({preventScroll:true});
 });
 document.addEventListener('change',e=>{
  if(integrated()||!window.IASDPISchedulePreview||state.page!=='agendas'||!['agenda-area','agenda-department','agenda-show-people','agenda-month-picker'].includes(e.target.id))return;
  const id=e.target.id;if(id==='agenda-area')agendaState.area=e.target.value;else if(id==='agenda-department')agendaState.department=e.target.value;else if(id==='agenda-show-people')agendaState.showPeople=e.target.checked;else selectAgendaMonth(e.target.value);
  render();document.getElementById(id)?.focus({preventScroll:true});
 });
 return {home,page,group,agendaProvenance,cronoUrl};
})();

;
'use strict';
// G4: integra contexto ministerial; todas as autorizações continuam no servidor.
window.IASDPIPortalAccess=(()=>{
 const enabled=()=>window.IASDPIConfig?.portalAccessEnabled===true,h=v=>esc(v);
 const s={phase:'idle',catalog:null,churches:[],error:'',token:null,church:'',generation:0,preferred:''};let loading=null;
 const feeds=new Map();const church=()=>window.IASDPIChurches?.selected()||'IASD_PI';
 const memberPages=new Set(['schedule-build','schedule-setup','schedule-members','schedule-settings','access-admin','access-audit','users','events']);
 const publicPages=new Set(['church-home','agendas','organization','schedule-calendar','portal-login','access-request']);
 const redraw=()=>{if(enabled()&&typeof render==='function')render();};
 async function rpc(name,args={},identity){const result=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',...(identity?{Authorization:'Bearer '+identity.token}:{})},body:JSON.stringify(args)});if(identity&&!IASDPIAuth.identityCurrent(identity.token))throw Error('Sessão ou igreja alterada.');return result;}
 async function ensure(){if(loading)return loading;const ticket=s.generation;s.phase='loading';loading=(async()=>{try{
  const identity=await IASDPIAuth.requireIdentity(),churches=await rpc('iasdpi_my_churches',{},identity);
  if(!Array.isArray(churches))throw Error('Resposta de igrejas inválida.');if(ticket!==s.generation)return;s.churches=churches;if(!churches.some(c=>c.code===church()))throw Error('Esta identidade não possui acesso à igreja selecionada.');
  const catalog=await rpc('iasdpi_portal_context',{},identity);if(!catalog||!Array.isArray(catalog.departments)||typeof catalog.is_admin!=='boolean')throw Error('Resposta de permissões inválida.');
  if(ticket!==s.generation)return;s.catalog=catalog;s.churches=churches;s.token=identity.token;s.church=church();s.phase='ready';s.error='';if(!IASDPIAuth.allowed())IASDPIAuth.scopeValidated();
  window.dispatchEvent(new Event('iasdpi-portal-context'));
 }catch(e){if(ticket===s.generation){s.phase='error';s.catalog=null;s.token=null;s.error=e.message;}}finally{if(ticket===s.generation){loading=null;redraw();}}})();return loading;}
 function valid(){return s.phase==='ready'&&s.church===church()&&IASDPIAuth.identityCurrent(s.token);}
 function departments(){return valid()?s.catalog.departments.filter(d=>d.active).slice().sort((a,b)=>Number(Boolean(b.can_edit||b.can_publish||b.can_manage_members))-Number(Boolean(a.can_edit||a.can_publish||a.can_manage_members))||a.name.localeCompare(b.name,'pt-BR')):[];}
 function can(page){if(!valid())return false;if(s.catalog.published_only)return false;if(window.IASDPIConfig?.initialOperational&&(['access-admin','access-audit','access-request'].includes(page)||!s.catalog.is_admin))return false;if(page==='events')return s.catalog.is_admin||departments().some(d=>d.can_edit||d.can_publish);if(['access-admin','access-audit','users'].includes(page)&&window.IASDPIConfig?.governanceAdministrationEnabled)return s.catalog.is_admin;if(['access-admin','access-audit','users','events'].includes(page))return s.catalog.is_admin||departments().some(d=>d.can_manage_access||d.can_handle_requests||d.can_manage_members);if(page==='schedule-members')return s.catalog.is_admin||(window.IASDPIRegistry?.enabled()&&departments().some(d=>d.can_manage_members));if(page==='schedule-settings')return s.catalog.is_admin;return departments().length>0;}
 function switcher(){return s.churches.length&&(s.churches.length>1||!s.churches.some(c=>c.code===church()))?`<label>Igreja autorizada<select id="portal-church">${!s.churches.some(c=>c.code===church())?'<option value="">Escolha uma igreja autorizada</option>':''}${s.churches.map(c=>`<option value="${h(c.code)}" ${c.code===church()?'selected':''}>${h(c.name)}</option>`).join('')}</select></label>`:'';}
 function loginPage(){return heading('ACESSO MINISTERIAL',window.IASDPIEvents?.enabled()?'Entrar no IASDPI':'Entrar para gerenciar escalas',IASDPIChurches.current()?.name||'Selecione a igreja e entre com sua identidade autorizada.')+`<section class="panel auth-panel">${s.error?`<p role="alert">${h(s.error)}</p><button type="button" data-portal-retry>Tentar novamente</button>`:''}<form id="portal-login-form">${IASDPIChurches.loginSelector()}${IASDPIAuth.loginIdentifierField()}${field('Senha','password','','password',true,'autocomplete="current-password"')}${IASDPIAuth.rememberField()}<button type="submit" class="primary">Entrar</button><p role="status" data-portal-feedback></p></form>${window.IASDPIConfig?.initialOperational?'<p><a href="#forgot-password" data-page="forgot-password">Esqueci minha senha</a></p>':`<p><a href="#access-request" data-page="access-request">Solicitar acesso ou recuperação</a></p>`}<p><a href="#login" data-page="login">Entrar na Cronoanálise</a></p></section>`;}
 function guard(page){if(!enabled()||!memberPages.has(page))return null;if(s.phase==='ready'&&!valid())s.phase='idle';if(s.phase==='idle'){queueMicrotask(ensure);return '<p role="status">Recuperando acesso ministerial…</p>';}if(s.phase==='loading')return '<p role="status">Verificando permissões da igreja…</p>';if(!valid())return loginPage();if(!can(page))return `<section class="panel"><h1>Acesso restrito</h1><p>Você não possui autorização para esta área na igreja selecionada.</p><a href="#church-home" data-page="church-home">Voltar ao início</a></section>`;return null;}
 function workspace(){if(!enabled()||!valid())return '';const selector=switcher();return selector?`<section class="portal-workspace" aria-label="Igreja selecionada">${selector}</section>`:'';}
 function feedKey(month){return church()+':'+month+(window.IASDPIConfig?.calendarPrivacyEnabled?':'+(IASDPIAuth.identityKey()||'public'):'');}
 function feed(month){const key=feedKey(month);if(!feeds.has(key)){feeds.set(key,{phase:'loading',rows:[],error:''});queueMicrotask(()=>refreshFeed(month));}return feeds.get(key);}
 async function refreshFeed(month){const key=feedKey(month);feeds.set(key,{phase:'loading',rows:[],error:''});try{
  if(window.IASDPIConfig?.remoteDisabled===true)throw Error('Conexão preparada; acesso remoto ainda desativado.');
  await window.IASDPIInitialConnection?.check();
  const cfg=IASDPIAuth.config(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let result;
  const identity=window.IASDPIConfig?.calendarPrivacyEnabled&&IASDPIAuth.identityKey()?await IASDPIAuth.requireIdentity():null;
  try{const response=await fetch(cfg.url+IASDPIAuth.rpcPath('/rest/v1/rpc/'+(identity?'iasdpi_schedule_visible':'iasdpi_schedule_published')),{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json','x-iasdpi-church':key.split(':')[0],...(identity?{Authorization:'Bearer '+identity.token}:{})},body:JSON.stringify({p_month:month+'-01'}),signal:controller.signal});if(!response.ok)throw Error('Não foi possível carregar as escalas publicadas.');result=await response.json();}finally{clearTimeout(timer);}
  if(!Array.isArray(result)||result.some(r=>!r||typeof r.id!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||(r.person!=null&&typeof r.person!=='string')||typeof r.department!=='string'||!['Escala publicada no sistema','Histórico manual confirmado'].includes(r.origin)))throw Error('Resposta pública inválida.');
  if(key!==feedKey(month)||identity&&!IASDPIAuth.identityCurrent(identity.token))return;feeds.set(key,{phase:'ready',rows:(identity?result:result.filter(r=>r.department==='Ancionato')).map(r=>({...r,person:r.person??''})),error:''});
 }catch(e){feeds.set(key,{phase:'error',rows:[],error:e.name==='AbortError'?'A consulta demorou demais. Tente novamente.':e.message});}finally{if((state.page==='schedule-calendar'||window.IASDPIConfig?.calendarPrivacyEnabled&&state.page==='agendas')&&key===feedKey(month))redraw();}}
 function feedRows(month){return enabled()?feed(month).rows:[];}
 function feedStatus(month){if(!enabled())return '';const f=feed(month),pending=f.rows.filter(r=>r.pending).reduce((sum,r)=>sum+(r.vacancy_count||1),0);return `<div class="portal-feed-state" role="${f.phase==='error'?'alert':'status'}">${f.phase==='loading'?'Carregando escalas publicadas…':f.phase==='error'?h(f.error)+` <button data-portal-feed="${h(month)}">Tentar novamente</button>`:f.rows.length?(pending?f.rows.length+' registros publicados · '+pending+' '+(pending===1?'vaga a definir.':'vagas a definir.'):f.rows.length+' atribuições publicadas neste mês.'):(window.IASDPIConfig?.initialOperational?'Nenhuma escala publicada neste mês.':'Nenhuma escala administrada publicada neste mês. As fontes históricas continuam abaixo.')}</div>`;}
 function clear(){feeds.clear();s.generation++;s.phase='idle';s.catalog=null;s.token=null;s.churches=[];s.preferred='';loading=null;}
 for(const event of ['iasdpi-identity-ended','iasdpi-auth-changed','iasdpi-role-changed'])window.addEventListener(event,clear);
 window.addEventListener('iasdpi-schedule-published',()=>{feeds.clear();});
 window.addEventListener('iasdpi-registry-saved',()=>{feeds.clear();});
 document.addEventListener('click',e=>{if(!enabled())return;if(e.target.closest('[data-portal-retry]')){e.preventDefault();void ensure();redraw();return;}const pageLink=e.target.closest('#app a[data-page]');if(pageLink){e.preventDefault();navigate(pageLink.dataset.page);return;}const retry=e.target.closest('[data-portal-feed]'),department=e.target.closest('[data-portal-department]');if(retry){e.preventDefault();void refreshFeed(retry.dataset.portalFeed);redraw();}if(department){e.preventDefault();if(!departments().some(d=>d.id===department.dataset.portalDepartment))return;if(!canLeaveRegistration())return;s.preferred=department.dataset.portalDepartment;void IASDPIScheduleManagement.load();navigate('schedule-build');}},true);
 document.addEventListener('change',e=>{if(!enabled()||e.target.id!=='portal-church')return;const code=e.target.value;if(!s.churches.some(c=>c.code===code)||!canLeaveRegistration()){e.target.value=church();return;}try{IASDPIChurches.switchAuthorized(code);}catch(error){s.error=error.message;s.phase='error';redraw();}});
 document.addEventListener('submit',e=>{if(!enabled()||e.target.id!=='portal-login-form')return;e.preventDefault();e.stopImmediatePropagation();const f=e.target,password=f.elements.password.value;f.elements.password.value='';const button=f.querySelector('button[type=submit]'),feedback=f.querySelector('[data-portal-feedback]');button.disabled=true;feedback.textContent='Confirmando identidade…';void(async()=>{await IASDPIAuth.loginIdentity(f.elements.email.value,password,{remember:f.elements.remember.checked,church:f.elements.church?.value});await ensure();if(valid()){if(s.catalog.published_only)navigate('schedule-calendar');else if(state.page==='portal-login')navigate('schedule-build');else redraw();}})().catch(error=>{s.generation++;loading=null;s.phase='error';s.catalog=null;s.error=error.message;redraw();}).finally(()=>{button.disabled=false;});},true);
 return {enabled,can,guard,ensure,departments,workspace,valid,status:()=>s.phase,isAdmin:()=>valid()&&s.catalog.is_admin,preferred:()=>{const d=s.preferred;s.preferred='';return d;},isPublic:page=>publicPages.has(page)||memberPages.has(page),loginPage,feedRows,feedStatus,refreshFeed};
})();

// Organização visual do portal. As rotas e as autorizações permanecem nos módulos.
window.IASDPIPortalNavigation=(()=>{
 const crono=new Set(['home','programs','edit','plan-edit','actuals','tracking','summary','history','archive','models','trash','login','forgot-password','reset-password','invite']);
 const administration=new Set(['schedule-members','schedule-setup','schedule-settings','access-admin','access-audit','access-request','users','models','archive','trash']);
 let shell=null;
 const anchor=(page,label)=>`<a href="#${page}" data-portal-route="${page}">${esc(label)}</a>`;
 function module(page){if(page==='agendas'||page==='schedule-calendar')return 'schedule-calendar';if(administration.has(page))return 'administration';if(crono.has(page))return 'home';if(page==='schedule-build')return 'schedule-build';return page;}
 function install(){
  const header=document.querySelector('.header'),nav=header.querySelector('nav'),links=new Map([...nav.querySelectorAll('a[data-page]')].map(a=>[a.dataset.page,a])),logout=document.getElementById('auth-logout');
  const create=(tag,cls)=>{const el=document.createElement(tag);el.className=cls;return el;},primary=create('div','portal-primary-links'),legacy=create('span','portal-legacy-links');legacy.hidden=true;
  if(!links.has('access-audit')){const a=create('a','');a.href='#access-audit';a.dataset.page='access-audit';a.textContent='Auditoria';links.set('access-audit',a);}
  const admin=create('details','portal-admin-menu'),summary=create('summary','');summary.textContent='Administração';admin.append(summary);
  const groups=create('div','portal-admin-links');admin.append(groups);
  for(const [title,pages] of [['Pessoas e equipes',['schedule-members','schedule-setup']],['Governança',['schedule-settings','access-admin','access-audit','users','access-request']],['Registros da Cronoanálise',['models','history','archive','trash']]]){
   const section=create('section','portal-admin-group'),heading=create('h2','');heading.textContent=title;section.append(heading);groups.append(section);
   for(const page of pages)if(links.has(page))section.append(links.get(page));
  }
  const labels={'church-home':'Início','schedule-calendar':'Calendário','schedule-build':'Escalas',events:'Eventos',organization:'Organograma',home:'Cronoanálise','portal-login':'Entrar','schedule-members':'Cadastro Geral','schedule-setup':'Departamentos e funções','schedule-settings':'Configurações de escalas','access-admin':'Usuários e Acessos','access-audit':'Auditoria','access-request':'Solicitações e recuperação',models:'Modelos de liturgia',history:'Histórico de cultos',archive:'Arquivos e backups',trash:'Lixeira',users:'Usuários da Cronoanálise'};
  for(const page of ['church-home','schedule-calendar','schedule-build','events','organization','home','portal-login'])if(links.has(page))primary.append(links.get(page));
  const account=create('div','portal-account');account.setAttribute('aria-label','Conta conectada');account.innerHTML='<span class="portal-account-avatar" aria-hidden="true">●</span><span class="portal-account-identity"><strong data-account-label>Minha conta</strong><small data-account-church></small></span>';if(window.IASDPIConfig?.responsibilityGovernanceEnabled){const password=create('a','portal-account-password');password.href='#reset-password';password.dataset.authPage='reset-password';password.textContent='Alterar senha';account.append(password);}account.append(logout);
  for(const a of links.values())if(a.parentNode===nav)legacy.append(a);
  nav.replaceChildren(primary,admin,account,legacy);nav.id='portal-main-navigation';
  const toggle=create('button','portal-menu-toggle');toggle.type='button';toggle.textContent='Menu';toggle.setAttribute('aria-controls',nav.id);toggle.setAttribute('aria-expanded','false');header.insertBefore(toggle,nav);
  header.classList.add('portal-header');document.body.classList.add('portal-navigation-ready');
  shell={header,nav,links,primary,admin,groups,account,logout,toggle,labels};return shell;
 }
 function sync(page){
  if(!window.IASDPIPortalAccess?.enabled())return;
  const n=shell||install(),portal=IASDPIPortalAccess,signed=Boolean(IASDPIAuth.identityKey()),admin=portal.isAdmin()||IASDPIAuth.isAdmin();
  if(signed&&portal.status()==='idle')queueMicrotask(()=>portal.ensure());
  for(const [page,a] of n.links){if(n.labels[page])a.textContent=n.labels[page];a.hidden=true;a.classList.remove('selected');a.removeAttribute('aria-current');}
  const show=page=>{const a=n.links.get(page);if(a)a.hidden=false;};
  for(const target of ['church-home','schedule-calendar','organization'])show(target);
  if(signed){if(portal.can('schedule-build'))show('schedule-build');if(window.IASDPIEvents?.enabled()&&portal.can('events'))show('events');show('home');}
  else show('portal-login');
  for(const page of ['schedule-members','schedule-setup','schedule-settings','access-admin'])if(portal.valid()&&portal.can(page))show(page);
  if(admin&&window.IASDPIConfig?.governanceAdministrationEnabled)show('access-audit');if(admin){for(const page of ['models','history','archive','trash',...(window.IASDPIConfig?.initialOperational?[]:['access-request'])])show(page);if(!window.IASDPIConfig?.initialOperational&&!window.IASDPIGovernance?.enabled())show('users');}
  n.groups.querySelectorAll('section').forEach(s=>s.hidden=![...s.querySelectorAll('a')].some(a=>!a.hidden));
  n.admin.hidden=![...n.groups.querySelectorAll('a')].some(a=>!a.hidden);
  n.account.hidden=!signed;n.logout.hidden=!signed;
  n.account.querySelector('[data-account-label]').textContent=admin?'Administrador':'Minha conta';
  n.account.querySelector('[data-account-church]').textContent=IASDPIChurches.current()?.name||'IASD Parada Inglesa';
  n.header.querySelector('.brand').href='#church-home';n.header.querySelector('.brand small').textContent='Parada Inglesa';
  const active=!signed&&!['church-home','agendas','schedule-calendar','organization'].includes(page)?'portal-login':module(page),link=n.links.get(active);
  if(link&&!link.hidden){link.classList.add('selected');link.setAttribute('aria-current','page');}
  if(active==='administration'&&!n.admin.hidden)n.admin.querySelector('summary').setAttribute('aria-current','page');else n.admin.querySelector('summary').removeAttribute('aria-current');
  for(const a of n.groups.querySelectorAll('a'))if(a.dataset.page===page){a.classList.add('selected');a.setAttribute('aria-current','page');}
 }
 function context(page){
  if(!window.IASDPIPortalAccess?.enabled())return;
  let content='';
  if(crono.has(page)&&IASDPIAuth.allowed())content=`<nav class="portal-context-nav" aria-label="Cronoanálise">${[['home','Visão geral'],['programs','Programações'],['actuals','Registrar culto'],['tracking','Acompanhar'],['history','Histórico']].map(([target,label])=>anchor(target,label)).join('')}</nav>`;
  if(administration.has(page)&&page!=='access-request')content=`<div class="portal-breadcrumb">${anchor('church-home','Início')}<span aria-hidden="true">/</span><span>Administração</span></div>`+content;
  if(content){app.insertAdjacentHTML('afterbegin',content);const target=page==='summary'?'history':['edit','plan-edit'].includes(page)?'programs':page;app.querySelectorAll('[data-portal-route]').forEach(a=>{if(a.dataset.portalRoute===target)a.setAttribute('aria-current','page');});}
 }
 function close(){if(!shell)return;shell.header.dataset.menuOpen='false';shell.toggle.setAttribute('aria-expanded','false');shell.header.querySelectorAll('details').forEach(d=>d.open=false);}
 document.addEventListener('click',e=>{
  if(!window.IASDPIPortalAccess?.enabled())return;
  if(e.target.closest('.portal-menu-toggle')){const open=shell.header.dataset.menuOpen!=='true';shell.header.dataset.menuOpen=String(open);shell.toggle.setAttribute('aria-expanded',String(open));return;}
  const route=e.target.closest('[data-portal-route]');if(route){e.preventDefault();openNavigation(route.dataset.portalRoute);close();return;}
  if(e.target.closest('.portal-header a[data-page],#auth-logout'))close();
  else if(shell&&!e.target.closest('.portal-header'))shell.header.querySelectorAll('details').forEach(d=>d.open=false);
 });
 document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!shell)return;const details=e.target.closest('.portal-header details[open]');if(details){details.open=false;details.querySelector('summary').focus();e.preventDefault();}else if(shell.header.dataset.menuOpen==='true'){close();shell.toggle.focus();e.preventDefault();}});
 return {sync,context,module};
})();

// A primeira operação usa Auth por e-mail e o backend existente, sem aliases/Edge.
window.IASDPIInitialConnection=(()=>{
 let ready=false,pending=null;
 async function check(){if(!IASDPIConfig.initialOperational)return;if(IASDPIConfig.remoteDisabled)throw Error('Conexão preparada, aguardando ativação autorizada.');if(ready)return;if(pending)return pending;
 pending=(async()=>{const cfg=IASDPIAuth.config(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{
  const r=await fetch(cfg.url+IASDPIAuth.rpcPath('/rest/v1/rpc/iasdpi_initial_status'),{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json','x-iasdpi-church':'IASD_PI'},body:'{}',signal:controller.signal});
  if(!r.ok)throw Error('Integração inicial indisponível. Confira a instalação autorizada do banco.');const value=await r.json();if(value.mode!==(IASDPIConfig.isolatedPilot?'isolated-admin-v1':'initial-admin-v1')||value.church_code!=='IASD_PI'||!value.published_only)throw Error('Backend incompatível com esta versão operacional.');ready=true;
 }catch(e){throw Error(e.name==='AbortError'?'Banco indisponível: a consulta demorou demais. Tente novamente.':e.message);}finally{clearTimeout(timer);pending=null;}})();return pending;
 }
 return {check};
})();

;
'use strict';
const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const state = { programs: [], selected: null, page: 'home', busy: false, zone: 'America/Sao_Paulo', offset: 0, duplicate: null, programsLoad: {status:'idle',error:''} };
let programsLoadGeneration=0;
let bootInProgress=false,sessionWasAuthorized=false;
let bootTask=null,pendingNavigation=null;
const thresholds = { onTime: 1, attention: 5 };
const roles = ['Ancião do mês', 'Recepção', 'Diácono', 'Diaconisa', 'Diretor de culto', 'Sonoplastia', 'Equipe de louvor', 'Responsável pela programação'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const minutes = (end,start,day) => {const a=recordEpoch(end,day),b=recordEpoch(start,day);return a===null||b===null?null:(a-b)/60000;};
const currentTime = () => new Date(Date.now() + state.offset);
const clock = value => actualClock(value)||'—';
const dateLabel = value => {const day=recordDay(value);return day?new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(day+'T12:00:00Z')):'Data inconsistente — corrija no registro';};
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: state.zone }).format(currentTime());
const signed = value => { if(value===null||!Number.isFinite(value))return '—';const n = Math.round(value); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} min`; };
const duration = value => value==null||!Number.isFinite(value)?'—':`${Math.round(value)} min`;
const elapsed = start => { if(recordEpoch(start)===null)return '—';const seconds = Math.max(0, Math.floor((currentTime() - new Date(start)) / 1000)); return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2, '0')}`; };
function statusTone(value) { if(value===null||!Number.isFinite(value))return 'neutral';const n = Math.round(value); return n <= thresholds.onTime ? 'good' : n <= thresholds.attention ? 'warning' : 'critical'; }
function delayLabel(value) { if(value===null||!Number.isFinite(value))return 'Dados insuficientes';const n = Math.round(value); return n < 0 ? `${Math.abs(n)} min adiantado` : n <= 1 ? 'No horário' : `${n} min de atraso`; }
function toast(message, error = false) {
  notice.textContent = message; notice.className = error ? 'error' : ''; notice.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { notice.hidden = true; }, 6000);
}
async function api(path = '', method = 'GET', body) {
  if(window.IASDPIOperational)return window.IASDPIOperational.request(path,method,body);
  const authorization=path==='health'?null:await IASDPIAuth.requireAccess();
  if (window.IASDPIDemo){const result=await window.IASDPIDemo.request(path,method,body);if(method!=='GET'&&cloudState.session)void cloudAutoArchive();return result;}
  const response = await fetch(`/api/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(authorization?{Authorization:'Bearer '+authorization.token}:{}),...(window.IASDPIChurches?.headers()||{}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if(authorization&&IASDPIAuth.session()?.access_token!==authorization.token)throw Error('Sessão encerrada.');
  if (!response.ok) {if(response.status===401||response.status===403)void IASDPIAuth.restore().catch(()=>{});const failure=new Error(result.error||'Não foi possível concluir a operação.');if(response.status===409)failure.code='40001';throw failure;}
  if(method!=='GET'&&cloudState.session)void cloudAutoArchive();
  return result;
}
async function loadPrograms({renderState=false}={}){
  const generation=++programsLoadGeneration;
  state.programsLoad={status:'loading',error:''};if(renderState)render();
  try{
    const rows=await api('programs');
    if(!Array.isArray(rows)||rows.some(p=>!p||typeof p.id!=='string'||!p.plan||!Array.isArray(p.plan.items))||new Set(rows.map(p=>p.id)).size!==rows.length)throw Error('Resposta inválida ao consultar as programações.');
    if(generation!==programsLoadGeneration||!IASDPIAuth.allowed())return null;
    state.programs=rows;state.programsLoad={status:rows.length?'records':'empty',error:''};
    return rows;
  }catch(error){
    if(generation===programsLoadGeneration&&IASDPIAuth.allowed())state.programsLoad={status:'error',error:error.message};
    throw error;
  }finally{if(renderState&&generation===programsLoadGeneration)render();}
}
function programsLoadView(){
  const {status,error}=state.programsLoad;
  if(status==='error')return `<section class="empty" role="alert" data-load-state="error"><h2>Erro ao carregar os registros</h2><p>${esc(error)}</p><p>Não foi possível confirmar os dados. Isso não significa que não existam registros. Os dados já carregados e os rascunhos foram preservados.</p>${button('Tentar novamente','retry-programs','','class="primary"')}</section>`;
  return '<section class="empty" role="status" data-load-state="loading"><h2>Carregando registros…</h2><p>Aguarde a confirmação da consulta.</p></section>';
}
function selected() { return state.programs.find(p => p.id === state.selected); }
function replaceProgram(program) {
  const i = state.programs.findIndex(p => p.id === program.id);
  if (i < 0) state.programs.unshift(program); else state.programs[i] = program;
  state.selected = program.id;
  if(['records','empty'].includes(state.programsLoad.status))state.programsLoad={status:'records',error:''};
}
function executionInfo(p) {
  const source=p,samples=activitySamples(source),counts=sampleCounts(samples),day=recordDay(source.plan.date);
  const extraSamples=(source.extra_events||[]).map(e=>recordInterval(e.start,e.end,day));
  const extraCounts=sampleCounts(extraSamples);
  const actualComplete=counts.total>0&&samples.every(s=>s.actual.state==='valid')&&extraSamples.every(e=>e.state==='valid');
  let complete=actualComplete&&counts.considered===counts.total;
  p=programForMetrics(p);
  const items = p.plan.items;
  const active = p.execution_mode === 'manual' ? null : items.find(i => p.executions[i.id]?.started && !p.executions[i.id].ended);
  const pending = items.find(i => !p.executions[i.id]?.started);
  const finished = samples.filter(s=>s.actual.state==='valid').map(s=>s.item);
  const records = Object.values(p.extra_events?.length?registrationData(p).executions:p.executions).filter(e=>e?.started);
  const first = [...records].sort((a,b) => new Date(a.started)-new Date(b.started))[0];
  const last = records.filter(e => e.ended).sort((a,b) => new Date(b.ended)-new Date(a.ended))[0];
  let shift = null;
  const plannedInterval=recordInterval(source.planned_start||source.plan.start,source.planned_end||source.plan.end,day);
  complete &&= plannedInterval.state==='valid';
  if (p.status === 'Finalizada') {if(complete&&last&&plannedInterval.state==='valid')shift = minutes(last.ended, p.planned_end);}
  else if (active) {
    const e = p.executions[active.id];
    const plannedDuration = minutes(active.planned_end, active.planned_start);
    const delta=minutes(e.started,active.planned_start);
    shift=delta===null||plannedDuration===null?null:delta+Math.max(0,minutes(currentTime(),e.started)-plannedDuration);
  } else if (p.plan.date === today() && p.status === 'Pronta') {
    const delta=minutes(currentTime(),p.planned_start);shift=delta===null?null:Math.max(0,delta);
  }
  const origin = items.find(i => {
    const e = p.executions[i.id];
    return e && (minutes(e.started, i.planned_start) > thresholds.onTime || (e.ended && minutes(e.ended, i.planned_end) > thresholds.onTime));
  }) || (active && shift > thresholds.onTime ? active : null);
  const expected = items.find(i => currentTime() >= new Date(i.planned_start) && currentTime() < new Date(i.planned_end));
  const forecast = p.planned_end&&shift!==null?new Date(new Date(p.planned_end).getTime() + shift * 60000):null;
  const actualDuration=actualComplete&&first&&last?minutes(last.ended,first.started):null;
  return { active, pending, finished, first, last, shift, origin, expected, forecast, complete, counts, extraCounts, actualDuration };
}
function badge(value, label = delayLabel(value)) { return `<span class="badge ${statusTone(value)}">${esc(label)}</span>`; }
function heading(eyebrow, title, description = '', action = '') {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description ? `<p class="muted">${description}</p>` : ''}</div>${action}</div>`;
}
function empty(title, description, action = '') { return `<div class="empty"><h2>${title}</h2><p>${description}</p>${action}</div>`; }
function button(label, action, id = '', extra = '') { return `<button type="button" data-action="${action}" data-id="${esc(id)}" ${extra}>${label}</button>`; }
function programDate(value){return dateLabel(value);}
function programStatus(p) {
  const tone={'Planejamento':'neutral','Pronta':'good','Em andamento':'warning','Finalizada':'complete'}[p.status] || 'neutral';
  return `<span class="badge ${tone}">${esc(p.status==='Planejamento'?'Rascunho':p.status)}</span>`;
}
function programRow(p, historic = false) {
  const m = executionInfo(p);
  const view=programForMetrics(p);const planned = recordInterval(view.planned_start,view.planned_end,recordDay(p.plan.date)).minutes;
  const actual = m.actualDuration;
  return `<tr><td><strong>${esc(p.plan.name)}</strong><small>${esc(programDate(p.plan.date))}</small></td>
    <td>${esc(displayPlannedTime(p.plan.start||'—'))} → ${esc(displayPlannedTime(p.plan.end||'—'))}${historic ? `<small>${duration(planned)} previstos · ${actual === null ? '—' : duration(actual)} realizados</small>` : ''}</td>
    <td>${historic ? badge(m.shift, signed(m.shift)) : `${programStatus(p)}`}</td>
    <td class="row-actions">${button(historic || p.status==='Finalizada' ? 'Ver resumo' : ['Planejamento','Pronta'].includes(p.status) ? 'Editar' : 'Ver programação', historic || p.status==='Finalizada' ? 'summary' : 'edit', p.id)}${button('Duplicar', 'duplicate', p.id)}${!historic&&window.IASDPIOperational&&IASDPIAuth.isAdmin()?button('Mover para a lixeira','trash-move',p.id,'class="danger-text"'):''}${!historic ? button(p.execution_mode === 'manual' ? 'Registrar culto' : 'Acompanhar', p.execution_mode === 'manual' ? 'actuals' : 'track', p.id, 'class="primary"') : ''}</td></tr>`;
}
function programTable(programs, historic = false) {
  return `<div class="table-scroll"><table><thead><tr><th>Programação</th><th>Horário ${historic ? '/ duração' : 'previsto'}</th><th>${historic ? 'Desvio do término' : 'Status'}</th><th>Ações</th></tr></thead><tbody>${programs.map(p => programRow(p, historic)).join('')}</tbody></table></div>`;
}
function home() {
  const upcoming = state.programs.filter(p => p.status !== 'Finalizada' && p.plan.date >= today())
    .sort((a, b) => `${a.plan.date} ${a.plan.start}`.localeCompare(`${b.plan.date} ${b.plan.start}`))[0];
  const running = state.programs.find(p => p.status === 'Em andamento');
  const featured = running || upcoming;
  const recent = state.programs.filter(p => p.status === 'Finalizada').sort((a,b) => String(b.plan.date||'').localeCompare(String(a.plan.date||''))).slice(0, 5);
  return heading('BEM-VINDO', 'Cada momento, no seu tempo.', 'Uma programação clara. Um acompanhamento tranquilo.', `<div class="actions">${button('Nova programação', 'new', '', 'class="primary"')} ${button('Registrar culto', 'chronogram')}</div>`) +
    (featured ? `<section class="featured"><div><p class="eyebrow">${running ? 'EM ANDAMENTO' : 'PRÓXIMO CULTO'}</p><h2>${esc(featured.plan.name)}</h2><div class="featured-meta"><p class="date">${esc(programDate(featured.plan.date))}</p>${programStatus(featured)}</div><p class="large-time">${esc(displayPlannedTime(featured.plan.start||'—'))} <span>→</span> ${esc(displayPlannedTime(featured.plan.end||'—'))}</p><div class="actions">${button('Abrir programação', 'edit', featured.id)}${button(featured.execution_mode==='manual'?'Registrar culto':running?'Continuar acompanhamento':'Acompanhar culto', featured.execution_mode==='manual'?'actuals':'track', featured.id, 'class="primary"')}</div></div><div class="featured-aside"><span class="eyebrow">PLANEJAMENTO</span><strong>${featured.plan.items.length}</strong><span>momentos organizados</span></div></section>` : empty('Vamos preparar a próxima programação?', 'Use Nova programação para planejar ou Registrar culto para informar o que aconteceu.')) +
    `<section class="section"><div class="section-heading"><h2>Últimas programações</h2>${recent.length ? `<span class="muted">Desvio médio do término: ${signed(endStatistics(recent).mean)} · ${endStatistics(recent).considered} considerados / ${endStatistics(recent).excluded} desconsiderados</span>` : ''}</div>${recent.length ? programTable(recent, true) : '<p class="muted">Os resumos aparecerão aqui após finalizar uma programação.</p>'}</section>`;
}
function programsPage() {
  const list = [...state.programs].sort((a,b) => String(b.plan.date||'').localeCompare(String(a.plan.date||'')));
  return heading('PLANEJAMENTO', 'Programações', 'Organize horários, atividades e responsáveis.', `<div class="actions">${button('Nova programação', 'new', '', 'class="primary"')} ${button('Registrar culto', 'chronogram')}</div>`) +
    (window.IASDPIOperational&&IASDPIAuth.isAdmin()?`<div class="actions">${button('Gerenciar modelos','models-open')}${button('Lixeira de cultos','trash-open')}</div>`:'') +
    (list.length ? programTable(list) : empty('Nenhuma programação cadastrada', 'Use Nova programação para cadastrar os horários e as atividades.'));
}
function displayDate(value){const day=recordDay(value);return day?day.split('-').reverse().join('/'):value||'';}
function readDate(value){const day=recordDay(value);if(!day)throw Error('Informe uma data válida no formato dd/mm/aaaa.');return day;}
function readDateField(input){try{return readDate(input.value);}catch(error){throw fieldError(input,error.message);}}
function tryReadDate(value){try{return readDate(value);}catch(_){return '';}}
function field(label, name, value = '', type = 'text', required = false, extra = '') {
  if(type==='date'){value=displayDate(value);type='text';extra+=' data-date-input inputmode="numeric" placeholder="dd/mm/aaaa"';}
  if(type==='time'){value=displayPlannedTime(value);type='text';extra+=' data-planned-time maxlength="5" placeholder="HH:mm" inputmode="text" autocomplete="off" pattern="([01][0-9]|2[0-3]):[0-5][0-9]"';}
  return `<label><span class="field-label">${label}${required?' <span class="required-marker" aria-hidden="true">*</span><span class="sr-only"> (obrigatório)</span>':''}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${extra}></label>`;
}
function itemEditor(i = {}, index = 0) {
  const complete=Boolean(i.activity && i.start && i.end);
  return `<fieldset class="item-editor" data-item-id="${esc(i.id || crypto.randomUUID())}"><legend>Atividade <span class="item-number">${index+1}</span></legend>
    <details class="item-details" ${complete?'':'open'}><summary><span class="item-overview"><strong class="item-overview-title">${esc(displayPlannedTime(i.start || '—'))} → ${esc(displayPlannedTime(i.end || '—'))} · ${esc(i.activity || 'Nova atividade')}</strong><small class="item-overview-responsible">${esc(i.responsible || 'Responsável opcional')}</small></span><span class="item-edit-label">Editar</span></summary>
    <div class="item-fields">${field('Bloco', 'block', i.block || 'Culto', 'text', true, 'maxlength="200" list="blocks"')}${field('Atividade', 'activity', i.activity, 'text', true, 'maxlength="200"')}${field('Responsável', 'responsible', i.responsible, 'text', false, 'maxlength="200"')}${field('Início previsto', 'start', i.start, 'time', true)}${field('Término previsto', 'end', i.end, 'time', true)}${field('Observação', 'note', i.note, 'text', false, 'maxlength="2000"')}</div></details>
    <div class="item-controls">${button('↑ Subir', 'up')}${button('↓ Descer', 'down')}${button('Excluir atividade', 'remove-item', '', 'class="danger-text"')}</div></fieldset>`;
}
function updateItemOverview(row) {
  const get=name=>row.querySelector(`[name="${name}"]`).value;
  row.querySelector('.item-overview-title').textContent=`${get('start') || '—'} → ${get('end') || '—'} · ${get('activity') || 'Nova atividade'}`;
  row.querySelector('.item-overview-responsible').textContent=get('responsible') || 'Responsável opcional';
}
function fieldError(input,message) {
  input.setAttribute('aria-invalid','true');
  let error=input.parentElement.querySelector('.field-error');
  if(!error){error=document.createElement('span');error.className='field-error';error.id='error-'+crypto.randomUUID();input.after(error);}
  error.textContent=message;input.setAttribute('aria-describedby',error.id);
  for(let parent=input.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  input.disabled=false;input.focus();
  return Error(message);
}
function clearFieldError(input) {
  input.removeAttribute('aria-invalid');
  const error=input.parentElement.querySelector('.field-error');
  if(error){input.removeAttribute('aria-describedby');error.remove();}
}
function validateProgramForm(form,plan) {
  if(plan.template_id==='free'&&!plan.items.length&&!plan.start&&!plan.end)return;
  const check=(input,message)=>{throw fieldError(input,message);};
  for(const input of form.querySelectorAll('[data-planned-time]'))if((input.required||input.value)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.value))check(input,'Use o formato 24 horas HH:mm (ex.: 14:05).');
  if(plan.end<=plan.start)check(form.querySelector('.form-grid [name="end"]'),'O término deve ser depois do início.');
  if(!plan.name.trim())check(form.querySelector('[name="name"]'),'Informe o nome da programação.');
  const rows=[...form.querySelectorAll('.item-editor')];
  if(!rows.length&&plan.template_id!=='free'){form.querySelector('[data-action="add-item"]').focus();throw Error('Adicione pelo menos uma atividade.');}
  let previous=plan.start;
  plan.items.forEach((item,index)=>{
    const row=rows[index];
    for(const name of ['activity','block'])if(!item[name].trim())check(row.querySelector(`[name="${name}"]`),'Preencha este campo obrigatório.');
    if(item.end<=item.start)check(row.querySelector('[name="end"]'),'O término deve ser depois do início.');
    if(item.start<previous)check(row.querySelector('[name="start"]'),'A atividade deve começar após a anterior e dentro da programação.');
    if(item.end>plan.end)check(row.querySelector('[name="end"]'),'O término ultrapassa o horário da programação.');
    previous=item.end;
  });
}
function editor(p,plannedOnly=false) {
  if (p?.execution_mode === 'manual'&&!plannedOnly) return actualsForm(p);
  if (p && !['Planejamento', 'Pronta'].includes(p.status)) return planView(p);
  const plan = p?.plan || { name: 'Culto de sábado', date: today(), start: '09:30', end: '12:25', team: {}, items: [] };
  return heading('PLANEJAMENTO', p ? 'Editar programação' : 'Nova programação', 'Planeje os horários. Campos com * são obrigatórios; a equipe é opcional.', button('Voltar', 'programs')) +
    `<form id="program-form" data-id="${esc(p?.id || '')}" data-version="${p?.version || ''}">
      <section class="panel form-grid">${field('Nome da programação', 'name', plan.name, 'text', true, 'maxlength="200"')}${field('Data', 'date', plan.date, 'date', true)}${field('Início previsto', 'start', plan.start, 'time', !(plan.template_id==='free'&&!plan.items.length))}${field('Término previsto', 'end', plan.end, 'time', !(plan.template_id==='free'&&!plan.items.length))}<p id="weekday" class="muted"></p></section>
      <details class="panel"><summary>Equipe <span class="muted">· preenchimento opcional</span></summary><div class="form-grid team">${roles.map((role,i) => field(role, `team-${i}`, plan.team[role], 'text', false, 'maxlength="200"')).join('')}</div></details>
      <div class="section-heading"><h2>Itens da programação</h2>${button('+ Adicionar atividade', 'add-item')}</div><p class="muted">A ordem deve acompanhar os horários. Intervalos são permitidos; sobreposições, não.</p>
      <datalist id="blocks"><option value="Culto"><option value="Escola Sabatina"></datalist>
      <div id="items-editor">${(plan.items.length ? plan.items : plan.template_id==='free'?[]:[{}]).map(itemEditor).join('')}</div>
      <div class="actions form-footer"><button class="primary" type="submit">Salvar programação</button><label class="checkbox" ${p?.execution_mode==='manual'?'hidden':''}><input name="ready" type="checkbox" ${p?.status === 'Pronta'&&p.execution_mode!=='manual' ? 'checked' : ''}> Liberar para acompanhamento após salvar</label><p class="muted ready-help" ${p?.execution_mode==='manual'?'hidden':''}>Ao marcar, o sistema salva o planejamento e depois altera o status para Pronta.</p></div>
    </form>`;
}
function planView(p) {
  return heading('PROGRAMAÇÃO', esc(p.plan.name), esc(dateLabel(p.plan.date)), `${button('Duplicar', 'duplicate', p.id)}${window.IASDPIOperational&&IASDPIAuth.isAdmin()?button('Mover para a lixeira','trash-move',p.id,'class="danger-text"'):''} ${button(p.execution_mode === 'manual' ? 'Registrar culto' : 'Acompanhar', p.execution_mode === 'manual' ? 'actuals' : 'track', p.id, 'class="primary"')}`) +
    `<p class="muted">Planejamento protegido após o início. Horário previsto: ${esc(displayPlannedTime(p.plan.start||'—'))} → ${esc(displayPlannedTime(p.plan.end||'—'))}.</p>` + timeline(p) +
    `<details class="panel"><summary>Equipe</summary><dl class="team-read">${roles.map(role => `<div><dt>${esc(role)}</dt><dd>${esc((p.plan.team||{})[role] || 'Não informado')}</dd></div>`).join('')}</dl></details>`;
}
function timeline(p) {
  p=programForMetrics(p);
  let block = '';
  return `<section class="section"><div class="section-heading"><h2>Linha da programação</h2><span class="muted">✓ Finalizado · ● Em andamento · ○ Pendente</span></div><ol class="timeline">${p.plan.items.map(i => {
    const e = p.executions[i.id];
    const done = Boolean(e?.ended), active = e && !done;
    const diff = done ? minutes(e.ended, i.planned_end) : e ? minutes(e.started, i.planned_start) : 0;
    const blockLabel = block !== i.block ? `<li class="block-label">${esc(i.block)}</li>` : ''; block = i.block;
    return `${blockLabel}<li class="timeline-row ${active ? 'active' : ''}"><span class="timeline-symbol" aria-label="${done ? 'Finalizado' : active ? 'Em andamento' : 'Pendente'}">${done ? '✓' : active ? '●' : '○'}</span><div class="timeline-time">${esc(displayPlannedTime(i.start))}<small>${esc(displayPlannedTime(i.end))}</small></div><div class="timeline-content"><strong>${esc(i.activity)}</strong><span>${esc(i.responsible || 'Responsável não informado')}</span><small>Previsto: ${esc(displayPlannedTime(i.start))} → ${esc(displayPlannedTime(i.end))}${e ? ` · Real: ${clock(e.started)} → ${e.ended ? clock(e.ended) : 'em andamento'}` : ''}</small>${i.note ? `<small>${esc(i.note)}</small>` : ''}</div>${e ? badge(diff, done ? `${signed(diff)} no término` : `${signed(diff)} no início`) : '<span class="badge neutral">Pendente</span>'}</li>`;
  }).join('')}</ol></section>`;
}
function notes(p) {
  return `<section class="section"><h2>Observações e ocorrências</h2><form id="notes-form" data-id="${esc(p.id)}" data-version="${p.version}"><div class="notes-grid"><div><label for="execution-note">Observações</label><textarea id="execution-note" name="note" maxlength="5000" rows="3" placeholder="Registre o que ajudou ou afetou a programação.">${esc(p.note)}</textarea></div><div><label for="execution-incident">Ocorrência não prevista</label><textarea id="execution-incident" name="incident" maxlength="5000" rows="3" placeholder="Ex.: comunicação adicionada após os anúncios.">${esc(p.incident)}</textarea></div></div><button type="submit">Salvar observações</button></form></section>`;
}
function tracking(p) {
  if (p?.execution_mode === 'manual') return actualsForm(p);
  if (!p) return heading('EXECUÇÃO', 'Acompanhar culto', 'Use esta tela durante o culto para iniciar, avançar e pausar as atividades.') + empty('Escolha uma programação', 'Abra uma programação pronta para acompanhar.', button('Ver programações', 'programs', '', 'class="primary"'));
  if (p.status === 'Finalizada') return summary(p);
  p=programForMetrics(p);
  const m = executionInfo(p);
  const focus = m.active || m.expected || m.pending;
  const index = focus ? p.plan.items.findIndex(item=>item.id===focus?.id) : -1;
  const next = p.plan.items[index + 1];
  const e = focus && p.executions[focus.id];
  const dateMismatch = p.plan.date !== today();
  return heading('EXECUÇÃO', 'Acompanhar culto', `${esc(dateLabel(p.plan.date))} · ${esc(p.plan.name)} · Controle durante a execução.`, button('Atualizar', 'refresh')) +
    `<div class="planned-bar"><span>Previsto <strong>${esc(displayPlannedTime(p.plan.start||'—'))} → ${esc(displayPlannedTime(p.plan.end||'—'))}</strong></span>${programStatus(p)}</div>
    <section class="metrics" aria-label="Situação da programação"><div><span>HORÁRIO ATUAL</span><strong data-live="clock">${clock(currentTime())}</strong></div><div><span>DESVIO DO HORÁRIO</span><strong data-live="shift" class="${statusTone(m.shift)}">${signed(m.shift)}</strong><small data-live="status">${delayLabel(m.shift)}</small></div><div><span>PREVISÃO DE TÉRMINO</span><strong data-live="forecast">${p.status === 'Planejamento' ? '—' : (displayPlannedTime(m.forecast)||'—')}</strong></div></section>
    <p class="context-line">Pelo plano, agora: <strong data-live="expected">${esc(m.expected?.activity || (dateMismatch ? 'outra data' : 'intervalo ou fora da programação'))}</strong></p>
    <section class="current-activity"><p class="eyebrow" data-live="focus-label">${m.active ? 'EM ANDAMENTO' : m.expected ? 'AGORA · PELO PLANEJAMENTO' : 'PRIMEIRA ATIVIDADE'}</p><h2 data-live="activity">${esc(focus?.activity || 'Sem atividades')}</h2><p class="responsible" data-live="responsible">${esc(focus?.responsible || 'Responsável não informado')}</p><div class="current-details"><div><span>Planejado</span><strong data-live="period">${esc(displayPlannedTime(focus?.start || '—'))} → ${esc(displayPlannedTime(focus?.end || '—'))}</strong></div><div><span>Início real</span><strong>${clock(e?.started)}</strong></div><div><span>Tempo transcorrido</span><strong data-live="elapsed">${e ? elapsed(e.started) : '—'}</strong></div></div><p data-live="item-note">${esc(focus?.note || '')}</p><p class="muted" data-live="origin">${m.origin ? `Primeiro atraso observado: ${esc(m.origin.activity)}.` : m.complete?'Nenhum atraso observado nos horários válidos.':'Dados incompletos ou inválidos: não é possível concluir a pontualidade.'}</p></section>
    ${next ? `<section class="next-activity" data-next><span class="eyebrow">PRÓXIMO</span><div><h3>${esc(next.activity)}</h3><p>${esc(next.responsible || 'Responsável não informado')}</p></div><strong>${esc(displayPlannedTime(next.start))}</strong></section>` : '<p class="muted" data-next>Última atividade da programação.</p>'}
    <div class="execution-actions">${p.status === 'Planejamento' ? button('Marcar programação como pronta', 'ready', p.id, 'class="primary big"') : m.active ? (p.paused ? button('Retomar acompanhamento', 'resume', p.id, 'class="primary big"') : button(m.pending ? 'Finalizar e avançar' : 'Finalizar programação', 'next', p.id, 'class="primary big"')) : button(`Iniciar atividade${m.expected && m.expected.id !== m.pending?.id ? ` · ${esc(m.pending.activity)}` : ''}`, 'start', p.id, `class="primary big" ${dateMismatch ? 'disabled' : ''}`)}${m.active && !p.paused ? button('Pausar acompanhamento', 'pause', p.id) : ''}${button('Voltar', 'programs')}</div>
    ${dateMismatch ? '<p class="muted">O início será liberado na data da programação. Para testar hoje, duplique com a data de hoje.</p>' : ''}${p.paused ? '<p class="pause-note">Acompanhamento pausado. O tempo real continua contando; a pausa não altera o planejamento nem exclui tempo do culto.</p>' : ''}
    ${timeline(p)}${notes(p)}`;
}
function summary(p) {
  const m = executionInfo(p);
  const view=programForMetrics(p);const plannedDuration = recordInterval(view.planned_start,view.planned_end,recordDay(p.plan.date)).minutes;
  const actualDuration = m.actualDuration;
  return heading('PLANEJADO × REALIZADO', 'Resumo da programação', `${esc(p.plan.name)} · ${esc(dateLabel(p.plan.date))}`, `${button('Duplicar programação', 'duplicate', p.id)} ${p.execution_mode === 'manual' ? button('Editar registro', 'actuals', p.id) : ''} ${window.IASDPIDemo&&p.execution_mode==='manual'&&p.plan.date==='2026-10-03'?button('Conferir correção para 10/10/2026','correct-date',p.id):''}`) +
    `<section class="summary-grid">${[['Início planejado', displayPlannedTime(p.plan.start)], ['Início real', actualClock(m.first?.started)||'—'], ['Término planejado', displayPlannedTime(p.plan.end)], ['Término real', actualClock(m.last?.ended)||'—'], ['Duração planejada', duration(plannedDuration)], ['Duração real', actualDuration === null ? '—' : duration(actualDuration)], ['Desvio da duração', actualDuration === null || plannedDuration === null ? '—' : signed(actualDuration - plannedDuration)], ['Desvio do término', signed(m.shift)]].map(([label,value]) => `<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join('')}</section>
    <p class="muted">Desvio do término compara o relógio. Desvio da duração compara o tempo total entre o primeiro início e o último término, incluindo intervalos. ${metricsCountLabel(m.counts)}.${m.extraCounts.total?` Atividades extras: ${m.extraCounts.considered} consideradas; ${m.extraCounts.missing} com dados ausentes; ${m.extraCounts.invalid} com dados inválidos.`:''} Duração total e pontualidade exigem horários completos das atividades principais e extras; subatividades não são somadas novamente.</p>
    <p class="context-line">${m.origin ? `Primeiro atraso observado: ${esc(m.origin.activity)}. Veja as observações para entender a causa.` : m.complete?'Nenhum atraso observado nos horários válidos.':'Dados incompletos ou inválidos: não é possível concluir a pontualidade.'}</p>
    <div class="table-scroll"><table><thead><tr><th>Atividade / bloco</th><th>Horários previstos</th><th>Horários reais</th><th>Duração prevista</th><th>Duração real</th><th>Diferença de duração</th></tr></thead><tbody>${summaryActivityRows(p)}</tbody></table></div>${transitionView([p])}${notes(p)}`;
}
const adherenceTolerance = 2;
function metricsCountLabel(c){return `${c.considered} atividades consideradas; ${c.total-c.considered} desconsideradas (${c.missing} com dados ausentes; ${c.invalid} com dados inválidos)`;}
function endStatistics(programs){
  const shifts=programs.map(p=>executionInfo(p).shift).filter(v=>v!==null&&Number.isFinite(v));
  return {considered:shifts.length,excluded:programs.length-shifts.length,mean:shifts.length?shifts.reduce((s,v)=>s+v,0)/shifts.length:null,onTime:shifts.filter(v=>Math.abs(v)<=adherenceTolerance).length};
}
function adherence(p) {
  const samples=activitySamples(p),counts=sampleCounts(samples),completed=samples.filter(s=>s.state==='valid');
  const conforming=completed.filter(({item,actual,planned})=>Math.abs(minutes(actual.start,planned.start))<=adherenceTolerance&&(item.end_inferred||Math.abs(minutes(actual.end,planned.end))<=adherenceTolerance)).length;
  return {...counts,total:counts.considered,expected:counts.total,excluded:counts.total-counts.considered,conforming,percent:completed.length?Math.round(conforming/completed.length*100):null};
}
function median(values) {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
  return !sorted.length?null:sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
}
function activityMedians(programs) {
  const groups=new Map();
  programs.forEach(p=>activitySamples(p).forEach(({item,actual,planned,state})=>{
    const name=String(item.activity||'Atividade sem título').startsWith('Música Congregacional') ? 'Música Congregacional' : item.activity;
    if(!groups.has(name))groups.set(name,{name,values:[],events:new Set(),estimated:false,missing:0,invalid:0});
    const group=groups.get(name);
    if(state!=='valid'){group[state]++;return;}
    group.values.push(actual.minutes-planned.minutes);
    group.events.add(p.id);group.estimated ||= Boolean(item.end_inferred);
  }));
  return [...groups.values()].map(group=>({...group,median:median(group.values)}));
}
function medianView(programs) {
  const groups=activityMedians(programs);
  const label=value=>value===null?'Dados insuficientes':`${value>0?'+':value<0?'−':''}${Math.abs(value).toLocaleString('pt-BR',{maximumFractionDigits:1})} min`;
  return `<section class="section median-section"><div class="section-heading"><h2>Mediana do desvio por atividade</h2><span class="muted">${programs.length} programações finalizadas</span></div>
    <p class="muted">Diferença entre duração realizada e prevista em cada registro de atividade. Positivo = durou mais; negativo = durou menos. As músicas congregacionais estão agrupadas, incluindo sentados e em pé.</p>
    <div class="table-scroll"><table><thead><tr><th>Atividade</th><th>Mediana do desvio</th><th>Registros comparados / desconsiderados</th><th>Programações</th></tr></thead><tbody>${groups.map(group=>`<tr><td>${esc(group.name)}${group.estimated?' *':''}</td><td><span class="badge ${statusTone(group.median)}">${label(group.median)}</span></td><td>${group.values.length} considerados; ${group.missing+group.invalid} desconsiderados<small>${group.missing} ausentes · ${group.invalid} inválidos</small></td><td>${group.events.size}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted">${groups.some(g=>g.estimated)?'* Atividades marcadas usam um término de referência. ':''}A mediana considera somente intervalos válidos, inclusive quando a atividade se repete no mesmo culto.</p></section>`;
}
function adherenceOverview(programs=state.programs) {
  const examples=programs.filter(p=>p.status==='Finalizada').sort((a,b)=>String(a.plan.date||'').localeCompare(String(b.plan.date||'')));
  if(!examples.length)return '';
  const counts=examples.map(adherence),ends=endStatistics(examples);
  const conforming=counts.reduce((sum,a)=>sum+a.conforming,0),total=counts.reduce((sum,a)=>sum+a.total,0),excluded=counts.reduce((sum,a)=>sum+a.excluded,0);
  const percent=total?Math.round(conforming/total*100)+'%':'Dados insuficientes';
  return `<section class="section adherence-section"><div class="section-heading"><h2>Aderência à programação</h2><span class="badge neutral">${examples.length} eventos finalizados</span></div>
    <p class="muted">Aderência = atividades com início e término até ${adherenceTolerance} minutos antes ou depois do previsto. Atividades com término de referência são avaliadas somente pelo início. Dados incompletos não permitem classificar o culto inteiro.</p>
    <div class="metrics"><div><span>ATIVIDADES ADERENTES</span><strong>${percent}</strong><small>${conforming} de ${total} atividades consideradas; ${excluded} desconsideradas (${counts.reduce((s,a)=>s+a.missing,0)} ausentes; ${counts.reduce((s,a)=>s+a.invalid,0)} inválidas)</small></div><div><span>EVENTOS COM TÉRMINO ADERENTE</span><strong>${ends.considered?ends.onTime+'/'+ends.considered:'Dados insuficientes'}</strong><small>${ends.considered} cultos considerados; ${ends.excluded} desconsiderados · tolerância ±${adherenceTolerance} min</small></div><div><span>DESVIO MÉDIO DO TÉRMINO</span><strong>${signed(ends.mean)}</strong><small>${ends.considered} cultos considerados; ${ends.excluded} desconsiderados. Atrasos positivos · adiantamentos negativos</small></div></div>
    <div class="table-scroll"><table><thead><tr><th>Evento</th><th>Aderência</th><th>Atividades aderentes / consideradas</th><th>Desvio do término</th><th>Detalhes</th></tr></thead><tbody>${examples.map(p=>{
      const a=adherence(p),m=executionInfo(p);const tone=a.percent===null||!m.complete?'neutral':a.percent>=90?'good':a.percent>=70?'warning':'critical';
      return `<tr><td>${esc(p.plan.name)}<small>${esc(programDate(p.plan.date))}</small></td><td><span class="badge ${tone}">${a.percent===null?'Dados insuficientes':a.percent+'%'+(!m.complete?' · parcial':'')}</span></td><td>${a.conforming} / ${a.total}<small>${a.excluded} desconsideradas (${a.missing} ausentes; ${a.invalid} inválidas)</small></td><td>${badge(m.shift,signed(m.shift))}</td><td>${button('Ver realizado','summary',p.id)}</td></tr>`;
    }).join('')}</tbody></table></div><p class="muted">Cultos completos: verde a partir de 90%, amarelo de 70% a 89%, vermelho abaixo de 70%. Dados parciais: classificação neutra. A duração total considera o intervalo do evento, sem duplicar os itens simultâneos ou as subatividades.</p>${medianView(examples)}${transitionView(examples)}</section>`;
}
function modelsPage(){return heading('ADMINISTRAÇÃO','Modelos de liturgia','Use o mesmo cadastro de modelos da igreja. Atualizar um modelo não altera cultos já registrados.')+(!IASDPIAuth.isAdmin()?empty('Acesso restrito','Somente administradores podem gerenciar modelos.'):window.IASDPIOperational?IASDPIOperational.templatePanel():empty('Gerenciamento disponível no modo Supabase','Esta prévia local preserva os dados e não altera modelos no banco.'));}
function historyPage(){return IASDPIHistory.page();}

function render() {
  window.IASDPIDrafts?.beforeRender();
  const allowed=IASDPIAuth.allowed();
  if(!allowed&&!IASDPIAuth.isPublic(state.page))state.page='login';
  document.querySelectorAll('nav a').forEach(a=>{a.hidden=['users','trash','models','schedule-members','schedule-settings'].includes(a.dataset.page)?!IASDPIAuth.isAdmin():a.dataset.page==='login'?allowed:!allowed&&!IASDPIAuth.isPublic(a.dataset.page);});
  if(window.IASDPIPortalAccess?.enabled()){document.querySelectorAll('nav [data-page=schedule-members],nav [data-page=schedule-settings]').forEach(a=>{a.hidden=!IASDPIPortalAccess.can(a.dataset.page);});document.querySelector('.brand').href='#church-home';document.querySelector('nav [data-page=home]').textContent='Cronoanálise';document.querySelector('nav [data-page=login]').textContent='Entrar na Cronoanálise';}
  document.querySelectorAll('[data-portal-nav]').forEach(a=>{a.hidden=!window.IASDPIPortalAccess?.enabled()||(a.dataset.page==='portal-login'&&IASDPIPortalAccess.valid());});
  document.querySelectorAll('[data-governance-nav]').forEach(a=>{a.hidden=!window.IASDPIGovernance?.enabled();});
  if(window.IASDPIGovernance?.enabled())document.querySelectorAll('nav [data-page=users]').forEach(a=>a.hidden=true);
  document.querySelector('#auth-logout').hidden=!allowed&&IASDPIAuth.status().phase!=='scoped';

  document.querySelectorAll('[data-event-nav]').forEach(a=>a.hidden=!window.IASDPIEvents?.enabled()||!IASDPIPortalAccess.valid()||!IASDPIPortalAccess.can('events'));
  const activePage=state.page==='schedule-calendar'?'agendas':state.page==='summary'?'history':['edit','tracking'].includes(state.page)&&selected()?.execution_mode==='manual'?'actuals':['edit','plan-edit'].includes(state.page)?'programs':state.page;
  document.querySelectorAll('nav a').forEach(a => {const active=a.dataset.page===activePage;a.classList.toggle('selected',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  window.IASDPIPortalNavigation?.sync(state.page);
  if(window.IASDPIChurches?.enabled()&&!IASDPIChurches.ready()&&!window.IASDPIPortalAccess?.enabled()&&!['organization','agendas','schedule-calendar','forgot-password','reset-password','controlled-reset','church-home','login','portal-login'].includes(state.page)){app.innerHTML=IASDPIChurches.selectionPage();return;}
  if(window.IASDPIChurches?.enabled()&&IASDPIChurches.selected()&&IASDPIChurches.selected()!=='IASD_PI'&&['organization','agendas'].includes(state.page)){app.innerHTML=empty('Conteúdo público ainda não configurado','Esta igreja ainda não possui agenda ou organograma publicados.');return;}
  const portalGate=window.IASDPIPortalAccess?.guard(state.page);if(portalGate){app.innerHTML=portalGate;return;}
  const missingRecord=['edit','plan-edit','actuals','tracking','summary'].includes(state.page)&&state.selected&&!selected();
  const needsPrograms=['home','programs','history','edit','plan-edit','actuals','tracking','summary','models'].includes(state.page);
  app.innerHTML = allowed&&needsPrograms&&!['records','empty'].includes(state.programsLoad.status)?programsLoadView():allowed&&missingRecord?empty('Registro não encontrado','Este identificador não está entre os cultos ativos disponíveis. Confira o link ou as programações.',button('Ver programações','programs')):({home, 'church-home':()=>IASDPIChurchPortal.home(), 'portal-login':()=>IASDPIPortalAccess.loginPage(), 'access-admin':()=>IASDPIGovernance.page(), 'access-audit':()=>IASDPIGovernance.page(), 'access-request':()=>IASDPIGovernance.requestPage(), 'controlled-reset':()=>IASDPIGovernance.resetPage(), 'schedule-setup':()=>IASDPISchedules.page(), 'schedule-build':()=>IASDPIScheduleManagement.page(), 'schedule-members':()=>IASDPIScheduleDailyAdmin.page('schedule-members'), 'schedule-settings':()=>IASDPIScheduleDailyAdmin.page('schedule-settings'), 'schedule-calendar':()=>IASDPIScheduleCalendar.page(),events:()=>IASDPIEvents.page(), models:modelsPage, trash: trashPage, users: usersPage, invite: invitePage, login: IASDPIAuth.loginPage, 'forgot-password':IASDPIAuth.forgotPasswordPage,'reset-password':IASDPIAuth.resetPasswordPage, organization: organizationPage, archive: archivePage, agendas: agendasPage, programs: programsPage, history: historyPage, edit: () => editor(selected()), 'plan-edit':()=>editor(selected(),true), actuals: () => actualsForm(selected()), tracking: () => tracking(selected()), summary: () => selected() ? summary(selected()) : historyPage()}[state.page] || home)();
  if(window.IASDPIPortalAccess?.enabled()&&['schedule-build','schedule-setup','schedule-members','schedule-settings','access-admin','events'].includes(state.page))app.insertAdjacentHTML('afterbegin',IASDPIPortalAccess.workspace());
  window.IASDPIPortalNavigation?.context(state.page);
  updateWeekday(); updateActuals(); tick(); window.IASDPIDrafts?.mount(); pageLayout.mount();window.IASDPIScheduleCalendar?.mount();
}
function navigate(page,id,options){return IASDPINavigation.navigate(page,id,options);}
function updateWeekday() {
  const form = document.querySelector('#program-form');
  const target = document.querySelector('#weekday');
  if (form && target) { const value = tryReadDate(form.elements.date.value); target.textContent = value ? dateLabel(value) : ''; }
}
function tick() {
  const p = selected(); if (!p || state.page !== 'tracking' || p.status === 'Finalizada') return;
  const m = executionInfo(p), e = m.active && programForMetrics(p).executions[m.active.id];
  const focus = m.active || m.expected || m.pending;
  const next = p.plan.items[p.plan.items.findIndex(item=>item.id===focus?.id) + 1];
  const nextElement = document.querySelector('[data-next]');
  if (nextElement && nextElement.dataset.item !== (next?.id || '')) {
    nextElement.dataset.item = next?.id || '';
    nextElement.className = 'next-activity';
    nextElement.innerHTML = next ? `<span class="eyebrow">PRÓXIMO</span><div><h3>${esc(next.activity)}</h3><p>${esc(next.responsible || 'Responsável não informado')}</p></div><strong>${esc(displayPlannedTime(next.start))}</strong>` : '<span class="muted">Última atividade da programação.</span>';
  }
  const values = {'focus-label': m.active ? 'EM ANDAMENTO' : m.expected ? 'AGORA · PELO PLANEJAMENTO' : 'PRIMEIRA ATIVIDADE', activity: focus?.activity || 'Sem atividades', responsible: focus?.responsible || 'Responsável não informado', period: `${displayPlannedTime(focus?.start)||'—'} → ${displayPlannedTime(focus?.end)||'—'}`, 'item-note': focus?.note || '', clock: clock(currentTime()), shift: signed(m.shift), status: delayLabel(m.shift), forecast: p.status === 'Planejamento' ? '—' : (displayPlannedTime(m.forecast)||'—'), elapsed: e ? elapsed(e.started) : '—', expected: m.expected?.activity || (p.plan.date !== today() ? 'outra data' : 'intervalo ou fora da programação'), origin: m.origin ? `Primeiro atraso observado: ${m.origin.activity}.` : m.complete?'Nenhum atraso observado nos horários válidos.':'Dados incompletos ou inválidos: não é possível concluir a pontualidade.'};
  for (const [key, value] of Object.entries(values)) {
    const element = document.querySelector(`[data-live="${key}"]`);
    if (element) { element.textContent = value; if (key === 'shift') element.className = statusTone(m.shift); }
  }
}
async function handleAction(target) {
  const {action, id} = target.dataset;
  if(['chronogram','new','actuals','summary','programs','edit','track','duplicate','correct-date','edit-record-plan'].includes(action)&&!canLeaveRegistration())return;
  if(!action.startsWith('agenda-'))await IASDPIAuth.requireAccess();
  if(action.startsWith('trash-')){await handleTrashAction(action,id);return;}
  if(action.startsWith('users-')){await handleUsersAction(action,id);return;}
  if(action.startsWith('operational-')){await IASDPIOperational.action(action,id);return;}
  if(action==='cloud-save')await cloudSave();
  else if(action==='cloud-list')await refreshArchives();
  else if(action==='cloud-signout'){await IASDPIAuth.logout();}
  else if(action==='cloud-restore'){const [row]=await cloudRequest('/rest/v1/culto_archives?id=eq.'+encodeURIComponent(id)+'&select=payload');if(!row)throw Error('Arquivo não encontrado.');const result=await restoreBackup(row.payload);render();toast(result.preview?'Confira e confirme a prévia de importação.':`${result.added} registros restaurados sem substituir os atuais.`);}
  else if(action==='agenda-current'){selectAgendaMonth(today().slice(0,7));document.querySelector('[data-action="agenda-current"]').focus();}
  else if(action==='agenda-calendar'||action==='agenda-list'){agendaState.view=action==='agenda-calendar'?'calendar':'list';render();document.querySelector(`[data-action="${action}"]`).focus();}
  else if(action==='agenda-previous'||action==='agenda-next')changeAgendaMonth(action==='agenda-next'?1:-1);
  else if(action==='agenda-day'){agendaState.day=id;render();document.querySelector(`.calendar-day[data-id="${id}"]`)?.focus();}
  else if(action==='add-subactivity'){
    const row=target.closest('.actual-row'),list=row.querySelector('.subactivities');
    if(list.children.length>=50)throw Error('Limite de 50 subatividades por atividade.');
    list.insertAdjacentHTML('beforeend',subactivityRow({},row.dataset.id));markRegistrationDirty();refreshSubactivityLabels();list.lastElementChild.querySelector('input').focus();
  }
  else if(action==='remove-subactivity'){
    if(window.confirm('Excluir esta subatividade? A exclusão só será aplicada ao salvar o registro.')){target.closest('.subactivity').remove();markRegistrationDirty();refreshSubactivityLabels();}
  }
  else if(action==='edit-record-plan'){
    const form=document.querySelector('#actuals-form');
    if(!form.dataset.id)await saveActuals(form,false);
    navigate('plan-edit',selected().id);
  }
  else if(action==='edit-record'){document.querySelector('#actuals-form [name="record-name"]')?.focus();}
  else if(action==='cancel-record'){
    if(window.IASDPIDrafts?!await IASDPIDrafts.discardCurrent():!canLeaveRegistration())return;
    if(id){replaceProgram(await api('programs/'+id));navigate('summary',id);}else navigate('programs');
  }
  else if(action==='add-extra')throw Error('Novos detalhes devem ser adicionados como subatividades.');
  else if(action==='remove-extra'){if(!window.confirm('Remover esta atividade extra antiga ao salvar?'))return;target.closest('.actual-row').remove();markRegistrationDirty();document.querySelectorAll('.actual-number').forEach((n,index)=>n.textContent=index+1);updateActuals();}
  else if (action === 'time-now') {
    const input=target.closest('.subactivity, .actual-row').querySelector(`[name="${target.dataset.field}"]`);
    input.value=displayActualTime(actualClock(currentTime()));input.dataset.timeEdited='true';
    markRegistrationDirty();updateActuals();
  }
  else if (action === 'chronogram') {
    if(window.IASDPIOperational)await IASDPIOperational.refreshTemplates();
    window.IASDPIChronogram=null;state.selected=null;navigate('actuals',undefined,{refresh:true});
  }
  else if (action === 'actuals') navigate('actuals', id);
  else if(action==='correct-date'){
    if(!window.IASDPIDemo)throw Error('A correção está disponível apenas para registros locais deste navegador.');
    const original=await api('programs/'+id),corrected=correctedCultoDate(original);
    dateCorrection={id:original.id,version:original.version,expected:JSON.stringify(original)};
    document.querySelector('#correct-date-preview').innerHTML=`<h2 id="correct-date-title">Conferir correção de data</h2><p>Origem: localStorage deste navegador. Somente este registro será alterado.</p><p><strong>${esc(original.plan.name)}</strong> · ID: ${esc(original.id)}</p><p>03/10/2026 → <strong>10/10/2026</strong> · ${original.plan.items.length} atividades e ${original.extra_events?.length||0} eventos extras. Horários, responsáveis e observações preservados. Não cria cópia nem altera o Supabase.</p><details><summary>Ver todos os dados atuais do registro afetado</summary><pre class="date-correction-json">${esc(JSON.stringify(original,null,2))}</pre></details><h3>Prévia das atividades após a correção</h3><div class="table-scroll"><table><tbody>${summaryActivityRows(corrected)}</tbody></table></div>`;
    document.querySelector('#correct-date-dialog').showModal();
  }
  else if (action === 'new') { state.selected = null; navigate('edit'); }
  else if (action === 'models-open') {if(!IASDPIAuth.isAdmin())throw Error('Acesso exclusivo de administradores.');if(window.IASDPIOperational)await IASDPIOperational.refreshTemplates();navigate('models');}

  else if (action === 'programs') navigate('programs');
  else if (['edit','summary','track'].includes(action)) navigate(action === 'track' ? 'tracking' : action, id);
  else if (action === 'duplicate') {
    state.duplicate = id;
    document.querySelector('#duplicate-form').elements.date.value = displayDate(today());
    document.querySelector('#duplicate-dialog').showModal();
  } else if (action === 'close-dialog') document.querySelector('#duplicate-dialog').close();
  else if (action === 'add-item') {
    const container = document.querySelector('#items-editor');
    container.insertAdjacentHTML('beforeend', itemEditor({}, container.children.length));
    document.querySelectorAll('#program-form .form-grid [name="start"],#program-form .form-grid [name="end"]').forEach(input=>input.required=true);
    container.lastElementChild.querySelector('[name="activity"]').focus();
  } else if (['remove-item','up','down'].includes(action)) {
    const row = target.closest('.item-editor');
    if (action === 'remove-item') {row.remove();toast('Atividade removida. Salve a programação para confirmar a alteração.');}
    if (action === 'up' && row.previousElementSibling) row.previousElementSibling.before(row);
    if (action === 'down' && row.nextElementSibling) row.nextElementSibling.after(row);
    document.querySelectorAll('.item-number').forEach((n,i) => { n.textContent = i+1; });
  } else if (action === 'refresh'||action==='retry-programs') { await loadPrograms({renderState:true}); render(); toast('Registros carregados.'); }
  else if (['ready','start','next','pause','resume'].includes(action)) {
    let p = state.programs.find(p => p.id === id);
    const notesForm = document.querySelector('#notes-form');
    if (notesForm?.dataset.id === id && (notesForm.elements.note.value !== p.note || notesForm.elements.incident.value !== p.incident)) {
      p = await api(`programs/${id}/notes`, 'PUT', {version:Number(notesForm.dataset.version), note:notesForm.elements.note.value, incident:notesForm.elements.incident.value});
      replaceProgram(p); notesForm.dataset.version = p.version;
    }
    const updated = await api(`programs/${id}/action`, 'POST', {action, version:p.version});
    replaceProgram(updated); navigate(updated.status === 'Finalizada' ? 'summary' : 'tracking', id,{refresh:true});
    toast({'ready':'Programação pronta para acompanhar.','start':'Culto iniciado.','pause':'Acompanhamento pausado.','resume':'Acompanhamento retomado.','next':updated.status==='Finalizada'?'Programação finalizada. Resumo disponível.':'Atividade finalizada. Próxima atividade iniciada.'}[action]);
  }
}
async function guarded(task, trigger) {
  if (state.busy) return;
  state.busy = true;
  app.setAttribute('aria-busy','true');
  const originalLabel=trigger?.textContent;
  if(trigger)trigger.textContent='Processando…';
  const pending=setTimeout(()=>toast('Processando…'),200);
  const buttons = [...document.querySelectorAll('button, input, textarea, select')].filter(b => !b.disabled);
  buttons.forEach(b => { b.disabled = true; });
  try { await task(); } catch (error) {
    toast(error.message, true);
    const form=trigger?.closest('form');
    if(form?.id==='actuals-form'&&trigger?.type==='submit')setRegistrationSaveState(form,'error','Não foi possível '+(trigger.name==='finalize'?'finalizar':'salvar')+'. Alterações preservadas; revise a mensagem no formulário e tente novamente.');
    if(form){let feedback=form.querySelector('.form-error');if(!feedback){feedback=document.createElement('p');feedback.className='form-error';feedback.setAttribute('role','alert');form.prepend(feedback);}feedback.textContent=error.message;}
    if(error.code==='40001'&&['actuals-form','program-form','notes-form'].includes(form?.id))try{await IASDPIConflicts.open(form,error);}catch(comparisonError){toast('Comparação indisponível. Os campos e rascunhos foram preservados. '+comparisonError.message,true);}
    // Atualiza a versão em memória sem substituir campos que o usuário está editando.
    if(IASDPIAuth.allowed()&&!['password-request-form','password-reset-form'].includes(form?.id)&&state.programsLoad.status!=='error')try { await loadPrograms(); } catch (_) { /* preservar campos e exibir erro ao consultar as listas */ }
  } finally { clearTimeout(pending);if(notice.textContent==='Processando…')notice.hidden=true;state.busy=false;app.removeAttribute('aria-busy');if(trigger?.isConnected)trigger.textContent=originalLabel;buttons.forEach(b=>{b.disabled=false;});if(trigger?.isConnected&&document.activeElement===document.body)trigger.focus();drainNavigation(); }
}
app.addEventListener('click', event => { const link=event.target.closest('[data-auth-page]');if(link){event.preventDefault();navigate(link.dataset.authPage);return;}const target = event.target.closest('[data-action]'); if(target?.dataset.action==='history-clear'&&IASDPIAuth.allowed()){IASDPIHistory.clear();return;}if (target) guarded(() => handleAction(target), target); });
app.addEventListener('toggle',event=>{if(event.target.matches('.item-details'))event.target.querySelector('.item-edit-label').textContent=event.target.open?'Recolher':'Editar';},true);
app.addEventListener('input', event => {IASDPIHistory.input(event.target);if(event.target.dataset.realTime){event.target.dataset.timeEdited='true';delete event.target.dataset.conflictClock;}clearFieldError(event.target);event.target.closest('form')?.querySelector('.form-error')?.remove();if(event.target.closest('#actuals-form')){markRegistrationDirty();updateActuals();}const row=event.target.closest('.item-editor');if(row)updateItemOverview(row);});
 document.addEventListener('invalid',event=>{if(event.target.matches('input,textarea,select')){event.preventDefault();if(event.target.closest('#actuals-form'))setRegistrationSaveState(event.target.closest('form'),'error','Revise o campo indicado. O registro ainda não foi finalizado.');fieldError(event.target,event.target.validity.valueMissing?'Preencha este campo obrigatório.':event.target.hasAttribute('data-planned-time')?'Use o formato 24 horas HH:mm (ex.: 14:05).':event.target.validationMessage);}},true);
app.addEventListener('change', event => {if(event.target.closest('#actuals-form')){markRegistrationDirty();updateActuals();}if(['agenda-area','agenda-department','agenda-show-people','agenda-month-picker'].includes(event.target.id)){const id=event.target.id;if(id==='agenda-area')agendaState.area=event.target.value;else if(id==='agenda-department')agendaState.department=event.target.value;else if(id==='agenda-show-people')agendaState.showPeople=event.target.checked;else if(event.target.value)selectAgendaMonth(event.target.value);render();document.getElementById(id)?.focus();return;} if (event.target.name === 'date') updateWeekday(); if(event.target.name==='responsible-option'){const input=event.target.closest('.actual-row').querySelector('[name="responsible-name"]');input.hidden=event.target.value!=='other';if(!input.hidden)input.focus();} });
document.querySelector('#duplicate-dialog').addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (target) guarded(()=>handleAction(target),target); });
app.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  if(form.id==='history-filters'){IASDPIHistory.apply(form);return;}
  const finalize = event.submitter?.name === 'finalize';
  const draftSave=window.IASDPIDrafts?.beginSave(form);
  const actionButton=event.submitter||(form.id==='actuals-form'?form.querySelector('[name="save"]'):null);
  if(form.id==='actuals-form'&&!state.busy)setRegistrationSaveState(form,'saving',finalize?'Finalizando registro… Aguarde a confirmação.':'Salvando alterações… Aguarde a confirmação.');
  guarded(async () => {
    if(form.id==='password-request-form'){const message=await IASDPIAuth.requestPasswordReset(form.elements.email.value.trim());form.querySelector('.password-feedback').textContent=message;form.reset();return;}
    if(form.id==='password-reset-form'){if(form.elements.password.value!==form.elements.repeat.value)throw fieldError(form.elements.repeat,'As senhas devem ser iguais.');const password=form.elements.password.value;form.reset();try{await IASDPIAuth.updatePassword(password);}catch(error){if(!IASDPIAuth.passwordRecoveryActive())render();throw error;}navigate('login',undefined,{replace:true,refresh:true});toast('Senha redefinida. Entre com sua nova senha.');return;}
    if(form.id==='invite-signup-form'){
      const password=form.elements.password.value;form.elements.password.value='';
      await IASDPIAuth.signup(form.elements.email.value,password,form.elements['public-key']?.value);
      toast('Se o cadastro puder ser concluído, siga as instruções do e-mail. Após confirmar, reabra o convite e entre.');return;
    }
    if(form.id==='invite-login-form'){
      const password=form.elements.password.value;form.elements.password.value='';
      await IASDPIAuth.login(form.elements.email.value,password,form.elements['public-key']?.value,usersState.inviteToken);
      usersState.inviteToken='';cloudState.session=IASDPIAuth.session();navigate('home');await boot();return;
    }
    if(form.id==='auth-login-form'){
      const password=form.elements.password.value;form.elements.password.value='';
      await IASDPIAuth.login(form.elements.email.value,password,form.elements['public-key']?.value,null,false,{remember:form.elements.remember.checked,church:form.elements.church?.value});
      cloudState.session=IASDPIAuth.session();state.page='home';await boot();return;
    }
    if(form.id==='actuals-form'&&window.IASDPIOperational){await saveActuals(form,finalize,draftSave);return;}
    if(!(window.IASDPIOperational&&['program-form','notes-form'].includes(form.id)))await IASDPIAuth.requireAccess();
    if(form.id.startsWith('users-')||form.classList.contains('user-access-form')){await submitUsersForm(form);return;}
    if(form.id==='operational-template-form'){await IASDPIOperational.saveTemplate(form);return;}
    if(form.id==='backup-export-form'){if(form.elements.password.value!==form.elements.repeat.value)throw fieldError(form.elements.repeat,'As senhas devem ser iguais.');await downloadBackup(await encryptBackup(await backupPayload(),form.elements.password.value));form.reset();toast('Backup preparado para download. Confira o arquivo na pasta Downloads.');return;}
    if(form.id==='backup-restore-form'){const file=form.elements.file.files[0];if(!file||file.size>20971520)throw Error('Escolha um backup JSON de até 20 MB.');const data=await decryptBackup(JSON.parse(await file.text()),form.elements.password.value);const result=await restoreBackup(data);render();toast(result.preview?'Confira a prévia e confirme os registros que deseja importar.':`${result.added} registros restaurados; ${result.copies} cópias diferentes preservadas.`);return;}
    if(form.id==='open-record-form'){navigate('actuals',form.elements['record-id'].value);return;}
    if(form.id==='new-record-form'){
      window.IASDPIChronogram=await draftFromTemplate(form.elements['template-id'].value);
      if(window.IASDPIOperational){const p=await api('programs','POST',window.IASDPIChronogram);replaceProgram(p);navigate('actuals',p.id,{replace:true,refresh:true});toast('Novo registro confirmado no Supabase.');}
      else{state.selected=null;navigate('actuals',undefined,{refresh:true});}return;
    }
    if (form.id === 'actuals-form') { await saveActuals(form, finalize); return; }
    const id = form.dataset.id;
    if (form.id === 'program-form') {
      const get = name => form.querySelector(`[name="${name}"]`).value;
      const plan = {name:get('name'), date:readDateField(form.querySelector('[name="date"]')),template_id:selected()?.plan.template_id, start:get('start'), end:get('end'), team:Object.fromEntries(roles.map((role,i) => [role,get(`team-${i}`)])), items: [...form.querySelectorAll('.item-editor')].map(row => ({id:row.dataset.itemId, ...Object.fromEntries([...row.querySelectorAll('input')].map(input => [input.name,input.value]))}))};
      validateProgramForm(form,plan);
      if (id) plan.version = Number(form.dataset.version);
      let p = await api(id ? `programs/${id}` : 'programs', id ? 'PUT' : 'POST', plan);
      await window.IASDPIDrafts?.bind(form,p,draftSave?.context);
      if (form.elements.ready.checked) p = await api(`programs/${p.id}/action`, 'POST', {action:'ready', version:p.version});
      const newer=await window.IASDPIDrafts?.saved(draftSave,p);
      const stillEditing=form.isConnected,previousSelected=state.selected;replaceProgram(p);
      if(!stillEditing)state.selected=previousSelected;else if(!newer)navigate(p.execution_mode==='manual'?'actuals':'programs',p.id);
      toast(newer?'Envio confirmado. Há alterações mais recentes preservadas em rascunho.':'Programação salva.');
    } else if (form.id === 'notes-form') {
      const p = await api(`programs/${id}/notes`, 'PUT', {version:Number(form.dataset.version), note:form.elements.note.value, incident:form.elements.incident.value});
      const newer=await window.IASDPIDrafts?.saved(draftSave,p);
      const previousSelected=state.selected;replaceProgram(p);if(!form.isConnected)state.selected=previousSelected;
      form.dataset.version = p.version; toast(newer?'Envio confirmado. Há alterações mais recentes preservadas em rascunho.':'Observações salvas.');
    }
  }, actionButton);
});
document.querySelector('#duplicate-form').addEventListener('submit', event => {
  event.preventDefault();
  guarded(async () => {
    const p = await api(`programs/${state.duplicate}/duplicate`, 'POST', {date:readDateField(event.target.elements.date)});
    document.querySelector('#duplicate-dialog').close(); replaceProgram(p); navigate('edit', p.id); toast('Planejamento duplicado.');
  }, event.submitter);
});
function openNavigation(page){
  if(state.busy||bootInProgress){pendingNavigation=page;toast('Carregando… A página escolhida abrirá em seguida.');return;}
  if(page==='actuals')void guarded(()=>handleAction({dataset:{action:'chronogram'}}));
  else navigate(page);
}
function drainNavigation(){
  if(!pendingNavigation||state.busy||bootInProgress)return;
  const page=pendingNavigation;pendingNavigation=null;
  if(IASDPIAuth.allowed()||IASDPIAuth.isPublic(page))openNavigation(page);
}
document.querySelector('nav').addEventListener('click', event => { const link = event.target.closest('a[data-page]'); if(link){event.preventDefault();openNavigation(link.dataset.page);} });

function boot(){
  if(!bootTask)bootTask=performBoot().finally(()=>{bootTask=null;drainNavigation();});
  return bootTask;
}
async function performBoot() {
  bootInProgress=true;
  await IASDPIAuth.handlePasswordCallback();
  if(!IASDPIAuth.allowed()){
    pendingNavigation=null;
    const requested=location.hash.slice(1).split('/')[0]||'organization';
    state.page=IASDPIAuth.isPublic(requested)?requested:'login';render();
  }
  if(window.IASDPIConfig?.initialOperational&&window.IASDPIConfig.remoteDisabled&&!document.getElementById('initial-preparation-banner')){
    const banner=document.createElement('aside');banner.id='initial-preparation-banner';banner.className='demo-banner';
    banner.textContent='Conexão preparada · Ativação pendente. Login e gravações ainda não liberados.';
    document.querySelector('.header').after(banner);
  }
  if(!window.IASDPIConfig?.initialOperational&&window.IASDPIConfig?.environment==='validation'&&!document.querySelector('#validation-banner')){
    const banner=document.createElement('aside');banner.id='validation-banner';banner.className='demo-banner';
    banner.textContent='VALIDAÇÃO DO LOGIN · Supabase somente para login e consultas. Registros continuam neste navegador; exporte um backup em Arquivo e banco.';
    document.querySelector('.header').after(banner);
  }
  if(!window.IASDPIConfig?.initialOperational&&window.IASDPIConfig?.environment==='homologation'&&!document.querySelector('#homologation-banner')){
    const banner=document.createElement('aside');banner.id='homologation-banner';banner.className='demo-banner';
    banner.textContent=window.IASDPIConfig?.remoteDisabled?'PREPARAÇÃO · Acesso ao Supabase desativado. Login e gravações remotas ainda não liberados.':'HOMOLOGAÇÃO · Login e consultas. Alterações no Supabase bloqueadas nesta interface; registros locais separados do site principal.';
    document.querySelector('.header').after(banner);
  }
  try {
    try{await IASDPIAuth.restore();}catch(_){}
    const health = await api('health'); state.zone = health.timezone; state.offset = new Date(health.server_time).getTime() - Date.now();
    captureInvite(location.hash.slice(1));const requested=location.hash.slice(1).split('/');
    state.page=requested[0]&&requested[0]!=='login'?requested[0]:IASDPIAuth.allowed()?'home':'organization';
    if(requested[1])state.selected=requested[1];
    if(IASDPIAuth.allowed())await loadPrograms({renderState:true});
    state.selected = state.programs.find(p => p.status === 'Em andamento')?.id || state.programs.find(p => p.status === 'Pronta')?.id || null;
    captureInvite(location.hash.slice(1)); const [page,id] = location.hash.slice(1).split('/');
    if(id)state.selected=id;
    if (page === 'actuals' && !id) state.selected = null;
    // A rota atual é restaurada; novos cultos escolhem modelo e usam a data de São Paulo.
    state.page = ['home','programs','tracking','history','edit','summary','actuals','agendas','archive','organization','login','users','invite','plan-edit','trash','models','forgot-password','reset-password','schedule-setup','schedule-calendar','schedule-build','schedule-members','schedule-settings','access-admin','access-audit','access-request','controlled-reset','church-home','portal-login','events'].includes(page) ? (page==='login'&&IASDPIAuth.allowed()?'home':page) : IASDPIAuth.allowed()?'home':window.IASDPIPortalAccess?.enabled()?'church-home':'organization'; bootInProgress=false;IASDPINavigation.start();render();
  } catch (error) {
    bootInProgress=false;
    if(IASDPIAuth.allowed())state.programsLoad={status:'error',error:error.message};
    render();toast(error.message,true);
  } finally {bootInProgress=false;}
}
window.addEventListener('iasdpi-auth-changed',()=>{
  cloudState.session=IASDPIAuth.session();cloudState.archives=[];cloudState.loaded=false;cloudState.loading=false;cloudState.error='';resetUsers();
  if(!IASDPIAuth.allowed()){
    programsLoadGeneration++;state.programsLoad={status:'idle',error:''};
    pendingNavigation=null;
    registrationDirty=false;state.programs=[];state.selected=null;state.duplicate=null;window.IASDPIChronogram=null;
    dateCorrection=null;document.querySelector('#correct-date-dialog').close();document.querySelector('#correct-date-preview').replaceChildren();
    document.querySelector('#duplicate-dialog').close();
    render();
  }
});
window.addEventListener('iasdpi-role-changed',()=>{resetUsers();render();});
document.querySelector('#auth-logout').addEventListener('click',()=>{
  guarded(async()=>{if(await IASDPIAuth.logout()===false)return;state.page='organization';navigate('organization');});
});
setInterval(tick, 1000);
let dateCorrection=null;
document.querySelector('#correct-date-dialog').addEventListener('close',()=>{dateCorrection=null;document.querySelector('#correct-date-preview').replaceChildren();});
document.querySelector('#correct-date-cancel').addEventListener('click',()=>{dateCorrection=null;document.querySelector('#correct-date-dialog').close();});
document.querySelector('#correct-date-confirm').addEventListener('click',()=>guarded(async()=>{
  if(!dateCorrection||!window.IASDPIDemo)throw Error('Reabra a prévia do registro local.');
  const p=await api('programs/'+dateCorrection.id+'/correct-date','PUT',dateCorrection);
  dateCorrection=null;document.querySelector('#correct-date-dialog').close();replaceProgram(p);navigate('summary',p.id,{refresh:true});
  toast('Data corrigida para 10/10/2026 neste navegador. Nenhum culto foi duplicado. Exporte um novo backup.');
}));
window.addEventListener('iasdpi-session-status',()=>{
  let banner=document.querySelector('#session-status');
  if(!banner){banner=document.createElement('aside');banner.id='session-status';banner.className='demo-banner';banner.setAttribute('role','status');document.querySelector('.header').after(banner);}
  const status=IASDPIAuth.status();banner.dataset.authPhase=status.phase;banner.hidden=status.phase==='authenticated'||status.phase==='anonymous';banner.textContent=status.message;
  const recovered=IASDPIAuth.allowed()&&!sessionWasAuthorized;sessionWasAuthorized=IASDPIAuth.allowed();
  if(recovered&&!state.busy&&!bootInProgress)void boot();
});
boot();

document.addEventListener('focusout',event=>{if(event.target.matches('[data-date-input]')){const iso=tryReadDate(event.target.value);if(iso)event.target.value=displayDate(iso);}});
