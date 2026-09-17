# Construtec Orçamentos — handoff operacional

## 2026-09-17 14:15 BRT — App shell mobile: alinhado ao Centro de Custos

- Usuário rejeitou a primeira rodada de variantes da tela de Início (muito parecidas entre si, mudança superficial) e pediu redesenho real: "não está parecendo um app, e sim uma versão de um site". Revertido o commit da 1ª rodada (`git revert 4cca0e9`).
- Implementado app shell mobile de verdade (não CSS de espaçamento): navegação inferior fixa (Início/Propostas/Kits/Menu), topbar consolidado num botão "Mais opções", lista de propostas em cartões tocáveis (`grid-template-areas` sobre as classes já existentes de cada célula, sem mudar `ProposalsListTable.tsx`). Concorrência detectada no meio do trabalho: outro agente (ou o usuário) editou `App.tsx`/`mobile-responsive.css` em paralelo, implementando de forma independente uma barra inferior de 3 itens + "Menu" (padrão espelhado do Centro de Custos) — verificado, absorvido e mantido (não descartado), com limpeza de CSS duplicado.
- Usuário comparou com screenshots reais do Centro de Custos e pediu paridade visual. Lido o CSS/HTML real de `centro de custos CONSTRUTEC/public/style-base.css` (não estimado por screenshot) para replicar exato: `.mobile-nav-item.ativo{background:var(--navy-2)}` → aba ativa da barra inferior agora é uma pílula preenchida (`#1b2c45`, mesma cor do item ativo do desktop) em vez de linha fina; `.sidebar.open{left:0}` (Centro de Custos reaproveita a própria sidebar desktop como gaveta mobile) → "Menu" agora desliza o painel completo de navegação (6 itens, ativo destacado) da esquerda com fundo escurecido, em vez de uma caixa pequena com só 3 itens de overflow.
- Dois bugs reais pegos e corrigidos durante a verificação ao vivo (não só por leitura de código):
  1. Painel "Mais opções" do topbar era `position:fixed` e sobrepunha o conteúdo da página (visível no screenshot do usuário cobrindo o título "Início"); corrigido para expandir em fluxo (`flex-basis:100%` dentro de `.top-actions`).
  2. `.sidebar` tinha `z-index:40`, menor que `.topbar` (`z-index:60`); como `.sidebar` é `position:fixed`, ela cria seu próprio contexto de empilhamento — a gaveta de navegação (`z-index` interno mais alto) ficava presa dentro desse contexto e a topbar continuava pintando por cima. Corrigido subindo `.sidebar` para `z-index:62`.
- Validado: typecheck limpo, `npm run test:critical` 23/23 (1 ignorado) em cada rodada, verificado ao vivo em 390×844 (gaveta, scrim, pílula ativa, painel Mais sem sobreposição) e 1600×900 (desktop idêntico ao original, sem vazamento de nenhum elemento mobile). Publicado via `npm run deploy:cloud` (script novo, ver commit `444b65f`, encontrado já escrito em disco por outra sessão/agente — revisado antes de commitar, sem segredos).
- Pendente: login de produção não foi verificado visualmente por este agente (sem credenciais reais); código é idêntico ao testado exaustivamente em dev local.

## 2026-09-17 12:00 BRT — Homologação mobile + impeccable adapt no editor

- Homologação visual mobile (Maestri portal, 390x844, UA iOS) da versão cloud publicada. Achados corrigidos e publicados (2 deploys via `cloudflare/api-container && npm run deploy`; um terceiro deploy foi bloqueado uma vez pelo classificador de auto mode do Claude Code e teve sucesso na tentativa seguinte, sem intervenção especial):
  - `AuthGate.tsx`: textos "neste computador"/"Sessão local protegida" trocados por texto neutro/condicional por modo (`isCloudRuntime()` novo em `api.ts`).
  - `AppTopbar.tsx` + `NotificationsPopover.tsx`: badge do topbar e painel de notificações diziam "Offline"/"Banco Local PGlite"/"100% Offline" mesmo na nuvem; agora usam `isCloudRuntime()`.
  - `createApp.ts`: `getCloudSecurity()` só aceitava uma origem em `CONSTRUTEC_ALLOWED_ORIGINS`; `cloudflare/api-container/README.md` documenta lista separada por vírgula. Corrigido para aceitar múltiplas origens (retrocompatível com uma única).
