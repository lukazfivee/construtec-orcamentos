# Importar compras do WhatsApp no Centro de Custos - design

Data: 2026-10-30 (BRT). Status: rascunho para aprovação.

## Intenção e porquê

O grupo de WhatsApp "controle de custos" recebe, em texto livre, os pagamentos a fornecedores e o centro de custo de cada compra. Hoje isso precisa ser digitado de novo no Centro de Custos. Objetivo: colar a mensagem no Centro e ter as compras e os centros de custo novos lançados direto, sem redigitar.

## Formato real das mensagens

Cabeçalho "CONTROLE DE CENTRO DE CUSTOS", seguido de blocos numerados, um por pagamento a um fornecedor ("1 - PAGAMENTO EXSAT", "2 - PAGAMENTO ELETRICA CAPITAL").

- Formato A (bloco 1): `R$ valor - descrição do material`, seguido de `CENTRO DE CUSTO: finalidade - obra` (ex.: "MANUTENÇÃO NAS 10 PORTAS - HCP").
- Formato B (bloco 2): `R$ total` e depois linhas `Destino – descrição – R$ valor`. O destino faz o papel de centro de custo. A soma das linhas (1.091,36 + 837,55 + 609,13) é igual ao total (2.538,04).
- Variações esperadas: acentos, caixa alta/baixa, espaço antes de vírgula, sufixos de obra (`_HCP`), linhas sem centro de custo.

## Objetivos

- Colar a mensagem no Centro e lançar compras e centros novos de uma vez, vendo o resultado depois (o que entrou, o que ficou pendente).
- Entender os dois formatos acima e variações razoáveis.
- Nunca lançar valor errado em silêncio.

## Fora de escopo (não objetivos)

- Ler o grupo automaticamente (número oficial da Business API ou número dedicado). Fica para depois: só troca a entrada, o leitor e o lançamento são os mesmos.
- OCR de fotos de nota fiscal e transcrição de áudio.
- Responder no grupo de WhatsApp.

## Anti-objetivos (falha mesmo funcionando)

- Lançar valor ou centro errado sem aviso.
- Criar centros duplicados por diferença de grafia.
- Perder a mensagem original, impedindo auditar ou desfazer.

## Restrições

- Funcionar com o app local-first (Electron) sem quebrar o uso offline do Orçamentos. A importação exige internet, pois o Centro é nuvem e a extração usa IA.
- Nunca expor BDI, salários, custos, margens ou parâmetros internos em PDF ou Word de cliente. Esta feature não gera documento de cliente.
- Sem emojis e sem texto decorativo na interface.
- Segredos (chave da IA, chave de serviço) ficam só no servidor, nunca no cliente.
- O texto colado vai a um provedor de IA. Não enviar nada além da própria mensagem.

## Abordagens consideradas

1. **Colar no app (escolhida pelo usuário).** Botão "Importar do WhatsApp" no Centro. Sem integração nova, sem risco de bloqueio, funciona já.
2. **Número oficial da Business API.** Estável e permitido, mas não lê o grupo existente: alguém encaminha cada mensagem. Exige verificação na Meta e servidor sempre ligado.
3. **Número dedicado no grupo, com biblioteca não oficial.** Automático, mas contra os termos do WhatsApp, com risco de banir o número, e precisa de servidor 24h.

Escolhida a 1, porque o trabalho difícil é o leitor e o lançamento seguro, que as três compartilham. As opções 2 e 3 ficam como evolução, trocando só a entrada.

## Decisões do usuário

- Lança direto, sem etapa de rascunho ou aprovação.
- Entrada por colar texto no app (abordagem 1).
- Compras entram como `pendente`, nunca liquidadas.
- A categoria de cada compra é escolhida pela IA entre as categorias de despesa ativas do Centro.
- O papel `financeiro` também pode importar.

## Minhas escolhas (marcadas para conferência)

