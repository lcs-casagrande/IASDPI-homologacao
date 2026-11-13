# Issue #1 — três perfis do piloto

Implementação na `feature/issue-1-acessos`. Alvo: `piloto/`, projeto Vercel
`casagrandelg-2406/iasdpi-homologacao`, raiz `piloto`. Não altera a demonstração
`integrada/`, main, domínio, Supabase ou configuração de Auth reais.

## Matriz efetiva

| Operação | Público | membro | secretaria | admin existente |
|---|---|---|---|---|
| Ancionato publicado e eventos abertos publicados | Sim | Sim | Sim | Sim |
| Outras escalas publicadas | Não | Departamentos explicitamente autorizados | Departamentos explicitamente autorizados | Todos |
| Rascunhos/edição de escalas, pessoas, configurações | Não | Não | Não | Sim |
| Criar/editar/publicar/cancelar eventos da igreja | Não | Não | Sim | Sim |
| Eventos de departamento | Não | Não | Somente departamentos autorizados | Todos |
| Usuários, concessões, auditoria privada | Não | Não | Não | Administração existente |
| Cronoanálise | Público existente | Nenhum acesso novo | Nenhum acesso novo | Permissões atuais preservadas |

Participação no Cadastro Geral não concede acesso. Nenhuma conta de líder é ativada.
O alias não é prova de permissão: cada RPC verifica identidade, igreja, estado e perfil.
`actor()` continua exclusivo do admin; apenas a cadeia explícita de eventos usa
`event_actor()`. Membro e Secretaria só recebem a projeção publicada das escalas,
sem cadastros, autoria administrativa ou rascunhos. A consulta pública instalada
não é substituída: sua definição é guardada e comparada integralmente.

## O que está publicado na Preview

Build estático de revisão, com aviso e `remoteReadOnly:true`. Novos acessos reais
**ainda desativados** (`pilotProfilesEnabled:false`, `aliasLoginEnabled:false`).
Não existem senhas de teste válidas no Supabase nem usuários simulados apresentados
como reais. O login administrativo anterior permanece preparado. Gravações,
redefinição de senhas e provisionamento não são feitos pela Preview.

O build recompõe bundle, loader, SHA-256, SRI, CSS e manifesto juntos. Só copia
arquivos estáticos permitidos para `piloto/dist`; SQL, Edge Functions, testes,
segredos e ferramentas do operador ficam fora. Deploy de produção é recusado
sem aprovação explícita. Redirecionamentos `/piloto/*` preservam os caminhos antigos.
SSO da Vercel continua `all_except_custom_domains`; não desabilitar para ver a Preview.

## Ativação futura — requer revisão e autorização separadas

1. Validar backup **restaurável**. Continua pendente; os testes locais não o substituem.
2. Operador executa somente leitura `supabase/capture_profiles_baseline.sql`, salva
   o resultado privado e revisa a definição pública efetiva. Não foi capturada nesta
   execução. A fixture local reproduz funcionalmente a restrição informada na issue,
   não pretende ser uma cópia exata do SQL remoto.
3. Revisar e executar `supabase/migrations/202611130001_pilot_profiles.sql`, uma
   transação. Exige piloto instalado/admin existente; não reexecutar instalações
   antigas nem as migrações de governança de outro repositório. Interromper em qualquer
   divergência. Snapshot das funções é ferramenta de rollback lógico, **não backup**.
4. Verificar admin anterior, RLS/ACL e função pública idêntica à captura; testar
   anônimo, inclusive históricos/vagas do Ancionato. Nenhum dado do núcleo é alterado.
5. Configurar Auth: sem cadastro público para estes acessos, confirmação de identidade,
   senhas fortes, limites do provedor e expiração de JWT revisados. Preservar as URLs e
   os fluxos existentes da Cronoanálise. Não alterar a senha do admin existente.
6. Implantar somente as Edge Functions `alias-login` e `pilot-password` após revisão.
   `supabase/config.toml` desativa a pré-verificação JWT do gateway: login é público,
   mas limitado; senha exige Bearer e valida a identidade diretamente no GoTrue antes
   de usar RPCs de serviço. Não existe endpoint público alias→e-mail nem reset por ID.
7. Configurar segredos **somente no servidor** conforme `.env.example`. Pepper aleatório
   independente >=32 caracteres. Não guardar valores no GitHub, build ou cliente.
   CORS lista origens completas exatas (sem caminhos):
   `https://lcs-casagrande.github.io`, origem Vercel autorizada e a Preview específica
   se necessário. Não usar `*.vercel.app` ou `*`. Adicionar domínio personalizado só
   após validar HTTPS no navegador; não ignorar alertas TLS nem alterar DNS nesta entrega.
   Manter os caminhos completos de callback de cada host na allowlist Auth, preservando
   GitHub Pages `/IASDPI-homologacao/piloto/`. CORS não substitui Auth/RLS.
