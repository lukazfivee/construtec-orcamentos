import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, '.vite/homologate-suite.cjs');
await build({ entryPoints: [path.join(root, 'scripts/homologate-suite.ts')], outfile,
  bundle: true, platform: 'node', format: 'cjs', packages: 'external' });
const child = spawn(process.execPath, [outfile], { cwd: root, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
