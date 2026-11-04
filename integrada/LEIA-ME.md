# IASDPI — Homologação integrada

Portal, Agenda, Organograma, Cadastro Geral, Escalas e acessos demonstrativos.
E1: Gestão de Eventos e Calendário Unificado. Abra Gestão de Eventos após entrar. A Agenda oficial é reutilizada; importar exige revisão administrativa e cria rascunho.

As alterações ficam em memória e reiniciam ao recarregar. Não inserir dados privados.
Não há conexão com Supabase, envio de e-mails ou contas reais.

1. Consulte Calendário e Organograma sem login.
2. Abra Entrar: IASD Parada Inglesa já estará selecionada acima do identificador e senha. Manter conectado vem marcado; desmarque para limitar a sessão à aba.
3. Entre com uma identidade fictícia abaixo. Senha fictícia: `Demonstracao#2026`.
4. Para testar o rodízio no Cadastro Geral integrado, confirme explicitamente
   a participação, habilitação e dias de uma pessoa de teste. Informação pendente
   não significa disponível. Responsabilidade ministerial não concede habilitação.
5. Salve rascunho; publique separadamente e confira o Calendário na mesma aba.
6. Abra Administração para consultar Cadastro Geral e Gestão de Acessos.

| Identificador fictício | Alcance |
| --- | --- |
| admin.iasdpi | Administração demonstrativa da IASD_PI |
| som.iasdpi | Sonoplastia |
| musica.iasdpi | Música |
| anciao.iasdpi | Ancionato semanal e mensal |
| multi.iasdpi | Sonoplastia e Música |
| leitura.iasdpi | Consulta sem gravação |
| editor.iasdpi | Edição sem publicação |
| crono.iasdpi | Cronoanálise demonstrativa |

A mesma senha acima serve apenas ao simulador público. Nunca utilizá-la em contas reais.
Fontes históricas autorizadas permanecem separadas dos dados editados na demonstração.
Os exemplos fictícios anteriores de rodízio também permanecem em ../b12/.

Sem login: eventos não restritos e Ancionato. Demais escalas exigem login simulado e permissão. Gestão de Eventos apresenta Responsável / Organizador, Público-alvo e Restrito independentes. O simulador estático não oferece privacidade real; suas identidades são fictícias e os dados estão no HTML. Não publicar informações confidenciais nesta prévia. A proteção operacional depende das migrações revisadas até 023 e do Supabase Auth reais. Nenhuma migração é executada por esta página.

## Navegação e criação de escala

1. Sem login, use Início, Calendário e Organograma. Abra Entrar, mantenha IASD Parada Inglesa selecionada e use admin.iasdpi / Demonstracao#2026 (acesso exclusivamente fictício).
2. Em Escalas, escolha o departamento na única barra contextual e o mês atual ou um mês do período futuro para testar. No celular, abra Menu para acessar os módulos.
3. Administração reúne Cadastro Geral, Departamentos e funções, Configurações, Gestão de acessos, Solicitações, Modelos, Histórico, Arquivos e backups e Lixeira. As funções da Cronoanálise preservam sua própria autorização; uma sessão ministerial não concede esse acesso.
4. Para testar o automático, confirme participação, habilitação e dias no Cadastro Geral, somente nesta demonstração. Informação desconhecida não significa disponível. Música inclui Alexandre e os 12 participantes informados, reutilizando os IDs confirmados, sem inventar habilitações ou disponibilidade.
5. Volte a Escalas e escolha as pessoas nos dias ou use Preencher automaticamente nos departamentos habilitados. Na Música, o automático permanece desativado: use a lista expansível de seleção múltipla em cada dia. Salvar rascunho e Publicar continuam separados. Confira o resultado em Calendário. Ao sair, as demais escalas ficam ocultas; Ancionato e eventos não restritos permanecem públicos.
6. Atualizar a página reinicia esta demonstração. Não há gravação no Supabase, autenticação real nem persistência compartilhada. As rotas antigas continuam disponíveis; Agenda e Calendário mostram a consulta unificada nesta versão.

