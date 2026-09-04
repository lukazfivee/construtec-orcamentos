import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import type { CatalogProduct } from '../shared/contracts';
import { proposalApi } from './api';

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  isEditable: boolean;
  mutationPending: boolean;
  onSelectItem: (product: CatalogProduct) => void;
  onClose: () => void;
  setError: (error: string) => void;
};

export function ProposalCatalogPopover({
  isEditable,
  mutationPending,
  onSelectItem,
  onClose,
  setError,
}: Props) {
  const [query, setQuery] = useState('leit');
  const [catalogResults, setCatalogResults] = useState<CatalogProduct[]>([]);
  const [selectedCatalogIndex, setSelectedCatalogIndex] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const catalogInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedCatalogIndex(0);
  }, [query]);

  useEffect(() => {
    window.requestAnimationFrame(() => catalogInputRef.current?.focus());
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatalogLoading(true);
      try {
        const result = await proposalApi.catalog(query, controller.signal);
        setCatalogResults(result.products);
        setSelectedCatalogIndex(0);
      } catch (catalogError) {
        if (!controller.signal.aborted) {
          setError(catalogError instanceof Error ? catalogError.message : 'Não foi possível pesquisar o catálogo local.');
        }
      } finally {
        if (!controller.signal.aborted) setCatalogLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, setError]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && catalogResults.length > 0) {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setSelectedCatalogIndex((current) => (current + direction + catalogResults.length) % catalogResults.length);
      } else if (event.key === 'Enter' && catalogResults[selectedCatalogIndex]) {
        event.preventDefault();
        onSelectItem(catalogResults[selectedCatalogIndex]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [catalogResults, onClose, onSelectItem, selectedCatalogIndex]);

  return (
    <div className="catalog-popover" role="dialog" aria-label="Buscar no catálogo">
      <div className="popover-heading">
        <b>Buscar no catálogo</b>
        <button type="button" disabled title="A área completa do catálogo será implementada em uma próxima etapa.">
          Ver catálogo completo <ExternalLink size={12} />
        </button>
      </div>
      <label className="catalog-search">
        <Search size={15} />
        <input
          ref={catalogInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Pesquisar no catálogo"
          aria-activedescendant={catalogResults[selectedCatalogIndex] ? `catalog-${catalogResults[selectedCatalogIndex].code}` : undefined}
        />
        <kbd>Esc</kbd>
      </label>
      <div className="catalog-results" aria-busy={catalogLoading}>
        {catalogResults.map((item, index) => (
          <button
            id={`catalog-${item.code}`}
            key={item.id}
            className={index === selectedCatalogIndex ? 'highlighted' : ''}
            type="button"
            disabled={!isEditable || mutationPending}
            onMouseEnter={() => setSelectedCatalogIndex(index)}
            onClick={() => onSelectItem(item)}
          >
            <span className="code">{item.code}</span>
            <span title={item.description}>{item.description}</span>
            <small>Unid.: {item.unit}</small>
            <small>Custo: R$ {money.format(item.currentCost)}</small>
          </button>
        ))}
        {catalogLoading && <p className="catalog-message">Pesquisando no catálogo local…</p>}
        {!catalogLoading && catalogResults.length === 0 && (
          <p className="catalog-message">Nenhum produto encontrado. Tente outro código ou descrição.</p>
        )}
      </div>
      <div className="popover-footer">
        <span>↑↓ Navegar</span>
        <span><kbd>Enter</kbd> Inserir</span>
        <span><kbd>Esc</kbd> Fechar</span>
      </div>
    </div>
  );
}
