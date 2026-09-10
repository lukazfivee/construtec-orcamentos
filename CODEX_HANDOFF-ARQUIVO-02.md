## Alteração anterior — Importação Direta de Itens na Proposta (Planilha CSV/Excel, Outra Proposta e Kits)

- Em `2026-09-05 22:45 BRT`, implementado o módulo completo de importação de itens diretamente no painel de itens da proposta aberta:
  1. **Serviço de Importação em Lote no Backend ([src/server/services/proposalImport.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/server/services/proposalImport.ts)):**
     - Criado `proposalImport.ts` (`208 linhas`):
       - `importProposalItemsBatch`: valida status editável (`draft`), calcula próxima posição sequencial na proposta, consulta códigos informados no catálogo local para congelar dados técnicos/custos ou cadastra itens avulsos com o BDI da proposta, gerando eventos de auditoria.
       - `copyItemsFromProposal`: clona itens de uma proposta de origem para a proposta destino com suas descrições e custos unitários congelados, recalculando preços com base no multiplicador BDI da proposta ativa.
  2. **Rotas e API ([src/server/routes/proposals.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/server/routes/proposals.ts), [src/renderer/api.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/api.ts)):**
     - Registrados os endpoints `POST /api/proposals/:proposalId/items/import-batch` e `POST /api/proposals/:proposalId/items/copy-from-proposal` protegidos por schemas Zod.
     - Métodos correspondentes `proposalApi.importBatch` e `proposalApi.copyFromProposal` adicionados ao cliente de API do renderer.
  3. **Interface do Usuário com 3 Abas ([src/renderer/ProposalImportDialog.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalImportDialog.tsx)):**
     - Botão "Importar" habilitado na barra de ferramentas de [src/renderer/ProposalItemsPanel.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalItemsPanel.tsx) (`318 linhas`).
     - Modularização arquitetural em submódulos para cumprimento estrito do limite de 350 linhas:
       - [src/renderer/ProposalImportPasteTab.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalImportPasteTab.tsx) (`171 linhas`): colagem direta do Excel/Sheets (`Ctrl+V`), upload de arquivo `.csv`, parsing inteligente por delimitador (tab, ponto e vírgula ou vírgula), totalizadores em tempo real e tabela de prévia de até 50 itens.
       - [src/renderer/ProposalImportProposalTab.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalImportProposalTab.tsx) (`98 linhas`): seletor de propostas existentes com checklist e botão "Selecionar todos" / "Desmarcar todos" para cópia cirúrgica de itens.
       - Aba "De um Kit": seletor de kits cadastrados com aplicação imediata de itens com preço congelado.
     - Diálogo principal `ProposalImportDialog.tsx` mantido em `272 linhas`.
  4. **Validação & Empacotamento:**
     - TypeScript validado sem erros (`npx tsc --noEmit` código 0).
     - Testes unitários do motor financeiro aprovados 100% (`calculations.test.ts`).
     - Vite renderer compilado com sucesso diretamente em `.vite/renderer/main_window`.
     - `app.asar` empacotado e sincronizado com a instalação local em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.
     - Todos os arquivos mantidos rigorosamente dentro do Quality Gate (`MAX_LINES <= 350`).

## Alteração anterior — Modernização da Topbar, Central de Ajuda, Notificações e Perfil Autenticado

