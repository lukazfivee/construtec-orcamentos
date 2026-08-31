import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bell,
  Box,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  Eye,
  ExternalLink,
  FilePlus2,
  FileText,
  Filter,
  Grid2X2,
  HelpCircle,
  History as HistoryIcon,
  Layers3,
  LayoutList,
  LockKeyhole,
  MapPin,
  Plus,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import type { CatalogProduct, ClientRecord, ProposalDetail, ProposalRevisionSummary, ProposalSummary } from '../shared/contracts';
import { clientsApi, kitsApi, proposalApi } from './api';
import { ClientsWorkspace } from './ClientsWorkspace';
import { NewProposalDialog } from './NewProposalDialog';
import { CatalogWorkspace } from './CatalogWorkspace';
import { ProposalLaborPanel } from './ProposalLaborPanel';
import { HomeWorkspace } from './HomeWorkspace';
import { KitsWorkspace } from './KitsWorkspace';
import { SettingsWorkspace } from './SettingsWorkspace';
import { ProposalKitsPanel } from './ProposalKitsPanel';
import { ProposalsListWorkspace } from './ProposalsListWorkspace';

const statusClasses: Record<ProposalDetail['status'], string> = {
  draft: 'status-draft',
  review: 'status-review',
  sent: 'status-sent',
  approved: 'status-approved',
  rejected: 'status-rejected',
};

const navItems = [
  { label: 'Início', icon: Grid2X2 },
  { label: 'Propostas', icon: FileText },
  { label: 'Catálogo', icon: Box },
  { label: 'Clientes', icon: Users },
  { label: 'Kits', icon: Layers3 },
  { label: 'Configurações', icon: Settings },
];

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const sectionTabs = [
  { label: 'Itens', enabled: true },
  { label: 'Mão de obra', enabled: true },
  { label: 'Kits', enabled: true },
  { label: 'Condições', enabled: true },
  { label: 'Histórico', enabled: true },
] as const;

type ActiveSection = typeof sectionTabs[number]['label'];
type CommercialConditions = {
  scope: string;
  executionTerm: string;
  paymentTerms: string;
  warranty: string;
  notes: string;
};

const statusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

const emptyConditions = (scope = ''): CommercialConditions => ({
  scope: scope.trim(),
  executionTerm: '',
  paymentTerms: '',
  warranty: '',
  notes: '',
});

const fieldFromLines = (lines: string[], names: string[]) => {
  const prefixes = names.map((name) => `${name}:`.toLowerCase());
  const found = lines.find((line) => prefixes.some((prefix) => line.toLowerCase().startsWith(prefix)));
  return found ? found.slice(found.indexOf(':') + 1).trim() : '';
};

const parseCommercialConditions = (scope: string): CommercialConditions => {
  try {
    const parsed = JSON.parse(scope) as Partial<CommercialConditions>;
    if (parsed && typeof parsed === 'object' && typeof parsed.scope === 'string') {
      return {
        scope: parsed.scope.trim(),
        executionTerm: typeof parsed.executionTerm === 'string' ? parsed.executionTerm.trim() : '',
        paymentTerms: typeof parsed.paymentTerms === 'string' ? parsed.paymentTerms.trim() : '',
        warranty: typeof parsed.warranty === 'string' ? parsed.warranty.trim() : '',
        notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
      };
    }
  } catch {
    const lines = scope.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const lineScope = fieldFromLines(lines, ['escopo', 'scope']);
    if (lineScope) {
      return {
        scope: lineScope,
        executionTerm: fieldFromLines(lines, ['prazo', 'prazo de execução', 'execução']),
        paymentTerms: fieldFromLines(lines, ['pagamento', 'forma de pagamento']),
        warranty: fieldFromLines(lines, ['garantia']),
        notes: fieldFromLines(lines, ['observações', 'observacao', 'observacoes', 'notas']),
      };
    }
  }
  return emptyConditions(scope);
};

const serializeCommercialConditions = (conditions: CommercialConditions) => JSON.stringify(conditions);

