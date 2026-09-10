import { useEffect, useState } from 'react';
import { Box, Plus, Search, X } from 'lucide-react';
import type { CatalogProduct } from '../shared/contracts';
import { catalogApi } from './api';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Props = {
  open: boolean;
  onClose: () => void;
  onAddProduct: (product: CatalogProduct) => void;
  onAddProductsBatch: (products: CatalogProduct[]) => void;
  onError: (message: string) => void;
};

export function KitProductPickerModal({
  open,
  onClose,
  onAddProduct,
  onAddProductsBatch,
  onError,
}: Props) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, CatalogProduct>>(new Map());

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedProducts(new Map());
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await catalogApi.list(query);
        if (active) setProducts(result.products.filter((p) => p.active));
      } catch (error) {
        if (active) onError(error instanceof Error ? error.message : 'Erro ao pesquisar catálogo.');
      } finally {
        if (active) setLoading(false);
      }
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query, onError]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const toggleSelect = (product: CatalogProduct) => {
    setSelectedProducts((prev) => {
      const next = new Map(prev);
      if (next.has(product.id)) next.delete(product.id);
      else next.set(product.id, product);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedProducts((prev) => {
      const next = new Map(prev);
      if (checked) {
        for (const p of products) next.set(p.id, p);
      } else {
        for (const p of products) next.delete(p.id);
      }
      return next;
    });
  };

  const handleAddBatch = () => {
    const selected = Array.from(selectedProducts.values());
    if (selected.length === 0) return;
    onAddProductsBatch(selected);
    onClose();
  };

  const handleAddSingle = (product: CatalogProduct) => {
    if (selectedProducts.size > 0) {
      const next = new Map(selectedProducts);
      next.set(product.id, product);
      onAddProductsBatch(Array.from(next.values()));
    } else {
      onAddProduct(product);
    }
    onClose();
  };

  const allVisibleSelected = products.length > 0 && products.every((p) => selectedProducts.has(p.id));

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="new-proposal-dialog"
        style={{ width: '680px' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <Box size={22} />
            <div>
              <h2>Adicionar produto ao kit</h2>
              <p>Pesquise e selecione itens do catálogo cadastrado.</p>
            </div>
          </div>
          <button type="button" className="dialog-close" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div style={{ padding: '16px 20px' }}>
          <label className="management-search" style={{ margin: '0 0 14px' }}>
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar código, descrição ou fabricante…"
            />
          </label>

          <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e4e6ea', borderRadius: '6px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 14px',
                background: '#f8f9fb',
                borderBottom: '1px solid #e4e6ea',
                fontSize: '11px',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />{' '}
                Selecionar todos visíveis
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: selectedProducts.size > 0 ? '#09738a' : '#5d7480', fontWeight: selectedProducts.size > 0 ? 600 : 400 }}>
                  {selectedProducts.size} selecionado(s) no total
                </span>
                {selectedProducts.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedProducts(new Map())}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#d13438',
                      cursor: 'pointer',
                      fontSize: '11px',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
            {products.map((product) => {
              const isSelected = selectedProducts.has(product.id);
              return (
                <div
                  key={product.id}
                  onClick={() => toggleSelect(product)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: '1px solid #f0f2f5',
                    background: isSelected ? '#e8f8fc' : 'white',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(product)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>
                      {product.code} - {product.description}
                    </div>
                    <div style={{ fontSize: '10px', color: '#5d7480' }}>
                      {product.category} • Un: {product.unit}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '11px' }}>{money.format(product.currentCost)}</span>
                    <button
                      type="button"
                      className={isSelected ? 'secondary' : 'primary'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddSingle(product);
                      }}
                      style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                    >
                      <Plus size={13} /> {isSelected ? 'Adicionar itens' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              );
            })}
            {!loading && products.length === 0 && (
              <p style={{ padding: '24px', textAlign: 'center', color: '#5d7480', margin: 0, fontSize: '11px' }}>
                Nenhum produto ativo encontrado com esse termo.
              </p>
            )}
          </div>
        </div>

        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#5d7480' }}>
            {selectedProducts.size} produto(s) marcado(s) para inclusão
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose}>
              Fechar
            </button>
            <button
              type="button"
              className="primary"
              disabled={selectedProducts.size === 0}
              onClick={handleAddBatch}
            >
              <Plus size={14} /> Adicionar em lote ({selectedProducts.size})
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
