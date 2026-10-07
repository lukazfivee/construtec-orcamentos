import { logEvent } from './logger';
import type { LocalDatabase } from './database';
import { parseExsatCards } from './exsatCards';
import { ExsatServerError } from './exsatErrors';
import { discoverCatalogLinks } from './exsatPages';
import { ensureSession, type ExsatRuntime } from './exsatRuntime';
import { jobCounts, loadJob, MAX_PAGES, saveProgress, setJobStatus, stageItems } from './exsatSyncJobs';

const DEPARTMENT_PATH = /^\/produtos\/departamento\/[a-z0-9-]+\/?$/i;
const MAX_CONSECUTIVE_FAILURES = 3;

// So paginas de departamento, sem busca nem filtro na URL: a varredura le cada departamento uma vez.
export const departmentLinks = (html: string, baseUrl: string): string[] => {
  const found = new Set<string>();
  for (const link of discoverCatalogLinks(html, baseUrl)) {
    const url = new URL(link);
    if (url.search || !DEPARTMENT_PATH.test(url.pathname)) continue;
    found.add(`https://exsat.com.br${url.pathname.toLowerCase().replace(/\/?$/, '/')}`);
  }
  return [...found];
};

const codeOf = (error: unknown) => (error instanceof ExsatServerError ? error.code : 'EXSAT_INTERNAL');

// Varredura em segundo plano: um departamento por vez, com pausa entre as requisicoes, e o estado inteiro salvo no
// banco a cada pagina (fila, lidas, falhas). Se o servidor dormir, ela fica "pausada" e se retoma de onde parou.
// So conta o que a Exsat mostra com a conta logada: pagina sem o marcador da conta derruba a sessao e para a leitura.
export const runSyncJob = async (database: LocalDatabase, runtime: ExsatRuntime, jobId: string): Promise<void> => {
  // A rota ja registra a varredura antes de grava-la; sem isso uma consulta de andamento no meio acharia que ela morreu.
  const control = runtime.runs.get(jobId) ?? { cancelled: false };
  runtime.runs.set(jobId, control);
  const pause = async (code: string) => {
    await setJobStatus(database, jobId, 'paused', code);
    runtime.lastFailure = { code, at: new Date(runtime.now()) };
  };
  try {
    const job = await loadJob(database, jobId);
    if (!job || job.status !== 'running') return;
    const queue = [...job.queue];
    const visited = [...job.visited];
    let { pages_read: pagesRead, pages_failed: pagesFailed, relogins } = job;
    let consecutiveFailures = 0;
    const save = () => saveProgress(database, jobId, { queue, visited, pagesRead, pagesFailed, relogins });

    while (queue.length > 0) {
      if (control.cancelled) return;
      const url = queue[0];
      try {
        const page = await runtime.session.getAuthenticated(url);
        if (page.status === 404 || page.status === 410) {
          pagesFailed += 1; // departamento que sumiu: o site esta de pe, segue para o proximo
        } else if (page.status >= 400) {
          throw new ExsatServerError('EXSAT_UNAVAILABLE');
        } else {
          await stageItems(database, jobId, parseExsatCards(page.html));
          for (const link of departmentLinks(page.html, page.finalUrl)) {
            if (visited.length + queue.length < MAX_PAGES && !visited.includes(link) && !queue.includes(link)) queue.push(link);
          }
          pagesRead += 1;
          consecutiveFailures = 0;
        }
      } catch (error) {
        const code = codeOf(error);
        if (code === 'EXSAT_LOGIN_REQUIRED') {
          // Uma unica nova entrada por varredura; se nao der, para (nada de tentar em loop).
          if (relogins >= 1) { await pause(code); return; }
          relogins += 1;
          try { await ensureSession(database, runtime, true); } catch (loginError) { await pause(codeOf(loginError)); return; }
          await save();
          continue;
        }
        if (code === 'EXSAT_CHALLENGE') { runtime.gate.fail(code); await pause(code); return; }
        pagesFailed += 1;
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) { queue.shift(); visited.push(url); await save(); await pause('EXSAT_UNAVAILABLE'); return; }
      }
      queue.shift();
      visited.push(url);
      await save();
      await runtime.sleep(runtime.delayMs());
    }

    const { priced } = await jobCounts(database, jobId);
    if (priced === 0) await setJobStatus(database, jobId, 'failed', 'EXSAT_NO_PRICES');
    else await setJobStatus(database, jobId, 'done');
  } catch (error) {
    // Nada de detalhe do erro no log nem na tela: so o codigo.
    logEvent('error', 'exsat.sync.failed', { jobId, code: codeOf(error) });
    await setJobStatus(database, jobId, 'paused', 'EXSAT_INTERNAL').catch(() => undefined);
  } finally {
    runtime.runs.delete(jobId);
  }
};
