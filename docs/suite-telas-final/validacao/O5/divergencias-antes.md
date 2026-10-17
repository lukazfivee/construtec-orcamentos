# Lista de divergências (kit de conferência do Orçamentos)

Gerada por `npm run conferencia` em 2026-10-15 (ticket O1, #183). Não edite à mão: rode o comando de novo depois de corrigir.

Telas capturadas: 9. Telas com algum achado: 8. Achados no total (por tela, tema e resolução): 44.

Como ler: **[cortado]**, **[coberto]**, **[rolagem-aninhada]**, **[rolagem-horizontal]**, **[texto-cortado]** e **[sem-respiro]** são medidas do kit (valem para a regra "sem corte e sem rolagem aninhada"). **[cor]** compara os tokens com os de `DesktopOrc.dc.html`. **[texto]** lista textos fixos da Referência que não aparecem na tela (podem ser só palavras diferentes; confira o quadro citado). **[console]** são erros do navegador. **[kit]** é falha do próprio kit em chegar na tela.

Limite: os protótipos `.dc.html` só abrem no canvas do design (faltam `support.js` e `/_blob/`), então a comparação é por tokens, textos e lista de quadros, não por imagem lado a lado. Os quadros citados (ex.: 23c) são os da Rodada indicada em `docs/suite-desktop/prototipo-orcamentos/` e `docs/suite-mobile/prototipo/`. O Celular do Orçamentos só tem Referência para PDF, comparativo, importar e EXSAT (Rodadas 21 e 22); as demais telas do Celular só recebem medidas.

Prints em `docs/suite-telas-final/conferencia/prints/` (pasta ignorada pelo git; `prints/index.html` mostra tudo).

## Tokens de cor

Referência: DesktopOrc.dc.html (:root e [data-theme="escuro"])

- sem divergência encontrada pelo kit

## Celular: Propostas (lista)

Referência: sem quadro equivalente no repositório (só medidas)

- [cortado] cortado por div (horizontal): 3 elemento(s), até 208 px, ex.: button.chip-act "Enviada 1"; button.chip-act "Aprovada 1"; button.chip-act "Recusada 0" (claro 375x812; escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.122 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.123 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.120 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.121 (escuro 375x812)

## Celular: Proposta: Resumo

Referência: quadros 21a Proposta · Resumo

- [coberto] button.ia-fab: 2 elemento(s), ex.: p.muted "Não informado"; p.hint "Próximo passo: revisão interna do orçame" (claro 375x812; escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.243 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.244 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.241 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.242 (escuro 375x812)

## Celular: Proposta: Itens

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 1 elemento(s), ex.: button.qbtn "Editar ou remover Gravador NVR 16 canais" (claro 375x812; escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.364 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.365 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.362 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.363 (escuro 375x812)

## Celular: Proposta: Revisões

Referência: quadros 21c Proposta · Revisões

- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.485 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.486 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.483 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.484 (escuro 375x812)

## Celular: Nova proposta

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 2 elemento(s), ex.: button.opt "Começar com um kit Os itens do kit entra"; p.hint "Escolha o cliente e a obra (ou dê um nom" (claro 375x812; escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.608 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.609 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.606 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.607 (escuro 375x812)

## Celular: Mão de obra

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 1 elemento(s), ex.: button.btn2 "Adicionar função" (claro 375x812; escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.729 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.730 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.727 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.728 (escuro 375x812)

## Celular: Link do cliente

Referência: sem quadro equivalente no repositório (só medidas)

- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.850 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.851 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.848 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.849 (escuro 375x812)

## Celular: Corpo da proposta

Referência: sem quadro equivalente no repositório (só medidas)

- [coberto] button.ia-fab: 1 elemento(s), ex.: button.bk-add "Adicionar aqui" (claro 375x812; escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.973 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 392.974 (claro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.971 (escuro 375x812)
- [console] rede: net::ERR_NAME_NOT_RESOLVED 22220.972 (escuro 375x812)

