import { useEffect, useState } from 'react';
import { AlertTriangle, Activity, RefreshCw } from 'lucide-react';
import type { CenterTracking } from '../shared/contracts';
import { useSuitePermission } from './SuitePermissions';
import { proposalApi } from './api';

// Acompanhamento da obra no Centro de Custos para a proposta integrada.
// Somente leitura: a fonte da verdade e o Centro.

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const cents = (value?: number) => money.format((value ?? 0) / 100);
const statusLabel: Record<string, string> = {
  planejamento: 'Planejamento',
  execucao: 'Em execução',
  pausado: 'Pausada',
  concluido: 'Concluída',
};

const formatDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
};

export function CenterTrackingCard({ proposalId }: { proposalId: string }) {
  const canSeeCost = useSuitePermission('p10');
  const [tracking, setTracking] = useState<CenterTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setTracking(await proposalApi.centerTracking(proposalId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o acompanhamento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [proposalId]);

  if (!canSeeCost) return null;
  if (loading && !tracking) return <div className="gerar-centro-feedback" aria-busy="true"><RefreshCw size={13} className="spinning" /> Carregando acompanhamento da obra…</div>;
  if (error) return <div className="gerar-centro-feedback error" role="alert">{error}</div>;
  if (!tracking?.integrated) return null;

  const summary = tracking.summary;
  return (
    <section className="gerar-centro-feedback" aria-label="Acompanhamento da obra" style={{ marginTop: '8px' }}>
      <div className="gerar-centro-feedback-header" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={15} color="#0a6b86" /> Acompanhamento da obra</span>
        <button type="button" className="gerar-centro-btn-secondary" onClick={() => void load()} disabled={loading} title="Atualizar com o Centro de Custos">
          <RefreshCw size={12} className={loading ? 'spinning' : undefined} /> Atualizar
        </button>
      </div>
      {!summary && <p style={{ margin: 0, fontSize: '0.78rem' }}>Sem dados do Centro de Custos ainda. Tente atualizar com conexão.</p>}
      {summary && !summary.hasBudget && <p style={{ margin: 0, fontSize: '0.78rem' }}>Obra {statusLabel[summary.costCenterStatus] ?? summary.costCenterStatus}, sem baseline vigente no Centro de Custos.</p>}
      {summary?.hasBudget && summary.baseline && (
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px 12px', margin: '4px 0 0', fontSize: '0.78rem' }}>
          <div><dt>Situação</dt><dd style={{ margin: 0 }}><strong>{statusLabel[summary.costCenterStatus] ?? summary.costCenterStatus}</strong></dd></div>
          <div><dt>Contrato (baseline v{summary.baseline.version})</dt><dd style={{ margin: 0 }}>{cents(summary.baseline.contractValueCents)}</dd></div>
          <div><dt>Custo orçado</dt><dd style={{ margin: 0 }}>{cents(summary.baseline.baseCostCents)}</dd></div>
          <div><dt>Realizado</dt><dd style={{ margin: 0 }}><strong>{cents(summary.realizedCents)}</strong> ({(summary.realizedPercent ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</dd></div>
          <div><dt>Saldo</dt><dd style={{ margin: 0 }}>{cents(summary.balanceCents)}</dd></div>
        </dl>
      )}
      {summary?.overBudget && <p role="alert" style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#b42318', display: 'flex', gap: '6px', alignItems: 'center' }}><AlertTriangle size={13} /> O realizado passou do custo orçado.</p>}
      {Boolean(summary?.unlinkedExpenseCents) && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#8a5a00' }}>{cents(summary?.unlinkedExpenseCents)} em gastos ainda não vinculados a insumos do orçamento.</p>}
      {tracking.fetchedAt && <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: '#5d7480' }}>{tracking.stale ? `Sem conexão com o Centro de Custos. Dados de ${formatDate(tracking.fetchedAt)}.` : `Atualizado em ${formatDate(tracking.fetchedAt)}.`}</p>}
    </section>
  );
}
