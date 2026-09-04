import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Box,
  ChevronDown,
  ChevronLeft,
  FileText,
  Grid2X2,
  HelpCircle,
  Layers3,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import type { ProposalDetail, ProposalSummary } from '../shared/contracts';
import { kitsApi, proposalApi } from './api';
import { CatalogWorkspace } from './CatalogWorkspace';
import { ClientsWorkspace } from './ClientsWorkspace';
import { HomeWorkspace } from './HomeWorkspace';
import { KitsWorkspace } from './KitsWorkspace';
import { NewProposalDialog } from './NewProposalDialog';
import { ProposalEditorWorkspace } from './ProposalEditorWorkspace';
import { ProposalsListWorkspace } from './ProposalsListWorkspace';
import { SettingsWorkspace } from './SettingsWorkspace';

const brandLogo = new URL('../assets/logo-branca.png', import.meta.url).href;

const navItems = [
  { label: 'Início', icon: Grid2X2 },
  { label: 'Propostas', icon: FileText },
  { label: 'Catálogo', icon: Box },
  { label: 'Clientes', icon: Users },
  { label: 'Kits', icon: Layers3 },
  { label: 'Configurações', icon: Settings },
];

export function App() {
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
      await window.construtec?.previewProposal(proposal);
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
      await window.construtec?.exportProposal(proposal);
      showNotice('Proposta gerada em PDF e Word com sucesso.');
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
      <header className="topbar">
        <div className="brand">
          <img src={brandLogo} alt="" />
          <span>Orçamentos</span>
        </div>
        <div className="local-state">
          <span aria-hidden="true" /> Offline{' '}
          <button type="button" onClick={() => showNotice('Os dados desta versão ficam armazenados localmente neste computador.')}>
            Dados locais <ChevronDown size={14} />
          </button>
        </div>
        <button className="global-search" type="button" disabled={activeNav !== 'Propostas'} onClick={() => setCatalogOpen(true)}>
          <Search size={17} />
          <span>{activeNav === 'Propostas' ? 'Buscar no catálogo' : 'Busca disponível em Propostas'}</span>
          {activeNav === 'Propostas' && <kbd>Ctrl+K</kbd>}
        </button>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notificações (indisponível)" aria-disabled="true" type="button" disabled title="Notificações serão implementadas em uma próxima etapa.">
            <Bell size={18} />
          </button>
          <button className="icon-button" aria-label="Ajuda (indisponível)" aria-disabled="true" type="button" disabled title="A central de ajuda será implementada em uma próxima etapa.">
            <HelpCircle size={18} />
          </button>
          <span className="divider" />
          <button className="profile" aria-disabled="true" type="button" disabled title="Gestão de perfil será implementada em uma próxima etapa.">
            <span>MR</span>
            <b>Marcos Ribeiro</b>
            <ChevronDown size={14} />
          </button>
        </div>
      </header>

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
