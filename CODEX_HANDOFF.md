# Construtec Orçamentos — Handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`
Branch principal: `main`
Última atualização deste rastro: `2026-08-31 BRT`

Este arquivo existe para outra IA, editor ou operador continuar exatamente de onde o trabalho parou.

## Como continuar em outra IA

Antes de alterar qualquer coisa, leia nesta ordem:

1. `AGENTS.md`
2. `.cursorrules`
3. `.cursor/rules/ai-architecture.mdc`
4. `PRODUCT.md`
5. `README.md`
6. `CODEX_HANDOFF.md`
7. `OPENCODE.md`, quando existir

Modo preferido pelo usuário:

```text
@ponytail
$caveman full
```

Interpretação prática:

- menor diff correto;
- causa raiz primeiro;
- sem abstração futura sem necessidade;
- comunicação curta em português;
- não expor custos internos, salários, BDI ou margem em documentos do cliente;
- usar Context7 quando mexer em API/biblioteca/framework cujo comportamento possa ter mudado.

## Último avanço registrado

Data/hora BRT: `2026-08-31 09:55`

Branch: `main`

Commit principal integrado:

```text
d7b2993f491bd2c2922575ce2c7af35a76a451e0 feat: release version with proposal kpis, cloning and advanced management [release]
```

O que mudou:

- Branch `opencode/correcao-totais-documento` já foi integrada ao `main` por merge commit do Opencode.
- `main` agora contém Kits no código-fonte: `src/renderer/KitsWorkspace.tsx`, `src/renderer/ProposalKitsPanel.tsx`, `src/server/routes/kits.ts`, `src/server/services/kits.ts` e migration `src/server/migrations/007-kits-and-settings.ts`.
- Home/Dashboard, Central de Propostas, Configurações, clonagem/exclusão de propostas e KPIs também estão no `main`.
- Corrigidos marcadores de conflito que ficaram neste `CODEX_HANDOFF.md` durante integração anterior.

Validação em andamento:

- Workflow `Gerar instalador do Windows` run `33393586102`, commit `d7b2993f...`, status inicial: `in_progress`.
- Workflow `Build Windows Installer` run `33393586132`, commit `d7b2993f...`, status inicial: `in_progress`.
- Como o commit contém `[release]`, workflow deve atualizar `windows-latest` e criar release versionada `build-N` se concluir com sucesso.

Próximo passo imediato:

1. Aguardar conclusão dos workflows do commit `d7b2993f...`.
2. Confirmar que `windows-latest` passou a apontar para `d7b2993f...`.
3. Baixar novo `Construtec-Orcamentos-Setup.exe` para `C:\Users\Suporte\Downloads`.
4. Validar hash SHA256 local contra digest do asset GitHub.

Bloqueios:

- Sem bloqueio no momento.

## Registro anterior

Data/hora BRT: `2026-08-31 09:45`

Branch: `main`

O que mudou (ponytail, pre-flight aplicado, layout de KPIs corrigido, Central de Propostas e release):

- `src/renderer/ProposalsListWorkspace.tsx`: Layout dos cards de KPI corrigido (ícones circulares alinhados `kpi-icon` + estrutura `kpi-content`), eliminando corte e desalinhamento visual.
- `src/main.ts`: Janela do Electron configurada para abertura confiável e direta (`show: true` + tratamento seguro de inicialização).
- `forge.config.ts`, `vite.main.config.mjs`, `vite.preload.config.mjs`: Configuração do Forge Vite Plugin ajustada para builds determinísticos.
- Central completa de Gestão de Propostas (`ProposalsListWorkspace`), clonagem completa (`cloneProposal`), exclusão segura em cascata (`deleteProposal`) e atualização dinâmica de status.
- Skill `find-skills` adicionada e configurada em `AGENTS.md` e `OPENCODE.md`.

Validação:

- `npm run verify` (tsc --noEmit + eslint): 100% verde (0 erros, 0 avisos).
- `npm run security:audit:prod`: 0 vulnerabilidades (auditoria limpa).

## Estado confirmado em 2026-08-30

Última release versionada confirmada antes dos blocos de documentação:

```text
Tag: build-127
URL: https://github.com/lukazfivee/construtec-orcamentos/releases/tag/build-127
EXE: https://github.com/lukazfivee/construtec-orcamentos/releases/download/build-127/Construtec-Orcamentos-Setup.exe
SHA256: b4a43cb93b2df71a2679809fb6312395ce7778f69aa97c58b51c4fc4c8444ae7
Publicado: 2026-08-30T15:26:37Z
```

Observação importante: a release fixa `windows-latest` pode aparecer no GitHub como “4 days ago” porque a data exibida é a criação original da release/tag. O asset e o target podem ser atualizados sem mudar essa idade. Para data atual visível, use releases versionadas `build-N`.

## O que já está pronto

### Fundação do app

- Electron Forge + Vite + React + TypeScript.
- API local Express.
- Banco local PGlite/PostgreSQL.
- App Windows local-first.
- Catálogo, clientes, obras, propostas, revisões, exportação PDF/Word.

### Propostas

