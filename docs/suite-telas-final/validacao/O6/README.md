# O6: Celular do Orçamentos (PDF, comparativo, importar, EXSAT)

Ticket lukazfivee/construtec-orcamentos#188. Branch `feat/telas-o6`, a partir de `feat/suite-telas-final` (já com O2 a O5). Conferido em 14/10/2026 com `npm run conferencia`, Chrome headless em 375x812, dados de teste locais, portas 3201 a 3204.

Telas: PDF da proposta, Comparar revisões, Importar catálogo e Integração EXSAT, nos temas claro e escuro. Referência: Rodadas 21 (PDF e comparativo) e 22 (importar e EXSAT).

## Resultado

- **Kit:** nenhum corte, sobreposição, rolagem aninhada ou divergência de cor. Depois do O5, o fim de cada tela já sai de baixo do botão do assistente.
- **A olho (prints em `claro/` e `escuro/`; os `-completa` mostram a tela inteira):** nada cortado nem desalinhado. As estruturas batem com os quadros da Referência: miniaturas e chaves "Incluir no documento" com Compartilhar/Baixar no PDF; De/Para, resumo da diferença e "Só o que mudou" no comparativo; passos Arquivo, Colunas, Revisar e Pronto no importar; conta, preços novos e "Nenhum preço mudou" na EXSAT.
- **Console:** 16 erros `net::ERR_NAME_NOT_RESOLVED`, de requisições a hosts externos que o Chrome headless desta máquina não resolve. São de ambiente (os mesmos do O5), não da tela.

Lista do kit: `divergencias.md`.

## O que mudou

Nada no código. Não houve divergência a corrigir nestas telas.

## Removido da interface

Nada.

## Observações e limites

- Os `.dc.html` da Referência não abrem fora do canvas do design, então a comparação com as Rodadas 21 e 22 foi pela estrutura, pelos textos e pelos quadros, não por imagem lado a lado.
- Não capturados pelo kit (precisam de arquivo, de sincronização real ou de erro simulado): passos 2 a 4 do importar com erros e correção; EXSAT conectando, depois da varredura, carregando ou com erro; PDF carregando ou com erro; comparativo sem diferença ou com erro. Os quadros 21 e 22 desses estados ficam para conferência no aparelho (X2).
- **EXSAT:** com o servidor de teste sem a chave de criptografia, a tela mostra o aviso com o nome técnico `EXSAT_CREDENTIAL_KEY`. Em produção a chave existe e o aviso não aparece. Se o Lucas preferir esconder o nome técnico, é uma troca de texto.

## Testes

- `npm run verify`: typecheck ok, lint 0 erros (34 avisos já existentes), testes 336/337 passando, 1 pulado, 0 falhas.
- Chrome headless e servidores do kit encerrados pelo próprio kit.
