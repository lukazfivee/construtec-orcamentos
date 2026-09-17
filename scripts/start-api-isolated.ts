import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startApiServer } from '../src/server/startApiServer';

const userDataPath = mkdtempSync(path.join(tmpdir(), 'construtec-live-isolated-'));
const port = Number(process.env.CONSTRUTEC_API_PORT || 5176);

startApiServer(userDataPath, undefined, port).then((runtime) => {
  console.log(`[API Construtec ISOLATED] Servidor ativo em ${runtime.url}`);
  console.log(`[API Construtec ISOLATED] userDataPath: ${userDataPath}`);
}).catch((err) => {
  console.error('[API Construtec ISOLATED] Falha ao iniciar:', err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