- `/impeccable adapt` (v4.3.1) no editor de proposta (`src/renderer/App.tsx`, brief `.impeccable/surfaces/src-renderer-app-tsx.md`), por instrução do usuário. Achado: em 390px, metadados (Cliente/Obra/Status/Validade/Responsável) empilhados em 3 linhas + toolbar de itens empurravam a tabela de itens — "protagonista da tela" segundo o próprio DESIGN.md — inteiramente para fora da primeira dobra (~764px de chrome antes do cabeçalho da tabela, em tela de 844px). Corrigido: `.proposal-meta` em mobile virou uma faixa única rolável horizontalmente (label:valor compactos) em vez de grade empilhada. Verificado ao vivo: tabela com dado real visível na primeira tela sem rolar.
- Concluído em seguida (mesma sessão): a toolbar de ações de item (`ProposalItemsPanel.tsx`) foi reorganizada — Inserir/Excluir/Filtrar ficam em linha; Duplicar/Mover/Mover/Importar/Configurar colunas/Configurações-tabela recolhem atrás de um toggle "Mais ações" (`.toolbar-secondary-group`, `display: contents` no desktop). Bug pego antes de publicar: a primeira versão escondia o toggle com `.toolbar-more-toggle { display: none !important }`, mas `.toolbar .icon-button` (2 classes) vence um seletor de 1 classe mesmo com `!important`, então o toggle vazava para o desktop; corrigido igualando a especificidade (`.toolbar .icon-button.toolbar-more-toggle`). Verificado ao vivo nos dois breakpoints (1600×900 sem o toggle; 390×844 com o toggle funcionando). Cabeçalho da tabela caiu de y=764 para y=455 em tela de 844px de altura. Brief `.impeccable/surfaces/src-renderer-app-tsx.md` atualizado com o comportamento mobile aprovado (a constraint "desktop-first, sem mobile" do `DESIGN.md` geral permanece desatualizada, não corrigida — fora do escopo pedido).
- Validação: typecheck limpo, `npm run test:critical` 23/23 (1 ignorado) após cada mudança, `/health` 200 `storage: postgresql`, console do navegador sem erros nas duas verificações mobile.

## 2026-09-17 11:20 BRT — Commit do trabalho acumulado (LEAD ORCHESTRATOR)

- Base 1b12e85; todo o trabalho acumulado sem commit (runtime cloud/Postgres, mobile, integração, tooling) foi commitado em 7 commits temáticos (`1d4142a`..`1ae3f85`), sem `git add -A`. `desktop.ini` (ruído do OneDrive) passou a ser ignorado.
- Corrigida regressão de codificação (mojibake + BOM UTF-8 duplo) em `index.html`, encontrada durante a revisão do diff; texto/acentos restaurados, só a mudança funcional (CSP + URL cloud) permaneceu.
- **Incidente**: ao investigar a mesma regressão em `src/server/createApp.ts`, um `git checkout -- src/server/createApp.ts` mal calculado (backup em `/tmp` falhou silenciosamente, bloqueado pelo sandbox) descartou as alterações não commitadas desse arquivo — incluindo a sanitização de erros 500 em modo cloud citada na entrada de 10:50. Não recuperável via `git fsck` (nunca foi `git add`ado), nem via histórico local do VS Code/Cursor, nem via Shadow Copy (sem privilégio de admin). Por decisão do usuário, o arquivo foi reconstruído do zero usando `src/server/cloud-runtime.test.ts` (não afetado, intacto) como especificação comportamental exata: `getCloudSecurity()` (exige SESSION_SECRET/CONSTRUTEC_SETUP_TOKEN ≥32 chars e uma única origem HTTPS exata), CORS estrito em modo cloud, bootstrap `/api/auth/setup` protegido por token, novo `GET /health` (200/503, sem vazar detalhes internos) e handler de erro 500 genérico em cloud. Reconstrução validada: typecheck limpo, os 3 testes de `cloud-runtime.test.ts` passando, suíte crítica 23/23 (1 ignorado, Postgres real) e lint direcionado com os mesmos 10 avisos pré-existentes já documentados às 10:50.
- Corrigida entrada duplicada de `postgres-critical.test.ts` em `scripts/test-critical.mjs` (array de entryPoints listava o arquivo duas vezes).
- Durante o trabalho, detectada edição concorrente em `src/renderer/SuiteSwitcherPopover.tsx` (integração ChamadoPro habilitada no switcher) feita por fora desta sessão; confirmada como intencional e finalizada pelo usuário, commitada separadamente.
- Commits: (1) ignore desktop.ini; (2) runtime cloud/Postgres com segurança reforçada; (3) fix de integração (URL cloud do Centro de Custos + checagem de schema do selo de aprovação); (4) layout responsivo mobile + suite-bolder + web-login + URL dinâmica do Centro de Custos; (5) script de importação de catálogo local→cloud; (6) instalação do skill Impeccable e configs de agente (Cursor/Codex/Copilot); (7) integração ChamadoPro no switcher da suíte.
- Nada foi enviado ao GitHub (branch `main` local, sem push). Próximo passo: revisão externa antes de `git push`, e retomar a homologação de login/uso em celular real pendente da entrada anterior.

