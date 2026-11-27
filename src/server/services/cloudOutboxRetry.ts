const QUICK_RETRY_INTERVAL_MS = 30_000;
const MAX_QUICK_PASSES = 5;

/** Na nuvem a fila durável é a fonte da verdade; este temporizador só acelera
 * envios novos enquanto o Container está acordado, sem consultar fila vazia
 * indefinidamente. Se ele dormir ou uma passada falhar, o Cron retoma. */
export const createOnDemandOutboxRetry = (run: () => Promise<number>) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let closed = false;
  let remaining = 0;

  const schedule = () => {
    if (closed || running || timer || remaining === 0) return;
    timer = setTimeout(() => {
      timer = undefined;
      void pass();
    }, QUICK_RETRY_INTERVAL_MS);
    timer.unref();
  };

  const pass = async () => {
    if (closed || remaining === 0) return;
    running = true;
    const before = --remaining;
    try {
      if (await run() === 0 && remaining === before) remaining = 0;
    } catch {
      // Não consultar em loop se o banco estiver indisponível. O Cron retoma.
      if (remaining === before) remaining = 0;
    } finally {
      running = false;
      schedule();
    }
  };

  return {
    notify: () => {
      if (closed) return;
      remaining = MAX_QUICK_PASSES;
      schedule();
    },
    stop: () => {
      closed = true;
      clearTimeout(timer);
    },
  };
};
