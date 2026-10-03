import { useCallback, useEffect, useState } from 'react';
import type { AuthUser, ProposalDetail, ProposalSummary } from '../shared/contracts';
import { kitsApi, proposalApi } from './api';
import { AppSidebar } from './AppSidebar';
import type { NavSection } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
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
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documentPending, setDocumentPending] = useState(false);
  const [proposalTabs, setProposalTabs] = useState<ProposalSummary[]>([]);
  const [newProposalOpen, setNewProposalOpen] = useState(false);
  const [proposalViewMode, setProposalViewMode] = useState<'editor' | 'list' | 'pdf' | 'compare'>('editor');
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

  useProposalDeepLink(!loading, (id) => {
    void openProposal(id).then(() => { setActiveNav('Propostas'); setProposalViewMode('editor'); });
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
    <SuiteUserProvider value={user ?? null}>
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
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        showNotice={showNotice}
      />

      <AppSidebar
        activeNav={activeNav}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => {
          setCatalogOpen(false);
          setMobileMenuOpen((open) => !open);
        }}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onSelectNav={(label) => {
          setActiveNav(label);
          setCatalogOpen(false);
          setMobileMenuOpen(false);
          setError('');
        }}
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
      ) : activeNav === 'Propostas' && proposal && proposalViewMode === 'pdf' ? (
        <ProposalPdfView
          key={`proposal-pdf-${proposal.id}`}
          proposalId={proposal.id}
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
          initialSection={editorSection}
          onOpenPdf={() => { setCatalogOpen(false); setProposalViewMode('pdf'); }}
          onOpenCompare={(fromRevisionId) => { setCatalogOpen(false); setCompareFrom(fromRevisionId); setProposalViewMode('compare'); }}
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
    </div>
    </SuiteUserProvider>
  );
}
