import {
  Filter,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';

type Props = {
  fabMenuOpen: boolean;
  isEditable: boolean;
  mutationPending: boolean;
  onToggleFab: () => void;
  onCloseFab: () => void;
  onOpenCatalog: () => void;
  onOpenFilterBar: () => void;
  onOpenImport: () => void;
  onOpenColumns: () => void;
};

export function ProposalItemsFabMenu({
  fabMenuOpen,
  isEditable,
  mutationPending,
  onToggleFab,
  onCloseFab,
  onOpenCatalog,
  onOpenFilterBar,
  onOpenImport,
  onOpenColumns,
}: Props) {
  return (
    <>
      {fabMenuOpen && (
        <div className="proposal-items-fab-backdrop" onClick={onCloseFab} />
      )}

      {fabMenuOpen && (
        <div className="proposal-items-fab-menu" role="menu" aria-label="Ações da lista de itens">
          <button
            type="button"
            role="menuitem"
            disabled={!isEditable || mutationPending}
            onClick={() => { onOpenCatalog(); onCloseFab(); }}
          >
            <Search size={16} /> Inserir do catálogo
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { onOpenFilterBar(); onCloseFab(); }}
          >
            <Filter size={16} /> Filtrar por categoria
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!isEditable || mutationPending}
            onClick={() => { onOpenImport(); onCloseFab(); }}
          >
            <Upload size={16} /> Importar itens
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { onOpenColumns(); onCloseFab(); }}
          >
            <SlidersHorizontal size={16} /> Configurar colunas
          </button>
        </div>
      )}

      <button
        className="proposal-items-fab"
        type="button"
        aria-label={fabMenuOpen ? 'Fechar ações' : 'Ações da lista de itens'}
        aria-expanded={fabMenuOpen}
        onClick={onToggleFab}
      >
        {fabMenuOpen ? <X size={24} /> : <Plus size={24} />}
      </button>
    </>
  );
}
