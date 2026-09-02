# Construtec Orçamentos — handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`

Branch: `codex/prompt-master-skill`

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
- PR #75 aberta: layout do modal Exsat; merge depende de validação visual real.

## Exsat — teste real pós-PR #71

Login, reconhecimento da conta e parser funcionam. Cobertura continua inválida:

```text
44 linhas encontradas
29 para importar
1 página lida
23 páginas não puderam ser lidas
```

Não confirmar esse lote parcial. Próximo diagnóstico deve expor `URL + etapa + código técnico + mensagem segura`, separando HTTP, navegação Electron, redirect/login, timeout e URL inválida.

## Branch atual — skill prompt-master

- Instala `prompt-master` no projeto em `.agents/skills/prompt-master/`.
- Atualiza `skills-lock.json` para restauração reproduzível.
- Fonte: `nidhinjs/prompt-master`, versão 1.8.0, 2,4 mil instalações, repositório MIT com 12,2 mil estrelas.
- Avaliação do instalador: Gen segura, Socket com 0 alertas e Snyk com risco médio.
- Skill ativa somente quando o usuário pede criação, correção ou adaptação de prompt.
- Nenhum código do produto, dependência npm ou esquema de banco é alterado.

## Validação

- PRs #73 e #74: checks completos aprovados; assinatura ignorada por falta de certificado.
- Branch atual: `git diff --check`, listagem das skills e scanner local de padrões sensíveis aprovados.
- Stash `codex-preserve-before-ui-ff-20260902` mantido como cópia de segurança.

## Próximo passo

1. Validar e integrar a PR da skill.
2. Validar visualmente a PR #75 em 1920×1080 e 1366×768 antes do merge.
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
