import type { CatalogImportItem, CatalogImportStatus } from '../shared/contracts';

export type Row = CatalogImportItem & { key: string; status?: CatalogImportStatus };

export const aliases: Record<string, keyof CatalogImportItem | null> = {
  codigo: 'code', cód: 'code', cod: 'code', sku: 'code', code: 'code',
  descricao: 'description', descrição: 'description', produto: 'description', item: 'description', description: 'description',
  categoria: 'category', grupo: 'category', category: 'category', fabricante: 'manufacturer', marca: 'manufacturer',
  modelo: 'model', model: 'model', unidade: 'unit', unid: 'unit', und: 'unit', unit: 'unit',
  custo: 'currentCost', preco: 'currentCost', preço: 'currentCost', valor: 'currentCost',
  total: 'currentCost', valortotal: 'currentCost', totalitem: 'currentCost', totalproduto: 'currentCost',
  parcela: null, parcelas: null, valorparcela: null, valordaparcela: null,
  fonte: 'source', fornecedor: 'source', source: 'source', ativo: 'active', active: 'active',
};

export const normalizeHeader = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

export const costPriority = (header: string) => {
  if (/parcela/.test(header)) return 0;
  if (/total/.test(header)) return 3;
  if (/liq|liquido/.test(header)) return 2;
  return aliases[header] === 'currentCost' ? 1 : 0;
};

export const moneyValue = (value: string | number) => {
  if (typeof value === 'number') return value;
  const clean = value.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean.replace(/\.(?=.*\.)/g, '');
  const result = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(result) && result >= 0 ? result : 0;
};

export const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const splitLine = (line: string, delimiter: string) => {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { values.push(value.trim()); value = ''; }
    else value += char;
  }
  values.push(value.trim());
  return values;
};

export const newRow = (partial: Partial<CatalogImportItem> & { status?: CatalogImportStatus } = {}): Row => ({
  key: crypto.randomUUID(), code: '', description: '', category: 'Importado', manufacturer: null,
  model: null, unit: 'un', currentCost: 0, source: 'IMPORTAÇÃO', active: true, ...partial,
});

export const categoryFromDescription = (description: string) => {
  if (/c[aâ]mera|dvr|nvr|gravador|cftv/i.test(description)) return 'CFTV';
  if (/fechadura|controle de acesso|controlador de acesso|porteiro|videoporteiro|catraca/i.test(description)) return 'Controle de acesso';
  if (/cabo|conector|switch|roteador|rack|patch/i.test(description)) return 'Redes e cabeamento';
  if (/detector|sirene|inc[eê]ndio|alarme/i.test(description)) return 'Segurança eletrônica';
  return 'Exsat';
};

export const isAdministrativeExsatText = (description: string) => (
  /\b(?:cliente|construtora|construtec|engenharia|ltda|cnpj|cpf|endere[cç]o|or[cç]amento|vendedor|comprador|representante|telefone|email)\b/i.test(description)
);

export const formatSyncDate = (value?: string) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Nunca';

export const pricePattern = /(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{2})/g;
export const exsatTerminatorPattern = /\b(?:total|condi[cç][oõ]es|tipo de frete|cobran[cç]a|plano de pag|observa[cç][oõ]es)\b/i;
export const exsatPaymentTerminatorPattern = /\b(?:condi[cç][oõ]es|tipo de frete|cobran[cç]a|plano de pag|observa[cç][oõ]es)\b/i;
export const fabCodePattern = '[A-Za-z0-9][A-Za-z0-9./_-]{2,31}';
export const beforeExsatPaymentTerms = (value: string) => value.split(exsatPaymentTerminatorPattern)[0] ?? value;

