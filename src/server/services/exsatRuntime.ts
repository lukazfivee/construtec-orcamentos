import type { LocalDatabase } from './database';
import { loadCredential, requireKey, saveCredential, touchLastLogin } from './exsatCredentials';
import { ExsatServerError } from './exsatErrors';
import { ExsatLoginGate, ExsatSession, type ExsatHttp } from './exsatServerSession';

// Estado vivo da Exsat no processo do servidor: a sessao (cookies ficam so aqui, em memoria), a pausa depois de falha de
// login e as varreduras em andamento. O Container tem uma unica instancia, entao um objeto por processo basta; se ele
// dormir ou reiniciar, a sessao some e a varredura fica "pausada" no banco (retomavel).
export type ExsatRuntime = {
  session: ExsatSession;
  gate: ExsatLoginGate;
  runs: Map<string, { cancelled: boolean }>;
  env: NodeJS.ProcessEnv;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Pausa educada entre duas requisicoes seguidas a Exsat. */
  delayMs: () => number;
  lastFailure: { code: string; at: Date } | null;
};

export const createExsatRuntime = (options: Partial<Pick<ExsatRuntime, 'env' | 'now' | 'sleep' | 'delayMs'>> & { http?: ExsatHttp } = {}): ExsatRuntime => {
  const now = options.now ?? Date.now;
  return {
    session: new ExsatSession(options.http),
    gate: new ExsatLoginGate(now),
    runs: new Map(),
    env: options.env ?? process.env,
    now,
    sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    delayMs: options.delayMs ?? (() => 1200 + Math.floor(Math.random() * 800)),
    lastFailure: null,
  };
};

let shared: ExsatRuntime | undefined;
export const sharedExsatRuntime = () => (shared ??= createExsatRuntime());

const attempt = async (runtime: ExsatRuntime, login: () => Promise<void>) => {
  runtime.gate.assertOpen();
  try {
    await login();
    runtime.gate.succeed();
    runtime.lastFailure = null;
  } catch (error) {
    const failure = error instanceof ExsatServerError ? error : new ExsatServerError('EXSAT_UNAVAILABLE');
    runtime.session.clear();
    runtime.gate.fail(failure.code);
    runtime.lastFailure = { code: failure.code, at: new Date(runtime.now()) };
    throw failure;
  }
};

// "Salvar e conectar": uma unica tentativa de login com o que foi digitado; so grava a conta se a Exsat aceitar.
export const connectAndSave = async (database: LocalDatabase, runtime: ExsatRuntime, userId: string, username: string, password: string) => {
  const key = requireKey(runtime.env);
  await attempt(runtime, () => runtime.session.login(username, password));
  await saveCredential(database, userId, username, password, key);
};

// Garante uma sessao logada usando a conta guardada. Sem forcar, nao faz nada se ja ha sessao.
export const ensureSession = async (database: LocalDatabase, runtime: ExsatRuntime, force = false) => {
  if (runtime.session.connected && !force) return;
  const key = requireKey(runtime.env);
  const { username, password } = await loadCredential(database, key);
  await attempt(runtime, () => runtime.session.login(username, password));
  await touchLastLogin(database);
};
