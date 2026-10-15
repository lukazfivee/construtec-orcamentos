# O3: Desktop do Orçamentos (Kits, Catálogo, Importar, EXSAT)

Ticket lukazfivee/construtec-orcamentos#185. Branch `feat/telas-o3`, a partir de `feat/suite-telas-final` (já com o O2). Conferido em 14/10/2026 com `npm run conferencia`, Chrome headless, dados de teste locais, portas 3171 a 3174.

Telas: Catálogo, Catálogo › Importar lista, Integração EXSAT, Kits e Kits › Usar em proposta, nos temas claro e escuro, em 1280x720, 1280x800 e 1440x900 (30 capturas).

## Resultado

| Medida do kit | Antes | Depois |
|---|---|---|
| [coberto] Botão do assistente sobre a última linha da tabela do Catálogo | 6 (todas as resoluções e temas) | 0 |
| [cortado], [rolagem-aninhada], [rolagem-horizontal], [texto-cortado], [cor] | 0 | 0 |
| Total de achados | 282 | 276, todos do tipo [texto] |

Listas: `divergencias-antes.md` e `divergencias-depois.md`. Prints: `antes/` e `depois/<resolução>/<tema>/`. Conferi os prints de 1280x720 nos dois temas: nada cortado nem sobreposto.

## O que mudou

- `src/assistant.css`: a sobra de 112 px no fim da rolagem, que o O2 pôs no Início e em Propostas, passa a valer também para as outras páginas (`.management-workspace`, `.od-page` e `.workspace-page`), ou seja, Catálogo, Kits, EXSAT e Importar. Assim a última linha sai de baixo do botão do assistente.

## Removido da interface

Nada.

## Divergências NÃO corrigidas (e por quê)

Os textos restantes da Referência são, em sua maioria, de **estados que o kit não captura** com os dados de teste. Não são telas faltando:

- Importar (sImp): passos 2 a 4 do assistente ("Ligar as colunas", "Primeiras linhas do arquivo", revisão com "Corrigir"/"Deixar de fora", erros "Não deu para abrir o arquivo"/"Nenhum item no arquivo", conclusão "Importar outro arquivo"/"Ver no catálogo"). Só aparecem depois de escolher um arquivo; o kit para no passo 1.
- EXSAT (sEx): a tabela "Mudanças de preço" (Item, Antes, Depois, Variação, Usado em, "Ver proposta"), "Atualizar preços", "Conectando ao EXSAT…" e "Tentar de novo". Só aparecem com preços alterados ou durante e depois de uma sincronização, e a sincronização roda só no aplicativo do computador.
- Catálogo (sCat): o estado vazio da busca ("Nada encontrado com esse nome.") e o aviso para perfil sem permissão de custo. O kit usa um administrador sem busca digitada.

Para capturar esses estados seria preciso estender o kit (subir arquivo, simular mudança de preço, trocar de perfil). Fica como melhoria do kit, fora deste ticket.

## Não conferido

- Os estados acima.
- O Electron real (a conferência é pela versão web).
- Escala de letras maiores desligada e janelas abaixo de 1200 px.

## Testes

- `npm run verify`: typecheck ok, lint 0 erros (34 avisos já existentes), testes 336/337 passando, 1 pulado, 0 falhas.
- Chrome headless e servidores do kit encerrados pelo próprio kit.
