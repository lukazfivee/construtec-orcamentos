import type { ProposalDetail } from '../shared/contracts';
import type { ProposalColumnsVisibility } from './ProposalColumnsPopover';

type Item = ProposalDetail['items'][number];

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDecimal = (value: number) => String(value).replace('.', ',');

type Props = {
  item: Item;
  index: number;
  columns: ProposalColumnsVisibility;
  isSelected: boolean;
  isEditable: boolean;
  mutationPending: boolean;
  quantityDraft: string | undefined;
  onToggleSelect: (id: string) => void;
  onQuantityDraftChange: (id: string, value: string) => void;
  onQuantityDraftBlur: (id: string, value: string) => void;
  onUpdateText: (id: string, field: 'description' | 'unit', value: string) => void;
  onUpdateMoney: (id: string, field: 'unitCost' | 'unitSale', value: string) => void;
};

export function ProposalItemsTableRow({
  item,
  index,
  columns,
  isSelected,
  isEditable,
  mutationPending,
  quantityDraft,
  onToggleSelect,
  onQuantityDraftChange,
  onQuantityDraftBlur,
  onUpdateText,
  onUpdateMoney,
}: Props) {
  return (
    <tr>
      <td className="col-select">
        <input
          type="checkbox"
          aria-label={`Selecionar ${item.description}`}
          checked={isSelected}
          disabled={!isEditable}
          onChange={() => onToggleSelect(item.id)}
        />
      </td>
      <td className="col-index">{index + 1}</td>
      {columns.code && <td className="code col-code">{item.code}</td>}
      <td className="editable-cell col-description">
        <input
          key={`${item.id}-description-${item.description}`}
          className="line-input"
          type="text"
          defaultValue={item.description}
          title={item.description}
          disabled={!isEditable || mutationPending}
          aria-label={`Descrição de ${item.description}`}
          onBlur={(event) => onUpdateText(item.id, 'description', event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              event.currentTarget.value = item.description;
              event.currentTarget.blur();
            }
          }}
        />
      </td>
      <td className="number editable-cell col-quantity">
        <input
          className="quantity-input"
          type="text"
          inputMode="decimal"
          aria-label={`Quantidade de ${item.description}`}
          value={quantityDraft ?? formatDecimal(item.quantity)}
          disabled={!isEditable || mutationPending}
          onChange={(event) => onQuantityDraftChange(item.id, event.target.value)}
          onBlur={(event) => onQuantityDraftBlur(item.id, event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              onQuantityDraftChange(item.id, formatDecimal(item.quantity));
              event.currentTarget.blur();
            }
          }}
        />
      </td>
      {columns.unit && (
        <td className="editable-cell col-unit">
          <input
            key={`${item.id}-unit-${item.unit}`}
            className="unit-input"
            type="text"
            defaultValue={item.unit}
            disabled={!isEditable || mutationPending}
            aria-label={`Unidade de ${item.description}`}
            onBlur={(event) => onUpdateText(item.id, 'unit', event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                event.currentTarget.value = item.unit;
                event.currentTarget.blur();
              }
            }}
          />
        </td>
      )}
      {columns.unitCost && (
        <td className="number editable-cell cost-cell col-cost">
          <input
            key={`${item.id}-cost-${item.unitCost}`}
            className="quantity-input"
            type="text"
            inputMode="decimal"
            defaultValue={formatDecimal(item.unitCost)}
            disabled={!isEditable || mutationPending}
            aria-label={`Custo unitário de ${item.description}`}
            onBlur={(event) => onUpdateMoney(item.id, 'unitCost', event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                event.currentTarget.value = formatDecimal(item.unitCost);
                event.currentTarget.blur();
              }
            }}
          />
          {isEditable && item.catalogCurrentCost !== null && item.catalogCurrentCost !== undefined && Math.abs(item.catalogCurrentCost - item.unitCost) >= 0.01 && (
            <button
              type="button"
              className={`catalog-cost-badge ${item.catalogCurrentCost > item.unitCost ? 'cost-up' : 'cost-down'}`}
              title={`Catálogo atual: R$ ${money.format(item.catalogCurrentCost)}. Clique para atualizar.`}
              disabled={mutationPending}
              onClick={() => onUpdateMoney(item.id, 'unitCost', formatDecimal(item.catalogCurrentCost!))}
            >
              {item.catalogCurrentCost > item.unitCost ? '▲' : '▼'} {money.format(item.catalogCurrentCost)}
            </button>
          )}
        </td>
      )}
      {columns.totalCost && <td className="number col-total-cost">{money.format(item.totalCost)}</td>}
      {columns.unitSale && (
        <td className="number editable-cell col-sale">
          <input
            key={`${item.id}-sale-${item.unitSale}`}
            className="quantity-input"
            type="text"
            inputMode="decimal"
            defaultValue={formatDecimal(item.unitSale)}
            disabled={!isEditable || mutationPending}
            aria-label={`Venda unitária de ${item.description}`}
            onBlur={(event) => onUpdateMoney(item.id, 'unitSale', event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                event.currentTarget.value = formatDecimal(item.unitSale);
                event.currentTarget.blur();
              }
            }}
          />
        </td>
      )}
      {columns.totalSale && <td className="number col-total-sale">{money.format(item.totalSale)}</td>}
    </tr>
  );
}