- Extração por IA com validação por regras. Regex pura quebraria nas variações de texto livre.
- Cada bloco só é lançado se a soma dos itens bater com o total informado (quando há total). Se não bater, o bloco não é lançado e o motivo aparece na tela.
- Centro novo só é criado se o nome não for parecido com um existente. Se for parecido, reaproveita o existente (resolve o caso "_HCP").
- Cada lançamento guarda a mensagem original, quem importou e quando, e pode ser desfeito.
- Linha sem centro de custo não é lançada e aparece como pendência na tela de resultado.
- Importar a mesma mensagem duas vezes não duplica lançamentos (identificada por hash do texto e do item).
- Permissões: importar exige `p2` (admin, gestor, financeiro, engenharia já lançam); não cria permissão nova. O usuário pediu que o financeiro importe. Criar centro novo continua exigindo `p5` (admin, gestor), como no Centro. Quando um financeiro importa e a linha pede centro novo, a linha vira pendência ("centro não existe, peça a admin ou gestor"), e as demais entram. Esta é minha leitura; se quiserem que o financeiro crie centros, é mudança na matriz do Centro e deve ser decidida à parte. Engenharia e técnico respeitam o escopo de obras (`assertObra`).
- A tela de resultado aparece depois do lançamento, não antes: mostra o que entrou, o que ficou pendente e o botão "desfazer". Não há aprovação prévia.
- Valores e datas: números no formato brasileiro ("1.091,36") são lidos por código, e o valor extraído pela IA precisa aparecer literalmente no texto, senão o item vira pendência. A IA só estrutura o texto, não calcula. A data da compra é a da importação, pois a mensagem não traz data.
- Semelhança de centro: entre erro de duplicar um centro e erro de juntar compra no centro errado, o segundo é pior. Por isso só reaproveita centro existente quando o nome é igual depois de normalizar (caixa, acento, espaços, sufixo de obra). Na dúvida, cria um centro novo.
- Chave anti-duplicidade: hash da mensagem, posição do bloco e posição da linha. Colar a mesma mensagem de novo não duplica, mas dois itens iguais em mensagens diferentes continuam valendo.
- Desfazer: como as compras entram pendentes, desfazer é excluir o lançamento pendente, por importação inteira ou por compra, enquanto a competência estiver aberta e a compra não tiver sido liquidada. Depois disso só por estorno normal do Centro, fora desta feature. Um centro criado pela importação só some se ficar sem compras.
- Categoria: a IA só pode escolher uma categoria de despesa ativa existente. Se nenhuma servir com segurança, usa "Outros" quando existir; senão a linha vira pendência na tela de resultado. A IA nunca cria categoria.
- Código do centro novo: gerado pelo sistema, seguindo o padrão de códigos já usado no Centro (único sem diferenciar caixa). O nome é o texto do centro normalizado.
- Competência fechada: a compra cuja data cai em mês fechado não é lançada e aparece como pendência.
- Limite de tamanho por colagem: 20 mil caracteres. Provedor de IA fica ao construtor, sem retenção de dados quando o provedor permitir.

## Onde o código vive

A feature pertence ao Centro de Custos (`lukazfivee/centro-custos-construtec`, Node/Express, PGlite, JS puro, limite de 350 linhas por arquivo). Este repositório (Orçamentos) só tem a ponte com o Centro e não muda.

## Fatos do Centro que moldam o design (lidos no código em 2026-10-30)

- "Centro de custo" é a tabela `cost_centers`: `code` (obrigatório, único sem diferenciar caixa), `name`, `kind` (`obra` ou `servico`), cliente, orçamento, datas. Não existe hierarquia finalidade/obra: é uma linha só.
- "Compra" é uma linha de `transactions` do tipo `despesa`: exige `cost_center_id`, `category_id` (obrigatória), `description`, `counterparty` (texto, não há vínculo obrigatório com `suppliers`), `amount > 0`, `transaction_date`, `financial_status` (`pendente` ou `liquidado`) e `client_id` (idempotência já existente para a fila offline do celular).
- Criar lançamento exige a permissão `p2` (admin, gestor, financeiro, engenharia). Criar centro exige `p5` (admin, gestor). Estornar exige `p4` (admin, gestor, financeiro).
- Competência fechada recusa novos lançamentos. Estorno só vale para lançamento aprovado e liquidado; pendente se edita ou exclui. Lançamento é imutável depois de liquidado, só por estorno.
- Já existe IA no celular do Centro (Gemini via Firebase AI Logic, `public/m/ia-config.js`). A extração pode reaproveitar esse provedor.

Consequências para este design (já tratadas nas decisões acima): compras pendentes se desfazem por exclusão, a categoria vem da IA, e criar centro novo exige permissão que `financeiro` não tem.

## O que fica para o construtor

- Modelo de dados do Centro (compras, centros, obras), rotas novas e telas.
- Escolha do provedor de IA e do prompt, desde que a saída seja estruturada e validada.
- Critério de semelhança de nomes de centro de custo.
- Testes com as mensagens reais acima como casos.
