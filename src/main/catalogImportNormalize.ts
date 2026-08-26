import type { CatalogImportFile } from '../shared/contracts';

const HEADER = 'Código\tDescrição\tCategoria\tFabricante\tModelo\tUnidade\tCusto\tFonte';
const TELCABOS_HINT = /TELCABOS|LIGHTERA|WJ\s+MOREIRA|DTEC|VELCRO|Class\.?Fiscal|Previs[aã]o\s+Entrega|Vl\.?\s*Unit[aá]rio|Descri[cç][aã]o\s+Detalhada/i;
const EXSAT_HINT = /(?:Print\s*Preview|Qt\.?\s*\(?Un\.?\)?|Vl\.?\s*L[ií]q\.?|Condi[cç][oõ]es\s+de\s+Pagamento)/i;
const STOP_BACKTRACK = /(?:Í|I)tem\s+C[oó]digo|TELCABOS|^Pag\s*:|Desc\.?\s*Impostos|Total\s+Mercadorias/i;
const UNIT_PATTERN = /^(?:PC|PÇ|PCA|PÇS|MT|M|UN|UND|UNID|CX|RL|BB|KIT|JG|SV)$/i;
const ADMIN_PATTERN = /\b(?:total|subtotal|investimento|frete|imposto|impostos|desconto|icms|fcp|pagamento|validade|proposta|or[cç]amento|cliente|cnpj|cpf|telefone|endere[cç]o|vendedor|comprador|contato|emiss[aã]o|condi[cç][oõ]es|observa[cç][oõ]es|data\s*base|reajuste|aceita[cç][aã]o|assinatura|respons[aá]vel|cr[eé]dito|prazo)\b/i;
const GENERIC_PRICE_HEADER = /\b(?:pre[cç]o|valor|vl\.?|unit[aá]rio|custo)\b/i;
const REAIS_PRICE = /R\s*\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})/gi;
const BARE_PRICE = /(?<![\d.])((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(?!\d)/g;

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

const inferCategory = (description: string) => {
  if (/c[aâ]mera|dvr|nvr|gravador|cftv|hd\s+purple/i.test(description)) return 'CFTV';
  if (/fechadura|controle\s+de\s+acesso|controlador|catraca|porteiro|videoporteiro|leitor\s+(?:facial|biom[eé]trico)/i.test(description)) return 'Controle de acesso';
  if (/detector|sirene|inc[eê]ndio|alarme|acionador|central\s+de\s+inc[eê]ndio/i.test(description)) return 'Segurança eletrônica';
  if (/rack|cabo|patch|conector|fibra|fiber|dio|cord[aã]o|extens[aã]o|guia|velcro|roteador|switch|porca|parafuso|r[eé]gua|bandeja|placa|eletroduto|condulete/i.test(description)) return 'Redes e cabeamento';
  return 'Importado';
};

const inferManufacturer = (description: string) => {
  const known = [
    'Intelbras', 'Hikvision', 'Dahua', 'Bosch', 'Siemens', 'Schneider', 'Legrand', 'Furukawa',
    'Condutti', 'Tramontina', 'Apollo', 'Honeywell', 'Notifier', 'Pial', 'WD', 'Western Digital',
    'Lightera', 'DTEC', 'Velcro', 'WJ Moreira', 'Prysmian', 'Nexans', 'Panduit', 'CommScope',
  ];
  return known.find((brand) => new RegExp(`\\b${brand.replace(/\s+/g, '\\s+')}\\b`, 'i').test(description)) ?? '';
};

const parseBrazilianNumber = (value: string) => {
  const normalized = value.replace(/R\s*\$/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

const formatBrazilianNumber = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const extractReaisPrices = (value: string) => [...value.matchAll(REAIS_PRICE)].map((match) => match[1]);

const stableAutoCode = (description: string) => {
  const normalized = description.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `AUTO-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
};

const sanitizeCell = (value: unknown) => String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();

const toRow = (input: {
  code?: string;
  description: string;
  manufacturer?: string;
  unit?: string;
  cost: string | number;
  source: string;
}) => [
  input.code || stableAutoCode(input.description),
  input.description,
  inferCategory(input.description),
  input.manufacturer || inferManufacturer(input.description),
  '',
  input.unit || 'un',
  typeof input.cost === 'number' ? formatBrazilianNumber(input.cost) : input.cost,
  input.source,
].map(sanitizeCell).join('\t');

type Anchor = {
  index: number;
  item: string;
  code: string;
  quantity: string;
  unit: string;
  rest: string;
  inlineFab: string;
};

const parseAnchor = (line: string, index: number): Anchor | undefined => {
  const match = clean(line).match(/^(\d{1,3})\s+(\d{3,8})\s+(.+)$/i);
  if (!match) return undefined;
  const [, item, code, tail] = match;
  const tokens = tail.split(/\s+/);
  const unitIndex = tokens.findIndex((token) => UNIT_PATTERN.test(token));
  if (unitIndex < 1) return undefined;

  const quantity = tokens[unitIndex - 1]?.replace(/[^\d.,]/g, '') ?? '';
  if (!/^\d+(?:[.,]\d+)?$/.test(quantity)) return undefined;
  const inlineFab = tokens.slice(0, unitIndex - 1).join('').trim();
  const unit = tokens[unitIndex].toUpperCase();
  const rest = tokens.slice(unitIndex + 1).join(' ').trim();
  if (!rest) return undefined;
  return { index, item, code, quantity, unit, rest, inlineFab };
};

const isLikelyDescription = (line: string) => {
  if (!line || STOP_BACKTRACK.test(line) || extractReaisPrices(line).length > 0) return false;
  if (/^U\s*[$S]|^US\s*[$S]/i.test(line)) return false;
  if (/^[A-Z0-9./_-]{1,20}$/i.test(line)) return false;
  return /[A-Za-zÀ-ÿ]{3}/.test(line);
};

const descriptionBefore = (lines: string[], anchorIndex: number, previousAnchorIndex: number) => {
  const collected: string[] = [];
  for (let index = anchorIndex - 1; index > previousAnchorIndex && collected.length < 5; index -= 1) {
    const line = clean(lines[index]);
    if (!line || STOP_BACKTRACK.test(line)) break;
    if (parseAnchor(line, index)) break;
    if (!isLikelyDescription(line)) continue;
    collected.unshift(line);
  }
  return clean(collected.join(' '));
};

const codeFabAfterPrice = (lines: string[], priceIndex: number, nextItemIndex: number, inlineFab: string) => {
  if (inlineFab && /[A-Za-z]/.test(inlineFab)) return inlineFab;
  const parts: string[] = [];
  const limit = Math.min(nextItemIndex, priceIndex + 5);
  for (let index = priceIndex + 1; index < limit; index += 1) {
    const line = clean(lines[index]);
    if (!line || parseAnchor(line, index)) break;
    if (/R\s*\$\s*[0O][,.][0O]{2}/i.test(line)) {
      const prefix = clean(line.replace(/R\s*\$.*$/i, ''));
      if (prefix && /^[A-Z0-9./_-]+$/i.test(prefix)) parts.push(prefix);
      break;
    }
    if (extractReaisPrices(line).length > 0) break;
    if (/^[A-Z0-9./_-]+$/i.test(line) && (/[A-Z]/i.test(line) || /^\d{5,12}$/.test(line))) parts.push(line);
  }
  return parts.join('').replace(/\s+/g, '') || inlineFab;
};

const parseMeta = (rest: string) => {
  const normalized = clean(rest);
  // Não depende dos valores em U$, pois OCR costuma ler 0 como O (U$O,OO).
  const meta = normalized.match(/^(?:(.*?)\s+)?(\d{3})\s+(\d{8})\s+(.+?)\s+(IMEDIATO|\d+\s+DIAS)\b/i);
  if (!meta) return undefined;
  return {
    inlineDescription: clean(meta[1] ?? ''),
    brand: clean(meta[4]),
  };
};

const parseTelcabos = (text: string) => {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const anchors = lines.map((line, index) => parseAnchor(line, index)).filter((anchor): anchor is Anchor => Boolean(anchor));
  const hasStrongHint = TELCABOS_HINT.test(text);
  const looksLikeTelcabos = hasStrongHint || anchors.length >= 8;
  if (!looksLikeTelcabos || anchors.length < 2) return undefined;

  const output: string[] = [];
  for (let position = 0; position < anchors.length; position += 1) {
    const anchor = anchors[position];
    const nextItemIndex = anchors[position + 1]?.index ?? lines.length;
    const previousItemIndex = anchors[position - 1]?.index ?? -1;
    const meta = parseMeta(anchor.rest);
    if (!meta) continue;

    const description = meta.inlineDescription || descriptionBefore(lines, anchor.index, previousItemIndex);
    if (description.length < 3) continue;

    let price = '';
    let priceIndex = -1;
    for (let cursor = anchor.index; cursor < nextItemIndex && cursor <= anchor.index + 10; cursor += 1) {
      const prices = extractReaisPrices(lines[cursor]);
      if (prices.length > 0) {
        price = prices[0];
        priceIndex = cursor;
        break;
      }
    }
    if (!price) continue;

    const fabCode = priceIndex >= 0 ? codeFabAfterPrice(lines, priceIndex, nextItemIndex, anchor.inlineFab) : anchor.inlineFab;
    const source = fabCode ? `TELCABOS COD.FAB ${fabCode}` : 'TELCABOS';
    output.push(toRow({
      code: anchor.code,
      description,
      manufacturer: meta.brand,
      unit: anchor.unit.toLowerCase(),
      cost: price,
      source,
    }));
  }

  if (output.length < 2) return undefined;
  return [HEADER, ...output].join('\n');
};

const looksStructured = (text: string) => {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  if (!firstLine.includes('\t') && !firstLine.includes(';') && !firstLine.includes(',')) return false;
  const normalized = firstLine.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /codigo|sku|code/.test(normalized) && /descricao|produto|description/.test(normalized);
};

const isGenericDescription = (value: string) => {
  const line = clean(value);
  if (line.length < 4 || ADMIN_PATTERN.test(line)) return false;
  if (!/[A-Za-zÀ-ÿ]{3}/.test(line)) return false;
  if (/^(?:R\s*\$|US?\s*\$|\d+[.,]?\d*)/i.test(line) && line.split(/\s+/).length < 3) return false;
  return true;
};

const extractQuantityAndUnit = (value: string) => {
  const match = value.match(/\b(\d+(?:[.,]\d+)?)\s*(PC|PÇ|PCA|PÇS|MT|M|UN|UND|UNID|CX|RL|BB|KIT|JG|SV)\b/i);
  return match ? { quantity: parseBrazilianNumber(match[1]), unit: match[2].toLowerCase() } : { quantity: 0, unit: 'un' };
};

const extractCode = (value: string) => {
  const labeled = value.match(/\b(?:c[oó]d(?:igo)?|sku|ref(?:er[eê]ncia)?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9./_-]{2,31})\b/i)?.[1];
  if (labeled) return labeled;
  const withoutItem = value.replace(/^\s*\d{1,3}[.)-]?\s+/, '');
  const prefix = withoutItem.match(/^([A-Z0-9][A-Z0-9./_-]{2,31})\s+/i)?.[1] ?? '';
  if (!prefix || /^\d{1,3}$/.test(prefix)) return '';
  if (/^\d+[.,]\d{2}$/.test(prefix)) return '';
  return /\d/.test(prefix) ? prefix : '';
};

const stripGenericMetadata = (value: string, code: string) => {
  let result = clean(value);
  result = result.replace(/^\s*\d{1,3}[.)-]?\s+/, '');
  if (code) result = result.replace(new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), '');
  result = result.replace(/\b(?:c[oó]d(?:igo)?|sku|ref(?:er[eê]ncia)?)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,31}\b/gi, '');
  result = result.replace(/\b\d+(?:[.,]\d+)?\s*(?:PC|PÇ|PCA|PÇS|MT|M|UN|UND|UNID|CX|RL|BB|KIT|JG|SV)\b/gi, '');
  result = result.replace(REAIS_PRICE, '');
  return clean(result.replace(/^[|:;,.\-–—]+|[|:;,.\-–—]+$/g, ''));
};

const chooseUnitPrice = (prices: string[], quantity: number) => {
  if (prices.length === 0) return 0;
  const values = prices.map(parseBrazilianNumber).filter((value) => value > 0);
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  if (quantity > 0) {
    for (let index = 0; index < values.length - 1; index += 1) {
      const unit = values[index];
      const possibleTotal = values[index + 1];
      if (possibleTotal > 0 && Math.abs((unit * quantity) - possibleTotal) / possibleTotal < 0.08) return unit;
    }
  }
  return values[0];
};

const parseGeneric = (text: string, sourceName: string) => {
  if (looksStructured(text) || EXSAT_HINT.test(text) || TELCABOS_HINT.test(text)) return undefined;
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const hasPriceHeader = GENERIC_PRICE_HEADER.test(text);
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    let prices = extractReaisPrices(line);
    if (prices.length === 0 && hasPriceHeader) {
      prices = [...line.matchAll(BARE_PRICE)].map((match) => match[1]);
    }
    if (prices.length === 0) continue;

    let context = line;
    if (!isGenericDescription(stripGenericMetadata(context, extractCode(context)))) {
      const previous: string[] = [];
      for (let cursor = index - 1; cursor >= 0 && cursor >= index - 4; cursor -= 1) {
        const candidate = lines[cursor];
        if (extractReaisPrices(candidate).length > 0 || ADMIN_PATTERN.test(candidate)) break;
        if (isGenericDescription(candidate)) previous.unshift(candidate);
      }
      if (previous.length > 0) context = `${previous.join(' ')} ${line}`;
    }

    const code = extractCode(context);
    const { quantity, unit } = extractQuantityAndUnit(context);
    const description = stripGenericMetadata(context, code);
    const cost = chooseUnitPrice(prices, quantity);
    if (cost <= 0 || !isGenericDescription(description)) continue;

    const autoOrCode = code || stableAutoCode(description);
    const key = `${autoOrCode.toUpperCase()}|${description.toUpperCase()}|${cost.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(toRow({
      code: autoOrCode,
      description,
      unit,
      cost,
      source: `OCR ${sourceName || 'DOCUMENTO'}`,
    }));
  }

  if (candidates.length === 0) return undefined;
  return [HEADER, ...candidates].join('\n');
};

export const normalizeCatalogImportFile = (result: CatalogImportFile): CatalogImportFile => {
  if (result.canceled || !result.text) return result;

  // Tabelas já estruturadas devem chegar intactas ao renderer.
  if (looksStructured(result.text)) return result;

  const telcabos = parseTelcabos(result.text);
  if (telcabos) return { ...result, text: telcabos };

  // Exsat mantém seu parser especializado, que conhece Vl. Líq. e demais colunas próprias.
  if (EXSAT_HINT.test(result.text)) return result;

  const generic = parseGeneric(result.text, result.name ?? 'DOCUMENTO');
  return generic ? { ...result, text: generic } : result;
};
