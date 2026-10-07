import { Download, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import type { CatalogImportItem, CatalogImportStatus } from '../shared/contracts';
import { statusTone, type ImportMode } from './catalogImportDialogModel';
import { formatMoney, type Row } from './catalogImportHelpers';

const COLUMNS: Array<{ key: keyof CatalogImportItem; label: string; className: string }> = [
  { key: 'code', label: 'Código', className: 'c-code' }, { key: 'description', label: 'Descrição', className: 'c-desc' },
  { key: 'category', label: 'Categoria', className: 'c-cat' }, { key: 'manufacturer', label: 'Fabricante', className: 'c-man' },
  { key: 'model', label: 'Modelo', className: 'c-mod' }, { key: 'unit', label: 'Unid.', className: 'c-unit' },
  { key: 'currentCost', label: 'Valor total', className: 'c-cost' },
];
const STATUS_LABEL: Record<CatalogImportStatus, string> = {
  new: 'Novo', updated: 'Atualizar', unchanged: 'Sem alteração', no_price: 'Sem preço',
  confirmed: 'Confirmado', divergent: 'Divergente', unavailable: 'Indisponível', error: 'Erro',
};
// A varredura do catalogo inteiro pode trazer milhares de linhas; a tabela edita as primeiras, a importacao leva todas.
const SHOW_MAX = 300;
const EMPTY: Record<ImportMode, string> = {
  manual: 'Cole as linhas na caixa acima e use Interpretar linhas. Os itens aparecem aqui para conferência.',
  file: 'Escolha uma planilha para ver os itens aqui antes de salvar.',
  image: 'Escolha uma imagem ou PDF para ver os itens reconhecidos aqui antes de salvar.',
  exsat: 'Atualize o catálogo para ver aqui os itens lidos na Exsat antes de salvar.',
};

type Props = {
  mode: ImportMode;
  rows: Row[];
  importable: number;
  sourceName: string;
  busy: boolean;
  onChange: (key: string, field: keyof CatalogImportItem, value: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onExport?: () => void;
};

export function CatalogImportTable({ mode, rows, importable, sourceName, busy, onChange, onRemove, onAdd, onExport }: Props) {
  const exsat = mode === 'exsat';
  const costLabel = exsat ? 'Custo unitário' : 'Valor total';
  if (rows.length === 0) {
    return <section className="cid-empty" aria-live="polite">
      <span className="cid-ico"><FileSpreadsheet size={20} aria-hidden="true" /></span>
      <b>Nenhum item carregado</b><span>{EMPTY[mode]}</span>
      {mode === 'manual' && <button type="button" className="od-btn sm s" onClick={onAdd}><Plus size={14} />Adicionar linha</button>}
    </section>;
  }
  return <section className="cid-results" aria-label="Itens encontrados">
    <div className="cid-results-head">
      <span className="cid-grow"><b>{rows.length} {rows.length === 1 ? 'linha' : 'linhas'}</b> · <b>{importable}</b> para importar
        {sourceName && <span className="cid-source">{sourceName}</span>}</span>
      {onExport && <button type="button" className="od-btn sm s" disabled={busy} onClick={onExport}><Download size={14} />Exportar planilha</button>}
      <button type="button" className="od-btn sm s" onClick={onAdd}><Plus size={14} />Linha</button>
    </div>
    {rows.length > SHOW_MAX && <p className="cid-note cid-more">Mostrando as primeiras {SHOW_MAX} de {rows.length.toLocaleString('pt-BR')} linhas. Todas entram na importação; para ajustar uma linha, use a planilha exportada.</p>}
    <div className="cid-table-wrap">
      <table className="od-tbl cid-table">
        <thead><tr>
          {exsat && <th className="c-status">Situação</th>}
          {COLUMNS.map((column) => <th key={column.key} className={column.className}>{column.key === 'currentCost' ? costLabel : column.label}</th>)}
          <th className="c-act"><span className="cid-sr">Excluir</span></th>
        </tr></thead>
        <tbody>{rows.slice(0, SHOW_MAX).map((row) => {
          const invalid = !row.code || !row.description || row.status === 'no_price' || row.status === 'unavailable' || row.status === 'error';
          const tone = row.status ? statusTone[row.status] : '';
          return <tr key={row.key} className={invalid ? 'invalid' : ''}>
            {exsat && <td className="c-status"><span className={`od-chip ${tone}`}>{row.status ? STATUS_LABEL[row.status] : 'Editado'}</span></td>}
            {COLUMNS.map((column) => <td key={column.key} className={column.className}>
              <input className={`cid-cell${column.key === 'currentCost' ? ' num' : ''}`} value={column.key === 'currentCost' ? formatMoney(row.currentCost) : String(row[column.key] ?? '')}
                onChange={(event) => onChange(row.key, column.key, event.target.value)} aria-label={`${column.key === 'currentCost' ? costLabel : column.label} da linha`} />
            </td>)}
            <td className="c-act"><button type="button" className="od-ibtn" aria-label="Excluir linha" onClick={() => onRemove(row.key)}><Trash2 size={15} /></button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}
