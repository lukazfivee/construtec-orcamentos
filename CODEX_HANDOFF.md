# Construtec Orçamentos — handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`

Branch de entrega: `codex/exsat-response-url-fallback`

Atualização: `2026-09-02 21:07 BRT`

Base da branch: `a617076db63ccd4024708c589febdefcc73b5f7e`

## Retomada

1. Leia `AGENTS.md`.
2. Rode `git status --short --branch`; preserve mudanças locais.
3. Atualize `main` somente por fast-forward de `origin/main`.
4. Leia este arquivo e siga `Próximo passo`.

Arquitetura detalhada está em `PRODUCT.md`, `README.md` e, para mudanças substanciais, `.cursor/rules/ai-architecture.mdc`.

## Estado atual

- App Electron local-first com React, TypeScript, API Express local e PGlite.
- Propostas, revisões, catálogo, clientes, obras, kits, mão de obra, BDI, autenticação/RBAC, auditoria, backup/restauração e PDF/Word estão implementados.
- PDF/Word mostram somente valores comerciais finais; nunca custos-base, salários, BDI detalhado ou margem.
- Snapshots e revisões históricas permanecem imutáveis após atualização de catálogo.
- PR #72 integrada em `7623bdc`: auditoria visual geral.
- PR #73 integrada em `9f03029`: arredondamento de resumos.
- PR #74 integrada em `e2330cb`: regras/contexto e skill `agent-md-refactor`.
- PR #76 integrada em `a4ed059`: skill `prompt-master`.
- PR #75 aberta: layout do modal Exsat; merge depende de validação visual real.
- PR #77 integrada em `a617076`: diagnóstico estruturado Exsat.

## Exsat — teste real pós-PR #77

O diagnóstico mostrou 23 falhas `EXSAT_UNKNOWN / Invalid URL` em endereços Exsat válidos. A causa é o uso de `Response.url` de `session.fetch()`, documentado pelo Electron como incorreto. Usar a URL solicitada corrigiu a varredura real:

```text
500 linhas encontradas
272 para importar
6 páginas lidas
0 páginas com falha
32 duplicados consolidados
```

O limite de 500 itens encerrou a varredura após 6 páginas, como previsto. Não confirmar ainda: a prévia exibiu texto corrompido, por exemplo `C�mera`.

## Branch atual — URL da resposta Exsat

- `responseHtml()` usa a URL validada solicitada como `finalUrl`.
- Mudança funcional de uma linha em `src/main/exsatSession.ts`; sem alterar parser, limites ou dados.
- Resultado confirmado no Electron/Windows com sessão Exsat real.

## Validação

- PRs #73, #74 e #76: checks completos aprovados e integradas.
- PR #77: `npm run verify`, `git diff --check` e checks do GitHub aprovados; publicação ignorada porque não é release.
- Branch atual: `npm run verify`, `git diff --check` e teste funcional real aprovados.
- Stash `codex-preserve-before-ui-ff-20260902` mantido como cópia de segurança.

## Próximo passo

1. Integrar a correção de `Response.url` após CI verde.
2. Diagnosticar e corrigir a codificação de descrições Exsat antes de permitir a importação real.
3. Validar visualmente a PR #75 em 1920×1080 e 1366×768, atualizá-la sobre a `main` e integrar.
4. Bloquear confirmação de varredura automática claramente parcial.
5. Criar testes críticos de cálculos, snapshots e exportações.

## Bloqueios

- Importação Exsat bloqueada operacionalmente até corrigir textos com caractere de substituição `�`.
- Centro de Custos V3 depende de contrato/API real ainda ausente.
- Nunca registrar ou commitar credenciais, cookies, tokens, `.env` ou segredos.

## Release

- Workflow: `.github/workflows/build-windows-installer.yml`.
- Commit normal não cria release versionada.
- `[release]` somente quando precisar publicar `build-N` e `Construtec-Orcamentos-Setup.exe`.
