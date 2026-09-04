import { Layers3, Search } from 'lucide-react';
import type { KitSummary } from '../shared/contracts';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Props = {
  kits: KitSummary[];
  selectedKitId: string | null;
  creating: boolean;
  query: string;
  loading: boolean;
  onQueryChange: (query: string) => void;
  onSelectKit: (id: string) => void;
};

export function KitSidebar({
  kits,
  selectedKitId,
  creating,
  query,
  loading,
  onQueryChange,
  onSelectKit,
}: Props) {
  return (
    <aside className="client-list-pane">
      <label className="management-search">
        <Search size={15} />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar kit por nome, categoria…"
        />
      </label>
      <div className="client-list product-list" aria-busy={loading}>
        {kits.map((kit) => (
          <button
            key={kit.id}
            type="button"
            className={kit.id === selectedKitId && !creating ? 'selected' : ''}
            onClick={() => onSelectKit(kit.id)}
          >
            <Layers3 size={17} />
            <span>
              <b>{kit.name}</b>
              <small>{kit.itemCount} itens • {kit.category}</small>
            </span>
            <em>{money.format(kit.totalEstimatedCost)}</em>
          </button>
        ))}
        {!loading && kits.length === 0 && (
          <p className="management-empty">Nenhum kit encontrado.</p>
        )}
      </div>
    </aside>
  );
}
