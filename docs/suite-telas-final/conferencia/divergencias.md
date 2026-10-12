# Lista de divergências (kit de conferência do Orçamentos)

Gerada por `npm run conferencia` em 2026-10-12 (ticket O1, #183). Não edite à mão: rode o comando de novo depois de corrigir.

Telas capturadas: 50. Telas com algum achado: 32. Achados no total (por tela, tema e resolução): 573.

Como ler: **[cortado]**, **[coberto]**, **[rolagem-aninhada]**, **[rolagem-horizontal]**, **[texto-cortado]** e **[sem-respiro]** são medidas do kit (valem para a regra "sem corte e sem rolagem aninhada"). **[cor]** compara os tokens com os de `DesktopOrc.dc.html`. **[texto]** lista textos fixos da Referência que não aparecem na tela (podem ser só palavras diferentes; confira o quadro citado). **[console]** são erros do navegador. **[kit]** é falha do próprio kit em chegar na tela.

Limite: os protótipos `.dc.html` só abrem no canvas do design (faltam `support.js` e `/_blob/`), então a comparação é por tokens, textos e lista de quadros, não por imagem lado a lado. Os quadros citados (ex.: 23c) são os da Rodada indicada em `docs/suite-desktop/prototipo-orcamentos/` e `docs/suite-mobile/prototipo/`. O Celular do Orçamentos só tem Referência para PDF, comparativo, importar e EXSAT (Rodadas 21 e 22); as demais telas do Celular só recebem medidas.

Prints em `docs/suite-telas-final/conferencia/prints/` (pasta ignorada pelo git; `prints/index.html` mostra tudo).

## Tokens de cor

Referência: DesktopOrc.dc.html (:root e [data-theme="escuro"])

- [cor] --c-warn-soft é rgba(242, 181, 68, .14), a Referência pede #3a2a0c (escuro desktop)

## Desktop novo: Início

Referência: sPainel · quadros 23b Início do Orçamentos

- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Bom dia, Marina" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Propostas abertas, o que precisa de você e os preços do catálogo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Ver propostas" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Precisam de ação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Funil de propostas" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Valor final por situação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "EX" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Integração EXSAT" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto-resumo] 8 de 10 textos fixos de sPainel ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [coberto] button.assistant-fab: 3 elemento(s), ex.: table.home-proposals-table "NÚMERO CLIENTE / OBRA STATUS ITENS VALOR"; tr "PA-1054REV 00 Edifício Horizonte Edifíci"; button.open-proposal-btn "Abrir" (claro 1280x800; escuro 1280x800)

## Desktop novo: Propostas (lista)

Referência: sProps · quadros 23c Propostas

- [coberto] button.assistant-fab: 1 elemento(s), ex.: strong "R$ 313.789,99" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Da edição à aprovação, com o valor final de cada revisão" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Buscar por obra, cliente ou número" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Filtrar propostas" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Situação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Valor final" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Margem" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Sem permissão de ver margem" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Nenhuma proposta com esse filtro." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto-resumo] 8 de 16 textos fixos de sProps ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)

## Desktop novo: Proposta: Itens

Referência: sProp · quadros 23f Itens editáveis; 23e Resumo com aviso de preço

- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Comparar revisões" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Abrir obra no Centro de Custos" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Atualizar preços desta proposta?" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Agora não" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Ver e atualizar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Margem" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Custo, BDI e margem aparecem só para quem tem a permissão de ver custos." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Por sistema" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Parte do valor final" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Dados da proposta" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "PDF da proposta" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Mude as quantidades direto na tabela. Itens com preço novo no EXSAT ganham o botão Atualizar." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "BDI e impostos" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Adicionar itens" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Criar nova revisão" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Diminuir" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Aumentar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Atualizar preço" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Remover item" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Esta proposta ainda não tem itens. Use Adicionar itens para buscar no catálogo ou num kit." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Histórico de revisões" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "A mais nova em cima" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Comparar com a atual" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Só a revisão em edição pode ser alterada. Revisões enviadas ou aprovadas ficam congeladas, com os preços de quando foram montadas." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto-resumo] 24 de 31 textos fixos de sProp ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800)

## Desktop novo: Proposta: Mão de obra

Referência: sProp

