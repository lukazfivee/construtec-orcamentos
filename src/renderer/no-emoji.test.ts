import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

// Interface sobria: nenhum emoji ou pictograma em texto de tela, documento ou mensagem gerada (WhatsApp, e-mail).
const root = process.cwd();
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{2300}-\u{23FF}]/gu;
const DIRS = ['src/renderer', 'src/documents', 'src/server', 'src/shared', 'public/m', 'public/c'];

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'fonts' && entry.name !== 'node_modules') walk(full, out); }
    else if (/\.(tsx?|js|mjs|css|html)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

test('nenhum emoji em src/renderer, src/documents, src/server, src/shared, public/m e public/c', () => {
  const hits: string[] = [];
  for (const dir of DIRS) {
    for (const file of walk(path.join(root, dir), [])) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const found = line.match(EMOJI);
        if (found) hits.push(`${path.relative(root, file)}:${i + 1} ${[...new Set(found)].join('')}`);
      });
    }
  }
  assert.deepEqual(hits, [], `emojis encontrados:\n${hits.join('\n')}`);
});

test('mensagens de WhatsApp do diálogo Compartilhar não carregam pictogramas', () => {
  const source = readFileSync(path.join(root, 'src/renderer/ProposalShareDialog.tsx'), 'utf8');
  assert.equal(EMOJI.test(source), false);
  assert.match(source, /\*Proposta:\*/);
});
