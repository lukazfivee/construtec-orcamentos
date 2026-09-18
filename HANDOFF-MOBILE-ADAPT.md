Projeto: Construtec Orcamentos. Deploy: npm run deploy:cloud. Dev: npm run dev:web.
Feito e deployado: logo mobile corrigido, icone 30px, avatar removido do topbar mobile (logout no menu hamburguer), grade 2 colunas nas acoes rapidas do Inicio, aba "Inteligencia Comercial" encurtada.

## 2026-09-17 (continuacao apos /clear) — Tela de itens da proposta em modo "operar" (Variante 3)

Pendencia da rodada anterior: tabela de itens da proposta (ProposalItemsPanel) ainda forcava scroll horizontal no celular (min-width 900px). 3 variantes de redesenho foram prototipadas em qa-proposals.tsx/html (nao commitadas, uso descartavel) e apresentadas ao usuario via portal Maestri; usuario escolheu a Variante 3 (modo operar, gestos nativos: swipe pra duplicar/excluir, FAB pra inserir, toque abre folha de edicao).

Implementado na tela real:
- `src/renderer/ProposalItemCard.tsx` (novo): cartao com swipe horizontal (pointer events) revelando Duplicar/Excluir; tocar sem arrastar abre a folha de edicao.
- `src/renderer/ProposalItemEditSheet.tsx` (novo): folha inferior com Descricao/Quantidade/Unidade/Custo/Venda (mesmos campos e acoes da linha da tabela desktop, autosave no blur), badge de custo divergente do catalogo, Duplicar/Excluir/Fechar.
- `src/renderer/ProposalItemsPanel.tsx`: renderiza a lista de cartoes + FAB de inserir (reaproveita `ProposalCatalogPopover` existente) sempre no DOM; toolbar ganhou classe `bulk-only` nos botoes que dependem de selecao multipla (Excluir em lote, Duplicar/Mover) — esses somem no celular porque cada cartao ja resolve duplicar/excluir individualmente.
- `src/mobile-responsive.css`: `.table-region` escondida e `.proposal-items-cards`/`.proposal-items-fab` mostrados so no media query (max-width 767px); estilos do cartao, swipe, FAB e folha de edicao. Desktop inalterado (cartoes/FAB tem `display:none` por padrao, fora do media query).

Validado: typecheck limpo; `npm run test:critical` 23/23 (1 ignorado). Verificacao visual ao vivo via portal Maestri (390x844, UA iOS) contra uma instancia isolada e descartavel da API local (porta 5178, dados em pasta temporaria) — nao usei nem toquei no banco local real do app (`%APPDATA%\Construtec Orçamentos`) nem nas credenciais do usuario. Confirmado: cartao renderiza dados corretos, toque abre folha de edicao, edicao de quantidade persiste via API real, swipe calcula o deslocamento e revela as acoes corretamente (checado via eventos de ponteiro simulados), FAB aparece so no mobile, tabela/toolbar desktop 100% intactos em 1600x900. Instancia de teste e arquivo de script descartavel removidos ao final; `vite.renderer.config.mjs` (proxy da API) revertido para a porta original.

Pendente: nada bloqueando; falta so o commit (nao feito ainda, aguardando instrucao do usuario).

### Correcao adicional: chevron de recolher no Resumo comercial nao funcionava

Usuario notou (olhando o proprio portal Maestri): "Resumo comercial" e "Parametros internos" (aside `ProposalSummaryPanel`) tinham um icone de seta que sugeria poder recolher a secao, mas nao fazia nada (elemento decorativo, sem onClick). Corrigido: os dois titulos viraram botoes reais (`panel-title-toggle`, `panel-section-toggle` em `src/index.css`) com estado de colapso independente (`summaryCollapsed`/`paramsCollapsed` em `ProposalSummaryPanel.tsx`); recolher "Resumo comercial" esconde as 5 linhas de valores (Materiais/Mao de obra/Custo base/BDI/Final), recolher "Parametros internos" esconde BDI/Impostos/Encargos. A secao "Acoes" (Criar revisao, Clonar, Exportar etc.) permanece sempre visivel. Valido em mobile e desktop (verificado ao vivo pelos dois breakpoints); typecheck e test:critical continuam passando.

### Ajuste seguinte: manter o item mais importante visivel ao recolher

Usuario pediu para, ao recolher uma secao, nao sumir com tudo -- deixar so o item mais importante aparente (e pediu o mesmo pra secao "Acoes", que ainda nao tinha nenhum toggle). Ajustado: "Resumo comercial" recolhido mantem "Valor Final da Proposta"; "Parametros internos" recolhido mantem "Multiplicador BDI"; "Acoes" ganhou seu proprio toggle (igual ao padrao das outras duas) e recolhida mantem so "Gerar PDF + Word" (a acao primaria, unico botao com classe `primary generate`). Validado ao vivo em desktop (a mesma logica de colapso, sem CSS especifico de mobile, entao vale pros dois breakpoints); typecheck e test:critical 23/23 continuam passando.

