// Proximo passo da proposta no computador (Rodada 23, telas 23e, 23i): mesmas regras do celular, que seguem o
// prototipo. O servidor confere cada transicao; aqui so se decide o que mostrar e para quem.
import type { ProposalDetail } from '../shared/contracts';

export const FLOW_STEPS = ['Edição', 'Revisão', 'Enviada', 'Aprovada', 'Obra'] as const;
const ORDER: ProposalDetail['status'][] = ['draft', 'review', 'sent', 'approved'];

export type FlowAction = 'to-review' | 'add-items' | 'pdf-send' | 'mark-sent' | 'approve' | 'reject' | 'cost-center' | 'open-cost-center' | 'new-revision';
export type FlowButton = { action: FlowAction; label: string };
export type NextStep = { hint: string; primary?: FlowButton; secondary?: FlowButton };

export type FlowInput = Pick<ProposalDetail, 'status' | 'isLatest' | 'costCenterId'> & { itemCount: number };
export type FlowPermissions = { canEdit: boolean; p10: boolean; p11: boolean };

// Posicao no passo a passo: 0 Edicao ... 4 Aprovada, 5 Obra (so aprovada com Centro de Custo).
export const flowStepIndex = (proposal: Pick<ProposalDetail, 'status' | 'costCenterId'>) =>
  proposal.status === 'approved' ? (proposal.costCenterId ? 5 : 4) : proposal.status === 'rejected' ? 2 : Math.max(0, ORDER.indexOf(proposal.status));

export const nextStep = (proposal: FlowInput, perms: FlowPermissions): NextStep => {
  if (!perms.canEdit) return { hint: 'Seu acesso é só para consulta.' };
  if (!proposal.isLatest) return { hint: 'Esta é uma revisão antiga. Só a revisão atual avança.' };
  const sends = proposal.status === 'review' || proposal.status === 'sent' || (proposal.status === 'approved' && !proposal.costCenterId);
  if (sends && !(perms.p11 && perms.p10)) return { hint: 'Seu papel não permite enviar ou aprovar propostas.' };
  switch (proposal.status) {
    case 'draft':
      return proposal.itemCount > 0
        ? { hint: 'Próximo passo: revisão interna do orçamento', primary: { action: 'to-review', label: 'Enviar para revisão' } }
        : { hint: 'A proposta ainda não tem itens', primary: { action: 'add-items', label: 'Adicionar itens' } };
    case 'review':
      return {
        hint: 'Gere o PDF do cliente e envie. Custo, BDI e margem não aparecem nele.',
        primary: { action: 'pdf-send', label: 'Gerar PDF e enviar' },
        secondary: { action: 'mark-sent', label: 'Só marcar enviada' },
      };
    case 'sent':
      return { hint: 'Resposta do cliente', primary: { action: 'approve', label: 'Registrar aprovação' }, secondary: { action: 'reject', label: 'Recusada' } };
    case 'approved':
      return proposal.costCenterId
        ? { hint: 'Obra em andamento no Centro de Custos', primary: { action: 'open-cost-center', label: 'Abrir obra no Centro de Custos' } }
        : { hint: 'O orçamento aprovado vira a base de orçado × gasto da obra', primary: { action: 'cost-center', label: 'Gerar Centro de Custo' } };
    case 'rejected':
      return { hint: 'Recusada: crie uma revisão para renegociar', primary: { action: 'new-revision', label: 'Criar nova revisão' } };
    default:
      return { hint: '' };
  }
};
