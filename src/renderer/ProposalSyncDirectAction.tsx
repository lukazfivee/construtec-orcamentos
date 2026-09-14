import { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { proposalApi } from './api';

interface Props {
  proposal: ProposalDetail;
  onProposalUpdate?: (proposal: ProposalDetail) => void;
  onNavigateToCentroCustos?: (costCenterId?: number) => void;
  showNotice?: (message: string) => void;
  disabled?: boolean;
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProposalSyncDirectAction({
  proposal,
  onProposalUpdate,
  onNavigateToCentroCustos,
  showNotice,
  disabled = false,
}: Props) {
  const [syncState, setSyncState] = useState<{
    status: 'idle' | 'syncing' | 'success' | 'offline' | 'error';
    message?: string;
    costCenterId?: number;
    contractId?: string;
    centerUrl?: string;
  }>({ status: 'idle' });

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const executeSync = async (targetProposalId = proposal.id) => {
    setSyncState({ status: 'syncing' });
    try {
      const res = await proposalApi.directSync(targetProposalId);
      if (res.ok) {
        setSyncState({
          status: 'success',
          message: res.message || 'Centro de Custo gerado com sucesso no Centro de Custos v3.',
          costCenterId: res.costCenterId,
          contractId: res.contractId,
          centerUrl: res.centerUrl || 'http://localhost:3333/',
        });
        showNotice?.(res.message || 'Centro de Custo gerado com sucesso!');
      } else if (res.offline) {
        setSyncState({
          status: 'offline',
          message: res.error || 'O Centro de Custos não está em execução na porta 3333.',
          centerUrl: 'http://localhost:3000',
        });
      } else {
        setSyncState({
          status: 'error',
          message: res.error || 'Erro ao gerar Centro de Custo.',
        });
      }
    } catch (err) {
      setSyncState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Falha na comunicação direta.',
      });
    }
  };

  const handleButtonClick = () => {
    if (proposal.status !== 'approved') {
      setConfirmModalOpen(true);
    } else {
      void executeSync();
    }
  };

  const handleConfirmApprovalAndSync = async () => {
    setSubmitting(true);
    try {
      const updated = await proposalApi.updateStatus(proposal.id, 'approved');
      if (updated?.proposal) {
        onProposalUpdate?.(updated.proposal);
      }
      setConfirmModalOpen(false);
      await executeSync(proposal.id);
    } catch (err) {
      setSyncState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível aprovar o orçamento.',
      });
      setConfirmModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCenter = () => {
    const url = syncState.centerUrl || 'http://localhost:3333/';
    if (window.construtec?.openExternal) {
      void window.construtec.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener');
    }
  };

  const handleOpenHub = () => {
    const url = 'http://localhost:3000';
    if (window.construtec?.openExternal) {
      void window.construtec.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener');
    }
  };

  const handleDownloadFallback = async () => {
    try {
      const envelope = await proposalApi.integrationExport(proposal.id);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proposal.number}-REV${String(proposal.revision).padStart(2, '0')}.construtec.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro na exportação de contingência');
    }
  };

  const isSyncing = syncState.status === 'syncing' || submitting;
  const isSuccess = syncState.status === 'success';

  return (
    <div style={{ width: '100%' }}>
      <button
        type="button"
        className={`btn-gerar-centro ${isSuccess ? 'success' : ''}`}
        disabled={isSyncing || disabled}
        onClick={handleButtonClick}
        title="Aprovar proposta e gerar o Centro de Custo no aplicativo de gestão de obras (Etapa 02)"
      >
        {isSyncing ? (
          <><RefreshCw size={17} className="spinning" /> <span>Gerando Centro de Custo...</span></>
        ) : isSuccess ? (
          <><CheckCircle2 size={17} /> <span>Centro de Custo Ativo</span></>
        ) : (
          <><Building2 size={17} /> <span>Gerar Centro de Custo</span></>
        )}
      </button>

      {isSuccess && (
        <div className="gerar-centro-feedback success">
          <div className="gerar-centro-feedback-header">
            <CheckCircle2 size={15} color="#059669" />
            <span>Centro de Custo Ativo {syncState.costCenterId ? `• Obra #${syncState.costCenterId}` : ''}</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem' }}>{syncState.message}</p>
          <div className="gerar-centro-actions-row">
            {onNavigateToCentroCustos && (
              <button
                type="button"
                className="gerar-centro-btn-secondary"
                style={{ background: 'rgba(4, 120, 87, 0.15)', borderColor: 'rgba(4, 120, 87, 0.4)', color: '#047857', fontWeight: 650 }}
                onClick={() => onNavigateToCentroCustos(syncState.costCenterId)}
                title="Acessar o Centro de Custos da obra nesta mesma janela"
              >
                <Building2 size={13} /> Visualizar Obra Integrada
              </button>
            )}
            <button type="button" className="gerar-centro-btn-secondary" onClick={handleOpenCenter} title="Abrir em outra janela (dual monitor)">
              <ExternalLink size={13} /> Janela externa
            </button>
          </div>
        </div>
      )}

      {syncState.status === 'offline' && (
        <div className="gerar-centro-feedback offline">
          <div className="gerar-centro-feedback-header">
            <AlertTriangle size={15} color="#dc2626" />
            <span>Centro de Custos Desconectado</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem' }}>{syncState.message}</p>
          <div className="gerar-centro-actions-row">
            <button type="button" className="gerar-centro-btn-secondary" onClick={handleOpenHub}>
              <ExternalLink size={13} /> Abrir Hub (:3000)
            </button>
            <button type="button" className="gerar-centro-btn-secondary" onClick={handleDownloadFallback} title="Baixar contingência JSON">
              <Download size={13} /> Baixar JSON
            </button>
            <button type="button" className="gerar-centro-btn-secondary" onClick={() => void executeSync()} title="Tentar reconectar">
              <RefreshCw size={13} /> Repetir
            </button>
          </div>
        </div>
      )}

      {syncState.status === 'error' && (
        <div className="gerar-centro-feedback error">
          <div className="gerar-centro-feedback-header">
            <AlertTriangle size={15} color="#dc2626" />
            <span>Falha na Integração</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem' }}>{syncState.message}</p>
          <div className="gerar-centro-actions-row">
            <button type="button" className="gerar-centro-btn-secondary" onClick={handleDownloadFallback}>
              <Download size={13} /> Baixar contingência JSON
            </button>
            <button type="button" className="gerar-centro-btn-secondary" onClick={() => void executeSync()}>
              <RefreshCw size={13} /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {confirmModalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setConfirmModalOpen(false);
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-gerar-centro-title" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={24} color="#047857" />
                <div>
                  <h3 id="modal-gerar-centro-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Gerar Centro de Custo</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Etapa 02 da Esteira Construtec · Gestão da Obra</p>
                </div>
              </div>
              <button
                type="button"
                className="dialog-close"
                aria-label="Fechar"
                disabled={submitting}
                onClick={() => setConfirmModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
              <p style={{ margin: 0 }}>
                Ao gerar o centro de custo, a proposta <strong>{proposal.number}</strong> (Revisão {String(proposal.revision).padStart(2, '0')}) será formalmente aprovada e transferida para a esteira de execução da obra.
              </p>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem' }}>
                  <div><span style={{ color: '#64748b' }}>Obra:</span> <strong>{proposal.workName}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Cliente:</span> <strong>{proposal.clientName || 'Cliente comercial'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Itens:</span> <strong>{proposal.items.length} itens</strong></div>
                  <div><span style={{ color: '#64748b' }}>Mão de obra:</span> <strong>{proposal.laborItems?.length ?? 0} funções</strong></div>
                  <div style={{ gridColumn: 'span 2', paddingTop: '4px', borderTop: '1px dashed #cbd5e1' }}>
                    <span style={{ color: '#64748b' }}>Valor Total Aprovado:</span> <strong style={{ color: '#0f766e', fontSize: '0.95rem' }}>{money.format(proposal.totals.finalValue ?? proposal.totals.sale)}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '0.8rem', color: '#166534' }}>
                <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  A proposta receberá o <strong>Selo Canônico RFC 8785 (SHA-256)</strong> e seus dados se tornarão a baseline contratual imutável no Centro de Custos.
                </span>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="secondary-btn"
                disabled={submitting}
                onClick={() => setConfirmModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-gerar-centro"
                style={{ width: 'auto', padding: '8px 16px', margin: 0 }}
                disabled={submitting}
                onClick={() => void handleConfirmApprovalAndSync()}
              >
                {submitting ? (
                  <><RefreshCw size={15} className="spinning" /> Aprovando e Gerando...</>
                ) : (
                  <><CheckCircle2 size={15} /> Aprovar e Gerar Centro de Custo</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
