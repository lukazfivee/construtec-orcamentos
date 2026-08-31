import { useEffect, useState } from 'react';
import {
  Box,
  CheckCircle2,
  Database,
  FilePlus2,
  FileText,
  Grid2X2,
  Layers3,
  PackagePlus,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import type { DashboardMetrics, ProposalDetail, ProposalSummary } from '../shared/contracts';
import { dashboardApi } from './api';

type HomeWorkspaceProps = {
  onOpenProposal: (proposalId: string) => void;
  onNewProposal: () => void;
  onNavigate: (section: 'Propostas' | 'Catálogo' | 'Clientes' | 'Kits' | 'Configurações') => void;
  onError: (message: string) => void;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const statusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

const statusClasses: Record<ProposalDetail['status'], string> = {
  draft: 'status-draft',
  review: 'status-review',
  sent: 'status-sent',
  approved: 'status-approved',
  rejected: 'status-rejected',
};

export function HomeWorkspace({
  onOpenProposal,
  onNewProposal,
  onNavigate,
  onError,
}: HomeWorkspaceProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await dashboardApi.get();
      setMetrics(result.summary);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível carregar as métricas do painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <main className="management-workspace home-workspace">
      <header className="management-header">
        <div>
          <Grid2X2 size={25} />
          <span>
            <h1>Início</h1>
            <p>Visão geral de orçamentos, métricas comerciais e atalhos operacionais.</p>
          </span>
        </div>
        <span className="management-header-actions">
          <button type="button" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} /> Atualizar
          </button>
          <button type="button" className="primary" onClick={onNewProposal}>
            <FilePlus2 size={16} /> Nova proposta
          </button>
        </span>
      </header>

      <div className="home-body">
        {/* KPI Cards */}
        <section className="kpi-grid">
          <div className="kpi-card highlight-blue">
            <div className="kpi-icon"><TrendingUp size={22} /></div>
            <div className="kpi-content">
              <span>Em negociação</span>
              <strong>{money.format(metrics?.totalInNegotiation ?? 0)}</strong>
              <small>{metrics?.activeProposalsCount ?? 0} propostas ativas</small>
            </div>
          </div>

          <div className="kpi-card highlight-green">
            <div className="kpi-icon"><CheckCircle2 size={22} /></div>
            <div className="kpi-content">
              <span>Propostas aprovadas</span>
              <strong>{money.format(metrics?.totalApproved ?? 0)}</strong>
              <small>{metrics?.approvedProposalsCount ?? 0} propostas fechadas</small>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon"><Box size={22} /></div>
            <div className="kpi-content">
              <span>Catálogo e kits</span>
              <strong>{metrics?.totalProductsCount ?? 0} itens</strong>
              <small>{metrics?.totalKitsCount ?? 0} kits cadastrados</small>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon"><Users size={22} /></div>
            <div className="kpi-content">
              <span>Clientes cadastrados</span>
              <strong>{metrics?.totalClientsCount ?? 0} empresas</strong>
              <small>Base local de obras e contatos</small>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="quick-actions-bar">
          <span className="quick-actions-title">Ações rápidas:</span>
          <button type="button" onClick={onNewProposal}>
            <FilePlus2 size={15} /> Nova proposta
          </button>
          <button type="button" onClick={() => onNavigate('Kits')}>
            <Layers3 size={15} /> Novo kit / composição
          </button>
          <button type="button" onClick={() => onNavigate('Catálogo')}>
            <PackagePlus size={15} /> Cadastrar item no catálogo
          </button>
          <button type="button" onClick={() => onNavigate('Clientes')}>
            <UserPlus size={15} /> Novo cliente / obra
          </button>
        </section>

        {/* Recent Proposals Table */}
        <section className="home-section-card">
          <div className="home-card-header">
            <div>
              <FileText size={18} />
              <h2>Propostas recentes</h2>
            </div>
            <button type="button" onClick={() => onNavigate('Propostas')}>
              Ver todas as propostas
            </button>
          </div>

          <div className="home-table-container">
            {metrics?.recentProposals && metrics.recentProposals.length > 0 ? (
              <table className="home-proposals-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Cliente / Obra</th>
                    <th>Status</th>
                    <th>Itens</th>
                    <th>Valor total</th>
                    <th>Última alteração</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentProposals.map((prop: ProposalSummary) => (
                    <tr key={prop.id}>
                      <td>
                        <strong>{prop.number}</strong>
                        <span className="rev-badge">REV {String(prop.revision).padStart(2, '0')}</span>
                      </td>
                      <td>
                        <b>{prop.clientName}</b>
                        <small>{prop.workName}</small>
                      </td>
                      <td>
                        <span className={`status-tag ${statusClasses[prop.status] || ''}`}>
                          {statusLabels[prop.status] || prop.status}
                        </span>
                      </td>
                      <td className="center">{prop.itemCount}</td>
                      <td className="number strong">{money.format(prop.totalSale)}</td>
                      <td>{prop.updatedAt ? dateTime.format(new Date(prop.updatedAt)) : '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="open-proposal-btn"
                          onClick={() => onOpenProposal(prop.id)}
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="management-empty">
                {loading ? 'Carregando propostas…' : 'Nenhuma proposta cadastrada ainda.'}
              </p>
            )}
          </div>
        </section>

        {/* System & Storage Status Banner */}
        <footer className="home-system-banner">
          <div className="system-status-indicator">
            <Database size={16} />
            <span>Banco de dados local-first (PGlite) ativo e operacional</span>
          </div>
          <div className="system-status-details">
            <span>Privacidade total: dados comerciais congelados localmente</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
