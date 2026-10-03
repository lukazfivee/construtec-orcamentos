// Importar lista de precos no computador (Rodada 24): leitura da planilha, ligacao das colunas, conferencia das linhas
// e itens no formato da API. Mesma regra do celular (public/m/screen-imp.js): linha com erro nao entra, corrige-se na
// tabela ou fica de fora. Funcoes puras (a leitura do XLSX usa DOMParser e DecompressionStream, so no navegador).
import type { CatalogImportItem, CatalogImportPreviewItem, CatalogImportPrevious } from '../shared/contracts';

export const MAX_BYTES = 12 * 1024 * 1024;
export const MAX_ROWS = 5000;
export const CHUNK = 500;

export type FieldKey = 'cod' | 'desc' | 'un' | 'custo' | 'cat';
export const FIELDS: ReadonlyArray<{ key: FieldKey; label: string; required: boolean }> = [
  { key: 'cod', label: 'Código', required: true },
  { key: 'desc', label: 'Descrição', required: true },
  { key: 'un', label: 'Unidade', required: true },
  { key: 'custo', label: 'Custo', required: true },
  { key: 'cat', label: 'Categoria', required: false },
];
export const FIELD_LABEL = Object.fromEntries(FIELDS.map((field) => [field.key, field.label])) as Record<FieldKey, string>;

export type RawRow = { ln: number; cells: string[] };
export type Table = { header: string[]; rows: RawRow[] };
export type ColumnMap = Partial<Record<FieldKey, number>>;
export type Fixes = Record<string, Partial<Record<FieldKey, string>>>;

export type ReadErrorKind = 'locked' | 'corrupt' | 'unsupported' | 'big';
export class ReadError extends Error {
  kind: ReadErrorKind;
  constructor(kind: ReadErrorKind, message: string) { super(message); this.kind = kind; }
}

const UNIT_SYN: Record<string, string> = {
  und: 'un', unid: 'un', unidade: 'un', unid_: 'un', pc: 'pç', pca: 'pç', pcs: 'pç', 'pç': 'pç', 'peça': 'pç', peca: 'pç',
  mt: 'm', mts: 'm', metro: 'm', metros: 'm', caixa: 'cx', rolo: 'rl',
};

