// Tempo de cada pedido para achar o que deixa o sistema lento: o cabecalho Server-Timing (visivel na aba Rede do
// navegador) leva o total no servidor, quantas idas ao banco e quanto tempo elas somaram. Pedido lento tambem
// entra no log do servidor (so metodo, rota sem parametros e numeros; nunca dados da requisicao).
import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import type { DatabaseQueries, LocalDatabase } from './services/database';

type Stats = { queries: number; dbMs: number };
const storage = new AsyncLocalStorage<Stats>();
const SLOW_MS = 1000;

const timedQueries = (target: DatabaseQueries): DatabaseQueries => ({
  exec: (sql: string) => target.exec(sql),
  async query<R>(sql: string, params?: unknown[]) {
    const stats = storage.getStore();
    if (!stats) return target.query<R>(sql, params);
    const started = performance.now();
    try { return await target.query<R>(sql, params); }
    finally { stats.queries += 1; stats.dbMs += performance.now() - started; }
  },
});

// Membros explicitos: o banco local (PGlite) e uma instancia de classe, e copiar com spread perderia os metodos.
export const withQueryTiming = (database: LocalDatabase): LocalDatabase => ({
  ...timedQueries(database),
  close: () => database.close(),
  dumpDataDir: (compression) => database.dumpDataDir(compression),
  transaction: <T>(callback: (transaction: DatabaseQueries) => Promise<T>) =>
    database.transaction((transaction) => callback(timedQueries(transaction))),
});

const routeOf = (request: Request) => request.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id').slice(0, 80);

export const requestTiming = (request: Request, response: Response, next: NextFunction) => {
  const stats: Stats = { queries: 0, dbMs: 0 };
  const started = performance.now();
  const writeHead = response.writeHead.bind(response) as (...args: unknown[]) => Response;
  response.writeHead = ((...args: unknown[]) => {
    if (!response.headersSent) {
      const total = performance.now() - started;
      response.setHeader('Server-Timing', `app;dur=${total.toFixed(0)}, db;dur=${stats.dbMs.toFixed(0)};desc="${stats.queries} consultas"`);
      if (total >= SLOW_MS) console.warn('[lento]', request.method, routeOf(request), `${total.toFixed(0)}ms`, `db=${stats.dbMs.toFixed(0)}ms/${stats.queries}`);
    }
    return writeHead(...args);
  }) as Response['writeHead'];
  storage.run(stats, next);
};
