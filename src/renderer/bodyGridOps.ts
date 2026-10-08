// Operacoes puras sobre a planilha propria do corpo da proposta (o editor so chama estas funcoes).
import { BODY_LIMITS, type BodyTable } from '../shared/proposalBody';

const clip = (value: string) => value.slice(0, BODY_LIMITS.tableCell);

// Texto copiado do Excel/Planilhas: celulas separadas por tab, linhas por quebra; celula com quebra ou aspas vem entre aspas.
export const parseClipboardTable = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const input = text.replace(/\r\n?/g, '\n');
  for (let at = 0; at < input.length; at += 1) {
    const char = input[at];
    if (quoted) {
      if (char === '"' && input[at + 1] === '"') { cell += '"'; at += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === '\t') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((line) => line.some((value) => value.trim() !== '')).map((line) => line.map((value) => clip(value.replace(/\s+/g, ' ').trim())));
};

// So vale colar quando ha mais de uma celula ou mais de uma linha; texto simples segue o caminho normal do campo.
export const isTablePaste = (text: string) => /[\t\n]/.test(text.replace(/\n$/, '').replace(/\r\n$/, ''));

// Planilha nova a partir do que foi colado: a primeira linha vira o cabecalho.
export const tableFromPaste = (cells: string[][]): BodyTable | null => {
  if (cells.length === 0) return null;
  const columns = Math.min(Math.max(...cells.map((line) => line.length)), BODY_LIMITS.tableCols);
  const fit = (line: string[]) => Array.from({ length: columns }, (_, column) => line[column] ?? '');
  return { headers: fit(cells[0]), rows: cells.slice(1, BODY_LIMITS.tableRows + 1).map(fit) };
};

export const setHeader = (table: BodyTable, column: number, value: string): BodyTable =>
  ({ ...table, headers: table.headers.map((header, at) => (at === column ? clip(value) : header)) });

export const setCell = (table: BodyTable, row: number, column: number, value: string): BodyTable =>
  ({ ...table, rows: table.rows.map((line, at) => (at === row ? line.map((cell, index) => (index === column ? clip(value) : cell)) : line)) });

export const canAddRow = (table: BodyTable) => table.rows.length < BODY_LIMITS.tableRows;
export const canAddColumn = (table: BodyTable) => table.headers.length < BODY_LIMITS.tableCols;
export const canRemoveColumn = (table: BodyTable) => table.headers.length > 1;

export const addRow = (table: BodyTable): BodyTable =>
  (canAddRow(table) ? { ...table, rows: [...table.rows, table.headers.map(() => '')] } : table);
export const removeRow = (table: BodyTable, row: number): BodyTable => ({ ...table, rows: table.rows.filter((_, at) => at !== row) });
export const addColumn = (table: BodyTable): BodyTable =>
  (canAddColumn(table) ? { headers: [...table.headers, ''], rows: table.rows.map((line) => [...line, '']) } : table);
export const removeColumn = (table: BodyTable, column: number): BodyTable =>
  (canRemoveColumn(table)
    ? { headers: table.headers.filter((_, at) => at !== column), rows: table.rows.map((line) => line.filter((_, at) => at !== column)) }
    : table);

// Cola varias celulas a partir de uma celula (row -1 e o cabecalho); cresce em linhas e colunas ate o limite e ignora o que passa.
export const pasteInto = (table: BodyTable, row: number, column: number, cells: string[][]): BodyTable => {
  const columns = Math.min(Math.max(table.headers.length, column + Math.max(0, ...cells.map((line) => line.length))), BODY_LIMITS.tableCols);
  const grid = [table.headers, ...table.rows].map((line) => Array.from({ length: columns }, (_, at) => line[at] ?? ''));
  const top = row + 1;
  const height = Math.min(Math.max(grid.length, top + cells.length), BODY_LIMITS.tableRows + 1);
  while (grid.length < height) grid.push(Array.from({ length: columns }, () => ''));
  cells.forEach((line, y) => line.forEach((value, x) => { if (top + y < height && column + x < columns) grid[top + y][column + x] = clip(value); }));
  return { headers: grid[0], rows: grid.slice(1) };
};
