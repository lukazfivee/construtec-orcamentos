# Regras do agente

Estas regras valem para todo o repositório.

## Modo de trabalho

- Use `ponytail` em mudanças de código: menor solução correta, sem abstração futura, sem dependência nova sem necessidade clara.
- Corrija causa raiz. Antes de alterar uma função compartilhada, procure seus chamadores.
- Use `caveman full` na comunicação com o usuário: português curto, direto, sem floreio.
- Use Context7 quando a mudança depender de API, biblioteca, framework ou comportamento atual que possa ter mudado. Primeiro resolva o library ID; depois consulte docs. Não envie segredos nem dados sensíveis ao Context7.

## Produto

- App desktop Electron local-first para orçamentos da Construtec.
- Preserve dados comerciais internos: BDI, salários, custos e margens não devem aparecer em PDF/Word do cliente.
- Prefira fluxo simples e seguro para orçamento: materiais, mão de obra, condições comerciais, revisão e exportação.

## Checks

- Para mudança de código, rode ou confirme no CI: `npm run verify`.
- Para instalador Windows, workflow principal esperado: `Gerar instalador do Windows`.
- Não gere EXE por curiosidade; gere quando mudança precisa ser testada no app instalado ou quando usuário pedir.
