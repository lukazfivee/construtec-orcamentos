import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createCriticalTestDatabase } from '../src/server/services/criticalTestDatabase';
import { updateProposalStatus } from '../src/server/services/proposals';
import { exportProposalIntegration } from '../src/server/services/integration/proposalExport';
import { syncProposalDirectly } from '../src/server/services/integration/proposalSync';

async function main() {
  const workspace = path.resolve(process.cwd(), '../..');
  const centro = path.join(workspace, 'centro de custos CONSTRUTEC');
  const output = path.join(workspace, 'output/homologacao-suite');
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'construtec-homologacao-'));
  fs.mkdirSync(output, { recursive: true });
  process.env.CONSTRUTEC_RUNTIME_DIR = path.join(sandbox, 'runtime');
  process.env.CONSTRUTEC_INTEGRATION_KEY = randomBytes(32).toString('hex');
  const password = randomBytes(24).toString('hex');
  const env = { ...process.env, DATABASE_URL: '', PGLITE_DATA_DIR: path.join(sandbox, 'pglite'),
    RESTORE_ROOT_DIR: path.join(sandbox, 'restore'), JWT_SECRET: randomBytes(32).toString('hex'),
    ADMIN_INITIAL_EMAIL: 'homologacao@example.invalid', ADMIN_INITIAL_PASSWORD: password,
    HOST: '127.0.0.1', REPORT_API_URL: '', SYNC_API_URL: '', MOBILE_APP_URL: '', LOG_LEVEL: 'error' };
  const { stopServices } = createRequire(path.join(centro, 'package.json'))('./lib/localControl.js') as { stopServices: () => Promise<void> };
  const children: ChildProcess[] = [];
  async function stopAll() {
    await stopServices();
    await Promise.all(children.filter(child => child.exitCode === null).map(child => once(child, 'exit')));
    assert.ok(children.every(child => child.exitCode === 0));
  }
  const fixture = await createCriticalTestDatabase();
  const checks: string[] = [];
  const check = (label: string) => { checks.push(label); console.log('OK:', label); };
  let auth = '';
  let base = '';
  async function unusedPort() {
    const server = net.createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as net.AddressInfo).port;
    await new Promise<void>(resolve => server.close(() => resolve()));
    return port;
  }
  async function launch(directory: string, endpoint: string) {
    const port = await unusedPort();
    const child = spawn(process.execPath, ['server.js'], { cwd: directory,
      env: { ...env, PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    const log = fs.createWriteStream(path.join(output, `${path.basename(directory)}-${child.pid}.log`));
    child.stdout?.pipe(log, { end: false });
    child.stderr?.pipe(log, { end: false });
    child.once('exit', () => log.end());
    const url = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (child.exitCode !== null) throw new Error('Servidor de homologação encerrou antes de ficar pronto');
      try { if ((await fetch(url + endpoint)).ok) return url; } catch { /* aguarda o boot */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Tempo esgotado no boot de homologação');
  }
  async function request(route: string, method = 'GET', body?: unknown, status = 200) {
    const res = await fetch(base + '/api' + route, { method,
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json();
    assert.equal(res.status, status, JSON.stringify(data));
    return data;
  }
  async function login() {
    auth = (await request('/auth/login', 'POST', { email: env.ADMIN_INITIAL_EMAIL, senha: password })).token;
    assert.ok(auth);
  }
  try {
    const id = await fixture.makeProposal();
    await fixture.addMaterial(id, '100', '10', '12.5');
    await fixture.addLabor(id, 44);
    await updateProposalStatus(fixture.database, id, 'approved', fixture.userId);
    const { envelope } = await exportProposalIntegration(fixture.database, id, fixture.userId, false);
    assert.equal(Number(envelope.payload.totals.baseCost), 2760);
    assert.equal(Number(envelope.payload.totals.contractValue), 3450);
    await assert.rejects(fixture.database.query(
      'UPDATE proposal_approval_snapshots SET revision = 99 WHERE proposal_id = $1', [id]), /SNAPSHOT_LOCKED/);
    fs.writeFileSync(path.join(output, 'proposta-selada.json'), JSON.stringify(envelope, null, 2));
    check('Proposta criada e aprovada pelo serviço real; selo imutável e totais 2760/3450');
    const offlinePort = await unusedPort();
    const offline = await syncProposalDirectly(fixture.database, id, fixture.userId,
      `http://127.0.0.1:${offlinePort}/api/integracao/orcamentos/sync-direto`);
    assert.equal(offline.ok, false);
    assert.equal((await fixture.database.query<{ status: string }>(
      'SELECT status FROM integration_outbox WHERE snapshot_id IN (SELECT id FROM proposal_approval_snapshots WHERE proposal_id=$1)', [id])).rows[0].status, 'pending');
    check('Destino offline mantém entrega pendente');
    base = await launch(centro, '/api/health');
    await login();
    const syncUrl = base + '/api/integracao/orcamentos/sync-direto';
    const receipt = await syncProposalDirectly(fixture.database, id, fixture.userId, syncUrl);
    assert.equal(receipt.ok, true, JSON.stringify(receipt));
    const duplicate = await syncProposalDirectly(fixture.database, id, fixture.userId, syncUrl);
    assert.equal(duplicate.status, 'already_imported');
    assert.equal(duplicate.baselineId, receipt.baselineId);
    const centerId = receipt.costCenterId;
    const route = `/centros-custo/${centerId}`;
    let comparison = await request(route + '/orcado-realizado');
    assert.equal(comparison.summary.baseCost, 2760);
    assert.equal(comparison.summary.realizedCost, 0);
    assert.equal((await request(route + '/baselines')).length, 1);
    const corrupt = structuredClone(envelope);
    corrupt.payload.work.name = 'Envelope adulterado';
    await request('/integracao/orcamentos/confirmar-direto', 'POST', corrupt, 422);
    check('P2P real, reenvio idempotente, hash adulterado rejeitado e importação sem despesa fictícia');
    const categories = await request('/categorias');
    const date = new Date().toISOString().slice(0, 10);
    const tx = await request('/lancamentos', 'POST', { tipo: 'despesa', cost_center_id: centerId,
      category_id: categories[0].id, descricao: 'Despesa piloto controlada', valor: 550.01,
      data: date, status_financeiro: 'liquidado' }, 201);
    await request(route + '/apropriacoes', 'POST', { transactionId: tx.id, amount: 550.01,
      contractId: receipt.contractId, controlItemId: comparison.items[0].controlItemId }, 201);
    assert.equal((await request(route + '/curva-s')).evm.eac, null);
    await request(route + '/medicoes', 'POST', { type: 'labor', teamHours: 8,
      periodStart: date, periodEnd: date }, 201);
    for (const [number, amount] of [[1, 500], [2, 1000]]) {
      await request(route + '/medicoes', 'POST', { type: 'contract', measurementNumber: number,
        measuredAmount: amount, periodStart: date, periodEnd: date }, 201);
    }
    comparison = await request(route + '/orcado-realizado');
    assert.equal(comparison.summary.realizedCost, 550.01);
    assert.equal(comparison.summary.balance, 2209.99);
    const curve = await request(route + '/curva-s');
    assert.equal(curve.evm.ev, 1200);
    assert.equal(curve.evm.eac, 1265.02);
    const measurements = await request(route + '/medicoes');
    assert.equal(measurements.labor.length, 1);
    assert.equal(measurements.contracts.length, 2);
    check('Despesa, apropriação, horas, duas medições e EAC conferidos em centavos');
    const hub = await launch(path.join(workspace, 'portal-hub-construtec'), '/');
    const cockpit = await (await fetch(hub + '/api/portfolio-summary?centroCustosUrl=' + encodeURIComponent(base))).json();
    assert.equal(cockpit.portfolio.totalRealizedCost, 550.01);
    assert.equal(cockpit.portfolio.clientBilling.totalBilled, 1500);
    check('Hub consolida carteira da instância piloto');
    fs.writeFileSync(path.join(output, 'dados-visuais.json'), JSON.stringify({ comparison, curve, measurements,
      center: { nome: 'Obra piloto de homologação', codigo: 'HML-001', cliente: 'Cliente fictício', responsavel: 'Responsável de homologação' } }, null, 2));
    const backupResponse = await fetch(base + '/api/backup', { headers: { Authorization: `Bearer ${auth}` } });
    assert.equal(backupResponse.status, 200);
    const backup = Buffer.from(await backupResponse.arrayBuffer());
    const sha256 = createHash('sha256').update(backup).digest('hex');
    assert.equal(backupResponse.headers.get('x-backup-sha256'), sha256);
    await stopAll();
    assert.ok(children.every(child => child.exitCode === 0));
    base = await launch(centro, '/api/health');
    await login();
    assert.equal((await request(route + '/orcado-realizado')).summary.realizedCost, 550.01);
    check('Parada limpa e reinício preservam obra, baseline e despesas');
    await request('/backup/restaurar', 'POST', { confirmacao: 'RESTAURAR', nomeArquivo: 'piloto.tar.gz',
      conteudoBase64: backup.toString('base64'), sha256 });
    await stopAll();
    base = await launch(centro, '/api/health');
    await login();
    assert.equal((await request(route + '/orcado-realizado')).summary.realizedCost, 550.01);
    assert.equal((await request(route + '/medicoes')).contracts.length, 2);
    check('Backup com SHA-256 restaurado e conferido em banco isolado');
    await stopAll();
    assert.ok(children.every(child => child.exitCode === 0));
    fs.writeFileSync(path.join(output, 'resultado.json'), JSON.stringify({ status: 'passed', checks,
      productionDatabaseTouched: false, sandbox, testedAt: new Date().toISOString() }, null, 2));
  } finally {
    await fixture.database.close();
    if (children.some(child => child.exitCode === null)) await stopServices().catch(error => console.error(error.message));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