export const norm = (value: unknown) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export const colLetter = (index: number) => {
  let n = index, out = '';
  do { out = String.fromCharCode(65 + (n % 26)) + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return out;
};

export const kb = (bytes: number) => (bytes >= 1048576
  ? `${(bytes / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export const brNumber = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- leitura de arquivo ----------
export const decodeText = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''); } catch { return new TextDecoder('windows-1252').decode(bytes); }
};

// Delimitador pela primeira linha com conteudo; aspas duplas e quebras de linha dentro de aspas valem.
export const parseDelimited = (text: string): string[][] => {
  const first = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const counts = [';', '\t', ','].map((d) => [d, first.split(d).length - 1] as const).sort((a, b) => b[1] - a[1]);
  const delimiter = counts[0][1] > 0 ? counts[0][0] : ';';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
};

const inflateRaw = async (bytes: Uint8Array) => {
  if (typeof DecompressionStream === 'undefined') throw new ReadError('unsupported', 'Este navegador não abre arquivos .xlsx. Salve a planilha como CSV e importe de novo.');
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const unzip = async (buffer: ArrayBuffer) => {
  const u8 = new Uint8Array(buffer), dv = new DataView(buffer);
  let e = u8.length - 22;
  for (; e >= Math.max(0, u8.length - 65557); e -= 1) if (dv.getUint32(e, true) === 0x06054b50) break;
  if (e < 0 || dv.getUint32(e, true) !== 0x06054b50) throw new ReadError('corrupt', 'O arquivo não parece uma planilha do Excel.');
  const total = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const files: Record<string, { method: number; size: number; header: number }> = {};
  const decoder = new TextDecoder();
  for (let i = 0; i < total; i += 1) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new ReadError('corrupt', 'A planilha está danificada.');
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), cmtLen = dv.getUint16(p + 32, true);
    files[decoder.decode(u8.subarray(p + 46, p + 46 + nameLen))] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), header: dv.getUint32(p + 42, true) };
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return {
    names: () => Object.keys(files),
    async text(name: string): Promise<string | null> {
      const f = files[name];
      if (!f) return null;
      const start = f.header + 30 + dv.getUint16(f.header + 26, true) + dv.getUint16(f.header + 28, true);
      const data = u8.subarray(start, start + f.size);
      if (f.method === 0) return decoder.decode(data);
      if (f.method === 8) return decoder.decode(await inflateRaw(data));
      throw new ReadError('corrupt', 'A planilha usa um formato de compressão que não dá para abrir aqui.');
    },
  };
};

const xml = (text: string) => new DOMParser().parseFromString(text, 'application/xml');
const colIndex = (ref: string | null) => {
  const match = /^([A-Z]+)/.exec(ref ?? '');
  if (!match) return -1;
  let n = 0;
  for (const ch of match[1]) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};

export const parseXlsx = async (buffer: ArrayBuffer): Promise<string[][]> => {
  const head = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
  if (head[0] === 0xD0 && head[1] === 0xCF && head[2] === 0x11 && head[3] === 0xE0) throw new ReadError('locked', 'protegido por senha');
  const zip = await unzip(buffer);
  if (zip.names().some((name) => name === 'EncryptedPackage')) throw new ReadError('locked', 'protegido por senha');
  let sheetPath = '';
  const wb = await zip.text('xl/workbook.xml'), rels = await zip.text('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const sheet = xml(wb).getElementsByTagName('sheet')[0];
    const rid = sheet && (sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const rel = Array.from(xml(rels).getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rid);
    if (rel) { const target = rel.getAttribute('Target') ?? ''; sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`; }
  }
  if (!sheetPath || !zip.names().includes(sheetPath)) sheetPath = zip.names().filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0] ?? '';
  if (!sheetPath) throw new ReadError('corrupt', 'Não achei nenhuma aba na planilha.');
  const shared: string[] = [];
  const sst = await zip.text('xl/sharedStrings.xml');
  if (sst) for (const si of Array.from(xml(sst).getElementsByTagName('si'))) shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''));
  const doc = xml((await zip.text(sheetPath)) ?? '');
  const rows: string[][] = [];
  for (const r of Array.from(doc.getElementsByTagName('row'))) {
    const line: string[] = [];
    for (const c of Array.from(r.getElementsByTagName('c'))) {
      const idx = colIndex(c.getAttribute('r'));
      if (idx < 0) continue;
      const type = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], raw = v ? (v.textContent ?? '') : '';
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = Array.from(c.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');
      else if (type === 'str' || type === 'b') value = raw;
      else if (type === 'e') value = '';
      else if (raw !== '') { const n = Number(raw); value = Number.isFinite(n) && /[.eE]/.test(raw) ? String(n).replace('.', ',') : raw; }
      line[idx] = value;
    }
    rows.push(Array.from(line, (x) => x ?? ''));
  }
  return rows;
};

// Devolve a tabela crua (linhas de celulas). Erros: ReadError com kind locked, corrupt, unsupported, big.
export const readTableFile = async (file: File, stage: (pct: number) => void): Promise<RawRow[]> => {
  if (file.size > MAX_BYTES) throw new ReadError('big', `O arquivo tem ${kb(file.size)}. O limite é ${kb(MAX_BYTES)}.`);
  stage(20);
  const buffer = await file.arrayBuffer();
  stage(55);
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  let rows: string[][];
  if (ext === 'xlsx' || ext === 'xlsm') rows = await parseXlsx(buffer);
  else if (['csv', 'tsv', 'txt'].includes(ext)) rows = parseDelimited(decodeText(buffer));
  else if (ext === 'xls') throw new ReadError('unsupported', 'Arquivos .xls antigos não abrem aqui. Salve como .xlsx ou CSV e importe de novo.');
  else if (['pdf', 'png', 'jpg', 'jpeg', 'bmp'].includes(ext)) throw new ReadError('unsupported', 'PDF e foto passam pelo reconhecimento de imagem, que roda no aplicativo do computador (botão Foto ou PDF). Aqui use planilha XLSX ou CSV.');
  else throw new ReadError('unsupported', 'Formato não aceito. Use XLSX, CSV, TSV ou TXT.');
  stage(90);
  return rows.map((cells, i) => ({ ln: i + 1, cells })).filter((row) => row.cells.some((cell) => String(cell).trim() !== ''));
};

// ---------- colunas ----------
const TESTS: Record<FieldKey, [RegExp, RegExp]> = {
  cod: [/^(codigo|cod|sku|code|referencia|ref)$/, /^(cod|codigo|ref|sku)/],
  un: [/^(un|und|unid|unidade|um|unit)$/, /^(un|und|unid)/],
  custo: [/^(custo|preco|valor|price)$/, /(custo|preco|valor|vlunit|unitario)/],
  desc: [/^(descricao|produto|item|nome|description)$/, /(descri|produto|item|nome)/],
  cat: [/^(categoria|grupo|linha|familia|category)$/, /(categ|grupo|linha|famil)/],
};
const AVOID: Partial<Record<FieldKey, RegExp>> = {
  custo: /parcela|estoque|qtd|quantidade|total|desconto|icms|ipi/, cod: /fornecedor|fabricante/, desc: /codigo|cod\b/,
};

