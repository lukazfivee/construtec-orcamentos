import { readFileSync } from 'node:fs';
import path from 'node:path';

// O index.css virou uma lista de @imports (src/index-parts/index-NN.css, na ordem da cascata). Os testes que
// inspecionam o CSS leem o texto junto, na mesma ordem em que o navegador o monta.
export function readIndexCss(root: string): string {
  const entry = readFileSync(path.join(root, 'src/index.css'), 'utf8');
  const parts = [...entry.matchAll(/@import\s+'\.\/([^']+)'/g)].map((m) => readFileSync(path.join(root, 'src', m[1]), 'utf8'));
  return parts.join('\n');
}
