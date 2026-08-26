import type { CatalogImportFile } from '../shared/contracts';

const HEADER = 'Código\tDescrição\tCategoria\tFabricante\tModelo\tUnidade\tCusto\tFonte';
const MONEY_PAIR = /R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})/i;
const TELCABOS_HINT = /TELCABOS|LIGHTERA|WJ\s+MOREIRA|DTEC|VELCRO|Class\.?Fiscal|Previs[aã]o\s+Entrega|Vl\.?\s*Unit[aá]rio|Descri[cç][aã]o\s+Detalhada/i;
const STOP_BACKTRACK = /(?:Í|I)tem\s+C[oó]digo|TELCABOS|^Pag\s*:|R\$\s*0,00\s*$|Desc\.\s*Impostos|Total\s+Mercadorias/i;
const UNIT_PATTERN = /^(?:PC|MT|UN|UND|M)$/i;

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

const inferCategory = (description: string) => {
  if (/c[aâ]mera|dvr|nvr|gravador|cftv/i.test(description)) return 'CFTV';
  if (/rack|cabo|patch|conector|fibra|fiber|dio|cord[aã]o|extens[aã]o|guia|velcro|roteador|switch|porca|parafuso|r[eé]gua|bandeja|placa/i.test(description)) return 'Redes e cabeamento';
  return 'Importado';
};

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
  const match = clean(line).match(/^(\d{1,3})\s+(\d{4,5})\s+(.+)$/i);
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
  if (!line || STOP_BACKTRACK.test(line) || MONEY_PAIR.test(line) || /^R\$/i.test(line)) return false;
  if (/^U\$|^US\$/i.test(line)) return false;
  if (/^\d+[.,]?\d*\s*R\$/i.test(line)) return false;
  if (/^[A-Z0-9./_-]{1,18}$/i.test(line)) return false;
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
    if (/R\$\s*0,00/i.test(line)) {
      const prefix = clean(line.replace(/R\$.*$/i, ''));
      if (prefix && /^[A-Z0-9./_-]+$/i.test(prefix)) parts.push(prefix);
      break;
    }
    if (MONEY_PAIR.test(line)) break;
    if (/^[A-Z0-9./_-]+$/i.test(line) && /[A-Z]/i.test(line)) parts.push(line);
  }
  return parts.join('').replace(/\s+/g, '') || inlineFab;
};

const parseMeta = (rest: string) => {
  const normalized = clean(rest);
  const meta = normalized.match(/^(?:(.*?)\s+)?(\d{3})\s+(\d{8})\s+(.+?)\s+(IMEDIATO|\d+\s+DIAS)\s+U(?:\$|S)\s*[\d.,]+\s+U(?:\$|S)\s*[\d.,]+\s+[\d.,]+\s*$/i);
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
    for (let cursor = anchor.index + 1; cursor < nextItemIndex && cursor <= anchor.index + 8; cursor += 1) {
      const money = lines[cursor].match(MONEY_PAIR);
      if (money) {
        price = money[1];
        priceIndex = cursor;
        break;
      }
    }
    if (!price) continue;

    const fabCode = priceIndex >= 0 ? codeFabAfterPrice(lines, priceIndex, nextItemIndex, anchor.inlineFab) : anchor.inlineFab;
    const source = fabCode ? `TELCABOS COD.FAB ${fabCode}` : 'TELCABOS';
    output.push([
      anchor.code,
      description,
      inferCategory(description),
      meta.brand,
      '',
      anchor.unit.toLowerCase(),
      price,
      source,
    ].map((value) => String(value).replace(/[\t\r\n]+/g, ' ').trim()).join('\t'));
  }

  if (output.length < 2) return undefined;
  return [HEADER, ...output].join('\n');
};

export const normalizeCatalogImportFile = (result: CatalogImportFile): CatalogImportFile => {
  if (result.canceled || !result.text) return result;
  const telcabos = parseTelcabos(result.text);
  return telcabos ? { ...result, text: telcabos } : result;
};
