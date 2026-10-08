import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('barra de titulo propria: janela do Windows com botoes por cima, mesma cor do menu, efeito e respeito a "reduzir movimento"', () => {
  const main = read('src/main.ts');
  assert.match(main, /process\.platform === 'win32' \? \{ titleBarStyle: 'hidden' as const, titleBarOverlay:/);
  // Os canais IPC ficam em src/main/orcamentosMain.ts (compartilhado com o app Suite).
  const ipc = read('src/main/orcamentosMain.ts');
  assert.match(ipc, /ipcMain\.handle\('window:titlebar-colors'/);
  assert.match(ipc, /hex\.test\(color\)/, 'so aceita cor #rrggbb vinda da pagina');
  const css = read('src/titlebar.css');
  assert.match(css, /background: var\(--nav\)/, 'mesma cor do menu lateral');
  assert.match(css, /-webkit-app-region: drag/);
  assert.match(css, /@keyframes titlebar-shine/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*animation: none/);
  assert.match(css, /--tb-h: 48px/, 'com zoom .75 a barra continua com a altura real dos botoes (36 px)');
  assert.match(read('src/renderer.tsx'), /window\.construtec\?\.titleBar/);
  assert.match(read('src/preload.ts'), /setTitleBarColors/);
});
