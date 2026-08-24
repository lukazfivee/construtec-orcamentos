---
name: "Construtec Orçamentos"
description: "Mesa operacional corporativa para orçamentos profissionais, rápidos, seguros e offline."
colors:
  nav: "#122036"
  nav-muted: "#b8c3d3"
  ink: "#172033"
  muted: "#697386"
  line: "#e4e6ea"
  line-strong: "#cfd5de"
  primary: "#085ce5"
  primary-soft: "#eff5ff"
  success: "#178442"
  success-soft: "#f0f9f2"
  warning: "#9a5b00"
  warning-soft: "#fff5d9"
  surface: "#fefefe"
  surface-subtle: "#f7f8fa"
  focus: "#2f7cf4"
typography:
  headline:
    fontFamily: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif'
    fontSize: "25px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif'
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  xs: "3px"
  sm: "5px"
  md: "6px"
  lg: "7px"
  full: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "26px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 13px"
    height: "34px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 13px"
    height: "34px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 9px"
    height: "35px"
  nav-item:
    backgroundColor: "{colors.nav}"
    textColor: "{colors.nav-muted}"
    typography: "{typography.body}"
    padding: "8px"
    height: "82px"
  status-frozen:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
    height: "42px"
---

# Design System: Construtec Orçamentos

## Overview

**Creative North Star: "Mesa Operacional"**

A interface se comporta como uma bancada corporativa de trabalho: estável, precisa e pronta para uso prolongado. Sua familiaridade vem de padrões reconhecíveis de software de gestão; seu refinamento vem da disciplina de alinhamento, densidade e estado — não de ornamento. A direção combina a solidez operacional de sistemas de engenharia e gestão com a nitidez de produtos contemporâneos.

O conteúdo é o protagonista. Tabelas, valores e ações convivem em um único campo de trabalho contínuo, com navegação marinho-escura persistente, superfícies quase brancas e azul elétrico reservado para decisões. Clareza, velocidade e segurança precedem qualquer gesto expressivo.

**Key Characteristics:**

- Corporativa contemporânea, familiar e altamente refinada.
- Densa sem parecer congestionada; cada linha sustenta uma decisão operacional.
- Navegação escura e estável emoldurando uma área de trabalho clara.
- Azul elétrico raro, usado para seleção, foco e ação primária.
- Hierarquia construída por alinhamento, tipografia, divisores e estados explícitos.

## Colors

A paleta combina um azul-marinho estrutural, neutros frios quase brancos e um único azul de ação, com verde e âmbar estritamente semânticos.

### Primary

- **Azul de Decisão:** sinaliza ações primárias, aba ativa, item selecionado e valores comerciais de venda.
- **Azul de Foco:** torna a navegação por teclado inequívoca sem introduzir uma segunda voz de marca.

### Secondary

- **Verde de Integridade:** confirma resultado positivo e estados comerciais congelados ou preservados.
- **Âmbar de Edição:** comunica que uma proposta permanece em trabalho, sem competir com a ação principal.

### Neutral

- **Marinho Estrutural:** sustenta barra superior e navegação lateral, criando uma moldura estável para o trabalho.
- **Tinta Operacional:** cobre textos de alta prioridade e números que exigem leitura rápida.
- **Cinza de Apoio:** atende rótulos, notas, atalhos e informações secundárias.
- **Linha Fria / Linha Fria Forte:** separa campos, linhas de tabela e controles sem fragmentar a tela em cartões.
- **Papel Frio / Papel Frio Sutil:** forma o plano principal e diferencia áreas auxiliares por mudança tonal mínima.

### Named Rules

**The One Decision Rule.** O azul primário aparece apenas onde existe seleção, foco ou próxima ação clara; ele nunca funciona como preenchimento decorativo.

**The Semantic Reserve Rule.** Verde comunica integridade ou resultado positivo; âmbar comunica edição ou atenção. Nenhum deles substitui o azul em ações.

## Typography

**Display Font:** IBM Plex Sans (com Segoe UI e system-ui como fallback)

**Body Font:** IBM Plex Sans (com Segoe UI e system-ui como fallback)
**Label/Mono Font:** IBM Plex Sans com numerais tabulares para códigos, quantidades e moeda

**Character:** IBM Plex Sans traz rigor técnico e excelente leitura em alta densidade. A mesma família atravessa interface e dados, deixando tamanho, peso e alinhamento criarem a hierarquia.

### Hierarchy

- **Headline** (700, 25px, 1): totais comerciais de máxima prioridade no inspetor.
- **Title** (700, 14px, 1.4): marca e títulos compactos que precisam ancorar uma região.
- **Body** (400, 12px, 1.5): controles, navegação e texto operacional recorrente.
- **Label** (700, 10px, 1.4): cabeçalhos de tabela, metadados e informações auxiliares em espaços densos.

### Named Rules

**The Numeric Scan Rule.** Moeda, porcentagem, quantidade e códigos usam numerais tabulares e alinhamento consistente para permitir comparação vertical imediata.

**The Compact Hierarchy Rule.** A interface não cria impacto com títulos grandes; cria prioridade por peso, cor e posição dentro da grade.

## Layout

O aplicativo usa uma casca fixa de desktop: barra superior compacta, navegação lateral persistente e área de trabalho dividida entre editor expansível e inspetor comercial fixo à direita. A grade principal começa com barra de 43px, lateral de 118px e inspetor de 284px; em larguras até 1350px, lateral e inspetor se compactam para 94px e 260px. O canvas exige pelo menos 1180px, coerente com a aplicação Electron de uso interno.

