import { CheckSquare, Loader2, Square } from 'lucide-react';
import type { ProposalLine, ProposalSummary } from '../shared/contracts';

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
        <span>Selecione a proposta de origem:</span>
        <select value={selectedProposalId} onChange={(e) => onSelectProposal(e.target.value)}>
          <option value="">Selecione uma proposta...</option>
          {proposalsList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} (REV.{String(p.revision).padStart(2, '0')}) — {p.clientName} ({p.itemCount} itens)
            </option>
          ))}
        </select>
      </label>

      {loadingSourceProposal ? (
        <div className="loading-state">
          <Loader2 className="spinning" size={20} /> Carregando itens da proposta...
        </div>
      ) : sourceProposalItems.length > 0 ? (
        <div className="proposal-items-picker">
          <div className="picker-toolbar">
            <button type="button" className="picker-toggle-all" onClick={onToggleAll}>
              {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <span>{selectedSourceItemIds.length} de {sourceProposalItems.length} selecionado(s)</span>
          </div>
          <div className="picker-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Qtd</th>
                  <th>Unid</th>
                  <th>Preço Venda</th>
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
                      <td><input type="checkbox" checked={checked} readOnly /></td>
                      <td><code>{item.code}</code></td>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td>{item.unit}</td>
                      <td>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unitSale)}
                      </td>
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
