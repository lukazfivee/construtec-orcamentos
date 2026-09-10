import {
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';

type ProposalsListKpiBarProps = {
  stats: {
    totalCount: number;
    inNegotiation: number;
    approved: number;
  };
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProposalsListKpiBar({ stats }: ProposalsListKpiBarProps) {
  return (
    <section className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      <div className="kpi-card highlight-blue">
        <div className="kpi-icon">
          <FileText size={22} />
        </div>
        <div className="kpi-content">
          <span>Total de Orçamentos</span>
          <strong>{stats.totalCount}</strong>
          <small>Registros no banco local</small>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-icon" style={{ background: '#fffbeb', color: '#b45309' }}>
          <Clock size={22} />
        </div>
        <div className="kpi-content">
          <span>Em Negociação</span>
          <strong>{money.format(stats.inNegotiation)}</strong>
          <small>Edição, revisão ou enviadas</small>
        </div>
      </div>

      <div className="kpi-card highlight-green">
        <div className="kpi-icon">
          <CheckCircle2 size={22} />
        </div>
        <div className="kpi-content">
          <span>Propostas Aprovadas</span>
          <strong>{money.format(stats.approved)}</strong>
          <small>Fechamento confirmado</small>
        </div>
      </div>
    </section>
  );
}
