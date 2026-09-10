import { BarChart3, Info } from 'lucide-react';
import type { AbcItem } from '../shared/contracts';

type HomeAbcItemsCardProps = {
  items?: AbcItem[];
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

const abcBadgeConfig: Record<'A' | 'B' | 'C', { label: string; badgeClass: string; desc: string }> = {
  A: { label: 'Classe A', badgeClass: 'abc-badge-a', desc: 'Top 80% do valor total orçado (Itens Críticos)' },
  B: { label: 'Classe B', badgeClass: 'abc-badge-b', desc: 'Próximos 15% do valor total orçado (Intermediários)' },
  C: { label: 'Classe C', badgeClass: 'abc-badge-c', desc: 'Últimos 5% do valor total orçado (Baixo impacto financeiro)' },
};

export function HomeAbcItemsCard({ items = [] }: HomeAbcItemsCardProps) {
  return (
    <div className="home-intelligence-card">
      <div className="home-intelligence-card-header">
        <div className="title-group">
          <BarChart3 size={18} className="text-amber" />
          <h3>Curva ABC — Insumos e Materiais Mais Orçados</h3>
        </div>
        <div className="abc-legend">
          <span className="abc-badge abc-badge-a" title={abcBadgeConfig.A.desc}>A: 80%</span>
          <span className="abc-badge abc-badge-b" title={abcBadgeConfig.B.desc}>B: 15%</span>
          <span className="abc-badge abc-badge-c" title={abcBadgeConfig.C.desc}>C: 5%</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="intelligence-empty">
          <Info size={16} />
          <span>Nenhum item orçado nas propostas vigentes ainda.</span>
        </div>
      ) : (
        <div className="home-abc-table-wrap">
          <table className="home-abc-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>Classe</th>
                <th>Item / Descrição</th>
                <th className="center" style={{ width: '85px' }}>Qtd Total</th>
                <th className="center" style={{ width: '85px' }}>Presença</th>
                <th className="number" style={{ width: '115px' }}>Valor Total</th>
                <th className="center" style={{ width: '75px' }}>Part. Acum.</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 10).map((it, idx) => {
                const badge = abcBadgeConfig[it.abcClass] || abcBadgeConfig.C;
                return (
                  <tr key={`${it.code || it.description}-${idx}`}>
                    <td>
                      <span className={`abc-badge ${badge.badgeClass}`} title={badge.desc}>
                        {it.abcClass}
                      </span>
                    </td>
                    <td>
                      <div className="abc-item-cell">
                        <strong className="abc-item-desc" title={it.description}>{it.description}</strong>
                        <div className="abc-item-sub">
                          {it.code ? <span className="abc-item-code">Cód: {it.code}</span> : null}
                          <span className="abc-item-cat">{it.category || 'Geral'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="center">
                      <span className="abc-qty-val">{decimal.format(it.totalQuantity)}</span>{' '}
                      <small className="abc-qty-unit">{it.unit}</small>
                    </td>
                    <td className="center">
                      <span className="abc-proposals-count">{it.proposalsCount} {it.proposalsCount === 1 ? 'prop.' : 'props.'}</span>
                    </td>
                    <td className="number strong">
                      {money.format(it.totalValue)}
                    </td>
                    <td className="center">
                      <span className="abc-cum-pct">{it.cumulativePercentage}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="home-intelligence-footer">
        <small>Ranking calculado sobre as revisões vigentes de todas as propostas ativas e aprovadas.</small>
      </div>
    </div>
  );
}
