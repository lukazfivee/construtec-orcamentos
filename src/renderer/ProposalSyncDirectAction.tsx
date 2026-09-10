import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';

interface Props {
  proposal: ProposalDetail;
}

export function ProposalSyncDirectAction({ proposal }: Props) {
  const [syncState, setSyncState] = useState<{
    status: 'idle' | 'syncing' | 'success' | 'offline' | 'error';
    message?: string;
    centerUrl?: string;
  }>({ status: 'idle' });

  const handleDirectSync = async () => {
    setSyncState({ status: 'syncing' });
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/direct-sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSyncState({
          status: 'success',
          message: data.message || 'Proposta sincronizada com sucesso no Centro de Custos.',
          centerUrl: data.centerUrl || 'http://localhost:3333/',
        });
      } else if (data.offline) {
        setSyncState({
          status: 'offline',
          message: data.error || 'Centro de Custos não está em execução na porta 3333.',
          centerUrl: 'http://localhost:3000',
        });
      } else {
        setSyncState({
          status: 'error',
          message: data.error || 'Erro na sincronização direta com o Centro de Custos.',
        });
      }
    } catch (err) {
      setSyncState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Falha na comunicação',
      });
    }
  };

  const handleDownloadFallback = async () => {
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/integration-export`, { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao extrair pacote de integração');
      const envelope = await res.json();
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proposal.number}-REV${String(proposal.revision).padStart(2, '0')}.construtec.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro na exportação');
    }
  };

  if (proposal.status !== 'approved') return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <button
        type="button"
        className="primary"
        style={{
          background: syncState.status === 'success' ? '#059669' : '#085ce5',
          borderColor: syncState.status === 'success' ? '#059669' : '#085ce5',
          fontWeight: 600,
        }}
        disabled={syncState.status === 'syncing'}
        title="Sincronizar proposta diretamente com o Centro de Custos via API interna segura"
        onClick={handleDirectSync}
      >
        {syncState.status === 'syncing' ? (
          <><RefreshCw size={18} className="animate-spin" /> Sincronizando...</>
        ) : syncState.status === 'success' ? (
          <><CheckCircle2 size={18} /> Sincronizado com Sucesso</>
        ) : (
          <><Zap size={18} /> Sincronizar com Centro de Custos</>
        )}
      </button>

      {syncState.status === 'success' && (
        <div style={{ padding: '8px 10px', background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.3)', borderRadius: 6, fontSize: '0.8rem', color: '#10b981' }}>
          <div>{syncState.message}</div>
          <button
            type="button"
            className="secondary"
            style={{ marginTop: 6, width: '100%', fontSize: '0.75rem', padding: '4px 8px' }}
            onClick={() => {
              const url = 'http://localhost:3333/';
              if (window.construtec?.openExternal) window.construtec.openExternal(url);
              else window.open(url, '_blank');
            }}
          >
            <ExternalLink size={14} style={{ marginRight: 4 }} /> Ver Obra no Centro de Custos
          </button>
        </div>
      )}

      {syncState.status === 'offline' && (
        <div style={{ padding: '8px 10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, fontSize: '0.8rem', color: '#ef4444' }}>
          <div>{syncState.message}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button
              type="button"
              className="secondary"
              style={{ flex: 1, fontSize: '0.75rem', padding: '4px 6px' }}
              onClick={() => {
                if (window.construtec?.openExternal) window.construtec.openExternal('http://localhost:3000');
                else window.open('http://localhost:3000', '_blank');
              }}
            >
              Abrir Hub (:3000)
            </button>
            <button
              type="button"
              className="secondary"
              style={{ flex: 1, fontSize: '0.75rem', padding: '4px 6px' }}
              onClick={handleDownloadFallback}
              title="Baixar envelope JSON para importação manual"
            >
              <Download size={12} style={{ marginRight: 4 }} /> Baixar JSON
            </button>
          </div>
        </div>
      )}

      {syncState.status === 'error' && (
        <div style={{ padding: '8px 10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, fontSize: '0.8rem', color: '#ef4444' }}>
          <div>{syncState.message}</div>
          <button
            type="button"
            className="secondary"
            style={{ marginTop: 6, width: '100%', fontSize: '0.75rem', padding: '4px 6px' }}
            onClick={handleDownloadFallback}
          >
            <Download size={14} style={{ marginRight: 4 }} /> Baixar contingência JSON
          </button>
        </div>
      )}
    </div>
  );
}
