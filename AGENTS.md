# Regras do agente

Estas regras valem para todo o repositório.

## Modo de trabalho

- Use `ponytail` em mudanças de código: menor solução correta, sem abstração futura, sem dependência nova sem necessidade clara.
- Corrija causa raiz. Antes de alterar uma função compartilhada, procure seus chamadores.
- Use `caveman full` na comunicação com o usuário: português curto, direto, sem floreio.
- Use Context7 quando a mudança depender de API, biblioteca, framework ou comportamento atual que possa ter mudado. Primeiro resolva o library ID; depois consulte docs. Não envie segredos nem dados sensíveis ao Context7.
- Use `.cursorrules` e `.cursor/rules/ai-architecture.mdc` como guardrails de arquitetura para assistentes no editor.

## Skills

- No primeiro prompt de cada sessão, rode: `npx -y skills add vercel-labs/skills@find-skills`
- Skills ficam em `.agents/skills/`. Leia `SKILL.md` de cada skill instalada quando for relevante.
- Use `npx skills find <termo>` para buscar skills do registry (skills.sh) quando o usuário pedir funcionalidade que pode já existir como skill.
- Sempre verifique install count e reputação da fonte antes de instalar uma skill nova.

## Produto

- App desktop Electron local-first para orçamentos da Construtec.
- Preserve dados comerciais internos: BDI, salários, custos e margens não devem aparecer em PDF/Word do cliente.
- Prefira fluxo simples e seguro para orçamento: materiais, mão de obra, condições comerciais, revisão e exportação.

## Rastro de continuidade

- Antes de encerrar qualquer bloco com avanço real, atualize `CODEX_HANDOFF.md`.
- Se o próximo operador puder ser outra IA/editor, mantenha `OPENCODE.md` coerente com o handoff.
- O rastro deve permitir continuar sem ler a conversa original do Codex.
- Registre no mínimo: data/hora BRT, commit, o que mudou, validação, próximo passo e bloqueios.
- Não coloque segredos, tokens, senhas, URLs assinadas temporárias ou dados sensíveis nesses arquivos.

## Colaboração com Codex

- Trabalho conjunto Opencode + Codex: toda alteração deve ser sinalizada para o outro agente.
- Na mesma PR/branch, atualize `CODEX_HANDOFF.md` (seção Estado atual / Próximas etapas) com: o que mudou, por que, arquivos afetados e como testar localmente.
- Antes de merge, faça rebase/merge de `main` e resolva conflitos preservando alterações do Codex — nunca sobrescreva sem integrar.
- Use branches `opencode/*` e `codex/*` e PRs descritivos para rastreabilidade cruzada.
- Ao tocar módulo que o Codex alterou (`git log --oneline -20` + `CODEX_HANDOFF.md`), revise chamadores e mantenha contratos em `src/shared/*`.

## Checks

- Antes de mudança substancial, faça um pre-flight curto cobrindo as camadas relevantes: frontend, dados, auth, APIs, CI/CD, segurança, rate limit, cache/performance, escala e observabilidade.
- Para app local-first, RLS/stateless/cloud-native só se aplica quando houver backend remoto ou serviço compartilhado; não force complexidade no PGlite local.
- Para mudança de código, rode ou confirme no CI: `npm run verify`.
- Para instalador Windows, workflow principal esperado: `Gerar instalador do Windows`.
- Não gere EXE por curiosidade; gere quando mudança precisa ser testada no app instalado ou quando usuário pedir.
