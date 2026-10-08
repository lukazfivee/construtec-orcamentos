import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODY_LIMITS, type BodyTable } from '../shared/proposalBody';
import {
  addColumn, addRow, isTablePaste, parseClipboardTable, pasteInto, removeColumn, removeRow, setCell, setHeader, tableFromPaste,
} from './bodyGridOps';

const table: BodyTable = { headers: ['A', 'B'], rows: [['1', '2'], ['3', '4']] };

test('colar do Excel: celulas por tab, linhas por quebra, aspas e linha final vazia', () => {
  assert.deepEqual(parseClipboardTable('Item\tValor\r\nCabo\t10,50\r\nPorta\t"R$ 1.200,00"\r\n'), [['Item', 'Valor'], ['Cabo', '10,50'], ['Porta', 'R$ 1.200,00']]);
  assert.deepEqual(parseClipboardTable('"a ""b""\nc"\tx\n'), [['a "b" c', 'x']]);
  assert.deepEqual(parseClipboardTable('a\t\tc\n\t\t\nd\te\tf'), [['a', '', 'c'], ['d', 'e', 'f']]);
  assert.deepEqual(parseClipboardTable('   \n'), []);
});

test('so cola em grade quando vem mais de uma celula ou linha', () => {
  assert.equal(isTablePaste('texto simples'), false);
  assert.equal(isTablePaste('texto simples\n'), false);
  assert.equal(isTablePaste('a\tb'), true);
  assert.equal(isTablePaste('a\nb'), true);
});

test('planilha nova a partir do que foi colado: primeira linha e o cabecalho, colunas iguais, limites', () => {
  assert.equal(tableFromPaste([]), null);
  assert.deepEqual(tableFromPaste([['Item', 'Valor'], ['Cabo'], ['Porta', '2', 'extra']]), { headers: ['Item', 'Valor', ''], rows: [['Cabo', '', ''], ['Porta', '2', 'extra']] });
  const wide = tableFromPaste([Array.from({ length: 20 }, (_, at) => `c${at}`)]);
  assert.equal(wide?.headers.length, BODY_LIMITS.tableCols);
  const tall = tableFromPaste(Array.from({ length: 500 }, (_, at) => [`l${at}`]));
  assert.equal(tall?.rows.length, BODY_LIMITS.tableRows);
});

test('editar celulas, linhas e colunas sem mutar a planilha original', () => {
  assert.deepEqual(setHeader(table, 1, 'Z').headers, ['A', 'Z']);
  assert.deepEqual(setCell(table, 1, 0, 'x').rows, [['1', '2'], ['x', '4']]);
  assert.deepEqual(addRow(table).rows[2], ['', '']);
  assert.deepEqual(removeRow(table, 0).rows, [['3', '4']]);
  const wider = addColumn(table);
  assert.deepEqual(wider.headers, ['A', 'B', '']);
  assert.deepEqual(wider.rows[0], ['1', '2', '']);
  assert.deepEqual(removeColumn(wider, 0), { headers: ['B', ''], rows: [['2', ''], ['4', '']] });
  assert.deepEqual(removeColumn({ headers: ['so'], rows: [['1']] }, 0), { headers: ['so'], rows: [['1']] }, 'a ultima coluna nao sai');
  assert.deepEqual(table, { headers: ['A', 'B'], rows: [['1', '2'], ['3', '4']] });
});

test('limites: nao passa de 8 colunas nem de 120 linhas', () => {
  let wide = table;
  for (let at = 0; at < 20; at += 1) wide = addColumn(wide);
  assert.equal(wide.headers.length, BODY_LIMITS.tableCols);
  let tall: BodyTable = { headers: ['A'], rows: [] };
  for (let at = 0; at < 200; at += 1) tall = addRow(tall);
  assert.equal(tall.rows.length, BODY_LIMITS.tableRows);
});

test('colar varias celulas a partir de uma celula cresce a planilha e respeita os limites', () => {
  assert.deepEqual(pasteInto(table, 0, 1, [['x', 'y'], ['z']]), { headers: ['A', 'B', ''], rows: [['1', 'x', 'y'], ['3', 'z', '']] });
  assert.deepEqual(pasteInto(table, -1, 0, [['H1', 'H2']]), { headers: ['H1', 'H2'], rows: [['1', '2'], ['3', '4']] });
  assert.deepEqual(pasteInto(table, 1, 0, [['a', 'b'], ['c', 'd']]).rows, [['1', '2'], ['a', 'b'], ['c', 'd']]);
  const full = pasteInto(table, 0, 0, Array.from({ length: 300 }, () => Array.from({ length: 20 }, () => 'v')));
  assert.equal(full.rows.length, BODY_LIMITS.tableRows);
  assert.equal(full.headers.length, BODY_LIMITS.tableCols);
  assert.ok(full.rows.every((row) => row.length === BODY_LIMITS.tableCols));
});
