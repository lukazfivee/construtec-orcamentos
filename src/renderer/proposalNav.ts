/* Visao da secao Propostas: a lista e a tela principal; o editor, o PDF e o comparativo so abrem
   quando o usuario escolhe uma proposta (linha da lista, Abrir, link #proposta=, Nova proposta, Catalogo, Clientes ou Kits). */
export type ProposalViewMode = 'editor' | 'list' | 'pdf' | 'compare';

export const INITIAL_PROPOSAL_VIEW_MODE: ProposalViewMode = 'list';

/* Escolher qualquer item do menu (ou Orcamentos no menu Suite) volta para a visao principal da secao,
   sem restaurar a proposta que estava aberta. A proposta fica carregada na memoria. */
export function viewModeOnSelectNav(): ProposalViewMode {
  return 'list';
}

/* Propostas que precisam de acao: a mesma regra do "N propostas precisam de acao" do Inicio do celular (public/m/screen-home.js):
   aprovada sem Centro de Custo, enviada com validade em ate 7 dias (ou vencida), em revisao e em edicao. So a revisao atual conta. */
export type ProposalAttention = { total: number; approved: number; expiring: number; review: number; draft: number };
type AttentionInput = { status: string; isLatest?: boolean; syncStatus?: string | null; validUntil?: string | null };

function daysUntil(iso: string | null | undefined, today: Date): number | null {
  if (!iso) return null;
  const end = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function proposalsNeedingAction(proposals: ReadonlyArray<AttentionInput>, today: Date = new Date()): ProposalAttention {
  const out: ProposalAttention = { total: 0, approved: 0, expiring: 0, review: 0, draft: 0 };
  for (const item of proposals) {
    if (item.isLatest === false) continue;
    if (item.status === 'approved' && item.syncStatus !== 'delivered') out.approved += 1;
    else if (item.status === 'sent') { const days = daysUntil(item.validUntil, today); if (days !== null && days <= 7) out.expiring += 1; }
    else if (item.status === 'review') out.review += 1;
    else if (item.status === 'draft') out.draft += 1;
  }
  out.total = out.approved + out.expiring + out.review + out.draft;
  return out;
}

/* Texto do selo (title): quantas precisam de acao e por que. */
export function attentionTitle(a: ProposalAttention): string {
  const parts: string[] = [];
  if (a.approved) parts.push(`${a.approved} aprovada${a.approved > 1 ? 's' : ''} sem Centro de Custo`);
  if (a.expiring) parts.push(`${a.expiring} com a validade perto do fim`);
  if (a.review) parts.push(`${a.review} aguardando revisão`);
  if (a.draft) parts.push(`${a.draft} em edição`);
  return `${a.total} ${a.total > 1 ? 'propostas precisam' : 'proposta precisa'} de ação: ${parts.join(', ')}`;
}
