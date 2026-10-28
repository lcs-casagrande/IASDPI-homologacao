'use strict';
// Host exclusivo de demonstração. Nenhum cliente, chave ou conexão Supabase.
const state={page:'schedule-calendar'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const heading=(tag,title,description)=>`<p class="eyebrow">${esc(tag)}</p><h1>${esc(title)}</h1><p class="lead">${esc(description)}</p>`;
const displayDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):v||'';
function tryReadDate(v){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v||'');if(!m)return null;const iso=`${m[3]}-${m[2]}-${m[1]}`,d=new Date(iso+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===iso?iso:null;}
function render(){document.querySelector('#app').innerHTML=state.page==='schedule-calendar'?IASDPIScheduleCalendar.page():IASDPISchedules.page();window.IASDPIScheduleCalendar?.mount();}
function toast(text){document.querySelector('#notice').textContent=text;document.querySelector('#notice').hidden=false;}
const deny=()=>{throw Error('Conexões externas bloqueadas nesta demonstração.');};
window.fetch=async()=>deny();window.XMLHttpRequest=class{open(){deny();}};window.WebSocket=class{constructor(){deny();}};window.EventSource=class{constructor(){deny();}};
Object.defineProperty(navigator,'sendBeacon',{value:()=>false});
window.IASDPIAuth={logout:async()=>true,allowed:()=>false,requireIdentity:async()=>deny(),jsonRequest:async()=>deny()};
window.IASDPISchedulePreview=(()=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const departments=['Sonoplastia','Diaconato','Música','Ancionato'].map((name,i)=>({id:id(i+1),name,code:['sonoplastia','diaconato','musica','ancionato'][i],active:true,version:1,can_manage:true,can_roster:true}));
 const people=['Pessoa Alfa — exemplo','Pessoa Beta — exemplo','Pessoa Gama — exemplo'].map((name,i)=>({id:id(20+i),name,display_name:name,active:true,version:1}));
 const roles=['Operação de áudio — exemplo','Diácono — exemplo','Vocalista — exemplo','Ancião do culto — exemplo'].map((name,i)=>({id:id(40+i),department_id:departments[i].id,name,active:true,version:1}));
 const memberships=people.map((p,i)=>({id:id(60+i),person_id:p.id,department_id:departments[i].id,active:true,version:1,desired_monthly_count:2,preferences:'Preferência fictícia para demonstração.'}));
 memberships.push({id:id(65),person_id:people[0].id,department_id:departments[2].id,active:true,version:1});
 const c={actor_id:id(99),is_admin:true,departments,people,roles,memberships,qualifications:[{membership_id:id(60),role_id:id(40),department_id:id(1)}],availability:[{id:id(80),person_id:id(20),department_id:id(1),kind:'unavailable',pattern:'weekly',weekdays:[2],start_time:'18:00',end_time:'20:00',active:true,version:1}],access:[]};
 const details={},receipts=new Map();
 return {async request(name,b={}){
  if(name==='iasdpi_schedule_catalog')return structuredClone(c);
  if(name==='iasdpi_schedule_person_details')return structuredClone(details[b.p_id]||{contact:'',notes:'Observação fictícia.',auth_user_id:null});
  if(name==='iasdpi_find_account')return b.p_email==='conta@exemplo.invalid'?[{user_id:id(99),email:'conta@exemplo.invalid',confirmed:true}]:[];
  if(name!=='iasdpi_schedule_save')throw Error('Operação fora desta demonstração.');
  const signature=JSON.stringify(b);
  if(receipts.has(b.p_request_id)){const old=receipts.get(b.p_request_id);if(old.signature!==signature)throw Error('Solicitação reutilizada com outros dados.');return structuredClone(old.row);}
  const key={person:'people',department:'departments',membership:'memberships',role:'roles',availability:'availability',access:'access'}[b.p_entity];
  if(!key)throw Error('Cadastro desconhecido.');
  const old=c[key].find(r=>r.id===b.p_id);
  if((old?.version||0)!==b.p_expected_version)throw Error('Versão mudou nesta demonstração. Atualize os cadastros.');
  const row={active:true,enabled:true,...old,...b.p_data,id:b.p_id,version:(old?.version||0)+1};
  if(key==='people'){
   details[row.id]={auth_user_id:row.auth_user_id||null,contact:row.contact||'',notes:row.notes||''};
   if(!old&&row.department_id)c.memberships.push({id:crypto.randomUUID(),person_id:row.id,department_id:row.department_id,active:true,version:1});
   for(const k of ['department_id','auth_user_id','contact','notes','confirm_homonym','reason'])delete row[k];
  }
  if(key==='memberships'&&row.role_ids){c.qualifications=c.qualifications.filter(q=>q.membership_id!==row.id);for(const role_id of row.role_ids)c.qualifications.push({membership_id:row.id,role_id,department_id:row.department_id});delete row.role_ids;}
  if(key==='departments'){row.can_manage=true;row.can_roster=true;}
  if(old)Object.assign(old,row);else c[key].push(row);
  receipts.set(b.p_request_id,{signature,row:structuredClone(row)});return structuredClone(row);
 }};
})();

