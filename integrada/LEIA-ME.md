# IASDPI — Homologação integrada

Portal, Agenda, Organograma, Cadastro Geral, Escalas e acessos demonstrativos.
E1: Gestão de Eventos e Calendário Unificado. Abra Gestão de Eventos após entrar. A Agenda oficial é reutilizada; importar exige revisão administrativa e cria rascunho.

As alterações ficam em memória e reiniciam ao recarregar. Não inserir dados privados.
Não há conexão com Supabase, envio de e-mails ou contas reais.

1. Consulte Agenda, Organograma e Calendário sem login.
2. Abra Montar escala e escolha IASD_PI.
3. Entre com uma identidade fictícia abaixo. Senha fictícia: `Demonstracao#2026`.
4. Para testar o rodízio no Cadastro Geral integrado, confirme explicitamente
   a participação, habilitação e dias de uma pessoa de teste. Informação pendente
   não significa disponível. Responsabilidade ministerial não concede habilitação.
5. Salve rascunho; publique separadamente e confira o Calendário na mesma aba.
6. Confira Cadastro Geral e Gestão de Acessos com o administrador fictício.

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

## Testar criação de escala com o administrador

1. Abra Montar escala, escolha IASD_PI e entre com admin.iasdpi / Demonstracao#2026 (acesso exclusivamente fictício).
2. Em Meus departamentos, escolha Sonoplastia e um mês futuro para testar.
3. Para testar o preenchimento automático, abra Cadastro Geral, selecione Sonoplastia, confirme a participação e a função de uma pessoa de teste e marque os dias confirmados somente nesta demonstração. Sem confirmação, o rodízio mantém as vagas pendentes.
4. Volte a Montar escala, use Preencher automaticamente ou escolha as pessoas nos dias. Salvar rascunho e Publicar são ações separadas.
5. Confira o resultado no Calendário enquanto estiver logado. Após Sair, escalas de Sonoplastia deixam de aparecer; Ancionato e eventos não restritos permanecem públicos.
6. Atualizar a página reinicia esta demonstração. As ações não gravam no Supabase e não validam a autenticação real.