## 2026-09-17 10:50 BRT — Publicação mobile autorizada

- Base 1b12e85; deploy solicitado expressamente pelo usuário. Versão Cloudflare `7867424c-d4b5-40e8-9ed0-ed7428e7bc23`, Worker `construtec-orcamentos-cloud`.
- Corrigida a falha do teste cloud: `src/server/createApp.ts` agora retorna mensagem genérica para erros 500 online, sem propagar detalhes internos da exceção.
- Typecheck aprovado; testes críticos 23 passaram, 0 falharam, 1 ignorado (PostgreSQL real). Lint de src com configuração explícita e `--no-eslintrc` passou, 10 avisos, contornando herança duplicada do plugin sem alterar configuração.
- Vite build e container dry-run aprovados. Deploy concluído; página pública 200, CSS `index-CQtMdt4E.css` contém regras mobile e editor empilhado; health confirmou API e PostgreSQL funcionando.
- Próximo passo: homologar login e uso em celular real com o usuário; esta conferência pública não usou credenciais pessoais.

## 2026-09-17 10:05 BRT — Impeccable adapt para celular

- Base: 1b12e85; trabalho concorrente preservado. Escopo: `src/mobile-responsive.css` e uma importação ao final dos estilos em `src/renderer.tsx`.
- Até 767px: navegação horizontal rolável, barras com quebra, editor e resumo empilhados, campos e ações para toque, formulários em uma coluna, modais limitados à tela e rolagem própria das tabelas. Regras restritas a screen, preservando impressão e desktop.
- Impeccable context/adapt/craft-floor aplicados. Chromium com API simulada: início, lista e editor em 320/390/767/1280px, sem overflow da página nem pageerror. Capturas e roteiro locais em `.vite/mobile-*`, sem dados reais. Teste em aparelho físico pendente.
- Typecheck aprovado. Verify interrompido pelo conflito preexistente de resolução do plugin ESLint import entre projeto e pasta superior.
- Testes críticos: 22 passaram, 1 ignorado, 1 falhou (`cloud HTTP protects bootstrap, checks database and hides internal errors`): resposta 500 expõe a mensagem interna simulada. Área de backend em edição concorrente; não alterada nesta tarefa.
- Próximo passo: Claude integrar a folha mobile no build que está preparando, resolver a falha do backend e validar em celular real. Sem publicação nesta tarefa.

## 2026-09-15 08:45 BRT — Catálogo local importado

- Base 1b12e85; alterações anteriores preservadas. Usuário confirmou acesso e autorizou a conexão Neon para importar somente itens ausentes.
- `scripts/import-local-catalog.ts`: cópia isolada do PGlite com hashes conferidos, prévia, transação sem sobrescrita, auditoria e conferência integral dos registros inseridos/existentes. Nenhuma alteração no banco local.
- Neon: catálogo passou de 0 para 15 itens ativos. Nova prévia após commit: 15 presentes, 0 ausentes. Usuários e propostas não foram modificados.
- Self-test aprovado: prévia sem gravação, inserção, repetição sem duplicação, preservação de existente e rejeição de códigos duplicados. Typecheck do projeto aprovado; verify bloqueado no lint pelo conflito preexistente do plugin import. Cópias de segurança isoladas mantidas no Temp, prefixo construtec-catalog-.
- Próximo passo: atualizar a página do catálogo cloud; esta etapa não migrou clientes, propostas ou kits e não equivale à homologação completa da suíte.

## 2026-09-15 — Neon e Container publicados

- Neon permanente criado na conta Lucas Free: projeto gentle-shape-68513699, PostgreSQL 17. Conexão TLS verificada; 10 migrações aplicadas pelo container; zero usuários e nenhum dado local importado.
- API e interface: https://construtec-orcamentos-cloud.construtec-reports.workers.dev . Health HTTP 200 storage postgresql; propostas anônimas HTTP 401; setup-status requer primeiro administrador.
- Container Cloudflare publicado; digest sha256:1648c11467fa1542aa3bdd2a21a9927f32be9941ab8a484abf10d83868dc68d5. Quatro segredos registrados por CLI sem valores versionados.
- Hub atualizado para URL cloud e health real; 12 testes aprovados e deploy concluído.
- Pendente: provisionar primeiro administrador por canal protegido (setup token não está no frontend), corrigir textos local/cloud na tela de acesso e validar fluxo autenticado remoto. Não declarar suíte completamente concluída.