### Ajuste seguinte: remover aviso de custos-base no mobile + aproximar do prototipo

Usuario comparou lado a lado com o prototipo (`qa-proposals.tsx`) e pediu 3 ajustes:
1. Remover o banner "Custos-base preservados nesta revisao" (`.frozen-state`) no mobile -- `display:none` so dentro do media query (desktop mantem, ja publicado).
2. Abas da secao (Itens/Mao de obra/Kits/Condicoes/Historico) virarem pilulas arredondadas (ativa = azul preenchido), como no prototipo, em vez do sublinhado do desktop.
3. Barra de busca sempre visivel acima da lista de itens (nao mais atras do icone de filtro), com o filtro por categoria continuando recolhido por padrao atras do funil; o botao "+ Inserir" da toolbar some no mobile (o FAB ja cobre a mesma funcao, sem duplicidade).

Validado ao vivo (mobile 390x844 e desktop 1600x900, instancia isolada e descartavel) via screenshot real: pilulas, busca funcionando com filtragem ao vivo, funil abrindo so a categoria (sem duplicar a busca), FAB continua funcionando, desktop pixel-a-pixel igual a antes. typecheck e test:critical 23/23 ok. Commits: `1e5c589` (aviso removido) e `2dc636e` (pilulas + busca).

### Ajuste seguinte: consolidar FAB (menu) e Resumo comercial (chip + folha)

Usuario pediu 2 coisas a mais, comparando com a Variante 3 do prototipo:
1. O (+) devia ter dentro dele as funcoes de filtro e do "..." (Importar, Colunas), alem do que ja tinha (inserir do catalogo). Implementado: `.proposal-items-fab-menu`, um menu que abre ao tocar o (+); funil e "..." somem da toolbar no mobile (redundantes).
2. Aviso: as abas ficaram arredondadas demais (igual a Variante 1, raio 999px); corrigido pra 7px (Variante 3, a escolhida).
3. Depois, usuario mandou 2 prints do prototipo (chip "VALOR FINAL" fixo no rodape + folha "Resumo & acoes" com o detalhamento financeiro e todas as acoes) e pediu pra ficar assim. Implementado: `.proposal-summary-chip` (fixo acima da nav inferior, sempre visivel) + `.proposal-summary-sheet` (abre ao tocar o chip) com Materiais/Mao de obra/Custo base/BDI/Impostos/Valor final, os campos editaveis de Multiplicador BDI e Impostos (nao existiam no prototipo, que era estatico -- adicionados pra nao perder a funcionalidade real), e todas as acoes (Criar revisao, Clonar, Preview, Exportar, Compartilhar, Gerar Centro de Custo, Excluir). A sidebar "Resumo comercial" desktop fica `display:none` no mobile (substituida pelo chip+folha); FAB da lista de itens subiu de posicao pra nao sobrepor o chip novo.

Armadilha de teste (nao e bug real): usar a tecla Enter via automacao pra forcar blur no input de BDI dentro da folha nao disparava o `onBlur` de forma confiavel (parecia que o valor nao persistia). Chamar `blur()` diretamente confirmou que o fluxo real (o mesmo `updateBdi` ja usado no desktop) funciona perfeitamente e persiste apos reload -- em uso real (toque humano tirando o foco do campo) isso nao acontece.

Validado ao vivo (instancia isolada e descartavel, mobile e desktop). typecheck e test:critical 23/23 ok. Commit: `c77af31`.

### Correcao pontual: !important divergente deixava o funil visivel

Usuario reportou 2x que o icone de filtro (funil) continuava aparecendo no mobile mesmo apos o commit acima. Causa: `.toolbar .icon-button{display:inline-grid!important}` (regra base do desktop) tem `!important`; a regra que escondia `.filter-toolbar-btn` no mobile nao tinha, entao perdia a briga de especificidade independente de media query/ordem. Corrigido igualando a `!important` (mesmo padrao ja usado por `.toolbar-more-toggle` ao lado). Commit `f41008e`, deploy `a528729e`.

### Redesign da aba "Mao de obra" no mobile

Usuario pediu o mesmo tratamento pra aba Mao de obra: formulario de grid (3-5 colunas, sem breakpoint mobile proprio) forcava scroll horizontal e cortava rotulos. Vira 1 coluna no celular; a tabela de 13 colunas vira cartoes (nome da funcao + custo total + horas da equipe, toque abre edicao com scroll automatico ate o formulario, botao de excluir por cartao) -- mesmo padrao da lista de itens. Desktop inalterado. Validado ao vivo (adicionar/editar/excluir funcionando, desktop pixel-a-pixel igual). Commit `e1e8fda`, deploy `79be7c52`.

