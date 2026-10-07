import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { ProposalDetail } from '../../shared/contracts';
import { getProposalFinancials } from '../../shared/proposalFinancials';
import { bodyFingerprintSource } from '../../shared/proposalBody';

// Erro de negocio do link do cliente: o roteador traduz codigo e status sem tocar no tratador global.
export class ClientLinkError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

export type LinkStatus = 'active' | 'disabled' | 'approved' | 'adjust' | 'confirmed';
// Estado visto pelo cliente e pela equipe: alem do status gravado, vencimento e revisao nova.
export type LinkState = 'active' | 'disabled' | 'expired' | 'superseded' | 'approved' | 'adjust' | 'confirmed';

const mac = (id: string, secret: string) => createHmac('sha256', secret).update(`client-link:${id}`).digest('base64url');

// Token = id sem tracos (32) + assinatura (43). Nao e guardado: so deriva do id com a chave do servidor.
export const signLinkToken = (id: string, secret: string) => `${id.replace(/-/g, '')}${mac(id, secret)}`;

export const parseLinkToken = (token: string, secret: string): string | null => {
  const match = /^([0-9a-f]{32})([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return null;
  const hex = match[1];
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const expected = Buffer.from(mac(id, secret));
  const given = Buffer.from(match[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
};

export const hashIp = (ip: string, secret: string) => createHmac('sha256', secret).update(`ip:${ip}`).digest('hex').slice(0, 16);

// Aparelho em poucas palavras ("iPhone · Safari"), so para o historico de aberturas.
export const deviceLabel = (userAgent: string) => {
  const os = /iPhone|iPad/.test(userAgent) ? 'iPhone' : /Android/.test(userAgent) ? 'Android' : /Windows/.test(userAgent) ? 'Windows' : /Mac OS X/.test(userAgent) ? 'Mac' : 'Outro aparelho';
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : /Firefox\//.test(userAgent) ? 'Firefox' : 'navegador';
  return `${os} · ${browser}`;
};

export const linkState = (row: { status: LinkStatus; expires_at: string | Date; superseded: boolean }, now = new Date()): LinkState => {
  if (row.status !== 'active') return row.status;
  if (row.superseded) return 'superseded';
  return new Date(row.expires_at).getTime() <= now.getTime() ? 'expired' : 'active';
};

// Depois de respondido (aprovado, ajuste ou confirmado) o documento fica visivel ao cliente so por este prazo.
export const PUBLIC_DOCUMENT_DAYS = 30;
export const closedWindowOpen = (row: { closed_at: string | null }, now = new Date()) =>
  !row.closed_at || now.getTime() - new Date(row.closed_at).getTime() <= PUBLIC_DOCUMENT_DAYS * 24 * 60 * 60 * 1000;

// Impressao digital do que o cliente viu: valor final, itens de venda e, se a proposta tem corpo montado, os textos
// dos blocos ligados (JSON canonico). Sem corpo montado o hash e o mesmo de sempre. Nunca guarda custo nem BDI.
export const contentFingerprint = (proposal: ProposalDetail) => {
  const finalValue = getProposalFinancials(proposal).finalValue;
  const items = proposal.items.map((item) => [item.code, item.description, item.unit, item.quantity, item.unitSale, item.totalSale]);
  const body = proposal.bodyBlocks ? bodyFingerprintSource(proposal.bodyBlocks) : null;
  const seen = body ? { items, finalValue, body } : { items, finalValue };
  return { finalValue, hash: createHash('sha256').update(JSON.stringify(seen)).digest('hex') };
};

// Texto digitado pelo cliente: sem caracteres de controle e de formatacao (inclui U+202E e zero-width).
export const cleanPublicText = (value: string, max: number, multiline: boolean) =>
  [...value].filter((char) => (multiline && /[\n\t\r]/.test(char)) || !/[\p{Cf}\p{Cc}]/u.test(char)).join('').trim().slice(0, max);
