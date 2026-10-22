import type { CommercialPipelineStage } from '../shared/contracts';
import { pct, plural } from '../shared/formatoBr';
import { TrendingUp, Target, DollarSign } from './icons';

type HomePipelineCardProps = {
  pipeline?: CommercialPipelineStage[];
  conversionRate?: number;
  averageTicketApproved?: number;
  averageTicketNegotiation?: number;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const stageConfig: Record<string, { barColor: string; badgeClass: string }> = {
  draft: { barColor: 'var(--muted)', badgeClass: 'status-draft' },
  review: { barColor: '#0d7f9f', badgeClass: 'status-review' },
  sent: { barColor: '#d97706', badgeClass: 'status-sent' },
  approved: { barColor: '#16a34a', badgeClass: 'status-approved' },
  rejected: { barColor: '#dc2626', badgeClass: 'status-rejected' },
};

export function HomePipelineCard({
  pipeline = [],
  conversionRate = 0,
  averageTicketApproved = 0,
  averageTicketNegotiation = 0,
}: HomePipelineCardProps) {
  const totalPipelineValue = pipeline.reduce((acc, p) => acc + p.totalValue, 0);

  return (
    <div className="home-intelligence-card">
      <div className="home-intelligence-card-header">
        <div className="title-group">
          <TrendingUp size={18} className="text-primary" />
          <h3>Funil comercial</h3>
        </div>
        <div className="conversion-badge" title="Taxa de conversão sobre propostas decididas (Aprovadas / Decididas)">
          <Target size={14} />
          <span>Conversão: <strong>{conversionRate}%</strong></span>
        </div>
      </div>

      <div className="home-pipeline-tickets">
        <div className="ticket-item">
          <DollarSign size={14} className="text-green" />
          <span>Ticket médio aprovado</span>
          <strong>{money.format(averageTicketApproved)}</strong>
        </div>
        <div className="ticket-item">
          <DollarSign size={14} className="text-amber" />
          <span>Ticket médio em negociação</span>
          <strong>{money.format(averageTicketNegotiation)}</strong>
        </div>
      </div>

      <div className="home-pipeline-stages">
        {pipeline.map((stage) => {
          const config = stageConfig[stage.status] || { barColor: 'var(--blue)', badgeClass: '' };
          return (
            <div key={stage.status} className="pipeline-stage-row">
              <div className="stage-meta">
                <span className={`status-tag ${config.badgeClass}`}>{stage.label}</span>
                <span className="stage-count">{plural(stage.count, 'orçamento', 'orçamentos')}</span>
                <span className="stage-pct">{pct(stage.percentage)}</span>
                <strong className="stage-value">{money.format(stage.totalValue)}</strong>
              </div>
              <div className="stage-track">
                <div
                  className="stage-bar"
                  style={{
                    width: `${Math.max(stage.percentage, stage.count > 0 ? 3 : 0)}%`,
                    backgroundColor: config.barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="home-intelligence-footer">
        <small>Total em carteira movimentada: <strong>{money.format(totalPipelineValue)}</strong></small>
      </div>
    </div>
  );
}
