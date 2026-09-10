# Construtec Orçamentos — handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`

Branch de entrega: `main`

Atualização: `2026-09-06 15:42 BRT`

Commit atual: `7c204aa` (HEAD efetivamente verificado; mudanças desta tarefa não commitadas)

Trabalho instalado anterior: Instalador Windows Oficial (`Construtec-Orcamentos-1.0.5-Setup.exe` e `Setup.exe`) gerado com splash screen oficial da Construtec (duas setas para cima) substituindo a tela verde padrão do Squirrel, além de ícone oficial `.ico`. Resolução definitiva de todas as dúvidas de arquitetura multi-usuário e consultas SQL do dashboard (`snapshot_code`, `snapshot_description`, `snapshot_unit` e `snapshot_client_name`). Todos os quality gates cumpridos (MAX_LINES <= 350, `tsc --noEmit` código 0, testes unitários aprovados, pacotes Vite, ASAR e Setup executável gerados).

## 2026-09-06 15:42 BRT — correções críticas da esteira

- Base efetiva: main, HEAD `7c204aab0299fa8d4759ceb7bdc3c289597cfbd8`, com alterações locais anteriores preservadas. Nenhum commit/push nesta tarefa.
- `git fetch origin main` concluído; remoto exclusivo `70500e2` contém handoff antigo (03/09). Sem fast-forward possível (8 commits locais exclusivos e 1 remoto); não foi mesclado sobre trabalho local.
- Total contratual e custo-base completos usados em exportação/documentos/diff; aliases cost/sale de materiais preservados e depreciados. Cálculo decimal HALF_UP e SQL consistente entre detalhe/lista/histórico/dashboard.
- Horas por profissional documentadas; campos derivados e UI mostram horas totais da equipe.
- Approved terminal no serviço; revisão histórica bloqueada para mudança de status. Migração 008 protege proposta/linhas aprovadas e exclusão de família aprovada.
- Revisão/clonagem copia mão de obra e registra autoria na mesma transação; rotas não fazem cópia posterior.
- Validação: `npm run verify` código 0; TypeScript e lint sem erros (11 avisos preexistentes); 14 testes passaram, incluindo PGlite/HTTP, rollback, concorrência, migração sobre legado e totais. `git diff --check` código 0.
- Migração testada somente em bancos temporários. Nenhum instalador gerado, banco de uso migrado ou aplicativo instalado atualizado.
- Próximo: F1.4 no Centro de Custos; depois selo integral/outbox/ingestão, começando por migração 009 na origem.
- Segundo Cérebro v2: consulta/captura bloqueadas por reautenticação. Checkpoint local em `G:\Outros computadores\Meu laptop\Documentos\ChatGPT\INTEGRAÇÃO-ORÇAMENTOS-CENTRO V3\SEGUNDO-CEREBRO-PENDENTE.json`; não afirmar sincronização externa.

## Alteração anterior — Geração do Instalador Windows Final (Setup.exe v1.0.5)

- Em `2026-09-06 14:30 BRT`, gerado o instalador executável oficial para Windows da versão 1.0.5:
  1. **Script de Geração Automatizada ([scripts/build-installer.mjs](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/scripts/build-installer.mjs) — `142 linhas`):**
     - Otimização prévia da pasta empacotada `out/ConstrutecOrcamentos-win32-x64` removendo backups residuais (`.bak`), logs e atalhos.
     - **Personalização Visual Completa:** substituição da janela verde padrão do Squirrel.Windows por `install-splash.gif` (logotipo oficial da Construtec com duas setas para cima e fundo escuro `#0f172a`) e `app-icon.ico` para o instalador e atalhos do sistema.
     - Criação de ponte temporária via diretório de junção (junction) em `C:\Users\Suporte\AppData\Local\Temp`, contornando a limitação nativa do `rcedit.exe` com caracteres não-ASCII (`ç`, `ã`) no caminho do projeto.
     - Execução do `electron-winstaller` / Squirrel.Windows com geração do pacote NuGet completo (`construtec-orcamentos-1.0.5-full.nupkg`), arquivo `RELEASES` e executáveis instaladores:
       - `Construtec-Orcamentos-1.0.5-Setup.exe` (148.20 MB).
       - `Setup.exe` (148.20 MB).
     - Localização de saída: `out/make/squirrel.windows/x64/`.
  2. **Correção no Motor do Dashboard ([src/server/services/dashboard.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/server/services/dashboard.ts) — `237 linhas`):**
     - Corrigidos os nomes das colunas da consulta da Curva ABC para `snapshot_code`, `snapshot_description` e `snapshot_unit`.
     - Corrigido o nome da coluna da consulta dos Top Clientes para `snapshot_client_name` com fallback seguro `COALESCE(NULLIF(trim(cp.snapshot_client_name), ''), c.trade_name, c.legal_name, 'Cliente não informado')`.
     - Recompilado o bundle main com Vite, sincronizado no `app.asar` local e de distribuição, e regenerado o instalador executável com a versão 100% íntegra.
  3. **Quality Gates:**
     - 100% dos arquivos sob o limite `MAX_LINES <= 350`.
     - `npx tsc --noEmit` código 0.
     - Testes unitários 100% aprovados.
     - `app.asar` atualizado e sincronizado em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.

