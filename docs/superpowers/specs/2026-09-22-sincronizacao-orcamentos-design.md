# Sincronização Orçamentos ↔ Centro de Custos (sub-projeto 2)

Status: **aprovado pelo usuário em 22/09/2026 e implementado** (retorno de totais,
Cron de hora em hora, perfil Consulta também vê o bloco).

Substitui a referência a `2026-09-19-sincronizacao-orcamentos-design.md` citada
na spec de identidade compartilhada (repositório do Centro de Custos). Esse
arquivo nunca existiu.

## Ponto de partida (22/09/2026)

- **Orçamentos → Centro (existe):** ao aprovar uma proposta, o Orçamentos sela um
  envelope (SHA-256 canônico) e o envia para
  `POST /api/integracao/orcamentos/sync-direto` do Centro, com a chave de
  integração. O Centro cria ou atualiza o centro de custo, o contrato e a baseline
  imutável. A outbox guarda `cost_center_id`, `contract_id` e `center_url`.
- **Centro → Orçamentos (não existe):** depois de integrada, a proposta não sabe
  mais nada da obra: nem se ela está em execução, nem quanto já foi gasto, nem se
  o orçado estourou.
- A spec de identidade previa uma segunda frente: sincronizar propostas,
  catálogo, clientes e obras entre o **desktop** e a **nuvem** do Orçamentos. Pela
  prioridade da nuvem, ela fica fora desta proposta (ver "Fora do escopo").

## Proposta: retorno do Centro para a proposta integrada

### O que o usuário ganha

Na proposta aprovada e integrada, um bloco **Acompanhamento da obra** mostra:

- situação do centro de custo (planejamento, execução, pausado, concluído);
- valor do contrato e custo orçado da baseline vigente, com a versão;
- realizado até hoje (despesas liquidadas) e percentual do orçado;
- alerta quando o realizado passa do orçado ou há gasto não vinculado a insumo;
- data da última atualização e link "Abrir no Centro de Custos".

Tudo é somente leitura no Orçamentos. A fonte da verdade é o Centro, e nada é
alterado no Centro a partir dessa tela.

### Contrato novo no Centro

`GET /api/integracao/orcamentos/contratos/:contractId/resumo`, autenticado pela
mesma chave de integração (servidor a servidor):

```json
{
  "contractId": "...", "costCenterId": 12, "costCenterStatus": "execucao",
  "baseline": { "id": "...", "version": 2, "contractValueCents": 123456, "baseCostCents": 98765, "sealedAt": "..." },
  "realizedCents": 45678, "realizedPercent": 46.25,
  "overBudget": false, "unlinkedExpenseCents": 0,
  "updatedAt": "2026-09-22T12:00:00Z"
}
```

Valores em centavos, com arredondamento HALF_UP. As regras de cálculo são as que
a tela "Orçado vs realizado" do Centro já usa; nenhuma regra nova de negócio.

### Como o Orçamentos busca

- **Sob demanda:** ao abrir uma proposta integrada, o servidor do Orçamentos
  consulta o resumo e guarda uma cópia em `proposal_center_snapshots`
  (`proposal_id`, `contract_id`, `payload`, `fetched_at`).
- **Periódico:** o mesmo Cron horário do reenvio da outbox atualiza as cópias das
  propostas integradas em obras não concluídas.
- **Sem conexão:** mostra a última cópia com a data dela e o aviso
  "Dados de <data>".

### Segurança

- A chave de integração só existe no servidor. O navegador nunca fala direto com
  o Centro.
- A resposta traz apenas totais da obra ligada à proposta, sem lançamentos
  individuais nem dados de fornecedores.
- Todos os perfis do Orçamentos veem o bloco, `viewer` inclusive (decisão do
  usuário).

### Testes

- Centro: teste de integração do endpoint (chave inválida → 401; contrato
  inexistente → 404; cálculo em centavos com HALF_UP).
- Orçamentos: stub HTTP do Centro, cópia persistida, exibição da cópia antiga
  com o Centro fora do ar e atualização pelo Cron.

## Já feito nesta rodada

- Reenvio da outbox pelo Cron do Worker (`0 * * * *`): o Container dorme após
  5 minutos sem uso, e o reenvio de 30 s só rodava com ele acordado.

## Fora do escopo (decisão consciente)

- **Sincronização desktop ↔ nuvem do Orçamentos** (propostas, catálogo,
  clientes, obras, cache offline de contas). Na nuvem, todos já trabalham na
  mesma base, e o desktop é secundário. Se voltar a ser necessária, merece spec
  própria: é o item mais caro (conflitos de edição, IDs e revisões seladas).
- Qualquer escrita do Orçamentos no Centro além do envelope selado que já existe.
- Presença em tempo real e propostas privadas/rascunho (sub-projetos 4 e 5).

## Decisões do usuário (22/09/2026)

1. Escopo aprovado: retorno dos totais da obra para a proposta integrada.
2. O perfil `viewer` também vê o bloco de acompanhamento.
3. O Cron roda de hora em hora. A tela também atualiza ao abrir a proposta e pelo
   botão "Atualizar".

## Implementação

- Centro: `GET /api/integracao/orcamentos/contratos/:id/resumo`
  (`services/budgets/budgetContractSummary.js`).
- Orçamentos: migração 014 (`proposal_center_snapshots`; a 013 é a `centro_admin`),
  `services/integration/centerTracking.ts`, rota
  `GET /api/proposals/:id/center-tracking`, a passada do Cron em
  `runScheduledIntegrationPass` e o bloco `CenterTrackingCard` na proposta
  integrada.
