import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import type { AuthUser } from '../../shared/contracts';
import { createCriticalTestDatabase } from '../services/criticalTestDatabase';
import type { LocalDatabase } from '../services/database';
import { createCatalogRouter } from './catalog';

const PRODUCT = { code: 'CAB-001', manufacturer: null, model: null, description: 'Cabo flexível 2,5 mm', category: 'Cabos', unit: 'm', currentCost: 3.2, source: 'CONSTRUTEC', active: true };

test('excluir item do catalogo: apaga o livre e recusa o que esta em proposta ou kit', async context => {
  const { database, userId, makeProposal } = await createCriticalTestDatabase();
  context.after(() => database.close());
  const user: AuthUser = { id: userId, name: 'Teste', email: 'fixture@example.invalid', role: 'admin', apps: ['orcamentos'] };
  const app = express();
  app.use(express.json());
  app.use((_request, response, next) => { response.locals.authUser = user; next(); });
  app.use('/api/catalog', createCatalogRouter(database as unknown as LocalDatabase));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    response.status(500).json({ error: error instanceof Error ? error.message : 'erro' });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/catalog`;

  const create = async (code: string) => {
    const response = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...PRODUCT, code }) });
    assert.equal(response.status, 201);
    return ((await response.json()) as { productId: string }).productId;
  };
  const remove = (id: string) => fetch(`${base}/${id}`, { method: 'DELETE' });
  const exists = async (id: string) => (await database.query('SELECT 1 FROM products WHERE id = $1', [id])).rows.length === 1;

  // Item sem vinculo: sai do catalogo e a exclusao fica na auditoria.
  const free = await create('CAB-001');
  const removed = await remove(free);
  assert.equal(removed.status, 200);
  assert.equal(await exists(free), false);
  assert.equal((await database.query("SELECT 1 FROM audit_events WHERE entity_id = $1 AND action = 'deleted'", [free])).rows.length, 1);

  // Id que nao existe: 404, nao erro interno.
  assert.equal((await remove('44444444-4444-4444-8444-444444444444')).status, 404);

  // Item usado em proposta: recusa e mantem.
  const inProposal = await create('CAB-002');
  const proposalId = await makeProposal();
  await database.query(`INSERT INTO proposal_items
    (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_description, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
    VALUES ('55555555-5555-4555-8555-555555555555', $1, $2, 1, 'CAB-002', 'Cabo', 'm', 3.2, 10, 4)`, [proposalId, inProposal]);
  assert.equal((await remove(inProposal)).status, 409);
  assert.equal(await exists(inProposal), true);

  // Item usado em kit: recusa e mantem.
  const inKit = await create('CAB-003');
  await database.query("INSERT INTO kits (id, name) VALUES ('66666666-6666-4666-8666-666666666666', 'Kit de teste')");
  await database.query(`INSERT INTO kit_items (id, kit_id, catalog_product_id, position, snapshot_code, snapshot_description, snapshot_unit, quantity)
    VALUES ('77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666', $1, 1, 'CAB-003', 'Cabo', 'm', 2)`, [inKit]);
  assert.equal((await remove(inKit)).status, 409);
  assert.equal(await exists(inKit), true);
});
