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