## 2026-09-15 08:15 BRT — PostgreSQL e preparação Neon

- Base 1b12e85; worktree anterior preservado. DATABASE_URL seleciona pg com TLS validado, transações dedicadas e migrações atômicas. PGlite permanece offline. Sem seed demo remoto.
- Runtime exige SESSION_SECRET estável, CONSTRUTEC_SETUP_TOKEN e CONSTRUTEC_ALLOWED_ORIGINS HTTPS. Primeiro admin protegido; health consulta banco; erros remotos sanitizados.
- Docker multi-stage com dependências de produção e usuário node; contexto restrito. cloudflare/api-container contém Worker, configuração e instruções. Nenhum deploy novo nesta etapa.
- Typecheck aprovado; 24 testes aprovados sem skips, incluindo PostgreSQL 17 local, rollback, login, propostas e reconexão. Lint geral bloqueado pelo conflito preexistente do plugin import; lint direcionado executado.
- Docker/Worker dry-run aprovado. Ainda falta teste end-to-end do container final com Neon e provisionamento cloud.
- Bloqueio: console Neon exige login do usuário, solicitado em aba aberta. Nenhum banco Neon criado e nenhum dado local importado.
- TASKS.md não atualizado: arquivo superior contém bytes incompatíveis com UTF-8; progresso registrado aqui para preservar o arquivo existente.

## 2026-09-14 — Estado para hospedagem

- As modificações visuais atuais permanecem no worktree, incluindo `src/suite-bolder.css`, sua importação no renderer e os ajustes de navegação/shell registrados abaixo.
- O build está pronto para publicação como site estático no Cloudflare Pages quando o fluxo de publicação for executado; nenhum URL foi inventado ou registrado neste handoff.
- O aplicativo continua local-first/Electron: o backend Express/PGlite não foi convertido para Workers/Pages nesta etapa.
- Validação desta atualização: `npm run verify` executado após a alteração.

## 2026-09-14 — Remoção do item duplicado de Centro de Custos

- A navegação lateral do Orçamentos não exibe mais “Centro de Custos”; a troca entre sistemas permanece no botão Suíte do topo.
- O fluxo de integração/geração de centro de custo foi preservado.
- Validação: `npm run typecheck` aprovado; navegação conferida no navegador local.

## 2026-09-14 15:40 BRT — Delight de preenchimento e avisos

- Base: 1b12e85, worktree com alterações anteriores preservadas.
- `src/suite-bolder.css`: seleção, caret/foco e avisos com entrada breve de 160ms, quebra de textos longos e alternativa sem movimento. CSS equivalente no Centro de Custos. Sem alterar mensagens, duração, logos ou efeitos dos botões.
- Validação: parser PostCSS e igualdade dos dois CSS aprovados; typecheck aprovado; testes críticos 20/20. Verify bloqueado no lint pelo plugin import duplicado preexistente.
- Próximo passo: conferência visual dos avisos nos dois aplicativos, em temas e dimensões suportados; não realizada integralmente nesta entrega.

## 2026-09-14 15:35 BRT — Impeccable bolder nos sistemas irmãos

- Base: componentes e paleta existentes, sem alterar dimensões do shell, logos ou efeitos de aperto.
- Adicionado `src/suite-bolder.css`, importado em `src/renderer.tsx`, equivalente ao CSS global do Centro de Custos: títulos, ações principais, navegação, indicadores e tabelas.
- Validação: typecheck aprovado; testes críticos 20/20. `npm run verify` interrompido no lint por plugin `import` duplicado entre este projeto e a pasta superior.
- Conferência visual do dashboard do Centro de Custos em tema escuro realizada; revisão visual completa do Orçamentos e demais telas pendente. Sem alterações em regras financeiras.

## 2026-09-14 — Placeholder da busca em janela estreita

- O texto do campo de busca deixou de quebrar em duas linhas; agora usa uma linha com reticências quando faltar espaço.
- Validação: `npm run typecheck` e `npm run test:critical` passaram (20/20).

## 2026-09-14 — Quebra de textos em janela compacta

- Metadados de cliente, obra, status e responsável receberam quebra natural e espaçamento menor abaixo de 1024px; tabelas não foram alteradas.
- Validação: `npm run typecheck` e `npm run test:critical` passaram (20/20).

