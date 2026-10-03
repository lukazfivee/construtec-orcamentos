import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyse, buildTable, checkCost, classify, errorsCsv, normUnit, ocrTextToRaw, parseDelimited, parseNumber, suggestColumns, toItem,
  type RawRow,
} from './catalogImportFlow';

const csv = 'Código;Descrição;Un;Custo;Categoria\r\nEX-1;Câmera IP bullet;un;"1.200,50";CFTV\r\nEX-2;Cabo UTP;mt;4,8;\r\nEX-3;Sem preço;un;;\r\n';
const rawOf = (text: string): RawRow[] => parseDelimited(text).map((cells, i) => ({ ln: i + 1, cells })).filter(r => r.cells.some(c => c.trim()));

test('importar lista no computador: leitura, colunas e conferencia', async context => {
  await context.test('le CSV com aspas e detecta o delimitador', () => {
    const rows = parseDelimited(csv);
    assert.deepEqual(rows[0], ['Código', 'Descrição', 'Un', 'Custo', 'Categoria']);
    assert.equal(rows[1][3], '1.200,50');
    assert.equal(parseDelimited('a\tb\n1\t2')[1][1], '2');
  });

  await context.test('sugere as colunas e marca as duvidosas', () => {
    const table = buildTable(rawOf(csv), true);
    const { map, conf } = suggestColumns(table.header);
    assert.deepEqual(map, { cod: 0, un: 2, custo: 3, desc: 1, cat: 4 });
    assert.equal(conf.custo, false);
    const twin = suggestColumns(['Código', 'Preço', 'Valor', 'Unidade', 'Descrição']);
    assert.equal(twin.map.custo, 1);
    assert.equal(twin.conf.custo, true);
    const semCab = buildTable(rawOf('A1;B1\n9;8'), false);
    assert.deepEqual(semCab.header, ['Coluna A', 'Coluna B']);
    assert.equal(semCab.rows.length, 2);
  });

  await context.test('linhas boas e com erro; correcao e deixar de fora', () => {
    const table = buildTable(rawOf(csv), true);
    const map = suggestColumns(table.header).map;
    const first = analyse({ table, map, units: ['un', 'm'], fix: {}, out: {} });
    assert.equal(first.good.length, 2);
    assert.equal(first.good[0].cost, 1200.5);
    assert.equal(first.good[1].unit, 'm');
    assert.equal(first.errs.length, 1);
    assert.equal(first.errs[0].prob, 'Custo vazio');
    assert.equal(first.errs[0].fx, 'custo');
    const id = first.errs[0].id;
    const fixed = analyse({ table, map, units: ['un', 'm'], fix: { [id]: { custo: '99,90' } }, out: {} });
    assert.equal(fixed.errs.length, 0);
    assert.equal(fixed.good.find(g => g.id === id)?.cost, 99.9);
    assert.ok(fixed.good.find(g => g.id === id)?.fixed);
    const left = analyse({ table, map, units: ['un', 'm'], fix: {}, out: { [id]: true } });
    assert.equal(left.errs[0].left, true);
    assert.match(errorsCsv(left.errs), /Linha;Código;Descrição;Problema\r\n"4";"EX-3";"Sem preço";"Custo vazio"/);
  });

  await context.test('unidade que nao existe e codigo repetido', () => {
    const lines = ['Código;Descrição;Unidade;Custo', 'A-1;Item um;un;10', 'A-1;Item dois;un;11', 'B;Item tres;un;5', 'C-1;Item quatro;kg;7'];
    const table = buildTable(rawOf(lines.join('\n')), true);
    const map = suggestColumns(table.header).map;
    const result = analyse({ table, map, units: ['un'], fix: {}, out: {} });
    assert.equal(result.good.length, 1);
    assert.deepEqual(result.errs.map(e => e.fx), ['', 'cod', 'un']);
    assert.match(result.errs[0].prob, /já está na linha 2/);
  });

  await context.test('custo: formatos brasileiros, letra no lugar de numero e negativo', () => {
    assert.equal(parseNumber('R$ 1.234,56'), 1234.56);
    assert.equal(parseNumber('1.234'), 1234);
    assert.equal(parseNumber('12,5'), 12.5);
    assert.deepEqual(checkCost('12O,50'), { prob: 'Custo "12O,50" tem letra no lugar de número', fx: 'custo', sug: '120,50' });
    assert.deepEqual(checkCost('-3'), { prob: 'Custo negativo (−3,00)', fx: 'custo', sug: '3,00' });
    assert.deepEqual(checkCost('0'), { prob: 'Custo zerado', fx: 'custo' });
    assert.equal(normUnit('Und.'), 'un');
  });

  await context.test('classifica novo, atualizado e igual e preserva dados do que ja existe', () => {
    const table = buildTable(rawOf(csv), true);
    const { good } = analyse({ table, map: suggestColumns(table.header).map, units: [], fix: {}, out: {} });
    const previous = { description: 'Antiga', category: 'Antiga cat', unit: 'un', currentCost: 1000, manufacturer: 'Fab', model: 'M1', source: 'EXSAT' };
    const previews = new Map([['ex-1', { ...toItem(good[0], null, ''), status: 'updated' as const, previous }]]);
    const groups = classify(good, previews);
    assert.equal(groups.atu.length, 1);
    assert.equal(groups.novos.length, 1);
    const item = toItem(good[0], previous, '');
    assert.equal(item.manufacturer, 'Fab');
    assert.equal(item.source, 'EXSAT');
    assert.equal(item.category, 'CFTV');
    assert.equal(toItem(good[1], null, 'Seg').source, 'Seg');
    assert.equal(toItem(good[1], null, '').category, 'Materiais');
  });

  await context.test('texto de OCR vira tabela', () => {
    const raw = ocrTextToRaw('Código\tDescrição\tUnidade\tValor total\nA1\tCabo\tm\t5,00\n');
    assert.equal(raw.length, 2);
    assert.equal(raw[1].cells[3], '5,00');
  });
});
