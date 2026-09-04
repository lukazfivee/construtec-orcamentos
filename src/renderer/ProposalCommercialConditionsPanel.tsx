import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { proposalApi } from './api';

export type CommercialConditions = {
  scope: string;
  executionTerm: string;
  paymentTerms: string;
  warranty: string;
  notes: string;
};

export const emptyConditions = (scope = ''): CommercialConditions => ({
  scope: scope.trim(),
  executionTerm: '',
  paymentTerms: '',
  warranty: '',
  notes: '',
});

const fieldFromLines = (lines: string[], names: string[]) => {
  const prefixes = names.map((name) => `${name}:`.toLowerCase());
  const found = lines.find((line) => prefixes.some((prefix) => line.toLowerCase().startsWith(prefix)));
  return found ? found.slice(found.indexOf(':') + 1).trim() : '';
};

export const parseCommercialConditions = (scope: string): CommercialConditions => {
  try {
    const parsed = JSON.parse(scope) as Partial<CommercialConditions>;
    if (parsed && typeof parsed === 'object' && typeof parsed.scope === 'string') {
      return {
        scope: parsed.scope.trim(),
        executionTerm: typeof parsed.executionTerm === 'string' ? parsed.executionTerm.trim() : '',
        paymentTerms: typeof parsed.paymentTerms === 'string' ? parsed.paymentTerms.trim() : '',
        warranty: typeof parsed.warranty === 'string' ? parsed.warranty.trim() : '',
        notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
      };
    }
  } catch {
    const lines = scope.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const lineScope = fieldFromLines(lines, ['escopo', 'scope']);
    if (lineScope) {
      return {
        scope: lineScope,
        executionTerm: fieldFromLines(lines, ['prazo', 'prazo de execução', 'execução']),
        paymentTerms: fieldFromLines(lines, ['pagamento', 'forma de pagamento']),
        warranty: fieldFromLines(lines, ['garantia']),
        notes: fieldFromLines(lines, ['observações', 'observacao', 'observacoes', 'notas']),
      };
    }
  }
  return emptyConditions(scope);
};

export const serializeCommercialConditions = (conditions: CommercialConditions) => JSON.stringify(conditions);

type Props = {
  proposal: ProposalDetail;
  editable: boolean;
  mutationPending: boolean;
  onUpdateProposal: (proposal: ProposalDetail) => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
  setMutationPending: (pending: boolean) => void;
};

export function ProposalCommercialConditionsPanel({
  proposal,
  editable,
  mutationPending,
  onUpdateProposal,
  showNotice,
  setError,
  setMutationPending,
}: Props) {
  const commercialConditions = useMemo(() => parseCommercialConditions(proposal.scope ?? ''), [proposal.scope]);

  const updateProposalDetails = async (input: { scope?: string; validUntil?: string | null }) => {
    if (mutationPending) return;
    const payload = { ...input };
    if (payload.scope !== undefined) {
      payload.scope = payload.scope.trim();
      if (payload.scope.length < 3) {
        showNotice('Informe um escopo válido.');
        return;
      }
      if (payload.scope === proposal.scope) return;
    }
    if (payload.validUntil !== undefined && payload.validUntil === proposal.validUntil) return;

    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateDetails(proposal.id, payload);
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
    if (next.scope.length < 3) {
      showNotice('Informe um escopo válido.');
      return;
    }
    void updateProposalDetails({ scope: serializeCommercialConditions(next) });
  };

  return (
    <div className="history-region">
      <div className="history-heading">
        <div><FileText size={18} /><span><b>Condições comerciais</b><small>Edita o que aparece no PDF/Word do cliente.</small></span></div>
      </div>
      <div className="form-grid" style={{ padding: 20, maxWidth: 960 }}>
        <label>Validade da proposta
          <input
            type="date"
            defaultValue={proposal.validUntil ?? ''}
            disabled={!editable || mutationPending}
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
            disabled={!editable || mutationPending}
            onBlur={(event) => updateCommercialCondition('executionTerm', event.currentTarget.value)}
          />
        </label>
        <label className="wide">Escopo comercial
          <textarea
            key={`${proposal.id}-scope-${commercialConditions.scope}`}
            defaultValue={commercialConditions.scope}
            maxLength={300}
            disabled={!editable || mutationPending}
            style={{ minHeight: 88, resize: 'vertical', padding: 10, border: '1px solid var(--line-strong)', borderRadius: 5 }}
            onBlur={(event) => updateCommercialCondition('scope', event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.currentTarget.value = commercialConditions.scope;
                event.currentTarget.blur();
              }
            }}
          />
        </label>
        <label className="wide">Forma de pagamento
          <textarea
            key={`${proposal.id}-payment-${commercialConditions.paymentTerms}`}
            defaultValue={commercialConditions.paymentTerms}
            maxLength={240}
            placeholder="Ex.: 40% entrada, 60% na entrega"
            disabled={!editable || mutationPending}
            style={{ minHeight: 70, resize: 'vertical', padding: 10, border: '1px solid var(--line-strong)', borderRadius: 5 }}
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
            disabled={!editable || mutationPending}
            onBlur={(event) => updateCommercialCondition('warranty', event.currentTarget.value)}
          />
        </label>
        <label className="wide">Observações
          <textarea
            key={`${proposal.id}-notes-${commercialConditions.notes}`}
            defaultValue={commercialConditions.notes}
            maxLength={500}
            disabled={!editable || mutationPending}
            style={{ minHeight: 82, resize: 'vertical', padding: 10, border: '1px solid var(--line-strong)', borderRadius: 5 }}
            onBlur={(event) => updateCommercialCondition('notes', event.currentTarget.value)}
          />
        </label>
        <p className="dialog-warning">BDI, salários, custos e margens continuam fora do documento do cliente.</p>
      </div>
    </div>
  );
}
