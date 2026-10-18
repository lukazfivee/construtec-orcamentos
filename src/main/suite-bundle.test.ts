import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { chamadosEntradaUrl } from '../renderer/suiteMenu';

// O app Suíte do Windows (repositório do Centro) carrega o processo principal e o preload do Orçamentos já
// empacotados. Estas travas garantem que o app avulso e a Suíte usam o mesmo código e o mesmo contrato.
const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

test('o app avulso e a Suíte compartilham startOrcamentosMain', () => {
  const avulso = read('src/main.ts');
  assert.match(avulso, /startOrcamentosMain\(/);
  assert.doesNotMatch(avulso, /ipcMain\.handle/, 'os canais IPC vivem em src/main/orcamentosMain.ts');
  const modulo = read('src/main/orcamentosMain.ts');
  for (const canal of ['app:runtime', 'documents:export', 'documents:save-pdf', 'backup:restore', 'catalog:select-import', 'exsat:login', 'webmail:open']) {
    assert.ok(modulo.includes(`ipcMain.handle('${canal}'`), `canal ${canal}`);
  }
  assert.ok(modulo.includes('...options.runtimeExtras'), 'a Suíte marca suite:true em app:runtime');
  assert.doesNotMatch(modulo, /registerUpdaterIpc|electron-squirrel/, 'a atualização da Suíte é do app inteiro, não do Squirrel');
});

test('o preload expõe a troca de tela e o menu Suíte a usa só dentro da Suíte', () => {
  assert.match(read('src/preload.ts'), /suiteSwitch: \(target: 'centro' \| 'orcamentos' \| 'chamados', hash\?: string\) => ipcRenderer\.invoke\('suite:switch'/);
  const menu = read('src/renderer/SuiteSwitcherPopover.tsx');
  assert.match(menu, /runtime\.suite === true/);
  assert.match(menu, /suiteSwitch\('centro'\)/);
  assert.match(menu, /handleOpenUrl\(centroUrl\)/, 'fora da Suíte o Centro continua abrindo no navegador');
  assert.match(menu, /suiteSwitch\('chamados'\)/);
  assert.match(menu, /handleOpenUrl\(chamadosEntradaUrl\(centroUrl\)\)/, 'fora da Suíte o Chamados abre pela entrada central');
});

test('o Chamados e O.S. substitui o ChamadoPro em todos os pontos de troca, com login único pelo Centro', () => {
  const entrada = 'https://centro-custos-api.construtec-reports.workers.dev/chamados/entrar';
  assert.equal(chamadosEntradaUrl('https://centro-custos-api.construtec-reports.workers.dev'), entrada);
  assert.equal(chamadosEntradaUrl('https://centro-custos-api.construtec-reports.workers.dev//'), entrada);
  assert.match(read('src/renderer/MobileSuiteSheet.tsx'), /go\(chamadosEntradaUrl\(centroUrl\), true\)/);
  assert.ok(read('public/m/suite.js').includes(entrada));
  for (const file of ['src/renderer/suiteMenu.ts', 'src/renderer/SuiteSwitcherPopover.tsx', 'src/renderer/MobileSuiteSheet.tsx', 'public/m/suite.js', 'public/m/ia-config.js']) {
    assert.doesNotMatch(read(file), /chamadopro/i, `${file} sem referência ao ChamadoPro antigo`);
  }
});

test('o script de empacotamento gera renderer, processo principal e preload', () => {
  const script = read('scripts/build-suite-bundle.mjs');
  for (const saida of ["'orcamentos'", "'orcamentos-main'", "'index.cjs'", "'preload.cjs'"]) assert.ok(script.includes(saida), saida);
  assert.match(script, /--external:electron/);
  assert.ok(script.includes('process.env.CONSTRUTEC_SUITE'), 'o preload da Suíte esconde a barra de título própria');
  assert.ok(read('src/preload.ts').includes("process.env.CONSTRUTEC_SUITE !== '1'"));
  assert.match(script, /--external:@electric-sql\/pglite/);
});
