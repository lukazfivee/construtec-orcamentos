import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createApp, getCloudSecurity } from './createApp';
import { verifyUserSession } from './services/auth';
import { createDatabase } from './services/database';
import { startOutboxRetryWorker } from './services/outboxRetryWorker';

export type ApiRuntime = {
  url: string;
  token: string;
  backup: () => Promise<Uint8Array>;
  isAdminSession: (sessionToken: string) => Promise<boolean>;
  close: () => Promise<void>;
};

export const startApiServer = async (
  userDataPath: string,
  packagedModulePath?: string,
  preferredPort = Number(process.env.CONSTRUTEC_API_PORT || 5176),
): Promise<ApiRuntime> => {
  const cloud = getCloudSecurity();
  const database = await createDatabase(userDataPath, packagedModulePath);
  const token = process.env.CONSTRUTEC_API_TOKEN || randomUUID();
  const api = createApp(database, token);

  const server = await new Promise<Server>((resolve, reject) => {
    const host = process.env.CONSTRUTEC_API_HOST || '127.0.0.1';
    const bindServer = (port: number) => {
      const instance = api.listen(port, host, () => resolve(instance));
      instance.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && port !== 0 && !cloud) {
          bindServer(0);
        } else {
          reject(err);
        }
      });
    };
    bindServer(preferredPort);
  }).catch(async error => {
    await database.close();
    throw error;
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Não foi possível iniciar a API local.');
  }

  const outboxWorker = startOutboxRetryWorker(database);

  return {
    url: `http://127.0.0.1:${address.port}`,
    token,
    backup: async () => {
      const dump = await database.dumpDataDir('gzip');
      return new Uint8Array(await dump.arrayBuffer());
    },
    isAdminSession: async (sessionToken: string) => {
      const user = await verifyUserSession(database, sessionToken).catch(() => null);
      return user?.role === 'admin';
    },
    close: async () => {
      clearInterval(outboxWorker);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await database.close();
    },
  };
};
