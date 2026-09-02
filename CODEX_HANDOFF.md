# Construtec Orçamentos — handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`

Branch: `codex/agent-context-skills`

Atualização: `2026-09-02 BRT`

Base sincronizada: `9f0302904348b093190a00ff5eb10c6d7f30fac9`

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
- PR #72 integrada em `7623bdc`: acessibilidade, estados visuais, tokens semânticos e responsividade.
- PR #73 integrada em `9f03029`: arredondamento alinhado em dashboard, listagem e histórico.

## Exsat — teste real pós-PR #71

Login, reconhecimento da conta e parser funcionam. Cobertura continua inválida:

```text
44 linhas encontradas
29 para importar
1 página lida
23 páginas não puderam ser lidas
```

Não confirmar esse lote parcial. Próximo diagnóstico deve expor `URL + etapa + código técnico + mensagem segura`, separando HTTP, navegação Electron, redirect/login, timeout e URL inválida.

## Branch atual — otimização de contexto

- Reduz regras duplicadas em `AGENTS.md`.
- Remove `.cursorrules`, legado e redundante.
- Limita `.cursor/rules/ai-architecture.mdc` aos arquivos relevantes.
- Encurta `OPENCODE.md` e mantém `CODEX_HANDOFF.md` como fonte operacional.
- Adiciona `.agents/skills/agent-md-refactor/`, fonte `softaworks/agent-toolkit`, 4,1 mil instalações, MIT.
- Nenhum código do produto, dependência npm ou esquema de banco é alterado.

## Limpeza global recuperável

```text
819 skills movidas de C:\Users\Suporte\.codex\skills
backup: C:\Users\Suporte\.codex\skills-archive\20260901-222407-token-cleanup
mantidas: .system e caveman
```

O catálogo menor aparece somente em nova sessão do Codex.

## Validação

- PR #73: `npm run verify`, segurança, dependências e instalador Windows aprovados; assinatura ignorada por falta de certificado.
- Branch atual: `npm run verify`, `git diff --check`, listagem das skills e scanner local de padrões sensíveis aprovados.
- Stash `codex-preserve-before-ui-ff-20260902` mantido como cópia de segurança.

## Próximo passo

1. Validar e integrar a PR focada de contexto/skills.
2. Isolar o commit `ab116fb` em PR de UI e validar modal Exsat em 1920×1080 e 1366×768.
3. Isolar `prompt-master` em commit/PR de skills, se ainda desejado separadamente.
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
