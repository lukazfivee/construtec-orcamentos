# Construtec Orçamentos — handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`
Branch principal: `main`
Atualização: `2026-09-03 11:24 BRT`
Main observada no início desta atualização: `13dd47bab91d4cec26ba1f41b8fe00e2f24e3a91`

## Retomada

1. Leia `AGENTS.md`.
2. Rode `git status --short --branch` e preserve mudanças locais.
3. Rode `git fetch origin --prune`.
4. Atualize `main` somente por fast-forward de `origin/main`.
5. Leia este arquivo antes de alterar código.

Arquitetura detalhada: `PRODUCT.md`, `README.md` e `.cursor/rules/ai-architecture.mdc`.

## Estado atual do produto

- Electron Forge + Vite + React + TypeScript.
- API Express local em `127.0.0.1` e banco PGlite/PostgreSQL local-first.
- Catálogo, clientes, obras, kits, propostas, revisões, mão de obra, BDI, autenticação/RBAC, auditoria, backup/restauração e exportação PDF/Word implementados.
- PDF/Word mostram somente valores comerciais finais; nunca custos-base, salários, BDI detalhado ou margem.
- Snapshots e revisões históricas permanecem imutáveis após atualização do catálogo.
- Importação em lote por manual, planilha, imagem/PDF e Exsat existente.

## Avanços recentes

```text
PR #72 — 7623bdc — auditoria visual geral
PR #73 — 9f03029 — arredondamento de resumos
PR #74 — e2330cb — regras/contexto e skill agent-md-refactor
PR #76 — a4ed059 — skill prompt-master
PR #77 — a617076 — diagnóstico estruturado de falhas Exsat
PR #78 — 0dccb60 — preservar URL solicitada após session.fetch()
PR #79 — 13dd47b — decodificar charset da resposta Exsat corretamente
```

PR #75 continua aberta: `style: improve Exsat import layout`. Ela está atualizada sobre a main e requer validação visual real em 1920×1080 e 1366×768 antes do merge.

## Exsat — estado confirmado em teste real Windows

A causa das 23 falhas `Invalid URL` foi identificada na PR #77: o app confiava em `Response.url` retornado por `session.fetch()`. A PR #78 passou a preservar a URL solicitada já validada.

Resultado real depois da correção:

```text
500 linhas encontradas
272 para importar
6 páginas lidas
0 páginas com falha
32 duplicados consolidados
```

O limite de 500 itens encerrou a varredura após 6 páginas, como previsto.

Depois disso foi identificado mojibake em descrições como `C�mera`. A PR #79 corrigiu a leitura do corpo HTTP por bytes e respeita o charset declarado no `Content-Type`, mapeando ISO-8859-1 para Windows-1252 e usando UTF-8 como fallback.

Teste funcional real após #79 confirmou descrições corretas, incluindo `Câmara`.

Portanto:
- login/sessão Exsat: funcionando;
- descoberta e carregamento de páginas: funcionando no teste real;
- parser de produtos: funcionando;
- cobertura observada: 6 páginas, 0 falhas, limite de 500 itens atingido;
- charset das descrições: corrigido;
- importação final ainda deve ser confirmada somente após validação visual do modal e revisão do lote.

## Validação

- PR #77: `npm run verify`, `git diff --check` e CI aprovados.
- PR #78: `npm run verify`, `git diff --check` e teste Windows real aprovados.
- PR #79: `npm run verify`, `git diff --check`, build Windows e teste funcional real aprovados antes do merge.
- PR #75: CI aprovado na branch atualizada; falta validação visual exigida em 1920×1080 e 1366×768.

## Próximos passos

1. Validar visualmente PR #75 em 1920×1080 e 1366×768.
2. Integrar PR #75 somente após a validação visual.
3. Bloquear confirmação quando uma varredura automática estiver claramente parcial.
4. Realizar uma importação Exsat controlada e conferir catálogo resultante, duplicidades, preços e histórico de sincronização.
5. Criar testes críticos para cálculos, snapshots e exportações.
6. Retomar importação universal por imagem/PDF de fornecedores diferentes, sem depender de layout fixo.
7. Fazer pente-fino de duplicidades, códigos conflitantes, itens sem preço e atualização de centenas de itens sem alterar propostas históricas.
8. Validar ciclo completo `Catálogo → Kit → Proposta → Mão de obra → BDI → Revisão → PDF/Word`.
9. Só iniciar integração com Centro de Custos V3 quando existir contrato/API real.

## Bloqueios

- PR #75 depende de validação visual real nas duas resoluções exigidas.
- Centro de Custos V3 depende de contrato/API real ainda ausente.
- Nunca registrar ou commitar credenciais, cookies, tokens, `.env` ou segredos.

## Release

- Última release versionada publicada confirmada: `build-154`.
- Commit da release: `6f5252b8fdc5a58aa4da29e258458a8e70a71a16`.
- Instalador: `Construtec-Orcamentos-Setup.exe`.
- SHA256: `6e50f461db5dabde304b8e194a59af91de50cf7e834161c8f9d772bd0a4903e5`.
- Workflow: `.github/workflows/build-windows-installer.yml`.
- Commit normal em `main` não cria release versionada.
- `[release]` somente quando for publicar nova `build-N`.
