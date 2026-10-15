# Lista de divergências (kit de conferência do Orçamentos)

Gerada por `npm run conferencia` em 2026-10-14 (ticket O1, #183). Não edite à mão: rode o comando de novo depois de corrigir.

Telas capturadas: 9. Telas com algum achado: 9. Achados no total (por tela, tema e resolução): 339.

Como ler: **[cortado]**, **[coberto]**, **[rolagem-aninhada]**, **[rolagem-horizontal]**, **[texto-cortado]** e **[sem-respiro]** são medidas do kit (valem para a regra "sem corte e sem rolagem aninhada"). **[cor]** compara os tokens com os de `DesktopOrc.dc.html`. **[texto]** lista textos fixos da Referência que não aparecem na tela (podem ser só palavras diferentes; confira o quadro citado). **[console]** são erros do navegador. **[kit]** é falha do próprio kit em chegar na tela.

Limite: os protótipos `.dc.html` só abrem no canvas do design (faltam `support.js` e `/_blob/`), então a comparação é por tokens, textos e lista de quadros, não por imagem lado a lado. Os quadros citados (ex.: 23c) são os da Rodada indicada em `docs/suite-desktop/prototipo-orcamentos/` e `docs/suite-mobile/prototipo/`. O Celular do Orçamentos só tem Referência para PDF, comparativo, importar e EXSAT (Rodadas 21 e 22); as demais telas do Celular só recebem medidas.

Prints em `docs/suite-telas-final/conferencia/prints/` (pasta ignorada pelo git; `prints/index.html` mostra tudo).

## Tokens de cor

Referência: DesktopOrc.dc.html (:root e [data-theme="escuro"])

- [cor] --c-warn-soft é rgba(242, 181, 68, .14), a Referência pede #3a2a0c (escuro desktop)

## Desktop novo: Início

Referência: sPainel · quadros 23b Início do Orçamentos

- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Bom dia, Marina" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Propostas abertas, o que precisa de você e os preços do catálogo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Ver propostas" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Precisam de ação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Funil de propostas" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Valor final por situação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "EX" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sPainel) que não aparece em nenhum estado capturado: "Integração EXSAT" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto-resumo] 8 de 10 textos fixos de sPainel ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [coberto] button.assistant-fab: 3 elemento(s), ex.: table.home-proposals-table "NÚMERO CLIENTE / OBRA STATUS ITENS VALOR"; tr "PA-1054REV 00 Edifício Horizonte Edifíci"; button.open-proposal-btn "Abrir" (claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

## Desktop novo: Propostas (lista)

Referência: sProps · quadros 23c Propostas

- [coberto] button.assistant-fab: 1 elemento(s), ex.: strong "R$ 313.789,99" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Da edição à aprovação, com o valor final de cada revisão" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Buscar por obra, cliente ou número" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Filtrar propostas" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Situação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Valor final" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Margem" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Sem permissão de ver margem" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProps) que não aparece em nenhum estado capturado: "Nenhuma proposta com esse filtro." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto-resumo] 8 de 16 textos fixos de sProps ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

## Desktop novo: Proposta: Itens

Referência: sProp · quadros 23f Itens editáveis; 23e Resumo com aviso de preço

- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Comparar revisões" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Abrir obra no Centro de Custos" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Atualizar preços desta proposta?" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Agora não" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Ver e atualizar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Margem" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Custo, BDI e margem aparecem só para quem tem a permissão de ver custos." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Por sistema" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Parte do valor final" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Dados da proposta" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "PDF da proposta" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Mude as quantidades direto na tabela. Itens com preço novo no EXSAT ganham o botão Atualizar." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "BDI e impostos" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Adicionar itens" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Criar nova revisão" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Diminuir" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Aumentar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Atualizar preço" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Remover item" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Esta proposta ainda não tem itens. Use Adicionar itens para buscar no catálogo ou num kit." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Histórico de revisões" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "A mais nova em cima" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Comparar com a atual" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sProp) que não aparece em nenhum estado capturado: "Só a revisão em edição pode ser alterada. Revisões enviadas ou aprovadas ficam congeladas, com os preços de quando foram montadas." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto-resumo] 24 de 31 textos fixos de sProp ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

## Desktop novo: Proposta: Mão de obra

Referência: sProp

- [cortado] cortado por section.proposal-editor (horizontal): 23 elemento(s), até 63 px, ex.: table.labor-table "FUNÇÃO PROF. SALÁRIO ALIMENTAÇÃO TRANSPO"; tr "FUNÇÃO PROF. SALÁRIO ALIMENTAÇÃO TRANSPO"; th "CUSTO TOTAL" (claro 1440x900; escuro 1440x900)
- [coberto] button.assistant-fab: 4 elemento(s), ex.: table.labor-table "FUNÇÃO PROF. SALÁRIO ALIMENTAÇÃO TRANSPO"; tr "Instalador 6 6,00 3.200,00 600,00 300,00"; tr "Total de mão de obra R$ 160.363,63" (claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [cortado] cortado por section.proposal-editor (horizontal): 31 elemento(s), até 205 px, ex.: table.labor-table "FUNÇÃO PROF. SALÁRIO ALIMENTAÇÃO TRANSPO"; tr "FUNÇÃO PROF. SALÁRIO ALIMENTAÇÃO TRANSPO"; th "HORAS DA EQUIPE" (claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

## Desktop novo: Proposta: Kits

Referência: sProp · quadros 23g Adicionar itens

- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

## Desktop novo: Proposta: Corpo e condições

Referência: sProp

- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

## Desktop novo: Proposta: Histórico (revisões)

Referência: sProp · quadros 23j Revisões

- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

## Desktop novo: Proposta: menu Inserir

Referência: dAdd · quadros 23g Adicionar itens

- [texto] texto da Referência (dAdd) que não aparece em nenhum estado capturado: "Origem" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (dAdd) que não aparece em nenhum estado capturado: "Buscar por nome ou código" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (dAdd) que não aparece em nenhum estado capturado: "Na proposta" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (dAdd) que não aparece em nenhum estado capturado: "Nada encontrado no catálogo." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (dAdd) que não aparece em nenhum estado capturado: "Adicionar kit" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto-resumo] 5 de 6 textos fixos de dAdd ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [cortado] cortado por main.workspace (horizontal): 3 elemento(s), até 44 px, ex.: strong "R$ 37.978,20"; strong "R$ 160.363,63"; strong "R$ 49.585,46" (claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

