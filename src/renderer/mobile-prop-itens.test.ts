import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

// Itens, importacao, clonar, acompanhamento e JSON da proposta no celular (public/m/prop-*.js).
const dir = path.join(process.cwd(), 'public', 'm');
const read = (name: string) => readFileSync(path.join(dir, name), 'utf8');

type Row = { code: string; description: string; unit: string; quantity: number; unitCost?: number };
type ImportApi = { parseSheetText: (text: string) => Row[]; importBody: (rows: Row[], withCost: boolean) => { items: Array<Record<string, unknown>> } };

const loadImport = (): ImportApi => {
  const OC = { esc: String, icon: () => '' } as unknown as ImportApi;
  vm.runInNewContext(read('prop-import.js'), { window: { OC } });
  return OC;
};

test('/m/: colar do Excel le tab, ponto e virgula, cabecalho e numero brasileiro', () => {
  const { parseSheetText } = loadImport();
  const rows = parseSheetText('Código\tDescrição\tQtd\nCAB-01\tCabo UTP cat6\t1.234,5\tm\tR$ 2,50\nCâmera IP externa\nRack 12U;3\nx');
  assert.equal(rows.length, 3);
  assert.deepEqual({ ...rows[0] }, { code: 'CAB-01', description: 'Cabo UTP cat6', unit: 'm', quantity: 1234.5, unitCost: 2.5 });
  assert.deepEqual({ ...rows[1] }, { code: '', description: 'Câmera IP externa', unit: 'un', quantity: 1, unitCost: undefined });
  assert.equal(rows[2].description, 'Rack 12U;3'.split(';')[0]);
  assert.equal(rows[2].quantity, 3);
  const blank = parseSheetText('\tConector RJ45\t50\tun')[0];
  assert.deepEqual([blank.code, blank.description, blank.quantity], ['', 'Conector RJ45', 50]);
});

test('/m/: importacao sem p10 nao manda custo; sem codigo nao manda codigo', () => {
  const { parseSheetText, importBody } = loadImport();
  const rows = parseSheetText('CAB-01;Cabo;10;m;3,00\nSem codigo');
  const withCost = importBody(rows, true).items;
  const noCost = importBody(rows, false).items;
  assert.equal(withCost[0].unitCost, 3);
  assert.ok(!('unitCost' in noCost[0]) && !('unitCost' in noCost[1]));
  assert.ok(!('code' in noCost[1]));
});

test('/m/: rotas e permissoes dos recursos da proposta', () => {
  const itens = read('prop-itens.js'), imp = read('prop-import.js'), trk = read('prop-tracking.js'), labor = read('screen-labor.js');
  assert.match(itens, /items\/\$\{it\.id\}\/duplicate`/);
  assert.match(itens, /items\/\$\{it\.id\}\/move`, \{ method: 'POST', body: \{ direction \} \}/);
  assert.match(itens, /items\/\$\{it\.id\}\/to-catalog`/);
  assert.match(itens, /it\.inCatalog === false && OC\.canEditCatalog/);
  assert.match(imp, /items\/import-batch`/);
  assert.match(imp, /items\/copy-from-proposal`, \{ method: 'POST', body: \{ sourceProposalId: src\.id, itemIds:/);
  assert.match(imp, /\/kits\/\$\{kit\.id\}\/apply-to-proposal`/);
  assert.match(trk, /\/clone`, \{ method: 'POST', body \}/);
  assert.match(trk, /center-tracking`/);
  assert.match(trk, /!OC\.can\('p10'\)\) return;/);
  assert.match(trk, /OC\.canExportIntegration = \(p\) => p\.status === 'approved' && OC\.canEdit\(\) && OC\.can\('p11'\) && OC\.can\('p10'\)/);
  assert.match(labor, /\/labor-settings`, \{ method: 'PATCH', body: \{ standardMonthlyHours: v \} \}/);
  // Ganchos nos arquivos compartilhados.
  assert.match(read('prop-edit.js'), /OC\.bindItemExtra\(s, p, it, ctx\)/);
  assert.match(read('prop-edit.js'), /OC\.bindImportOpts\(s, p, ctx\)/);
  assert.match(read('screen-prop.js'), /OC\.itemsTools\(p, ctx, body\)/);
  assert.match(read('screen-prop.js'), /OC\.trackingCard\(p, body\)/);
  assert.match(read('screen-descarte.js'), /OC\.cloneSheet\(p\)/);
  assert.match(read('screen-descarte.js'), /OC\.exportIntegration\(p\)/);
  for (const file of ['prop-itens.js', 'prop-import.js', 'prop-tracking.js', 'screen-labor.js', 'prop-itens.css']) {
    assert.ok(read(file).split('\n').length <= 350, `${file} passou de 350 linhas`);
  }
});
