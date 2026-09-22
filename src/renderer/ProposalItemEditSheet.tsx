import { Copy, Trash2, X } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';

type Item = ProposalDetail['items'][number];

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDecimal = (value: number) => String(value).replace('.', ',');

type Props = {
  item: Item;
  isEditable: boolean;
  mutationPending: boolean;
  onClose: () => void;
  onUpdateText: (id: string, field: 'description' | 'unit', value: string) => void;
  onUpdateMoney: (id: string, field: 'unitCost' | 'unitSale', value: string) => void;
  onUpdateQuantity: (id: string, value: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function ProposalItemEditSheet({
  item,
  isEditable,
  mutationPending,
  onClose,
  onUpdateText,
  onUpdateMoney,
  onUpdateQuantity,
  onDuplicate,
  onDelete,
}: Props) {
  const disabled = !isEditable || mutationPending;

  return (
    <div className="proposal-item-edit-backdrop" role="presentation" onClick={onClose}>
      <div
        className="proposal-item-edit-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Editar item ${item.description}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="proposal-item-edit-sheet-handle" />
        <div className="proposal-item-edit-sheet-head">
          <b>{item.code}</b>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="proposal-item-edit-field">
          <label htmlFor="proposal-item-edit-description">Descrição</label>
          <input
            id="proposal-item-edit-description"
            key={`${item.id}-description-${item.description}`}
            type="text"
            defaultValue={item.description}
            disabled={disabled}
            onBlur={(event) => onUpdateText(item.id, 'description', event.currentTarget.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          />
        </div>

        <div className="proposal-item-edit-field-row">
          <div className="proposal-item-edit-field">
            <label htmlFor="proposal-item-edit-quantity">Quantidade</label>
            <input
              id="proposal-item-edit-quantity"
              key={`${item.id}-quantity-${item.quantity}`}
              type="text"
              inputMode="decimal"
              defaultValue={formatDecimal(item.quantity)}
              disabled={disabled}
              onBlur={(event) => onUpdateQuantity(item.id, event.currentTarget.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
            />
          </div>
          <div className="proposal-item-edit-field">
            <label htmlFor="proposal-item-edit-unit">Unidade</label>
            <input
              id="proposal-item-edit-unit"
              key={`${item.id}-unit-${item.unit}`}
              type="text"
              defaultValue={item.unit}
              disabled={disabled}
              onBlur={(event) => onUpdateText(item.id, 'unit', event.currentTarget.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
            />
          </div>
        </div>

        <div className="proposal-item-edit-field-row">
          <div className="proposal-item-edit-field">
            <label htmlFor="proposal-item-edit-cost">Custo unit. (R$)</label>
            <input
              id="proposal-item-edit-cost"
              key={`${item.id}-cost-${item.unitCost}`}
              type="text"
              inputMode="decimal"
              defaultValue={formatDecimal(item.unitCost)}
              disabled={disabled}
              onBlur={(event) => onUpdateMoney(item.id, 'unitCost', event.currentTarget.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
            />
          </div>
          <div className="proposal-item-edit-field">
            <label htmlFor="proposal-item-edit-sale">Venda unit. (R$)</label>
            <input
              id="proposal-item-edit-sale"
              key={`${item.id}-sale-${item.unitSale}`}
              type="text"
              inputMode="decimal"
              defaultValue={formatDecimal(item.unitSale)}
              disabled={disabled}
              onBlur={(event) => onUpdateMoney(item.id, 'unitSale', event.currentTarget.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
            />
          </div>
        </div>

        {isEditable && item.catalogCurrentCost !== null && item.catalogCurrentCost !== undefined && Math.abs(item.catalogCurrentCost - item.unitCost) >= 0.01 && (
          <button
            type="button"
            className={`catalog-cost-badge ${item.catalogCurrentCost > item.unitCost ? 'cost-up' : 'cost-down'}`}
            disabled={mutationPending}
            onClick={() => onUpdateMoney(item.id, 'unitCost', formatDecimal(item.catalogCurrentCost ?? item.unitCost))}
          >
            Catálogo atual: {item.catalogCurrentCost > item.unitCost ? '▲' : '▼'} R$ {money.format(item.catalogCurrentCost)} · toque para sincronizar
          </button>
        )}

        <div className="proposal-item-edit-totals">
          <span>Custo total <b>R$ {money.format(item.totalCost)}</b></span>
          <span>Venda total <b>R$ {money.format(item.totalSale)}</b></span>
        </div>

        <div className="proposal-item-edit-actions">
          <button type="button" className="duplicate" disabled={disabled} onClick={onDuplicate}>
            <Copy size={15} /> Duplicar
          </button>
          <button type="button" className="delete" disabled={disabled} onClick={onDelete}>
            <Trash2 size={15} /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