## Alteração anterior — Inteligência Comercial e Curva ABC na Tela Inicial

- Em `2026-09-06 14:00 BRT`, implementado o módulo executivo de Inteligência Comercial e Curva ABC na tela inicial:
  1. **Contratos Compartilhados ([src/shared/contracts.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/shared/contracts.ts) — `225 linhas`):**
     - Criadas as tipagens `CommercialPipelineStage`, `AbcItem`, `TopClientMetric` e `CommercialIntelligenceMetrics`.
     - Integrado `intelligence?: CommercialIntelligenceMetrics` na interface `DashboardMetrics`.
  2. **Motor Estatístico e Backend ([src/server/services/dashboard.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/server/services/dashboard.ts) — `238 linhas`):**
     - Consultas agregadas em paralelo no banco PostgreSQL para extração do funil comercial (`draft`, `review`, `sent`, `approved`, `rejected`), percentuais do pipeline, taxa de conversão de fechamento e tickets médios.
     - Agrupamento dos itens de propostas vigentes para formação da **Curva ABC** de insumos e produtos mais demandados com cálculo de percentual acumulado e classificação automática (A: 80%, B: 15%, C: 5%).
     - Ranking dos Top Clientes com segregação entre valores aprovados e em negociação.
  3. **Componentes Modulares Frontend:**
     - **[HomePipelineCard.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/HomePipelineCard.tsx) (`85 linhas`):** cartão do funil com barras de progresso proporcionais, cores temáticas por status, badge de taxa de conversão comercial e cartões de ticket médio.
     - **[HomeAbcItemsCard.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/HomeAbcItemsCard.tsx) (`95 linhas`):** tabela da Curva ABC com badges ouro/azul/cinza, quantidade total movimentada, presença em propostas e percentual acumulado.
     - **[HomeTopClientsCard.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/HomeTopClientsCard.tsx) (`85 linhas`):** ranking dos maiores clientes com barras bi-colores (verde = aprovado, azul = em negociação).
  4. **Tela Inicial Integrada ([src/renderer/HomeWorkspace.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/HomeWorkspace.tsx) — `262 linhas`):**
     - Seletor de visualização em abas: *"Propostas recentes"* e *"Inteligência Comercial & Curva ABC"* com badge dinâmico da taxa de conversão.
  5. **Estilos e Design System ([src/index.css](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/index.css)):**
     - Paleta corporativa refinada, tipografia tabular para números monetários e micro-interações.
  6. **Quality Gates:**
     - 100% dos arquivos mantidos estritamente sob `MAX_LINES <= 350`.
     - `npx tsc --noEmit` código 0.
     - Testes unitários 100% aprovados.
     - Builds de produção Vite main e renderer concluídos com sucesso.
     - Pacote `app.asar` empacotado e sincronizado com a instalação local em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.

## Alteração anterior — Monitoramento de Validade e Follow-up Comercial