O editor é um fluxo contínuo, não uma coleção de cartões. Abas abertas, metadados, seções, ferramentas, tabela e rodapé se alinham pela mesma geometria. O ritmo base privilegia passos curtos de 4–16px, reservando 24–26px para respiros estruturais. Em alturas até 800px, o painel comercial reduz alturas e intervalos para manter a ação “Gerar proposta” visível.

**The Workbench Rule.** A tabela ocupa o centro e o inspetor comercial permanece no contexto; resumos gerenciais não deslocam a tarefa principal para baixo da primeira dobra.

## Elevation & Depth

O sistema é plano por padrão. Profundidade nasce de contraste tonal, divisores frios e regiões persistentes; sombras ficam restritas a elementos que realmente flutuam sobre o fluxo, como busca de catálogo e notificações. O popover usa duas camadas ambientais e o toast uma sombra um pouco mais presente, sempre com contornos definidos.

### Shadow Vocabulary

- **Popover ambiente** (`0 10px 25px rgba(28, 40, 59, .14), 0 2px 5px rgba(28, 40, 59, .08)`): separa a busca local da tabela sem transformá-la em um modal pesado.
- **Toast elevado** (`0 10px 26px rgba(18, 32, 54, .22)`): mantém feedback temporário legível sobre qualquer região.
- **Tecla tátil** (`0 1px 0 rgba(18, 32, 54, .08)`): distingue atalhos de texto comum com elevação mínima.

### Named Rules

**The Flat Workbench Rule.** Superfícies permanentes não recebem sombra; use linha, tom e alinhamento. Sombra comprova flutuação temporária.

## Shapes

As formas são discretamente arredondadas: controles usam raios de 5–7px, etiquetas compactas podem cair para 3px e avatares ou indicadores circulares usam 50%. Painéis estruturais permanecem ortogonais e definidos por borda. Essa diferença preserva a sensação de bancada contínua, enquanto controles continuam claramente clicáveis.

**The Structure Before Softness Rule.** Não arredonde a casca, a tabela ou os grandes painéis; reserve cantos suaves para controles, estados e superfícies flutuantes.

## Components

### Buttons

Botões são compactos e funcionais, com ícone, verbo direto e atalho quando relevante.

- **Shape:** cantos suavemente curvos (6px), altura padrão de 34px e padding horizontal de 13px.
- **Primary:** Azul de Decisão com texto branco e peso reforçado; usado para inserir e gerar proposta.
- **Hover / Focus:** o hover aprofunda o azul; o foco visível usa contorno externo de 2px com afastamento de 2px.
- **Secondary / Ghost:** branco com borda forte para ações de ferramenta; ghost transparente para ícones e ações de baixo peso.

### Chips

- **Style:** estado congelado usa fundo verde suave, contorno verde e texto verde; edição usa fundo âmbar suave, contorno âmbar claro e texto âmbar.
- **State:** chips comunicam condição operacional, nunca categoria decorativa.

### Cards / Containers

- **Corner Style:** áreas permanentes permanecem retas; somente popover e toast usam 7px.
- **Background:** Papel Frio domina; Papel Frio Sutil diferencia painel e barras auxiliares.
- **Shadow Strategy:** plano por padrão, seguindo a regra Flat Workbench.
- **Border:** divisores de 1px em Linha Fria; Linha Fria Forte em controles e limites importantes.
- **Internal Padding:** 16–18px em painéis e 8–13px em controles densos.

### Inputs / Fields

- **Style:** fundo branco, borda forte de 1px e cantos de 5px; altura de 32–35px.
- **Focus:** borda Azul de Decisão com halo translúcido e foco externo visível para teclado.
- **Error / Disabled:** não há padrão visual de erro ou desabilitado implementado; não inventar sem validar no produto.

### Navigation

A navegação usa Marinho Estrutural e rótulos compactos em cinza azulado. Hover clareia o texto e eleva levemente o tom da superfície. O item ativo recebe texto branco, fundo naval mais claro e uma faixa azul de 4px na borda esquerda. A primeira versão é uma aplicação desktop e não define navegação móvel.

### Data Table

A tabela é a assinatura do sistema: cabeçalho fixo, linhas de 34px, células separadas por divisores finos, números alinhados à direita e totais fixos no rodapé. Hover aplica apenas um azul quase branco; seleção permanece legível sem alterar a geometria.

### Commercial Inspector

O inspetor fixa custo, venda, resultado, margem, parâmetros internos, integridade do snapshot e ações finais em uma única coluna. Valores ganham prioridade por tamanho e cor; “Gerar proposta” encerra a sequência como ação primária inequívoca.

## Do's and Don'ts

### Do:

- **Do** manter a tarefa e os dados centrais visíveis no primeiro viewport.
- **Do** alinhar moeda e quantidade à direita e usar numerais tabulares.
- **Do** usar linhas de 1px e mudanças tonais mínimas para estruturar superfícies permanentes.
- **Do** reservar o azul para foco, seleção e ação primária.
- **Do** escrever ações com verbos diretos em português do Brasil e mostrar atalhos quando existirem.
- **Do** preservar foco visível, contraste adequado e suporte a movimento reduzido.

### Don't:

- **Don't** transformar a bancada de edição em uma grade de cartões gerenciais.
- **Don't** usar sombras em barras, tabela, painéis ou outros elementos permanentes.
- **Don't** introduzir gradientes, vidro, ilustração ornamental ou cor de destaque sem função operacional.
- **Don't** usar verde ou âmbar como substitutos da ação azul primária.
- **Don't** esconder custo, margem, BDI ou fornecedor em saídas destinadas ao cliente; a distinção entre visão interna e documento exportado é obrigatória.
- **Don't** inventar comportamento mobile para a primeira versão desktop.
