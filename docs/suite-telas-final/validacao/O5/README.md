# O5: Celular do Orçamentos (proposta e listas)

Ticket lukazfivee/construtec-orcamentos#187. Branch `feat/telas-o5`, a partir de `feat/suite-telas-final` (já com O2 a O4). Conferido em 14/10/2026 com `npm run conferencia`, Chrome headless em 375x812, dados de teste locais, portas 3191 a 3194.

Telas: Propostas (lista), Nova proposta, a proposta (Resumo, Itens, Revisões), Mão de obra, Corpo da proposta, Link do cliente (acompanhamento) e Clientes e obras, nos temas claro e escuro.

Referência: as Rodadas 21 e 22 cobrem PDF, comparativo, importar e EXSAT (ticket O6). Para estas telas não há quadro na Referência, então a conferência foi pelas medidas do kit e a olho, contra o padrão já usado no Celular.

## Resultado

| Medida do kit | Antes | Depois |
|---|---|---|
| [coberto] Botão do assistente sobre o fim da tela (Resumo, Itens, Nova proposta, Mão de obra, Corpo) | 10 | 0 |
| [cortado] Chips de situação da lista de propostas (Enviada, Aprovada, Recusada, até 208 px fora) | 2 | 0 |
| [console] `net::ERR_NAME_NOT_RESOLVED` | 33 | 33 (ambiente; veja abaixo) |

Listas: `divergencias-antes.md` e `divergencias-depois.md`. Prints: `antes/` e `depois/<tema>/` (os arquivos `-completa` mostram a tela inteira).

## O que mudou (`public/m/m.css`)

- **Fim de cada tela:** sobra de 66 px para o conteúdo sair de baixo do botão do assistente. Sem barra de ações, a sobra vai no fim da tela. Com a barra de ações fixa (ex.: "Enviar para revisão", "Criar proposta"), vai antes da barra, porque o botão sobe acima dela.
- **Chips de situação (Propostas):** quebram linha em vez de rolar de lado. Antes "Enviada" aparecia cortado e "Aprovada"/"Recusada" ficavam escondidos. Mesma solução do O7 nos filtros dos Avisos.

O service worker do Orçamentos (`public/sw.js`, `construtec-cache-v1`) nunca teve a versão trocada, nem no O7. Não mexi.

## Removido da interface

Nada.

## Não corrigido / observações

- **Erros de rede no console:** são duas requisições por tela a hosts externos que o Chrome headless desta máquina não resolve. Aparecem iguais antes e depois e não vêm do layout. Não são defeito de tela.
- **Link do cliente da PA-1057 (aprovada, REV 00):** a tela mostra só "Só a revisão atual pode ter link.", sem link. Pode ser regra (sem nuvem no kit) ou falha de comportamento. Não é visual, então não mexi; vale conferir com dado real no aparelho (X2).

## Não conferido

- Aparelho real (Galaxy A17 e iPhone), que fica para a RC final (X2).
- Teclado aberto, estados de erro e de carregamento, perfil sem permissão de custo.

## Testes

- `npm run verify`: typecheck ok, lint 0 erros (34 avisos já existentes). A primeira rodada deu 335/337 com 1 falha intermitente; o resumo cortado não mostrou o nome do teste. `npm run test:critical` e um segundo `verify` completo passaram: 336/337, 1 pulado, 0 falhas.
- Chrome headless e servidores do kit encerrados pelo próprio kit.
