import { randomUUID } from 'node:crypto';
import type { ClientContact, ClientRecord, WorkRecord } from '../../shared/contracts';
import type { LocalDatabase } from './database';

type ClientRow = {
  id: string; legal_name: string; trade_name: string | null; document: string | null; updated_at: string;
  contact_name: string | null; contact_role: string | null; contact_department: string | null; contact_email: string | null; contact_phone: string | null;
};

export const CONTACT_COLUMNS = 'contact_name, contact_role, contact_department, contact_email, contact_phone';
export const EMPTY_CONTACT: ClientContact = { name: '', role: '', department: '', email: '', phone: '' };
export const mapContact = (row: Partial<ClientRow>): ClientContact => ({
  name: row.contact_name ?? '', role: row.contact_role ?? '', department: row.contact_department ?? '', email: row.contact_email ?? '', phone: row.contact_phone ?? '',
});
const contactValues = (contact: Partial<ClientContact> | undefined) => [contact?.name, contact?.role, contact?.department, contact?.email, contact?.phone].map((value) => value?.trim() || null);
type ClientInput = { legalName: string; tradeName?: string | null; document?: string | null; contact?: Partial<ClientContact> };

type WorkRow = {
  id: string; client_id: string; name: string; address: string | null; active: boolean; updated_at: string;
};

const mapWork = (work: WorkRow): WorkRecord => ({
  id: work.id,
  clientId: work.client_id,
  name: work.name,
  address: work.address,
  active: work.active,
  updatedAt: work.updated_at,
});

export const listClients = async (database: LocalDatabase, query = ''): Promise<ClientRecord[]> => {
  const pattern = `%${query.trim()}%`;
  const clients = await database.query<ClientRow>(`
    SELECT id, legal_name, trade_name, document, updated_at::text, ${CONTACT_COLUMNS}
    FROM clients
    WHERE $1 = '%%'
      OR legal_name ILIKE $1
      OR trade_name ILIKE $1
      OR document ILIKE $1
      OR EXISTS (SELECT 1 FROM works WHERE works.client_id = clients.id AND works.name ILIKE $1)
    ORDER BY COALESCE(trade_name, legal_name)
    LIMIT 200
  `, [pattern]);
  if (clients.rows.length === 0) return [];

  const works = await database.query<WorkRow>(`
    SELECT id, client_id, name, address, active, updated_at::text
    FROM works
    WHERE client_id = ANY($1::uuid[])
    ORDER BY active DESC, name
  `, [clients.rows.map((client) => client.id)]);

  return clients.rows.map((client) => ({
    id: client.id,
    legalName: client.legal_name,
    tradeName: client.trade_name,
    document: client.document,
    contact: mapContact(client),
    updatedAt: client.updated_at,
    works: works.rows.filter((work) => work.client_id === client.id).map(mapWork),
  }));
};

export const createClient = async (database: LocalDatabase, input: ClientInput) => {
  const clientId = randomUUID();
  await database.transaction(async (transaction) => {
    await transaction.query(
      `INSERT INTO clients (id, legal_name, trade_name, document, ${CONTACT_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [clientId, input.legalName.trim(), input.tradeName?.trim() || null, input.document?.trim() || null, ...contactValues(input.contact)],
    );
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'client', $2, 'created', $3::jsonb)
    `, [randomUUID(), clientId, JSON.stringify(input)]);
  });
  return clientId;
};

export const updateClient = async (database: LocalDatabase, clientId: string, input: ClientInput) => {
  await database.transaction(async (transaction) => {
    const before = await transaction.query<ClientRow>(
      `SELECT id, legal_name, trade_name, document, updated_at::text, ${CONTACT_COLUMNS} FROM clients WHERE id = $1 FOR UPDATE`,
      [clientId],
    );
    if (!before.rows[0]) throw new Error('CLIENT_NOT_FOUND');
    await transaction.query(`
      UPDATE clients
      SET legal_name = $2, trade_name = $3, document = $4, contact_name = $5, contact_role = $6, contact_department = $7,
        contact_email = $8, contact_phone = $9, revision = revision + 1, updated_at = now()
      WHERE id = $1
    `, [clientId, input.legalName.trim(), input.tradeName?.trim() || null, input.document?.trim() || null, ...contactValues(input.contact)]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'client', $2, 'updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), clientId, JSON.stringify(before.rows[0]), JSON.stringify(input)]);
  });
};

export const createWork = async (
  database: LocalDatabase,
  clientId: string,
  input: { name: string; address?: string | null },
) => {
  const workId = randomUUID();
  await database.transaction(async (transaction) => {
    const client = await transaction.query<{ id: string }>('SELECT id FROM clients WHERE id = $1', [clientId]);
    if (!client.rows[0]) throw new Error('CLIENT_NOT_FOUND');
    const duplicate = await transaction.query<{ id: string }>(
      'SELECT id FROM works WHERE client_id = $1 AND lower(name) = lower($2)',
      [clientId, input.name.trim()],
    );
    if (duplicate.rows[0]) throw new Error('WORK_DUPLICATE');
    await transaction.query(
      'INSERT INTO works (id, client_id, name, address) VALUES ($1, $2, $3, $4)',
      [workId, clientId, input.name.trim(), input.address?.trim() || null],
    );
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'work', $2, 'created', $3::jsonb)
    `, [randomUUID(), workId, JSON.stringify({ clientId, ...input })]);
  });
  return workId;
};

export const updateWork = async (
  database: LocalDatabase,
  clientId: string,
  workId: string,
  input: { name: string; address?: string | null; active: boolean },
) => {
  await database.transaction(async (transaction) => {
    const before = await transaction.query<WorkRow>(`
      SELECT id, client_id, name, address, active, updated_at::text
      FROM works WHERE id = $1 AND client_id = $2 FOR UPDATE
    `, [workId, clientId]);
    if (!before.rows[0]) throw new Error('WORK_NOT_FOUND');
    const duplicate = await transaction.query<{ id: string }>(
      'SELECT id FROM works WHERE client_id = $1 AND lower(name) = lower($2) AND id <> $3',
      [clientId, input.name.trim(), workId],
    );
    if (duplicate.rows[0]) throw new Error('WORK_DUPLICATE');
    await transaction.query(`
      UPDATE works
      SET name = $3, address = $4, active = $5, revision = revision + 1, updated_at = now()
      WHERE id = $1 AND client_id = $2
    `, [workId, clientId, input.name.trim(), input.address?.trim() || null, input.active]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'work', $2, 'updated', $3::jsonb, $4::jsonb)
    `, [randomUUID(), workId, JSON.stringify(before.rows[0]), JSON.stringify(input)]);
  });
};
