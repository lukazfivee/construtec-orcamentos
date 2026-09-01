import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createApp } from './createApp';
import { verifyUserSession } from './services/auth';
import { createDatabase } from './services/database';

export type ApiRuntime = {
  url: string;
  token: string;
  backup: () => Promise<Uint8Array>;
  isAdminSession: (sessionToken: string) => Promise<boolean>;
  close: () => Promise<void>;
};

export const startApiServer = async (userDataPath: string, packagedModulePath?: string): Promise<ApiRuntime> => {
  const database = await createDatabase(userDataPath, packagedModulePath);
  const token = randomUUID();
  const sessionSecret = `${randomUUID()}${randomUUID()}`;
  const api = createApp(database, token, sessionSecret);

  const server = await new Promise<Server>((resolve, reject) => {
    const instance = api.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Não foi possível iniciar a API local.');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    token,
    backup: async () => {
      const dump = await database.dumpDataDir('gzip');
      return new Uint8Array(await dump.arrayBuffer());
    },
    isAdminSession: async (sessionToken: string) => {
      const user = await verifyUserSession(database, sessionSecret, sessionToken);
      return user?.role === 'admin';
    },
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await database.close();
    },
  };
};