// Sugere uma coluna para cada campo; conf marca os campos com mais de uma candidata ("Confira").
export const suggestColumns = (header: string[]): { map: ColumnMap; conf: Partial<Record<FieldKey, boolean>> } => {
  const heads = header.map((h) => norm(h));
  const used = new Set<number>();
  const map: ColumnMap = {};
  const conf: Partial<Record<FieldKey, boolean>> = {};
  for (const key of ['cod', 'un', 'custo', 'desc', 'cat'] as FieldKey[]) {
    const [exact, fuzzy] = TESTS[key];
    const avoid = AVOID[key];
    const ok = (i: number) => !used.has(i) && heads[i] && !(avoid && avoid.test(heads[i]));
    const exactHits = heads.map((h, i) => (ok(i) && exact.test(h) ? i : -1)).filter((i) => i >= 0);
    const fuzzyHits = heads.map((h, i) => (ok(i) && fuzzy.test(h) ? i : -1)).filter((i) => i >= 0);
    const pick = exactHits.length ? exactHits[0] : (fuzzyHits.length ? fuzzyHits[0] : -1);
    if (pick >= 0) { map[key] = pick; used.add(pick); conf[key] = (exactHits.length || fuzzyHits.length) > 1; }
  }
  return { map, conf };
};

// Cabecalho ligado/desligado: sem cabecalho as colunas viram "Coluna A", "Coluna B".
export const buildTable = (raw: RawRow[], hasHeader: boolean): Table => {
  const width = Math.max(1, ...raw.map((row) => row.cells.length));
  const header = Array.from({ length: width }, (_, i) => (hasHeader ? String(raw[0]?.cells[i] ?? '').trim() : '') || `Coluna ${colLetter(i)}`);
  const body = hasHeader ? raw.slice(1) : raw;
  const rows = body.map((row) => ({ ln: row.ln, cells: Array.from({ length: width }, (_, i) => String(row.cells[i] ?? '').trim()) }));
  return { header, rows };
};

// ---------- validacao das linhas ----------
export const parseNumber = (text: string) => {
  const t = String(text).replace(/R\s*\$/gi, '').replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(t)) return NaN;
  let s = t;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\.(?=.*\.)/g, '');
  return Number(s);
};