window.IASDPICalendarSource=()=>[{"date": "2026-10-03", "person": "Henrique", "department": "Comunicação", "id": "legacy:Comunicação:2026-10-03:Henrique", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-10", "person": "Izabelle PI Souza", "department": "Comunicação", "id": "legacy:Comunicação:2026-10-10:Izabelle PI Souza", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-17", "person": "Simone/Profªde Pilates 🧘", "department": "Comunicação", "id": "legacy:Comunicação:2026-10-17:Simone/Profªde Pilates 🧘", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-24", "person": "macedo Logos", "department": "Comunicação", "id": "legacy:Comunicação:2026-10-24:macedo Logos", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-31", "person": "Letícia PI", "department": "Comunicação", "id": "legacy:Comunicação:2026-10-31:Letícia PI", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-03", "person": "Mini Lucas", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-03:Mini Lucas", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-04", "person": "Rafa", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-04:Rafa", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-07", "person": "Samuel", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-07:Samuel", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-10", "person": "Luan", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-10:Luan", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-11", "person": "Macedo", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-11:Macedo", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-14", "person": "Paulitos", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-14:Paulitos", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-17", "person": "Mini Lucas", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-17:Mini Lucas", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-18", "person": "Raphael", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-18:Raphael", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-21", "person": "Luan", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-21:Luan", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-24", "person": "Mini Lucas", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-24:Mini Lucas", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-25", "person": "Rafa", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-25:Rafa", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-28", "person": "Luan", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-28:Luan", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-10-31", "person": "Raphael", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-10-31:Raphael", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-11-01", "person": "Raphael", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-11-01:Raphael", "role": null, "origin": "Escala manual informada pela liderança"}, {"date": "2026-11-04", "person": "Paulitos", "department": "Sonoplastia", "id": "legacy:Sonoplastia:2026-11-04:Paulitos", "role": null, "origin": "Escala manual informada pela liderança"}];
window.IASDPICalendarOfficialSource=()=>({"status": "synced", "syncedAt": "2026-10-25T13:13:36.207487-03:00", "fromMonth": "2026-02", "toMonth": "2029-12", "events": [{"id": "66cf34a5736343e175cfb63aaf6d65be", "kind": "weekly", "person": "Victória Scarpelini", "startDate": "2026-02-22", "endDate": "2026-02-28"}, {"id": "ceb935b8536c8b22efecdf0705c49be8", "kind": "weekly", "person": "Samuel Ferreira", "startDate": "2026-03-01", "endDate": "2026-03-07"}, {"id": "1d5a2b588f56e30c97c638792629554e", "kind": "monthly", "person": "Marcio Mendes", "startDate": "2026-03-01", "endDate": "2026-03-31"}, {"id": "62695331d4c78993b50eef8094621f17", "kind": "weekly", "person": "Raphael Moreira", "startDate": "2026-03-08", "endDate": "2026-03-14"}, {"id": "fafc9e19f7092a4f238871d5fdb23d50", "kind": "weekly", "person": "Marcia Isabel", "startDate": "2026-03-15", "endDate": "2026-03-21"}, {"id": "fba3c889b4a72ad77421e16764cf9fa0", "kind": "weekly", "person": "Elmo Carneiro", "startDate": "2026-03-22", "endDate": "2026-03-28"}, {"id": "0ce5083ceb1b5163052101d15d242ab2", "kind": "weekly", "person": "David Cavalcanti", "startDate": "2026-03-29", "endDate": "2026-04-04"}, {"id": "528470f2fea4d06869de40b1d4385046", "kind": "monthly", "person": "Victória Scarpelini", "startDate": "2026-04-01", "endDate": "2026-04-30"}, {"id": "3a904433e5d1e0fadd8f159dedc581f8", "kind": "weekly", "person": "Adriano Borrego", "startDate": "2026-04-05", "endDate": "2026-04-11"}, {"id": "7db04a7408648ff06a5db0b31a6602ce", "kind": "weekly", "person": "Rosana Bianchini", "startDate": "2026-04-12", "endDate": "2026-04-18"}, {"id": "bfc8404e96cfb2c44f55ad4926d97f16", "kind": "weekly", "person": "Marcio Mendes", "startDate": "2026-04-19", "endDate": "2026-04-25"}, {"id": "2b9ee070a1556ce5169a9e04630076ac", "kind": "weekly", "person": "Victória Scarpelini", "startDate": "2026-04-26", "endDate": "2026-05-02"}, {"id": "04c920643a28ef33634ef9a8247417b0", "kind": "monthly", "person": "David Cavalcanti", "startDate": "2026-05-01", "endDate": "2026-05-31"}, {"id": "4ab1bda07e2c0f4341532eb8a6257f15", "kind": "weekly", "person": "Samuel Ferreira", "startDate": "2026-05-03", "endDate": "2026-05-09"}, {"id": "c52aef1fc84bd2e950c239cad8b2ec55", "kind": "weekly", "person": "Raphael Moreira", "startDate": "2026-05-10", "endDate": "2026-05-16"}, {"id": "f488a5bdcd7346db82092348ecdb0084", "kind": "weekly", "person": "Marcia Isabel", "startDate": "2026-05-17", "endDate": "2026-05-23"}, {"id": "5f1f217dbead0e8442f4b052ab1c5e3b", "kind": "weekly", "person": "Elmo Carneiro", "startDate": "2026-05-24", "endDate": "2026-05-30"}, {"id": "631036df32e142bcc134c47e4ff07369", "kind": "weekly", "person": "David Cavalcanti", "startDate": "2026-05-31", "endDate": "2026-06-06"}, {"id": "16ffeb951b444c64b9d52c576ce0fd70", "kind": "monthly", "person": "Marcia Isabel", "startDate": "2026-06-01", "endDate": "2026-06-30"}, {"id": "84f86a786dbde3326523f93017b08dc0", "kind": "weekly", "person": "Adriano Borrego", "startDate": "2026-06-07", "endDate": "2026-06-13"}, {"id": "6a6ccad8c7e38e6ae2961bf432b7ee4e", "kind": "weekly", "person": "Rosana Bianchini", "startDate": "2026-06-14", "endDate": "2026-06-20"}, {"id": "eb3d8d39c50a53da66736f9f6e11b5da", "kind": "weekly", "person": "Marcio Mendes", "startDate": "2026-06-21", "endDate": "2026-06-27"}, {"id": "bfea62dd1d066c1f8dca59e8a15531ab", "kind": "weekly", "person": "Victória Scarpelini", "startDate": "2026-06-28", "endDate": "2026-07-04"}, {"id": "2179bd406b5ff24a22a4824fcd274e9b", "kind": "monthly", "person": "Adriano Borrego", "startDate": "2026-07-01", "endDate": "2026-07-31"}, {"id": "f6a2fd576fb967821e4b04f13af39110", "kind": "weekly", "person": "Samuel Ferreira", "startDate": "2026-07-05", "endDate": "2026-07-11"}, {"id": "eb6be8bade65de6fb3b6b0a369463eb8", "kind": "weekly", "person": "Raphael Moreira", "startDate": "2026-07-12", "endDate": "2026-07-18"}, {"id": "505e521c29c30988c1e9818a067541d5", "kind": "weekly", "person": "Marcia Isabel", "startDate": "2026-07-19", "endDate": "2026-07-25"}, {"id": "f93f872547e309171d0655f2dd93e48e", "kind": "weekly", "person": "Elmo Carneiro", "startDate": "2026-07-26", "endDate": "2026-08-01"}, {"id": "a6e6a4e369f7cd74fb6e5ebceae58d0e", "kind": "monthly", "person": "Samuel Ferreira", "startDate": "2026-08-01", "endDate": "2026-08-31"}, {"id": "5fe23dfa25b21c63fc083e1dfb4e4bf0", "kind": "weekly", "person": "David Cavalcanti", "startDate": "2026-08-02", "endDate": "2026-08-08"}, {"id": "87691259f45b47e2fa445219c54b1588", "kind": "weekly", "person": "Adriano Borrego", "startDate": "2026-08-09", "endDate": "2026-08-15"}, {"id": "c3633a46ef4af537a35e326873208ba5", "kind": "weekly", "person": "Rosana Bianchini", "startDate": "2026-08-16", "endDate": "2026-08-22"}, {"id": "db604d71d5331e789c4ccd3b6f516b93", "kind": "weekly", "person": "Marcio Mendes", "startDate": "2026-08-23", "endDate": "2026-08-29"}, {"id": "e8b4f8c307840a169fd712c27db1de6c", "kind": "weekly", "person": "Victória Scarpelini", "startDate": "2026-08-30", "endDate": "2026-09-05"}, {"id": "c62211a0914d2d86471b2ea2f3e4657b", "kind": "monthly", "person": "Rosana Bianchini", "startDate": "2026-09-01", "endDate": "2026-09-30"}, {"id": "dfb0c372abbd16cf60115d4d03be152d", "kind": "weekly", "person": "Samuel Ferreira", "startDate": "2026-09-06", "endDate": "2026-09-12"}, {"id": "a1796a5769a6e1c90e7a78965cd72f8c", "kind": "weekly", "person": "Raphael Moreira", "startDate": "2026-09-13", "endDate": "2026-09-19"}, {"id": "acdf936bbba02c6750f1b03ceef24abf", "kind": "weekly", "person": "Marcia Isabel", "startDate": "2026-09-20", "endDate": "2026-09-26"}, {"id": "f5f90f1381a3cd88ba7252df9dadaa97", "kind": "weekly", "person": "Elmo Carneiro", "startDate": "2026-09-27", "endDate": "2026-10-03"}, {"id": "731123e72d455097ae6a704528cd36ed", "kind": "monthly", "person": "Adriano Borrego", "startDate": "2026-10-01", "endDate": "2026-10-31"}, {"id": "2a4b6221efda128690675a8a64c8a627", "kind": "weekly", "person": "Lucas Casagrande", "startDate": "2026-10-04", "endDate": "2026-10-10"}, {"id": "30c22174abea69139fe5529cb2ecee0b", "kind": "weekly", "person": "Adriano Borrego", "startDate": "2026-10-11", "endDate": "2026-10-17"}, {"id": "530f3b5a1697dc66025c7777c71dcc38", "kind": "weekly", "person": "Rosana Bianchini", "startDate": "2026-10-18", "endDate": "2026-10-24"}, {"id": "93b80b7bcc02e5a1ac0cdb4fb10046db", "kind": "weekly", "person": "Marcio Mendes", "startDate": "2026-10-25", "endDate": "2026-10-31"}, {"id": "ec6037096c128ce4191b6d97aa43f5cd", "kind": "weekly", "person": "Victória Scarpelini", "startDate": "2026-11-01", "endDate": "2026-11-07"}, {"id": "dcbf5af55e10e1cbcad098c1ba312fcb", "kind": "monthly", "person": "Elmo Carneiro", "startDate": "2026-11-01", "endDate": "2026-11-30"}, {"id": "c6bbffa97780f4d8b295130c8e1d215e", "kind": "weekly", "person": "Samuel Ferreira", "startDate": "2026-11-08", "endDate": "2026-11-14"}, {"id": "1a9df04eedd81cb802b46c1e63e0d99e", "kind": "weekly", "person": "Raphael Moreira", "startDate": "2026-11-15", "endDate": "2026-11-21"}, {"id": "0341d95f6b8bc7ed23e7a103491ae3a7", "kind": "weekly", "person": "Marcia Isabel", "startDate": "2026-11-22", "endDate": "2026-11-28"}, {"id": "9f4105cc42082fc6354dd002ace24cc5", "kind": "weekly", "person": "Elmo Carneiro", "startDate": "2026-11-29", "endDate": "2026-12-05"}, {"id": "c69ea210663fa469d05e449528ccc90d", "kind": "monthly", "person": "Victória Scarpelini", "startDate": "2026-12-01", "endDate": "2026-12-31"}, {"id": "50375f6e93ef57c5964e4e28f51f528b", "kind": "weekly", "person": "Lucas Casagrande", "startDate": "2026-12-06", "endDate": "2026-12-12"}, {"id": "bc60f222fb2689c6268459bfa4b56eb0", "kind": "weekly", "person": "Adriano Borrego", "startDate": "2026-12-13", "endDate": "2026-12-19"}, {"id": "80cf8de0ade94d59eb271a77f352d957", "kind": "weekly", "person": "Rosana Bianchini", "startDate": "2026-12-20", "endDate": "2026-12-26"}, {"id": "3af447c072e3af0e104182fca24082df", "kind": "weekly", "person": "Marcio Mendes", "startDate": "2026-12-27", "endDate": "2027-01-02"}]});
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
  if(window.IASDPICalendarSource)return window.IASDPICalendarSource().map(r=>({...r}));
  return Object.entries(ministrySchedules).flatMap(([department,rows])=>rows.map(r=>({id:'legacy:'+department+':'+r.date+':'+r.person,date:r.date,department,person:r.person,role:null,origin:'Escala manual informada'})));
 }
 function officialSource(){return window.IASDPICalendarOfficialSource?window.IASDPICalendarOfficialSource():window.IASDPIAgendaData||{events:[]};}
 function periods(){
  const seen=new Set();
  return (officialSource().events||[]).filter(e=>['monthly','weekly'].includes(e.kind)&&validDay(e.startDate)&&validDay(e.endDate)&&e.endDate>=e.startDate).map(e=>({id:'official:'+(e.id||[e.kind,e.startDate,e.endDate,e.person||''].join(':')),date:e.startDate,startDate:e.startDate,endDate:e.endDate,kind:e.kind,department:'Ancionato',person:e.person||null,role:e.kind==='monthly'?'Ancião do Mês':'Ancião da Semana',origin:'Agenda oficial · cópia publicada'})).filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true;});
 }
 function data(){return [...legacy(),...periods()];}
 const departments=()=>[...new Set([...Object.keys(colors),...data().map(r=>r.department)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const active=d=>ui.departments===null||ui.departments.has(d);
 const matches=r=>active(r.department)&&(ui.person==='all'||(r.person||'__unassigned__')===ui.person);
 const overlaps=(r,start,end)=>r.startDate?r.startDate<=end&&r.endDate>=start:r.date>=start&&r.date<=end;
 const sort=rows=>rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.department.localeCompare(b.department,'pt-BR')||(a.person||'').localeCompare(b.person||'','pt-BR'));
 function monthDays(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1000)throw Error('Selecione um mês válido.');return new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0,12)).getUTCDate();}
 function changeMonth(value){monthDays(value);ui.month=value;ui.day=value===dayNow().slice(0,7)?dayNow():value+'-01';}
 function shift(n){const d=new Date(ui.month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);changeMonth(d.toISOString().slice(0,7));}
 const personText=r=>r.person||(r.role?'A definir':'Responsável não informado');
 const label=r=>`${r.department} — ${personText(r)} · ${r.role||'Função não informada'}`;
 function tag(r,compact=false){return `<span class="scale-tag ${compact?'scale-chip':''}" data-scale-color="${escape(r.department)}" title="${escape(label(r))}">${icon(r.department)}<span class="scale-person-name">${escape(compact?personText(r):r.department+' — '+personText(r))}</span>${compact?`<span class="sr-only">${escape(r.department+' · '+(r.role||'Função não informada'))}</span>`:''}</span>`;}
 function list(rows,emptyText){return rows.length?`<ul class="scale-details">${rows.map(r=>`<li>${tag(r)}<small>${r.startDate?dateText(r.startDate)+' a '+dateText(r.endDate):dateText(r.date)} · ${escape(r.role||'Função não informada')} · ${escape(r.origin)}</small></li>`).join('')}</ul>`:`<p class="muted">${escape(emptyText)}</p>`;}
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
  const rows=data(),filtered=sort(rows.filter(matches)),monthStart=ui.month+'-01',days=monthDays(ui.month),monthEnd=ui.month+'-'+days;
  const monthly=filtered.filter(r=>overlaps(r,monthStart,monthEnd)),selected=filtered.filter(r=>overlaps(r,ui.day,ui.day));
  const people=[...new Set(rows.map(r=>r.person).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const title=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(monthStart+'T12:00:00Z'));
  const offset=new Date(monthStart+'T12:00:00Z').getUTCDay(),first=addDays(monthStart,-offset),weekCount=Math.ceil((offset+days)/7);
  const weeks=Array.from({length:weekCount},(_,week)=>{
   const weekStart=addDays(first,week*7);
   const bands=bandRows(monthly,weekStart,monthStart,monthEnd);
   const numbers=bands?`<tr class="scale-number-row">${Array.from({length:7},(_,col)=>{const day=addDays(weekStart,col);return day.startsWith(ui.month)?`<td><span class="scale-day-number ${day===dayNow()?'scale-today-number':''}" aria-hidden="true">${Number(day.slice(-2))}</span></td>`:'<td class="scale-outside" aria-hidden="true"></td>';}).join('')}</tr>`:'';
   const cells=Array.from({length:7},(_,col)=>{const day=addDays(weekStart,col);if(!day.startsWith(ui.month))return '<td class="scale-outside" aria-hidden="true"></td>';
    const items=monthly.filter(r=>!r.startDate&&r.date===day),all=monthly.filter(r=>overlaps(r,day,day));
    return `<td data-scale-day="${day}"><button type="button" class="scale-day" data-scale-action="day" data-date="${day}" aria-label="${escape(dateText(day)+' · '+all.length+' entradas'+(all.length?': '+all.map(label).join('; '):''))}" aria-pressed="${day===ui.day}" ${day===dayNow()?'aria-current="date"':''}>${bands?'':`<span class="scale-day-number">${Number(day.slice(-2))}</span>`}${items.map(r=>tag(r,true)).join('')}</button></td>`;
   }).join('');
   return `<tbody class="scale-week-group ${bands?'scale-week-with-periods':''}">${numbers}${bands}<tr class="scale-days-row" data-week-start="${weekStart}">${cells}</tr></tbody>`;
  }).join('');
  const missing=monthly.filter(r=>!r.person&&r.role),pointCount=monthly.filter(r=>!r.startDate).length,source=officialSource();
  return `<div class="scale-heading"><div><p class="eyebrow">GESTÃO DE ESCALAS · CONSULTA</p><h1>Calendário de escalas</h1></div><div><a href="#schedule-setup" data-calendar-nav>Cadastros de pessoas e funções</a><button type="button" class="primary" disabled aria-describedby="scale-create-note">Criar escala</button></div></div>
   <p id="scale-create-note" class="muted">Criação de escalas em preparação. Nesta etapa não há gravação da Fase B.</p>
   <details class="scale-provenance"><summary>Origem das escalas</summary><p>Sonoplastia: 15 registros manuais de outubro/início de novembro de 2026. Comunicação: cinco registros manuais de outubro. Grafias preservadas; sem sincronização automática dessas listas.</p><p>Anciãos: cópia da Agenda oficial${source.syncedAt?' atualizada em '+escape(dateText(source.syncedAt.slice(0,10))):'; atualização não informada'}. Datas finais inclusivas conforme a fonte. Nenhum ancião é inferido nos períodos sem escala.</p><p>Horários não informados; esta consulta não valida conflitos de horário.</p></details>
   <section class="panel scale-month-panel"><div class="scale-month-actions"><button type="button" data-scale-action="previous" aria-label="Mês anterior">‹</button><h2 id="scale-month-title">${escape(title)}</h2><button type="button" data-scale-action="next" aria-label="Próximo mês">›</button><label>Mês<input type="month" id="scale-month" value="${ui.month}"></label><button type="button" data-scale-action="today">Hoje</button></div>
   <div class="scale-filters scale-person-filters"><label>Pessoa<select id="scale-person"><option value="all">Todas</option>${people.map(p=>`<option value="${escape(p)}" ${ui.person===p?'selected':''}>${escape(p)}</option>`).join('')}${rows.some(r=>!r.person&&r.role)?`<option value="__unassigned__" ${ui.person==='__unassigned__'?'selected':''}>A definir</option>`:''}</select></label><div class="scale-help-control"><button type="button" class="scale-help-button" aria-label="Ajuda sobre os filtros" aria-controls="scale-help-tip" aria-describedby="scale-help-tip" aria-expanded="false">?</button><span id="scale-help-tip" role="tooltip" hidden>Toque nos departamentos para mostrar ou ocultar. Selecione um dia ou faixa para ver os detalhes completos.</span></div></div>
   <div class="scale-filter-bar" role="group" aria-label="Filtrar departamentos"><button type="button" class="scale-all-filter" data-scale-action="all" aria-pressed="${departments().every(active)}">Todos</button>${departments().map(d=>`<button type="button" class="scale-filter scale-tag" data-scale-action="department" data-department="${escape(d)}" data-scale-color="${escape(d)}" aria-pressed="${active(d)}">${icon(d)}<span>${escape(d)}</span><span class="scale-filter-state" aria-hidden="true">${active(d)?'✓':'—'}</span></button>`).join('')}</div>
   ${monthly.some(r=>r.kind==='monthly')?`<div class="scale-month-responsibles" role="group" aria-label="Responsáveis do mês">${monthly.filter(r=>r.kind==='monthly').map(r=>`<button type="button" class="scale-monthly" data-scale-action="period" data-start-date="${r.startDate>monthStart?r.startDate:monthStart}" data-scale-id="${escape(r.id)}" data-scale-kind="monthly" data-scale-color="${escape(r.department)}" data-from="${r.startDate>monthStart?r.startDate:monthStart}" data-to="${r.endDate<monthEnd?r.endDate:monthEnd}" aria-label="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}" title="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}">${icon(r.department)}<span class="scale-month-role">${escape(r.role)}:</span><span class="scale-person-name">${escape(personText(r))}</span></button>`).join('')}</div>`:''}
   <table class="scale-calendar"><caption class="sr-only">${escape(title)} — semanas de domingo a sábado, com faixas de anciãos da semana</caption><thead><tr>${['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'].map(d=>`<th scope="col"><abbr title="${d}">${d.slice(0,3)}</abbr></th>`).join('')}</tr></thead>${weeks}</table>
   <p class="scale-result" role="status" aria-live="polite">${pointCount} escalas pontuais e ${monthly.length-pointCount} períodos de anciãos neste mês com os filtros aplicados.</p></section>
   <section class="panel" id="scale-selected" tabindex="-1" aria-labelledby="scale-selected-title"><h2 id="scale-selected-title">Escalas de ${dateText(ui.day)}</h2>${list(selected,'Nenhuma escala corresponde aos filtros nesta data.')}</section>
   <div class="scale-overview"><section class="panel"><h2>Próximas escalas</h2><p class="muted">A partir de ${dateText(dayNow())}, com os filtros aplicados; inclui períodos em andamento.</p>${list(filtered.filter(r=>(r.endDate||r.date)>=dayNow()).slice(0,6),'Não há próximas escalas informadas com estes filtros.')}</section>
   <section class="panel"><h2>Departamentos</h2><p>${escape(departments().filter(active).join(' · ')||'Nenhum selecionado')}</p><h2>Pessoas escaladas</h2><p>${escape([...new Set(monthly.map(r=>r.person).filter(Boolean))].join(' · ')||'Nenhuma na escala informada neste filtro')}</p><h2>Funções ainda sem responsável</h2>${list(missing,'Nenhuma função sem responsável foi informada nesta seleção.')}<p class="muted">Funções ausentes da fonte não são inferidas.</p></section></div>`;
 }
 function mount(){
  const extras=departments().filter(d=>!Object.hasOwn(colors,d));
  document.querySelectorAll('[data-scale-color]').forEach(el=>{const d=el.dataset.scaleColor,[bg,fg]=colors[d]||[`hsl(${(extras.indexOf(d)*137.508+24)%360} 65% 91%)`,'#24313b'];el.style.backgroundColor=el.matches('.scale-filter[aria-pressed="false"]')?'#fff':el.dataset.scaleKind==='weekly'?'#f2e1aa':bg;el.style.color=fg;el.style.borderColor=fg;});
  const help=document.querySelector('.scale-help-control');
  if(help){
   const button=help.querySelector('button'),tip=help.querySelector('[role=tooltip]');let pinned=false;
   const show=open=>{tip.hidden=!open;button.setAttribute('aria-expanded',String(open));};
   help.onmouseenter=()=>show(true);
   help.onmouseleave=()=>{if(!pinned&&!button.matches(':focus-visible'))show(false);};
   button.onfocus=()=>{if(button.matches(':focus-visible'))show(true);};
   button.onblur=()=>{pinned=false;show(false);};
   button.onclick=()=>{pinned=!pinned;show(pinned);};
   button.onkeydown=e=>{if(e.key==='Escape'){pinned=false;show(false);e.preventDefault();e.stopPropagation();}};
  }
 }
 function redraw(focus){if(state.page!=='schedule-calendar')return;render();mount();if(focus)document.getElementById(focus)?.focus({preventScroll:true});}
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
 return {page,mount,legacy,data,periods,segments,monthDays,dayNow};
})();

