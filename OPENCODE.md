# OPENCODE — ponto de retomada

Este arquivo é o ponto de entrada rápido para OpenCode ou qualquer outra IA continuar o projeto Construtec Orçamentos.

## Comece aqui

Leia primeiro:

1. `AGENTS.md`
2. `.cursorrules`
3. `.cursor/rules/ai-architecture.mdc`
4. `PRODUCT.md`
5. `README.md`
6. `CODEX_HANDOFF.md`

Depois disso, siga o próximo passo descrito em `CODEX_HANDOFF.md`.

## Estilo operacional

O usuário prefere:

```text
@ponytail
$caveman full
```

Tradução prática:

- seja direto;
- faça o menor diff correto;
- corrija causa raiz;
- não adicione dependência sem necessidade;
- preserve a arquitetura local-first;
- não exponha BDI, salários, custos ou margem no documento do cliente.

## Comandos de validação

Quando houver acesso local ao repo:

```powershell
npm ci
npm run verify
npm run security:audit:prod
npm run make:windows
```

Para mudança comum, `npm run verify` é o mínimo esperado.

## Release

Workflow principal:

```text
.github/workflows/build-windows-installer.yml
```

Regras:

- não use `[release]` no commit se não quiser criar release versionada;
- use `[release]` apenas quando o EXE precisa ser publicado como `build-N`;
- `windows-latest` é uma release fixa e pode mostrar idade antiga no GitHub mesmo com asset atualizado.

## Próximo alvo atual

Ver `CODEX_HANDOFF.md`. No momento, o próximo alvo sugerido é revisar a consistência dos totais comerciais nas listas/resumos de propostas, especialmente se `listCurrentProposals` ainda considera só itens e ignora mão de obra/BDI.

## Regra de rastro

Antes de encerrar qualquer avanço real, atualize `CODEX_HANDOFF.md` com:

```text
Data/hora BRT:
Commit:
O que mudou:
Validação:
Próximo passo:
Bloqueios:
```
