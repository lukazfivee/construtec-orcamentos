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