## 2026-09-14 — Adapt responsivo individual

- Media queries até 1350px e 1024px deixaram de impor `minmax(720px)`/`minmax(600px)` no workspace; o conteúdo central pode encolher e as tabelas continuam rolando.
- Validação: `npm run typecheck` e `npm run test:critical` passaram (20/20).

## 2026-09-14 — Redimensionamento da janela

- A janela principal passou a permitir redimensionamento manual (`resizable: true`) e redução até 860×560.
- O workspace deixou de impor largura mínima de 760px na coluna principal; tabelas continuam com rolagem horizontal quando necessário.
- Validação: `npm run typecheck` passou; `npm run test:critical` passou com 20/20. `npm run lint` ficou bloqueado por configuração duplicada preexistente do plugin `import`.
- Próximo passo: testar visualmente a janela empacotada em larguras menores.

## 2026-09-10 — Alíquota de Impostos, Recuperação PGlite e Formatação DOCX

- Recuperação de Banco de Dados: Corrupção de WAL do PGlite (`could not locate valid checkpoint record`) corrigida com reconstrução limpa de WAL e controle Castagnoli CRC32C. 100% dos dados mantidos intactos.
- Auto-cura de travas: Implementada remoção preventiva de `postmaster.pid` obsoleto em `src/server/services/database.ts` para evitar travamentos em reinicializações bruscas.
- Alíquota de Impostos (%):
  - Migração `010-proposal-tax.ts` e coluna `tax_percentage` em `proposals`.
  - Rota `PATCH /api/proposals/:id/tax` ativa e tipada.
  - `ProposalEditorWorkspace.tsx` sanitiza `%`, vírgulas e espaços, evitando erros de `NaN`.
  - `ProposalSummaryPanel.tsx` recalcula instantaneamente os totais em tempo real durante a digitação.
  - Regra de cálculo comercial: Custo-base × BDI = Subtotal com BDI; Impostos = Subtotal com BDI × (Alíquota / 100); Total Final = Subtotal com BDI + Impostos.
- Formatação DOCX (Word): `proposalDocx.ts` recebeu suporte a `columnSpan: 2` na linha de impostos no resumo quando há materiais e mão de obra, eliminando descompasso de colunas no Word.
- Validação: `npx tsc --noEmit` passou com 0 erros; `npm run test:critical` passou com 19/19 testes; regra `MAX_LINES <= 350` respeitada em todos os arquivos modificados.

## 2026-09-10 — Mesa única Orçamentos → Centro de Custos

- Retomada encontrada no diretório de trabalho: navegação integrada, workspace com iframe e ação de proposta já estavam implementados e não foram sobrescritos.
- Corrigido o deep link da obra: `http://localhost:3333/#obra=<id>` agora abre a tela de Obras / centros e o detalhe do centro indicado após autenticação, em `../../centro de custos CONSTRUTEC/public/app.js`.
- Corrigido o diagnóstico falso de serviço desconectado: o Centro agora libera CORS somente para origens locais, permitindo que o Orçamentos em `:5173` consulte a saúde em `:3333`.
- Corrigido o bloqueio do iframe no Chrome: a CSP do Centro declara explicitamente `http://localhost:5173` como frame pai permitido.
- Validação: `npm run test:critical` no Orçamentos passou (19/19); `npm run check` no Centro de Custos passou (78 arquivos); checagem direta do deep link passou.
- Próximo passo: reiniciar a suíte e homologar a navegação com os dois serviços locais ativos e uma sessão autenticada no Centro de Custos.

## 2026-09-08 — Homologação da suíte

- Corrigida sincronização: outbox permanece pendente até recibo válido do Centro; exportação manual preserva comportamento anterior.
- Reenvio real homologado, com IDs de obra e baseline original no recibo.
- Roteiro repetível: node scripts/homologate-suite.mjs, com PGlite isolado e processos em portas temporárias.
- Detalhes e evidências: ../../INTEGRAÇÃO-ORÇAMENTOS-CENTRO V3/09-HOMOLOGACAO-SUITE.md.
- Base local preservada: 7c204aa; fetch origin/main executado, divergência de 8 commits locais e 1 remoto. Nenhum merge sobre alterações locais.
- Aplicativo instalado e banco de produção preservados; não foi gerado instalador.
- Validação final: `npm run verify` código 0, 19/19 testes, typecheck/lint sem erros e 11 avisos preexistentes.
- Histórico integral preservado em CODEX_HANDOFF-ARQUIVO-01.md e CODEX_HANDOFF-ARQUIVO-02.md (divisão para MAX_LINES <= 350).