- [cortado] cortado por section.proposal-editor (horizontal): 23 elemento(s), até 63 px, ex.: table.labor-table "FUNÇÃO PROF. SALÁRIO ALIMENTAÇÃO TRANSPO"; tr "FUNÇÃO PROF. SALÁRIO ALIMENTAÇÃO TRANSPO"; th "CUSTO TOTAL" (claro 1440x900; escuro 1440x900)
- [coberto] button.assistant-fab: 4 elemento(s), ex.: table.labor-table "FUNÇÃO PROF. SALÁRIO ALIMENTAÇÃO TRANSPO"; tr "Instalador 6 6,00 3.200,00 600,00 300,00"; tr "Total de mão de obra R$ 160.363,63" (claro 1280x800; escuro 1280x800)
- [cortado] cortado por section.proposal-editor (horizontal): 31 elemento(s), até 205 px, ex.: table.labor-table "FUNÇÃO PROF. SALÁRIO ALIMENTAÇÃO TRANSPO"; tr "FUNÇÃO PROF. SALÁRIO ALIMENTAÇÃO TRANSPO"; th "HORAS DA EQUIPE" (claro 1280x800; escuro 1280x800)
- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800)

## Desktop novo: Proposta: Kits

Referência: sProp · quadros 23g Adicionar itens

- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800)

## Desktop novo: Proposta: Corpo e condições

Referência: sProp

- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800)

## Desktop novo: Proposta: Histórico (revisões)

Referência: sProp · quadros 23j Revisões

- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800)

## Desktop novo: Proposta: menu Inserir

Referência: dAdd · quadros 23g Adicionar itens

- [texto] texto da Referência (dAdd) que não aparece em nenhum estado capturado: "Origem" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (dAdd) que não aparece em nenhum estado capturado: "Buscar por nome ou código" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (dAdd) que não aparece em nenhum estado capturado: "Na proposta" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (dAdd) que não aparece em nenhum estado capturado: "Nada encontrado no catálogo." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (dAdd) que não aparece em nenhum estado capturado: "Adicionar kit" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto-resumo] 5 de 6 textos fixos de dAdd ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800)

## Desktop novo: PDF da proposta

Referência: sPdf · quadros 23m Pré-visualização; 23n Compartilhar; 23o Enviar ao cliente; 23p Engenharia · resumido sem capa

- [coberto] button.assistant-fab: 1 elemento(s), ex.: p.pdf-hint "O cliente vê só preços de venda. Custo, " (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Compartilhar não muda a situação da proposta." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Proposta comercial" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Emitida em" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Válida até" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Responsável" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Sistemas" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Construtec Engenharia · Sistemas especiais" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Qtd." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Unitário" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Valor total da proposta · impostos inclusos" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Construtec Engenharia" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Atualizando a pré-visualização…" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Gerando a pré-visualização do PDF…" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Sem itens para o PDF" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Adicionar itens" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Não deu para gerar o PDF" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "O PDF é montado no servidor e o computador está sem internet. Suas escolhas de modelo e capa ficam guardadas." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sPdf) que não aparece em nenhum estado capturado: "Tentar de novo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto-resumo] 18 de 37 textos fixos de sPdf ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [cortado] cortado por div.pdf-thumbs (vertical): 2 elemento(s), até 30 px, ex.: button "5 · Condições"; small "5 · Condições" (claro 1280x800; escuro 1280x800)

## Desktop novo: Comparativo de revisões

Referência: sCmp · quadros 23q REV 01 × REV 03; 23r Só o que mudou; 23s PROP-041 · em edição

- [coberto] button.assistant-fab: 2 elemento(s), ex.: table.compare-table "ITEM REV 00 TOTAL REV 01 TOTAL DIFERENÇA"; tr.row.same "Item de teste 128 para conferência de ta" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sCmp) que não aparece em nenhum estado capturado: "Nada mudou entre as duas revisões." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sCmp) que não aparece em nenhum estado capturado: "Para comparar, a proposta precisa de pelo menos duas revisões. Quando o cliente pedir ajustes, crie uma nova revisão e volte aqui." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sCmp) que não aparece em nenhum estado capturado: "As revisões antigas ficam no servidor e o computador está sem internet. A revisão atual continua aberta na proposta." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sCmp) que não aparece em nenhum estado capturado: "Tentar de novo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto-resumo] 4 de 16 textos fixos de sCmp ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)

## Desktop novo: Catálogo

Referência: sCat · quadros 24a Catálogo EXSAT

- [coberto] button.assistant-fab: 3 elemento(s), ex.: table.od-tbl "ITEM CATEGORIA UNID. CUSTO MUDANÇA DE PR"; tr "Treinamento de usuários (até 8h) SER-TRE"; td.od-small "PA-1054" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sCat) que não aparece em nenhum estado capturado: "Seu perfil não vê preços de custo. A coluna Custo fica escondida; o resto do catálogo funciona igual." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sCat) que não aparece em nenhum estado capturado: "Nada encontrado com esse nome." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto-resumo] 2 de 18 textos fixos de sCat ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)

## Desktop novo: Catálogo: Importar lista

Referência: sImp · quadros 24b Importar · arquivo; 24c Importar · colunas; 24d Importar · revisar com erro; 24e Importando; 24f Resultado

- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "ou escolha um dos recentes em Downloads" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Lemos a tabela do PDF; confira as colunas no passo seguinte" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Pelo celular, em Menu › Catálogo › Importar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Continuar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Ligar as colunas" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Sugerimos uma coluna para cada campo. Confira as marcadas e troque se precisar." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Primeiras linhas do arquivo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Como o arquivo vai ser lido com essa ligação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Item novo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Categoria" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Depois" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Variação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Usado em" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Linhas com erro não entram no catálogo. Corrija aqui, ou deixe de fora e ajuste depois na planilha." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Problema" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Corrigir" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Deixar de fora" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Custo, ex.: 1.200,00" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Descrição do item" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Cancelar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Salvar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Desfazer" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Baixar linhas com erro (.csv)" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Pode continuar usando o sistema. Leva menos de um minuto." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Baixar as linhas que ficaram de fora" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Importar outro arquivo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Ver no catálogo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Nenhum item no arquivo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Escolher outro arquivo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Não deu para abrir o arquivo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto-resumo] 30 de 54 textos fixos de sImp ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)

## Desktop novo: Integração EXSAT

Referência: sEx · quadros 24g Integração EXSAT; 24h Sincronizando; 24i Depois de sincronizar

- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Mudanças de preço" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Filtrar mudanças" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Item" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Antes" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Depois" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Variação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Usado em" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Ver proposta" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Atualizar preços" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Conectando ao EXSAT…" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Tentar de novo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto-resumo] 11 de 23 textos fixos de sEx ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)

## Desktop novo: Kits

Referência: sKits · quadros 24k Kits

- sem divergência encontrada pelo kit

## Desktop novo: Kits: Usar em proposta

Referência: dKit · quadros 24l Usar kit

- sem divergência encontrada pelo kit

## Desktop novo: Clientes

Referência: sClis · quadros 24m Clientes

- sem divergência encontrada pelo kit

## Desktop novo: Configurações: Geral

Referência: sCfg · quadros 24n Padrões da empresa

- [coberto] button.assistant-fab: 1 elemento(s), ex.: button.body-icon.danger "Remover o modelo Garantia e suporte" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)

## Desktop novo: Configurações: Empresa e propostas

Referência: sCfg · quadros 24n Padrões da empresa

- sem divergência encontrada pelo kit

## Desktop novo: Configurações: Usuários

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.assistant-fab: 1 elemento(s), ex.: button.od-btn.s "Revogar" (claro 1280x800; escuro 1280x800)

## Desktop novo: Configurações: Sistema

Referência: sem quadro equivalente no repositório (só medidas)

- sem divergência encontrada pelo kit

## Desktop novo: Nova proposta (janela)

Referência: dNova · quadros 23d Nova proposta

- [texto] texto da Referência (dNova) que não aparece em nenhum estado capturado: "Nome do cliente novo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (dNova) que não aparece em nenhum estado capturado: "Ex.: Hospital Santa Clara" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (dNova) que não aparece em nenhum estado capturado: "Ex.: Hospital São Lucas · Ala D" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto] texto da Referência (dNova) que não aparece em nenhum estado capturado: "Começar com" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)
- [texto-resumo] 4 de 8 textos fixos de dNova ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800)

## Celular: Início

Referência: sem quadro equivalente no repositório (só medidas)

- sem divergência encontrada pelo kit

## Celular: Painel

Referência: sem quadro equivalente no repositório (só medidas)

- sem divergência encontrada pelo kit

## Celular: Avisos

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 1 elemento(s), ex.: button.btn2 "Enviar notificação de teste" (claro 375x812; escuro 375x812)
- [cortado] cortado por div (horizontal): 1 elemento(s), até 3 px, ex.: button.chip-act "Conta" (claro 375x812; escuro 375x812)

## Celular: Propostas (lista)

Referência: sem quadro equivalente no repositório (só medidas)

- [cortado] cortado por div (horizontal): 3 elemento(s), até 208 px, ex.: button.chip-act "Enviada 1"; button.chip-act "Aprovada 1"; button.chip-act "Recusada 0" (claro 375x812; escuro 375x812)

## Celular: Proposta: Resumo

Referência: quadros 21a Proposta · Resumo

- [coberto] button.ia-fab: 2 elemento(s), ex.: p.muted "Não informado"; p.hint "Próximo passo: revisão interna do orçame" (claro 375x812; escuro 375x812)

## Celular: Proposta: Itens

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 1 elemento(s), ex.: button.qbtn "Editar ou remover Gravador NVR 16 canais" (claro 375x812; escuro 375x812)

## Celular: Proposta: Revisões

Referência: quadros 21c Proposta · Revisões

- sem divergência encontrada pelo kit

