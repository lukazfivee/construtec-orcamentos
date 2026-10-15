# O2: Desktop do Orçamentos (Início, Propostas e editor de proposta)

Ticket lukazfivee/construtec-orcamentos#184. Branch `feat/telas-o2`, a partir de `feat/suite-telas-final`. Conferido em 14/10/2026 com o kit do O1 (`npm run conferencia`), Chrome headless, dados de teste locais, portas 3141 a 3148.

Telas: Início, Propostas (lista) e o editor (Itens, Mão de obra, Kits, Corpo e condições, Histórico, menu Inserir), nos temas claro e escuro, em 1280x720, 1280x800 e 1440x900. O kit passou a medir 1280x720 também (antes só 1280x800 e 1440x900).

## Resultado

| Medida do kit | Antes | Depois |
|---|---|---|
| [cortado] Resumo comercial (valores e botões de Ações) em 1280 | 4 resoluções e temas por aba do editor | 0 |
| [cortado] Tabela de Mão de obra (rolagem horizontal dentro do painel) | 1440x900 até 63 px, 1280 até 205 px | 0 |
| [coberto] Botão do assistente sobre o fim das listas (Início, Propostas, Mão de obra) | 14 | 0 |
| [cor] `--c-warn-soft` no tema escuro | rgba(242,181,68,.14) | `#3a2a0c` (igual à Referência) |
| Total de achados nas 8 telas | 339 | 264, todos do tipo [texto] |

Listas completas: `divergencias-antes.md` e `divergencias-depois.md`. Prints: `antes/` (1280x720) e `depois/<resolução>/<tema>/`.

## O que mudou

- **Resumo comercial (editor) em 1280:** o valor desce para baixo do rótulo em vez de ser cortado; os botões de Ações ficam um por linha ("Criar revisão" e "Compartilhar" estavam cortados).
- **Itens:** colunas Custo total e Venda total com 104 px em telas até 1360; o total do rodapé ("37.978,20") era coberto pela coluna vizinha. Este caso o kit não pegava; achado no print.
- **Mão de obra:** a tabela cabe na largura do editor; títulos das colunas quebram em duas linhas, letra 10,5 e espaçamento menor. Sem rolagem horizontal interna.
- **Início e Propostas:** sobra de 112 px no fim da rolagem para a última linha sair de baixo do botão do assistente (o mesmo que o painel comercial já tinha).
- **Tema escuro:** `--c-warn-soft` com a cor da Referência (`#3a2a0c`), usada em "Em edição", ícone de aviso dos KPIs e avisos de condições.
- **Textos alinhados à Referência (só palavras):** subtítulo do Início ("Propostas abertas, o que precisa de você e os preços do catálogo."), link "Ver propostas", subtítulo da Central de Propostas ("Da edição à aprovação, com o valor final de cada revisão.") e busca "Buscar por obra, cliente ou número".
- **Kit:** `VIEWPORTS_DESKTOP` inclui 1280x720 e `--tela` aceita lista separada por vírgula.

## Removido da interface

Nada removido. Só trocas de texto listadas acima (o placeholder deixou de citar o formato "PA-XXXX").

## Divergências NÃO corrigidas (e por quê)

Os 40 textos restantes da Referência são partes do redesenho que pedem função ou estrutura nova, fora do escopo ("nada de função nova até 30/10"):

- Início: saudação "Bom dia, …", blocos "Precisam de ação", "Funil de propostas", "Valor final por situação" e o cartão de Integração EXSAT.
- Propostas: filtro "Situação" em painel, coluna e permissão de "Margem", estado vazio "Nenhuma proposta com esse filtro.".
- Editor: aviso "Atualizar preços desta proposta?" com "Ver e atualizar"/"Agora não", "Atualizar preço" por item, botões +/− de quantidade ("Diminuir"/"Aumentar"), "Comparar revisões"/"Comparar com a atual" no histórico, "Abrir obra no Centro de Custos", painéis "Por sistema", "BDI e impostos", "Dados da proposta", nota de permissão de custos e textos de ajuda.
- Menu Inserir: o diálogo "Adicionar itens" da Referência (busca por nome ou código, filtro Origem, "Na proposta", "Adicionar kit").

Pela decisão 3 do LEIA-ME-RETOMAR, o que não passar até 20/10 vai com o layout atual e as cores da Suíte. Se o Lucas quiser algum desses blocos, vira ticket próprio.

## Não conferido

- PDF, Comparativo, Kits, Catálogo, Clientes e Configurações (são O3 e O4).
- Escala "letras maiores" desligada, menu recolhido e janelas abaixo de 1200 px (onde o zoom de 75% não se aplica).
- Electron real (a conferência é pela versão web servida pelo kit).

## Testes

- `npm run verify`: typecheck ok, lint 0 erros (34 avisos já existentes), testes 336/337 passando, 1 pulado, 0 falhas.
- Numa primeira rodada, feita junto com o kit, `client-links.test` e `center-tracking.test` falharam por tempo; isolados passaram (10/10) e o `verify` inteiro, rodado sozinho, passou duas vezes.
- Processos: Chrome headless e servidores do kit encerrados pelo próprio kit; nada ouvindo em 3141 a 3148 no fim.
