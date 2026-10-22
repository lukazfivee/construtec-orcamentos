import { useEffect, useState } from 'react';
import {
  Copy,
  FileSpreadsheet,
  Layers3,
  Loader2,
  PlusCircle,
  Upload,
} from 'lucide-react';
import { plural } from '../shared/formatoBr';
import type { KitSummary, ProposalDetail, ProposalLine, ProposalSummary } from '../shared/contracts';
import { Dialogo } from './orcDeskUi';
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
    <Dialogo
      id="proposal-import"
      icon={Upload}
      title="Importar itens"
      sub="De uma planilha, de outra proposta ou de um kit cadastrado"
      className="w-lg import-dlg"
      busy={loading}
      onClose={onClose}
      toolbar={(
        <nav className="dlg-tabs" aria-label="Origem dos itens">
          <button type="button" className={tab === 'paste' ? 'active' : ''} aria-pressed={tab === 'paste'} onClick={() => setTab('paste')}>
            <FileSpreadsheet size={15} /> Planilha
          </button>
          <button type="button" className={tab === 'proposal' ? 'active' : ''} aria-pressed={tab === 'proposal'} onClick={() => setTab('proposal')}>
            <Copy size={15} /> Outra proposta
          </button>
          <button type="button" className={tab === 'kit' ? 'active' : ''} aria-pressed={tab === 'kit'} onClick={() => setTab('kit')}>
            <Layers3 size={15} /> Kit
          </button>
        </nav>
      )}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={loading}>Cancelar</button>
          {tab === 'paste' && (
            <button type="button" className="primary" disabled={parsedItems.length === 0 || loading} onClick={() => void handleImportBatch()}>
              {loading ? <Loader2 className="spinning" size={16} /> : <PlusCircle size={16} />}
              {parsedItems.length > 0 ? `Importar ${plural(parsedItems.length, 'item', 'itens')}` : 'Importar itens'}
            </button>
          )}
          {tab === 'proposal' && (
            <button type="button" className="primary" disabled={selectedSourceItemIds.length === 0 || loading} onClick={() => void handleCopyFromProposal()}>
              {loading ? <Loader2 className="spinning" size={16} /> : <Copy size={16} />}
              {selectedSourceItemIds.length > 0 ? `Copiar ${plural(selectedSourceItemIds.length, 'item', 'itens')}` : 'Copiar itens'}
            </button>
          )}
          {tab === 'kit' && (
            <button type="button" className="primary" disabled={!selectedKitId || loading} onClick={() => void handleApplyKit()}>
              {loading ? <Loader2 className="spinning" size={16} /> : <Layers3 size={16} />}
              Adicionar itens do kit
            </button>
          )}
        </>
      )}
    >
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
                <span className="dlg-label">Kit</span>
                <select className="od-inp" value={selectedKitId} onChange={(e) => setSelectedKitId(e.target.value)}>
                  <option value="">Selecione um kit</option>
                  {kitsList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} — {k.category} ({k.itemCount} itens)
                    </option>
                  ))}
                </select>
              </label>

              {selectedKitId && (
                <p className="dlg-note">Todos os itens do kit entram no fim da proposta, com os preços unitários de hoje.</p>
              )}
            </div>
          )}
        </div>
    </Dialogo>
  );
}