## Celular: Nova proposta

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 2 elemento(s), ex.: button.opt "Começar com um kit Os itens do kit entra"; p.hint "Escolha o cliente e a obra (ou dê um nom" (claro 375x812; escuro 375x812)

## Celular: Mão de obra

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 1 elemento(s), ex.: button.btn2 "Adicionar função" (claro 375x812; escuro 375x812)

## Celular: PDF da proposta

Referência: quadros 21b PDF da proposta; 21e Pré-visualização; 21f Página ampliada; 21g Compartilhar; 21h Enviar ao cliente; 21i Engenharia · resumido sem capa; 21j Técnico de campo; 21p PDF · carregando; 21q PDF · vazio; 21r PDF · erro

- [coberto] button.ia-fab: 2 elemento(s), ex.: p.hint "O cliente vê só preços de venda. Custo, "; p.hint "Envie para revisão interna antes de mand" (claro 375x812; escuro 375x812)

## Celular: Comparativo de revisões

Referência: quadros 21d Comparar revisões; 21k REV 01 × REV 03; 21l Só o que mudou; 21m Escolher revisão; 21n PROP-041 · REV 01 × REV 02; 21o Sem permissão de custo; 21s Comparativo · carregando; 21t Comparativo · vazio; 21u Comparativo · erro

- sem divergência encontrada pelo kit

## Celular: Link do cliente

Referência: sem quadro equivalente no repositório (só medidas)

- sem divergência encontrada pelo kit

## Celular: Corpo da proposta

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 1 elemento(s), ex.: button.bk-add "Adicionar aqui" (claro 375x812; escuro 375x812)

## Celular: Kits

Referência: sem quadro equivalente no repositório (só medidas)

- sem divergência encontrada pelo kit

## Celular: Kit (detalhe)

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 1 elemento(s), ex.: button.btn2 "Adicionar item" (claro 375x812; escuro 375x812)

## Celular: Menu

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 1 elemento(s), ex.: p.hint "Construtec Orçamentos · celular 4" (claro 375x812; escuro 375x812)

## Celular: Configurações

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 2 elemento(s), ex.: button.card.cfg-link "CONSTRUTEC 32.992.946/0001-78 · responsá"; p.hint "Propostas já criadas mantêm seus valores" (claro 375x812; escuro 375x812)

## Celular: Configurações: corpo padrão

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 1 elemento(s), ex.: p.hint "Propostas já criadas mantêm o corpo dela" (claro 375x812; escuro 375x812)

## Celular: Configurações: empresa

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 2 elemento(s), ex.: input "Nome de quem assina"; p.hint "Propostas já criadas mantêm os dados del" (claro 375x812; escuro 375x812)

## Celular: Catálogo

Referência: quadros 22a Catálogo · Importar; 22c Catálogo · cartão EXSAT

- [coberto] button.ia-fab: 2 elemento(s), ex.: button.prow "Treinamento de usuários (até 8h) SER-TRE"; small.hint "27 itens · a busca procura no catálogo i" (claro 375x812; escuro 375x812)

## Celular: Catálogo: configurar

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 2 elemento(s), ex.: button.prow "Treinamento de usuários (até 8h) SER-TRE"; small.hint "27 itens · a busca procura no catálogo i" (claro 375x812; escuro 375x812)

## Celular: Importar catálogo

Referência: quadros 22b Importar catálogo; 22g Escolher arquivo; 22h Ligar colunas; 22i Trocar a coluna; 22j Campo faltando; 22k Revisar · com erro; 22l Corrigir uma linha; 22m Resultado; 22s Importar · lendo; 22t Importar · importando; 22u Importar · vazio; 22v Importar · erro

- sem divergência encontrada pelo kit

## Celular: Integração EXSAT

Referência: quadros 22d Integração EXSAT; 22p Antes de sincronizar; 22e Proposta em edição; 22q Aviso na proposta; 22f Atualizar preços; 22r Atualizar preços desta proposta?; 22n Sincronizando; 22o Depois de sincronizar; 22w EXSAT · carregando; 22x EXSAT · vazio; 22y EXSAT · erro

- sem divergência encontrada pelo kit

## Celular: Clientes

Referência: sem quadro equivalente no repositório (só medidas)

- sem divergência encontrada pelo kit

## Celular: Propostas descartadas

Referência: sem quadro equivalente no repositório (só medidas)

- sem divergência encontrada pelo kit

## Celular: Proposta descartada (detalhe)

Referência: sem quadro equivalente no repositório (só medidas)

- sem divergência encontrada pelo kit

## Celular: Usuários

Referência: sem quadro equivalente no repositório (só medidas)

- sem divergência encontrada pelo kit

## Celular: Ajuda

Referência: sem quadro equivalente no repositório (só medidas)

- sem divergência encontrada pelo kit

