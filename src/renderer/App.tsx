import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
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
  Layers3,
  LockKeyhole,
  Plus,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import type { CatalogProduct, ProposalDetail } from '../shared/contracts';
import { proposalApi } from './api';

const navItems = [
  { label: 'Início', icon: Grid2X2 },
  { label: 'Propostas', icon: FileText, active: true },
  { label: 'Catálogo', icon: Box },
  { label: 'Clientes', icon: Users },
  { label: 'Kits', icon: Layers3 },
  { label: 'Configurações', icon: Settings },
];

const openProposals = ['PA-1052 • REV.01', 'PA-1048 • REV.00'];

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

const statusLabels: Record<ProposalDetail['status'], string> = {
  draft: 'Em edição',
  review: 'Em revisão',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

export function App() {
  const [catalogOpen, setCatalogOpen] = useState(true);
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
  const catalogInputRef = useRef<HTMLInputElement>(null);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const loadProposal = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await proposalApi.current();
      setProposal(result.proposal);
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

  const addCatalogItem = useCallback(async (product: CatalogProduct) => {
    if (!proposal || mutationPending) return;
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

  const updateQuantity = useCallback(async (itemId: string, value: string) => {
    if (!proposal || mutationPending) return;
    const nextQuantity = parseDecimal(value);
    const currentItem = proposal.items.find((item) => item.id === itemId);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0 || nextQuantity > 1_000_000) {
      setQuantityDrafts((current) => ({ ...current, [itemId]: String(currentItem?.quantity ?? 1).replace('.', ',') }));
      showNotice('Informe uma quantidade maior que zero.');
      return;
    }
    if (currentItem?.quantity === nextQuantity) return;
    setMutationPending(true);
    setError('');
    try {
      const result = await proposalApi.updateQuantity(proposal.id, itemId, nextQuantity);
      setProposal(result.proposal);
      setQuantityDrafts((current) => ({ ...current, [itemId]: String(nextQuantity).replace('.', ',') }));
      showNotice('Quantidade atualizada e totais recalculados.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Não foi possível alterar a quantidade.');
    } finally {
      setMutationPending(false);
    }
  }, [mutationPending, proposal]);

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
        if (action === 'k') {
          setCatalogOpen(true);
          announce('Busca local aberta.');
        } else if (action === 'i') {
          setCatalogOpen(true);
        } else if (action === 's') {
          announce('Revisão salva localmente.');
        } else if (action === 'p') {
          announce('Abrindo a pré-visualização do cliente.');
        } else if (action === 'g') {
          announce('Proposta preparada para geração.');
        }
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
  }, [addCatalogItem, catalogOpen, catalogResults, selectedCatalogIndex]);

  const proposalLabel = proposal ? `${proposal.number} • REV.${String(proposal.revision).padStart(2, '0')}` : 'Carregando proposta';
  const allSelected = Boolean(proposal?.items.length) && selectedItemIds.length === proposal?.items.length;
  const formattedUpdatedAt = useMemo(() => {
    if (!proposal?.updatedAt) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(proposal.updatedAt));
  }, [proposal?.updatedAt]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Construtec Orçamentos</div>
        <div className="local-state"><span aria-hidden="true" /> Offline <button type="button">Dados locais <ChevronDown size={14} /></button></div>
        <button className="global-search" type="button" onClick={() => setCatalogOpen(true)}>
          <Search size={17} /><span>Buscar</span><kbd>Ctrl+K</kbd>
        </button>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notificações" type="button"><Bell size={18} /></button>
          <button className="icon-button" aria-label="Ajuda" type="button"><HelpCircle size={18} /></button>
          <span className="divider" />
          <button className="profile" type="button"><span>MR</span><b>Marcos Ribeiro</b><ChevronDown size={14} /></button>
        </div>
      </header>

      <aside className="sidebar" aria-label="Navegação principal">
        <nav>
          {navItems.map(({ label, icon: Icon, active }) => (
            <button key={label} type="button" className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              <Icon size={22} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="collapse" type="button"><ChevronLeft size={17} /><span>Recolher</span></button>
      </aside>

      <main className="workspace">
        <div className="proposal-tabs" role="tablist" aria-label="Propostas abertas">
          {[proposalLabel, ...openProposals].map((tabLabel, index) => (
            <button key={tabLabel} className={index === 0 ? 'selected' : ''} type="button" role="tab" aria-selected={index === 0}>
              {tabLabel}{index > 0 && <span aria-hidden="true">×</span>}
            </button>
          ))}
          <button type="button" className="new-tab"><Plus size={17} /> Nova proposta</button>
        </div>

        <section className="proposal-editor" aria-label={`Editor da proposta ${proposalLabel}`} aria-busy={loading || mutationPending}>
          {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => void loadProposal()}>Tentar novamente</button></div>}
          <div className="proposal-meta">
            <MetaField label="Cliente" value={proposal?.clientName ?? '—'} icon={<Building2 size={19} />} />
            <MetaField label="Escopo" value={proposal?.scope ?? '—'} />
            <MetaField label="Status" value={proposal ? statusLabels[proposal.status] : 'Carregando'} accent />
            <MetaField label="Validade" value={proposal?.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : '—'} />
            <MetaField label="Responsável" value={proposal?.responsibleName ?? '—'} />
          </div>

          <div className="section-tabs" role="tablist" aria-label="Seções da proposta">
            {['Itens', 'Serviços', 'Kits', 'Condições', 'Histórico'].map((tab, index) => (
              <button key={tab} type="button" className={index === 0 ? 'selected' : ''} role="tab" aria-selected={index === 0}>{tab}</button>
            ))}
          </div>

          <div className="toolbar" aria-label="Ações dos itens">
            <button className="primary compact" type="button" disabled={!proposal || mutationPending} onClick={() => setCatalogOpen((value) => !value)}><Plus size={17} /> Inserir <ChevronDown size={14} /></button>
            <button type="button" disabled={selectedItemIds.length === 0 || mutationPending} onClick={() => void removeSelectedItems()}><Trash2 size={16} /> Excluir</button>
            <button type="button"><Copy size={16} /> Duplicar</button>
            <button type="button">Mover <ChevronDown size={14} /></button>
            <button type="button">Mais <ChevronDown size={14} /></button>
            <span className="toolbar-space" />
            <button type="button">Importar <ChevronDown size={14} /></button>
            <button className="icon-button" aria-label="Configurar colunas" type="button"><SlidersHorizontal size={18} /></button>
            <button className="icon-button" aria-label="Filtrar itens" type="button"><Filter size={18} /></button>
            <button className="icon-button" aria-label="Configurações da tabela" type="button"><Settings size={18} /></button>
          </div>

          <div className="table-region">
            <table>
              <thead>
                <tr>
                  <th aria-label="Selecionar"><input type="checkbox" aria-label="Selecionar todos os itens" checked={allSelected} onChange={() => setSelectedItemIds(allSelected ? [] : proposal?.items.map((item) => item.id) ?? [])} /></th>
                  <th>#</th><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Unid.</th><th>Custo unit. (R$)</th><th>Custo total (R$)</th><th>Venda unit. (R$)</th><th>Venda total (R$)</th>
                </tr>
              </thead>
              <tbody>
                {proposal?.items.map((item, index) => (
                  <tr key={item.id}>
                    <td><input type="checkbox" aria-label={`Selecionar ${item.description}`} checked={selectedItemIds.includes(item.id)} onChange={() => setSelectedItemIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /></td>
                    <td>{index + 1}</td><td className="code">{item.code}</td><td title={item.description}>{item.description}</td>
                    <td className="number editable-cell"><input className="quantity-input" type="text" inputMode="decimal" aria-label={`Quantidade de ${item.description}`} value={quantityDrafts[item.id] ?? String(item.quantity).replace('.', ',')} disabled={mutationPending} onChange={(event) => setQuantityDrafts((current) => ({ ...current, [item.id]: event.target.value }))} onBlur={(event) => void updateQuantity(item.id, event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setQuantityDrafts((current) => ({ ...current, [item.id]: String(item.quantity).replace('.', ',') })); event.currentTarget.blur(); } }} /></td>
                    <td>{item.unit}</td><td className="number">{money.format(item.unitCost)}</td><td className="number">{money.format(item.totalCost)}</td><td className="number">{money.format(item.unitSale)}</td><td className="number">{money.format(item.totalSale)}</td>
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

          <button className="add-line" type="button" disabled={!proposal || mutationPending} onClick={() => setCatalogOpen(true)}><Plus size={16} /> Adicionar linha <kbd>Ctrl+I</kbd></button>

          {catalogOpen && (
            <div className="catalog-popover" role="dialog" aria-label="Buscar no catálogo">
              <div className="popover-heading"><b>Buscar no catálogo</b><button type="button" onClick={() => showNotice('Catálogo completo aberto em uma nova área de trabalho.')}>Ver catálogo completo <ExternalLink size={12} /></button></div>
              <label className="catalog-search"><Search size={15} /><input ref={catalogInputRef} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Pesquisar no catálogo" aria-activedescendant={catalogResults[selectedCatalogIndex] ? `catalog-${catalogResults[selectedCatalogIndex].code}` : undefined} /><kbd>Esc</kbd></label>
              <div className="catalog-results" aria-busy={catalogLoading}>
                {catalogResults.map((item, index) => (
                  <button id={`catalog-${item.code}`} key={item.id} className={index === selectedCatalogIndex ? 'highlighted' : ''} type="button" disabled={mutationPending} onMouseEnter={() => setSelectedCatalogIndex(index)} onClick={() => void addCatalogItem(item)}>
                    <span className="code">{item.code}</span><span title={item.description}>{item.description}</span><small>Unid.: {item.unit}</small><small>Custo: R$ {money.format(item.currentCost)}</small>
                  </button>
                ))}
                {catalogLoading && <p className="catalog-message">Pesquisando no catálogo local…</p>}
                {!catalogLoading && catalogResults.length === 0 && <p className="catalog-message">Nenhum produto encontrado. Tente outro código ou descrição.</p>}
              </div>
              <div className="popover-footer"><span>↑↓ Navegar</span><span><kbd>Enter</kbd> Inserir</span><span><kbd>Esc</kbd> Fechar</span></div>
            </div>
          )}
        </section>

        <aside className="commercial-panel">
          <div className="panel-title"><b>Resumo comercial</b><ChevronUp size={16} /></div>
          <Amount label="Custo (materiais + serviços)" value={`R$ ${money.format(proposal?.totals.cost ?? 0)}`} />
          <Amount label="Venda total" value={`R$ ${money.format(proposal?.totals.sale ?? 0)}`} tone="blue" />
          <Amount label="Resultado bruto" value={`R$ ${money.format(proposal?.totals.grossResult ?? 0)}`} tone="green" />
          <Amount label="Margem" value={`${money.format(proposal?.totals.marginPercent ?? 0)}%`} tone="green" compact />

          <div className="panel-section">
            <h2>Parâmetros internos</h2>
            <label>Multiplicador BDI <span className="editable-parameter"><input type="text" inputMode="decimal" aria-label="Multiplicador BDI" value={bdiDraft ?? String(proposal?.bdiMultiplier ?? 0).replace('.', ',')} disabled={!proposal || mutationPending} onFocus={() => { if (bdiDraft === null && proposal) setBdiDraft(String(proposal.bdiMultiplier).replace('.', ',')); }} onChange={(event) => setBdiDraft(event.target.value)} onBlur={() => void updateBdi()} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setBdiDraft(null); event.currentTarget.blur(); } }} /><span aria-hidden="true">×</span></span></label>
            <label>Encargos <span className="locked-input">87,25% <ChevronDown size={14} /></span></label>
          </div>

          <div className="frozen-state"><LockKeyhole size={17} /><span>Custos-base preservados nesta revisão</span></div>

          <div className="panel-section actions">
            <h2>Ações</h2>
            <button type="button" onClick={() => showNotice('Revisão salva localmente.')}><Save size={18} /> Salvar revisão <kbd>Ctrl+S</kbd></button>
            <button type="button" onClick={() => showNotice('Abrindo a pré-visualização do cliente.')}><Eye size={18} /> Pré-visualizar <kbd>Ctrl+P</kbd></button>
            <button className="primary generate" type="button" onClick={() => showNotice('Proposta preparada para geração.')}><FilePlus2 size={18} /> Gerar proposta <kbd>Ctrl+G</kbd></button>
          </div>
          <div className="panel-footnote">
            <p className="demo-data-note">Base inicial demonstrativa · salva localmente</p>
            <p className="last-change">Última alteração: {formattedUpdatedAt}<br />por {proposal?.responsibleName ?? '—'}</p>
          </div>
        </aside>
      </main>

      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

function MetaField({ label, value, icon, accent = false }: { label: string; value: string; icon?: ReactNode; accent?: boolean }) {
  return <div className="meta-field"><span>{label}</span><button type="button" className={accent ? 'accent' : ''}>{icon}{value}<ChevronDown size={14} /></button></div>;
}

function Amount({ label, value, tone, compact = false }: { label: string; value: string; tone?: 'blue' | 'green'; compact?: boolean }) {
  return <div className={`amount ${tone ?? ''} ${compact ? 'compact' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}
