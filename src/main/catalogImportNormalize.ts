import type { CatalogImportFile } from '../shared/contracts';

const HEADER = 'Código\tDescrição\tCategoria\tFabricante\tModelo\tUnidade\tCusto\tFonte';
const ITEM_LINE = /^(\d{1,3})\s+(\d{4,5})\s+(\d+)\s+([A-ZÇ]{1,5})\s+(.+)$/i;
const MONEY_PAIR = /R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})/i;
const TELCABOS_HINT = /TELCABOS|(?:Í|I)tem\s+C[oó]digo\s+C[oó]d\.?\s*Fab|Descri[cç][aã]o\s+Detalhada\s+CST\s+Class\.?Fiscal/i;
const STOP_BACKTRACK = /(?:Í|I)tem\s+C[oó]digo|TELCABOS|^Pag\s*:|R\$\s*0,00\s*$/i;

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

const inferCategory = (description: string) => {
  if (/c[aâ]mera|dvr|nvr|gravador|cftv/i.test(description)) return 'CFTV';
  if (/rack|cabo|patch|conector|fibra|fib[eé]r|dio|cord[aã]o|extens[aã]o|guia|velcro|roteador|switch|porca|parafuso|r[eé]gua/i.test(description)) return 'Redes e cabeamento';
  return 'Importado';
};

const descriptionBefore = (lines: string[], anchorIndex: number) => {
  const collected: string[] = [];
  for (let index = anchorIndex - 1; index >= 0 && collected.length < 4; index -= 1) {
    const line = clean(lines[index]);
    if (!line || STOP_BACKTRACK.test(line) || ITEM_LINE.test(line)) break;
    if (MONEY_PAIR.test(line) || /^R\$/i.test(line)) continue;
    if (/^[A-Z0-9./_-]{2,20}$/i.test(line)) continue;
    collected.unshift(line);
  }
  return clean(collected.join(' '));
};

const codeFabAfterPrice = (lines: string[], priceIndex: number, nextItemIndex: number) => {
  const parts: string[] = [];
  const limit = Math.min(nextItemIndex, priceIndex + 4);
  for (let index = priceIndex + 1; index < limit; index += 1) {
    const line = clean(lines[index]);
    if (!line || ITEM_LINE.test(line)) break;
    if (/R\$\s*0,00/i.test(line)) {
      const prefix = clean(line.replace(/R\$.*$/i, ''));
      if (prefix) parts.push(prefix);
      break;
    }
    if (MONEY_PAIR.test(line)) break;
    if (/^[A-Z0-9./_-]+$/i.test(line)) parts.push(line);
  }
  return parts.join('').replace(/\s+/g, '');
};

const parseTelcabos = (text: string) => {
  if (!TELCABOS_HINT.test(text)) return undefined;
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const anchors: Array<{ index: number; match: RegExpMatchArray }> = [];
  lines.forEach((line, index) => {
    const match = line.match(ITEM_LINE);
    if (match) anchors.push({ index, match });
  });
  if (anchors.length < 2) return undefined;

  const output: string[] = [];
  for (let position = 0; position < anchors.length; position += 1) {
    const { index, match } = anchors[position];
    const [, , code, , unit, rest] = match;
    const nextItemIndex = anchors[position + 1]?.index ?? lines.length;

    const meta = rest.match(/^(?:(.*?)\s+)?(\d{3})\s+(\d{8})\s+(.+?)\s+(IMEDIATO|\d+\s+DIAS)\s+U(?:\$|S)\s*[\d.,]+\s+U(?:\$|S)\s*[\d.,]+\s+[\d.,]+\s*$/i);
    if (!meta) continue;

    const inlineDescription = clean(meta[1] ?? '');
    const description = inlineDescription || descriptionBefore(lines, index);
    if (description.length < 3) continue;

    let price = '';
    let priceIndex = -1;
    for (let cursor = index + 1; cursor < nextItemIndex && cursor <= index + 6; cursor += 1) {
      const money = lines[cursor].match(MONEY_PAIR);
      if (money) {
        price = money[1];
        priceIndex = cursor;
        break;
      }
    }
    if (!price) continue;

    const brand = clean(meta[4]);
    const fabCode = priceIndex >= 0 ? codeFabAfterPrice(lines, priceIndex, nextItemIndex) : '';
    const source = fabCode ? `TELCABOS COD.FAB ${fabCode}` : 'TELCABOS';
    output.push([
      code,
      description,
      inferCategory(description),
      brand,
      '',
      unit.toLowerCase(),
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
