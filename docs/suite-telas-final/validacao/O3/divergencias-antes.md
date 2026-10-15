# Lista de divergências (kit de conferência do Orçamentos)

Gerada por `npm run conferencia` em 2026-10-15 (ticket O1, #183). Não edite à mão: rode o comando de novo depois de corrigir.

Telas capturadas: 6. Telas com algum achado: 3. Achados no total (por tela, tema e resolução): 282.

Como ler: **[cortado]**, **[coberto]**, **[rolagem-aninhada]**, **[rolagem-horizontal]**, **[texto-cortado]** e **[sem-respiro]** são medidas do kit (valem para a regra "sem corte e sem rolagem aninhada"). **[cor]** compara os tokens com os de `DesktopOrc.dc.html`. **[texto]** lista textos fixos da Referência que não aparecem na tela (podem ser só palavras diferentes; confira o quadro citado). **[console]** são erros do navegador. **[kit]** é falha do próprio kit em chegar na tela.

Limite: os protótipos `.dc.html` só abrem no canvas do design (faltam `support.js` e `/_blob/`), então a comparação é por tokens, textos e lista de quadros, não por imagem lado a lado. Os quadros citados (ex.: 23c) são os da Rodada indicada em `docs/suite-desktop/prototipo-orcamentos/` e `docs/suite-mobile/prototipo/`. O Celular do Orçamentos só tem Referência para PDF, comparativo, importar e EXSAT (Rodadas 21 e 22); as demais telas do Celular só recebem medidas.

Prints em `docs/suite-telas-final/conferencia/prints/` (pasta ignorada pelo git; `prints/index.html` mostra tudo).

## Tokens de cor

Referência: DesktopOrc.dc.html (:root e [data-theme="escuro"])

- sem divergência encontrada pelo kit

## Desktop novo: Catálogo

Referência: sCat · quadros 24a Catálogo EXSAT

- [coberto] button.assistant-fab: 3 elemento(s), ex.: table.od-tbl "ITEM CATEGORIA UNID. CUSTO MUDANÇA DE PR"; tr "Treinamento de usuários (até 8h) SER-TRE"; td.od-small "PA-1054" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sCat) que não aparece em nenhum estado capturado: "Seu perfil não vê preços de custo. A coluna Custo fica escondida; o resto do catálogo funciona igual." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sCat) que não aparece em nenhum estado capturado: "Nada encontrado com esse nome." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto-resumo] 2 de 18 textos fixos de sCat ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

## Desktop novo: Catálogo: Importar lista

Referência: sImp · quadros 24b Importar · arquivo; 24c Importar · colunas; 24d Importar · revisar com erro; 24e Importando; 24f Resultado

- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "ou escolha um dos recentes em Downloads" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Lemos a tabela do PDF; confira as colunas no passo seguinte" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Pelo celular, em Menu › Catálogo › Importar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Continuar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Ligar as colunas" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Sugerimos uma coluna para cada campo. Confira as marcadas e troque se precisar." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Primeiras linhas do arquivo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Como o arquivo vai ser lido com essa ligação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Item novo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Categoria" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Depois" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Variação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Usado em" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Linhas com erro não entram no catálogo. Corrija aqui, ou deixe de fora e ajuste depois na planilha." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Problema" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Corrigir" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Deixar de fora" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Custo, ex.: 1.200,00" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Descrição do item" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Cancelar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Salvar" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Desfazer" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Baixar linhas com erro (.csv)" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Pode continuar usando o sistema. Leva menos de um minuto." (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Baixar as linhas que ficaram de fora" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Importar outro arquivo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Ver no catálogo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Nenhum item no arquivo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Escolher outro arquivo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sImp) que não aparece em nenhum estado capturado: "Não deu para abrir o arquivo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto-resumo] 30 de 54 textos fixos de sImp ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

## Desktop novo: Integração EXSAT

Referência: sEx · quadros 24g Integração EXSAT; 24h Sincronizando; 24i Depois de sincronizar

- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Mudanças de preço" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Filtrar mudanças" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Item" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Antes" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Depois" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Variação" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Usado em" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Ver proposta" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Atualizar preços" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Conectando ao EXSAT…" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto] texto da Referência (sEx) que não aparece em nenhum estado capturado: "Tentar de novo" (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)
- [texto-resumo] 11 de 23 textos fixos de sEx ausentes (claro 1440x900; escuro 1440x900; claro 1280x800; escuro 1280x800; claro 1280x720; escuro 1280x720)

## Desktop novo: Kits

Referência: sKits · quadros 24k Kits

- sem divergência encontrada pelo kit

## Desktop novo: Kits: Usar em proposta

Referência: dKit · quadros 24l Usar kit

- sem divergência encontrada pelo kit

