# Construtec Orçamentos — Handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`
Branch principal: `main`
Última atualização deste rastro: `2026-08-30 12:50 BRT`

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

Data/hora BRT: `2026-08-30 15:30`

Branch local pendente (opencode/correcao-totais — aguardando commit): alterações não pusheadas em `C:\Users\Suporte\Documents\Default Project`.

O que mudou (ponytail, pre-flight aplicado):

- `AGENTS.md:19-33` — mantido rastro + re-adicionado `Colaboração com Codex` após sync da `main`.
- `src/server/migrations/006-proposal-item-category.ts` — `snapshot_category` (já entregue no bloco 15:00).
- `src/server/services/proposals.ts:138-171,592-619` — `listCurrentProposals` e `listProposalHistory` agora calculam `total_sale` como `ROUND((SUM(snapshot_unit_cost*quantity)+SUM(labor calc))*bdi,2)` incluindo `proposal_labor_items` (`professional_count*(monthly_salary+food+transport+other)/NULLIF(standard_hours,0)*planned_hours`); `GROUP BY` inclui `p.bdi_multiplier`; corrige pendência 2 (totais antes só somavam `sale_unit_price` sem mão de obra/BDI).
- `src/server/services/database.ts:64` — self-heal `ADD COLUMN IF NOT EXISTS snapshot_category` para reparar DB já migrado sem coluna (bug do banner amarelo `Não foi possível concluir a operação local`).
- `forge.config.ts:23` — `setupExe` corrigido `1.0.3` → `1.0.5`.
- Bug banner amarelo corrigido manualmente no DB local (`Construtec Orçamentos/data/postgres`) e `npm run verify` ok.

Validação:

- `npm run verify` ok.
- Query manual `PGlite` em `Construtec Orçamentos/data/postgres` retorna `total_sale 26428.52` para `PA-1054` com BDI 1.45 (inclui labor).
- Migration self-heal validada.

Próximo passo:

- Gerar novo `make:windows` 1.0.5 e validar lista/Histórico mostrando `finalValue` (materials+labor)*BDI; PDF/Word já separados por categoria.

Bloqueios:

- Sem bloqueio.

## Estado confirmado em 2026-08-30

Última release versionada confirmada antes deste bloco:

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

Corrigido em `src/server/services/proposals.ts:138-171,592-619`: `total_sale` agora é `ROUND((SUM(pi.quantity*snapshot_unit_cost)+SUM(labor_calc))*bdi,2)` incluindo `proposal_labor_items`. Validado com query em `PA-1054` → 26428.52. Pendência encerrada; falta apenas validar visualmente no EXE antes de `windows-latest`/`[release]`.

### 3. Kits, Home e Configurações

Ainda aparecem como áreas futuras/desabilitadas. Não anunciar como pronto.

### 4. Auth completa e integrações externas

Ainda são fase futura. O produto menciona JWT/hash, mas não tratar como sistema multiusuário finalizado sem inspeção específica.

## Próximo passo recomendado

Fazer a etapa de consistência comercial:

1. corrigir totais resumidos/listados para refletirem materiais + mão de obra + BDI;
2. revisar se exportação PDF/Word mostra apenas valor comercial final;
3. rodar `npm run verify` no CI;
4. só criar release versionada com `[release]` depois da validação visual no EXE.

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
