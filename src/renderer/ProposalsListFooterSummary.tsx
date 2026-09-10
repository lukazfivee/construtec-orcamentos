import {
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
} from 'lucide-react';
import type { ProposalSummary } from '../shared/contracts';

type ProposalsListFooterSummaryProps = {
  filteredProposals: ProposalSummary[];
  totalCount: number;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProposalsListFooterSummary({
  filteredProposals,
  totalCount,
}: ProposalsListFooterSummaryProps) {
  const filteredCount = filteredProposals.length;
  const totalSale = filteredProposals.reduce((sum, p) => sum + p.totalSale, 0);
  const averageTicket = filteredCount > 0 ? totalSale / filteredCount : 0;

  const approved = filteredProposals.filter((p) => p.status === 'approved');
  const approvedTotal = approved.reduce((sum, p) => sum + p.totalSale, 0);

  const inNegotiation = filteredProposals.filter((p) => ['draft', 'review', 'sent'].includes(p.status));
  const negotiationTotal = inNegotiation.reduce((sum, p) => sum + p.totalSale, 0);

  return (
    <div className="proposals-footer-summary">
      {/* Left: Counter & Filtering Indicator */}
      <div className="summary-left-col">
        <span className="summary-count-badge">
          Exibindo <strong>{filteredCount}</strong> de <strong>{totalCount}</strong> orçamentos
        </span>
        {filteredCount < totalCount && (
          <span className="summary-filter-active-tag">Filtro aplicado</span>
        )}
      </div>

      {/* Center: Pipeline Breakdown Pills */}
      <div className="summary-center-col">
        <div className="summary-pill pill-approved" title="Soma das propostas com status Aprovada">
          <CheckCircle2 size={14} />
          <span>Aprovadas:</span>
          <strong>{approved.length}</strong>
          <small>({money.format(approvedTotal)})</small>
        </div>

        <div className="summary-pill pill-negotiation" title="Soma das propostas em edição, revisão ou enviadas">
          <Clock size={14} />
          <span>Em Negociação:</span>
          <strong>{inNegotiation.length}</strong>
          <small>({money.format(negotiationTotal)})</small>
        </div>
      </div>

      {/* Right: Average Ticket and Grand Total */}
      <div className="summary-right-col">
        <div className="summary-metric" title="Média de valor por orçamento na seleção atual">
          <BarChart3 size={15} />
          <span>Ticket Médio:</span>
          <strong>{money.format(averageTicket)}</strong>
        </div>

        <div className="summary-total-callout" title="Valor monetário total de venda das propostas filtradas">
          <Coins size={16} />
          <span>Total Filtrado:</span>
          <strong>{money.format(totalSale)}</strong>
        </div>
      </div>
    </div>
  );
}
