# OCR de imagens do catálogo

Worker usado pelo Construtec Orçamentos para extrair texto de fotos, prints e orçamentos enviados na importação em lote do catálogo.

## Arquitetura

`Electron -> HTTPS Worker -> Workers AI toMarkdown -> texto -> parser do catálogo`

O aplicativo tenta este OCR primeiro. Se o Worker não estiver configurado ou estiver indisponível, o instalador Windows usa automaticamente o `Windows.Media.Ocr` como fallback local.

## Deploy

Dentro desta pasta:

```bash
npx wrangler deploy
```

O Worker usa o binding `AI` configurado em `wrangler.jsonc`.

Para proteger o endpoint, defina um segredo compartilhado:

```bash
npx wrangler secret put OCR_SHARED_TOKEN
```

Depois configure no ambiente do aplicativo:

```text
CONSTRUTEC_OCR_URL=https://construtec-catalog-ocr.<subdominio>.workers.dev
CONSTRUTEC_OCR_TOKEN=<mesmo valor de OCR_SHARED_TOKEN>
```

`CONSTRUTEC_OCR_TOKEN` é opcional apenas quando o Worker não tiver `OCR_SHARED_TOKEN` configurado.

## Formatos

O app envia PNG, JPG/JPEG e BMP. O Worker aceita imagens de até 10 MB e pede saída em texto, preferencialmente em português.

## Segurança

- não grave token no renderer/HTML;
- o token fica somente no processo principal do Electron;
- o Worker não armazena a imagem;
- a resposta usa `cache-control: no-store`;
- mantenha o endpoint protegido com `OCR_SHARED_TOKEN` em produção.
