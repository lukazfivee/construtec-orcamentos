import path from 'node:path';
import { homedir } from 'node:os';
import { startApiServer } from './startApiServer';

const appData = process.env.APPDATA || (process.platform === 'darwin'
  ? path.join(homedir(), 'Library', 'Application Support')
  : path.join(homedir(), '.config'));
const userDataPath = path.join(appData, 'Construtec Orçamentos');

const port = Number(process.env.CONSTRUTEC_API_PORT || 5176);

startApiServer(userDataPath, undefined, port).then((runtime) => {
  console.log(`[API Construtec] Servidor ativo em ${runtime.url}`);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try {
      await runtime.close();
      process.exit(0);
    } catch {
      console.error('[API Construtec] Falha ao encerrar servidor.');
      process.exit(1);
    }
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}).catch((err) => {
  console.error('[API Construtec] Falha ao iniciar:', err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
