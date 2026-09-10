import { Plus, Trash2 } from 'lucide-react';

export type KitItemDraft = {
  productId: string;
  code: string;
  description: string;
  category: string;
  unit: string;
  currentCost: number;
  quantity: number;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Props = {
  items: KitItemDraft[];
  onOpenPicker: () => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
};

export function KitItemsTable({ items, onOpenPicker, onUpdateQuantity, onRemoveItem }: Props) {
  return (
    <div className="kit-items-section" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
          Itens que compõem este kit ({items.length})
        </h3>
        <button
          type="button"
          onClick={onOpenPicker}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '30px',
            padding: '0 10px',
            fontSize: '11px',
            background: '#e8f8fc',
            color: '#12a9d1',
            border: '1px solid #c5d8f9',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Adicionar item do catálogo
        </button>
      </div>

      {items.length > 0 ? (
        <div
          className="kit-table-wrapper"
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            overflowX: 'auto',
            overflowY: 'hidden',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '11.5px', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '34%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '7%' }} />
            </colgroup>
            <thead style={{ background: '#f8f9fb' }}>
              <tr>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Código</th>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Descrição</th>
                <th style={{ padding: '8px 8px', textAlign: 'center' }}>Un.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Custo un.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qtd.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                <th
                  style={{
                    padding: '8px 8px',
                    textAlign: 'center',
                    position: 'sticky',
                    right: 0,
                    background: '#f8f9fb',
                    zIndex: 2,
                    boxShadow: '-3px 0 6px -2px rgba(0,0,0,0.06)',
                  }}
                  aria-label="Ações"
                >
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId} className="kit-item-row" style={{ borderTop: '1px solid #e4e6ea' }}>
                  <td style={{ padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <b>{item.code}</b>
                  </td>
                  <td style={{ padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                    {item.description}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>{money.format(item.currentCost)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(item.productId, Number(e.target.value))}
                      style={{
                        width: '65px',
                        height: '26px',
                        padding: '0 6px',
                        textAlign: 'right',
                        border: '1px solid #cfd5de',
                        borderRadius: '4px',
                      }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {money.format(item.currentCost * item.quantity)}
                  </td>
                  <td
                    style={{
                      padding: '6px 8px',
                      textAlign: 'center',
                      position: 'sticky',
                      right: 0,
                      background: '#fff',
                      zIndex: 1,
                      boxShadow: '-3px 0 6px -2px rgba(0,0,0,0.06)',
                    }}
                  >
                    <button
                      type="button"
                      className="kit-item-remove-btn"
                      title={`Excluir ${item.description} do kit`}
                      aria-label={`Excluir ${item.description}`}
                      onClick={() => onRemoveItem(item.productId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        border: '1px solid #fca5a5',
                        background: '#fef2f2',
                        color: '#dc2626',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: '#5d7480', fontStyle: 'italic', fontSize: '11px', padding: '12px 0' }}>
          Nenhum item adicionado ao kit. Clique em &quot;Adicionar item do catálogo&quot; para montar a composição.
        </p>
      )}
    </div>
  );
}