8. `IASDPI_ALIAS_LOGIN_ENABLED=true` só após validar funções/segredos. Header de IP
   confiável é opcional e deve ser sobrescrito pelo gateway; por padrão não confiar
   em `x-forwarded-for` enviado pelo cliente. Há limites HMAC por igreja/alias/identidade
   e global, erros genéricos, timeout, comparação de versão após autenticação e piso de
   resposta para negativas. CAPTCHA do provedor é repassado quando configurado.
9. Provisionar `membro` e `secretaria` apenas com revisão dos departamentos. O script
   abaixo planeja por padrão; `--execute` exige terminal privado, recibo legítimo de
   backup/restauração/revisão e confirmação digitada. Nunca executar em CI/Preview:
   ```sh
   python scripts/provision_profiles.py membro --department UUID_AUTORIZADO
   python scripts/provision_profiles.py secretaria --department UUID_AUTORIZADO
   ```
   Execução gera identidade técnica única, senha provisória aleatória e entrega uma
   única vez em terminal privado. Não usar o alias como senha. O SQL emitido chama
   `iasdpi_pilot_private.profile_enroll`, só executável pelo operador; a nova identidade
   não recebe acesso antes disso. Não cria pessoas nem duplica o Cadastro Geral.
   O admin existente é vinculado ao alias `admin` sem recriar conta/senha/sessão.
10. Validar troca obrigatória inicial e somente então gerar build com
    `IASDPI_PROFILES_ACTIVATED=reviewed`. Esse parâmetro não ativa SQL/Edge/usuários.
    Na Preview continua bloqueando gravações. Publicação operacional exige nova autorização.

## Troca e recuperação

A própria senha é alterada pelo GoTrue com token do próprio usuário. O servidor
bloqueia as permissões antes, revoga refresh tokens globalmente e só confirma após
sucesso do provedor e do banco. Falha conhecida de senha limpa o bloqueio transitório,
mas mantém troca obrigatória; falha incerta permanece bloqueada para recuperação.
Sessões emitidas antes do marco da credencial são recusadas nas RPCs do piloto.
JWTs antigos de outros sistemas têm a validade normal do provedor: não afirmamos
revogação imediata em toda a Cronoanálise, que permanece intacta. Aguardar dois segundos
antes de entrar novamente evita a granularidade de segundos do `iat`.

Recuperação de Membro/Secretaria é supervisionada, sem recuperar senha anterior:
operador verifica identidade, executa `SELECT iasdpi_pilot_private.profile_reset_begin('membro');`
(ou `secretaria`), guarda o recibo privado e passa `--reset-receipt CAMINHO` ao script
com `--execute` e recibo de backup. O script confere associação, altera via AuthAdmin,
revoga sessões e conserva troca obrigatória. Não publicar recibos/credenciais.
O reset do admin existente não é automatizado por este script. Nenhuma tela permite
escolher outro `user_id` para trocar senha. Se algo falhar, manter o perfil bloqueado,
conferir no painel e recuperar supervisionadamente; não repetir cegamente.

## Interrupção / rollback

Desativar flags e Edge Functions novas; manter a versão anterior do frontend.
Operador pode revisar `supabase/rollback_profiles.sql`: desabilita Membro/Secretaria,
restaura funções originais guardadas, preserva admin, usuários, históricos e tabelas.
Verifica a consulta pública e o núcleo antes de concluir. Não apaga Auth nem recria
senhas. Não é restauração de backup nem promessa de reversão de dados externos.
Após rollback, reativação exige revisão explícita dos vínculos/flags; não é automática.

## Testes reproduzíveis e limites

```sh
node --test tests/*.test.mjs
# PostgreSQL 17 descartável com --network none; nunca apontar para Supabase:
IASDPI_PG_TEST_CONTAINER=iasdpi-ci python -m unittest discover -s tests -p 'test_*.py' -v
node piloto/tools/build.mjs --preview
```

Banco testa os três perfis, anon e identidade sem concessão, RPCs diretas negativas,
publicado/rascunho, departamentos, versões obsoletas, revogação, sessão antiga,
troca obrigatória, limites, último admin, idempotência, rollback e núcleo inalterado.
Edge testa HTTP com GoTrue/RPCs simulados, erros, enumeração, CORS, limites e credenciais.
Browser usa HTTP interceptado e SQL real **local**, com identidades sintéticas; bloqueia
outras origens, testa menus, rotas diretas, login, publicação/cancelamento e celular.
Não são testes contra Supabase Auth/Edge reais, Vercel SSO ou credenciais reais.

Antes da ativação real ainda faltam: backup restaurado, captura pública exata,
revisão SQL, deploy Edge/segredos/origens, provisionamento autorizado e testes negativos
com tokens reais dos três perfis em ambiente aprovado. Não houve alteração no Supabase,
produção, main, DNS ou credenciais reais nesta entrega.
