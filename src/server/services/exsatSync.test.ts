import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { createCriticalTestDatabase } from './criticalTestDatabase';
import { createMockExsat, type MockExsatOptions } from './exsatMockSite';
import { connectAndSave, createExsatRuntime, ensureSession } from './exsatRuntime';
import { createJob, EXSAT_SEEDS, listPricedItems, loadJob, reconcileInterrupted, reopenJob, setJobStatus, toJobView } from './exsatSyncJobs';
import { runSyncJob } from './exsatSyncRunner';

const seedSlugs = EXSAT_SEEDS.map((url) => url.split('/').filter(Boolean).at(-1) as string);
const catalog = (extra: MockExsatOptions['departments'] = {}): NonNullable<MockExsatOptions['departments']> => ({
  ...Object.fromEntries(seedSlugs.map((slug, index) => [slug, [[`S${index}001`, `Item ${slug}`, 10 + index, 'Intelbras']]])),
  'cameras-ip': [['4570042', 'Câmera IP Dome', 225.65, 'Intelbras'], ['4570099', 'Câmera Sem Preço', 0]],
  ...extra,
});

const setup = async (options: MockExsatOptions) => {
  const { database, userId } = await createCriticalTestDatabase();
  const site = createMockExsat(options);
  const sleeps: number[] = [];
  const runtime = createExsatRuntime({
    http: site.http, env: { EXSAT_CREDENTIAL_KEY: randomBytes(32).toString('hex') },
    sleep: async (ms) => { sleeps.push(ms); }, delayMs: () => 1500,
  });
  await connectAndSave(database, runtime, userId, site.email, site.password);
  return { database, userId, site, runtime, sleeps };
};

const mustJob = async (database: Parameters<typeof loadJob>[0], id: string) => {
  const row = await loadJob(database, id);
  assert.ok(row, 'varredura nao encontrada');
  return row;
};

const startJob = async (ctx: Awaited<ReturnType<typeof setup>>) => {
  const id = await createJob(ctx.database, ctx.userId);
  await runSyncJob(ctx.database, ctx.runtime, id);
  return id;
};

test('varredura: le todos os departamentos com pausa entre as paginas e so guarda itens com preco', async () => {
  const ctx = await setup({ departments: catalog({ alarmes: [['A1', 'Central de alarme', 99.9], ['4570042', 'Câmera repetida sem preço', 0]] }) });
  const id = await startJob(ctx);
  const job = await toJobView(ctx.database, (await mustJob(ctx.database, id)));
  assert.equal(job.status, 'done');
  assert.equal(job.pagesRead, 11, '10 departamentos iniciais + alarmes descoberto no menu');
  assert.equal(job.pagesFailed, 0);
  assert.equal(job.itemsWithPrice, 11, '9 itens dos departamentos + câmera + alarme');
  assert.equal(job.itemsWithoutPrice, 1, 'o item sem preço é contado, não importado');
  assert.equal(ctx.sleeps.length, 11, 'uma pausa depois de cada pagina');
  assert.ok(ctx.sleeps.every((ms) => ms === 1500));
  assert.equal(ctx.site.log.filter((entry) => entry.method === 'POST').length, 1, 'um unico login');
  assert.equal(ctx.site.log.filter((entry) => entry.url.includes('?busca') || entry.url.includes('/detalhes/')).length, 0, 'nao segue busca nem produto');

  const all = await listPricedItems(ctx.database, id, 0, 500);
  assert.equal(all.total, 11);
  assert.ok(all.items.every((item) => item.currentCost > 0 && item.source === 'EXSAT'));
  assert.ok(!all.items.some((item) => item.code === '4570099'), 'sem preco nao sai do servidor');
  const camera = all.items.find((item) => item.code === '4570042');
  assert.equal(camera?.currentCost, 225.65, 'o preco do cartao, nao o 1,00 do JSON de analytics');
  assert.equal(camera?.manufacturer, 'Intelbras');
  const page2 = await listPricedItems(ctx.database, id, 5, 4);
  assert.deepEqual(page2.items.map((item) => item.code), all.items.slice(5, 9).map((item) => item.code));
});

