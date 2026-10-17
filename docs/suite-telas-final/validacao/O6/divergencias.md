# Lista de divergências (kit de conferência do Orçamentos)

Gerada por `npm run conferencia` em 2026-10-15 (ticket O1, #183). Não edite à mão: rode o comando de novo depois de corrigir.

Telas capturadas: 5. Telas com algum achado: 4. Achados no total (por tela, tema e resolução): 16.

Como ler: **[cortado]**, **[coberto]**, **[rolagem-aninhada]**, **[rolagem-horizontal]**, **[texto-cortado]** e **[sem-respiro]** são medidas do kit (valem para a regra "sem corte e sem rolagem aninhada"). **[cor]** compara os tokens com os de `DesktopOrc.dc.html`. **[texto]** lista textos fixos da Referência que não aparecem na tela (podem ser só palavras diferentes; confira o quadro citado). **[console]** são erros do navegador. **[kit]** é falha do próprio kit em chegar na tela.

Limite: os protótipos `.dc.html` só abrem no canvas do design (faltam `support.js` e `/_blob/`), então a comparação é por tokens, textos e lista de quadros, não por imagem lado a lado. Os quadros citados (ex.: 23c) são os da Rodada indicada em `docs/suite-desktop/prototipo-orcamentos/` e `docs/suite-mobile/prototipo/`. O Celular do Orçamentos só tem Referência para PDF, comparativo, importar e EXSAT (Rodadas 21 e 22); as demais telas do Celular só recebem medidas.

Prints em `docs/suite-telas-final/conferencia/prints/` (pasta ignorada pelo git; `prints/index.html` mostra tudo).

## Tokens de cor

Referência: DesktopOrc.dc.html (:root e [data-theme="escuro"])

- sem divergência encontrada pelo kit

## Celular: PDF da proposta

Referência: quadros 21b PDF da proposta; 21e Pré-visualização; 21f Página ampliada; 21g Compartilhar; 21h Enviar ao cliente; 21i Engenharia · resumido sem capa; 21j Técnico de campo; 21p PDF · carregando; 21q PDF · vazio; 21r PDF · erro

- [console] rede: net::ERR_NAME_NOT_RESOLVED 22316.124 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22316.125 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 18376.121 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 18376.122 (escuro 375x812)

## Celular: Comparativo de revisões

Referência: quadros 21d Comparar revisões; 21k REV 01 × REV 03; 21l Só o que mudou; 21m Escolher revisão; 21n PROP-041 · REV 01 × REV 02; 21o Sem permissão de custo; 21s Comparativo · carregando; 21t Comparativo · vazio; 21u Comparativo · erro

- [console] rede: net::ERR_NAME_NOT_RESOLVED 22316.246 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22316.247 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 18376.243 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 18376.244 (escuro 375x812)

## Celular: Importar catálogo

Referência: quadros 22b Importar catálogo; 22g Escolher arquivo; 22h Ligar colunas; 22i Trocar a coluna; 22j Campo faltando; 22k Revisar · com erro; 22l Corrigir uma linha; 22m Resultado; 22s Importar · lendo; 22t Importar · importando; 22u Importar · vazio; 22v Importar · erro

- [console] rede: net::ERR_NAME_NOT_RESOLVED 22316.365 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22316.366 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 18376.362 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 18376.363 (escuro 375x812)

## Celular: Integração EXSAT

Referência: quadros 22d Integração EXSAT; 22p Antes de sincronizar; 22e Proposta em edição; 22q Aviso na proposta; 22f Atualizar preços; 22r Atualizar preços desta proposta?; 22n Sincronizando; 22o Depois de sincronizar; 22w EXSAT · carregando; 22x EXSAT · vazio; 22y EXSAT · erro

- [console] rede: net::ERR_NAME_NOT_RESOLVED 22316.487 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22316.488 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 18376.484 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 18376.485 (escuro 375x812)

