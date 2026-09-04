import { useEffect, useState } from 'react';
import { Box, Plus, Search } from 'lucide-react';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIds(new Set());
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

  if (!open) return null;

  const toggleSelect = (productId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleAddBatch = () => {
    const selected = products.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;
    onAddProductsBatch(selected);
    onClose();
  };

  return (
    <div className="dialog-backdrop">
      <div className="new-proposal-dialog" style={{ width: '680px' }}>
        <header>
          <div>
            <Box size={22} />
            <div>
              <h2>Adicionar produto ao kit</h2>
              <p>Pesquise e selecione itens do catálogo cadastrado.</p>
            </div>
          </div>
          <button type="button" className="dialog-close" onClick={onClose}>
            ✕
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
                  checked={products.length > 0 && selectedIds.size === products.length}
                  onChange={(e) =>
                    setSelectedIds(e.target.checked ? new Set(products.map((p) => p.id)) : new Set())
                  }
                />{' '}
                Selecionar todos
              </label>
              <span style={{ color: '#5d7480' }}>{selectedIds.size} selecionado(s)</span>
            </div>
            {products.map((product) => (
              <div
                key={product.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: '1px solid #f0f2f5',
                  background: selectedIds.has(product.id) ? '#e8f8fc' : 'white',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(product.id)}
                  onChange={() => toggleSelect(product.id)}
                  style={{ width: '16px', height: '16px' }}
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
                    className="primary"
                    onClick={() => {
                      onAddProduct(product);
                      onClose();
                    }}
                    style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>
              </div>
            ))}
            {!loading && products.length === 0 && (
              <p style={{ padding: '24px', textAlign: 'center', color: '#5d7480', margin: 0, fontSize: '11px' }}>
                Nenhum produto ativo encontrado com esse termo.
              </p>
            )}
          </div>
        </div>

        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#5d7480' }}>{selectedIds.size} selecionado(s)</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose}>
              Fechar
            </button>
            <button
              type="button"
              className="primary"
              disabled={selectedIds.size === 0}
              onClick={handleAddBatch}
            >
              <Plus size={14} /> Adicionar em lote ({selectedIds.size})
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
