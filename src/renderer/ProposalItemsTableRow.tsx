import type { ProposalDetail } from '../shared/contracts';

type Item = ProposalDetail['items'][number];

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDecimal = (value: number) => String(value).replace('.', ',');

type Props = {
  item: Item;
  index: number;
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
      <td>
        <input
          type="checkbox"
          aria-label={`Selecionar ${item.description}`}
          checked={isSelected}
          disabled={!isEditable}
          onChange={() => onToggleSelect(item.id)}
        />
      </td>
      <td>{index + 1}</td>
      <td className="code">{item.code}</td>
      <td className="editable-cell">
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
      <td className="number editable-cell">
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
      <td className="editable-cell">
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
      <td className="number editable-cell">
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
      </td>
      <td className="number">{money.format(item.totalCost)}</td>
      <td className="number editable-cell">
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
      <td className="number">{money.format(item.totalSale)}</td>
    </tr>
  );
}
