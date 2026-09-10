import { useEffect, useState } from 'react';
import {
  Copy,
  FileSpreadsheet,
  Layers3,
  Loader2,
  PlusCircle,
  Upload,
  X,
} from 'lucide-react';
import type { KitSummary, ProposalDetail, ProposalLine, ProposalSummary } from '../shared/contracts';
import { kitsApi, proposalApi } from './api';
import {
  ProposalImportPasteTab,
  type ParsedSpreadsheetItem,
} from './ProposalImportPasteTab';
import { ProposalImportProposalTab } from './ProposalImportProposalTab';

interface ProposalImportDialogProps {
  open: boolean;
  proposal: ProposalDetail;
  onClose: () => void;
  onProposalUpdated: (proposal: ProposalDetail) => void;
  onNotice: (message: string) => void;
  onError: (error: string) => void;
}

type TabMode = 'paste' | 'proposal' | 'kit';

export function ProposalImportDialog({
  open,
  proposal,
  onClose,
  onProposalUpdated,
  onNotice,
  onError,
}: ProposalImportDialogProps) {
  const [tab, setTab] = useState<TabMode>('paste');
  const [pastedText, setPastedText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedSpreadsheetItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Aba De Outra Proposta
  const [proposalsList, setProposalsList] = useState<ProposalSummary[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [sourceProposalItems, setSourceProposalItems] = useState<ProposalLine[]>([]);
  const [selectedSourceItemIds, setSelectedSourceItemIds] = useState<string[]>([]);
  const [loadingSourceProposal, setLoadingSourceProposal] = useState(false);

  // Aba De Kits
  const [kitsList, setKitsList] = useState<KitSummary[]>([]);
  const [selectedKitId, setSelectedKitId] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const [pResult, kResult] = await Promise.all([proposalApi.list(), kitsApi.list()]);
        setProposalsList(pResult.proposals.filter((p) => p.id !== proposal.id));
        setKitsList(kResult.kits);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Erro ao listar propostas ou kits.');
      }
    })();
  }, [open, proposal.id, onError]);

  const handleSelectProposal = async (proposalId: string) => {
    setSelectedProposalId(proposalId);
    if (!proposalId) {
      setSourceProposalItems([]);
      setSelectedSourceItemIds([]);
      return;
    }
    setLoadingSourceProposal(true);
    try {
      const res = await proposalApi.byId(proposalId);
      setSourceProposalItems(res.proposal.items);
      setSelectedSourceItemIds(res.proposal.items.map((i) => i.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao carregar itens da proposta selecionada.');
    } finally {
      setLoadingSourceProposal(false);
    }
  };

  const handleImportBatch = async () => {
    if (parsedItems.length === 0 || loading) return;
    setLoading(true);
    try {
      const res = await proposalApi.importBatch(proposal.id, parsedItems);
      onProposalUpdated(res.proposal);
      onNotice(`${parsedItems.length} item(ns) importado(s) com sucesso na proposta.`);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao importar itens.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFromProposal = async () => {
    if (!selectedProposalId || selectedSourceItemIds.length === 0 || loading) return;
    setLoading(true);
    try {
      const res = await proposalApi.copyFromProposal(proposal.id, selectedProposalId, selectedSourceItemIds);
      onProposalUpdated(res.proposal);
      onNotice(`${selectedSourceItemIds.length} item(ns) copiado(s) da proposta selecionada.`);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao copiar itens da proposta.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyKit = async () => {
    if (!selectedKitId || loading) return;
    setLoading(true);
    try {
      const res = await kitsApi.applyToProposal(selectedKitId, proposal.id);
      onProposalUpdated(res.proposal);
      onNotice('Itens do kit adicionados à proposta com sucesso.');
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao aplicar itens do kit.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop proposal-import-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog proposal-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proposal-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="proposal-import-header">
          <div className="title-group">
            <span className="icon-badge"><Upload size={20} /></span>
            <div>
              <h2 id="proposal-import-title">Importar Itens para a Proposta</h2>
              <p>Adicione itens em lote via planilha, a partir de outra proposta ou de kits cadastrados</p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <nav className="proposal-import-tabs" aria-label="Opções de importação">
          <button type="button" className={tab === 'paste' ? 'active' : ''} onClick={() => setTab('paste')}>
            <FileSpreadsheet size={15} /> Planilha / Colagem (CSV)
          </button>
          <button type="button" className={tab === 'proposal' ? 'active' : ''} onClick={() => setTab('proposal')}>
            <Copy size={15} /> De Outra Proposta
          </button>
          <button type="button" className={tab === 'kit' ? 'active' : ''} onClick={() => setTab('kit')}>
            <Layers3 size={15} /> De um Kit
          </button>
        </nav>

        <div className="proposal-import-body">
          {tab === 'paste' && (
            <ProposalImportPasteTab
              pastedText={pastedText}
              parsedItems={parsedItems}
              onTextChange={setPastedText}
              onParsedItemsChange={setParsedItems}
            />
          )}

          {tab === 'proposal' && (
            <ProposalImportProposalTab
              proposalsList={proposalsList}
              selectedProposalId={selectedProposalId}
              sourceProposalItems={sourceProposalItems}
              selectedSourceItemIds={selectedSourceItemIds}
              loadingSourceProposal={loadingSourceProposal}
              onSelectProposal={(id) => void handleSelectProposal(id)}
              onToggleItem={(id) => {
                setSelectedSourceItemIds((prev) =>
                  prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
                );
              }}
              onToggleAll={() => {
                if (selectedSourceItemIds.length === sourceProposalItems.length) {
                  setSelectedSourceItemIds([]);
                } else {
                  setSelectedSourceItemIds(sourceProposalItems.map((i) => i.id));
                }
              }}
            />
          )}

          {tab === 'kit' && (
            <div className="import-tab-pane">
              <label className="select-label">
                <span>Selecione o kit cadastrado:</span>
                <select value={selectedKitId} onChange={(e) => setSelectedKitId(e.target.value)}>
                  <option value="">Selecione um kit...</option>
                  {kitsList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} — {k.category} ({k.itemCount} itens)
                    </option>
                  ))}
                </select>
              </label>

              {selectedKitId && (
                <div className="kit-import-info">
                  <p>Todos os itens do kit serão inseridos no final da proposta com preços unitários congelados.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="proposal-import-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          {tab === 'paste' && (
            <button
              type="button"
              className="primary compact"
              disabled={parsedItems.length === 0 || loading}
              onClick={() => void handleImportBatch()}
            >
              {loading ? <Loader2 className="spinning" size={15} /> : <PlusCircle size={15} />}
              Importar {parsedItems.length > 0 ? `${parsedItems.length} itens` : 'Itens'}
            </button>
          )}
          {tab === 'proposal' && (
            <button
              type="button"
              className="primary compact"
              disabled={selectedSourceItemIds.length === 0 || loading}
              onClick={() => void handleCopyFromProposal()}
            >
              {loading ? <Loader2 className="spinning" size={15} /> : <Copy size={15} />}
              Copiar {selectedSourceItemIds.length > 0 ? `${selectedSourceItemIds.length} itens` : 'Itens'}
            </button>
          )}
          {tab === 'kit' && (
            <button
              type="button"
              className="primary compact"
              disabled={!selectedKitId || loading}
              onClick={() => void handleApplyKit()}
            >
              {loading ? <Loader2 className="spinning" size={15} /> : <Layers3 size={15} />}
              Adicionar Itens do Kit
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
