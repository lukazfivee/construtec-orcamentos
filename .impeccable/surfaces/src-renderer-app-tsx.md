---
version: 1
slug: "src-renderer-app-tsx"
primary_target: "src/renderer/App.tsx"
related_targets: []
---

# Proposta ativa — mesa operacional

## Scope and mode

- Primary target: `src/renderer/App.tsx`
- Mode: Operate
- Surface: editor de uma proposta ativa dentro do aplicativo desktop.

## Audience, job and action

- Usuário principal: profissional interno da Construtec elaborando ou revisando um orçamento.
- Job: localizar itens, ajustar quantidades e composição comercial, conferir resultado e gerar a proposta oficial.
- Primary action: `Gerar proposta`.
- Secondary actions: inserir item, salvar revisão e pré-visualizar.

## Chosen direction

- Visual world: padrão corporativo contemporâneo, familiar e altamente refinado.
- Composition: `Mesa Operacional`.
- Approved comp: `.impeccable/mocks/canon-operational.png`.
- Quality references: Sienge para domínio, Conta Azul para clareza financeira e Linear para densidade e velocidade.
- Memorable moment: pesquisa rápida no catálogo entra sobre a tabela sem retirar o usuário da proposta; o resumo comercial permanece fixo à direita.

## Composition contract

| Ingredient | Approved commitment | Medium |
| --- | --- | --- |
| App chrome | barra superior de 43 px e navegação lateral escura de aproximadamente 118 px | semantic HTML/CSS |
| Proposal tabs | abas abertas imediatamente abaixo da barra superior, com indicador azul na ativa | semantic HTML/CSS |
| Proposal header | cliente, escopo, status, validade e responsável em uma única faixa compacta | semantic HTML/CSS |
| Task tabs | Itens, Serviços, Kits, Condições e Histórico | semantic HTML/CSS |
| Line-item table | protagonista da tela; 14 linhas visíveis, cabeçalho fixo, números tabulares e seleção por checkbox | semantic HTML table |
| Catalog quick search | popover ancorado à ação de adicionar linha, com busca e atalhos de teclado | semantic HTML/CSS + interaction |
| Commercial inspector | painel fixo à direita com custo, venda, resultado, margem, BDI e ações | semantic aside |
| Primary action | botão azul sólido `Gerar proposta`, largura total do inspetor | semantic button |
| Icons | pictogramas lineares consistentes, 16–22 px | Lucide React |
| Imagery | nenhuma imagem é necessária nesta superfície operacional | accepted omission |

## Visual inventory

- Component grammar: superfícies planas, separadores finos, campos compactos, botões com raio próximo de 6 px, sem cartões flutuantes.
- Corner language: 4–7 px; a tabela e os painéis seguem cantos discretos.
- Line weight: 1 px, baixo contraste.
- Elevation: quase inexistente; apenas o popover de catálogo recebe sombra curta e suave.
- Type ramp: 12–14 px para interface e tabela, 18–28 px para valores comerciais; códigos e valores usam numerais tabulares.
- Sampled colors from approved comp: sidebar `#122036`, top search field `#293242`, page ground `#FEFEFE`, separators `#E4E6EA`, primary action `#085CE5`, verified background `#F0F9F2`.

## Constraints

- Não expor BDI ou custos internos na futura visão do cliente.
- Todos os dados desta primeira tela são demonstração sintética.
- O snapshot de preço deve ser legível e não depender apenas de cor.
- Layout desktop-first, com mínimo operacional de 1280 × 720; estados menores preservam a tabela por rolagem, não por remoção de colunas silenciosa.
- Operação por teclado, foco visível e contraste adequado.

## Direction contract

THESIS: O editor é a bancada de trabalho; rejeita um início dominado por cartões gerenciais.
OWN-WORLD: Fundo quase branco, navegação azul-marinho, ação azul elétrica, linhas cinza frias e tabela compacta.
STORY: Abrir propostas em abas, editar itens, conferir o snapshot comercial e gerar o documento.
FIRST VIEWPORT: Barra superior e lateral compactas; tabela ocupa o centro; inspetor comercial fixo à direita; ação principal no rodapé do inspetor.
FORM: Mesa operacional corporativa, saída convencional escolhida; seed 5393c46e.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Logotipo e identidade corporativa oficial ainda não foram fornecidos.
- Modelo DOCX oficial da proposta ainda não foi fornecido.