export function App() {
  const [activeNav, setActiveNav] = useState<'Início' | 'Propostas' | 'Catálogo' | 'Clientes' | 'Kits' | 'Configurações'>('Início');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [query, setQuery] = useState('leit');
  const [notice, setNotice] = useState('');
  const [selectedCatalogIndex, setSelectedCatalogIndex] = useState(0);
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [catalogResults, setCatalogResults] = useState<CatalogProduct[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [mutationPending, setMutationPending] = useState(false);
  const [error, setError] = useState('');
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [bdiDraft, setBdiDraft] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('Itens');
  const [laborTotal, setLaborTotal] = useState(0);
  const [revisions, setRevisions] = useState<ProposalRevisionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextQuery, setContextQuery] = useState('');
  const [contextClients, setContextClients] = useState<ClientRecord[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [documentPending, setDocumentPending] = useState(false);
  const [proposalTabs, setProposalTabs] = useState<ProposalSummary[]>([]);
  const [newProposalOpen, setNewProposalOpen] = useState(false);
  const [proposalViewMode, setProposalViewMode] = useState<'editor' | 'list'>('editor');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const catalogInputRef = useRef<HTMLInputElement>(null);

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
      setSelectedItemIds([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a proposta local.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProposal();
  }, [loadProposal]);

  useEffect(() => {
    if (!proposal?.id) {
      setLaborTotal(0);
      return;
    }
    let active = true;
    void proposalApi.labor(proposal.id).then((result) => {
      if (active) setLaborTotal(result.items.reduce((total, item) => total + item.totalCost, 0));
    }).catch((laborError: unknown) => {
      if (active) setError(laborError instanceof Error ? laborError.message : 'Não foi possível carregar o total de mão de obra.');
    });
    return () => { active = false; };
  }, [proposal?.id]);

  useEffect(() => {
    if (!catalogOpen) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatalogLoading(true);
      try {
        const result = await proposalApi.catalog(query, controller.signal);
        setCatalogResults(result.products);
        setSelectedCatalogIndex(0);
      } catch (catalogError) {
        if (!controller.signal.aborted) {
          setError(catalogError instanceof Error ? catalogError.message : 'Não foi possível pesquisar o catálogo local.');
        }
      } finally {
        if (!controller.signal.aborted) setCatalogLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [catalogOpen, query]);

  useEffect(() => {
    if (!contextOpen) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setContextLoading(true);
      try {
        const result = await clientsApi.list(contextQuery);
        if (active) setContextClients(result.clients);
      } catch (contextError) {
        if (active) setError(contextError instanceof Error ? contextError.message : 'Não foi possível carregar clientes e obras.');
      } finally {
        if (active) setContextLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [contextOpen, contextQuery]);

  const addCatalogItem = useCallback(async (product: CatalogProduct) => {
    if (!proposal?.isLatest || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.addItem(proposal.id, product.id);
      setProposal(result.proposal);
      setCatalogOpen(false);
      showNotice(`${product.description} adicionado com preço congelado.`);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível adicionar o item.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal]);

  const removeSelectedItems = useCallback(async () => {
    if (!proposal || selectedItemIds.length === 0 || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.removeItems(proposal.id, selectedItemIds);
      setProposal(result.proposal);
      showNotice(`${selectedItemIds.length} ${selectedItemIds.length === 1 ? 'item removido' : 'itens removidos'}.`);
      setSelectedItemIds([]);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível excluir os itens.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal, selectedItemIds]);

  const parseDecimal = (value: string) => Number(value.trim().replace(',', '.'));
  const formatDecimal = (value: number) => String(value).replace('.', ',');

  const updateQuantity = useCallback(async (itemId: string, value: string) => {
    if (!proposal || mutationPending) return;
    const nextQuantity = parseDecimal(value);
    const currentItem = proposal.items.find((item) => item.id === itemId);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0 || nextQuantity > 1_000_000) {
      setQuantityDrafts((current) => ({ ...current, [itemId]: formatDecimal(currentItem?.quantity ?? 1) }));
      showNotice('Informe uma quantidade maior que zero.');
      return;
    }
    if (currentItem?.quantity === nextQuantity) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateQuantity(proposal.id, itemId, nextQuantity);
      setProposal(result.proposal);
      setQuantityDrafts((current) => ({ ...current, [itemId]: formatDecimal(nextQuantity) }));
      showNotice('Quantidade atualizada e totais recalculados.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível alterar a quantidade.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal]);

  const updateItemText = useCallback(async (itemId: string, field: 'description' | 'unit', value: string) => {
    if (!proposal || mutationPending) return;
    const currentItem = proposal.items.find((item) => item.id === itemId);
    const nextValue = value.trim();
    if (!currentItem || currentItem[field] === nextValue) return;
    if (nextValue.length < (field === 'description' ? 2 : 1)) {
      showNotice(field === 'description' ? 'Informe uma descrição válida.' : 'Informe uma unidade válida.');
      return;
    }
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateItem(proposal.id, itemId, { [field]: nextValue });
      setProposal(result.proposal);
      showNotice('Item atualizado.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível atualizar o item.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal]);

  const updateItemMoney = useCallback(async (itemId: string, field: 'unitCost' | 'unitSale', value: string) => {
    if (!proposal || mutationPending) return;
    const currentItem = proposal.items.find((item) => item.id === itemId);
    const nextValue = parseDecimal(value);
    if (!currentItem || currentItem[field] === nextValue) return;
    if (!Number.isFinite(nextValue) || nextValue < 0 || nextValue > 100_000_000) {
      showNotice('Informe um valor válido.');
      return;
    }
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateItem(proposal.id, itemId, { [field]: nextValue });
      setProposal(result.proposal);
      showNotice('Item atualizado e totais recalculados.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível atualizar o item.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal]);

  const duplicateSelectedItem = useCallback(async () => {
    if (!proposal || selectedItemIds.length !== 1 || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.duplicateItem(proposal.id, selectedItemIds[0]);
      setProposal(result.proposal);
      setSelectedItemIds([]);
      showNotice('Item duplicado.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível duplicar o item.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal, selectedItemIds]);

  const moveSelectedItem = useCallback(async (direction: 'up' | 'down') => {
    if (!proposal || selectedItemIds.length !== 1 || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.moveItem(proposal.id, selectedItemIds[0], direction);
      setProposal(result.proposal);
      showNotice('Item movido.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível mover o item.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal, selectedItemIds]);

  const updateBdi = useCallback(async () => {
    if (!proposal || mutationPending) return;
    const nextBdi = parseDecimal(bdiDraft ?? String(proposal.bdiMultiplier));
    if (!Number.isFinite(nextBdi) || nextBdi <= 0 || nextBdi > 100) {
      setBdiDraft(null);
      showNotice('Informe um multiplicador BDI maior que zero.');
      return;
    }
    if (proposal.bdiMultiplier === nextBdi) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateBdi(proposal.id, nextBdi);
      setProposal(result.proposal);
      setBdiDraft(null);
      showNotice('BDI atualizado e preços de venda recalculados.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível alterar o BDI.');
    } finally {
      setMutationPending(false);
    }
  }, [bdiDraft, mutationPending, proposal]);

  const updateProposalDetails = useCallback(async (input: { scope?: string; validUntil?: string | null }) => {
    if (!proposal || mutationPending) return;
    const payload = { ...input };
    if (payload.scope !== undefined) {
      payload.scope = payload.scope.trim();
      if (payload.scope.length < 3) {
        showNotice('Informe um escopo válido.');
        return;
      }
      if (payload.scope === proposal.scope) return;
    }
    if (payload.validUntil !== undefined && payload.validUntil === proposal.validUntil) return;

    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateDetails(proposal.id, payload);
      setProposal(result.proposal);
      showNotice('Condições atualizadas.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível atualizar as condições.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal]);

  const updateCommercialCondition = useCallback((field: keyof CommercialConditions, value: string) => {
    if (!proposal) return;
    const next = { ...parseCommercialConditions(proposal.scope), [field]: value.trim() };
    if (next.scope.length < 3) {
      showNotice('Informe um escopo válido.');
      return;
    }
    void updateProposalDetails({ scope: serializeCommercialConditions(next) });
  }, [proposal, updateProposalDetails]);

  const loadHistory = useCallback(async (proposalId: string) => {
    setHistoryLoading(true);
    setError('');
    try {
      const result = await proposalApi.history(proposalId);
      setRevisions(result.revisions);
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Não foi possível carregar o histórico desta proposta.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const selectSection = (section: ActiveSection) => {
    setActiveSection(section);
    setCatalogOpen(false);
    if (section === 'Histórico' && proposal) void loadHistory(proposal.id);
  };

  const openRevision = useCallback(async (proposalId: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await proposalApi.byId(proposalId);
      setProposal(result.proposal);
      setSelectedItemIds([]);
      setQuantityDrafts({});
      setBdiDraft(null);
      setActiveSection('Itens');
      showNotice(result.proposal.isLatest ? 'Revisão atual aberta.' : 'Revisão histórica aberta em modo somente leitura.');
    } catch (revisionError) {
      setError(revisionError instanceof Error ? revisionError.message : 'Não foi possível abrir esta revisão.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openProposal = useCallback(async (proposalId: string) => {
    if (proposal?.id === proposalId || loading) return;
    await openRevision(proposalId);
  }, [loading, openRevision, proposal?.id]);

  const proposalCreated = useCallback(async (created: ProposalDetail) => {
    setProposal(created);
    setSelectedItemIds([]);
    setQuantityDrafts({});
    setBdiDraft(null);
    setActiveSection('Itens');
    setNewProposalOpen(false);
    const tabs = await proposalApi.list();
    setProposalTabs(tabs.proposals);
    showNotice(`${created.number} criada na revisão 00.`);
  }, []);

  const createRevision = useCallback(async () => {
    if (!proposal?.isLatest || mutationPending) return;
    setMutationPending(true);
    setError('');
    setCatalogOpen(false);
    try {
      const result = await proposalApi.createRevision(proposal.id);
      setProposal(result.proposal);
      setSelectedItemIds([]);
      setQuantityDrafts({});
      setBdiDraft(null);
      setActiveSection('Itens');
      showNotice(`REV.${String(result.proposal.revision).padStart(2, '0')} criada. A versão anterior foi preservada.`);
    } catch (revisionError) {
      setError(revisionError instanceof Error ? revisionError.message : 'Não foi possível criar a revisão.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal]);

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
    if (!proposal || (proposal.items.length === 0 && laborTotal <= 0) || documentPending) return;
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
  }, [documentPending, laborTotal, proposal]);

  const updateProposalContext = useCallback(async (clientId: string, workId: string) => {
    if (!proposal || !proposal.isLatest || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateContext(proposal.id, clientId, workId);
      setProposal(result.proposal);
      setContextOpen(false);
      showNotice('Cliente e obra atualizados nesta revisão.');
    } catch (contextError) {
      setError(contextError instanceof Error ? contextError.message : 'Não foi possível alterar o cliente e a obra.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal]);

  const updateProposalStatusDirect = useCallback(async (newStatus: ProposalDetail['status']) => {
    if (!proposal || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateStatus(proposal.id, newStatus);
      setProposal(result.proposal);
      showNotice(`Status alterado para "${statusLabels[newStatus]}".`);
      const tabsResult = await proposalApi.list();
      setProposalTabs(tabsResult.proposals);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Não foi possível alterar o status.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal]);

  const deleteCurrentProposal = useCallback(async () => {
    if (!proposal || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.delete(proposal.id, 'all');
      showNotice(`Orçamento ${proposal.number} excluído com sucesso.`);
      setDeleteModalOpen(false);
      const tabsResult = await proposalApi.list();
      setProposalTabs(tabsResult.proposals);
      if (result.nextProposalId) {
        await openProposal(result.nextProposalId);
      } else {
        setProposal(null);
        setProposalViewMode('list');
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir a proposta.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, openProposal, proposal]);

  const cloneCurrentProposal = useCallback(async () => {
    if (!proposal || mutationPending) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.clone(proposal.id);
      showNotice(`Orçamento ${result.proposal.number} criado com sucesso a partir de ${proposal.number}.`);
      const tabsResult = await proposalApi.list();
      setProposalTabs(tabsResult.proposals);
      await openProposal(result.proposal.id);
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : 'Não foi possível clonar a proposta.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, openProposal, proposal]);

  useEffect(() => {
    setSelectedCatalogIndex(0);
  }, [query]);

  useEffect(() => {
    if (catalogOpen) window.requestAnimationFrame(() => catalogInputRef.current?.focus());
  }, [catalogOpen]);

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
        return;
      }

      if (event.key === 'Escape' && contextOpen) {
        event.preventDefault();
        setContextOpen(false);
        return;
      }
      if (!catalogOpen) return;
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && catalogResults.length > 0) {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setSelectedCatalogIndex((current) => (current + direction + catalogResults.length) % catalogResults.length);
      } else if (event.key === 'Enter' && catalogResults[selectedCatalogIndex]) {
        event.preventDefault();
        void addCatalogItem(catalogResults[selectedCatalogIndex]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setCatalogOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeNav, addCatalogItem, catalogOpen, catalogResults, contextOpen, createRevision, exportProposal, previewProposal, proposal?.isLatest, selectedCatalogIndex]);

  const proposalLabel = proposal ? `${proposal.number} • REV.${String(proposal.revision).padStart(2, '0')}` : 'Carregando proposta';
  const allSelected = Boolean(proposal?.items.length) && selectedItemIds.length === proposal?.items.length;
  const isEditable = Boolean(proposal?.isLatest && (proposal.status === 'draft' || proposal.status === 'review'));
  const singleItemSelected = selectedItemIds.length === 1;
  const materialsTotal = proposal?.totals.cost ?? 0;
  const baseCost = materialsTotal + laborTotal;
  const finalValue = baseCost * (proposal?.bdiMultiplier ?? 1);
  const additions = finalValue - baseCost;
  const commercialConditions = useMemo(() => parseCommercialConditions(proposal?.scope ?? ''), [proposal?.scope]);
  const formattedUpdatedAt = useMemo(() => {
    if (!proposal?.updatedAt) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(proposal.updatedAt));
  }, [proposal?.updatedAt]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Construtec Orçamentos</div>
        <div className="local-state"><span aria-hidden="true" /> Offline <button type="button" onClick={() => showNotice('Os dados desta versão ficam armazenados localmente neste computador.')}>Dados locais <ChevronDown size={14} /></button></div>
        <button className="global-search" type="button" disabled={activeNav !== 'Propostas'} onClick={() => setCatalogOpen(true)}>
          <Search size={17} /><span>{activeNav === 'Propostas' ? 'Buscar no catálogo' : 'Busca disponível em Propostas'}</span>{activeNav === 'Propostas' && <kbd>Ctrl+K</kbd>}
        </button>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notificações" type="button" disabled title="Notificações serão implementadas em uma próxima etapa."><Bell size={18} /></button>
          <button className="icon-button" aria-label="Ajuda" type="button" disabled title="A central de ajuda será implementada em uma próxima etapa."><HelpCircle size={18} /></button>
          <span className="divider" />
          <button className="profile" type="button" disabled title="Gestão de perfil será implementada em uma próxima etapa."><span>MR</span><b>Marcos Ribeiro</b><ChevronDown size={14} /></button>
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
                  setContextOpen(false);
                  setError('');
                }}
              >
                <Icon size={22} /><span>{label}</span>
              </button>
            );
          })}
        </nav>
        <button className="collapse" type="button"><ChevronLeft size={17} /><span>Recolher</span></button>
      </aside>

      {activeNav !== 'Propostas' && error && <div className="global-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>Fechar</button></div>}
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
      ) : activeNav === 'Propostas' ? <main className="workspace">
        <div className="proposal-tabs" role="tablist" aria-label="Propostas abertas">
          <button
            type="button"
            className="view-list-tab"
            onClick={() => setProposalViewMode('list')}
            title="Ver lista completa de propostas"
          >
            <LayoutList size={15} /> Ver todas ({proposalTabs.length})
          </button>
          <span className="tab-divider" />
          {proposalTabs.map((tab) => {
            const selected = tab.id === proposal?.id;
            return <button key={tab.id} className={selected ? 'selected' : ''} type="button" role="tab" aria-selected={selected} disabled={loading} title={`${tab.clientName} · ${tab.workName}`} onClick={() => void openProposal(tab.id)}>{tab.number} • REV.{String(tab.revision).padStart(2, '0')}</button>;
          })}
          <button type="button" className="new-tab" onClick={() => { setError(''); setNewProposalOpen(true); }}><Plus size={17} /> Nova proposta</button>
        </div>

        <section className="proposal-editor" aria-label={`Editor da proposta ${proposalLabel}`} aria-busy={loading || mutationPending}>
          {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => void loadProposal()}>Tentar novamente</button></div>}
          <div className="proposal-meta">
            <MetaField label="Cliente" value={proposal?.clientName ?? '—'} icon={<Building2 size={19} />} disabled={!isEditable || mutationPending} onClick={() => { setCatalogOpen(false); setContextOpen((value) => !value); }} />
            <MetaField label="Obra" value={proposal?.workName ?? '—'} disabled={!isEditable || mutationPending} onClick={() => { setCatalogOpen(false); setContextOpen((value) => !value); }} />
            <div className="meta-field status-field">
              <label>Status</label>
              <select
                className={`status-select ${statusClasses[proposal?.status ?? 'draft']}`}
                value={proposal?.status ?? 'draft'}
                disabled={!proposal || mutationPending}
                onChange={(e) => void updateProposalStatusDirect(e.target.value as ProposalDetail['status'])}
              >
                <option value="draft">Em edição</option>
                <option value="review">Em revisão</option>
                <option value="sent">Enviada</option>
                <option value="approved">Aprovada</option>
                <option value="rejected">Recusada</option>
              </select>
            </div>
            <MetaField label="Validade" value={proposal?.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : '—'} disabled />
            <MetaField label="Responsável" value={proposal?.responsibleName ?? '—'} disabled />
          </div>

          {contextOpen && (
            <div className="context-popover" role="dialog" aria-label="Selecionar cliente e obra">
              <div className="popover-heading"><span><b>Selecionar cliente e obra</b><small>A alteração vale somente para esta revisão.</small></span><button type="button" onClick={() => { setActiveNav('Clientes'); setContextOpen(false); }}>Gerenciar clientes <ExternalLink size={12} /></button></div>
              <label className="catalog-search"><Search size={15} /><input autoFocus value={contextQuery} onChange={(event) => setContextQuery(event.target.value)} placeholder="Buscar cliente, documento ou obra" aria-label="Buscar cliente ou obra" /><kbd>Esc</kbd></label>
              <div className="context-results" aria-busy={contextLoading}>
                {contextLoading && <p className="catalog-message">Carregando cadastros locais…</p>}
                {!contextLoading && contextClients.map((client) => {
                  const activeWorks = client.works.filter((work) => work.active);
                  return <section key={client.id}><h3>{client.tradeName || client.legalName}<small>{client.document || client.legalName}</small></h3>{activeWorks.map((work) => <button type="button" key={work.id} disabled={mutationPending} onClick={() => void updateProposalContext(client.id, work.id)}><MapPin size={16} /><span>{work.name}<small>{work.address || 'Endereço não informado'}</small></span>{proposal?.workId === work.id && <em>Selecionada</em>}</button>)}{activeWorks.length === 0 && <p>Nenhuma obra ativa</p>}</section>;
                })}
                {!contextLoading && contextClients.length === 0 && <p className="catalog-message">Nenhum cliente ou obra encontrado.</p>}
              </div>
              <div className="popover-footer"><span>Escolha uma obra para atualizar os dois campos</span><span><kbd>Esc</kbd> Fechar</span></div>
            </div>
          )}

          <div className="section-tabs" role="tablist" aria-label="Seções da proposta">
            {sectionTabs.map((tab) => (
              <button key={tab.label} type="button" className={activeSection === tab.label ? 'selected' : ''} role="tab" aria-selected={activeSection === tab.label} disabled={!tab.enabled} title={tab.enabled ? undefined : `${tab.label} será implementado na próxima etapa.`} onClick={() => { if (tab.enabled) selectSection(tab.label); }}>{tab.label}</button>
            ))}
          </div>

          {activeSection === 'Itens' ? <>
          <div className="toolbar" aria-label="Ações dos itens">
            <button className="primary compact" type="button" disabled={!isEditable || mutationPending} onClick={() => setCatalogOpen((value) => !value)}><Plus size={17} /> Inserir <ChevronDown size={14} /></button>
            <button type="button" disabled={!isEditable || selectedItemIds.length === 0 || mutationPending} onClick={() => void removeSelectedItems()}><Trash2 size={16} /> Excluir</button>
            <button type="button" disabled={!isEditable || !singleItemSelected || mutationPending} onClick={() => void duplicateSelectedItem()}><Copy size={16} /> Duplicar</button>
            <button type="button" disabled={!isEditable || !singleItemSelected || mutationPending} onClick={() => void moveSelectedItem('up')}><ChevronUp size={14} /> Mover</button>
            <button type="button" disabled={!isEditable || !singleItemSelected || mutationPending} onClick={() => void moveSelectedItem('down')}><ChevronDown size={14} /> Mover</button>
            <span className="toolbar-space" />
            <button type="button" disabled title="Importação será implementada em uma próxima etapa.">Importar <ChevronDown size={14} /></button>
            <button className="icon-button" aria-label="Configurar colunas" type="button" disabled><SlidersHorizontal size={18} /></button>
            <button className="icon-button" aria-label="Filtrar itens" type="button" disabled><Filter size={18} /></button>
            <button className="icon-button" aria-label="Configurações da tabela" type="button" disabled><Settings size={18} /></button>
          </div>

          <div className="table-region">
            <table>
              <thead>
                <tr>
                  <th aria-label="Selecionar"><input type="checkbox" aria-label="Selecionar todos os itens" checked={allSelected} disabled={!isEditable} onChange={() => setSelectedItemIds(allSelected ? [] : proposal?.items.map((item) => item.id) ?? [])} /></th>
                  <th>#</th><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Unid.</th><th>Custo unit. (R$)</th><th>Custo total (R$)</th><th>Venda unit. (R$)</th><th>Venda total (R$)</th>
                </tr>
              </thead>
              <tbody>
                {proposal?.items.map((item, index) => (
                  <tr key={item.id}>
                    <td><input type="checkbox" aria-label={`Selecionar ${item.description}`} checked={selectedItemIds.includes(item.id)} disabled={!isEditable} onChange={() => setSelectedItemIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /></td>
                    <td>{index + 1}</td><td className="code">{item.code}</td>
                    <td className="editable-cell"><input key={`${item.id}-description-${item.description}`} className="line-input" type="text" defaultValue={item.description} title={item.description} disabled={!isEditable || mutationPending} aria-label={`Descrição de ${item.description}`} onBlur={(event) => void updateItemText(item.id, 'description', event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = item.description; event.currentTarget.blur(); } }} /></td>
                    <td className="number editable-cell"><input className="quantity-input" type="text" inputMode="decimal" aria-label={`Quantidade de ${item.description}`} value={quantityDrafts[item.id] ?? formatDecimal(item.quantity)} disabled={!isEditable || mutationPending} onChange={(event) => setQuantityDrafts((current) => ({ ...current, [item.id]: event.target.value }))} onBlur={(event) => void updateQuantity(item.id, event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setQuantityDrafts((current) => ({ ...current, [item.id]: formatDecimal(item.quantity) })); event.currentTarget.blur(); } }} /></td>
                    <td className="editable-cell"><input key={`${item.id}-unit-${item.unit}`} className="unit-input" type="text" defaultValue={item.unit} disabled={!isEditable || mutationPending} aria-label={`Unidade de ${item.description}`} onBlur={(event) => void updateItemText(item.id, 'unit', event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = item.unit; event.currentTarget.blur(); } }} /></td>
                    <td className="number editable-cell"><input key={`${item.id}-cost-${item.unitCost}`} className="quantity-input" type="text" inputMode="decimal" defaultValue={formatDecimal(item.unitCost)} disabled={!isEditable || mutationPending} aria-label={`Custo unitário de ${item.description}`} onBlur={(event) => void updateItemMoney(item.id, 'unitCost', event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = formatDecimal(item.unitCost); event.currentTarget.blur(); } }} /></td>
                    <td className="number">{money.format(item.totalCost)}</td>
                    <td className="number editable-cell"><input key={`${item.id}-sale-${item.unitSale}`} className="quantity-input" type="text" inputMode="decimal" defaultValue={formatDecimal(item.unitSale)} disabled={!isEditable || mutationPending} aria-label={`Venda unitária de ${item.description}`} onBlur={(event) => void updateItemMoney(item.id, 'unitSale', event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = formatDecimal(item.unitSale); event.currentTarget.blur(); } }} /></td>
                    <td className="number">{money.format(item.totalSale)}</td>
                  </tr>
                ))}
                {!loading && proposal?.items.length === 0 && <tr className="empty-row"><td colSpan={10}>Nenhum item nesta proposta. Use “Inserir” para pesquisar no catálogo local.</td></tr>}
                {loading && <tr className="empty-row"><td colSpan={10}>Carregando dados locais…</td></tr>}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>{proposal?.items.length ?? 0} {(proposal?.items.length ?? 0) === 1 ? 'item' : 'itens'}</td><td colSpan={4} /><td className="number">{money.format(proposal?.totals.cost ?? 0)}</td><td /><td className="number">{money.format(proposal?.totals.sale ?? 0)}</td></tr>
              </tfoot>
            </table>
          </div>

          <button className="add-line" type="button" disabled={!isEditable || mutationPending} onClick={() => setCatalogOpen(true)}><Plus size={16} /> Adicionar linha <kbd>Ctrl+I</kbd></button>

          {catalogOpen && (
            <div className="catalog-popover" role="dialog" aria-label="Buscar no catálogo">
              <div className="popover-heading"><b>Buscar no catálogo</b><button type="button" disabled title="A área completa do catálogo será implementada em uma próxima etapa.">Ver catálogo completo <ExternalLink size={12} /></button></div>
              <label className="catalog-search"><Search size={15} /><input ref={catalogInputRef} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Pesquisar no catálogo" aria-activedescendant={catalogResults[selectedCatalogIndex] ? `catalog-${catalogResults[selectedCatalogIndex].code}` : undefined} /><kbd>Esc</kbd></label>
              <div className="catalog-results" aria-busy={catalogLoading}>
                {catalogResults.map((item, index) => (
                  <button id={`catalog-${item.code}`} key={item.id} className={index === selectedCatalogIndex ? 'highlighted' : ''} type="button" disabled={!isEditable || mutationPending} onMouseEnter={() => setSelectedCatalogIndex(index)} onClick={() => void addCatalogItem(item)}>
                    <span className="code">{item.code}</span><span title={item.description}>{item.description}</span><small>Unid.: {item.unit}</small><small>Custo: R$ {money.format(item.currentCost)}</small>
                  </button>
                ))}
                {catalogLoading && <p className="catalog-message">Pesquisando no catálogo local…</p>}
                {!catalogLoading && catalogResults.length === 0 && <p className="catalog-message">Nenhum produto encontrado. Tente outro código ou descrição.</p>}
              </div>
              <div className="popover-footer"><span>↑↓ Navegar</span><span><kbd>Enter</kbd> Inserir</span><span><kbd>Esc</kbd> Fechar</span></div>
            </div>
          )}
          </> : activeSection === 'Mão de obra' && proposal ? (
            <ProposalLaborPanel
              proposalId={proposal.id}
              editable={isEditable}
              onLaborTotalChange={setLaborTotal}
              onError={setError}
              onNotice={showNotice}
            />
          ) : activeSection === 'Kits' && proposal ? (
            <ProposalKitsPanel
              proposalId={proposal.id}
              proposalNumber={proposal.number}
              bdiMultiplier={proposal.bdiMultiplier}
              editable={isEditable}
              onApplied={() => {
                void loadProposal();
                setActiveSection('Itens');
              }}
              onError={setError}
              onNotice={showNotice}
            />
          ) : activeSection === 'Condições' && proposal ? (
            <div className="history-region">
              <div className="history-heading">
                <div><FileText size={18} /><span><b>Condições comerciais</b><small>Edita o que aparece no PDF/Word do cliente.</small></span></div>
              </div>
              <div className="form-grid" style={{ padding: 20, maxWidth: 960 }}>
                <label>Validade da proposta
                  <input type="date" defaultValue={proposal.validUntil ?? ''} disabled={!isEditable || mutationPending} onBlur={(event) => void updateProposalDetails({ validUntil: event.currentTarget.value || null })} />
                </label>
                <label>Prazo de execução
                  <input key={`${proposal.id}-execution-${commercialConditions.executionTerm}`} type="text" defaultValue={commercialConditions.executionTerm} maxLength={160} placeholder="Ex.: 15 dias úteis" disabled={!isEditable || mutationPending} onBlur={(event) => updateCommercialCondition('executionTerm', event.currentTarget.value)} />
                </label>
                <label className="wide">Escopo comercial
                  <textarea key={`${proposal.id}-scope-${commercialConditions.scope}`} defaultValue={commercialConditions.scope} maxLength={300} disabled={!isEditable || mutationPending} style={{ minHeight: 88, resize: 'vertical', padding: 10, border: '1px solid var(--line-strong)', borderRadius: 5 }} onBlur={(event) => updateCommercialCondition('scope', event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.value = commercialConditions.scope; event.currentTarget.blur(); } }} />
                </label>
                <label className="wide">Forma de pagamento
                  <textarea key={`${proposal.id}-payment-${commercialConditions.paymentTerms}`} defaultValue={commercialConditions.paymentTerms} maxLength={240} placeholder="Ex.: 40% entrada, 60% na entrega" disabled={!isEditable || mutationPending} style={{ minHeight: 70, resize: 'vertical', padding: 10, border: '1px solid var(--line-strong)', borderRadius: 5 }} onBlur={(event) => updateCommercialCondition('paymentTerms', event.currentTarget.value)} />
                </label>
                <label>Garantia
                  <input key={`${proposal.id}-warranty-${commercialConditions.warranty}`} type="text" defaultValue={commercialConditions.warranty} maxLength={160} placeholder="Ex.: 90 dias" disabled={!isEditable || mutationPending} onBlur={(event) => updateCommercialCondition('warranty', event.currentTarget.value)} />
                </label>
                <label className="wide">Observações
                  <textarea key={`${proposal.id}-notes-${commercialConditions.notes}`} defaultValue={commercialConditions.notes} maxLength={500} disabled={!isEditable || mutationPending} style={{ minHeight: 82, resize: 'vertical', padding: 10, border: '1px solid var(--line-strong)', borderRadius: 5 }} onBlur={(event) => updateCommercialCondition('notes', event.currentTarget.value)} />
                </label>
                <p className="dialog-warning">BDI, salários, custos e margens continuam fora do documento do cliente.</p>
              </div>
            </div>
          ) : (
            <div className="history-region" aria-busy={historyLoading}>
              <div className="history-heading">
                <div><HistoryIcon size={18} /><span><b>Histórico da proposta</b><small>Versões anteriores permanecem preservadas e somente para consulta.</small></span></div>
                <button type="button" disabled={!proposal || historyLoading} onClick={() => { if (proposal) void loadHistory(proposal.id); }}>Atualizar</button>
              </div>
              {historyLoading && <p className="history-message">Carregando histórico local…</p>}
              {!historyLoading && revisions.length === 0 && <p className="history-message">Nenhuma revisão registrada para esta proposta.</p>}
              {!historyLoading && revisions.length > 0 && (
                <table className="history-table">
                  <thead><tr><th>Revisão</th><th>Status</th><th>Itens</th><th>Venda total</th><th>Responsável</th><th>Última alteração</th><th aria-label="Ação" /></tr></thead>
                  <tbody>{revisions.map((revision) => (
                    <tr key={revision.id} className={revision.id === proposal?.id ? 'current-revision' : ''}>
                      <td><b>{revision.number} · REV.{String(revision.revision).padStart(2, '0')}</b>{revision.isLatest && <small>Atual</small>}</td>
                      <td>{statusLabels[revision.status]}</td><td>{revision.itemCount}</td><td className="number">R$ {money.format(revision.totalSale)}</td><td>{revision.responsibleName}</td><td>{dateTime.format(new Date(revision.updatedAt))}</td>
                      <td><button type="button" disabled={revision.id === proposal?.id || loading} onClick={() => void openRevision(revision.id)}>{revision.id === proposal?.id ? 'Aberta' : 'Consultar'}</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          )}
        </section>

        <aside className="commercial-panel">
          <div className="panel-title"><b>Resumo comercial</b><ChevronUp size={16} /></div>
          <Amount label="Total de Materiais" value={`R$ ${money.format(materialsTotal)}`} />
          <Amount label="Total de Mão de Obra" value={`R$ ${money.format(laborTotal)}`} />
          <Amount label="Custo Base" value={`R$ ${money.format(baseCost)}`} />
          <Amount label="BDI / acréscimos" value={`R$ ${money.format(additions)}`} />
          <Amount label="Valor Final da Proposta" value={`R$ ${money.format(finalValue)}`} tone="blue" />

          <div className="panel-section">
            <h2>Parâmetros internos</h2>
            <label>Multiplicador BDI <span className="editable-parameter"><input type="text" inputMode="decimal" aria-label="Multiplicador BDI" value={bdiDraft ?? String(proposal?.bdiMultiplier ?? 0).replace('.', ',')} disabled={!isEditable || mutationPending} onFocus={() => { if (bdiDraft === null && proposal) setBdiDraft(String(proposal.bdiMultiplier).replace('.', ',')); }} onChange={(event) => setBdiDraft(event.target.value)} onBlur={() => void updateBdi()} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setBdiDraft(null); event.currentTarget.blur(); } }} /><span aria-hidden="true">×</span></span></label>
            <label>Encargos <span className="locked-input">87,25% <ChevronDown size={14} /></span></label>
          </div>

          <div className="frozen-state"><LockKeyhole size={17} /><span>{proposal?.isLatest ? 'Custos-base preservados nesta revisão' : 'Revisão histórica · somente leitura'}</span></div>

          <div className="panel-section actions">
            <h2>Ações</h2>
            <button type="button" disabled={!proposal?.isLatest || mutationPending} onClick={() => void createRevision()}><Save size={18} /> Criar revisão <kbd>Ctrl+S</kbd></button>
            <button type="button" disabled={!proposal || mutationPending} onClick={() => void cloneCurrentProposal()} title="Clonar este orçamento gerando um novo número"><Copy size={18} /> Clonar proposta</button>
            <button type="button" disabled={!proposal || documentPending} onClick={() => void previewProposal()}><Eye size={18} /> Pré-visualizar <kbd>Ctrl+P</kbd></button>
            <button className="primary generate" type="button" disabled={(!proposal?.items.length && laborTotal <= 0) || documentPending} onClick={() => void exportProposal()}><FilePlus2 size={18} /> {documentPending ? 'Preparando…' : 'Gerar PDF + Word'} <kbd>Ctrl+G</kbd></button>
            <button
              type="button"
              className="danger-action-btn"
              disabled={!proposal || mutationPending}
              onClick={() => setDeleteModalOpen(true)}
              title="Excluir este orçamento definitivamente"
            >
              <Trash2 size={16} /> Excluir orçamento
            </button>
          </div>
          <div className="panel-footnote">
            <p className="demo-data-note">Base inicial demonstrativa · salva localmente</p>
            <p className="last-change">Última alteração: {formattedUpdatedAt}<br />por {proposal?.responsibleName ?? '—'}</p>
          </div>
        </aside>
      </main> : activeNav === 'Início' ? (
        <HomeWorkspace
          onOpenProposal={async (proposalId) => {
            await openProposal(proposalId);
            setActiveNav('Propostas');
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
              setActiveSection('Itens');
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
      <NewProposalDialog open={newProposalOpen} onClose={() => setNewProposalOpen(false)} onCreated={(created) => void proposalCreated(created)} onError={setError} />

      {deleteModalOpen && proposal && (
        <div className="modal-overlay">
          <div className="modal-card delete-modal">
            <div className="modal-header danger-header">
              <AlertTriangle size={24} color="#dc2626" />
              <div>
                <h3>Excluir Orçamento</h3>
                <p>Confirmação de exclusão permanente</p>
              </div>
            </div>
            <div className="modal-body">
              <p>
                Tem certeza que deseja excluir o orçamento <strong>{proposal.number}</strong> (Cliente: <em>{proposal.clientName}</em>)?
              </p>
              <div className="danger-callout">
                Esta ação removerá todas as revisões, itens, composições de mão de obra e histórico associados a este orçamento do banco de dados local.
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="secondary-btn"
                disabled={mutationPending}
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="danger-btn"
                disabled={mutationPending}
                onClick={() => void deleteCurrentProposal()}
              >
                <Trash2 size={16} />
                {mutationPending ? 'Excluindo...' : 'Sim, excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaField({ label, value, icon, accent = false, disabled = false, onClick }: { label: string; value: string; icon?: ReactNode; accent?: boolean; disabled?: boolean; onClick?: () => void }) {
  return <div className="meta-field"><span>{label}</span><button type="button" className={accent ? 'accent' : ''} disabled={disabled} onClick={onClick}>{icon}{value}{!disabled && <ChevronDown size={14} />}</button></div>;
}

function Amount({ label, value, tone, compact = false }: { label: string; value: string; tone?: 'blue' | 'green'; compact?: boolean }) {
  return <div className={`amount ${tone ?? ''} ${compact ? 'compact' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}
