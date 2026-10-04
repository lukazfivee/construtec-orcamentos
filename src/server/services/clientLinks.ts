import { randomUUID } from 'node:crypto';
import type { LocalDatabase } from './database';
import { logEvent } from './logger';
import { getLatestProposal } from './proposalCommon';
import { getProposalById, updateProposalStatus } from './proposals';
import { ClientLinkError, contentFingerprint, linkState, signLinkToken, type LinkState, type LinkStatus } from './clientLinkCommon';

// Lado interno (equipe) do link para o cliente: gerar, ver, desativar e confirmar a aprovacao.
export const MAX_LINK_DAYS = 90;

export type LinkRow = {
  id: string; proposal_id: string; status: LinkStatus; require_identity: boolean; expires_at: string; created_at: string; closed_at: string | null;
  created_by: string | null; superseded: boolean; proposal_number: string; revision: number;
};
type EventRow = { kind: string; occurred_at: string; actor_name: string | null; actor_role: string | null; message: string | null; code: string | null; device: string | null };

export const LINK_SELECT = `
  SELECT l.id, l.proposal_id, l.status, l.require_identity, l.expires_at::text, l.created_at::text, l.closed_at::text, l.created_by,
    p.proposal_number, p.revision,
    EXISTS (SELECT 1 FROM proposals n WHERE n.proposal_number = p.proposal_number AND n.revision > p.revision) AS superseded
  FROM proposal_client_links l JOIN proposals p ON p.id = l.proposal_id`;

export const addLinkEvent = (
  db: Pick<LocalDatabase, 'query'>, linkId: string, kind: string,
  extra: { name?: string | null; role?: string | null; message?: string | null; code?: string | null; device?: string | null; ipHash?: string | null; finalValue?: number | null; contentHash?: string | null } = {},
) => db.query(
  'INSERT INTO proposal_client_link_events (id, link_id, kind, actor_name, actor_role, message, code, device, ip_hash, final_value, content_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
  [randomUUID(), linkId, kind, extra.name ?? null, extra.role ?? null, extra.message ?? null, extra.code ?? null, extra.device ?? null, extra.ipHash ?? null, extra.finalValue ?? null, extra.contentHash ?? null],
);

export type ClientLinkView = {
  id: string; token: string; state: LinkState; requireIdentity: boolean; expiresAt: string; createdAt: string;
  views: Array<{ at: string; device: string }>;
  response: { kind: 'approved' | 'adjust'; name: string | null; role: string | null; message: string | null; code: string | null; at: string } | null;
  confirmedAt: string | null;
};

const toView = async (db: Pick<LocalDatabase, 'query'>, row: LinkRow, secret: string): Promise<ClientLinkView> => {
  const events = (await db.query<EventRow>(
    `SELECT * FROM (
       (SELECT kind, occurred_at::text AS occurred_at, actor_name, actor_role, message, code, device FROM proposal_client_link_events
        WHERE link_id = $1 AND kind = 'opened' ORDER BY occurred_at DESC LIMIT 20)
       UNION ALL
       (SELECT kind, occurred_at::text, actor_name, actor_role, message, code, device FROM proposal_client_link_events
        WHERE link_id = $1 AND kind <> 'opened' ORDER BY occurred_at DESC LIMIT 50)
     ) e ORDER BY occurred_at DESC`,
    [row.id],
  )).rows;
  const reply = events.find((event) => event.kind === 'approved' || event.kind === 'adjust');
  return {
    id: row.id, token: signLinkToken(row.id, secret), state: linkState(row), requireIdentity: row.require_identity,
    expiresAt: row.expires_at, createdAt: row.created_at,
    views: events.filter((event) => event.kind === 'opened').slice(0, 20).map((event) => ({ at: event.occurred_at, device: event.device || '' })),
    response: reply ? { kind: reply.kind as 'approved' | 'adjust', name: reply.actor_name, role: reply.actor_role, message: reply.message, code: reply.code, at: reply.occurred_at } : null,
    confirmedAt: events.find((event) => event.kind === 'confirmed')?.occurred_at ?? null,
  };
};

// Link mais recente da proposta (qualquer estado), com aberturas e resposta do cliente.
export const getClientLink = async (database: LocalDatabase, proposalId: string, secret: string): Promise<ClientLinkView | null> => {
  const row = (await database.query<LinkRow>(`${LINK_SELECT} WHERE l.proposal_id = $1 ORDER BY l.created_at DESC LIMIT 1`, [proposalId])).rows[0];
  return row ? toView(database, row, secret) : null;
};

