import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { parseCatalogText } from '../renderer/catalogImportHelpers';
import { getProposalValidityStatus } from '../renderer/proposalValidityHelpers';

// O celular (public/m) repete regras do computador em JS puro: validade e filtros da lista de propostas, CSV e o
// leitor da lista colada no catalogo. Estes testes carregam os arquivos do celular e comparam com o computador.
type Row = { number: string; revision: number; clientName: string; workName: string; status: string; itemCount: number; totalSale: number; updatedAt: string; validUntil?: string | null };
type Lista = {
  validity: (v: string | null | undefined, s: string) => { state: string; label: string };
  matchValue: (t: number, o: string) => boolean;
  matchDate: (u: string, o: string) => boolean;
  apply: (list: Row[], f: Record<string, string>) => Row[];
  totals: (rows: Row[]) => { count: number; total: number; average: number; approved: number; negotiation: number };
  csv: (rows: Row[]) => string;
};
type Manual = { parse: (text: string, source: string) => Array<Record<string, unknown>> };
const root = path.join(process.cwd(), 'public', 'm');
const load = (...files: string[]) => {
  const sandbox = { window: { OC: { screens: {} } } as { OC?: Record<string, unknown> } };
  for (const file of files) vm.runInNewContext(readFileSync(path.join(root, file), 'utf8'), sandbox);
  assert.ok(sandbox.window.OC);
  return sandbox.window.OC;
};
const iso = (offset: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('/m/: validade da lista igual a do computador', () => {
  const lista = load('screen-lista.js').lista as Lista;
  for (const status of ['draft', 'review', 'sent', 'approved', 'rejected'] as const) {
    for (const offset of [-10, -2, -1, 0, 1, 2, 3, 4, 30]) {
      const desk = getProposalValidityStatus(iso(offset), status);
      const mob = lista.validity(iso(offset), status);
      assert.equal(mob.state, desk.state, `${status} ${offset}`);
      assert.equal(mob.label, desk.label, `${status} ${offset}`);
    }
    assert.equal(lista.validity(null, status).state, getProposalValidityStatus(null, status).state);
  }
});

test('/m/: faixas de valor, filtros, ordenacao e rodape', () => {
  const lista = load('screen-lista.js').lista as Lista;
  assert.deepEqual([9999.99, 10000, 50000, 50000.01, 100000, 100000.01].map((v) => ['under10k', '10k-50k', '50k-100k', 'above100k'].filter((o) => lista.matchValue(v, o))),
    [['under10k'], ['10k-50k'], ['10k-50k'], ['50k-100k'], ['50k-100k'], ['above100k']]);
  const now = new Date().toISOString();
  const rows: Row[] = [
    { number: 'PA-0002', revision: 0, clientName: 'Beta', workName: 'Obra B', status: 'sent', itemCount: 3, totalSale: 60000, updatedAt: now, validUntil: iso(2) },
    { number: 'PA-0001', revision: 1, clientName: 'Alfa', workName: 'Obra A', status: 'approved', itemCount: 5, totalSale: 20000, updatedAt: '2020-01-01T10:00:00Z', validUntil: iso(-5) },
    { number: 'PA-0003', revision: 0, clientName: 'Gama', workName: 'Obra C', status: 'draft', itemCount: 0, totalSale: 0, updatedAt: now, validUntil: null },
  ];
  const all = { q: '', status: 'all', date: 'all', value: 'all', validity: 'all', sort: 'value', order: 'desc' };
  assert.deepEqual(lista.apply(rows, all).map((r) => r.number), ['PA-0002', 'PA-0001', 'PA-0003']);
  assert.deepEqual(lista.apply(rows, { ...all, sort: 'client', order: 'asc' }).map((r) => r.number), ['PA-0001', 'PA-0002', 'PA-0003']);
  assert.deepEqual(lista.apply(rows, { ...all, validity: 'expiringSoon' }).map((r) => r.number), ['PA-0002']);
  assert.deepEqual(lista.apply(rows, { ...all, validity: 'none' }).map((r) => r.number), ['PA-0003']);
  assert.deepEqual(lista.apply(rows, { ...all, date: 'year' }).map((r) => r.number).sort(), ['PA-0002', 'PA-0003']);
  assert.deepEqual(lista.apply(rows, { ...all, q: 'obra a' }).map((r) => r.number), ['PA-0001']);
  const t = lista.totals(rows);
  assert.deepEqual([t.count, t.total, t.average, t.approved, t.negotiation], [3, 80000, 80000 / 3, 1, 2]);
});

test('/m/: CSV com as colunas do computador, sem custo', () => {
  const OC = load('screen-lista.js');
  const csv = (OC.lista as Lista).csv([{ number: 'PA-0001', revision: 2, clientName: 'Cliente "X"; SA', workName: 'Obra', status: 'sent', itemCount: 4, totalSale: 1234.5, updatedAt: '2026-10-10T15:30:00Z', totalCost: 999 } as Row]);
  const [head, line] = csv.replace(/^\uFEFF/, '').split('\r\n');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.equal(head, '"Número";"Revisão";"Cliente";"Obra / Projeto";"Status";"Qtd de Itens";"Valor Total de Venda";"Última Atualização"');
  assert.match(line, /^"PA-0001";"REV 02";"Cliente ""X""; SA";"Obra";"Enviada";"4";"R\$\s1\.234,50";"10\/10\/2026, \d{2}:30"$/);
  assert.doesNotMatch(csv, /999/);
});

test('/m/: lista colada no catalogo lida como no computador', () => {
  const manual = load('cat-manual.js').catManual as Manual;
  const samples = [
    'Código\tDescrição\tCategoria\tFabricante\tModelo\tUnidade\tValor total\tFonte\nVIP1230\tCâmera IP bullet\tCFTV\tIntelbras\tVIP 1230\tun\t1.234,56\tMANUAL\nCB-01\tCabo UTP\t\t\t\tm\t2,10\t',
    'Codigo;Descricao;Unidade;Preco;Parcela;Total\nA-1;Conector RJ45;un;1,50;0,50;15,00\nB-2;Patch cord;pç;R$ 12,00;;',
    'X100;Switch 8 portas;Redes;;;un;199,90\nX200,Roteador wifi,Redes,Intelbras,,un,"1.099,00"',
    'DVR1004 Gravador 4 canais 450,00\nRack 12U para parede R$ 380,00',
    '',
  ];
  // JSON: objetos criados no vm tem outro prototipo.
  const strip = (rows: Array<Record<string, unknown>>) => JSON.parse(JSON.stringify(rows.map((row) => { const copy = { ...row }; delete copy.key; return copy; })));
  for (const text of samples) assert.deepEqual(strip(manual.parse(text, 'MANUAL')), strip(parseCatalogText(text, 'MANUAL') as unknown as Array<Record<string, unknown>>), text);
});

test('/m/: telas novas ligadas no index e nas abas, sem varredura so no computador', () => {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const file of ['screen-lista.js', 'screen-painel-mais.js', 'kit-edit.js', 'screen-cfg.js', 'screen-usuarios.js', 'screen-ajuda.js', 'screen-reportar.js', 'screen-cat.js', 'cat-manual.js', 'screen-catconf.js', 'exsat-conta.js', 'listas.css']) {
    assert.ok(html.includes(file), `index.html sem ${file}`);
    assert.ok(readFileSync(path.join(root, file), 'utf8').split('\n').length <= 350, `${file} passou de 350 linhas`);
  }
  const app = readFileSync(path.join(root, 'app.js'), 'utf8');
  for (const screen of ['catConf', 'cfgEmp', 'users', 'ajuda']) assert.match(app, new RegExp(`'${screen}'`));
  const exsat = readFileSync(path.join(root, 'exsat-conta.js'), 'utf8');
  for (const route of ["'/exsat/status'", "'/exsat/credential', { method: 'PUT'", "'/exsat/credential', { method: 'DELETE' }", "'/exsat/sync', { method: 'POST'", '/resume`', '/cancel`', '/items?offset=']) assert.ok(exsat.includes(route), route);
  assert.doesNotMatch(readFileSync(path.join(root, 'screen-exsat.js'), 'utf8'), /Pelo computador|roda so no aplicativo/);
  // O CSV e a lista nao mostram custo; a conferencia so mostra custo pelo OC.costText (p10).
  assert.doesNotMatch(readFileSync(path.join(root, 'screen-lista.js'), 'utf8'), /totalCost/);
  assert.match(readFileSync(path.join(root, 'screen-catconf.js'), 'utf8'), /OC\.costText\(OC\.money\(r\.currentCost\)\)/);
});