- Criação de proposta do zero.
- Numeração automática `PA-XXXX`.
- Revisão 00 e revisões posteriores preservadas.
- Troca de cliente/obra com snapshot histórico.
- Adição, remoção e edição de itens.
- Duplicação e reordenação de itens.
- BDI/multiplicador interno.
- Histórico de revisões.
- Resumo comercial.
- Central completa de propostas com KPIs, busca, status, clonagem e exclusão.

### Kits

Implementado e integrado.

Arquivos principais:

- `src/renderer/KitsWorkspace.tsx`
- `src/renderer/ProposalKitsPanel.tsx`
- `src/server/routes/kits.ts`
- `src/server/services/kits.ts`
- `src/server/migrations/007-kits-and-settings.ts`
- `src/shared/contracts.ts`
- `src/renderer/api.ts`
- `src/renderer/App.tsx`

Funcionalidades:

- CRUD de kits/composições;
- busca por nome/categoria;
- seleção de múltiplos itens do catálogo;
- custo estimado por kit;
- inserção rápida de kit na proposta ativa.

### Mão de obra

Implementado e integrado.

Arquivos principais:

- `src/shared/labor.ts`
- `src/server/migrations/005-proposal-labor.ts`
- `src/server/services/proposalLabor.ts`
- `src/server/routes/proposals.ts`
- `src/renderer/ProposalLaborPanel.tsx`
- `src/renderer/App.tsx`
- `src/renderer/api.ts`
- `src/shared/contracts.ts`

Cálculo usado:

```text
custoMensal = salarioMensal + alimentacaoMensal + transporteMensal + outrosCustosMensais
valorHora = custoMensal / horasMensaisPadrao
custoMaoDeObraItem = quantidadeProfissionais * valorHora * horasPrevistas
maoDeObraTotal = soma dos custos de todas as funções
```

Default: `176` horas mensais, configurável por proposta.

### Condições comerciais

Já implementado em `src/renderer/App.tsx` e `src/documents/proposalDocument.ts`.

Campos existentes:

- escopo comercial;
- validade;
- prazo de execução;
- forma de pagamento;
- garantia;
- observações.

As condições são serializadas em JSON dentro de `proposal.scope`, com fallback para texto legado. O PDF/Word do cliente mostra condições comerciais, mas não mostra custos internos.

### Segurança e regras de projeto

Já existem:

- `AGENTS.md`
- `OPENCODE.md`
- `.cursorrules`
- `.cursor/rules/ai-architecture.mdc`
- workflow com `npm run verify`;
- auditoria `npm run security:audit:prod` no workflow principal;
- release versionada quando commit contém `[release]`.

## Workflows e releases

Workflow principal de instalador:

```text
.github/workflows/build-windows-installer.yml
```

Fluxo esperado:

```text
npm ci
npm run verify
npm run security:audit:prod
npm run make:windows
```

Regras:

- commit normal na `main`: atualiza a release fixa `windows-latest` quando o workflow roda;
- commit com `[release]`: também cria uma release versionada `build-N`;
- alteração apenas em Markdown não deve rebuildar o instalador no workflow principal.

## Pendências conhecidas

### 1. Deployment Cloudflare OCR vermelho

No GitHub aparece deployment `ocr-production` com falha. Provável causa: segredo/conta/configuração externa ausente ou incompleta.

Verificar sem inventar segredo:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- variáveis/secrets do worker, incluindo token compartilhado do OCR se aplicável
- logs do workflow/deployment Cloudflare

Não commitar segredos.

### 2. Total em listas de propostas — CORRIGIDO em 2026-08-30 15:30

Corrigido em `src/server/services/proposals.ts:138-171,592-619`: `total_sale` agora é `ROUND((SUM(pi.quantity*snapshot_unit_cost)+SUM(labor_calc))*bdi,2)` incluindo `proposal_labor_items`. Validado com query em `PA-1054` → 26428.52. Pendência encerrada; falta apenas validar visualmente no EXE atualizado.

### 3. Kits, Home e Configurações — CONCLUÍDO em 2026-08-30 17:15

Módulos Home (Dashboard com KPIs), Kits (CRUD, composição e inserção rápida em proposta) e Configurações (dados da empresa e padrões de proposta) implementados e integrados na navegação principal e na proposta aberta.

### 4. Auth completa e integrações externas

Ainda são fase futura. O produto menciona JWT/hash, mas não tratar como sistema multiusuário finalizado sem inspeção específica.

## Próximo passo recomendado

Depois que o EXE do commit `d7b2993f...` estiver publicado:

1. instalar/testar visualmente Home, Propostas, Kits e Configurações;
2. criar kit pequeno e inserir em proposta ativa;
3. conferir total comercial: materiais + mão de obra + BDI;
4. exportar PDF/Word e confirmar que não expõe custos internos;
5. seguir para próxima etapa funcional escolhida pelo usuário.

## Checklist obrigatório antes de encerrar um bloco de trabalho

Atualize este arquivo quando houver avanço real:

- commit criado;
- release criada;
- bug confirmado/corrigido;
- próximo alvo mudado;
- validação feita/falhou;
- bloqueio externo identificado.

Formato mínimo para nova entrada:

```text
Data/hora BRT:
Commit:
O que mudou:
Validação:
Próximo passo:
Bloqueios:
```
