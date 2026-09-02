# OPENCODE — retomada rápida

## Começar

1. Leia `AGENTS.md`.
2. Rode `git status --short --branch` e preserve mudanças locais.
3. Sincronize `main` com `origin/main` por fast-forward.
4. Leia `CODEX_HANDOFF.md` para estado atual, validação e próximo passo.

Não replique aqui o estado do produto. A fonte operacional é `CODEX_HANDOFF.md`; arquitetura está em `PRODUCT.md`, `README.md` e `.cursor/rules/ai-architecture.mdc` quando relevante.

## Trabalho

- Use `@ponytail` e `$caveman full`.
- Menor diff correto; causa raiz; sem dependência desnecessária.
- Nunca exponha BDI, salários, custos ou margens em documentos do cliente.
- Para mudança de código, rode `npm run verify`.
- Use `[release]` somente quando uma release versionada e seu instalador forem necessários.

## Continuidade

Após avanço real, atualize `CODEX_HANDOFF.md`. Altere este arquivo apenas se o fluxo acima mudar.
