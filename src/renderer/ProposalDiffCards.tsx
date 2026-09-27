import { CheckCircle2 } from 'lucide-react';
import type { DiffStatus, ProposalItemDiff, ProposalLaborDiff } from './proposalDiffHelpers';

// Comparativo de revisoes no celular: um cartao por item (antes e depois),
// no lugar das tabelas de 7 colunas do desktop.
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const statusLabel: Record<DiffStatus, string> = {
  added: 'Adicionado',
  removed: 'Removido',
  changed: 'Alterado',
  unchanged: 'Sem alteração',
};

const deltaClass = (value: number) => (value > 0 ? 'delta-pos' : value < 0 ? 'delta-neg' : 'delta-zero');
const signed = (value: number) => `${value > 0 ? '+' : ''}${money.format(value)}`;

function Change({ label, before, after, status }: { label: string; before: string; after: string; status: DiffStatus }) {
  const value = status === 'added' ? after : status === 'removed' ? before : before === after ? after : null;
  return (
    <div className="diff-card-row">
      <span>{label}</span>
      {value !== null
        ? <b className={status === 'removed' ? 'diff-card-removed' : undefined}>{value}</b>
        : <b>{before} <span aria-hidden="true">→</span><span className="sr-only"> para </span> {after}</b>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="diff-card-empty"><CheckCircle2 size={16} /> {text}</p>;
}

interface Props {
  activeTab: 'items' | 'labor';
  filteredItems: ProposalItemDiff[];
  laborDiffData: ProposalLaborDiff[];
}

export function ProposalDiffCards({ activeTab, filteredItems, laborDiffData }: Props) {
  if (activeTab === 'labor') {
    if (laborDiffData.length === 0) return <Empty text="Nenhum registro de mão de obra nas revisões selecionadas." />;
    return (
      <ul className="diff-cards">
        {laborDiffData.map((lb) => (
          <li key={lb.description} className={`diff-card row-${lb.status}`}>
            <div className="diff-card-head">
              <span className={`diff-badge badge-${lb.status}`}>{statusLabel[lb.status]}</span>
              <strong className={deltaClass(lb.deltaCost)}>{signed(lb.deltaCost)}</strong>
            </div>
            <p className="diff-card-title">{lb.description}</p>
            <Change label="Profissionais" before={String(lb.countA ?? 0)} after={String(lb.countB ?? 0)} status={lb.status} />
            <Change label="Horas" before={`${lb.hoursA ?? 0}h`} after={`${lb.hoursB ?? 0}h`} status={lb.status} />
            <Change label="Custo" before={money.format(lb.costA ?? 0)} after={money.format(lb.costB ?? 0)} status={lb.status} />
          </li>
        ))}
      </ul>
    );
  }

  if (filteredItems.length === 0) return <Empty text="Nenhuma alteração encontrada para os filtros selecionados." />;
  return (
    <ul className="diff-cards">
      {filteredItems.map((item) => (
        <li key={item.key} className={`diff-card row-${item.status}`}>
          <div className="diff-card-head">
            <span className={`diff-badge badge-${item.status}`}>{statusLabel[item.status]}</span>
            <strong className={deltaClass(item.deltaSale)}>{signed(item.deltaSale)}</strong>
          </div>
          <p className="diff-card-title">{item.code && <code>{item.code}</code>} {item.description}</p>
          <Change label="Quantidade" before={`${item.qtyA ?? 0} ${item.unit}`} after={`${item.qtyB ?? 0} ${item.unit}`} status={item.status} />
          <Change label="Preço unitário" before={money.format(item.unitSaleA ?? 0)} after={money.format(item.unitSaleB ?? 0)} status={item.status} />
          <Change label="Total" before={money.format(item.totalSaleA ?? 0)} after={money.format(item.totalSaleB ?? 0)} status={item.status} />
        </li>
      ))}
    </ul>
  );
}
