# IASDPI — Usuários e Acessos institucionais (G12)

[Homologação integrada](../integrada/) · [Cópia desta versão](../g12-acessos/) · [G12 anterior](../g12/) · [G11](../g11/) · [Demonstrações anteriores](../)

**Autenticação simulada. Dados temporários em memória da aba; recarregar reinicia as alterações.** Nenhuma conexão com Supabase, conta real, envio de e-mail ou migração executada. Não digite credenciais ou dados privados reais.

## Testar

1. Entre com **admin** / **Demonstracao#2026**, exclusivamente fictícios. IASD Parada Inglesa vem selecionada.
2. Abra Administração → Usuários e Acessos: tabela única de logins institucionais, departamentos e cargos do Organograma. Responsável vem do Cadastro Geral; pesquisa não cadastra nomes. Selecione departamentos autorizados e salve a linha.
3. Sonoplastia e qualquer outro departamento podem receber vários escopos. Cada login permanece fixo; a mesma pessoa em várias linhas mantém uma identidade individual. Administração e aprovação geral exigem confirmações próprias.
4. Troque um responsável, confirme e salve. Use Redefinir senha, após confirmar a identidade. Copie o link temporário e saia. **Nesta simulação, abra o link na mesma aba, sem recarregar nem abrir outra aba**; a fila está só nessa memória. Defina uma senha fictícia nova e entre pelo login institucional. No sistema real, o link depende do Supabase Auth e poderá ser entregue ao responsável após autorização.
5. Entre como **membro** / **Demonstracao#2026** para consultar somente escalas publicadas autorizadas e eventos abertos. Não tem edição, Cadastro Geral, rascunhos, eventos restritos ou ferramentas administrativas. A identidade compartilhada é diferente da identidade pessoal do custodiante.
6. Use Departamentos, abaixo da tabela, para criar, arquivar ou reativar. As opções são compartilhadas com Cadastro Geral, Organograma, Eventos e Escalas; arquivar preserva históricos e IDs.
7. Administração → Auditoria registra as ações. Eventos departamentais publicam diretamente; eventos gerais solicitados por líderes aguardam administrador/ancião autorizado. Escalas mantêm salvar/publicar separados, conflitos e rodízio existentes. Música mantém seleção múltipla manual.

Contas fictícias anteriores continuam disponíveis para compatibilidade: `admin.iasdpi`, `som.iasdpi`, `musica.iasdpi`, `anciao.iasdpi`. Os aliases institucionais correspondentes são `admin`, `sonoplastia`, `musica` e `anciao_7` nesta prévia. Credencial inicial somente demonstrativa: `Demonstracao#2026`. Após trocar responsável, use o fluxo de redefinição; o alias não reutiliza a credencial da pessoa anterior. Não há autenticação ou persistência compartilhada real no GitHub Pages.

## Validação e implantação

**139 testes selecionados aprovados:** 15 jornadas na prévia exata, 8 contratos de arquivos, 63 Node e 53 de regressão G11/G12/Cronoanálise/navegação/isolamento. Chromium local em 360, 390, 768, 1024 e 1440 px. Reexecuções não somadas; a suíte histórica completa não foi reexecutada.

028 está apenas preparada no código-fonte: nenhuma migração executada, inclusive em PostgreSQL local nesta rodada. Parser da sintaxe externa e contratos não comprovam execução PL/pgSQL, RLS ou concorrência. Ensaio de banco, backup recuperável, revisão de permissões legadas, instalação autorizada, Auth/Edge, leitor exclusivo e contas individuais reais permanecem pendentes. O site oficial permanece intacto.

Código e matriz: branch `feat/schedule-management-b1` do [repositório de desenvolvimento](https://github.com/lcs-casagrande/Avaliacoes_mentorama_SQL/tree/feat/schedule-management-b1), `docs/governance-g12-institutional.md`. Versão exata e hashes: `manifest.json`.
