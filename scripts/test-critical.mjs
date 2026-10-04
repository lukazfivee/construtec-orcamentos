import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(root, '.vite', 'critical-tests');
await mkdir(outdir, { recursive: true });
const entryPoints = [
  'src/server/cloud-runtime.test.ts',
  'src/server/services/postgres-critical.test.ts',
  'src/shared/financial-critical.test.ts',
  'src/server/services/proposal-critical.test.ts',
  'src/server/services/proposal-sealing.test.ts',
  'src/server/services/calculations.test.ts',
  'src/main/exsatValidation.test.ts',
  'src/server/services/integration/integration-key.test.ts',
  'src/server/services/centro-identity.test.ts',
  'src/server/suiteGuard.test.ts',
  'src/server/services/client-links.test.ts',
  'src/server/services/priceDrift.test.ts',
  'src/server/services/catalogOverview.test.ts',
  'src/renderer/catalogImportFlow.test.ts',
  'src/server/services/proposal-discard.test.ts',
  'src/server/services/identity-self-heal.test.ts',
  'src/server/outbox-cron.test.ts',
  'src/renderer/proposal-deep-link.test.ts',
  'src/renderer/mobile-site.test.ts',
  'src/renderer/proposal-desktop-r23.test.ts',
  'src/server/services/integration/center-tracking.test.ts',
];
await build({ absWorkingDir: root, entryPoints, outdir, bundle: true, platform: 'node',
  format: 'cjs', packages: 'external', outbase: 'src', outExtension: { '.js': '.cjs' } });
const outputs = entryPoints.map(file => path.join(outdir, file.replace(/^src\//, '').replace(/\.ts$/, '.cjs')));
const result = spawnSync(process.execPath, ['--test', ...outputs], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