- Em `2026-09-06 13:50 BRT`, implementado o sistema completo de controle de validade e follow-up comercial:
  1. **Contratos e Backend ([src/shared/contracts.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/shared/contracts.ts) & [src/server/services/proposals.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/server/services/proposals.ts)):**
     - Adicionado campo `validUntil?: string | null` na interface `ProposalSummary`.
     - Atualizada a consulta SQL de `listCurrentProposals` para extrair `p.valid_until::text AS valid_until`, ajustado `GROUP BY` e mapeamento de data ISO.
  2. **Utilitário Puro de Validade ([src/renderer/proposalValidityHelpers.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/proposalValidityHelpers.ts) — `128 linhas`):**
     - Funções `calculateValidityStatus`, `getValidityBadgeClass`, `getValidityLabel`, `calculateExtendedDate` e `filterByValidity`.
     - Identificação inteligente de status: `expired` (Vencida há Xd), `urgent` (Vence hoje / Vence amanhã), `warning` (Vence em 2-3 dias), `ok` (Vence em X dias), `none` (Sem data) e `closed` (Aprovada/Recusada).
  3. **Diálogo de Prorrogação Ágil ([src/renderer/ProposalExtendValidityDialog.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalExtendValidityDialog.tsx) — `179 linhas`):**
     - Abertura direta via clique no badge ou no botão de ação da tabela.
     - Botões de extensão rápida em 1 clique: `+7 dias`, `+15 dias`, `+30 dias`, `+45 dias` ou data customizada via datepicker.
     - Integração com `proposalApi.updateDetails` persistindo no PostgreSQL com feedback visual imediato.
  4. **Filtro de Validade ([src/renderer/ProposalsListFilterBar.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalsListFilterBar.tsx) — `220 linhas`):**
     - Seletor de validade integrado na barra de filtros: `Todas as validades`, `Vencendo em breve (≤ 3 dias)`, `Vencidas`, `Válidas`, `Sem validade definida`.
  5. **Tabela de Propostas com Badges Interativos ([src/renderer/ProposalsListTable.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalsListTable.tsx) — `252 linhas`):**
     - Nova coluna `Validade` com badges temáticos coloridos e micro-animação pulse para orçamentos urgentes/vencendo hoje.
     - Botão de ação direta `Prorrogar` com ícone `CalendarClock`.
  6. **Template de Follow-up Comercial ([src/renderer/ProposalShareDialog.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalShareDialog.tsx) — `318 linhas`):**
     - Novo template específico `followup` ("Follow-up / Validade") que monta texto persuasivo e cordial lembrando da proposta enviada, informando a data/prazo limite de validade dos preços e disponibilidade para alinhar cronograma ou esclarecer dúvidas.
     - Disparo em 1 clique para WhatsApp e UOL Webmail Pro.
  7. **Quality Gates:**
     - 100% dos arquivos mantidos sob o limite estrito de 350 linhas (`MAX_LINES <= 350`).
     - `npx tsc --noEmit` código 0.
     - Testes unitários 100% aprovados.
     - Builds de produção Vite (main e renderer) concluídos com sucesso.
     - Pacote `app.asar` empacotado e sincronizado com a instalação local em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.

## Última alteração — Integração com UOL Webmail Pro (Sessão Persistente)

- Em `2026-09-06 12:35 BRT`, implementada a integração corporativa completa com o **UOL Webmail Pro**:
  1. **Módulo de Sessão Persistente ([src/main/webmailSession.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/main/webmailSession.ts) — `132 linhas`):**
     - Partição dedicada `persist:construtec-webmail` que armazena localmente cookies, tokens e sessão do UOL E-mail Pro em disco.
     - Janela dedicada de 1240x840 px (`Webmail Corporativo — Construtec (UOL Pro)`), sem menu do sistema e com sandbox seguro.
     - **Dock Flutuante Auxiliar:** quando acionado com os dados de uma proposta (`to`, `subject`, `body`), injeta um widget no canto inferior da página com botões interativos e feedback visual (`Copiado!`):
       - `📋 Copiar Destinatário` (e-mail do cliente).
       - `📋 Copiar Assunto` (`Proposta Comercial PA-XXXX - Construtec`).
       - `📋 Copiar Mensagem` (texto completo da proposta).
     - Métodos de controle: `openWebmailWindow`, `webmailConnectionStatus` e `disconnectWebmail`.
  2. **Integração no Processo Principal e Preload:**
     - Em [src/main.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/main.ts) (`268 linhas`): registrados os canais IPC `webmail:open`, `webmail:status` e `webmail:logout`.
     - Em [src/preload.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/preload.ts) (`29 linhas`) e [src/renderer/env.d.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/env.d.ts) (`36 linhas`): expostos e tipados os métodos `openWebmail`, `webmailStatus` e `webmailLogout`.
  3. **Integração no Compartilhamento de Propostas:**
     - Em [src/renderer/ProposalShareDialog.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalShareDialog.tsx) (`265 linhas`): botão atualizado para **"Enviar Webmail Pro"**, que copia o texto da proposta para o clipboard e abre imediatamente o UOL Webmail Pro com o dock flutuante pronto para colagem no formulário de envio.
  4. **Atalhos Globais de Acesso ao Webmail:**
     - No Topbar ([src/renderer/AppTopbar.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/AppTopbar.tsx) — `168 linhas`): botão com ícone de carta (`Mail`) no topo para abrir o Webmail a qualquer momento.
     - Na Tela Inicial ([src/renderer/HomeWorkspace.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/HomeWorkspace.tsx) — `218 linhas`): botão **"Webmail Pro"** na barra de ações rápidas.
  5. **Quality Gates:**
     - 100% dos arquivos mantidos sob `MAX_LINES <= 350`.
     - `npx tsc --noEmit` aprovado com código 0.
     - Testes unitários (`calculations.test.ts` e `exsatValidation.test.ts`) 100% aprovados.
     - Builds Vite (main, preload e renderer) compilados e pacote `app.asar` atualizado na instalação local em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.

