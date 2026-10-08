// Gera os módulos do Orçamentos que o app Suíte unificado (repositório do Centro de Custos) carrega:
//   <saida>/orcamentos/               renderer (Vite), aberto por loadFile
//   <saida>/orcamentos-main/index.cjs processo principal (API local, banco, IPC)
//   <saida>/orcamentos-main/preload.cjs ponte window.construtec
// Uso: node scripts/build-suite-bundle.mjs --out <pasta modules do Centro>
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFlag = process.argv.indexOf('--out');
if (outFlag === -1 || !process.argv[outFlag + 1]) {
  console.error('Informe a pasta de saída: --out <pasta modules do Centro>');
  process.exit(1);
}
const out = path.resolve(process.argv[outFlag + 1]);
const rendererOut = path.join(out, 'orcamentos');
const mainOut = path.join(out, 'orcamentos-main');

const run = (label, script, args) => {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`Falhou: ${label}`);
    process.exit(result.status || 1);
  }
};

rmSync(rendererOut, { recursive: true, force: true });
rmSync(mainOut, { recursive: true, force: true });
mkdirSync(mainOut, { recursive: true });

run('renderer', path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), [
  'build', '--config', 'vite.renderer.config.mjs', '--outDir', rendererOut, '--emptyOutDir',
]);

const esbuild = path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
const common = ['--bundle', '--platform=node', '--format=cjs', '--target=node22', '--external:electron', '--external:@electric-sql/pglite', '--external:@electric-sql/pglite/*'];
run('processo principal', esbuild, [path.join('src', 'main', 'orcamentosMain.ts'), ...common, `--outfile=${path.join(mainOut, 'index.cjs')}`]);
run('preload', esbuild, [path.join('src', 'preload.ts'), ...common, '--define:process.env.CONSTRUTEC_SUITE="1"', `--outfile=${path.join(mainOut, 'preload.cjs')}`]);
console.log(`Módulos do Orçamentos gerados em ${out}`);
