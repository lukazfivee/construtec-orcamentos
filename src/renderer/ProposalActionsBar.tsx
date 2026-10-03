import { useEffect, useState } from 'react';
import { ArrowLeftRight, Building2, Check, Copy, ExternalLink, FileText, Loader2, Plus, Send } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { proposalApi } from './api';
import { FLOW_STEPS, flowStepIndex, nextStep, type FlowAction } from './proposalFlow';
import { useCanEdit, useSuitePermission } from './SuitePermissions';

const statusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição', review: 'Em revisão', sent: 'Enviada', approved: 'Aprovada', rejected: 'Recusada',
};
const statusClasses: Record<ProposalDetail['status'], string> = {
  draft: 'status-draft', review: 'status-review', sent: 'status-sent', approved: 'status-approved', rejected: 'status-rejected',
};

type Confirm = { title: string; text: string; ok: string; run: () => Promise<void> };

type Props = {
  proposal: ProposalDetail;
  mutationPending: boolean;
  setMutationPending: (pending: boolean) => void;
  onOpenPdf: () => void;
  onOpenCompare: () => void;
  onProposalUpdate: (proposal: ProposalDetail) => void;
  onProposalTabsReload: () => void;
  onAddItems: () => void;
  onCreateRevision: () => void;
  onNavigateToCentroCustos?: (costCenterId?: number) => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
};