- Em `2026-09-05 22:30 BRT`, implementados os módulos funcionais da barra superior do sistema:
  1. **Desacoplamento e Refatoração da Topbar (`AppTopbar.tsx`, `App.tsx`):**
     - O cabeçalho foi desacoplado de `App.tsx` para o novo componente modular [src/renderer/AppTopbar.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/AppTopbar.tsx) (155 linhas), reduzindo `App.tsx` de 337 para 314 linhas, garantindo ampla margem para o Quality Gate de 350 linhas.
     - `App.tsx` agora recebe props `user?: AuthUser | null` e `onLogout?: () => void`, eliminando a necessidade de sobreposições visuais externas.
  2. **Integração Nativa do Perfil do Usuário Autenticado (`UserProfilePopover.tsx`, `AuthGate.tsx`, `auth.css`):**
     - Removida a sobreposição flutuante legada `.auth-session-chip` e o hack CSS `body:has(.auth-session-chip) .top-actions .profile { visibility: hidden; }`.
     - O botão `.profile` da barra superior agora exibe dinamicamente as iniciais, o nome e o perfil do usuário logado (`AuthUser`).
     - Criado o componente [src/renderer/UserProfilePopover.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/UserProfilePopover.tsx) (98 linhas): menu suspenso elegante exibindo avatar, nome completo, e-mail, badge de cargo (`Administrador`, `Comercial` ou `Consulta`), status da sessão local ("Lembrar de Mim ativo - 30 dias" ou "Sessão temporária - 8 horas"), indicação de armazenamento protegido no PGlite e botão "Sair da conta" com encerramento de sessão e redirecionamento limpo para o login.
  3. **Central de Ajuda & Diretrizes (`HelpModal.tsx`, `index.css`):**
     - Criado o componente [src/renderer/HelpModal.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/HelpModal.tsx) (243 linhas), acessível via botão `HelpCircle` na barra superior.
     - Dividido em 4 abas interativas:
       - *Atalhos de Teclado*: `Ctrl+K` (busca catálogo), `Ctrl+I` (inserir item), `Ctrl+S` (nova revisão), `Ctrl+P` (visualizar proposta), `Ctrl+G` (exportar PDF/Word) e `Esc` (fechar janelas).
       - *Metodologia de Cálculo*: fórmulas e regras de composição do BDI, cálculo de taxa horária de mão de obra (salário + encargos ÷ 220h) e precisão de centavos em `pt-BR`.
       - *Sigilo & Imutabilidade*: detalhamento da proteção contra vazamento de custos internos para clientes e congelamento imutável de snapshots de propostas.
       - *Sobre o Sistema*: identificação da Construtec, arquitetura 100% offline-first e PGlite.
  4. **Central de Notificações Operacionais (`NotificationsPopover.tsx`, `index.css`):**
     - Criado o componente [src/renderer/NotificationsPopover.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/NotificationsPopover.tsx) (120 linhas), acionado pelo botão de sino (`Bell`).
     - O botão de sino exibe um badge ciano indicador quando há divergências ativas de custos no catálogo para a proposta aberta.
     - Exibe cards categorizados: alertas de divergência de preços com opção de dispensar, status da proposta ativa (número, revisão, rascunho/aprovada/emitida) e integridade operacional do banco local PGlite.
  5. **Validação e Empacotamento:**
     - TypeScript verificado sem erros (`npx tsc --noEmit` código 0).
     - Testes unitários do motor financeiro aprovados 100% (`calculations.test.ts`).
     - Vite renderer compilado com sucesso diretamente em `.vite/renderer/main_window`.
     - `app.asar` empacotado e sincronizado com a instalação local em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.
     - Todos os arquivos mantidos rigorosamente dentro do Quality Gate (`MAX_LINES <= 350`).

## Alteração anterior — Função "Lembrar de Mim", Otimização de Colunas e Blindagem de Layout