'use strict';
// Fase A: cadastros. Escalas legadas e calendário oficial mantêm fontes próprias.
window.IASDPISchedules=(()=>{
  const model={status:'idle',catalog:null,error:'',tab:'people',query:'',department:'',editor:null,dirty:false,saving:false,feedback:'',generation:0};
  const tables={department:'departments',person:'people',role:'roles',membership:'memberships',availability:'availability',access:'access'};
  const titles={department:'Departamento',person:'Pessoa',role:'Função',membership:'Vínculo e habilitações',availability:'Disponibilidade',access:'Permissão ministerial'};
  const weekdays=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const suggestions={sonoplastia:['Operador de áudio','Projeção/multimídia','Apoio técnico'],diaconato:['Diácono','Diaconisa','Recepção ou apoio'],musica:['Direção musical','Instrumentista','Vocalista','Equipe de louvor'],ancionato:['Ancião responsável pelo culto','Ancião da semana','Ancião do mês']};
  const references={};
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
  function deptOptions(selected,managed=false,blank=false){return (blank?'<option value="">Todos / geral</option>':'')+(model.catalog?.departments||[]).filter(d=>!managed||d.can_manage).map(d=>`<option value="${h(d.id)}" ${d.id===selected?'selected':''}>${h(d.name)}${d.active?'':' (inativo)'}</option>`).join('');}
  function personName(id){return model.catalog?.people.find(p=>p.id===id)?.display_name||'Pessoa indisponível';}
  function deptName(id){return model.catalog?.departments.find(d=>d.id===id)?.name||'Geral';}
  const check=(label,name,value)=>`<label class="checkbox"><input type="checkbox" name="${name}" ${value?'checked':''}> ${h(label)}</label>`;
  function input(label,name,value='',type='text',attrs=''){return `<label>${h(label)}<input name="${name}" type="${type}" value="${h(value??'')}" ${attrs}></label>`;}
  function select(label,name,options){return `<label>${h(label)}<select name="${name}">${options}</select></label>`;}
  const text=(label,name,value='')=>`<label>${h(label)}<textarea name="${name}" rows="2">${h(value)}</textarea></label>`;
  const formatDay=day=>day?displayDate(day):'Sem limite';
  function page(){
    const title=heading('ESCALAS · FUNDAÇÃO','Cadastros de escalas','Organize pessoas, departamentos, funções e disponibilidades. A criação e publicação de escalas serão uma etapa posterior.');
    if(model.status==='idle'){queueMicrotask(load);return title+'<p role="status">Recuperando acesso aos cadastros…</p>';}
    const preview=window.IASDPISchedulePreview?'<p class="demo-banner">Prévia com dados fictícios. Alterações apenas em memória; não grava no Supabase e reinicia ao recarregar.</p>':'';
    if(model.status==='loading')return title+preview+'<p role="status">Carregando cadastros e permissões…</p>';
    if(model.status==='error')return title+preview+`<section class="panel"><p role="alert" class="form-error">${h(model.error)}</p><p>Se a migração 005 ainda não foi instalada, solicite sua revisão e ativação. Não há substituição por dados locais.</p>${button('Tentar novamente','refresh')}<form id="schedule-login" class="schedule-grid"><h2>Entrar nos cadastros</h2>${input('E-mail','email','','email','required autocomplete="username"')}${input('Senha','password','','password','required autocomplete="current-password"')}<button class="primary" type="submit">Entrar</button><p class="schedule-feedback" role="status"></p></form><p><a href="#forgot-password">Esqueci minha senha</a></p></section>`;
    const c=model.catalog,manage=c.is_admin||c.departments.some(d=>d.can_manage);
    const tabs=[['people','Pessoas'],['departments','Departamentos'],['roles','Funções'],['memberships','Vínculos'],['availability','Disponibilidade'],...(c.is_admin?[['access','Permissões']]:[]),['sources','Fontes fictícias']];
    return title+preview+`<div class="schedule-toolbar"><p>${c.is_admin?'Administrador':manage?'Gestão ministerial autorizada':'Consulta autorizada'} · ${button('Atualizar','refresh')}${button('Sair','logout')}</p><p role="status" class="schedule-feedback">${h(model.feedback)}</p></div>
    <nav class="schedule-tabs" aria-label="Cadastros de escalas">${tabs.map(([key,label])=>button(label,'tab',key,model.tab===key?'aria-current="page"':'')).join('')}</nav>
    ${model.editor?editor():''}
    ${model.tab==='sources'?sources():`<section class="panel"><div class="schedule-toolbar"><h2>${h(tabs.find(t=>t[0]===model.tab)?.[1]||'Pessoas')}</h2>${canCreate(model.tab)?button('Cadastrar '+({people:'pessoa',departments:'departamento',roles:'função',memberships:'vínculo',availability:'disponibilidade',access:'permissão'}[model.tab]),'create',Object.keys(tables).find(k=>tables[k]===model.tab),'class="primary"'):''}</div>
    <form id="schedule-search" class="schedule-grid">${input('Pesquisar nome, pessoa ou departamento','query',model.query,'search')}${select('Departamento','filter',deptOptions(model.department,false,true))}<button type="submit">Pesquisar</button>${button('Limpar filtros','clear')}</form>
    ${list()}</section>`}`;
  }
  function canCreate(tab){return model.catalog.is_admin||(['people','roles','memberships','availability'].includes(tab)&&model.catalog.departments.some(d=>d.can_manage));}
  function rowCanEdit(entity,r){return model.catalog.is_admin||(entity!=='person'&&entity!=='department'&&entity!=='access'&&model.catalog.departments.some(d=>d.id===r.department_id&&d.can_manage));}
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
  function sources(){return '<section class="panel"><h2>Fontes fictícias</h2><p>Todos os cadastros são exemplos. Nenhuma escala da liderança, agenda oficial ou registro real foi carregado.</p></section>';}
  async function openEditor(entity,id){
    if(!canLeave())return;
    const row=id?find(entity,id):null,c=model.catalog;
    if(id&&(!row||!rowCanEdit(entity,row)))throw Error('Sem permissão para editar este cadastro.');
    const initial=structuredClone(row||{active:true,enabled:true,department_id:c.departments.find(d=>d.can_manage)?.id||'',kind:'unavailable',pattern:'period',access_level:'viewer'});
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
      model.editor=null;model.dirty=false;model.feedback=window.IASDPISchedulePreview?'Cadastro atualizado apenas nesta prévia fictícia.':'Cadastro confirmado pelo Supabase.';
      await load();
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
  window.addEventListener('beforeunload',event=>{if(model.dirty||model.saving){event.preventDefault();event.returnValue='';}});
  return {page,canLeave,load};
})();

document.addEventListener('click',e=>{const el=e.target.closest('[data-demo-view], [data-calendar-nav]');if(!el)return;e.preventDefault();if(!IASDPISchedules.canLeave())return;state.page=el.dataset.demoView||'schedule-setup';render();document.querySelector('#app').focus();});
render();