// Cabecalho da proposta (Rodada 23, telas 23e e 23i): PDF, Comparar revisoes e o proximo passo da situacao.
export function ProposalActionsBar({
  proposal,
  mutationPending,
  setMutationPending,
  onOpenPdf,
  onOpenCompare,
  onProposalUpdate,
  onProposalTabsReload,
  onAddItems,
  onCreateRevision,
  onNavigateToCentroCustos,
  showNotice,
  setError,
}: Props) {
  const canEdit = useCanEdit();
  const p10 = useSuitePermission('p10');
  const p11 = useSuitePermission('p11');
  const [revisionCount, setRevisionCount] = useState(1);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    void proposalApi.history(proposal.id)
      .then((result) => { if (active) setRevisionCount(result.revisions.length); })
      .catch(() => { if (active) setRevisionCount(1); });
    return () => { active = false; };
  }, [proposal.id, proposal.updatedAt]);

  const step = nextStep(
    { status: proposal.status, isLatest: proposal.isLatest, costCenterId: proposal.costCenterId, itemCount: proposal.items.length },
    { canEdit, p10, p11 },
  );
  const stepIndex = flowStepIndex(proposal);
  const hasContent = proposal.items.length > 0 || (proposal.laborItems ?? []).length > 0;

  const setStatus = async (status: ProposalDetail['status'], message: string) => {
    const result = await proposalApi.updateStatus(proposal.id, status);
    onProposalUpdate(result.proposal);
    onProposalTabsReload();
    showNotice(message);
  };

  const generateCostCenter = async () => {
    const result = await proposalApi.directSync(proposal.id);
    if (!result.ok) throw new Error(result.error || result.message || 'Não foi possível gerar agora.');
    const refreshed = await proposalApi.byId(proposal.id);
    onProposalUpdate(refreshed.proposal);
    showNotice(result.status === 'already_imported' ? 'A obra já existia no Centro de Custos.' : 'Centro de Custo criado com este orçamento como base.');
  };

  const run = async (task: () => Promise<void>) => {
    if (mutationPending) return;
    setMutationPending(true);
    setError('');
    try { await task(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível concluir agora.'); }
    finally { setMutationPending(false); }
  };

  const perform = (action: FlowAction) => {
    switch (action) {
      case 'to-review': return void run(() => setStatus('review', `${proposal.number} enviada para revisão interna.`));
      case 'add-items': return onAddItems();
      case 'pdf-send': return onOpenPdf();
      case 'mark-sent':
        return setConfirm({ title: 'Marcar como enviada', text: 'Use quando o PDF já foi mandado ao cliente por outro caminho. A proposta passa a Enviada.', ok: 'Marcar enviada', run: () => setStatus('sent', 'Proposta marcada como enviada.') });
      case 'approve':
        return setConfirm({ title: 'Registrar aprovação', text: 'A proposta aprovada fica travada e vira a base de orçado da obra. Não dá para desfazer.', ok: 'Aprovar', run: () => setStatus('approved', 'Proposta aprovada pelo cliente.') });
      case 'reject':
        return setConfirm({ title: 'Marcar como recusada', text: 'Depois você pode criar uma nova revisão para renegociar.', ok: 'Marcar recusada', run: () => setStatus('rejected', 'Proposta marcada como recusada.') });
      case 'cost-center':
        return setConfirm({ title: 'Gerar Centro de Custo', text: 'Cria a obra no Centro de Custos com este orçamento como base.', ok: 'Gerar', run: generateCostCenter });
      case 'open-cost-center': return onNavigateToCentroCustos?.(proposal.costCenterId);
      case 'new-revision': return onCreateRevision();
    }
  };

  const icons: Record<FlowAction, typeof Check> = {
    'to-review': Send, 'add-items': Plus, 'pdf-send': FileText, 'mark-sent': Send, approve: Check, reject: Copy,
    'cost-center': Building2, 'open-cost-center': ExternalLink, 'new-revision': Copy,
  };
  const { primary, secondary } = step;
  const Primary = primary ? icons[primary.action] : null;

  return (
    <section className="proposal-flow" aria-label="Situação e próximos passos da proposta">
      <div className="proposal-flow-top">
        <div className="proposal-flow-title">
          <div>
            <h1>{proposal.number}</h1>
            <span className="proposal-flow-rev">REV {String(proposal.revision).padStart(2, '0')}</span>
            <span className={`proposal-flow-status ${statusClasses[proposal.status]}`}>{statusLabels[proposal.status]}</span>
          </div>
          <p>{proposal.workName || '—'} · {proposal.clientName}</p>
        </div>
        <div className="proposal-flow-actions">
          <button type="button" className="flow-btn" onClick={onOpenPdf} disabled={!hasContent} title={hasContent ? 'Pré-visualizar, baixar, compartilhar ou enviar o PDF' : 'Adicione itens para gerar o PDF'}>
            <FileText size={16} /> PDF
          </button>
          {revisionCount > 1 && (
            <button type="button" className="flow-btn" onClick={onOpenCompare}>
              <ArrowLeftRight size={16} /> Comparar revisões
            </button>
          )}
          {secondary && (
            <button type="button" className="flow-btn" disabled={mutationPending} onClick={() => perform(secondary.action)}>
              {secondary.label}
            </button>
          )}
          {primary && Primary && (
            <button type="button" className="flow-btn primary" disabled={mutationPending} onClick={() => perform(primary.action)}>
              {mutationPending ? <Loader2 size={16} className="spinning" /> : <Primary size={16} />} {primary.label}
            </button>
          )}
        </div>
      </div>
      <div className="proposal-flow-bottom">
        <ol className="proposal-steps" aria-label="Andamento da proposta">
          {FLOW_STEPS.map((label, index) => (
            <li key={label} className={index < stepIndex ? 'done' : index === stepIndex ? 'current' : ''} aria-current={index === stepIndex ? 'step' : undefined}>
              <i>{index < stepIndex ? <Check size={11} /> : index + 1}</i>{label}
            </li>
          ))}
        </ol>
        {step.hint && <p className="proposal-flow-hint">{step.hint}</p>}
      </div>

      {confirm && (
        <div className="dialog-backdrop" role="presentation">
          <div className="flow-confirm" role="alertdialog" aria-modal="true" aria-label={confirm.title}>
            <h2>{confirm.title}</h2>
            <p>{confirm.text}</p>
            <footer>
              <button type="button" className="flow-btn" disabled={confirming} onClick={() => setConfirm(null)}>Cancelar</button>
              <button
                type="button"
                className="flow-btn primary"
                disabled={confirming}
                onClick={() => {
                  setConfirming(true);
                  void run(confirm.run).finally(() => { setConfirming(false); setConfirm(null); });
                }}
              >
                {confirming && <Loader2 size={16} className="spinning" />} {confirm.ok}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
