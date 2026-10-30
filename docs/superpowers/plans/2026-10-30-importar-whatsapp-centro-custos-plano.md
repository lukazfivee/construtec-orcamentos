# Plano: importar compras do WhatsApp no Centro de Custos

Data: 2026-10-30 (BRT). Design aprovado pelo usuário. Este arquivo é autossuficiente: outra sessão do Claude pode executá-lo sem o histórico da conversa.

Design completo: `docs/superpowers/specs/2026-10-30-importar-whatsapp-centro-custos-design.md` (repo `lukazfivee/construtec-orcamentos`, branch `claude/planejar-nova-feature-z36ebk`, PR #243).

## Onde trabalhar

- Repo da implementação: `lukazfivee/centro-custos-construtec` (Centro de Custos; Node/Express, PGlite/PostgreSQL, JS puro no frontend). O repo do Orçamentos não muda.
- Os dois repos são públicos. Não commitar mensagens, nomes de fornecedores, obras ou valores reais do usuário. Fixtures de teste devem ser anonimizados (exemplos abaixo).
- Antes de começar, leia no Centro: `AGENTS.md`, `CLAUDE.md`, `CODEX_HANDOFF.md`, `DECISIONS.md`. Regras que importam: sem emojis no frontend (ícones SVG), no máximo 350 linhas por arquivo, valores em centavos com HALF_UP, `npm test` e `npm run verify` antes de concluir, atualizar `CODEX_HANDOFF.md` ao terminar.
- Peça acesso de escrita ao repo do Centro (na sessão do Claude Code, anexar o repo com acesso de push). Crie uma branch própria a partir de `main`.

## O que a feature faz

No Centro, uma tela "Importar do WhatsApp" onde se cola a mensagem do grupo "controle de custos". A IA estrutura o texto, o servidor valida e lança direto, sem etapa de aprovação, compras (lançamentos de despesa pendentes) e centros de custo novos. Depois do lançamento, mostra o resultado (o que entrou, o que ficou pendente) e permite desfazer.

### Formato das mensagens (anonimizado)

```
*CONTROLE DE CENTRO DE CUSTOS*

*1 - PAGAMENTO FORNECEDOR A*

R$ 100,00 - 10 PACOTES DE MATERIAL X
CENTRO DE CUSTO: REPOSIÇÃO INTERNA - DISTRIBUIR NOS CENTROS

R$ 250,50 - FECHADURA
CENTRO DE CUSTO: MANUTENÇÃO NAS PORTAS - OBRA X

_______________________________

*2 - PAGAMENTO FORNECEDOR B*

R$ 300,00

Destino Um – Parte da compra de ferramental - R$ 100,00
Destino Dois – Cabo elétrico e módulo - R$ 150,00
Destino Três – Infra final do serviço - R$ 50,00
```

- Formato A: `R$ valor - descrição`, seguido de `CENTRO DE CUSTO: texto`.
- Formato B: `R$ total` e depois linhas `Destino – descrição – R$ valor`; o destino é o centro de custo; a soma das linhas deve igualar o total.
- Variações: acentos, caixa, espaço antes de vírgula, sufixo de obra (`_OBRAX`), linhas sem centro.

### Fatos do Centro (lidos no código em 2026-10-30)

- Centro de custo = tabela `cost_centers`: `code` (obrigatório, único sem diferenciar caixa), `name`, `kind` (`obra` ou `servico`). Rota de criação: `routes/costCenters.js`, permissão `p5` (admin, gestor).
- Compra = linha de `transactions` tipo `despesa`: `cost_center_id`, `category_id` (obrigatória), `description` (máx. 240), `counterparty` (texto, máx. 160), `amount > 0`, `transaction_date`, `financial_status`. Atenção: `validatePayload` em `lib/transactionPayload.js` assume `liquidado` quando `status_financeiro` não vem; esta feature DEVE enviar `pendente` explicitamente.
- Criar lançamento: `POST /api/lancamentos` em `routes/transactions.js` (319 linhas, perto do limite de 350; extrair o INSERT para uma função compartilhada em vez de duplicar). Permissão `p2` (admin, gestor, financeiro, engenharia). Usa `assertObra` (escopo de obras), `isMonthClosed` (`services/financialPolicy.js`), `validateRelations`, `ensureCreatedAudit`, `maybeAutoAllocateExpense`.
- Idempotência já existe: coluna `transactions.client_id UUID` com índice único `(created_by, client_id)` (migração 106) e `lib/transactionIdempotency.js`.
- Matriz de permissões em `services/permissions.js` (função `can`, `exigirPermissao`). Estorno é `p4`; não faz parte desta feature.
- Última migração: `119_logistica_materiais.sql`; a nova é `120_...`.
- IA existente: Gemini via Firebase AI Logic no cliente (`public/m/ia-config.js`, `public/d/ia-desktop.js`). Não há chamada de IA no servidor.
- Testes: `node --test`, arquivos em `test/*.test.js`; rotas montadas em `server.js` (`/api/...`).

## Decisões fechadas (usuário)

- Entrada: colar o texto no app (sem integração com WhatsApp nesta etapa).
- Lança direto, sem rascunho nem aprovação.
- Compras entram como `pendente`, nunca liquidadas.
- A IA escolhe a categoria entre as categorias de despesa ativas.
- O papel `financeiro` também pode importar.

## Decisões minhas (marcadas para conferência do usuário)

- Arquitetura: a IA roda no cliente (reaproveitando o Gemini/Firebase existente) e devolve itens estruturados; o servidor NÃO confia neles e revalida tudo de forma determinística, usando o texto original enviado junto. Evita chave de IA no servidor.
- Só desktop (`/d/`) nesta versão. Celular (`/m/`) fica para depois.
- Valores: números BR lidos por código; o valor devolvido pela IA tem de aparecer literalmente no texto, senão a linha vira pendência. A IA nunca calcula.
- Bloco com total: só lança se a soma das linhas bater com o total; senão o bloco inteiro fica como pendência com o motivo.
- Data da compra = data da importação (a mensagem não traz data). Mês fechado: linha vira pendência.
- Centro existente só é reaproveitado se o nome normalizado for igual (caixa, acento, espaços, sufixo de obra). Na dúvida, cria centro novo.
- Criar centro novo exige `p5`. Se quem importa não tem (ex.: financeiro), a linha vira pendência ("centro não existe; peça a admin ou gestor") e as demais entram.
- Categoria: só existente e ativa. Sem categoria segura: "Outros" se existir; senão pendência. A IA nunca cria categoria.
- Código do centro novo: gerado pelo sistema no padrão de códigos do Centro; nome = texto normalizado do centro.
- Idempotência: `client_id` determinístico = UUID formado pelos 16 primeiros bytes de `sha256(hash_do_texto + '|' + bloco + '|' + linha)`. Colar a mesma mensagem de novo não duplica.
- Desfazer: exclui os lançamentos pendentes da importação (todos ou um), com mês aberto. Remove o centro criado pela importação se ficar sem lançamentos. Compra já liquidada depois disso só por estorno normal do Centro, fora desta feature.
- Limite de 20 mil caracteres por colagem.

## Tarefas (TDD: teste primeiro, falhar, implementar, passar, commit)

Cada tarefa termina com commit pequeno. Rode `npm test` ao fim de cada uma.

### 1. Números em formato brasileiro
- Criar `lib/whatsappImport/money.js` com `parseBrl(texto)` -> centavos inteiros (ex.: `"R$ 1.234,56"` -> `123456`; aceita `R$`, espaços, ponto de milhar; rejeita lixo) e `findAmountsInText(texto)` -> lista de centavos presentes no texto.
- Teste: `test/whatsapp-import-money.test.js` com variações (`"R$ 279,20"`, `"1.203,92"`, `"R$2.221,50"`, texto sem valor, valores absurdos).

### 2. Normalização de nome de centro
- Criar `lib/whatsappImport/names.js` com `normalizeCenterName(texto)`: maiúsculas, sem acento, espaços colapsados, espaço antes de vírgula removido, sufixo `_ALGO` de obra removido na chave de comparação; função devolve `{ chave, nomeExibicao }`.
- Teste: pares que devem casar e pares que não devem; incluir `FOO , BAR` x `FOO, BAR_OBRAX`.

### 3. Conferência de blocos
- Criar `lib/whatsappImport/check.js`: `checkItems(texto, itens)` -> por item: ok ou motivo de pendência (valor ausente no texto, centro vazio, valor <= 0); por bloco: soma x total (em centavos).
- Teste: `test/whatsapp-import-check.test.js` com o exemplo anonimizado acima (soma 100+150+50 = 300 ok; variação com soma errada falha o bloco inteiro).

### 4. Migração e tabelas
- Criar `migrations/120_whatsapp_imports.sql`: `whatsapp_imports` (`id`, `public_id UUID`, `user_id`, `text_hash`, `source_text`, `created_at`) e `whatsapp_import_items` (`import_id`, `transaction_id`, `created_cost_center_id NULL`, `line_key`). Seguir o estilo das migrações anteriores (idempotente, índices). Conferir como o Centro roda migrações (`db.js`, `scripts/`) e se há teste que lista migrações.

### 5. Serviço de importação
- Criar `services/whatsappImport.js` (dividir em mais arquivos se passar de 350 linhas): `importar({ usuario, texto, itens })`.
  1. Rejeita texto > 20 mil caracteres.
  2. `checkItems`; resolve centros por chave normalizada contra `cost_centers`; cria centro novo só se `can(usuario, 'p5')`; gera `code` único.
  3. Valida categoria contra categorias de despesa ativas.
  4. Para cada linha válida: `assertObra`, `isMonthClosed`, insere a despesa `pendente` com `client_id` determinístico, `ensureCreatedAudit`, `maybeAutoAllocateExpense`; registra em `whatsapp_import_items`.
  5. Devolve `{ importId, lancados: [...], pendencias: [{linha, motivo}], centrosCriados: [...] }`.
- Extrair o INSERT de `routes/transactions.js` para uma função compartilhada (ex.: `lib/transactionInsert.js`) sem mudar o comportamento; os testes atuais de lançamentos precisam continuar passando.
- Testes de integração em `test/whatsapp-import.integration.test.js`: caminho feliz (formatos A e B), soma errada, valor que não aparece no texto, centro existente reaproveitado, centro novo criado (admin), centro novo vira pendência (financeiro), categoria inexistente, mês fechado, repetir a colagem não duplica.

### 6. Rotas
- Criar `routes/whatsappImport.js` e montar em `server.js`:
  - `POST /api/importacoes/whatsapp` (`exigirPermissao('p2')`): corpo `{ texto, itens }`.
  - `DELETE /api/importacoes/whatsapp/:id`: desfaz tudo; `DELETE .../:id/itens/:itemId` desfaz um. Só exclui lançamento ainda `pendente` em mês aberto, respeitando `assertObra`; registra auditoria.
  - `GET /api/importacoes/whatsapp` (últimas importações do usuário, para a tela de resultado).
- Testes de rota: permissão negada (tecnico, comercial), escopo de obra, desfazer remove centro vazio criado pela importação.

### 7. Extração por IA no desktop
- Criar `public/d/ia-whatsapp.js`: usa a configuração existente (`public/m/ia-config.js` via `CC.ia`, como `public/d/ia-desktop.js`). Envia o texto e a lista de categorias de despesa ativas; exige saída JSON no esquema `{ itens: [{ bloco, linha, fornecedor, descricao, valor_texto, centro, categoria_id, total_bloco_texto? }] }`.
- Instruções do prompt: copiar valores exatamente como estão no texto, não calcular, não inventar, devolver `centro` vazio quando não houver, escolher só `categoria_id` da lista fornecida.
- Testes do que for testável sem rede (montagem do prompt e validação do JSON devolvido).

### 8. Tela
- Criar `public/d/telas/importar-whatsapp.js` e registrar a rota no `router.js`/`app.js` do desktop; botão de entrada na tela de lançamentos. Textarea para colar, botão "Importar", resultado depois do lançamento (lançadas, pendências com motivo, centros criados) e botão "Desfazer". Sem emojis; ícones SVG como nas outras telas; texto sóbrio em português. Respeitar `D.podeTela` e permissões.
- Conferir no navegador o fluxo completo (colar, importar, resultado, desfazer) antes de concluir.

### 9. Fechamento
- `npm run verify` verde. Atualizar `CODEX_HANDOFF.md` (data/hora BRT, base/commit, mudanças, validação, próximo passo, bloqueios). Abrir PR em rascunho no repo do Centro e acompanhar o CI.

## Fora de escopo (próximas etapas)

- Leitura automática do grupo (número oficial da WhatsApp Business API, que não lê grupos existentes e exigiria encaminhar mensagens, ou número dedicado com biblioteca não oficial, contra os termos do WhatsApp e com risco de bloqueio). O leitor e o lançamento desta feature são reaproveitados.
- OCR de nota fiscal, áudio, resposta no grupo, versão para celular.

## Riscos a vigiar

- Lançar valor ou centro errado: por isso a revalidação no servidor, a regra de soma e a conferência literal do valor.
- Duplicar centros: normalização conservadora e chave determinística.
- `routes/transactions.js` perto do limite de linhas: extrair em vez de crescer.
- Permissões: `financeiro` não cria centro (`p5`); mudar isso é decisão à parte.
