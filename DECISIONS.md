# Decisões

## Revisão de segurança do link do cliente (outubro/2026)

Decidido e implementado: M8 (p11 para excluir proposta, mudar status, reabrir e criar revisão; o pedido de ajuste do
cliente cria a revisão por dentro do serviço e não passa pelo guarda de rota).

Resolvidos na rodada de pendências baixas: B5, B12, S5 e também B8 (exportar não marca mais a outbox como entregue; só o aceite do Centro marca; snapshot sem linha de outbox ganha a linha; linhas com 72 tentativas viram `failed`), B9 (reserva atômica com FOR UPDATE SKIP LOCKED e coluna `claimed_at`, migração 019), B10 (o selo guarda `approvedAt` = aceite do cliente, `recordedBy` = quem confirmou e, dentro de `approval`, os campos opcionais `clientAcceptance` e `confirmedBy`), B13 (escrita de custo em itens e import-batch exige p10; no import-batch `unitCost: 0` é tolerado porque o app o envia por padrão), S1/S2 (só 401 de sessão desloga; chave de serviço recusada, rota inexistente e limite do Centro viram 503 em português) e S3 (link do cliente só na versão online: 409 no servidor sem banco e botão escondido no desktop).

S4 (p12) não se aplica ao Orçamentos: p12 trata de medições e este app não tem medições. Não será implementado aqui.
