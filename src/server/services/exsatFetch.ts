import type { CatalogImportItem } from '../../shared/contracts';
import { parseExsatProductsHtml } from './catalog';

export const validateExsatUrl = (rawUrl: string) => {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || !['exsat.com.br', 'www.exsat.com.br'].includes(url.hostname.toLowerCase())) {
    throw new Error('EXSAT_URL_INVALID');
  }
  return url;
};

export const EXSAT_MAX_BYTES = 8_000_000;

// Busca uma pagina do EXSAT sem seguir redirecionamento sozinho (cada salto e revalidado: so https em exsat.com.br)
// e com limite de tamanho lido do corpo (nao confia no Content-Length).
export const fetchExsatBody = async (
  rawUrl: string,
  doFetch: (url: URL) => Promise<Response>,
  maxBytes = EXSAT_MAX_BYTES,
): Promise<{ response: Response; finalUrl: string; body: Buffer }> => {
  let url = validateExsatUrl(rawUrl);
  for (let hop = 0; hop <= 5; hop += 1) {
    const response = await doFetch(url);
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel().catch(() => undefined);
      url = validateExsatUrl(new URL(location, url).toString());
      continue;
    }
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > maxBytes) { await response.body?.cancel().catch(() => undefined); throw new Error('EXSAT_RESPONSE_TOO_LARGE'); }
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body?.getReader();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel().catch(() => undefined); throw new Error('EXSAT_RESPONSE_TOO_LARGE'); }
      chunks.push(value);
    }
    return { response, finalUrl: url.toString(), body: Buffer.concat(chunks) };
  }
  throw new Error('EXSAT_TOO_MANY_REDIRECTS');
};

// O site da EXSAT responde em ISO-8859-1 (cabecalho Content-Type). Decodificar como UTF-8 trocava "Camera" por "C?mera"
// (U+FFFD) na descricao e na categoria dos itens importados pelo servidor; aqui o charset do cabecalho (ou do meta) manda.
export const decodeExsatBody = (contentType: string | null | undefined, body: Uint8Array): string => {
  const sniffed = new TextDecoder('windows-1252').decode(body.subarray(0, 2048));
  const declared = contentType?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]
    ?? sniffed.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1];
  const label = (declared ?? 'utf-8').toLowerCase();
  const latin = /^(?:iso-?8859-?1|latin-?1|windows-?1252|cp1252|l1)$/.test(label);
  try { return new TextDecoder(latin ? 'windows-1252' : label).decode(body); } catch { return new TextDecoder('utf-8').decode(body); }
};

export const previewExsatProducts = async (rawUrl: string): Promise<CatalogImportItem[]> => {
  const { response, body } = await fetchExsatBody(rawUrl, (url) => fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'Construtec-Orcamentos/1.0 (+catalog-import)' },
  }));
  if (!response.ok) throw new Error('EXSAT_UNAVAILABLE');
  return parseExsatProductsHtml(decodeExsatBody(response.headers.get('content-type'), body));
};
