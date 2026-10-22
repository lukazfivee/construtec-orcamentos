import type { ProposalLine, ProposalSummary } from '../shared/contracts';
import { brl, numero, plural } from '../shared/formatoBr';
import { CheckSquare, Loader2, Square } from './icons';

interface ProposalImportProposalTabProps {
  proposalsList: ProposalSummary[];
  selectedProposalId: string;
  sourceProposalItems: ProposalLine[];
  selectedSourceItemIds: string[];
  loadingSourceProposal: boolean;
  onSelectProposal: (id: string) => void;
  onToggleItem: (id: string) => void;
  onToggleAll: () => void;
}

export function ProposalImportProposalTab({
  proposalsList,
  selectedProposalId,
  sourceProposalItems,
  selectedSourceItemIds,
  loadingSourceProposal,
  onSelectProposal,
  onToggleItem,
  onToggleAll,
}: ProposalImportProposalTabProps) {
  const allSelected =
    sourceProposalItems.length > 0 &&
    selectedSourceItemIds.length === sourceProposalItems.length;

  return (
    <div className="import-tab-pane">
      <label className="select-label">
        <span className="dlg-label">Proposta de origem</span>
        <select className="od-inp" value={selectedProposalId} onChange={(e) => onSelectProposal(e.target.value)}>
          <option value="">Selecione uma proposta</option>
          {proposalsList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} (REV.{String(p.revision).padStart(2, '0')}) — {p.clientName} ({plural(p.itemCount, 'item', 'itens')})
            </option>
          ))}
        </select>
      </label>

      {loadingSourceProposal ? (
        <div className="loading-state">
          <Loader2 className="spinning" size={20} /> Carregando os itens da proposta…
        </div>
      ) : sourceProposalItems.length > 0 ? (
        <div className="proposal-items-picker">
          <div className="picker-toolbar">
            <button type="button" className="picker-toggle-all" onClick={onToggleAll}>
              {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <span>{selectedSourceItemIds.length} de {plural(sourceProposalItems.length, 'item selecionado', 'itens selecionados')}</span>
          </div>
          <div className="picker-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th className="num">Qtd.</th>
                  <th>Unid.</th>
                  <th className="num">Preço de venda</th>
                </tr>
              </thead>
              <tbody>
                {sourceProposalItems.map((item) => {
                  const checked = selectedSourceItemIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={checked ? 'selected-row' : ''}
                      onClick={() => onToggleItem(item.id)}
                    >
                      <td><input type="checkbox" checked={checked} readOnly aria-label={`Selecionar ${item.description}`} /></td>
                      <td className="cod">{item.code}</td>
                      <td>{item.description}</td>
                      <td className="num">{numero(item.quantity, 3)}</td>
                      <td>{item.unit}</td>
                      <td className="num">{brl(item.unitSale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedProposalId ? (
        <div className="empty-picker">Esta proposta não possui itens cadastrados.</div>
      ) : null}
    </div>
  );
}
