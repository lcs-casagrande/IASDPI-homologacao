# IASDPI — Homologação integrada G11

[Portal integrado](../integrada/) · [Versão G11](../g11/) · [Demonstrações anteriores](../)

Ambiente estático de homologação. **Autenticação simulada; alterações temporárias em memória, reiniciadas ao recarregar.** Não inserir dados privados. Não há conexão ao Supabase, envio de e-mails, contas reais ou migrações executadas.

## Como testar

1. Consulte Calendário e Organograma sem login.
2. Entre com `admin.iasdpi` e senha **exclusivamente fictícia** `Demonstracao#2026`.
3. Em Administração → Usuários e Acessos, pesquise pessoas, confira responsáveis sem conta, vincule uma identidade existente ou crie uma identidade simulada para uma pessoa central. A senha provisória individual fica oculta inicialmente e só aparece após concluir a simulação; não há concessão automática de permissões.
4. Configure ministérios e permissões individualmente, suspenda/revogue e confira Administração → Auditoria. A edição dos dados pessoais permanece no Cadastro Geral.
5. Eventos departamentais podem ser publicados diretamente por seu líder autorizado. Eventos gerais enviados por líderes aguardam administrador ou ancião explicitamente autorizado; aprove/publice ou rejeite, preservando o histórico.
6. Em Escalas, selecione departamento e mês. Salvar rascunho e Publicar são separados. Música mantém seleção múltipla manual e automático desativado. O rodízio dos demais departamentos exige participação, habilitação e disponibilidade confirmadas.
7. Confira o calendário publicado na mesma aba. Rascunhos e eventos restritos não aparecem na consulta pública. A política atual mantém demais escalas sob login e Ancionato público.

| Identificador fictício | Perfil |
| --- | --- |
| admin.iasdpi | Administrador |
| som.iasdpi | Líder de Sonoplastia |
| musica.iasdpi | Líder de Música |
| anciao.iasdpi | Ancionato e aprovação geral autorizada |
| multi.iasdpi | Vários ministérios |
| leitura.iasdpi | Consulta sem edição |
| editor.iasdpi | Edição sem publicação |
| crono.iasdpi | Cronoanálise demonstrativa |

As identidades iniciais usam a senha fictícia acima somente no simulador público. Novas identidades simuladas recebem senha provisória única e devem alterá-la no primeiro acesso. Nunca usar essas credenciais em contas reais.

O HTML contém os dados autorizados da prévia e o simulador; ocultação de telas não oferece confidencialidade neste artefato público. Cronoanálise mantém autorização própria. Históricos, nomes/IDs centrais e demonstrações anteriores foram preservados.

## Validação e ativação futura

**127 testes selecionados aprovados:** 39 PostgreSQL descartável, 8 fluxos visuais G11, 41 testes de pacote/navegação/regressão e 39 testes de Auth/Edge/credenciais. A suíte histórica completa não foi reexecutada. Chromium local em desktop/celular; Auth real, SMTP e aparelhos físicos ainda exigem homologação controlada.

Migração 027 preparada após 005–026, sem aplicação no Supabase. Backup recuperável, autorização de implantação, configuração Auth/Edge/domínio institucional e testes reais continuam pendentes. Nenhuma conta, permissão, configuração ou banco real foi alterado.

Código, matriz de permissões e relatório: [branch de desenvolvimento](https://github.com/lcs-casagrande/Avaliacoes_mentorama_SQL/tree/feat/schedule-management-b1), `docs/governance-g11.md`. Versão exata e hashes dos arquivos neste diretório: `manifest.json`.
