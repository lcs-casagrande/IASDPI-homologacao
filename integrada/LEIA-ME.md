# IASDPI — Homologação integrada

Portal, Agenda, Organograma, Cadastro Geral, Escalas e acessos demonstrativos.
E1: Gestão de Eventos e Calendário Unificado. Abra Gestão de Eventos após entrar. A Agenda oficial é reutilizada; importar exige revisão administrativa e cria rascunho.

As alterações ficam em memória e reiniciam ao recarregar. Não inserir dados privados.
Não há conexão com Supabase, envio de e-mails ou contas reais.

1. Consulte Calendário e Organograma sem login.
2. Abra Entrar e escolha IASD_PI.
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

Sem login: eventos não restritos e Ancionato. Demais escalas exigem login simulado e permissão. Gestão de Eventos separa classificação, organizador, público-alvo e Restrito. O simulador estático não oferece privacidade real; suas identidades são fictícias e os dados estão no HTML. Não publicar informações confidenciais nesta prévia. A proteção operacional depende da migração 021 e do Supabase Auth reais.

## Navegação e criação de escala

1. Sem login, use Início, Calendário e Organograma. Abra Entrar, escolha IASD_PI e use admin.iasdpi / Demonstracao#2026 (acesso exclusivamente fictício).
2. Em Escalas, escolha o departamento na única barra contextual e um mês futuro para testar. No celular, abra Menu para acessar os módulos.
3. Administração reúne Cadastro Geral, Departamentos e funções, Configurações, Gestão de acessos, Solicitações, Modelos, Histórico, Arquivos e backups e Lixeira. As funções da Cronoanálise preservam sua própria autorização; uma sessão ministerial não concede esse acesso.
4. Para testar o automático, confirme participação, habilitação e dias no Cadastro Geral, somente nesta demonstração. Informação desconhecida não significa disponível. Música inclui Alexandre e os 12 participantes informados, reutilizando os IDs confirmados, sem inventar habilitações ou disponibilidade.
5. Volte a Escalas e escolha as pessoas nos dias ou use Preencher automaticamente. Salvar rascunho e Publicar continuam separados. Confira o resultado em Calendário. Ao sair, as demais escalas ficam ocultas; Ancionato e eventos não restritos permanecem públicos.
6. Atualizar a página reinicia esta demonstração. Não há gravação no Supabase, autenticação real nem persistência compartilhada. As rotas antigas continuam disponíveis; Agenda e Calendário mostram a consulta unificada nesta versão.