export type CostCheck = { value: number } | { prob: string; fx: FieldKey; sug?: string };
export const checkCost = (raw: unknown): CostCheck => {
  const t = String(raw ?? '').trim();
  if (!t) return { prob: 'Custo vazio', fx: 'custo' };
  const n = parseNumber(t);
  if (Number.isNaN(n)) {
    const fixed = parseNumber(t.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1'));
    return { prob: `Custo "${t}" tem letra no lugar de número`, fx: 'custo', sug: Number.isFinite(fixed) && fixed > 0 ? brNumber(fixed) : '' };
  }
  if (n < 0) return { prob: `Custo negativo (−${brNumber(Math.abs(n))})`, fx: 'custo', sug: brNumber(Math.abs(n)) };
  if (n === 0) return { prob: 'Custo zerado', fx: 'custo' };
  if (n > 1e9) return { prob: 'Custo acima do limite', fx: 'custo' };
  return { value: Math.round(n * 100) / 100 };
};

export const normUnit = (raw: unknown) => {
  const unit = String(raw ?? '').trim().toLowerCase().replace(/\.$/, '');
  return UNIT_SYN[unit] ?? unit;
};

export type GoodRow = { id: string; ln: number; code: string; desc: string; unit: string; cost: number; category: string; fixed: boolean };
export type ErrRow = { id: string; ln: number; code: string; desc: string; prob: string; fx: FieldKey | ''; sug?: string; left: boolean };
export type AnalyseInput = { table: Table; map: ColumnMap; units: string[]; fix: Fixes; out: Record<string, boolean> };

// Analisa as linhas com o mapeamento e as correcoes; devolve itens validos e linhas com erro.
export const analyse = ({ table, map, units, fix, out }: AnalyseInput): { good: GoodRow[]; errs: ErrRow[] } => {
  const seen = new Map<string, number>();
  const good: GoodRow[] = [];
  const errs: ErrRow[] = [];
  for (const row of table.rows) {
    const id = `r${row.ln}`, fixes = fix[id] ?? {};
    const cell = (key: FieldKey) => (key in fixes ? fixes[key] : (map[key] !== undefined && map[key]! >= 0 ? row.cells[map[key]!] : ''));
    const code = String(cell('cod') ?? '').trim().toUpperCase(), desc = String(cell('desc') ?? '').trim().replace(/\s+/g, ' ');
    let bad: { prob: string; fx: FieldKey | ''; sug?: string } | null = null;
    if (!code) bad = { prob: 'Código vazio', fx: 'cod' };
    else if (code.length < 2) bad = { prob: 'Código com menos de 2 caracteres', fx: 'cod' };
    else if (code.length > 60) bad = { prob: 'Código com mais de 60 caracteres', fx: 'cod' };
    else if (desc.length < 3) bad = { prob: desc ? 'Descrição curta demais' : 'Descrição vazia', fx: 'desc' };
    else if (desc.length > 400) bad = { prob: 'Descrição com mais de 400 caracteres', fx: 'desc' };
    let unit = '';
    if (!bad) {
      unit = normUnit(cell('un'));
      if (!unit) bad = { prob: 'Unidade vazia', fx: 'un' };
      else if (unit.length > 20 || (units.length && !units.includes(unit))) bad = { prob: `Unidade "${String(cell('un') ?? '').trim()}" não existe no catálogo`, fx: units.length ? 'un' : '' };
    }
    let cost = 0;
    if (!bad) {
      const check = checkCost(cell('custo'));
      if ('prob' in check) bad = check; else cost = check.value;
    }
    if (!bad) {
      const key = code.toLowerCase();
      if (seen.has(key)) bad = { prob: `Código repetido · já está na linha ${seen.get(key)}`, fx: '' };
      else seen.set(key, row.ln);
    }
    if (bad) { errs.push({ id, ln: row.ln, code, desc, ...bad, left: !!out[id] }); continue; }
    let category = String(cell('cat') ?? '').trim();
    if (category.length < 2) category = '';
    good.push({ id, ln: row.ln, code, desc, unit, cost, category, fixed: id in fix });
  }
  return { good, errs };
};

// Item no formato da API; no que ja existe preserva fabricante, modelo, categoria e origem quando o arquivo nao traz.
export const toItem = (good: GoodRow, previous: CatalogImportPrevious | null, supplier: string, fallbackCategory = 'Materiais'): CatalogImportItem => ({
  code: good.code,
  manufacturer: previous ? previous.manufacturer : null,
  model: previous ? previous.model : null,
  description: good.desc,
  category: good.category || (previous ? previous.category : fallbackCategory),
  unit: good.unit,
  currentCost: good.cost,
  source: supplier || (previous ? previous.source : 'IMPORTAÇÃO'),
  active: true,
});

export type Classified = { novos: Array<{ g: GoodRow; p?: CatalogImportPreviewItem }>; atu: Array<{ g: GoodRow; p?: CatalogImportPreviewItem }>; same: GoodRow[] };
export const classify = (good: GoodRow[], previews: Map<string, CatalogImportPreviewItem>): Classified => {
  const novos: Classified['novos'] = [], atu: Classified['atu'] = [], same: GoodRow[] = [];
  for (const g of good) {
    const p = previews.get(g.code.toLowerCase());
    const status = p ? p.status : 'new';
    if (status === 'new') novos.push({ g, p });
    else if (status === 'updated') atu.push({ g, p });
    else same.push(g);
  }
  return { novos, atu, same };
};

export const pctText = (ratio: number) => `${ratio > 0 ? '+' : (ratio < 0 ? '−' : '')}${Math.abs(ratio * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
export const errorsCsv = (list: Array<Pick<ErrRow, 'ln' | 'code' | 'desc' | 'prob'>>) =>
  ['Linha;Código;Descrição;Problema', ...list.map((e) => [e.ln, e.code, e.desc, e.prob].map(csvCell).join(';'))].join('\r\n');

// Planilha modelo (UTF-8 com BOM, separador ponto e virgula) para quem ainda nao tem a lista no formato certo.
export const templateCsv = () => ['Código;Descrição;Unidade;Custo;Categoria', 'EX-0001;Câmera IP bullet 4 MP;un;689,90;CFTV', 'EX-0002;Cabo UTP Cat6 (metro);m;4,80;Redes e cabeamento'].join('\r\n');

// Texto reconhecido por OCR (colunas separadas por TAB, mesma ordem do dialogo antigo) vira tabela crua.
export const ocrTextToRaw = (text: string): RawRow[] => parseDelimited(text.trim())
  .map((cells, i) => ({ ln: i + 1, cells: cells.map((c) => c.trim()) }))
  .filter((row) => row.cells.some(Boolean));

