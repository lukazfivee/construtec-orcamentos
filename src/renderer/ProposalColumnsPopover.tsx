import { useEffect, useRef } from 'react';
import { Check, Eye, EyeOff, RotateCcw, X } from 'lucide-react';

export type ProposalColumnsVisibility = {
  code: boolean;
  unit: boolean;
  unitCost: boolean;
  totalCost: boolean;
  unitSale: boolean;
  totalSale: boolean;
};

export const DEFAULT_PROPOSAL_COLUMNS: ProposalColumnsVisibility = {
  code: true,
  unit: true,
  unitCost: true,
  totalCost: true,
  unitSale: true,
  totalSale: true,
};

type ColumnKey = keyof ProposalColumnsVisibility;

const COLUMN_LABELS: { key: ColumnKey; label: string; description: string }[] = [
  { key: 'code', label: 'Código', description: 'Código do produto ou serviço' },
  { key: 'unit', label: 'Unidade', description: 'Unidade de medida (un, m, kg...)' },
  { key: 'unitCost', label: 'Custo unitário', description: 'Valor de aquisição ou custo base' },
  { key: 'totalCost', label: 'Custo total', description: 'Custo multiplicado pela quantidade' },
  { key: 'unitSale', label: 'Venda unitária', description: 'Preço unitário final com BDI' },
  { key: 'totalSale', label: 'Venda total', description: 'Valor total de venda do item' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  columns: ProposalColumnsVisibility;
  onChangeColumns: (next: ProposalColumnsVisibility) => void;
};

export function ProposalColumnsPopover({ open, onClose, columns, onChangeColumns }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const toggleColumn = (key: ColumnKey) => {
    onChangeColumns({
      ...columns,
      [key]: !columns[key],
    });
  };

  const applyPresetComplete = () => {
    onChangeColumns({ ...DEFAULT_PROPOSAL_COLUMNS });
  };

  const applyPresetClientMode = () => {
    onChangeColumns({
      ...columns,
      unitCost: false,
      totalCost: false,
      unitSale: true,
      totalSale: true,
    });
  };

  const isClientMode = !columns.unitCost && !columns.totalCost;

  return (
    <div className="columns-popover" ref={popoverRef} role="dialog" aria-label="Configuração de colunas visíveis">
      <div className="columns-popover-header">
        <div className="columns-popover-title">
          <strong>Colunas da tabela</strong>
          <small>Personalize as colunas visíveis</small>
        </div>
        <button type="button" className="columns-popover-close" onClick={onClose} aria-label="Fechar">
          <X size={16} />
        </button>
      </div>

      <div className="columns-popover-presets">
        <button
          type="button"
          className={`columns-preset-btn ${!isClientMode ? 'active' : ''}`}
          onClick={applyPresetComplete}
          title="Exibir todas as colunas de custo e venda"
        >
          <Eye size={14} /> Visão Completa
        </button>
        <button
          type="button"
          className={`columns-preset-btn ${isClientMode ? 'active' : ''}`}
          onClick={applyPresetClientMode}
          title="Oculta custos unitário e total para apresentação ao cliente"
        >
          <EyeOff size={14} /> Visão Comercial
        </button>
      </div>

      <div className="columns-popover-list">
        {COLUMN_LABELS.map(({ key, label, description }) => {
          const isChecked = columns[key];
          return (
            <label key={key} className={`columns-checkbox-item ${isChecked ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleColumn(key)}
              />
              <span className="columns-checkbox-custom">
                {isChecked && <Check size={12} />}
              </span>
              <span className="columns-item-text">
                <span className="columns-item-label">{label}</span>
                <span className="columns-item-desc">{description}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="columns-popover-footer">
        <button type="button" className="columns-reset-btn" onClick={applyPresetComplete}>
          <RotateCcw size={13} /> Restaurar padrão
        </button>
      </div>
    </div>
  );
}