export const createClientLink = async (
  database: LocalDatabase, proposalId: string, input: { days: number; requireIdentity: boolean }, userId: string, secret: string,
): Promise<ClientLinkView> => {
  const days = Math.min(MAX_LINK_DAYS, Math.max(1, Math.round(input.days)));
  const linkId = await database.transaction(async (tx) => {
    const proposal = await getLatestProposal(tx, proposalId);
    if (proposal.status === 'draft') throw new ClientLinkError('LINK_NEEDS_REVIEW', 409, 'Envie a proposta para revisão antes de gerar o link.');
    if (proposal.status !== 'review' && proposal.status !== 'sent') throw new ClientLinkError('LINK_NOT_ALLOWED', 409, 'Esta proposta não pode mais receber um link para o cliente.');
    // Link ativo ja vencido libera a vaga (so um link ativo por proposta); o vencido passa a desativado.
    const lapsed = await tx.query<{ id: string }>(
      "UPDATE proposal_client_links SET status = 'disabled', closed_at = now() WHERE proposal_id = $1 AND status = 'active' AND expires_at <= now() RETURNING id", [proposalId],
    );
    for (const { id: lapsedId } of lapsed.rows) await addLinkEvent(tx, lapsedId, 'disabled', { name: userId, message: 'vencido' });
    const id = randomUUID();
    // Indice unico parcial: duas chamadas ao mesmo tempo nao criam dois links; a segunda devolve o existente.
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO proposal_client_links (id, proposal_id, require_identity, expires_at, created_by) VALUES ($1,$2,$3, now() + ($4 || ' days')::interval, $5)
       ON CONFLICT (proposal_id) WHERE status = 'active' DO NOTHING RETURNING id`,
      [id, proposalId, input.requireIdentity, String(days), userId],
    );
    if (!inserted.rows[0]) {
      const active = (await tx.query<{ id: string }>("SELECT id FROM proposal_client_links WHERE proposal_id = $1 AND status = 'active' LIMIT 1", [proposalId])).rows[0];
      if (active) return active.id;
      throw new ClientLinkError('LINK_BUSY', 409, 'Não foi possível gerar o link agora. Tente de novo.');
    }
    await addLinkEvent(tx, id, 'generated', { name: userId });
    await tx.query(
      "INSERT INTO audit_events (id, entity_type, entity_id, action, after_data, user_id) VALUES ($1,'proposal',$2,'client_link_created',$3::jsonb,$4)",
      [randomUUID(), proposalId, JSON.stringify({ linkId: id, days }), userId],
    );
    return id;
  });
  // Gerar o link conta como envio ao cliente: a proposta passa para Enviada.
  const current = await getProposalById(database, proposalId);
  if (current?.status === 'review') await updateProposalStatus(database, proposalId, 'sent', userId);
  logEvent('info', 'proposal.client_link_created', { proposalId, linkId });
  const view = await getClientLink(database, proposalId, secret);
  if (!view) throw new ClientLinkError('LINK_NOT_FOUND', 404, 'Link não encontrado.');
  return view;
};

export const disableClientLink = async (database: LocalDatabase, proposalId: string, userId: string, secret: string) => {
  const row = (await database.query<LinkRow>(`${LINK_SELECT} WHERE l.proposal_id = $1 AND l.status = 'active' ORDER BY l.created_at DESC LIMIT 1`, [proposalId])).rows[0];
  if (!row) throw new ClientLinkError('LINK_NOT_FOUND', 404, 'Não há link ativo nesta proposta.');
  await database.query("UPDATE proposal_client_links SET status = 'disabled', closed_at = now() WHERE id = $1", [row.id]);
  await addLinkEvent(database, row.id, 'disabled', { name: userId });
  return (await getClientLink(database, proposalId, secret)) as ClientLinkView;
};

// Quem tem p11 confirma a aprovacao registrada pelo cliente: sela a proposta com a evidencia do aceite.
export const confirmClientApproval = async (database: LocalDatabase, proposalId: string, userId: string, secret: string) => {
  const row = (await database.query<LinkRow>(`${LINK_SELECT} WHERE l.proposal_id = $1 AND l.status = 'approved' ORDER BY l.created_at DESC LIMIT 1`, [proposalId])).rows[0];
  if (!row) throw new ClientLinkError('LINK_NO_APPROVAL', 409, 'O cliente ainda não aprovou esta proposta pelo link.');
  const accepted = (await database.query<{ code: string | null; content_hash: string | null; final_value: string | null }>(
    "SELECT code, content_hash, final_value::text FROM proposal_client_link_events WHERE link_id = $1 AND kind = 'approved' ORDER BY occurred_at DESC LIMIT 1", [row.id],
  )).rows[0];
  const code = accepted?.code ?? undefined;
  // O aceite vale para o que o cliente viu: se valor ou itens mudaram depois, a equipe precisa de novo link.
  if (accepted?.content_hash) {
    const current = await getProposalById(database, proposalId);
    const now = current ? contentFingerprint(current) : null;
    if (!now || now.hash !== accepted.content_hash || Math.abs(now.finalValue - Number(accepted.final_value)) > 0.004) {
      throw new ClientLinkError('LINK_CONTENT_CHANGED', 409, 'A proposta foi alterada depois do aceite do cliente (valor ou itens). Gere um novo link para o cliente aprovar de novo.');
    }
  }
  const proposal = await updateProposalStatus(database, proposalId, 'approved', userId, { evidenceKind: 'client_acceptance', evidenceReference: code });
  await database.query("UPDATE proposal_client_links SET status = 'confirmed', closed_at = now() WHERE id = $1", [row.id]);
  await addLinkEvent(database, row.id, 'confirmed', { name: userId, code });
  return { proposal, link: (await getClientLink(database, proposalId, secret)) as ClientLinkView };
};