export const exsatRowFromText = (line: string): Row | null => {
  const productText = beforeExsatPaymentTerms(line);
  const prices = productText.match(pricePattern) ?? [];
  const firstPrice = prices[0];
  if (!firstPrice) return null;
  const firstPriceIndex = productText.indexOf(firstPrice);
  if (firstPriceIndex < 0) return null;

  const beforePrice = productText.slice(0, firstPriceIndex).trim();
  const codePrefix = beforePrice.match(new RegExp(`^\\s*(${fabCodePattern})\\s+(\\d{2,10})\\b`, 'i'));
  if (!codePrefix || !/\d/.test(codePrefix[1])) return null;
  const manufacturerCode = codePrefix[1];
  const supplierCode = codePrefix[2];
  const description = beforePrice.slice(codePrefix[0].length)
    .replace(/^\s*[-–—|:;]+\s*/, '')
    .replace(/\b(?:un|und|pc|p[cç])\b\s*$/i, '')
    .trim();
  if (description.length < 3 || isAdministrativeExsatText(description) || exsatTerminatorPattern.test(description)) return null;

  return newRow({
    code: manufacturerCode,
    description,
    category: categoryFromDescription(description),
    manufacturer: /intelbras|\b(?:VHL|VIP|MHDX|IMHDX|SS|IVP|AMT|XAS|EFM)\b/i.test(description) ? 'Intelbras' : null,
    model: null,
    unit: 'un',
    currentCost: moneyValue(prices.at(-1) ?? '0'),
    source: `EXSAT COD. ${supplierCode}`,
    active: true,
  });
};

export const parseExsatQuoteLines = (text: string): Row[] => {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const directRows = lines.map(exsatRowFromText).filter((row): row is Row => Boolean(row));
  if (directRows.length > 0) return directRows;

  const blocks: string[] = [];
  let current = '';
  const startsProductPattern = new RegExp(`^\\s*${fabCodePattern}\\s+\\d{2,10}\\b`, 'i');
  for (const line of lines) {
    if (exsatTerminatorPattern.test(line)) {
      if (current) blocks.push(current.trim());
      current = '';
      continue;
    }
    const startsProduct = startsProductPattern.test(line) && /\d/.test(line.split(/\s+/)[0] ?? '');
    if (startsProduct && current) blocks.push(current.trim());
    if (startsProduct) current = line;
    else if (current && !isAdministrativeExsatText(line)) current += ` ${line}`;
  }
  if (current) blocks.push(current.trim());
  return blocks.map(exsatRowFromText).filter((row): row is Row => Boolean(row));
};

export const parseExsatQuoteText = (text: string): Row[] => {
  const lineRows = parseExsatQuoteLines(text);
  if (lineRows.length > 0) return lineRows;

  const normalized = text.replace(/\s+/g, ' ').trim();
  const productPattern = new RegExp(`(${fabCodePattern})\\s+(\\d{2,10})\\s+(.+?)\\s+(\\d+(?:[.,]\\d{3})?)\\s+([\\d.]+,\\d{2})\\s+([\\d.]+,\\d{2})\\s+([\\d.]+,\\d{2})\\s+([\\d.]+,\\d{2})(?=\\s+${fabCodePattern}\\s+\\d{2,10}\\s+|\\s+(?:Total|Condi[cç][oõ]es|Tipo de Frete|Cobran[cç]a|Plano de Pag)|$)`, 'gi');
  const rows = [...normalized.matchAll(productPattern)].map((match) => {
    const [, manufacturerCode, supplierCode, description, , , , , totalPrice] = match;
    if (!/\d/.test(manufacturerCode) || isAdministrativeExsatText(description)) return null;
    return newRow({
      code: manufacturerCode,
      description,
      category: categoryFromDescription(description),
      manufacturer: /intelbras|\b(?:VHL|VIP|MHDX|IMHDX|SS|IVP|AMT|XAS|EFM)\b/i.test(description) ? 'Intelbras' : null,
      model: null,
      unit: 'un',
      currentCost: moneyValue(totalPrice),
      source: `EXSAT COD. ${supplierCode}`,
      active: true,
    });
  }).filter((row): row is Row => Boolean(row));
  if (rows.length > 0) return rows;

  const looseProductPattern = new RegExp(`(${fabCodePattern})\\s+(\\d{2,10})\\s+(.+?)(?=\\s+${fabCodePattern}\\s+\\d{2,10}\\s+|\\s+(?:Total|Condi[cç][oõ]es|Tipo de Frete|Cobran[cç]a|Plano de Pag|Observa[cç][oõ]es)|$)`, 'gi');
  return [...normalized.matchAll(looseProductPattern)].map((match) => {
    const [, manufacturerCode, supplierCode, rawProductText] = match;
    if (!/\d/.test(manufacturerCode)) return null;
    const productText = beforeExsatPaymentTerms(rawProductText);
    const prices = productText.match(pricePattern) ?? [];
    const firstPrice = prices[0] ? productText.indexOf(prices[0]) : -1;
    const descriptionSource = firstPrice >= 0 ? productText.slice(0, firstPrice) : productText;
    const description = descriptionSource
      .replace(/\b\d+(?:[,.]\d{1,4})?\b\s*$/g, '')
      .replace(/\b(?:un|und|pc|p[cç])\b\s*$/i, '')
      .trim();
    const embeddedCodes = description.match(/\b\d{5,14}\b/g) ?? [];
    if (!description || prices.length === 0 || embeddedCodes.length > 0 || isAdministrativeExsatText(description)) return null;
    return newRow({
      code: manufacturerCode,
      description,
      category: categoryFromDescription(description),
      manufacturer: /intelbras|\b(?:VHL|VIP|MHDX|IMHDX|SS|IVP|AMT|XAS|EFM)\b/i.test(description) ? 'Intelbras' : null,
      model: null,
      unit: 'un',
      currentCost: moneyValue(prices.at(-1) ?? '0'),
      source: `EXSAT COD. ${supplierCode}`,
      active: true,
    });
  }).filter((row): row is Row => Boolean(row));
};

