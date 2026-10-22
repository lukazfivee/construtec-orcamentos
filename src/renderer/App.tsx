import { useCallback, useEffect, useState } from 'react';
import type { AuthUser, ProposalDetail, ProposalSummary } from '../shared/contracts';
import { kitsApi, proposalApi } from './api';
import { AppSidebar } from './AppSidebar';
import type { NavSection } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { AssistantFab } from './AssistantFab';
import { CatalogWorkspace } from './CatalogWorkspace';
import { CentroCustosWorkspace } from './CentroCustosWorkspace';
import { ClientsWorkspace } from './ClientsWorkspace';
import { HomeWorkspace } from './HomeWorkspace';
import { KitsWorkspace } from './KitsWorkspace';
import { NewProposalDialog } from './NewProposalDialog';
import { ProposalCompareView } from './ProposalCompareView';
import { ProposalEditorWorkspace } from './ProposalEditorWorkspace';
import { ProposalPdfView } from './ProposalPdfView';
import { ProposalsListWorkspace } from './ProposalsListWorkspace';
import { SettingsWorkspace } from './SettingsWorkspace';
import type { ProposalViewMode } from './proposalNav';
import { countPendingProposals, INITIAL_PROPOSAL_VIEW_MODE, viewModeOnSelectNav } from './proposalNav';
import { useProposalDeepLink } from './useProposalDeepLink';
import { SuiteUserProvider, setCurrentSuiteUser } from './SuitePermissions';

export interface AppProps {
  user?: AuthUser | null;
  onLogout?: () => void;
}

