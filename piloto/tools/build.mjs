// Build estático sem dependências. Nenhum acesso de rede/banco.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const inPlace=process.argv.includes('--in-place');
const preview=process.env.VERCEL_ENV==='preview'||process.argv.includes('--preview');
if(process.env.VERCEL_ENV==='production'&&process.env.IASDPI_PRODUCTION_BUILD_APPROVED!=='reviewed')throw Error('Deploy de produção exige aprovação explícita; usar Preview.');
const outputIndex=process.argv.indexOf('--output');const out=inPlace?root:outputIndex>=0?resolve(process.argv[outputIndex+1]):join(root,'dist');mkdirSync(join(out,'assets'),{recursive:true});
const manifest=JSON.parse(readFileSync(join(root,'manifest.json'))),contents=new Map();
const digest=x=>createHash('sha256').update(x).digest('hex'),sri=x=>'sha256-'+createHash('sha256').update(x).digest('base64');
const files=Object.keys(manifest.files).filter(p=>!p.includes('/')&&p!=='index.html');
for(const name of files){let b=readFileSync(join(root,name));if(name==='config.js'&&(preview||process.env.IASDPI_PROFILES_ACTIVATED==='reviewed')){const cfg=JSON.parse(b.toString().split('Object.freeze(')[1].split(');')[0]);if(preview){cfg.remoteReadOnly=true;cfg.environment='preview';cfg.previewDeployment=true;}if(process.env.IASDPI_PROFILES_ACTIVATED==='reviewed'){cfg.aliasLoginEnabled=true;cfg.pilotProfilesEnabled=true;}b=Buffer.from("'use strict';\nwindow.IASDPIConfig=Object.freeze("+JSON.stringify(cfg,null,2)+");\n");}contents.set(name,b);}
for(const [name,b] of contents){const text=b.toString();if(/sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN .*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text))throw Error('Material privado/JWT detectado em '+name);}
const bundle=Buffer.concat([Buffer.from("'use strict';\nwindow.IASDPIRelease?.executing();\n"),Buffer.from([...contents].filter(([n])=>n.endsWith('.js')&&n!=='agenda-data.js').map(([,b])=>b.toString()).join('\n;\n'))]);
function asset(kind,b,ext){const path='assets/'+kind+'-'+digest(b)+'.'+ext;contents.set(path,b);return {url:path+'?v='+digest(b).slice(0,16),integrity:sri(b)};}
const app=asset('app',bundle,'js');
let loader=readFileSync(join(root,manifest.entry.loader.split('?')[0]),'utf8');
loader=loader.replace(/const bundle="[^"]+",integrity="[^"]+"/,`const bundle=${JSON.stringify(app.url)},integrity=${JSON.stringify(app.integrity)}`);
const load=asset('loader',Buffer.from(loader),'js');
const style=asset('styles',Buffer.concat([contents.get('styles.css'),Buffer.from('\n:root{--iasdpi-release-style:ready}\n')]),'css');
let html=readFileSync(join(root,'index.html'),'utf8');
html=html.replace(/(<link[^>]+data-release-style[^>]+href=")[^"]+(" integrity=")[^"]+/,`$1${style.url}$2${style.integrity}`);
html=html.replace(/(<script src=")assets\/loader-[^"]+(" integrity=")[^"]+/,`$1${load.url}$2${load.integrity}`);
if(preview)html=html.replace('Piloto conectado · dados reais do IASD_PI','Preview de revisão · gravações remotas desativadas · novos acessos aguardam ativação');
for(const name of ['calendar-compact-mobile'])if(manifest.entry[name.replaceAll('-','_')]){const path=manifest.entry[name.replaceAll('-','_')].split('?')[0];contents.set(path,readFileSync(join(root,path)));}
contents.set('index.html',Buffer.from(html));
for(const [name,b] of contents){mkdirSync(dirname(join(out,name)),{recursive:true});writeFileSync(join(out,name),b);}
manifest.files=Object.fromEntries([...contents].map(([n,b])=>[n,digest(b)]));
manifest.entry={...manifest.entry,bundle:app.url,loader:load.url,styles:style.url};
manifest.profile_access_prepared=true;manifest.profile_access_activated=process.env.IASDPI_PROFILES_ACTIVATED==='reviewed';manifest.preview_read_only=preview;manifest.remote_read_only=preview||manifest.remote_read_only;manifest.environment=preview?'preview':manifest.environment;
manifest.source_commit=process.env.VERCEL_GIT_COMMIT_SHA||'feature/issue-1-acessos (PR)';
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
// Manter o exemplo anterior, sem inseri-lo no bundle ou nas rotas da aplicação.
if(existsSync(join(root,'escalas-demo/index.html'))){mkdirSync(join(out,'escalas-demo'),{recursive:true});copyFileSync(join(root,'escalas-demo/index.html'),join(out,'escalas-demo/index.html'));}
console.log('Artefatos/SRI validados em '+out+'; nenhum deploy ou SQL executado.');