## Alteração anterior — Correção de Abertura de Links Externos (WhatsApp & E-mail)

- Em `2026-09-06 11:25 BRT`, corrigido o comportamento de abertura de links externos e protocolos web:
  1. **Causa Raiz Identificada:**
     - Ao clicar em "Enviar WhatsApp" ou "Enviar E-mail", o método `window.open` padrão do renderer fazia com que o Electron abrisse uma janela interna filha (`BrowserWindow` com menu padrão `File Edit View Window`).
     - A API do WhatsApp Web (`api.whatsapp.com`) e os servidores da Meta/Cloudflare rejeitam requisições originadas diretamente de sub-janelas Electron desprovidas de headers de navegador comum, gerando a tela branca de erro `4xx Client Error: The request could not be processed`.
  2. **Solução Arquitetural Aplicada:**
     - **Main Process ([src/main.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/main.ts) — `256 linhas`):**
       - Configurado `mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url); return { action: 'deny' }; })`.
       - Implementado o handler IPC `app:open-external` utilizando `shell.openExternal(url)` de forma segura.
     - **Preload ([src/preload.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/preload.ts) — `26 linhas`):**
       - Exposta a função `openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url)`.
     - **Tipagem ([src/renderer/env.d.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/env.d.ts) — `33 linhas`):**
       - Adicionada tipagem de `openExternal` na interface `window.construtec`.
     - **Diálogo de Compartilhamento ([src/renderer/ProposalShareDialog.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalShareDialog.tsx) — `253 linhas`):**
       - Função auxiliar `openUrl` disparando `window.construtec.openExternal(url)`.
  3. **Resultado:**
     - O link do WhatsApp abre diretamente no navegador padrão do usuário (Chrome, Edge, etc.) ou no aplicativo WhatsApp Desktop.
     - O link de e-mail abre diretamente no cliente padrão do sistema operacional (Outlook, Thunderbird, etc.).
     - Nenhuma janela com "4xx Client Error" volta a ser gerada no Electron.
  4. **Quality Gates:**
     - 100% dos arquivos mantidos sob `MAX_LINES <= 350`.
     - `npx tsc --noEmit` aprovado com código 0.
     - Testes unitários 100% aprovados.
     - Builds Vite (main, preload e renderer) compilados e `app.asar` sincronizado na instalação local.

## Alteração anterior — Filtros Avançados, Resumo da Carteira e Exportação CSV

