import { Plus, Trash2 } from 'lucide-react';
import { costText } from './SuitePermissions';

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
    <div className="kit-items-section">
      <div className="kit-items-head">
        <h3>Itens que compõem este kit ({items.length})</h3>
        <button type="button" className="kit-add-btn" onClick={onOpenPicker}>
          <Plus size={16} /> Adicionar item do catálogo
        </button>
      </div>

      {items.length > 0 ? (
        <div className="kit-table-wrapper">
          <table>
            <colgroup>
              <col className="kc-code" />
              <col className="kc-desc" />
              <col className="kc-unit" />
              <col className="kc-cost" />
              <col className="kc-qty" />
              <col className="kc-total" />
              <col className="kc-act" />
            </colgroup>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th className="kit-c">Un.</th>
                <th className="kit-n">Custo un.</th>
                <th className="kit-n">Qtd.</th>
                <th className="kit-n">Total</th>
                <th className="kit-c kit-sticky" aria-label="Ações">Ação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId} className="kit-item-row">
                  <td className="kit-clip"><b>{item.code}</b></td>
                  <td className="kit-clip" title={item.description}>{item.description}</td>
                  <td className="kit-c">{item.unit}</td>
                  <td className="kit-n">{costText(money.format(item.currentCost))}</td>
                  <td className="kit-n">
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      aria-label={`Quantidade de ${item.description}`}
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(item.productId, Number(e.target.value))}
                    />
                  </td>
                  <td className="kit-n kit-strong">{costText(money.format(item.currentCost * item.quantity))}</td>
                  <td className="kit-c kit-sticky">
                    <button
                      type="button"
                      className="kit-item-remove-btn"
                      title={`Excluir ${item.description} do kit`}
                      aria-label={`Excluir ${item.description}`}
                      onClick={() => onRemoveItem(item.productId)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="kit-empty">
          Nenhum item adicionado ao kit. Clique em &quot;Adicionar item do catálogo&quot; para montar a composição.
        </p>
      )}
    </div>
  );
}
