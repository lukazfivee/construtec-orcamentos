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
        <div style={{ border: '1px solid #e4e6ea', borderRadius: '6px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead style={{ background: '#f8f9fb' }}>
              <tr>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Código</th>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Descrição</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '50px' }}>Un.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Custo un.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Qtd.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Total</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }} aria-label="Ações"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId} style={{ borderTop: '1px solid #e4e6ea' }}>
                  <td style={{ padding: '6px 10px' }}><b>{item.code}</b></td>
                  <td style={{ padding: '6px 10px' }}>{item.description}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>{item.unit}</td>
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
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.productId)}
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: '#a32b2b',
                        cursor: 'pointer',
                        padding: '2px',
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