- Em `2026-09-05 22:20 BRT`, implementada a arquitetura completa de persistência de acesso, distribuição fluida de colunas e blindagem de layout contra quebras de grade:
  1. **Função "Lembrar meu acesso neste computador" (`AuthGate.tsx`, `auth.css`, `services/auth.ts`, `routes/auth.ts`):**
     - Adicionada opção de checkbox no Login e no Cadastro / Primeiro Acesso com ativação padrão para ambiente desktop.
     - Emissão de JWT com validade estendida de **30 dias** (`REMEMBERED_TTL_SECONDS = 30 * 24 * 60 * 60`) quando a opção estiver marcada, contra 8 horas padrão.
     - Persistência em `localStorage`: reconexão e autenticação automática imediata ao abrir o software sem exigir credenciais. Ao deslogar expressamente com "Sair", os tokens são removidos mas o e-mail permanece preenchido no input para facilitar o próximo acesso.
  2. **Otimização da Distribuição das Colunas da Tabela (`ProposalItemsPanel.tsx`, `ProposalItemsTableRow.tsx`, `index.css`):**
     - Extraído hook [src/renderer/useProposalItemActions.ts](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/useProposalItemActions.ts) (172 linhas) isolando manipulações de lista (adicionar, remover, ordenar, duplicar, atualizar textos/números), mantendo `ProposalItemsPanel.tsx` (300 linhas) estritamente abaixo do limite de 350 linhas.
     - Substituição de regras rígidas baseadas em `nth-child` por classes semânticas fixas (`.col-select`, `.col-index`, `.col-code`, `.col-description`, `.col-quantity`, `.col-unit`, `.col-cost`, `.col-total-cost`, `.col-sale`, `.col-total-sale`).
     - A coluna `.col-description` agora utiliza `width: auto; min-width: 260px;` e inputs internos com `width: 100%`, expandindo fluidamente para preencher todo o espaço disponível sem truncar textos longos.
     - Células do rodapé `tfoot` alinhadas 1-para-1 com o cabeçalho, garantindo que o contador de itens e os totais monetários permaneçam alinhados sob suas respectivas colunas independentemente da visibilidade de colunas opcionais.
  3. **Blindagem Arquitetural de Layout contra Quebras de Grade (`index.css`, `ProposalLaborPanel.css`):**
     - Descoberta e correção da causa raiz do espaçamento vertical e quebra de grid: `.proposal-editor` utilizava grade CSS antiga e rígida de 5 linhas (`grid-template-rows: 100px 39px 52px minmax(0, 1fr) 48px`), e `ProposalItemsPanel` retornava um Fragment `<> ... </>`. Ao ativar a barra de filtros, esta caía na linha 4 (`minmax(0, 1fr)`), ocupando toda a altura da tela e empurrando a tabela para o rodapé de 48px.
     - Encapsulamento: `ProposalItemsPanel` agora possui container raiz próprio (`<div className="proposal-items-panel">`).
     - O container principal `.proposal-editor` foi convertido em flexbox vertical (`display: flex; flex-direction: column; overflow: hidden;`).
     - Todos os painéis (`.proposal-items-panel`, `.labor-panel`, `.proposal-kits-panel`, `.history-region`) agora assumem `flex: 1 1 0; min-height: 0; overflow: hidden;`, eliminando regras legadas `grid-row: 3 / -1` e impedindo que alertas, modais ou filtros quebrem o layout em qualquer seção.
     - Script `pack-asar.mjs` atualizado para sincronizar automaticamente o `app.asar` recém-gerado tanto na pasta `out` quanto na instalação local do usuário em `%LOCALAPPDATA%/ConstrutecOrcamentos/app-1.0.2/resources/app.asar`.

- Em `2026-09-05 19:34 BRT`, removida a trava condicional `(setup || requiresSetup)` em `src/renderer/AuthGate.tsx`. O botão **"Configurar primeiro acesso / Cadastro"** agora aparece permanentemente na tela de login, permitindo alternar livremente para a tela de cadastro e de volta para o login com **"Voltar para o login"**.
- Em `2026-09-05 19:48 BRT`, adicionados o logo oficial da Construtec incorporado em base64 (`src/assets/logoBase64.ts`), o cabeçalho timbrado oficial (com identificação da LAC Construtec Construtora Eireli, CNPJ, contato, badge institucional da proposta e divisória ciano `#12A9D1`), e o rodapé completo (com dados corporativos, CNPJ, contato institucional e paginação dinâmica) nos documentos de proposta (`src/documents/proposalPresentation.ts`, `src/documents/proposalDocument.ts`, `src/main.ts`).
- Em `2026-09-05 20:00 BRT`, removido o rodapé verde informativo do banco de dados ("Banco de dados local-first (PGlite) ativo e operacional") da tela Inicial (`HomeWorkspace.tsx`). O card "Propostas recentes" foi ampliado com altura flexível (`min-height: 420px`), tipografia aprimorada (números, títulos e badges maiores e mais nítidos), botões "Abrir" destacados e grid de métricas ajustado para 4 colunas em telas de laptops e desktops (`@media max-width: 1080px`), liberando mais de 150px de altura útil para visualização clara e completa da tabela.
- Em `2026-09-05 20:06 BRT`, corrigido o problema de opções e botões de exclusão ocultos/cortados à direita nas tabelas de itens de kits e tabelas de importação:
  - Em [src/renderer/KitItemsTable.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/KitItemsTable.tsx), substituído `overflow: hidden` por `overflow-x: auto`, implementado `table-layout: fixed` com colgroup balanceado, e fixada a coluna de "Ação" com `position: sticky; right: 0;` e botão de exclusão com destaque visual em vermelho (`kit-item-remove-btn`). A opção de excluir agora permanece permanentemente visível e acessível mesmo com descrições longas ou telas compactas.
  - Em `src/index.css`, a coluna de exclusão do diálogo de importação também recebeu `position: sticky; right: 0;` garantindo que nenhuma ação fique escondida.
