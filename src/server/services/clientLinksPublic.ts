import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getProposalFinancials } from '../../shared/proposalFinancials';
import { buildMobileProposalHtml, parseMobileDocumentChoices } from '../../documents/proposalMobileDocument';
import type { LocalDatabase } from './database';
import { addLinkEvent, LINK_SELECT, type LinkRow } from './clientLinks';
import { ClientLinkError, cleanPublicText, closedWindowOpen, contentFingerprint, deviceLabel, hashIp, linkState, parseLinkToken, type LinkState } from './clientLinkCommon';
import { centroNotifyClientReply } from './centroIdentity';
import { createProposalRevisionIn } from './proposalLifecycle';
import { getProposalById } from './proposals';
import { getAppSettings } from './settings';

// Lado publico (cliente, sem login): ver, aprovar e pedir ajuste. So preco de venda; nunca custo, BDI ou margem.
export type PublicContext = { secret: string; ip: string; userAgent: string };

// Link fechado (desativado, vencido, substituido) ou com a janela de 30 dias esgotada devolve so o minimo.
export type PublicLinkView = {
  state: LinkState;
  proposal: { number: string; revision?: number; clientName?: string; workName?: string; total?: number; validUntil?: string | null; responsibleName?: string };
  company: { name: string; phone: string; email: string };
  requireIdentity?: boolean;
  expiresAt?: string;
  reply?: { kind: 'approved' | 'adjust'; name: string | null; message: string | null; code: string | null; at: string } | null;
};

const findLink = async (database: LocalDatabase, token: string, secret: string): Promise<LinkRow> => {
  const id = parseLinkToken(token, secret);
  const row = id ? (await database.query<LinkRow>(`${LINK_SELECT} WHERE l.id = $1`, [id])).rows[0] : undefined;
  // Mesmo erro para token invalido e inexistente: nao revela se o link existiu.
  if (!row) throw new ClientLinkError('LINK_INVALID', 404, 'Este link não existe.');
  return row;
};

// Documento e dados completos so enquanto o link esta ativo ou, depois de respondido, por 30 dias.
const documentAvailable = (row: LinkRow) => {
  const state = linkState(row);
  if (state === 'active') return true;
  return (state === 'approved' || state === 'adjust' || state === 'confirmed') && closedWindowOpen(row);
};

const view = async (database: LocalDatabase, row: LinkRow): Promise<PublicLinkView> => {
  const settings = await getAppSettings(database);
  const company = { name: settings.tradeName || settings.companyName || 'Construtec', phone: settings.phone || '', email: settings.email || '' };
  const state = linkState(row);
  if (!documentAvailable(row)) return { state, proposal: { number: row.proposal_number }, company };
  const proposal = await getProposalById(database, row.proposal_id);
  if (!proposal) throw new ClientLinkError('LINK_INVALID', 404, 'Este link não existe.');
  const reply = (await database.query<{ kind: 'approved' | 'adjust'; actor_name: string | null; message: string | null; code: string | null; occurred_at: string }>(
    "SELECT kind, actor_name, message, code, occurred_at::text FROM proposal_client_link_events WHERE link_id = $1 AND kind IN ('approved','adjust') ORDER BY occurred_at DESC LIMIT 1", [row.id],
  )).rows[0];
  return {
    state,
    proposal: {
      number: proposal.number, revision: proposal.revision, clientName: proposal.clientName, workName: proposal.workName,
      total: getProposalFinancials(proposal).finalValue, validUntil: proposal.validUntil, responsibleName: proposal.responsibleName,
    },
    company,
    requireIdentity: row.require_identity, expiresAt: row.expires_at,
    reply: reply ? { kind: reply.kind, name: reply.actor_name, message: reply.message, code: reply.code, at: reply.occurred_at } : null,
  };
};

export const openPublicLink = async (database: LocalDatabase, token: string, context: PublicContext): Promise<PublicLinkView> => {
  const row = await findLink(database, token, context.secret);
  const result = await view(database, row);
  // So conta abertura enquanto o link vale. A mesma origem (ip_hash) so conta de novo depois de 10 min.
  if (result.state === 'active') {
    await database.query(`
      INSERT INTO proposal_client_link_events (id, link_id, kind, device, ip_hash)
      SELECT $1, $2, 'opened', $3, $4
      WHERE NOT EXISTS (SELECT 1 FROM proposal_client_link_events WHERE link_id = $2 AND kind = 'opened' AND ip_hash = $4 AND occurred_at > now() - interval '10 minutes')`,
    [randomUUID(), row.id, deviceLabel(context.userAgent), hashIp(context.ip, context.secret)]);
  }
  return result;
};

export const publicDocumentHtml = async (database: LocalDatabase, token: string, secret: string) => {
  const row = await findLink(database, token, secret);
  if (!documentAvailable(row)) throw new ClientLinkError('LINK_CLOSED', 410, 'Este link não está mais disponível.');
  const proposal = await getProposalById(database, row.proposal_id);
  if (!proposal) throw new ClientLinkError('LINK_INVALID', 404, 'Este link não existe.');
  return buildMobileProposalHtml(proposal, await getAppSettings(database), parseMobileDocumentChoices({}));
};

