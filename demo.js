'use strict';
// Host exclusivo de demonstração. Nenhum cliente, chave ou conexão Supabase.
const state={page:'schedule-setup'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const heading=(tag,title,description)=>`<p class="eyebrow">${esc(tag)}</p><h1>${esc(title)}</h1><p class="lead">${esc(description)}</p>`;
const displayDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):v||'';
function tryReadDate(v){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v||'');if(!m)return null;const iso=`${m[3]}-${m[2]}-${m[1]}`,d=new Date(iso+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===iso?iso:null;}
function render(){document.querySelector('#app').innerHTML=IASDPISchedules.page();}
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

render();
