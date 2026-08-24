# Product

<!-- impeccable:product-schema 1 -->

## Platform

desktop

## Stack

Electron Forge com Vite, React e TypeScript no renderer; Node.js e Express na camada de API; PGlite/PostgreSQL no armazenamento local; JWT para autenticação. Aplicação desktop Windows com arquitetura local-first e preparada para empacotamento futuro em outras plataformas.

## Users

A equipe interna da Construtec Engenharia — principalmente profissionais responsáveis por elaborar, revisar e aprovar orçamentos e propostas comerciais. O uso ocorre durante a composição técnica e comercial de soluções, frequentemente com necessidade de rapidez, rastreabilidade e funcionamento sem internet.

## Product Purpose

Centralizar catálogo, clientes, obras, custos, mão de obra, precificação, revisões e emissão de propostas oficiais. O produto transforma a elaboração de orçamentos em um fluxo padronizado: selecionar produtos, montar a solução, aplicar a composição comercial e gerar a proposta oficial.

## Positioning

Uma aplicação local-first que congela os dados comerciais de cada item no momento da inclusão na proposta, preservando histórico e auditoria sem depender da disponibilidade de fornecedores externos, serviços em nuvem ou inteligência artificial.

## Operating Context

- Criação e revisão de propostas comerciais da Construtec.
- Pesquisa em catálogo local atualizado manualmente a partir de fontes autorizadas, incluindo a EXSAT.
- Composição de kits, materiais, serviços e mão de obra.
- Aplicação interna de BDI, margens, impostos e demais componentes de preço.
- Geração de DOCX, PDF e impressão no modelo corporativo.
- Operação offline como padrão, com internet apenas para atualização, sincronização, backup ou atualização do aplicativo.

## Capabilities and Constraints

- O funcionamento normal não utiliza IA nem consome tokens.
- Informações internas de custo, margem, BDI e fornecedor nunca aparecem na proposta do cliente.
- Atualizações externas alteram somente o catálogo local e nunca reescrevem itens de propostas existentes.
- Cada item de proposta guarda um snapshot comercial independente do catálogo atual.
- Propostas possuem numeração, revisões imutáveis, histórico e auditoria.
- O banco não fica publicamente exposto.
- Autenticação individual, hash de senhas, perfis, permissões, sessões, auditoria e backups fazem parte do produto.
- A arquitetura deve permanecer compatível com futura integração ao Centro de Custos Construtec V3.
- A fonte EXSAT e o modelo oficial de proposta dependem de acesso, autorização e arquivos que ainda serão fornecidos.

## Brand Commitments

- Nome: Construtec Orçamentos.
- Promessa: orçamentos profissionais, rápidos, seguros e offline.
- A interface é uma ferramenta operacional interna; clareza, velocidade e segurança precedem ornamentação.
- Documentos exportados devem preservar a identidade visual e o modelo oficial já utilizado pela Construtec.
- Direção visual escolhida: padrão corporativo contemporâneo, familiar e altamente refinado, sem metáforas visuais que reduzam a eficiência operacional.

## Evidence on Hand

- Briefing funcional completo fornecido pelo usuário na abertura do projeto.
- Não há ainda logotipo, manual de marca, catálogo EXSAT autorizado, modelo DOCX oficial ou exemplos de propostas no diretório do projeto; trabalhos futuros não devem inventar esses ativos nem alegar integrações concluídas.

## Product Principles

1. Offline é o estado normal; internet é uma capacidade explícita e opcional.
2. O histórico comercial é imutável e auditável.
3. A visão interna protege custos e estratégia; a visão do cliente revela apenas o necessário.
4. Cálculos e rotinas centrais são determinísticos, rápidos e independentes de IA.
5. A primeira versão prioriza o ciclo completo do orçamento à proposta oficial.

## Accessibility & Inclusion

A interface deve ser operável por teclado, apresentar foco visível, contraste adequado e linguagem direta em português do Brasil. Valores monetários, datas e quantidades seguem a localidade `pt-BR`.
