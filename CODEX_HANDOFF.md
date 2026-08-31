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

Data/hora BRT: `2026-08-31`

Commits criados neste bloco:

```text
84ad81465f010e1dfc5b724addc48e20fcee2ecc docs: add continuity trail to editor guardrails
583540f849286810ed1bacf924e945075e51aa30 docs: add continuity trail to cursor rule
```

O que mudou:

- `.cursorrules` agora exige rastro operacional antes de qualquer IA/editor encerrar avanço real.
- `.cursor/rules/ai-architecture.mdc` agora exige o mesmo rastro para Cursor e assistentes de editor.
- A regra ficou alinhada entre Codex, OpenCode, Cursor e outras IAs: atualizar `CODEX_HANDOFF.md` e manter `OPENCODE.md` coerente quando o fluxo de retomada mudar.
- A pasta local atual `C:\Users\Suporte\Documents\ChatGPT\APP Construtec orçamentos` contém apenas `.git`; o binário `git` não está disponível no PATH deste ambiente. Nesta sessão, os commits foram feitos pelo conector GitHub.

Validação:

- Mudanças apenas em documentação/regras.
- Não foi criada release versionada.
- O workflow principal já possui `paths-ignore: ['**/*.md']`, mas alterações em `.cursorrules` e `.cursor/**` ainda podem disparar CI porque não são Markdown puro.

Próximo passo:

- Corrigir consistência dos totais comerciais em `src/server/services/proposals.ts`: `listCurrentProposals` e `listProposalHistory` ainda usam soma antiga baseada só em itens.

Bloqueios:

- Sem `git` local disponível no PATH.
- Para trabalhar localmente nessa pasta, será preciso restaurar/popular a árvore de arquivos do repositório ou instalar/disponibilizar `git`.

## Registro anterior

Data/hora BRT: `2026-08-30 12:50`

Commits criados no bloco anterior:

```text
71d25fad01ab64dcb7b51855b85848e7d431abda docs: update development handoff trail
a6acd8f02a2074f1d3f7e0c693213bed0464a21d docs: add opencode continuation guide
0e19437c45fef953fe6cb352b2d6e6a5c568e8f0 docs: require durable handoff trail
fa5aa28f39abf485564a441cfa1a6dfd7475feff ci: skip installer build for docs-only changes
3ffc73f2ff01d61dd9f947bec48cf1e1bace2c24 docs: record continuation trail updates
e39a55e232c3644a0eb056f6d2e92dbc3bfe1620 docs: require opencode continuity trail
```

O que mudou:

- `CODEX_HANDOFF.md` virou o diário principal de continuidade.
- `OPENCODE.md` foi criado como ponto de entrada para OpenCode/outra IA.
- `OPENCODE.md` manda o OpenCode atualizar `CODEX_HANDOFF.md` antes de encerrar avanço real.
- `AGENTS.md` exige atualização do rastro antes de encerrar avanço real.
- `.github/workflows/build-windows-installer.yml` ignora alterações apenas em Markdown em push/PR.

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

### 2. Total em listas de propostas incompleto

Confirmado em inspeção: `src/server/services/proposals.ts` calcula `total_sale` em `listCurrentProposals` e `listProposalHistory` a partir de `proposal_items`. Isso deixa mão de obra e BDI fora dos totais resumidos.

Próximo alvo recomendado de código:

- revisar `listCurrentProposals`;
- revisar `listProposalHistory`;
- incluir agregação de mão de obra;
- decidir se o valor resumido deve exibir `finalValue`;
- manter documentos do cliente sem BDI explícito.

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
