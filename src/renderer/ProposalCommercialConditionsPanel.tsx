import { useMemo } from 'react';
import type { ProposalDetail } from '../shared/contracts';
import { parseCommercialConditions, type CommercialConditions } from '../documents/proposalDocumentCommon';
import { proposalApi } from './api';
import { ProposalBodyBuilder } from './ProposalBodyBuilder';

type Props = {
  proposal: ProposalDetail;
  editable: boolean;
  mutationPending: boolean;
  onUpdateProposal: (proposal: ProposalDetail) => void;
  onOpenPdf: () => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
  setMutationPending: (pending: boolean) => void;
};

// Aba "Corpo e condições": o corpo montado (blocos) e, dentro do bloco de condições, validade, prazo, pagamento,
// garantia e observações. O antigo campo "Escopo comercial" virou um bloco de texto do corpo (migrado sem perda).
export function ProposalCommercialConditionsPanel({
  proposal,
  editable,
  mutationPending,
  onUpdateProposal,
  onOpenPdf,
  showNotice,
  setError,
  setMutationPending,
}: Props) {
  const commercialConditions = useMemo(() => parseCommercialConditions(proposal.scope ?? ''), [proposal.scope]);

  const updateProposalDetails = async (input: { scope?: string; validUntil?: string | null }) => {
    if (mutationPending) return;
    if (input.scope !== undefined && input.scope === proposal.scope) return;
    if (input.validUntil !== undefined && input.validUntil === proposal.validUntil) return;

    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateDetails(proposal.id, input);
      onUpdateProposal(result.proposal);
      showNotice('Condições atualizadas.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível atualizar as condições.');
    } finally {
      setMutationPending(false);
    }
  };

  const updateCommercialCondition = (field: keyof CommercialConditions, value: string) => {
    const next = { ...parseCommercialConditions(proposal.scope), [field]: value.trim() };
    void updateProposalDetails({ scope: JSON.stringify(next) });
  };

  const off = !editable || mutationPending;
  const conditions = (
    <div className="form-grid conditions-grid">
      <label>Validade da proposta
        <input
          type="date"
          defaultValue={proposal.validUntil ?? ''}
          disabled={off}
          onBlur={(event) => void updateProposalDetails({ validUntil: event.currentTarget.value || null })}
        />
      </label>
      <label>Prazo de execução
        <input
          key={`${proposal.id}-execution-${commercialConditions.executionTerm}`}
          type="text"
          defaultValue={commercialConditions.executionTerm}
          maxLength={160}
          placeholder="Ex.: 15 dias úteis"
          disabled={off}
          onBlur={(event) => updateCommercialCondition('executionTerm', event.currentTarget.value)}
        />
      </label>
      <label className="wide">Forma de pagamento
        <textarea
          key={`${proposal.id}-payment-${commercialConditions.paymentTerms}`}
          defaultValue={commercialConditions.paymentTerms}
          maxLength={240}
          placeholder="Ex.: 40% entrada, 60% na entrega"
          disabled={off}
          onBlur={(event) => updateCommercialCondition('paymentTerms', event.currentTarget.value)}
        />
      </label>
      <label>Garantia
        <input
          key={`${proposal.id}-warranty-${commercialConditions.warranty}`}
          type="text"
          defaultValue={commercialConditions.warranty}
          maxLength={160}
          placeholder="Ex.: 90 dias"
          disabled={off}
          onBlur={(event) => updateCommercialCondition('warranty', event.currentTarget.value)}
        />
      </label>
      <label className="wide">Observações
        <textarea
          key={`${proposal.id}-notes-${commercialConditions.notes}`}
          defaultValue={commercialConditions.notes}
          maxLength={500}
          disabled={off}
          onBlur={(event) => updateCommercialCondition('notes', event.currentTarget.value)}
        />
      </label>
      <p className="dialog-warning">BDI, salários, custos e margens continuam fora do documento do cliente.</p>
    </div>
  );

  return (
    <ProposalBodyBuilder
      key={proposal.id}
      proposal={proposal}
      editable={editable}
      conditionsSlot={conditions}
      onUpdateProposal={onUpdateProposal}
      onPreview={onOpenPdf}
      showNotice={showNotice}
      setError={setError}
    />
  );
}
