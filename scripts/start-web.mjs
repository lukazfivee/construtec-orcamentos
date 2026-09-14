import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverOut = path.join(root, '.vite', 'build', 'standalone-server.cjs');

console.log('Compilando servidor API local...');
await build({
  absWorkingDir: root,
  entryPoints: ['src/server/standalone.ts'],
  outfile: serverOut,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
});

console.log('Iniciando API local na porta 5176...');
const apiProc = spawn(process.execPath, [serverOut], {
  cwd: root,
  stdio: 'inherit',
});

console.log('Iniciando Vite na porta 5173...');
const localViteJs = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const parentViteJs = path.join(root, '..', 'node_modules', 'vite', 'bin', 'vite.js');
const viteJs = fs.existsSync(localViteJs) ? localViteJs : parentViteJs;

const viteProc = spawn(process.execPath, [viteJs, '--config', 'vite.renderer.config.mjs', '--host', '127.0.0.1', '--port', '5173'], {
  cwd: root,
  stdio: 'inherit',
});

const cleanup = () => {
  try { apiProc.kill(); } catch {}
  try { viteProc.kill(); } catch {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
