import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  ChevronLeft,
  FileText,
  Grid2X2,
  Layers3,
  Menu,
  Settings,
  Users,
} from 'lucide-react';
import type { AuthUser, ProposalDetail, ProposalSummary } from '../shared/contracts';
import { kitsApi, proposalApi } from './api';
import { AppTopbar } from './AppTopbar';
import { CatalogWorkspace } from './CatalogWorkspace';
import { CentroCustosWorkspace } from './CentroCustosWorkspace';
import { ClientsWorkspace } from './ClientsWorkspace';
import { HomeWorkspace } from './HomeWorkspace';
import { KitsWorkspace } from './KitsWorkspace';
import { NewProposalDialog } from './NewProposalDialog';
import { ProposalEditorWorkspace } from './ProposalEditorWorkspace';
import { ProposalsListWorkspace } from './ProposalsListWorkspace';
import { SettingsWorkspace } from './SettingsWorkspace';

type NavSection = 'Início' | 'Propostas' | 'Centro de Custos' | 'Catálogo' | 'Clientes' | 'Kits' | 'Configurações';

type NavItem = { label: NavSection; icon: typeof Grid2X2 };

/* Desktop mantem a navegacao completa na lateral. */
const navItems: NavItem[] = [
  { label: 'Início', icon: Grid2X2 },
  { label: 'Propostas', icon: FileText },
  { label: 'Catálogo', icon: Box },
  { label: 'Clientes', icon: Users },
  { label: 'Kits', icon: Layers3 },
  { label: 'Configurações', icon: Settings },
];

/* Barra inferior no celular: tres destinos de uso diario. Espelha o padrao do
   Centro de Custos, onde a barra carrega poucos itens largos em vez de uma
   tira comprimida com todos. */
const mobilePrimaryNav: NavItem[] = [
  { label: 'Início', icon: Grid2X2 },
  { label: 'Propostas', icon: FileText },
  { label: 'Kits', icon: Layers3 },
];

/* "Menu" desliza o mesmo painel completo de navegacao usado no desktop,
   igual ao Centro de Custos: nao um subconjunto separado. */

export interface AppProps {
  user?: AuthUser | null;
  onLogout?: () => void;
}

export function App({ user, onLogout }: AppProps = {}) {
  const [activeNav, setActiveNav] = useState<NavSection>('Início');
  const [targetCostCenterId, setTargetCostCenterId] = useState<number | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documentPending, setDocumentPending] = useState(false);
  const [proposalTabs, setProposalTabs] = useState<ProposalSummary[]>([]);
  const [newProposalOpen, setNewProposalOpen] = useState(false);
  const [proposalViewMode, setProposalViewMode] = useState<'editor' | 'list'>('editor');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        onSelectApp={(app) => {
          if (app === 'centro-custos') {
            if (window.location.pathname.startsWith('/orcamentos')) window.location.assign('/');
            else setActiveNav('Centro de Custos');
          } else if (app === 'orcamentos') {
            setActiveNav('Propostas');
          }
        }}
        showNotice={showNotice}
      />

      <aside className="sidebar" aria-label="Navegação principal">
        <nav>
          <span className="sidebar-mobile-only" aria-hidden="true">
            {mobilePrimaryNav.map(({ label, icon: Icon }) => {
              const active = label === activeNav;
              return (
                <button
                  key={label}
                  type="button"
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setActiveNav(label);
                    setCatalogOpen(false);
                    setMobileMenuOpen(false);
                    setError('');
                  }}
                >
                  <Icon size={22} />
                  <span>{label}</span>
                </button>
              );
            })}
            <button
              type="button"
              className={mobileMenuOpen ? 'active' : ''}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-menu"
              onClick={() => {
                setCatalogOpen(false);
                setMobileMenuOpen((open) => !open);
              }}
            >
              <Menu size={22} />
              <span>Menu</span>
            </button>
          </span>
          <span className="sidebar-desktop-only">
            {navItems.map(({ label, icon: Icon }) => {
              const active = label === activeNav;
              return (
                <button
                  key={label}
                  type="button"
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setActiveNav(label);
                    setCatalogOpen(false);
                    setMobileMenuOpen(false);
                    setError('');
                  }}
                >
                  <Icon size={22} />
                  <span>{label}</span>
                </button>
              );
            })}
          </span>
        </nav>
      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-nav-scrim"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div
        className={`mobile-nav-menu ${mobileMenuOpen ? 'open' : ''}`}
        id="mobile-nav-menu"
        role="menu"
        aria-label="Navegação completa"
        aria-hidden={!mobileMenuOpen}
      >
        {navItems.map(({ label, icon: Icon }) => {
          const active = label === activeNav;
          return (
            <button
              key={label}
              type="button"
              role="menuitem"
              className={active ? 'active' : ''}
              aria-current={active ? 'page' : undefined}
              tabIndex={mobileMenuOpen ? 0 : -1}
              onClick={() => {
                setActiveNav(label);
                setCatalogOpen(false);
                setMobileMenuOpen(false);
                setError('');
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
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
          key="proposals-list"
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
          key="proposal-editor"
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
          onNavigateToCentroCustos={(ccId) => {
            setTargetCostCenterId(ccId ?? null);
            setActiveNav('Centro de Custos');
          }}
          showNotice={showNotice}
          setError={setError}
        />
      ) : activeNav === 'Início' ? (
        <HomeWorkspace
          key="home"
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
      ) : activeNav === 'Centro de Custos' ? (
        <CentroCustosWorkspace
          key="centro-custos"
          activeProposal={proposal}
          targetCostCenterId={targetCostCenterId}
          onBackToProposal={() => {
            setActiveNav('Propostas');
            setProposalViewMode('editor');
          }}
          onNotice={showNotice}
        />
      ) : activeNav === 'Catálogo' ? (
        <CatalogWorkspace key="catalog" onNotice={showNotice} onError={setError} />
      ) : activeNav === 'Clientes' ? (
        <ClientsWorkspace key="clients" onNotice={showNotice} onError={setError} />
      ) : activeNav === 'Kits' ? (
        <KitsWorkspace
          key="kits"
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
        <SettingsWorkspace key="settings" onNotice={showNotice} onError={setError} />
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
