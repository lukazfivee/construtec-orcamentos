import { randomBytes } from 'node:crypto';
import { getProposalFinancials } from '../../shared/proposalFinancials';
import { buildMobileProposalHtml, parseMobileDocumentChoices } from '../../documents/proposalMobileDocument';
import type { LocalDatabase } from './database';
import { addLinkEvent, LINK_SELECT, type LinkRow } from './clientLinks';
import { ClientLinkError, deviceLabel, hashIp, linkState, parseLinkToken, type LinkState } from './clientLinkCommon';
import { createProposalRevision } from './proposalLifecycle';
import { getProposalById } from './proposals';
import { getAppSettings } from './settings';

// Lado publico (cliente, sem login): ver, aprovar e pedir ajuste. So preco de venda; nunca custo, BDI ou margem.
export type PublicContext = { secret: string; ip: string; userAgent: string };

export type PublicLinkView = {
  state: LinkState;
  proposal: { number: string; revision: number; clientName: string; workName: string; total: number; validUntil: string | null; responsibleName: string };
  company: { name: string; phone: string; email: string };
  requireIdentity: boolean;
  expiresAt: string;
  reply: { kind: 'approved' | 'adjust'; name: string | null; message: string | null; code: string | null; at: string } | null;
};

const findLink = async (database: LocalDatabase, token: string, secret: string): Promise<LinkRow> => {
  const id = parseLinkToken(token, secret);
  const row = id ? (await database.query<LinkRow>(`${LINK_SELECT} WHERE l.id = $1`, [id])).rows[0] : undefined;
  // Mesmo erro para token invalido e inexistente: nao revela se o link existiu.
  if (!row) throw new ClientLinkError('LINK_INVALID', 404, 'Este link não existe.');
  return row;
};

const view = async (database: LocalDatabase, row: LinkRow): Promise<PublicLinkView> => {
  const proposal = await getProposalById(database, row.proposal_id);
  if (!proposal) throw new ClientLinkError('LINK_INVALID', 404, 'Este link não existe.');
  const settings = await getAppSettings(database);
  const reply = (await database.query<{ kind: 'approved' | 'adjust'; actor_name: string | null; message: string | null; code: string | null; occurred_at: string }>(
    "SELECT kind, actor_name, message, code, occurred_at::text FROM proposal_client_link_events WHERE link_id = $1 AND kind IN ('approved','adjust') ORDER BY occurred_at DESC LIMIT 1", [row.id],
  )).rows[0];
  return {
    state: linkState(row),
    proposal: {
      number: proposal.number, revision: proposal.revision, clientName: proposal.clientName, workName: proposal.workName,
      total: getProposalFinancials(proposal).finalValue, validUntil: proposal.validUntil, responsibleName: proposal.responsibleName,
    },
    company: { name: settings.tradeName || settings.companyName || 'Construtec', phone: settings.phone || '', email: settings.email || '' },
    requireIdentity: row.require_identity, expiresAt: row.expires_at,
    reply: reply ? { kind: reply.kind, name: reply.actor_name, message: reply.message, code: reply.code, at: reply.occurred_at } : null,
  };
};

export const openPublicLink = async (database: LocalDatabase, token: string, context: PublicContext): Promise<PublicLinkView> => {
  const row = await findLink(database, token, context.secret);
  const result = await view(database, row);
  // So conta abertura enquanto o link vale; o historico mostra quando e de onde o cliente abriu.
  if (result.state === 'active') await addLinkEvent(database, row.id, 'opened', { device: deviceLabel(context.userAgent), ipHash: hashIp(context.ip, context.secret) });
  return result;
};

export const publicDocumentHtml = async (database: LocalDatabase, token: string, secret: string) => {
  const row = await findLink(database, token, secret);
  if (['disabled', 'expired'].includes(linkState(row))) throw new ClientLinkError('LINK_CLOSED', 410, 'Este link não está mais disponível.');
  const proposal = await getProposalById(database, row.proposal_id);
  if (!proposal) throw new ClientLinkError('LINK_INVALID', 404, 'Este link não existe.');
  return buildMobileProposalHtml(proposal, await getAppSettings(database), parseMobileDocumentChoices({}));
};

// Tira caracteres de controle (menos quebra de linha e tab) do que o cliente digita.
const cleanText = (value: unknown, max: number) => [...String(value ?? '')].filter((char) => {
  const code = char.charCodeAt(0);
  return code >= 32 || code === 9 || code === 10 || code === 13;
}).join('').trim().slice(0, max);

const requireActive = (row: LinkRow) => {
  const state = linkState(row);
  if (state !== 'active') throw new ClientLinkError('LINK_NOT_ACTIVE', 409, 'Este link não aceita mais respostas.');
};

const identity = (row: LinkRow, input: { name?: unknown; role?: unknown }) => {
  const name = cleanText(input.name, 120), role = cleanText(input.role, 80);
  if (row.require_identity && (name.length < 2 || role.length < 2)) throw new ClientLinkError('LINK_IDENTITY_REQUIRED', 400, 'Informe nome e cargo.');
  return { name: name || null, role: role || null };
};

export const approvePublicLink = async (
  database: LocalDatabase, token: string, input: { name?: unknown; role?: unknown; accept?: unknown }, context: PublicContext,
) => {
  const row = await findLink(database, token, context.secret);
  requireActive(row);
  if (input.accept !== true) throw new ClientLinkError('LINK_ACCEPT_REQUIRED', 400, 'Marque o aceite dos termos para aprovar.');
  const who = identity(row, input);
  const code = `ACEITE-${row.proposal_number}-REV${String(row.revision).padStart(2, '0')}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const done = await database.transaction(async (tx) => {
    // Fecha o link so se ainda estava ativo: dois cliques nao geram duas aprovacoes.
    const closed = await tx.query("UPDATE proposal_client_links SET status = 'approved', closed_at = now() WHERE id = $1 AND status = 'active' RETURNING id", [row.id]);
    if (!closed.rows[0]) return false;
    await addLinkEvent(tx, row.id, 'approved', { name: who.name, role: who.role, code, device: deviceLabel(context.userAgent), ipHash: hashIp(context.ip, context.secret) });
    return true;
  });
  if (!done) throw new ClientLinkError('LINK_NOT_ACTIVE', 409, 'Este link não aceita mais respostas.');
  return { code, at: new Date().toISOString() };
};

export const adjustPublicLink = async (
  database: LocalDatabase, token: string, input: { name?: unknown; role?: unknown; message?: unknown }, context: PublicContext,
) => {
  const row = await findLink(database, token, context.secret);
  requireActive(row);
  const who = identity(row, input);
  const message = cleanText(input.message, 1000);
  if (message.length < 3) throw new ClientLinkError('LINK_MESSAGE_REQUIRED', 400, 'Escreva o que precisa ser ajustado.');
  const closed = await database.query("UPDATE proposal_client_links SET status = 'adjust', closed_at = now() WHERE id = $1 AND status = 'active' RETURNING id", [row.id]);
  if (!closed.rows[0]) throw new ClientLinkError('LINK_NOT_ACTIVE', 409, 'Este link não aceita mais respostas.');
  await addLinkEvent(database, row.id, 'adjust', { name: who.name, role: who.role, message, device: deviceLabel(context.userAgent), ipHash: hashIp(context.ip, context.secret) });
  // O pedido de ajuste volta a proposta para Edicao como nova revisao, em nome de quem gerou o link.
  const revisionId = await createProposalRevision(database, row.proposal_id, row.created_by ?? '');
  return { revisionId };
};
