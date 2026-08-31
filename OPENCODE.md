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

## Skills (obrigatório no primeiro prompt)

O projeto usa o ecossistema `npx skills` para estender as capacidades dos agentes.
Antes de qualquer trabalho no código, instale as skills do projeto:

```powershell
npx -y skills add vercel-labs/skills@find-skills
```

As skills ficam em `.agents/skills/`. Quando o usuário pedir algo que pode ser resolvido por uma skill existente, use `npx skills find <termo>` para buscar no registry (skills.sh).

Skills já instaladas no projeto:

- `find-skills` (vercel-labs) — busca e instala skills do registry skills.sh. 3.2M installs.

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

Ver `CODEX_HANDOFF.md`. Último avanço: correção do tamanho inicial da janela para respeitar a área útil da tela. Próximo alvo: publicar release, instalar o novo EXE e validar o layout em `1280x720`.

## Regra de rastro para OpenCode e outras IAs

Antes de encerrar qualquer avanço real, atualize `CODEX_HANDOFF.md` para que Codex, OpenCode ou outra IA consigam continuar sem a conversa original.

Atualize também este `OPENCODE.md` quando o modo de retomada mudar, por exemplo:

- novo próximo alvo;
- novo fluxo de validação;
- nova regra de release;
- novo bloqueio externo;
- mudança importante na arquitetura.

O rastro deve ser concreto e operacional. Não escreva resumo genérico. Inclua sempre:

```text
Data/hora BRT:
Commit:
O que mudou:
Validação:
Próximo passo:
Bloqueios:
```

Nunca grave segredos, tokens, senhas, URLs assinadas temporárias, chaves de API ou dados sensíveis no rastro.

Se estiver sem contexto, pare e leia `CODEX_HANDOFF.md` antes de mexer no código. Se corrigir algo, atualize o handoff antes de devolver a tarefa.
