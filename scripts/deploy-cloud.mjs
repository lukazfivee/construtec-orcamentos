/**
 * Publica o Construtec Orcamentos na nuvem (`construtec-orcamentos-cloud`).
 *
 * Uso:
 *   node scripts/deploy-cloud.mjs               builda e publica
 *   node scripts/deploy-cloud.mjs --dry-run     valida sem publicar
 *   node scripts/deploy-cloud.mjs --skip-build  publica sem rodar o Vite
 *
 * O Worker serve o `dist/` gerado pelo Vite, e o `wrangler deploy` NAO roda o
 * build. Publicar com `dist/` defasado faz o HTML novo apontar para um hash de
 * JS inexistente e quebra a interface, por isso o build e a etapa padrao.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const configDir = path.join(appRoot, 'cloudflare', 'api-container');
const distDir = path.join(appRoot, 'dist');

const dryRun = process.argv.includes('--dry-run');
const skipBuild = process.argv.includes('--skip-build');

const DOCKER_HINTS = [
  'C:\\Program Files\\Docker\\Docker\\resources\\bin',
  'C:\\Program Files\\Docker\\Docker\\resources',
  '/usr/local/bin',
  '/usr/bin',
];

const resolveDockerDir = () => {
  const binary = process.platform === 'win32' ? 'docker.exe' : 'docker';
  for (const dir of DOCKER_HINTS) {
    if (fs.existsSync(path.join(dir, binary))) return dir;
  }
  return null;
};

const dockerDir = resolveDockerDir();
if (!dockerDir) {
  console.error('Docker nao encontrado. Instale o Docker Desktop e inicie o servico.');
  process.exit(1);
}
const dockerBin = path.join(
  dockerDir,
  process.platform === 'win32' ? 'docker.exe' : 'docker',
);

const probe = spawnSync(dockerBin, ['version', '--format', '{{.Server.Version}}'], {
  encoding: 'utf8',
});
if (probe.status !== 0) {
  console.error('O daemon do Docker nao respondeu. Abra o Docker Desktop e tente novamente.');
  process.exit(1);
}
console.log(`Docker ${probe.stdout.trim()} detectado em ${dockerDir}`);

process.env.PATH = `${dockerDir}${path.delimiter}${process.env.PATH}`;

const run = (label, command, args, options = {}) => {
  console.log(`\n${label}\n`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

const assertAssetsMatch = () => {
  const entry = path.join(distDir, 'index.html');
  if (!fs.existsSync(entry)) {
    console.error(`Build ausente em ${distDir}. Rode o build antes de publicar.`);
    process.exit(1);
  }
  const html = fs.readFileSync(entry, 'utf8');
  const referenced = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+)"/g)].map(
    (match) => match[1],
  );
  const missing = referenced.filter(
    (asset) => !fs.existsSync(path.join(distDir, 'assets', asset)),
  );
  if (missing.length > 0) {
    console.error('O dist/ esta inconsistente. Assets referenciados e ausentes:');
    for (const asset of missing) console.error(`  - ${asset}`);
    console.error('Rode o build novamente antes de publicar.');
    process.exit(1);
  }
  console.log(`Build conferido: ${referenced.length} assets referenciados no dist/.`);
};

if (skipBuild) {
  console.log('Build do Vite ignorado por --skip-build.');
  assertAssetsMatch();
} else {
  run(
    'Construindo o frontend com Vite...',
    process.execPath,
    [path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
    { cwd: appRoot },
  );
  assertAssetsMatch();
}

const wranglerLocal = path.join(
  configDir,
  'node_modules',
  'wrangler',
  'bin',
  'wrangler.js',
);
const wranglerArgs = fs.existsSync(wranglerLocal)
  ? [wranglerLocal]
  : ['--yes', 'wrangler@4.131.2'];

run(
  dryRun ? 'Validando o Worker...' : 'Publicando construtec-orcamentos-cloud...',
  process.execPath,
  [
    ...wranglerArgs,
    'deploy',
    `--config=${path.join(configDir, 'wrangler.jsonc')}`,
    ...(dryRun ? ['--dry-run'] : []),
  ],
  { cwd: configDir },
);

console.log(
  dryRun
    ? '\nValidacao concluida. Nada foi publicado.'
    : '\nPublicado. O Container troca a imagem somente apos hibernar: aguarde cerca de um minuto antes de concluir que a interface nao mudou.',
);
