# Construtec Orçamentos — handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`

Branch: `codex/exsat-import-layout`

Atualização: `2026-09-02 BRT`

Base sincronizada: `a4ed0597603b1d6f9b514f86db1155a7f8d6a940`

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
- PR #75 aberta: layout do modal Exsat.

## Exsat — teste real pós-PR #71

Login, reconhecimento da conta e parser funcionam. Cobertura continua inválida:

```text
44 linhas encontradas
29 para importar
1 página lida
23 páginas não puderam ser lidas
```

Não confirmar esse lote parcial. Próximo diagnóstico deve expor `URL + etapa + código técnico + mensagem segura`, separando HTTP, navegação Electron, redirect/login, timeout e URL inválida.

## PR #75 — layout do modal Exsat

- Corrige grade dinâmica que deixava grande espaço vazio quando a prévia existia.
- Agrupa conexão, datas e atualização automática.
- Destaca falhas de páginas em amarelo.
- Mantém cabeçalho da tabela fixo e exibe situações como badges.
- Adiciona ajuste responsivo até 1024 px.
- Não altera crawler, importação, banco, PDF/Word ou dependências.

## Validação

- PRs #73, #74 e #76: checks completos aprovados; assinatura ignorada por falta de certificado.
- PR #75: checks completos aprovados antes da atualização com `main`; CI deve repetir após push.
- Validação visual real da PR #75 ainda pendente em 1920×1080 e 1366×768.
- Stash `codex-preserve-before-ui-ff-20260902` mantido como cópia de segurança.

## Próximo passo

1. Aguardar novo CI da PR #75.
2. Validar modal Exsat em 1920×1080 e 1366×768 antes do merge.
3. Implementar diagnóstico estruturado das falhas Exsat.
4. Bloquear confirmação de varredura automática claramente parcial.
5. Criar testes críticos de cálculos, snapshots e exportações.

## Bloqueios

- Diagnóstico final da Exsat depende do comportamento real do site dentro do Electron no Windows.
- Centro de Custos V3 depende de contrato/API real ainda ausente.
- Nunca registrar ou commitar credenciais, cookies, tokens, `.env` ou segredos.

## Release

- Workflow: `.github/workflows/build-windows-installer.yml`.
- Commit normal não cria release versionada.
- `[release]` somente quando precisar publicar `build-N` e `Construtec-Orcamentos-Setup.exe`.