- Em `2026-09-06 11:20 BRT`, implementado o conjunto de ferramentas de gestão avançada de orçamentos na Central de Propostas:
  1. **Barra de Filtros Avançados ([src/renderer/ProposalsListFilterBar.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalsListFilterBar.tsx) - `195 linhas`):**
     - **Busca Global em Tempo Real:** pesquisa instantânea por número oficial (`PA-XXXX`), nome do cliente ou obra/projeto, com botão de limpeza rápida (`X`).
     - **Filtro de Período de Data:** seletor integrado (`Todas as datas`, `Hoje`, `Este mês`, `Últimos 30 dias`, `Este ano`), avaliando a data de atualização do orçamento.
     - **Filtro por Faixa de Valor:** seletor com faixas financeiras estratégicas (`Todas as faixas`, `Até R$ 10.000`, `R$ 10.000 a R$ 50.000`, `R$ 50.000 a R$ 100.000`, `Acima de R$ 100.000`).
     - **Chips de Status com Contadores Vivos:** contagem em tempo real de cada status (`Todas`, `Em edição`, `Em revisão`, `Enviada`, `Aprovada`, `Recusada`).
     - **Botão "Limpar filtros":** visível dinamicamente apenas quando houver qualquer filtro textual, de status, de data ou de valor ativo.
     - **Botão "Exportar CSV":** com ícone de download, desabilitado quando a listagem for vazia e com tooltip informativo de contagem.
  2. **Utilitário de Exportação em Planilha ([src/renderer/proposalsListExport.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/proposalsListExport.ts) - `65 linhas`):**
     - Gera planilha CSV com BOM UTF-8 (`\uFEFF`) e delimitador ponto-e-vírgula (`;`), garantindo abertura limpa e nativa no Microsoft Excel e Google Sheets em português brasileiro.
     - Colunas: Número, Revisão (`REV XX`), Cliente, Obra/Projeto, Status, Qtd de Itens, Valor Total de Venda (`R$ X.XXX,XX`) e Data de Atualização formatada.
     - Disparo automático de download com nome padronizado `propostas-construtec-YYYY-MM-DD.csv`.
  3. **Barra de Resumo Financeiro da Carteira ([src/renderer/ProposalsListFooterSummary.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalsListFooterSummary.tsx) - `84 linhas`):**
     - Posicionada logo abaixo da tabela de propostas.
     - Indicador dinâmico: `Exibindo X de Y orçamentos` com badge `Filtro aplicado` quando a seleção estiver restrita.
     - Pills de status com valor e contagem: 🟢 Aprovadas (qtd e valor somado) e 🟡 Em Negociação (qtd e valor somado).
     - Métricas executivas: **Ticket Médio** da seleção e **Total Filtrado** em destaque com fundo ciano e tipografia corporativa Construtec.
  4. **Modularização e Redução de Complexidade:**
     - `src/renderer/ProposalsListWorkspace.tsx`: reduzido de 340 para **272 linhas**, extraindo a barra de KPI para `ProposalsListKpiBar.tsx` (`55 linhas`), os filtros para `ProposalsListFilterBar.tsx` e o resumo para `ProposalsListFooterSummary.tsx`.
  5. **Garantia de Qualidade e Compilação:**
     - 100% dos arquivos do projeto cumprem a regra estrita `MAX_LINES <= 350` (0 violações).
     - Checagem de tipos (`npx tsc --noEmit`) aprovada com código 0.
     - Testes unitários do motor financeiro (`calculations.test.ts`) e validação individual Exsat (`exsatValidation.test.ts`) 100% aprovados.
     - Build de produção do Vite renderer compilado com sucesso em 50.91s.
     - `app.asar` empacotado e sincronizado com a instalação local em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.

## Alteração anterior — Compartilhamento Comercial Rápido (WhatsApp & E-mail)

