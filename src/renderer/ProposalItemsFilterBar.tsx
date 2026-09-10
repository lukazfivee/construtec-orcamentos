import { Search, Tag, X } from 'lucide-react';

type Props = {
  open: boolean;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  selectedCategory: string;
  onSelectedCategoryChange: (category: string) => void;
  categories: string[];
  filteredCount: number;
  totalCount: number;
  onClearFilters: () => void;
  onClose: () => void;
};

export function ProposalItemsFilterBar({
  open,
  searchTerm,
  onSearchTermChange,
  selectedCategory,
  onSelectedCategoryChange,
  categories,
  filteredCount,
  totalCount,
  onClearFilters,
  onClose,
}: Props) {
  if (!open) return null;

  const hasActiveFilters = Boolean(searchTerm.trim()) || Boolean(selectedCategory);

  return (
    <div className="proposal-filter-bar" role="search" aria-label="Filtro de itens da proposta">
      <div className="proposal-filter-inputs">
        <div className="proposal-filter-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="filter-search-input"
            placeholder="Filtrar por código ou descrição…"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="filter-clear-input-btn"
              onClick={() => onSearchTermChange('')}
              aria-label="Limpar texto de busca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div className="proposal-filter-category-box">
            <Tag size={14} className="category-icon" />
            <select
              className="filter-category-select"
              value={selectedCategory}
              onChange={(e) => onSelectedCategoryChange(e.target.value)}
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="proposal-filter-meta">
        <span className={`proposal-filter-count-badge ${hasActiveFilters ? 'highlight' : ''}`}>
          {hasActiveFilters ? (
            <>Exibindo <b>{filteredCount}</b> de {totalCount} itens</>
          ) : (
            <>{totalCount} {totalCount === 1 ? 'item na proposta' : 'itens na proposta'}</>
          )}
        </span>

        {hasActiveFilters && (
          <button type="button" className="filter-clear-all-btn" onClick={onClearFilters}>
            <X size={13} /> Limpar filtro
          </button>
        )}

        <button type="button" className="filter-close-bar-btn" onClick={onClose} title="Fechar barra de filtro" aria-label="Fechar">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