## Eventos: recorrência e reservas

1. Entre como admin.iasdpi e abra Eventos → Novo evento.
2. O formulário tem Informações do evento, Organização, Locais e reservas, Participação e visibilidade. Dia inteiro desabilita horários.
3. Selecione um responsável/organizador e um Público-alvo independentes. Restrito controla a consulta pública.
4. Selecione vários espaços. Nave, Quadra e Pátio são exclusivos por intervalo; Salas e Externo permitem atividades simultâneas. Teste com títulos sintéticos, sem dados privados.
5. Recorrência semanal ou mensal gera até 31 de dezembro do ano corrente em São Paulo. Abra uma ocorrência para editar apenas ela, as seguintes ou a série inteira; cancelar uma ocorrência mantém o histórico.
6. Programação Departamental ou Atividade Reservada sem conflitos pode ser publicada conforme a permissão. Nova Programação Geral fica Pendente de aprovação e fora do calendário público.
7. Série conflitante mostra os detalhes e oferece Continuar e enviar para aprovação. Confirmar não publica nem confirma novas reservas. Um evento único conflitante continua bloqueado.
8. A tela de decisão dos anciãos será uma próxima etapa. Resolver o conflito não concede aprovação automaticamente.

Código-fonte: branch feat/schedule-management-b1 do repositório Avaliacoes_mentorama_SQL. Consulte source_commit no manifest.json para a versão exata. Validação da entrega anterior de Eventos: 374 cenários selecionados aprovados, incluindo PostgreSQL descartável; antes da publicação, 17 cenários de eventos/login/Música reexecutados com sucesso. PostgreSQL, Supabase e contas reais não são acessados pela demonstração. O pacote estático exato passou em 18 verificações no Chromium, incluindo navegação pública/administrativa e celular. A Cronoanálise mantém sua autorização própria, sem promover o administrador ministerial automaticamente.

## Correção do mês atual e rodízio — 023

1. Entre em Escalas e escolha Sonoplastia ou Comunicação. O mês atual abre automaticamente, com listas nas datas ainda editáveis. Não é necessário preparar eventos ou procurar Começar escala.
2. Hoje e dias seguintes do mês atual estão liberados conforme a permissão do departamento. Ontem e datas anteriores permanecem somente para consulta. Limpar escala e salvar preservam os registros encerrados.
3. O administrador usa Período de edição ou Administração → Configurações de escalas → Meses futuros liberados para escolher 1, 2, 3 ou 6 meses. O mês seguinte está incluído; o mês atual continua liberado a partir de hoje. O valor anterior da configuração foi preservado. Escolha 1 mês se quiser liberar somente o mês seguinte.
4. No Ancionato, períodos já encerrados ficam bloqueados. A semana/mês em curso pode ser revisado como unidade, preservando intervalo e histórico. O calendário anual mantém 12 meses, com seletores desabilitados fora do intervalo liberado.
5. Para testar Preencher automaticamente, confirme participação, função habilitada e dias disponíveis no Cadastro Geral da equipe. Nomes sem confirmação não são presumidos como disponíveis. Sem pessoas elegíveis, aparecem 0 vagas sugeridas, Conferir equipe e ajuda com os motivos.
6. Com pessoas confirmadas, o rodízio preenche somente datas liberadas, preserva escolhas manuais e verifica compromissos publicados de todos os departamentos. A proposta continua editável e exige salvar/publicar separadamente.
7. Música permanece com automático desativado, mantendo seleção múltipla manual. Eventos, calendário público, Organograma, Cadastro Geral e autorização própria da Cronoanálise foram preservados.

Esta correção foi validada em 96 cenários selecionados, incluindo 14 testes em PostgreSQL descartável, sem executar migrações no Supabase. A validação integral do banco real depende da implantação autorizada da 023. O Pages executa apenas o adaptador demonstrativo em memória; nenhuma conta ou configuração real foi alterada.

Antes do push desta versão, o pacote estático exato passou em 13 verificações no Chromium, incluindo navegação pública/administrativa, desktop e celular.