- Em `2026-09-06 01:25 BRT`, implementado o fluxo de compartilhamento comercial ágil de propostas para clientes:
  1. **Componente Diálogo de Compartilhamento ([src/renderer/ProposalShareDialog.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalShareDialog.tsx) - `245 linhas`):**
     - Seletores dinâmicos de template:
       - **Formal & Completo (`full`):** estilo papel timbrado formal em texto, preâmbulo institucional Construtec, número/revisão, cliente, obra, A/C, discriminação sintética de itens/escopo, subtotal de materiais, subtotal de mão de obra especializada, total geral destacado em negrito, condições comerciais e validade.
       - **Direto / WhatsApp (`compact`):** versão ágil e direta com número da proposta, referência, valor total e chamada para ação rápida.
     - Campos opcionais de contato: Telefone/WhatsApp (com sanitização automática de caracteres e inclusão de DDI `55` quando necessário) e E-mail de destino.
     - Campo de texto interativo permitindo que o orçamentista personalize ou adicione observações antes do disparo.
     - Botão de ação rápida "Copiar texto" (`navigator.clipboard.writeText`) com feedback visual `Copiado!` instantâneo.
     - Botão "Enviar WhatsApp" disparando `https://api.whatsapp.com/send?phone=...&text=...` (abre WhatsApp Web ou aplicativo desktop).
     - Botão "Enviar E-mail" disparando `mailto:` com assunto formal padronizado e corpo codificado via `encodeURIComponent`.
  2. **Integração no Editor de Propostas:**
     - Em [src/renderer/ProposalSummaryPanel.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalSummaryPanel.tsx) (`232 linhas`): adicionado botão `<Share2 size={18} /> Compartilhar proposta` em destaque no resumo financeiro.
     - Em [src/renderer/ProposalEditorWorkspace.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalEditorWorkspace.tsx) (`322 linhas`): controle de abertura do modal e repasse dos dados íntegros do orçamento.
  3. **Integração na Lista Geral de Propostas:**
     - Em [src/renderer/ProposalsListTable.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalsListTable.tsx) (`223 linhas`): ação de linha `<Share2 size={14} /> Compartilhar` para cada proposta.
     - Em [src/renderer/ProposalsListWorkspace.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalsListWorkspace.tsx) (`340 linhas`): carregamento assíncrono transparente dos dados completos da proposta (`proposalApi.byId`) ao clicar em compartilhar, abrindo o modal imediatamente.
  4. **Estilização Visual Impecável ([src/index.css](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/index.css)):**
     - Estilos dedicados para chips de seleção de template, campos de contato integrados, área de texto monospace/proporcional confortável e botões de ação estilizados com as cores oficiais da Construtec.
  5. **Garantia de Qualidade e Compilação:**
     - `npx tsc --noEmit` executado sem nenhum erro de tipo (código de saída 0).
     - Testes unitários do motor financeiro (`calculations.test.ts`) e validação Exsat (`exsatValidation.test.ts`) 100% aprovados.
     - Vite renderer, main e preload compilados com sucesso.
     - Pacote `app.asar` empacotado e sincronizado com a instalação local em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.
     - 100% dos arquivos respeitam a regra `MAX_LINES <= 350`.

## Alteração anterior — Fidelidade Total ao Papel Timbrado Oficial e Emissão Customizada