export const parseStructuredTable = (text: string, source: string): Row[] | null => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : lines[0].includes(',') ? ',' : '';
  if (!delimiter) return null;
  const first = splitLine(lines[0], delimiter);
  const mappedHeaders = first.map((header) => aliases[normalizeHeader(header)]);
  const hasHeader = mappedHeaders.includes('code') && mappedHeaders.includes('description');
  if (!hasHeader) return null;

  return lines.slice(1).map((line) => {
    const values = splitLine(line, delimiter);
    const partial: Partial<CatalogImportItem> = { source, active: true };
    let currentCostPriority = 0;
    mappedHeaders.forEach((field, index) => {
      if (!field) return;
      const value = values[index] ?? '';
      if (field === 'currentCost') {
        const priority = costPriority(normalizeHeader(first[index] ?? ''));
        if (priority >= currentCostPriority) {
          partial.currentCost = moneyValue(value);
          currentCostPriority = priority;
        }
      }
      else if (field === 'active') partial.active = !/^(nao|não|0|false|inativo)$/i.test(value);
      else if (field === 'manufacturer' || field === 'model') partial[field] = value || null;
      else if (field !== 'validationStatus') partial[field] = value;
    });
    return newRow(partial);
  }).filter((row) => row.code || row.description);
};

export const parseCatalogText = (text: string, source: string): Row[] => {
  const structuredRows = parseStructuredTable(text, source);
  if (structuredRows) return structuredRows;

  const exsatQuoteRows = parseExsatQuoteText(text);
  if (exsatQuoteRows.length > 0) return exsatQuoteRows;
  if (source === 'IMAGEM' && /(?:Print\s*Preview|Num\.?\s*Or[cç]amento|Vl\.?\s*L[ií]q|Condi[cç][oõ]es\s+de\s+Pagamento)/i.test(text)) return [];

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  return lines.map((line) => {
    const values = splitLine(line, delimiter);
    if (values.length >= 2) return newRow({
      code: values[0], description: values[1], category: values[2] || 'Importado',
      manufacturer: values[3] || (/intelbras/i.test(values[1]) ? 'Intelbras' : null), model: values[4] || null,
      unit: values[5] || 'un', currentCost: moneyValue(values[6] ?? values.at(-1) ?? '0'), source,
    });
    const code = line.match(/^([A-Za-z0-9./_-]{3,60})\s+/)?.[1] ?? '';
    const price = line.match(/R\$\s*[\d.]+,\d{2}|[\d.]+,\d{2}\s*$/)?.[0] ?? '0';
    const description = line.replace(code, '').replace(price, '').trim().replace(/^[-–—|;]+|[-–—|;]+$/g, '').trim();
    return newRow({ code, description, manufacturer: /intelbras/i.test(description) ? 'Intelbras' : null, currentCost: moneyValue(price), source });
  }).filter((row) => row.code || row.description);
};