export function App({ user, onLogout }: AppProps = {}) {
  setCurrentSuiteUser(user ?? null);
  const [activeNav, setActiveNav] = useState<NavSection>('Início');
  const [targetCostCenterId, setTargetCostCenterId] = useState<number | null>(null);
  const [targetCentroPath, setTargetCentroPath] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Os documentos sao gerados no fluxo unico "PDF da proposta"; nada no editor fica esperando arquivo.
  const documentPending = false;
  // Compartilhar (lista e editor) abre o PDF da proposta ja com o menu Compartilhar aberto.
  const [pdfShare, setPdfShare] = useState(false);
  const [proposalTabs, setProposalTabs] = useState<ProposalSummary[]>([]);
  const [newProposalOpen, setNewProposalOpen] = useState(false);
  const [proposalViewMode, setProposalViewMode] = useState<ProposalViewMode>(INITIAL_PROPOSAL_VIEW_MODE);
  // Comparativo (Rodada 23): revisao de partida (vazio = primeira x ultima) e aba com que o editor reabre ao voltar.
  const [compareFrom, setCompareFrom] = useState<string | undefined>(undefined);
  const [editorSection, setEditorSection] = useState<'Histórico' | undefined>(undefined);
  useEffect(() => {
    if (proposalViewMode === 'editor') setEditorSection(undefined);
  }, [proposalViewMode, activeNav]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingKitId, setPendingKitId] = useState<string | null>(null);

  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2600); };

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

  const openProposal = useCallback(async (proposalId: string): Promise<boolean> => {
    if (loading) return false;
    setLoading(true);
    setError('');
    try {
      const result = await proposalApi.byId(proposalId);
      setProposal(result.proposal);
      // So avisa o que muda o trabalho: revisao antiga abre somente leitura (abrir a atual nao gera aviso).
      if (!result.proposal.isLatest) showNotice('Revisão histórica aberta em modo somente leitura.');
      return true;
    } catch (revisionError) {
      setError(revisionError instanceof Error ? revisionError.message : 'Não foi possível abrir esta revisão.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useProposalDeepLink(!loading, (id) => {
    void openProposal(id).then((ok) => { if (ok) { setActiveNav('Propostas'); setProposalViewMode('editor'); } });
  });

  const proposalCreated = useCallback(async (created: ProposalDetail) => {
    setProposal(created);
    setNewProposalOpen(false);
    setProposalViewMode('editor');
    const kitId = pendingKitId;
    setPendingKitId(null);
    if (kitId) {
      // "Nova proposta com este kit" (Rodada 24): a proposta nasce e ja recebe os itens do kit.
      try {
        const applied = await kitsApi.applyToProposal(kitId, created.id);
        setProposal(applied.proposal);
        showNotice(`${created.number} criada na revisão 00, com os itens do kit.`);
      } catch (kitError) {
        setError(kitError instanceof Error ? kitError.message : 'A proposta foi criada, mas não deu para adicionar o kit.');
      }
    }
    const tabs = await proposalApi.list();
    setProposalTabs(tabs.proposals);
    if (!kitId) showNotice(`${created.number} criada na revisão 00.`);
  }, [pendingKitId]);

  // Abre uma proposta pela tela de Catalogo, Clientes ou Kits (Rodada 24).
  const openProposalFromList = useCallback(async (proposalId: string) => {
    await openProposal(proposalId);
    setActiveNav('Propostas');
    setProposalViewMode('editor');
  }, [openProposal]);

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

  // Ctrl P e Ctrl G levam ao mesmo fluxo do PDF da proposta (opcoes, previa, baixar PDF ou Word, compartilhar).
  const openPdf = useCallback((share = false) => {
    if (!proposal) return;
    setCatalogOpen(false);
    setPdfShare(share);
    setActiveNav('Propostas');
    setProposalViewMode('pdf');
  }, [proposal]);

  /* Busca do topo (Ctrl K): no editor abre a busca do catalogo; nas demais telas leva a lista de propostas e foca a busca dela. */
  const openSearch = useCallback(() => {
    if (activeNav === 'Propostas' && proposalViewMode === 'editor' && proposal) {
      setCatalogOpen(true);
      return;
    }
    setActiveNav('Propostas');
    setProposalViewMode('list');
    setCatalogOpen(false);
    window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-proposals-search]')?.focus(), 80);
  }, [activeNav, proposal, proposalViewMode]);

  useEffect(() => {
    const announce = (message: string) => {
      setNotice(message);
      window.setTimeout(() => setNotice(''), 2600);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        const action = event.key.toLowerCase();
        if (['k', 'i', 's', 'p', 'g'].includes(action)) event.preventDefault();
        if (action === 'k') {
          openSearch();
        } else if (action === 'i') {
          if (proposal?.isLatest) setCatalogOpen(true);
          else announce('Esta revisão é somente para consulta. Abra a revisão atual para editar.');
        } else if (action === 's') {
          void createRevision();
        } else if (action === 'p') {
          openPdf();
        } else if (action === 'g') {
          openPdf();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openSearch, createRevision, openPdf, proposal?.isLatest]);

  const selectNav = (label: NavSection) => {
    setActiveNav(label);
    setProposalViewMode(viewModeOnSelectNav());
    setCatalogOpen(false);
    setMobileMenuOpen(false);
    setError('');
  };
  const openCentroCustos = (ccId?: number, path?: string) => {
    setTargetCostCenterId(ccId ?? null);
    setTargetCentroPath(path ?? null);
    setActiveNav('Centro de Custos');
  };
  // Tela aberta, em texto, para o assistente de IA.
  const assistantScreen = activeNav === 'Propostas' && proposal && proposalViewMode !== 'list' ? `Propostas (proposta ${proposal.number} aberta)` : activeNav;

  return (
    <SuiteUserProvider value={user ?? null}>
    <div className="app-shell cc">
      <AppTopbar
        user={user}
        activeNav={activeNav}
        proposal={proposal}
        onOpenCatalog={() => setCatalogOpen(true)}
        onSearch={openSearch}
        onFollowNotice={(link) => {
          // Mesmo destino do celular: a proposta aqui; a obra no Centro de Custos.
          const [app, query] = link.split('?');
          const params = new URLSearchParams(query || '');
          if (app === 'orcamentos' && params.get('proposta')) {
            void openProposal(params.get('proposta') as string).then((ok) => { if (ok) { setActiveNav('Propostas'); setProposalViewMode('editor'); } });
          } else if (app === 'centro-custos') openCentroCustos(Number(params.get('obra')) || undefined, params.get('pedidos') === '1' ? '/usuarios' : undefined);
        }}
        editorOpen={activeNav === 'Propostas' && proposalViewMode === 'editor' && Boolean(proposal)}
        onLogout={onLogout}
        onSelectApp={(app) => {
          if (app === 'centro-custos') {
            if (window.location.pathname.startsWith('/orcamentos')) window.location.assign('/d/');
            else setActiveNav('Centro de Custos');
          } else if (app === 'orcamentos') {
            setActiveNav('Propostas');
            setProposalViewMode(viewModeOnSelectNav());
            setCatalogOpen(false);
          }
        }}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        showNotice={showNotice}
        assistantOpen={assistantOpen}
        onToggleAssistant={() => setAssistantOpen((open) => !open)}
      />

      <AppSidebar
        activeNav={activeNav}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => {
          setCatalogOpen(false);
          setMobileMenuOpen((open) => !open);
        }}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        pendingProposals={countPendingProposals(proposalTabs)}
        onSelectNav={selectNav}
        user={user}
        onLogout={onLogout}
      />

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
            if (await openProposal(proposalId)) setProposalViewMode('editor');
          }}
          onOpenPdf={async (proposalId, share) => {
            if (!(await openProposal(proposalId))) return;
            setCatalogOpen(false);
            setPdfShare(share);
            setProposalViewMode('pdf');
          }}
          onNewProposal={() => {
            setError('');
            setNewProposalOpen(true);
          }}
          onError={setError}
          onNotice={showNotice}
        />
      ) : activeNav === 'Propostas' && proposal && proposalViewMode === 'pdf' ? (
        <ProposalPdfView
          key={`proposal-pdf-${proposal.id}`}
          proposalId={proposal.id}
          initialShare={pdfShare}
          onBack={() => setProposalViewMode('editor')}
          onAddItems={() => { setProposalViewMode('editor'); setCatalogOpen(true); }}
          onProposalUpdate={setProposal}
          onProposalTabsReload={() => { void proposalApi.list().then((tabs) => setProposalTabs(tabs.proposals)).catch(() => undefined); }}
          showNotice={showNotice}
        />
      ) : activeNav === 'Propostas' && proposal && proposalViewMode === 'compare' ? (
        <ProposalCompareView
          key={`proposal-compare-${proposal.id}-${compareFrom ?? 'all'}`}
          proposalId={proposal.id}
          initialFrom={compareFrom}
          onBack={() => { setEditorSection('Histórico'); setProposalViewMode('editor'); }}
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
          onOpenProposal={async (id) => { await openProposal(id); }}
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
          initialSection={editorSection}
          onOpenPdf={(share?: boolean) => openPdf(share === true)}
          onOpenCompare={(fromRevisionId) => { setCatalogOpen(false); setCompareFrom(fromRevisionId); setProposalViewMode('compare'); }}
          onNavigateToCentroCustos={openCentroCustos}
          showNotice={showNotice}
          setError={setError}
        />
      ) : activeNav === 'Início' ? (
        <HomeWorkspace
          key="home"
          onOpenProposal={async (proposalId) => {
            if (!(await openProposal(proposalId))) return;
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
          targetPath={targetCentroPath}
          onBackToProposal={() => {
            setActiveNav('Propostas');
            setProposalViewMode('editor');
          }}
          onNotice={showNotice}
        />
      ) : activeNav === 'Catálogo' ? (
        <CatalogWorkspace key="catalog" onNotice={showNotice} onError={setError} onOpenProposal={(id) => void openProposalFromList(id)} />
      ) : activeNav === 'Clientes' ? (
        <ClientsWorkspace key="clients" onNotice={showNotice} onError={setError} onOpenProposal={(id) => void openProposalFromList(id)} />
      ) : activeNav === 'Kits' ? (
        <KitsWorkspace
          key="kits"
          activeProposal={proposal}
          onOpenProposal={(id) => void openProposalFromList(id)}
          onNewProposalWithKit={(kitId) => { setError(''); setPendingKitId(kitId); setNewProposalOpen(true); }}
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
        onClose={() => { setNewProposalOpen(false); setPendingKitId(null); }}
        onCreated={(created) => void proposalCreated(created)}
        onError={setError}
      />
      <AssistantFab
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        user={user}
        screen={assistantScreen}
        onProposalCreated={(created) => { setActiveNav('Propostas'); void proposalCreated(created); }}
        openProposal={(id) => void openProposalFromList(id)}
        navigate={selectNav}
        newProposal={() => { setError(''); setNewProposalOpen(true); }}
        openCentroCustos={openCentroCustos}
      />
    </div>
    </SuiteUserProvider>
  );
}
