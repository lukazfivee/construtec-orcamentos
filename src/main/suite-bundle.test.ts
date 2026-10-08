import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

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
  assert.match(read('src/preload.ts'), /suiteSwitch: \(target: 'centro' \| 'orcamentos', hash\?: string\) => ipcRenderer\.invoke\('suite:switch'/);
  const menu = read('src/renderer/SuiteSwitcherPopover.tsx');
  assert.match(menu, /runtime\.suite === true/);
  assert.match(menu, /suiteSwitch\('centro'\)/);
  assert.match(menu, /handleOpenUrl\(centroUrl\)/, 'fora da Suíte o Centro continua abrindo no navegador');
});

test('o script de empacotamento gera renderer, processo principal e preload', () => {
  const script = read('scripts/build-suite-bundle.mjs');
  for (const saida of ["'orcamentos'", "'orcamentos-main'", "'index.cjs'", "'preload.cjs'"]) assert.ok(script.includes(saida), saida);
  assert.match(script, /--external:electron/);
  assert.ok(script.includes('process.env.CONSTRUTEC_SUITE'), 'o preload da Suíte esconde a barra de título própria');
  assert.ok(read('src/preload.ts').includes("process.env.CONSTRUTEC_SUITE !== '1'"));
  assert.match(script, /--external:@electric-sql\/pglite/);
});
