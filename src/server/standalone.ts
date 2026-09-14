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
}).catch((err) => {
  console.error('[API Construtec] Falha ao iniciar:', err);
  process.exit(1);
});