// Entrada publica estrita: campo desconhecido ou de tipo errado vira 400.
const approveSchema = z.object({ name: z.string().max(1000).optional(), role: z.string().max(1000).optional(), accept: z.boolean().optional() }).strict();
const adjustSchema = z.object({ name: z.string().max(1000).optional(), role: z.string().max(1000).optional(), message: z.string().max(10000).optional() }).strict();
const parseInput = <T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> => {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) throw new ClientLinkError('LINK_BAD_INPUT', 400, 'Dados inválidos.');
  return parsed.data;
};

const requireActive = async (database: LocalDatabase, row: LinkRow) => {
  if (linkState(row) !== 'active') throw new ClientLinkError('LINK_NOT_ACTIVE', 409, 'Este link não aceita mais respostas.');
  // So responde enquanto a proposta ainda esta em revisao ou enviada (nao aprovada, rejeitada nem de volta a rascunho).
  const status = (await database.query<{ status: string }>('SELECT status FROM proposals WHERE id = $1', [row.proposal_id])).rows[0]?.status;
  if (status !== 'review' && status !== 'sent') throw new ClientLinkError('LINK_NOT_ACTIVE', 409, 'Este link não aceita mais respostas.');
};

const identity = (row: LinkRow, input: { name?: string; role?: string }) => {
  const name = cleanPublicText(input.name ?? '', 120, false), role = cleanPublicText(input.role ?? '', 80, false);
  if (row.require_identity && (name.length < 2 || role.length < 2)) throw new ClientLinkError('LINK_IDENTITY_REQUIRED', 400, 'Informe nome e cargo.');
  return { name: name || null, role: role || null };
};

// Avisa a equipe (sino e push): o responsavel pela proposta e os admins.
const notifyTeam = async (database: LocalDatabase, row: LinkRow, event: 'approved' | 'adjust') => {
  const owner = row.created_by ? (await database.query<{ centro_user_id: string | null }>('SELECT centro_user_id FROM users WHERE id = $1', [row.created_by])).rows[0] : undefined;
  await centroNotifyClientReply({ event, proposalId: row.proposal_id, proposalNumber: row.proposal_number, responsibleCentroUserId: owner?.centro_user_id ?? null });
};

export const approvePublicLink = async (database: LocalDatabase, token: string, rawInput: unknown, context: PublicContext) => {
  const input = parseInput(approveSchema, rawInput);
  const row = await findLink(database, token, context.secret);
  await requireActive(database, row);
  if (input.accept !== true) throw new ClientLinkError('LINK_ACCEPT_REQUIRED', 400, 'Marque o aceite dos termos para aprovar.');
  const who = identity(row, input);
  const proposal = await getProposalById(database, row.proposal_id);
  if (!proposal) throw new ClientLinkError('LINK_INVALID', 404, 'Este link não existe.');
  const seen = contentFingerprint(proposal);
  const code = `ACEITE-${row.proposal_number}-REV${String(row.revision).padStart(2, '0')}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const done = await database.transaction(async (tx) => {
    // Fecha o link so se ainda estava ativo: dois cliques nao geram duas aprovacoes.
    const closed = await tx.query("UPDATE proposal_client_links SET status = 'approved', closed_at = now() WHERE id = $1 AND status = 'active' RETURNING id", [row.id]);
    if (!closed.rows[0]) return false;
    await addLinkEvent(tx, row.id, 'approved', {
      name: who.name, role: who.role, code, device: deviceLabel(context.userAgent), ipHash: hashIp(context.ip, context.secret),
      finalValue: seen.finalValue, contentHash: seen.hash,
    });
    return true;
  });
  if (!done) throw new ClientLinkError('LINK_NOT_ACTIVE', 409, 'Este link não aceita mais respostas.');
  void notifyTeam(database, row, 'approved').catch(() => undefined);
  return { code, at: new Date().toISOString() };
};

export const adjustPublicLink = async (database: LocalDatabase, token: string, rawInput: unknown, context: PublicContext) => {
  const input = parseInput(adjustSchema, rawInput);
  const row = await findLink(database, token, context.secret);
  await requireActive(database, row);
  const who = identity(row, input);
  const message = cleanPublicText(input.message ?? '', 1000, true);
  if (message.length < 3) throw new ClientLinkError('LINK_MESSAGE_REQUIRED', 400, 'Escreva o que precisa ser ajustado.');
  // Tudo ou nada: fechar o link, registrar o evento e criar a revisao (em Edicao, em nome de quem gerou o link).
  const revisionId = await database.transaction(async (tx) => {
    const closed = await tx.query("UPDATE proposal_client_links SET status = 'adjust', closed_at = now() WHERE id = $1 AND status = 'active' RETURNING id", [row.id]);
    if (!closed.rows[0]) throw new ClientLinkError('LINK_NOT_ACTIVE', 409, 'Este link não aceita mais respostas.');
    await addLinkEvent(tx, row.id, 'adjust', { name: who.name, role: who.role, message, device: deviceLabel(context.userAgent), ipHash: hashIp(context.ip, context.secret) });
    return createProposalRevisionIn(tx, row.proposal_id, row.created_by ?? '');
  });
  void notifyTeam(database, row, 'adjust').catch(() => undefined);
  return { revisionId };
};
