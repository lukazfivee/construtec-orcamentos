import { useEffect, useState } from 'react';
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
import { getCentroCustosUrl, proposalApi } from './api';

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

  useEffect(() => {
    if (proposal.costCenterId) {
      setSyncState({
        status: 'success',
        costCenterId: proposal.costCenterId,
        contractId: proposal.contractId,
        centerUrl: proposal.centroCustosUrl,
        message: 'Esta revisão já está integrada ao Centro de Custos.',
      });
    } else {
      setSyncState({ status: 'idle' });
    }
  }, [proposal.id, proposal.costCenterId, proposal.contractId, proposal.centroCustosUrl]);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [centroUrl, setCentroUrl] = useState('http://localhost:3333');

  useEffect(() => {
    void getCentroCustosUrl().then(setCentroUrl);
  }, []);

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
          centerUrl: res.centerUrl || centroUrl,
        });
        showNotice?.(res.message || 'Centro de Custo gerado com sucesso!');
      } else if (res.offline) {
        setSyncState({
          status: 'offline',
          message: res.error || `O Centro de Custos não está acessível em ${centroUrl}.`,
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
    if (syncState.status === 'success') {
      handleGoToCenter();
    } else if (proposal.status !== 'approved') {
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

  const centerDeepLinkUrl = () => {
    const base = syncState.centerUrl || centroUrl;
    return syncState.costCenterId ? `${base.replace(/\/$/, '')}/#obra=${syncState.costCenterId}` : base;
  };

  // Acao principal: sem iframe, navega a mesma janela direto pro Centro de
  // Custos (no desktop Electron, abre no navegador do sistema -- nao ha
  // "mesma janela" fora do shell do app la).
  const handleGoToCenter = () => {
    const url = centerDeepLinkUrl();
    if (window.construtec?.openExternal) {
      void window.construtec.openExternal(url);
    } else {
      window.location.assign(url);
    }
  };

  // "Janela externa": sempre abre em outra aba/janela (uso dual monitor),
  // mesmo quando a acao principal ja navega na mesma janela.
  const handleOpenCenter = () => {
    const url = centerDeepLinkUrl();
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
        title={isSuccess ? 'Ir para o Centro de Custo desta obra' : 'Aprovar proposta e gerar o Centro de Custo no aplicativo de gestão de obras (Etapa 02)'}
      >
        {isSyncing ? (
          <><RefreshCw size={17} className="spinning" /> <span>Gerando Centro de Custo...</span></>
        ) : isSuccess ? (
          <><CheckCircle2 size={17} /> <span>Ir para Centro de Custo</span></>
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
          <div className="modal-card gerar-centro-modal" role="dialog" aria-modal="true" aria-labelledby="modal-gerar-centro-title">
            <div className="modal-header">
              <Building2 size={22} color="var(--status-approved-text)" />
              <div>
                <h3 id="modal-gerar-centro-title">Gerar Centro de Custo</h3>
                <p>Aprova a proposta e cria a obra no Centro de Custos</p>
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

            <div className="modal-body gerar-centro-modal-body">
              <p>
                A proposta <strong>{proposal.number}</strong> (Revisão {String(proposal.revision).padStart(2, '0')}) será aprovada e a obra correspondente será criada no Centro de Custos.
              </p>

              <div className="gerar-centro-summary">
                <div><span>Obra</span><strong>{proposal.workName}</strong></div>
                <div><span>Cliente</span><strong>{proposal.clientName || 'Cliente comercial'}</strong></div>
                <div><span>Itens</span><strong>{proposal.items.length}</strong></div>
                <div><span>Mão de obra</span><strong>{proposal.laborItems?.length ?? 0} {(proposal.laborItems?.length ?? 0) === 1 ? 'função' : 'funções'}</strong></div>
                <div className="gerar-centro-summary-total"><span>Valor aprovado</span><strong>{money.format(proposal.totals.finalValue ?? proposal.totals.sale)}</strong></div>
              </div>

              <div className="gerar-centro-notice">
                <ShieldCheck size={17} />
                <span>Depois de aprovada, os valores desta revisão ficam travados — essa passa a ser a versão oficial do contrato.</span>
              </div>
            </div>

            <div className="modal-footer">
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
                className="btn-gerar-centro gerar-centro-modal-confirm"
                disabled={submitting}
                onClick={() => void handleConfirmApprovalAndSync()}
              >
                {submitting ? (
                  <><RefreshCw size={15} className="spinning" /> Aprovando…</>
                ) : (
                  <><CheckCircle2 size={15} /> Aprovar e gerar Centro de Custo</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
