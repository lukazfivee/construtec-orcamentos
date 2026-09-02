# Construtec Orçamentos — handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`

Branch: `codex/exsat-import-layout`

Atualização: `2026-09-02 BRT`

Base sincronizada: `e2330cb726e09a535d6c50c78d25d5e4423b86e7`

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

## Exsat — teste real pós-PR #71

Login, reconhecimento da conta e parser funcionam. Cobertura continua inválida:

```text
44 linhas encontradas
29 para importar
1 página lida
23 páginas não puderam ser lidas
```

Não confirmar esse lote parcial. Próximo diagnóstico deve expor `URL + etapa + código técnico + mensagem segura`, separando HTTP, navegação Electron, redirect/login, timeout e URL inválida.

## Branch atual — layout do modal Exsat

- Corrige grade dinâmica que deixava grande espaço vazio quando a prévia existia.
- Agrupa conexão, datas e atualização automática.
- Destaca falhas de páginas em amarelo.
- Mantém cabeçalho da tabela fixo e exibe situações como badges.
- Adiciona ajuste responsivo até 1024 px.
- Não altera crawler, importação, banco, PDF/Word ou dependências.

## Limpeza global recuperável

```text
819 skills movidas de C:\Users\Suporte\.codex\skills
backup: C:\Users\Suporte\.codex\skills-archive\20260901-222407-token-cleanup
mantidas: .system e caveman
```

## Validação

- PRs #73 e #74: `npm run verify`, segurança, dependências e instalador Windows aprovados; assinatura ignorada por falta de certificado.
- Branch atual: `npm run verify` e `git diff --check` aprovados antes do isolamento; CI deve repetir após push.
- Validação visual real ainda pendente em 1920×1080 e 1366×768.
- Stash `codex-preserve-before-ui-ff-20260902` mantido como cópia de segurança.

## Próximo passo

1. Abrir PR desta branch e aguardar CI.
2. Validar modal Exsat em 1920×1080 e 1366×768 antes do merge.
3. Isolar `prompt-master` em PR própria.
4. Implementar diagnóstico estruturado das falhas Exsat.
5. Bloquear confirmação de varredura automática claramente parcial.

## Bloqueios

- Diagnóstico final da Exsat depende do comportamento real do site dentro do Electron no Windows.
- Centro de Custos V3 depende de contrato/API real ainda ausente.
- Nunca registrar ou commitar credenciais, cookies, tokens, `.env` ou segredos.

## Release

- Workflow: `.github/workflows/build-windows-installer.yml`.
- Commit normal não cria release versionada.
- `[release]` somente quando precisar publicar `build-N` e `Construtec-Orcamentos-Setup.exe`.