test('varredura: sessao que cai faz uma unica nova entrada, pausa e retoma de onde parou', async () => {
  const options: MockExsatOptions = { departments: catalog(), dropSessionAfter: 3 };
  const ctx = await setup(options);
  const id = await startJob(ctx);
  let row = (await mustJob(ctx.database, id));
  assert.equal(row.status, 'paused');
  assert.equal(row.error_code, 'EXSAT_LOGIN_REQUIRED');
  assert.equal(row.pages_read, 3);
  assert.equal(row.queue.length, 7, 'o resto da fila fica salvo');
  assert.equal(ctx.site.state.logins, 2, 'login inicial e uma unica nova entrada, sem laco');
  assert.equal((await toJobView(ctx.database, row)).message?.includes('Salvar e conectar'), true);

  // Retomar: nova entrada pelo clique (uma tentativa), a varredura continua da fila.
  options.dropSessionAfter = undefined;
  ctx.runtime.gate.succeed();
  await ensureSession(ctx.database, ctx.runtime);
  await reopenJob(ctx.database, id);
  await runSyncJob(ctx.database, ctx.runtime, id);
  row = (await mustJob(ctx.database, id));
  assert.equal(row.status, 'done');
  assert.equal(row.pages_read, 10);
  assert.equal(ctx.site.state.logins, 3);
  assert.equal((await listPricedItems(ctx.database, id, 0, 500)).total, 10, 'itens da primeira parte foram mantidos');
});

test('varredura: servidor que dormiu deixa a varredura pausada e so uma roda por vez', async () => {
  const ctx = await setup({ departments: catalog() });
  const id = await createJob(ctx.database, ctx.userId);
  await assert.rejects(createJob(ctx.database, ctx.userId), (error) => (error as { code?: string }).code === 'EXSAT_JOB_RUNNING');
  await reconcileInterrupted(ctx.database, ctx.runtime);
  const row = (await mustJob(ctx.database, id));
  assert.equal(row.status, 'paused');
  assert.equal(row.error_code, 'EXSAT_INTERRUPTED');
  // Pausada libera a vaga e pode ser retomada.
  await reopenJob(ctx.database, id);
  assert.equal((await mustJob(ctx.database, id)).status, 'running');
  await setJobStatus(ctx.database, id, 'cancelled');
  assert.equal((await mustJob(ctx.database, id)).status, 'cancelled');
  await assert.rejects(reopenJob(ctx.database, id), (error) => (error as { code?: string }).code === 'EXSAT_JOB_RUNNING');
});

test('varredura: site fora do ar, cancelamento e catalogo sem nenhum preco', async () => {
  const down = await setup({ departments: catalog(), failing: seedSlugs.slice(0, 4) });
  const downId = await startJob(down);
  const downRow = (await mustJob(down.database, downId));
  assert.equal(downRow.status, 'paused');
  assert.equal(downRow.error_code, 'EXSAT_UNAVAILABLE');
  assert.equal(downRow.pages_failed, 3, 'para na terceira falha seguida em vez de insistir');

  const noPrices = await setup({ departments: Object.fromEntries(seedSlugs.map((slug) => [slug, [['Z1', 'Sem preço', 0]]])) });
  const noPriceRow = await mustJob(noPrices.database, await startJob(noPrices));
  assert.equal(noPriceRow.status, 'failed');
  assert.equal(noPriceRow.error_code, 'EXSAT_NO_PRICES');

  const cancel = await setup({ departments: catalog() });
  const cancelId = await createJob(cancel.database, cancel.userId);
  let pauses = 0;
  cancel.runtime.sleep = async () => { pauses += 1; if (pauses === 2) { const control = cancel.runtime.runs.get(cancelId); if (control) control.cancelled = true; await setJobStatus(cancel.database, cancelId, 'cancelled'); } };
  await runSyncJob(cancel.database, cancel.runtime, cancelId);
  const cancelRow = (await mustJob(cancel.database, cancelId));
  assert.equal(cancelRow.status, 'cancelled');
  assert.equal(cancel.site.state.departmentHits, 2, 'nao le mais nenhuma pagina depois de cancelar');
  assert.equal(cancel.runtime.runs.size, 0);
});
