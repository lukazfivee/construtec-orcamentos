import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.vite', 'build', 'standalone-server.cjs');
await build({ absWorkingDir: root, entryPoints: ['src/server/standalone.ts'], outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external' });
const child = spawn(process.execPath, [output], { cwd: root, stdio: 'inherit', env: { ...process.env, CONSTRUTEC_API_HOST: '0.0.0.0', CONSTRUTEC_API_PORT: process.env.PORT || '8080' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
