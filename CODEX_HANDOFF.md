# Construtec Orçamentos — handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`

Branch de entrega: `codex/exsat-import-layout`

Atualização: `2026-09-03 10:28 BRT`

Base integrada localmente: `27a0a124530ffb0b4041d9d58e2ae53753cf8a96`

## Retomada

1. Leia `AGENTS.md`.
2. Rode `git status --short --branch`; preserve mudanças locais.
3. Atualize referências com `git fetch origin --prune`.
4. Atualize `main` somente por fast-forward de `origin/main`.
5. Leia este arquivo e siga `Próximo passo`.

Arquitetura detalhada está em `PRODUCT.md`, `README.md` e, para mudanças substanciais, `.cursor/rules/ai-architecture.mdc`.

## Estado atual

- App Electron local-first com React, TypeScript, API Express local e PGlite.
- PDF/Word mostram somente valores comerciais finais; nunca custos-base, salários, BDI detalhado ou margem.
- Snapshots e revisões históricas permanecem imutáveis após atualização de catálogo.
- PR #75 aberta: layout do modal Exsat; merge depende de validação visual real.
- PR #77 integrada em `a617076`: diagnóstico estruturado de falhas Exsat.
- PR #78 integrada em `0dccb60`: preservação da URL solicitada após `session.fetch()`.
- Commit local `27a0a12`: leitura da resposta Exsat conforme charset para evitar mojibake.
- Conflitos entre PR #75 e `main` foram resolvidos preservando layout, diagnóstico por página e correções Exsat.

## Exsat — teste real

Resultado confirmado no Electron/Windows com sessão Exsat real:

```text
500 linhas encontradas
272 para importar
6 páginas lidas
0 páginas com falha
32 duplicados consolidados
```

Descrições foram exibidas corretamente após a correção de charset, incluindo `Câmara`.

## Branch atual — modal Exsat

- Agrupa conexão, datas de sincronização e ação automática.
- Mantém cabeçalho da tabela fixo e mostra situações como badges.
- Exibe diagnóstico estruturado quando páginas falham.
- Preserva aviso visual amarelo somente quando existem falhas.
- Mantém ajuste responsivo até 1024 px.
- Não altera banco, importação final, PDF/Word ou dependências.

## Validação

- `npm run verify`: aprovado após resolução dos conflitos.
- `git diff --check`: aprovado.
- Validação visual em 1920×1080 e 1366×768 ainda pendente.
- Ambiente atual expõe somente 1280×720 e nenhum navegador controlável, portanto não permite concluir as duas resoluções exigidas.
- Stash `codex-preserve-before-ui-ff-20260902` mantido como cópia de segurança.

## Próximo passo

1. Concluir o merge local, publicar `codex/exsat-import-layout` e aguardar CI.
2. Validar visualmente a PR #75 em 1920×1080 e 1366×768.
3. Integrar a PR #75 somente após CI e validação visual.
4. Bloquear confirmação de varredura automática claramente parcial.
5. Criar testes críticos de cálculos, snapshots e exportações.

## Bloqueios

- Validação visual exigida pela PR #75 depende de ambiente com 1920×1080 e 1366×768.
- Centro de Custos V3 depende de contrato/API real ainda ausente.
- Nunca registrar ou commitar credenciais, cookies, tokens, `.env` ou segredos.

## Release

- Workflow: `.github/workflows/build-windows-installer.yml`.
- Commit normal não cria release versionada.
- `[release]` somente quando precisar publicar `build-N` e `Construtec-Orcamentos-Setup.exe`.
