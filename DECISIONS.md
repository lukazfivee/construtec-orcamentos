# Decisões

## Revisão de segurança do link do cliente (outubro/2026)

Decidido e implementado: M8 (p11 para excluir proposta, mudar status, reabrir e criar revisão; o pedido de ajuste do
cliente cria a revisão por dentro do serviço e não passa pelo guarda de rota).

Resolvidos na rodada de pendências baixas: B5, B12, S5 e também B8 (exportar não marca mais a outbox como entregue; só o aceite do Centro marca; snapshot sem linha de outbox ganha a linha; linhas com 72 tentativas viram `failed`), B9 (reserva atômica com FOR UPDATE SKIP LOCKED e coluna `claimed_at`, migração 019), B10 (o selo guarda `approvedAt` = aceite do cliente, `recordedBy` = quem confirmou e, dentro de `approval`, os campos opcionais `clientAcceptance` e `confirmedBy`), B13 (escrita de custo em itens e import-batch exige p10; no import-batch `unitCost: 0` é tolerado porque o app o envia por padrão), S1/S2 (só 401 de sessão desloga; chave de serviço recusada, rota inexistente e limite do Centro viram 503 em português) e S3 (link do cliente só na versão online: 409 no servidor sem banco e botão escondido no desktop).

S4 (p12) não se aplica ao Orçamentos: p12 trata de medições e este app não tem medições. Não será implementado aqui.

## Corpo da proposta montado pelo usuario (outubro/2026)

Coluna `proposals.body_blocks` (jsonb, migracao 020). NULL = documento no layout fixo de sempre, entao propostas antigas nao mudam.
Com corpo, a lista ordenada de blocos (`titulo`, `paragrafo`, `lista`, `itens`, `condicoes`) define a ordem do PDF, do Word, da pagina do
cliente e da pre-visualizacao; a tabela de itens existe uma vez e nao sai, as condicoes so se desligam. A fonte unica de limites,
limpeza de texto, variaveis (`{{cliente}}`, `{{obra}}`, `{{numero}}`, `{{revisao}}`, `{{valor_total}}`, `{{validade}}`, `{{responsavel}}`, nunca
custo, BDI ou margem) e ordem e `src/shared/proposalBody.ts`. O hash do aceite do cliente inclui o texto dos blocos ligados quando ha corpo
(sem corpo o hash e o mesmo de antes). O campo "Escopo comercial" deixou de existir na tela: vira o bloco "Escopo" do corpo, e
`proposals.scope` segue guardado (lista, Centro, clonagem). Modelos de texto e corpo padrao ficam em `app_settings`
(`body_templates`, `default_body_blocks`).
