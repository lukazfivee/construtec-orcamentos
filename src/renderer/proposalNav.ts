/* Visao da secao Propostas: a lista e a tela principal; o editor, o PDF e o comparativo so abrem
   quando o usuario escolhe uma proposta (linha da lista, Abrir, link #proposta=, Nova proposta, Catalogo, Clientes ou Kits). */
export type ProposalViewMode = 'editor' | 'list' | 'pdf' | 'compare';

export const INITIAL_PROPOSAL_VIEW_MODE: ProposalViewMode = 'list';

/* Escolher qualquer item do menu (ou Orcamentos no menu Suite) volta para a visao principal da secao,
   sem restaurar a proposta que estava aberta. A proposta fica carregada na memoria. */
export function viewModeOnSelectNav(): ProposalViewMode {
  return 'list';
}

/* Propostas ainda em trabalho (em edicao ou em revisao): contagem do selo do menu. */
export function countPendingProposals(proposals: ReadonlyArray<{ status: string; isLatest?: boolean }>): number {
  return proposals.filter((item) => item.isLatest !== false && (item.status === 'draft' || item.status === 'review')).length;
}