### Redesign da aba "Historico" no mobile

Mesmo tratamento pra aba Historico: tabela de 7 colunas (min-width 850px) vira cartoes por revisao (numero+badge Atual, status, itens, responsavel, data, venda total em destaque, Consultar/Aberta + Comparar). Cabecalho da secao empilha em coluna. Fora de escopo por ora: o modal "Comparativo de Revisoes" (ProposalDiffModal, aberto pelo botao Comparar) tem sua propria tabela larga e complexa, ainda nao adaptada -- componente maior, redesign separado se o usuario pedir. Validado ao vivo (2 revisoes reais, Consultar/Comparar funcionando, desktop inalterado). Commit `0a8baf6`.

Nota de processo (a partir desta rodada): usuario pediu para SEMPRE publicar automaticamente apos validar, sem perguntar (memoria salva: `feedback_always_deploy_construtec_orcamentos`).

### Consolidacao de "abas abertas" + Cliente/Obra/Status no mobile

Usuario apontou as duas faixas do topo (abas abertas de propostas + Cliente/Obra/Status/Validade/Responsavel) forcando scroll horizontal duplo -- pediu 3 variantes so dessa parte (`qa-header-variants.tsx/html`), depois pediu pra focar so nessa area (nao no topbar) e escolher "a de melhor design". Implementado: barra compacta (numero+REV+status) sempre visivel; toque abre folha com abas abertas em cima e a `ProposalMetaBar` real (mesma edicao de Cliente/Obra via popover e Status via select) empilhada embaixo, so com CSS diferente -- nao duplicou logica de negocio. Popover de cliente/obra tambem ganhou tratamento de folha fixa no mobile (antes 520px fixos, estourava a tela). Desktop 100% inalterado. Validado ao vivo (edicao real de Cliente/Obra e Status funcionando, refletindo na barra compacta). Commit `7ed01cf`.

### Polish via Impeccable na folha "Proposta"

Usuario pediu pra melhorar o design dessa folha usando o skill Impeccable (`.agents/skills/impeccable`, `impeccable context` carregado com PRODUCT.md/DESIGN.md/surface brief). Dois defeitos reais encontrados: (1) `.status-select` (chip de 28px no desktop) inflado pela regra global mobile de anti-zoom do iOS (`select` nao sofre desse zoom, a regra so distorcia o chip) -- corrigido pra 30px/12px so dentro da folha; (2) selo "Aberta" emprestava a cor semantica de status "Em revisao" por acidente -- trocado por uma tag propria (`.current-tag`, mesmo par de cores do `.rev-badge`). Tambem ajustada a escala tipografica pra bater exatamente com o DESIGN.md (Title 14px, Label 10px) em vez de valores arbitrarios. Desktop inalterado (confirmado `.status-select` ainda 28px). Commit `f69639c`.

### Botao "Gerar Centro de Custo" -> "Ir para Centro de Custo" (feature nova, nao so mobile)

Usuario pediu: ao reabrir uma proposta cujo Centro de Custo ja foi gerado, deve ter um botao que leva direto pra tela certa da obra certa no app Centro de Custos -- hoje isso so existia como estado local do componente (`ProposalSyncDirectAction`), perdido ao trocar de aba/sessao.

Persistido no banco: migracao `011-integration-outbox-result.ts` adiciona `cost_center_id`/`contract_id`/`center_url` em `integration_outbox`, preenchidos no sucesso de `syncProposalDirectly`. `getProposalById` faz join com o outbox `delivered` mais recente e expoe os 3 campos em `ProposalDetail`. O componente agora inicializa e reage a troca de proposta a partir desses campos persistidos (nao so do resultado de uma acao recem-feita); o botao principal, ja gerado, navega direto pra obra certa via deep link `#obra=<id>` (corrigido tambem no caminho de janela externa, que antes so abria a raiz do app, nao a obra especifica).

De quebra, usuario pediu pra melhorar o design do modal de confirmacao (ao ve-lo) e tirar "vicios de linguagem de IA" do texto: modal reescrito com as classes `.modal-*` ja usadas no resto do app (era estilo inline solto) e copy simplificado, removendo jargao como "Selo Canonico RFC 8785 (SHA-256)" e "Etapa 02 da Esteira Construtec", mantendo o significado real.

Validado ao vivo com um mock HTTP local no lugar do Centro de Custos real (nunca tocou producao): aprovar -> sincronizar -> reload completo -> botao mostra "Ir para Centro de Custo" e o deep link (`#obra=4242` no teste) funciona tanto na navegacao interna (iframe) quanto na janela externa. typecheck e test:critical (23/23) ok. Desktop inalterado. Commit `d6e8b87`, ainda sem deploy (envolve migracao de banco, aditiva e segura, mas registrando aqui por ser diferente do padrao so-CSS das entradas anteriores).