import { CheckCircle2 } from 'lucide-react';
import type { ProposalItemDiff, ProposalLaborDiff, DiffStatus } from './proposalDiffHelpers';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const statusBadgeLabel: Record<DiffStatus, string> = {
  added: 'Adicionado',
  removed: 'Removido',
  changed: 'Alterado',
  unchanged: 'Sem alteração',
};

interface Props {
  activeTab: 'items' | 'labor';
  filteredItems: ProposalItemDiff[];
  laborDiffData: ProposalLaborDiff[];
}

export function ProposalDiffTables({ activeTab, filteredItems, laborDiffData }: Props) {
  if (activeTab === 'labor') {
    return (
      <div className="diff-table-container">
        <table className="diff-table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Status</th>
              <th>Função / Cargo</th>
              <th style={{ width: 130 }}>Profissionais</th>
              <th style={{ width: 130 }}>Horas por profissional</th>
              <th style={{ width: 130 }}>Taxa Horária</th>
              <th style={{ width: 150 }} className="text-right">Custo Total (Rev B)</th>
              <th style={{ width: 130 }} className="text-right">Variação (Δ)</th>
            </tr>
          </thead>
          <tbody>
            {laborDiffData.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-diff-row">
                  Nenhum registro de mão de obra cadastrado nas revisões selecionadas.
                </td>
              </tr>
            ) : (
              laborDiffData.map((lb) => (
                <tr key={lb.description} className={`row-${lb.status}`}>
                  <td><span className={`diff-badge badge-${lb.status}`}>{statusBadgeLabel[lb.status]}</span></td>
                  <td className="item-desc-cell">{lb.description}</td>
                  <td>{lb.countA ?? 0} → <b>{lb.countB ?? 0}</b></td>
                  <td>{lb.hoursA ?? 0}h → <b>{lb.hoursB ?? 0}h</b></td>
                  <td>{money.format(lb.rateB || lb.rateA || 0)}/h</td>
                  <td className="text-right font-medium">{lb.costB !== null ? money.format(lb.costB) : '—'}</td>
                  <td className={`text-right ${lb.deltaCost > 0 ? 'delta-pos' : lb.deltaCost < 0 ? 'delta-neg' : 'delta-zero'}`}>
                    {lb.deltaCost !== 0 && (lb.deltaCost > 0 ? '+' : '')}
                    {money.format(lb.deltaCost)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="diff-table-container">
      <table className="diff-table">
        <thead>
          <tr>
            <th style={{ width: 110 }}>Status</th>
            <th style={{ width: 90 }}>Código</th>
            <th>Descrição do Item</th>
            <th style={{ width: 140 }}>Quantidade</th>
            <th style={{ width: 140 }}>Preço Unit. Venda</th>
            <th style={{ width: 150 }} className="text-right">Total Venda (Rev B)</th>
            <th style={{ width: 130 }} className="text-right">Variação (Δ)</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.length === 0 ? (
            <tr>
              <td colSpan={7} className="empty-diff-row">
                <CheckCircle2 size={16} /> Nenhuma alteração encontrada para os filtros selecionados.
              </td>
            </tr>
          ) : (
            filteredItems.map((item) => (
              <tr key={item.key} className={`row-${item.status}`}>
                <td><span className={`diff-badge badge-${item.status}`}>{statusBadgeLabel[item.status]}</span></td>
                <td><code>{item.code || '—'}</code></td>
                <td className="item-desc-cell">{item.description}</td>
                <td>
                  {item.status === 'added' ? (
                    <span><b>{item.qtyB}</b> {item.unit}</span>
                  ) : item.status === 'removed' ? (
                    <del>{item.qtyA} {item.unit}</del>
                  ) : item.qtyA !== item.qtyB ? (
                    <span>{item.qtyA} → <b>{item.qtyB}</b> {item.unit}</span>
                  ) : (
                    <span>{item.qtyB} {item.unit}</span>
                  )}
                </td>
                <td>
                  {item.status === 'added' ? (
                    <span>{money.format(item.unitSaleB || 0)}</span>
                  ) : item.status === 'removed' ? (
                    <del>{money.format(item.unitSaleA || 0)}</del>
                  ) : item.unitSaleA !== item.unitSaleB ? (
                    <span>{money.format(item.unitSaleA || 0)} → <b>{money.format(item.unitSaleB || 0)}</b></span>
                  ) : (
                    <span>{money.format(item.unitSaleB || 0)}</span>
                  )}
                </td>
                <td className="text-right font-medium">
                  {item.totalSaleB !== null ? money.format(item.totalSaleB) : '—'}
                </td>
                <td className={`text-right ${item.deltaSale > 0 ? 'delta-pos' : item.deltaSale < 0 ? 'delta-neg' : 'delta-zero'}`}>
                  {item.deltaSale !== 0 && (item.deltaSale > 0 ? '+' : '')}
                  {money.format(item.deltaSale)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