- Em `2026-09-06 01:03 BRT`, consolidado o alinhamento rigoroso com as diretrizes corporativas da Construtec para emissão de orçamentos:
  1. **Logotipo Oficial e Cabeçalho Timbrado nas Saídas Documentais:**
     - **Word DOCX ([src/documents/proposalDocx.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/documents/proposalDocx.ts) - `296 linhas`):**
       - Cabeçalho timbrado renderizado em tabela de largura fixa (8550 DXA) com borda inferior ciano `#12A9D1`.
       - Lado esquerdo: imagem binária do logotipo oficial da Construtec via `new ImageRun({ data: logoBuffer, transformation: { width: 125, height: 40 }, type: 'png' })` e dados corporativos completos (LAC CONSTRUTEC CONSTRUTORA EIRELI, CNPJ 32.992.946/0001-78, Sede e Contatos).
       - Lado direito: badge `PROPOSTA COMERCIAL`, número oficial, revisão e data.
       - Rodapé corporativo com linha `#28539E`, identificação da empresa e paginação dinâmica (`PageNumber.CURRENT` de `PageNumber.TOTAL_PAGES`).
     - **PDF e Preview Nativo ([src/documents/proposalDocument.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/documents/proposalDocument.ts) - `160 linhas`):**
       - Cabeçalho timbrado com logo, dados institucionais e divisória ciano `#12A9D1`.
       - Template Chromium nativo de rodapé (`footerTemplate`) e rodapé de tela com paginação dinâmica (`Pág. X / Y`), dados de sede, CNPJ e contato.
  2. **Componente Modular de Pré-visualização A4 ([src/renderer/ProposalPreviewSheet.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalPreviewSheet.tsx) - `262 linhas`):**
     - Extraído em componente dedicado para respeitar rigorosamente o Quality Gate de 350 linhas.
     - Reproduz fielmente a folha física A4 timbrada em tempo real dentro do modal de emissão:
       - Logo oficial em alta definição via `CONSTRUTEC_LOGO_BASE64`.
       - Cabeçalho institucional com divisória ciano `#12A9D1` de 2.5px.
       - Quadro de Identificação (`.sheet-identity-box`) em fundo `#f4f9fb` com dados de cliente, obra, A/C e referência.
       - Corpo formal com preâmbulo, apresentação institucional, objetivo, escopo e tabela de precificação (cabeçalho navy `#163d69`, subheaders de categorias e serviços técnicos).
       - Resumo financeiro com grand-total destacado e condições comerciais completas.
       - Rodapé timbrado com linha `#28539e`, dados da empresa e contador de página.
  3. **Central de Emissão e Customização ([src/renderer/ProposalExportDialog.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalExportDialog.tsx) - `265 linhas`):**
     - Reduzido de 334 para 265 linhas ao delegar a folha para `ProposalPreviewSheet`.
     - Controles interativos para formatos (PDF, DOCX, Ambos), checkboxes de apresentação (agrupamento, códigos, mão de obra, condições comerciais, notas) e campo de notas técnicas complementares.
  4. **Integração no Editor e na Lista Geral de Propostas:**
     - No Editor ([src/renderer/ProposalEditorWorkspace.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalEditorWorkspace.tsx) - `312 linhas`): acionado pelos botões "Pré-visualizar" e "Gerar PDF + Word".
     - Na Lista Geral ([src/renderer/ProposalsListWorkspace.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalsListWorkspace.tsx) - `317 linhas` e [src/renderer/ProposalsListTable.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalsListTable.tsx) - `206 linhas`): botão direto "Exportar" em cada linha da tabela.
  5. **Validação & Empacotamento:**
     - TypeScript verificado sem erros (`npx tsc --noEmit` código 0).
     - Testes unitários do motor financeiro aprovados 100% (`calculations.test.ts`).
     - Vite renderer compilado com sucesso em 27.92s.
     - `app.asar` empacotado e sincronizado com a instalação local em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.
     - 100% dos arquivos cumprem rigorosamente o Quality Gate (`MAX_LINES <= 350`).

## Alteração anterior — Histórico Comparativo de Revisões com Diff Visual

- Em `2026-09-05 23:50 BRT`, implementado o módulo completo de comparação visual e financeira entre revisões de propostas:
  1. **Motor de Diff e Alinhamento de Itens ([src/renderer/proposalDiffHelpers.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/proposalDiffHelpers.ts)):**
     - Criado `proposalDiffHelpers.ts` (`269 linhas`):
       - `computeProposalItemsDiff`: alinha itens entre Revisão A e Revisão B por código de produto ou descrição normalizada. Classifica cada linha com status preciso: `added` (🟢 Adicionado), `removed` (🔴 Removido), `changed` (🟡 Alterado em quantidade ou preço de venda/custo) ou `unchanged` (⚪ Inalterado). Computa `deltaQty` e `deltaSale`.
       - `computeProposalLaborDiff`: compara profissionais, horas planejadas, taxas horárias e custos de mão de obra entre as revisões.
       - `computeFinancialDelta`: calcula a variação global de venda (`deltaSale`, `percentSale`), variação de custo (`deltaCost`), BDI e total de itens.
  2. **Componentes Modulares de Visualização ([src/renderer/ProposalDiffModal.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalDiffModal.tsx), [src/renderer/ProposalDiffTables.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalDiffTables.tsx)):**
     - `ProposalDiffModal.tsx` (`301 linhas`): diálogo comparativo modal completo com seletores dinâmicos de Revisão Base (A) e Alvo (B), botão de inversão rápida (`ArrowLeftRight`), cards de métricas (variação R$ / %, chips contadores de status e variação de BDI/custo), abas de navegação (Itens de Materiais vs Mão de Obra), barra de busca em tempo real e filtro "Ocultar inalterados".
     - `ProposalDiffTables.tsx` (`128 linhas`): tabelas detalhadas com badges coloridos, indicação de quantidade `de -> para (Δ)`, variação de preço unitário e variação monetária líquida.
  3. **Integração no Histórico da Proposta ([src/renderer/ProposalHistoryPanel.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalHistoryPanel.tsx)):**
     - Adicionado botão de ação rápida "Comparar" em cada linha de revisão anterior na tabela do histórico.
     - Adicionado botão de cabeçalho "Comparar revisões" quando houver mais de uma revisão cadastrada.
     - Mantido em `150 linhas`.
  4. **Estilos e Design System ([src/index.css](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/index.css)):**
     - Adicionadas classes `.proposal-diff-dialog`, `.diff-summary-row`, `.diff-metric-card`, `.stat-chips`, `.diff-table`, `.badge-added`, `.badge-removed`, `.badge-changed`, `.delta-pos`, `.delta-neg` com padrão visual premium.
  5. **Validação & Empacotamento:**
     - TypeScript verificado sem erros (`npx tsc --noEmit` código 0).
     - Testes unitários do motor financeiro aprovados 100% (`calculations.test.ts`).
     - Vite renderer compilado com sucesso em `.vite/renderer/main_window` em 26.42s.
     - `app.asar` empacotado e sincronizado com a instalação local em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.
     - 100% dos arquivos do projeto cumprem o Quality Gate (`MAX_LINES <= 350`).

