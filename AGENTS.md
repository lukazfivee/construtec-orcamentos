# Regras do agente

App Electron local-first de orçamentos da Construtec, com React, TypeScript e PGlite.

## Regras universais

- Use `ponytail`: menor solução correta, causa raiz, sem abstração ou dependência sem necessidade.
- Antes de alterar função compartilhada, procure chamadores e preserve contratos em `src/shared/*`.
- Preserve alterações existentes do usuário; nunca descarte ou sobrescreva trabalho local sem autorização.
- Nunca exponha BDI, salários, custos, margens ou parâmetros internos em PDF/Word do cliente.
- Preserve funcionamento offline e integridade dos dados locais.
- Comunique em português curto usando `caveman full`.

## Instruções sob demanda

- Mudança substancial de código, arquitetura, segurança, CI ou release: leia `.cursor/rules/ai-architecture.mdc`.
- Retomada de trabalho ou estado atual: sincronize com `origin/main`, preserve mudanças locais e leia `CODEX_HANDOFF.md`.
- API, biblioteca ou framework com comportamento atual variável: consulte Context7 sem enviar segredos.
- Skill aplicável: leia seu `SKILL.md`; busque no registry apenas quando necessário e avalie fonte/adoção antes de instalar.

## Validação e continuidade

- Mudança de código: rode `npm run verify` ou confirme CI equivalente.
- Gere instalador somente quando necessário para teste instalado ou quando solicitado.
- Antes de encerrar avanço real, atualize `CODEX_HANDOFF.md` com data/hora BRT, base/commit, mudanças, validação, próximo passo e bloqueios.
- Atualize `OPENCODE.md` somente quando o fluxo de retomada mudar.
- Nunca registre segredos, credenciais, cookies, tokens ou URLs temporárias.
