import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  ChevronLeft,
  FileText,
  Grid2X2,
  Layers3,
  Settings,
  Users,
} from 'lucide-react';
import type { AuthUser, ProposalDetail, ProposalSummary } from '../shared/contracts';
import { kitsApi, proposalApi } from './api';
import { AppTopbar } from './AppTopbar';
import { CatalogWorkspace } from './CatalogWorkspace';
import { ClientsWorkspace } from './ClientsWorkspace';
import { HomeWorkspace } from './HomeWorkspace';
import { KitsWorkspace } from './KitsWorkspace';
import { NewProposalDialog } from './NewProposalDialog';
import { ProposalEditorWorkspace } from './ProposalEditorWorkspace';
import { ProposalsListWorkspace } from './ProposalsListWorkspace';
import { SettingsWorkspace } from './SettingsWorkspace';

const navItems = [
  { label: 'Início', icon: Grid2X2 },
  { label: 'Propostas', icon: FileText },
  { label: 'Catálogo', icon: Box },
  { label: 'Clientes', icon: Users },
  { label: 'Kits', icon: Layers3 },
  { label: 'Configurações', icon: Settings },
];

export interface AppProps {
  user?: AuthUser | null;
  onLogout?: () => void;
}

export function App({ user, onLogout }: AppProps = {}) {
  const [activeNav, setActiveNav] = useState<'Início' | 'Propostas' | 'Catálogo' | 'Clientes' | 'Kits' | 'Configurações'>('Início');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documentPending, setDocumentPending] = useState(false);
  const [proposalTabs, setProposalTabs] = useState<ProposalSummary[]>([]);
  const [newProposalOpen, setNewProposalOpen] = useState(false);
  const [proposalViewMode, setProposalViewMode] = useState<'editor' | 'list'>('editor');

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const loadProposal = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [result, tabsResult] = await Promise.all([proposalApi.current(), proposalApi.list()]);
      setProposal(result.proposal);
      setProposalTabs(tabsResult.proposals);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a proposta local.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProposal();
  }, [loadProposal]);

  const openProposal = useCallback(async (proposalId: string) => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await proposalApi.byId(proposalId);
      setProposal(result.proposal);
      showNotice(result.proposal.isLatest ? 'Revisão atual aberta.' : 'Revisão histórica aberta em modo somente leitura.');
    } catch (revisionError) {
      setError(revisionError instanceof Error ? revisionError.message : 'Não foi possível abrir esta revisão.');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const proposalCreated = useCallback(async (created: ProposalDetail) => {
    setProposal(created);
    setNewProposalOpen(false);
    setProposalViewMode('editor');
    const tabs = await proposalApi.list();
    setProposalTabs(tabs.proposals);
    showNotice(`${created.number} criada na revisão 00.`);
  }, []);

  const createRevision = useCallback(async () => {
    if (!proposal?.isLatest) return;
    setError('');
    setCatalogOpen(false);
    try {
      const result = await proposalApi.createRevision(proposal.id);
      setProposal(result.proposal);
      showNotice(`REV.${String(result.proposal.revision).padStart(2, '0')} criada. A versão anterior foi preservada.`);
    } catch (revisionError) {
      setError(revisionError instanceof Error ? revisionError.message : 'Não foi possível criar a revisão.');
    }
  }, [proposal]);

  const previewProposal = useCallback(async () => {
    if (!proposal || documentPending) return;
    setDocumentPending(true);
    setError('');
    try {
      if (window.construtec?.previewProposal) {
        await window.construtec.previewProposal(proposal);
      } else {
        window.print();
      }
      showNotice('Pré-visualização da proposta aberta.');
    } catch (documentError) {
      setError(documentError instanceof Error ? documentError.message : 'Não foi possível abrir a pré-visualização.');
    } finally {
      setDocumentPending(false);
    }
  }, [documentPending, proposal]);

  const exportProposal = useCallback(async () => {
    if (!proposal || documentPending) return;
    setDocumentPending(true);
    setError('');
    try {
      if (window.construtec?.exportProposal) {
        await window.construtec.exportProposal(proposal);
        showNotice('Proposta gerada em PDF e Word com sucesso.');
      } else {
        window.print();
        showNotice('Use a opção "Salvar como PDF" do navegador.');
      }
    } catch (documentError) {
      setError(documentError instanceof Error ? documentError.message : 'Não foi possível gerar os documentos.');
    } finally {
      setDocumentPending(false);
    }
  }, [documentPending, proposal]);

  useEffect(() => {
    const announce = (message: string) => {
      setNotice(message);
      window.setTimeout(() => setNotice(''), 2600);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        const action = event.key.toLowerCase();
        if (['k', 'i', 's', 'p', 'g'].includes(action)) event.preventDefault();
        if (action === 'k' && activeNav === 'Propostas') {
          setCatalogOpen(true);
          announce('Busca local aberta.');
        } else if (action === 'i') {
          if (proposal?.isLatest) setCatalogOpen(true);
          else announce('Esta revisão é somente para consulta. Abra a revisão atual para editar.');
        } else if (action === 's') {
          void createRevision();
        } else if (action === 'p') {
          void previewProposal();
        } else if (action === 'g') {
          void exportProposal();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeNav, createRevision, exportProposal, previewProposal, proposal?.isLatest]);

  return (
    <div className="app-shell">
      <AppTopbar
        user={user}
        activeNav={activeNav}
        proposal={proposal}
        onOpenCatalog={() => setCatalogOpen(true)}
        onLogout={onLogout}
        showNotice={showNotice}
      />

      <aside className="sidebar" aria-label="Navegação principal">
        <nav>
          {navItems.map(({ label, icon: Icon }) => {
            const active = label === activeNav;
            return (
              <button
                key={label}
                type="button"
                className={active ? 'active' : ''}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  setActiveNav(label as 'Início' | 'Propostas' | 'Catálogo' | 'Clientes' | 'Kits' | 'Configurações');
                  setCatalogOpen(false);
                  setError('');
                }}
              >
                <Icon size={22} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
        <button className="collapse" type="button">
          <ChevronLeft size={17} />
          <span>Recolher</span>
        </button>
      </aside>

      {activeNav !== 'Propostas' && error && (
        <div className="global-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>Fechar</button>
        </div>
      )}

      {activeNav === 'Propostas' && (proposalViewMode === 'list' || !proposal) ? (
        <ProposalsListWorkspace
          onOpenProposal={async (proposalId) => {
            await openProposal(proposalId);
            setProposalViewMode('editor');
          }}
          onNewProposal={() => {
            setError('');
            setNewProposalOpen(true);
          }}
          onError={setError}
          onNotice={showNotice}
        />
      ) : activeNav === 'Propostas' && proposal ? (
        <ProposalEditorWorkspace
          proposal={proposal}
          proposalTabs={proposalTabs}
          loading={loading}
          error={error}
          catalogOpen={catalogOpen}
          setCatalogOpen={setCatalogOpen}
          documentPending={documentPending}
          onOpenProposal={openProposal}
          onProposalUpdate={setProposal}
          onProposalTabsUpdate={setProposalTabs}
          onViewList={() => setProposalViewMode('list')}
          onNewProposal={() => {
            setError('');
            setNewProposalOpen(true);
          }}
          onManageClients={() => {
            setActiveNav('Clientes');
            setError('');
          }}
          onCreateRevision={() => void createRevision()}
          onPreviewProposal={() => void previewProposal()}
          onExportProposal={() => void exportProposal()}
          showNotice={showNotice}
          setError={setError}
        />
      ) : activeNav === 'Início' ? (
        <HomeWorkspace
          onOpenProposal={async (proposalId) => {
            await openProposal(proposalId);
            setActiveNav('Propostas');
            setProposalViewMode('editor');
          }}
          onNewProposal={() => {
            setError('');
            setNewProposalOpen(true);
          }}
          onNavigate={(section) => {
            setActiveNav(section);
            setError('');
          }}
          onError={setError}
        />
      ) : activeNav === 'Catálogo' ? (
        <CatalogWorkspace onNotice={showNotice} onError={setError} />
      ) : activeNav === 'Clientes' ? (
        <ClientsWorkspace onNotice={showNotice} onError={setError} />
      ) : activeNav === 'Kits' ? (
        <KitsWorkspace
          activeProposal={proposal}
          onApplyKitToProposal={async (kitId) => {
            if (!proposal) return;
            try {
              await kitsApi.applyToProposal(kitId, proposal.id);
              await loadProposal();
              setActiveNav('Propostas');
              setProposalViewMode('editor');
              showNotice(`Itens do kit adicionados à proposta ${proposal.number}.`);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Erro ao aplicar kit.');
            }
          }}
          onNotice={showNotice}
          onError={setError}
        />
      ) : (
        <SettingsWorkspace onNotice={showNotice} onError={setError} />
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
      <NewProposalDialog
        open={newProposalOpen}
        onClose={() => setNewProposalOpen(false)}
        onCreated={(created) => void proposalCreated(created)}
        onError={setError}
      />
    </div>
  );
}