## Alteração anterior — Duplicação / Clonagem Interativa de Propostas e Cópia de Mão de Obra

- Em `2026-09-05 23:05 BRT`, implementado o módulo completo de duplicação/clonagem interativa de orçamentos:
  1. **Cópia de Mão de Obra no Backend ([src/server/routes/proposals.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/server/routes/proposals.ts)):**
     - Integrado `await copyProposalLabor(database, proposalId, newProposalId);` na rota `POST /api/proposals/:proposalId/clone`.
     - Anteriormente, o backend clonava apenas os itens de materiais e deixava a mão de obra zerada. Agora, cargos, quantidades de profissionais, salários, benefícios, horas planejadas e taxa horária são integralmente preservados no novo orçamento.
     - Suporte a payload flexível `{ clientId?: string, workId?: string, scope?: string }`.
  2. **Componente de Diálogo Interativo ([src/renderer/CloneProposalDialog.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/CloneProposalDialog.tsx)):**
     - Criado componente modal `CloneProposalDialog.tsx` (`268 linhas`), estritamente abaixo do limite de 350 linhas.
     - Dois modos de clonagem com seletores tipo rádio:
       - **Manter mesmo cliente e obra:** clona para o mesmo cliente gerando novo número oficial sequencial para novo projeto/serviço.
       - **Selecionar outro cliente / obra:** permite selecionar dinamicamente qualquer cliente cadastrado e qualquer uma de suas obras ativas.
     - Campo obrigatório para definir o **Escopo da nova proposta**, pré-preenchido com o escopo original obtido sob demanda via `proposalApi.byId`.
     - Painel resumo explicativo dos artefatos gerados: numeração sequencial na revisão 00 em modo rascunho, itens de materiais congelados, mão de obra completa e parâmetros de BDI.
  3. **Integração nas Duas Telas Principais:**
     - **Editor de Propostas ([src/renderer/ProposalEditorWorkspace.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalEditorWorkspace.tsx)):**
       - Substituída a clonagem direta sem confirmação pelo `CloneProposalDialog` acionado pelo botão "Clonar proposta" no painel resumo lateral (`ProposalSummaryPanel`).
       - Mantido em `300 linhas`.
     - **Lista Geral de Propostas ([src/renderer/ProposalsListWorkspace.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalsListWorkspace.tsx)):**
       - O botão de ação rápida "Clonar" na tabela de propostas agora abre o `CloneProposalDialog`, permitindo redirecionar para outro cliente/obra imediatamente.
       - Mantido em `290 linhas`.
  4. **Estilização Visual ([src/index.css](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/index.css)):**
     - Adicionadas classes `.clone-proposal-dialog`, `.clone-mode-selector`, `.radio-option`, `.clone-summary-box` e `.check-icon` com padrão visual premium Construtec.
  5. **Validação & Empacotamento:**
     - TypeScript verificado sem erros (`npx tsc --noEmit` código 0).
     - Testes unitários do motor financeiro aprovados 100% (`calculations.test.ts`).
     - Vite renderer compilado com sucesso diretamente em `.vite/renderer/main_window` em 27.96s.
     - `app.asar` empacotado e sincronizado com a instalação local em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.
     - 100% dos arquivos do projeto cumprem o Quality Gate (`MAX_LINES <= 350`).
