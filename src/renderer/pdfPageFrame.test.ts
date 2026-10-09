import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('paginas da pre-visualizacao do PDF: iframe sem scripts mas no mesmo processo (sandbox vazio deixava a pagina em branco)', () => {
  const source = readFileSync('src/renderer/ProposalPdfView.tsx', 'utf8');
  const frame = source.slice(source.indexOf('<iframe'), source.indexOf('/>', source.indexOf('<iframe')));
  assert.match(frame, /sandbox="allow-same-origin"/);
  assert.doesNotMatch(frame, /allow-scripts/, 'nunca liberar scripts junto com allow-same-origin');
  assert.doesNotMatch(frame, /sandbox=""/);
});
