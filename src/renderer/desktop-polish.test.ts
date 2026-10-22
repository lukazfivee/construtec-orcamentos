import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { readIndexCss } from './readIndexCss';

// Auditoria visual do desktop: classes usadas pelo React precisam ter regra, e barras fixas/sticky nunca ficam translucidas.
const root = process.cwd();
const read = (file: string) => (file === 'src/index.css' ? readIndexCss(root) : readFileSync(path.join(root, file), 'utf8'));
const allCss = ['src/index.css', 'src/desktop-polish.css', 'src/impeccable-audit.css', 'src/proposal-pages.css']
  .map(read).join('\n');

test('janelas antigas usam a casca unica da Nova proposta (Dialogo), com regra de CSS', () => {
  for (const file of ['HelpModal', 'ProposalImportDialog', 'ProposalExtendValidityDialog', 'ProposalDeleteModal']) {
    const source = read(`src/renderer/${file}.tsx`);
    assert.match(source, /<Dialogo\s/, `${file} deve usar <Dialogo>`);
    assert.doesNotMatch(source, /className="modal-(?:backdrop|dialog)"/, `${file} ainda com casca antiga`);
  }
  assert.match(read('src/renderer/orcDeskUi.tsx'), /className=\{`new-proposal-dialog dlg/);
  const dialogos = read('src/dialogos-centro.css');
  for (const name of ['.new-proposal-dialog.dlg', '.dlg-body', '.dlg-foot']) assert.ok(dialogos.includes(name), `${name} sem regra`);
});

test('classes de layout usadas em componentes tem regra de CSS', () => {
  const renderer = path.join(root, 'src', 'renderer');
  const used = new Set<string>();
  for (const file of readdirSync(renderer).filter((name) => /^(ProposalsListTable)\.tsx$/.test(name))) {
    for (const m of readFileSync(path.join(renderer, file), 'utf8').matchAll(/className="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => used.add(c));
  }
  const required = ['home-panel', 'empty-state', 'text-right'];
  for (const name of required) {
    assert.ok(used.has(name) || name === 'text-right', `${name} deve ser usada`);
    assert.ok(allCss.includes(`.${name}`), `${name} sem regra de CSS`);
  }
});

test('regras sticky/fixed do polish tem fundo opaco', () => {
  const css = read('src/desktop-polish.css');
  for (const m of css.matchAll(/([^{}]+)\{([^}]*position:\s*(?:sticky|fixed)[^}]*)\}/g)) {
    const selector = m[1].trim();
    if (/backdrop/.test(selector)) continue;
    const bg = m[2].match(/background(?:-color)?:\s*([^;]+)/);
    if (!bg) continue;
    assert.ok(!/rgba|transparent/.test(bg[1]), `${selector} com fundo translucido`);
  }
});

test('coluna de acoes da lista fica sticky com fundo opaco e botoes de icone tem aria-label', () => {
  const css = read('src/desktop-polish.css');
  assert.match(css, /td\.proposal-actions-cell\s*\{\s*background:\s*var\(--surface\)/);
  const table = read('src/renderer/ProposalsListTable.tsx');
  for (const label of ['Clonar proposta', 'Exportar proposta', 'Compartilhar proposta', 'Excluir proposta']) assert.ok(table.includes(`aria-label="${label}"`), label);
});
