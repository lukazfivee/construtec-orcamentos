import { randomUUID } from 'node:crypto';
import { createApp } from './createApp';
import { createDatabase } from './services/database';
import { startOutboxRetryWorker } from './services/outboxRetryWorker';

export const createSuiteApi = async (userDataPath: string) => {
  const database = await createDatabase(userDataPath);
  const worker = startOutboxRetryWorker(database);
  const app = createApp(database, randomUUID(), `${randomUUID()}${randomUUID()}`);
  return {
    app,
    close: async () => {
      clearInterval(worker);
      await database.close();
    },
  };
};
