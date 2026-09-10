import { Building2, Info } from 'lucide-react';
import type { TopClientMetric } from '../shared/contracts';

type HomeTopClientsCardProps = {
  clients?: TopClientMetric[];
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function HomeTopClientsCard({ clients = [] }: HomeTopClientsCardProps) {
  const maxTotal = clients.length > 0 ? Math.max(...clients.map((c) => c.totalValue)) : 1;

  return (
    <div className="home-intelligence-card">
      <div className="home-intelligence-card-header">
        <div className="title-group">
          <Building2 size={18} className="text-primary" />
          <h3>Principais Clientes & Obras por Volume</h3>
        </div>
        <span className="clients-count-badge">
          {clients.length} {clients.length === 1 ? 'cliente líder' : 'clientes líderes'}
        </span>
      </div>

      {clients.length === 0 ? (
        <div className="intelligence-empty">
          <Info size={16} />
          <span>Nenhum cliente com propostas registradas ainda.</span>
        </div>
      ) : (
        <div className="home-top-clients-list">
          {clients.slice(0, 8).map((client, idx) => {
            const relativePct = maxTotal > 0 ? Math.round((client.totalValue / maxTotal) * 100) : 0;
            const approvedRatio = client.totalValue > 0 ? (client.approvedValue / client.totalValue) * 100 : 0;

            return (
              <div key={`${client.clientName}-${idx}`} className="top-client-row">
                <div className="client-rank">#{idx + 1}</div>
                <div className="client-info">
                  <div className="client-name-line">
                    <strong className="client-name" title={client.clientName}>{client.clientName}</strong>
                    <span className="client-proposals-pill">
                      {client.proposalsCount} {client.proposalsCount === 1 ? 'orçamento' : 'orçamentos'}
                    </span>
                    <strong className="client-total-val">{money.format(client.totalValue)}</strong>
                  </div>

                  <div className="client-split-line">
                    <span className="split-approved">
                      Aprovado: <strong>{money.format(client.approvedValue)}</strong>
                    </span>
                    <span className="split-dot">•</span>
                    <span className="split-negotiation">
                      Em negociação: <strong>{money.format(client.inNegotiationValue)}</strong>
                    </span>
                  </div>

                  <div className="client-bar-track">
                    <div
                      className="client-bar-approved"
                      style={{ width: `${(relativePct * approvedRatio) / 100}%` }}
                      title={`Aprovado: ${money.format(client.approvedValue)}`}
                    />
                    <div
                      className="client-bar-negotiation"
                      style={{ width: `${(relativePct * (100 - approvedRatio)) / 100}%` }}
                      title={`Em negociação: ${money.format(client.inNegotiationValue)}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="home-intelligence-footer">
        <div className="client-footer-legend">
          <span className="legend-item"><span className="dot dot-green" /> Aprovado</span>
          <span className="legend-item"><span className="dot dot-blue" /> Em negociação</span>
        </div>
      </div>
    </div>
  );
}