- Em `2026-09-05 21:35 BRT`, adicionado o logotipo oficial da Construtec na tela de Login e na tela de Cadastro / Primeiro Acesso (`src/renderer/AuthGate.tsx` e `src/auth.css`):
  - Inserida a seção de marca (`.auth-card-brand`) no topo do card com o logo institucional Construtec de alta resolução renderizado com nitidez em fundo branco.
  - Tela de carregamento/inicialização (`mode === 'checking'`) aprimorada com o logo da Construtec acima do indicador giratório para um efeito de splash corporativo refinado.
- Em `2026-09-05 21:45 BRT`, implementados o **Filtro de Itens** e a **Configuração de Colunas** na tabela de itens da proposta:
  - Criado o componente [src/renderer/ProposalColumnsPopover.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalColumnsPopover.tsx) para personalização de colunas visíveis (`code`, `unit`, `unitCost`, `totalCost`, `unitSale`, `totalSale`) com presets rápidos "Visão Completa" e "Visão Comercial" (oculta custos internos com 1 clique para apresentação ao cliente) e persistência no `localStorage`.
  - Criado o componente [src/renderer/ProposalItemsFilterBar.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalItemsFilterBar.tsx) com busca em tempo real por código ou descrição, filtro por categoria, contador dinâmico de itens e atalho para limpar filtros.
  - Atualizados [src/renderer/ProposalItemsTableRow.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalItemsTableRow.tsx) e [src/renderer/ProposalItemsPanel.tsx](file:///g:/Outros%20computadores/Meu%20laptop/Documentos/ChatGPT/Construtec%20or%C3%A7amentos/construtec-orcamentos/src/renderer/ProposalItemsPanel.tsx) para respeitar as colunas visíveis tanto no cabeçalho `<thead>`, nas linhas `<tbody>` e no rodapé `<tfoot>`, com estado vazio quando o filtro não encontra itens.
  - Estilos responsivos adicionados em `src/index.css`.
  - Todos os arquivos mantidos rigorosamente abaixo do limite de 350 linhas: `ProposalItemsPanel.tsx` (346 linhas), `ProposalItemsTableRow.tsx` (164 linhas), `ProposalColumnsPopover.tsx` (145 linhas), `ProposalItemsFilterBar.tsx` (92 linhas).
  - Validação completa: TypeScript aprovado (`tsc --noEmit`), Vite client compilado em 26s e `app.asar` empacotado com sucesso em `out/ConstrutecOrcamentos-win32-x64/resources/app.asar`.

## Retomada

1. Leia `AGENTS.md`.
2. Rode `git status --short --branch`; preserve mudanças locais.
3. Atualize `main` somente por fast-forward de `origin/main`.
4. Leia este arquivo e siga `Próximo passo`.

Arquitetura detalhada está em `PRODUCT.md`, `README.md` e, para mudanças substanciais, `.cursor/rules/ai-architecture.mdc`.

## Estado atual

- App Electron local-first com React, TypeScript, API Express local e PGlite.
- PWA Instalável (Mobile & Desktop Web): `manifest.webmanifest`, ícones oficiais e Service Worker (`public/sw.js`) ativos para instalação na tela de início no Safari iOS e Chrome Android; meta tags `apple-mobile-web-app-capable`, status bar translúcida e CSP adaptada.
- Desacoplado para Web/Mobile: `src/renderer/api.ts` conta com fallback automático para navegadores móveis/desktop sem Electron (Safari iOS / Chrome Android); `src/server/createApp.ts` aceita origens de rede privada (`192.168.*`, `10.*`, `localhost`) e autentica via `X-Construtec-Session`; `src/index.css` inclui adaptação fluida para smartphones (`@media max-width: 768px`).
- Propostas, revisões, catálogo, clientes, obras, kits, mão de obra, BDI, autenticação/RBAC, auditoria, backup/restauração e PDF/Word estão implementados.
- PDF/Word mostram somente valores comerciais finais; nunca custos-base, salários, BDI detalhado ou margem.
- Snapshots e revisões históricas permanecem imutáveis após atualização de catálogo.
- Alerta visual inteligente de divergência de custos: propostas em `draft`/`review` detectam alterações no custo de produtos ativos do catálogo, exibem banner informativo e badge `▲/▼` ao lado do custo do item permitindo reajuste em 1 clique; propostas emitidas e aprovadas nunca são alteradas nem exibem avisos.
- PR #72 integrada em `7623bdc`: auditoria visual geral.
- PR #73 integrada em `9f03029`: arredondamento de resumos.
- PR #74 integrada em `e2330cb`: regras/contexto e skill `agent-md-refactor`.
- PR #76 integrada em `a4ed059`: skill `prompt-master`.
- PR #75 integrada e harmonizada: layout do modal Exsat com `.exsat-overview`, sincronização, histórico e modo avançado em `<details>`, badges de status estilizados e thead fixo.
- PR #77 integrada em `a617076`: diagnóstico estruturado Exsat.
- PR #78 integrada em `0dccb60`: preserva a URL solicitada da Exsat após `fetch`, evitando `Invalid URL`.
- PR #79 integrada em `13dd47b`: decodifica a resposta Exsat pelo charset declarado, com fallback UTF-8, evitando texto corrompido nas descrições.
- Trabalho local pós-`13dd47b`: adiciona logos oficiais PNG em `src/assets`, troca tokens para petróleo/ciano Construtec, aplica logo no topo do app e aproxima PDF/Word do modelo real de proposta.
- Validação individual automática Exsat implementada:
  - Cada item da varredura em lote/automática tem o código consultado individualmente na Exsat (`/produtos/pesquisa/?busca={codigo}`) via sessão autenticada (`persist:construtec-exsat`).
  - Leitura estrita do preço principal atual exibido (`.price-current`), ignorando parcelamentos e fretes.
  - Normalização monetária cuidada (`1550,53` equivale a `1.550,53`).
  - Classificação na prévia em: **Confirmado** (disponível e preço atual verificado), **Divergente** (preço atual diferente da listagem), **Indisponível** (esgotado/sem preço) ou **Erro** (falha de rede/resposta).
  - Confirmação em lote bloqueada para itens não confirmados: apenas itens `Confirmado` entram no catálogo.
  - Exportação de planilha CSV mantida para auditoria completa do lote.
  - Concorrência limitada (3 requisições simultâneas) e notificação de progresso em tempo real no diálogo.

## Exsat — estado atual pós-validação individual

### Sequential Thinking MCP (Raciocínio Sequencial para Agentes & IAs)

- **Servidor MCP integrado:** `@modelcontextprotocol/server-sequential-thinking` v0.6.2 configurado e validado via stdio JSON-RPC.
- **Configurações no Workspace:**
  - `.agents/mcp_config.json`: configuração padrão para Antigravity IDE, Claude Code e ferramentas MCP baseadas em `.agents`.
  - `.cursor/mcp.json`: configuração para Cursor IDE.
  - `.agents/skills/sequential-thinking/SKILL.md`: skill com schema completo, parâmetros e exemplos práticos.
- **Como utilizar (passo a passo para agentes e IAs):**
  1. **Quando ativar (Gatilho Automático Obrigatório):** Bug persistente (usuário pediu para corrigir mais de 1 vez ou tentativa anterior falhou), tarefas de alta complexidade ou refatorações críticas (`calculations.ts`, IPC Electron, SQLite). Nesses casos, o agente **DEVE** acionar o `sequentialthinking` antes de mexer no código.
  2. **Chamada via MCP Tool (`sequentialthinking`):**
     - Parâmetros obrigatórios: `thought` (string), `thoughtNumber` (int >= 1), `totalThoughts` (int estimado), `nextThoughtNeeded` (boolean).
     - Parâmetros opcionais para ajustes dinâmicos: `isRevision` (boolean) e `revisesThought` (int) para corrigir premissas incorretas; `branchFromThought` (int) e `branchId` (string) para testar caminhos alternativos; `needsMoreThoughts` (boolean) se o escopo expandir.
  3. **Execução sem cliente MCP (Standalone / CI / Scripts):**
     - O servidor roda via stdio JSON-RPC usando `cmd.exe /c npx -y @modelcontextprotocol/server-sequential-thinking` (ou runner JSON-RPC conforme testado em `scratch/test-mcp-sequential.mjs`).
  4. **Critério de parada:** Ao atingir a solução correta e minimalista (`ponytail`), emitir o último pensamento com `nextThoughtNeeded: false` e proceder com a alteração no código mantendo `MAX_LINES <= 350`.

## Validação real de preços — 2026-09-04

- A sessão Exsat autenticada funcionou no Electron/Chrome local. A conferência foi feita pela página de pesquisa individual de cada código, usando somente o preço principal exibido — nunca parcelas.
- Dos **500 itens** do CSV gerado pela prévia Exsat: **250** estavam com preço idêntico, **17** tinham preço atual diferente e **233** estavam **indisponíveis** (sem preço atual verificável). Portanto, não tratar esse CSV como cotação atual e não confirmar os 500 em massa.
- Divergências confirmadas (`CSV -> Exsat`):
  - `4564068` R$ 299,99 -> R$ 576,16
  - `4750220` R$ 229,90 -> R$ 338,24
  - `4660353` R$ 449,99 -> R$ 544,26
  - `4666100` R$ 199,99 -> R$ 256,89
  - `7899658705138` R$ 59,00 -> R$ 65,00
  - `4580645` R$ 411,01 -> R$ 456,68
  - `4540047` R$ 59,21 -> R$ 84,59
  - `4541035` R$ 295,52 -> R$ 422,17
  - `4580776` R$ 799,99 -> R$ 832,71
  - `4560047` R$ 249,99 -> R$ 339,91
  - `4780221` R$ 184,14 -> R$ 216,64
  - `4710029` R$ 15,12 -> R$ 18,91
  - `4780060` R$ 2,49 -> R$ 3,11
  - `4780215` R$ 11,99 -> R$ 12,47
  - `4780211` R$ 12,99 -> R$ 16,49
  - `4780213` R$ 16,99 -> R$ 19,11
  - `4830147` R$ 15,64 -> R$ 21,40
- A diferença decorre de catálogo/estoque dinâmico: a listagem estruturada pode apresentar valores históricos para produto indisponível. A leitura da página individual autenticada é a fonte operacional do preço atual.
- O CSV foi validado estruturalmente: 500 linhas, cabeçalhos compatíveis, 0 campos obrigatórios vazios, 0 preços inválidos, 0 preços não positivos e 0 códigos duplicados. Ele serve como arquivo de auditoria/manual, não como preço atual sem nova validação.

O diagnóstico mostrou 23 falhas `EXSAT_UNKNOWN / Invalid URL` em endereços Exsat válidos. A causa é o uso de `Response.url` de `session.fetch()`, documentado pelo Electron como incorreto. Usar a URL solicitada corrigiu a varredura real:

```text
500 linhas encontradas
272 para importar
6 páginas lidas
0 páginas com falha
32 duplicados consolidados
```

O limite de 500 itens encerrou a varredura após 6 páginas, como previsto. O problema histórico de texto corrompido (`Cmera`) foi corrigido e as descrições atuais foram conferidas com acentuação preservada.

Depois da PR #79, `responseHtml()` lê o corpo da resposta com `arrayBuffer()`, identifica `charset=` no `content-type` e decodifica com `TextDecoder`, usando UTF-8 quando o charset não vem declarado.

## Branch atual — main

- `responseHtml()` usa a URL validada solicitada como `finalUrl`.
- `responseHtml()` decodifica a resposta Exsat pelo charset declarado para preservar acentos nas descrições.
- Parser Exsat prioriza o catálogo estruturado da página para obter o valor total; limites de varredura e dados salvos foram preservados.
- Validação individual automática implementada em `exsatFetcher.ts`, `exsatSession.ts`, `contracts.ts`, `preload.ts` e `CatalogImportDialog.tsx`.
- Layout completo da PR #75 integrado e aprimorado em `CatalogImportDialog.tsx` e `index.css`.
- Testes unitários da validação criados em `src/main/exsatValidation.test.ts`.
- Testes unitários do motor financeiro e imutabilidade de snapshots criados em `src/server/services/calculations.test.ts`.
- Detecção e indicador de divergência de custos em propostas rascunho em `src/server/services/proposals.ts`, `src/renderer/ProposalItemsTableRow.tsx`, `src/renderer/ProposalItemsPanel.tsx` e `src/index.css`.
- Desacoplamento para Web/Safari/Android em `src/renderer/api.ts`, `src/server/createApp.ts`, `src/renderer/App.tsx` e `src/index.css`.
- Integração do MCP Sequential Thinking em `.agents/mcp_config.json`, `.cursor/mcp.json` e skill `.agents/skills/sequential-thinking/SKILL.md`.

## Validação

- Em `2026-09-05`, foi investigada a demora para abrir o app após `npm run dev`: logs de carregamento mostraram leituras lentas de dependências CommonJS no disco G:. `vite.main.config.mjs` agora agrupa as dependências SSR, mantendo `electron` externo. Build aprovado (571 módulos); janela `Construtec Orçamentos` aberta com o novo build em perfil temporário, sem desativar a GPU. A hipótese inicial de GPU foi descartada e a alteração experimental no launcher foi retirada. O app com o perfil original também abriu e foi mantido aberto; a janela temporária foi fechada. Base `7c204aa`, demais alterações locais preservadas. `git diff --check` aprovado; `npm run verify`: TypeScript aprovado; lint interrompido após mais de 15 minutos sem conclusão. Validação completa pendente.
- Em `2026-09-05`, o usuário confirmou que o teste funcional ponta a ponta da varredura Exsat em sessão autenticada está OK, incluindo o fluxo com o novo layout e os status (`Confirmado`, `Divergente`, `Indisponível`, `Erro`). Pendência encerrada com base nessa confirmação; o agente não repetiu o teste nesta atualização documental. Base local: `7c204aa`, com alterações locais preservadas.
- Validação local em `2026-09-04`: `git diff --check` aprovado sem erros.
- `tsc -p tsconfig.json --noEmit`: compilação completa do TypeScript aprovada sem erros (código 0).
- Testes unitários em `src/main/exsatValidation.test.ts`: conferência de itens confirmados, divergentes, indisponíveis, não encontrados e normalização monetária (`1550,53` vs `1.550,53`) aprovados.
- Testes unitários em `src/server/services/calculations.test.ts`: validação de mão de obra (custo mensal, taxa horária, custo total, validação de horas inválidas), cálculos de proposta (materiais, mão de obra, baseCost, BDI, acréscimos, margem percentual, proteção contra valor zero, precisão monetária) e imutabilidade de snapshots de itens de propostas aprovados.
- Quality Gates de tamanho (MAX_LINES=350) 100% cumpridos:
  - `src/shared/contracts.ts`: 177 linhas
  - `src/main/exsatFetcher.ts`: 309 linhas
  - `src/main/exsatSession.ts`: 290 linhas
  - `src/preload.ts`: 25 linhas
  - `src/renderer/CatalogImportDialog.tsx`: 256 linhas
  - `src/renderer/ProposalItemsPanel.tsx`: 308 linhas
  - `src/renderer/ProposalItemsTableRow.tsx`: 158 linhas
  - `src/renderer/catalogImportHelpers.ts`: 241 linhas
  - `src/renderer/env.d.ts`: 32 linhas
  - `src/main/exsatValidation.test.ts`: 83 linhas
  - `src/server/services/calculations.test.ts`: 135 linhas
  - `src/server/services/proposals.ts`: 327 linhas
  - `src/renderer/api.ts`: 246 linhas
  - `src/server/createApp.ts`: 168 linhas
  - `src/renderer/App.tsx`: 337 linhas
  - `src/renderer.tsx`: 53 linhas
  - Total de arquivos com mais de 350 linhas: **0** (zero).
- PDF atualizado em `2026-09-04` para seguir a estrutura da proposta real fornecida: cabeçalho, identificação, apresentação, objetivo, escopo, precificação e condições comerciais. O arquivo de referência foi apenas lido, nunca alterado; a exportação Word existente não foi modificada.
- Geração HTML da proposta verificada com dados de amostra: todas as seções do modelo estão presentes e não há `Custo`, `Salário`, `Margem` ou `BDI` no documento do cliente.
- `npm run dev` compila `main` e `preload` em modo SSR, inicia Vite e abre o Electron disponível na pasta pai. Assim, o teste local usa as alterações completas, inclusive do servidor local.
- Em `2026-09-04`, o Electron iniciou pelo novo atalho e o preflight de `http://127.0.0.1:5173` para `/api/auth/login` retornou `204` com `Access-Control-Allow-Origin`, métodos e cabeçalhos esperados.
- Login fim a fim confirmado no Electron em `2026-09-04`, usando o renderer em `http://127.0.0.1:5173`, sem ocorrência de `Failed to fetch`. Credenciais não foram registradas.
- Importação por lote validada em memória: total + parcela, ordem de colunas diferente, líquido + total e texto Exsat com pagamento parcelado. Em todos os casos, o custo resultante foi o valor total do item.
- A prévia de importação oferece **Exportar planilha**: gera CSV UTF-8 com os mesmos cabeçalhos aceitos pela aba Planilha, incluindo `Valor total`. O arquivo pode ser corrigido no Excel e reimportado sem adaptação.
- PRs #73, #74 e #76: checks completos aprovados e integradas.
- PR #77: `npm run verify`, `git diff --check` e checks do GitHub aprovados; publicação ignorada porque não é release.
- PR #78: `npm run verify`, `git diff --check` e teste funcional real aprovados.
- PR #79: CI do GitHub aprovado antes do merge; validação local e sessão Exsat real concluídas neste checkout.
- Stash `codex-preserve-before-ui-ff-20260902` mantido como cópia de segurança.

## Próximo passo

1. Reexecutar `npm run verify`: TypeScript passou em 2026-09-05, mas o lint foi interrompido após mais de 15 minutos sem conclusão. Build e abertura da janela com dependências agrupadas foram validados; não considerar o verify completo aprovado.
2. Empacotamento de distribuição para Windows (`Construtec-Orcamentos-Setup.exe`), quando solicitado ou necessário para teste instalado.

## Bloqueios

- O Electron Forge não inicia este checkout por falta de `electron` em `construtec-orcamentos/node_modules`; `npm run dev` contorna isso compilando com Vite SSR e usando o runtime existente na pasta pai.
- Commit normal não cria release versionada.
- `[release]` somente quando precisar publicar `build-N` e `Construtec-Orcamentos-Setup.exe`.
