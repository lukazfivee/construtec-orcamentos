import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Box,
  Layers3,
  PackagePlus,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import type { CatalogProduct, KitInput, KitSummary, ProposalDetail } from '../shared/contracts';
import { catalogApi, kitsApi } from './api';

type KitsWorkspaceProps = {
  activeProposal: ProposalDetail | null;
  onApplyKitToProposal?: (kitId: string) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

type KitItemDraft = {
  productId: string;
  code: string;
  description: string;
  category: string;
  unit: string;
  currentCost: number;
  quantity: number;
};

type KitFormDraft = {
  name: string;
  description: string;
  category: string;
  active: boolean;
  items: KitItemDraft[];
};

const emptyKitDraft: KitFormDraft = {
  name: '',
  description: '',
  category: 'CFTV',
  active: true,
  items: [],
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function KitsWorkspace({
  activeProposal,
  onApplyKitToProposal,
  onNotice,
  onError,
}: KitsWorkspaceProps) {
  const [kits, setKits] = useState<KitSummary[]>([]);
  const [query, setQuery] = useState('');
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [draft, setDraft] = useState<KitFormDraft>(emptyKitDraft);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  // Catalog picker for adding products to kit
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerProducts, setPickerProducts] = useState<CatalogProduct[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const applyKits = (nextKits: KitSummary[], preferredId?: string | null) => {
    setKits(nextKits);
    const nextId = preferredId ?? selectedKitId ?? nextKits[0]?.id ?? null;
    setSelectedKitId(nextKits.some((k) => k.id === nextId) ? nextId : nextKits[0]?.id ?? null);
  };

  const loadKits = async (searchQuery: string) => {
    setLoading(true);
    try {
      const result = await kitsApi.list(searchQuery);
      applyKits(result.kits);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível carregar os kits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKits(query);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Load kit detail when selection changes
  useEffect(() => {
    if (!selectedKitId || creating) {
      if (creating) setDraft(emptyKitDraft);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const result = await kitsApi.get(selectedKitId);
        if (!active) return;
        setDraft({
          name: result.kit.name,
          description: result.kit.description ?? '',
          category: result.kit.category,
          active: result.kit.active,
          items: result.kit.items.map((it) => ({
            productId: it.productId,
            code: it.code,
            description: it.description,
            category: it.category,
            unit: it.unit,
            currentCost: it.currentCost,
            quantity: it.quantity,
          })),
        });
      } catch (error) {
        if (active) onError(error instanceof Error ? error.message : 'Erro ao carregar detalhes do kit.');
      }
    })();

    return () => { active = false; };
  }, [selectedKitId, creating]);

  // Load catalog products when picker opens or query changes
  useEffect(() => {
    if (!pickerOpen) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setPickerLoading(true);
      try {
        const result = await catalogApi.list(pickerQuery);
        if (active) setPickerProducts(result.products.filter((p) => p.active));
      } catch (error) {
        if (active) onError(error instanceof Error ? error.message : 'Erro ao pesquisar catálogo.');
      } finally {
        if (active) setPickerLoading(false);
      }
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [pickerOpen, pickerQuery]);

  const beginCreate = () => {
    setCreating(true);
    setSelectedKitId(null);
    setDraft(emptyKitDraft);
  };

  const addProductToKit = (product: CatalogProduct) => {
    const existingIndex = draft.items.findIndex((item) => item.productId === product.id);
    if (existingIndex >= 0) {
      const updated = [...draft.items];
      updated[existingIndex].quantity += 1;
      setDraft({ ...draft, items: updated });
    } else {
      setDraft({
        ...draft,
        items: [
          ...draft.items,
          {
            productId: product.id,
            code: product.code,
            description: product.description,
            category: product.category,
            unit: product.unit,
            currentCost: product.currentCost,
            quantity: 1,
          },
        ],
      });
    }
    setPickerOpen(false);
    setPickerQuery('');
  };

  const removeKitItem = (productId: string) => {
    setDraft({
      ...draft,
      items: draft.items.filter((item) => item.productId !== productId),
    });
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) return;
    setDraft({
      ...draft,
      items: draft.items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item,
      ),
    });
  };

  const totalEstimatedCost = useMemo(() => {
    return draft.items.reduce((sum, item) => sum + item.currentCost * item.quantity, 0);
  }, [draft.items]);

  const saveKit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || saving) return;
    if (draft.items.length === 0) {
      onError('Adicione pelo menos um item ao kit.');
      return;
    }

    setSaving(true);
    const payload: KitInput = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      category: draft.category.trim() || 'Geral',
      active: draft.active,
      items: draft.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
      })),
    };

    try {
      if (creating) {
        const result = await kitsApi.create(payload);
        applyKits(result.kits, result.kit.id);
        setCreating(false);
        onNotice('Kit cadastrado com sucesso.');
      } else if (selectedKitId) {
        const result = await kitsApi.update(selectedKitId, payload);
        applyKits(result.kits, selectedKitId);
        onNotice('Kit atualizado com sucesso.');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível salvar o kit.');
    } finally {
      setSaving(false);
    }
  };

  const deleteKit = async () => {
    if (!selectedKitId || saving) return;
    if (!window.confirm('Tem certeza que deseja excluir este kit?')) return;

    setSaving(true);
    try {
      const result = await kitsApi.delete(selectedKitId);
      applyKits(result.kits);
      onNotice('Kit excluído com sucesso.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível excluir o kit.');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToActiveProposal = async () => {
    if (!selectedKitId || !activeProposal || applying) return;
    if (activeProposal.status !== 'draft') {
      onError('A proposta aberta não está em modo de edição.');
      return;
    }

    setApplying(true);
    try {
      if (onApplyKitToProposal) {
        onApplyKitToProposal(selectedKitId);
      } else {
        await kitsApi.applyToProposal(selectedKitId, activeProposal.id);
        onNotice(`Itens do kit adicionados à proposta ${activeProposal.number}.`);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível aplicar o kit na proposta.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <main className="management-workspace kits-workspace">
      <header className="management-header">
        <div>
          <Layers3 size={25} />
          <span>
            <h1>Kits e Composições</h1>
            <p>Agrupamentos de materiais e serviços para inserção rápida em propostas.</p>
          </span>
        </div>
        <span className="management-header-actions">
          <button type="button" className="primary" onClick={beginCreate}>
            <PackagePlus size={17} /> Novo kit
          </button>
        </span>
      </header>

      <div className="management-body">
        {/* Kit list sidebar */}
        <aside className="client-list-pane">
          <label className="management-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar kit por nome, categoria…"
            />
          </label>
          <div className="client-list product-list" aria-busy={loading}>
            {kits.map((kit) => (
              <button
                key={kit.id}
                type="button"
                className={kit.id === selectedKitId && !creating ? 'selected' : ''}
                onClick={() => {
                  setCreating(false);
                  setSelectedKitId(kit.id);
                }}
              >
                <Layers3 size={17} />
                <span>
                  <b>{kit.name}</b>
                  <small>{kit.itemCount} itens • {kit.category}</small>
                </span>
                <em>{money.format(kit.totalEstimatedCost)}</em>
              </button>
            ))}
            {!loading && kits.length === 0 && (
              <p className="management-empty">Nenhum kit encontrado.</p>
            )}
          </div>
        </aside>

        {/* Kit Editor */}
        <section className="client-editor">
          {creating || selectedKitId ? (
            <form className="client-form kit-form" onSubmit={(e) => void saveKit(e)}>
              <div className="editor-heading">
                <div>
                  <h2>{creating ? 'Novo kit' : draft.name}</h2>
                  <p>
                    Composição estimada: <b>{money.format(totalEstimatedCost)}</b> ({draft.items.length} itens)
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedKitId && !creating && activeProposal && (
                    <button
                      type="button"
                      onClick={() => void handleApplyToActiveProposal()}
                      disabled={applying || activeProposal.status !== 'draft'}
                      title={`Inserir itens deste kit na proposta aberta ${activeProposal.number}`}
                    >
                      <Send size={15} />
                      {applying ? 'Inserindo…' : `Inserir na ${activeProposal.number}`}
                    </button>
                  )}
                  {selectedKitId && !creating && (
                    <button
                      type="button"
                      onClick={() => void deleteKit()}
                      disabled={saving}
                      style={{ color: '#bd2f2f' }}
                    >
                      <Trash2 size={15} /> Excluir
                    </button>
                  )}
                  <button type="submit" className="primary" disabled={saving}>
                    <Save size={16} /> {saving ? 'Salvando…' : 'Salvar kit'}
                  </button>
                </div>
              </div>

              <div className="form-grid">
                <label className="wide">
                  <span>Nome do kit <b>*</b></span>
                  <input
                    autoFocus
                    value={draft.name}
                    maxLength={180}
                    placeholder="Ex: Kit CFTV 4 Câmeras Full HD, Kit Infraestrutura 100m…"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>

                <label>
                  <span>Categoria <b>*</b></span>
                  <input
                    value={draft.category}
                    maxLength={120}
                    placeholder="CFTV, Controle de acesso, Cabeamento, Infraestrutura…"
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  />
                </label>

                <label>
                  <span>Descrição / Aplicação</span>
                  <input
                    value={draft.description}
                    maxLength={500}
                    placeholder="Instalação padrão em escritórios, galpões…"
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </label>

                <label className="work-active wide">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  />
                  <span>Kit ativo e disponível para uso rápido em propostas</span>
                </label>
              </div>

              {/* Kit Items Section */}
              <div className="kit-items-section" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
                    Itens que compõem este kit ({draft.items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '30px',
                      padding: '0 10px',
                      fontSize: '11px',
                      background: '#eff5ff',
                      color: '#085ce5',
                      border: '1px solid #c5d8f9',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} /> Adicionar item do catálogo
                  </button>
                </div>

                {draft.items.length > 0 ? (
                  <div style={{ border: '1px solid #e4e6ea', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead style={{ background: '#f8f9fb' }}>
                        <tr>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Código</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Descrição</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '50px' }}>Un.</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Custo un.</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Qtd.</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Total</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.items.map((item) => (
                          <tr key={item.productId} style={{ borderTop: '1px solid #e4e6ea' }}>
                            <td style={{ padding: '6px 10px' }}><b>{item.code}</b></td>
                            <td style={{ padding: '6px 10px' }}>{item.description}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>{item.unit}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>{money.format(item.currentCost)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(item.productId, Number(e.target.value))}
                                style={{
                                  width: '65px',
                                  height: '26px',
                                  padding: '0 6px',
                                  textAlign: 'right',
                                  border: '1px solid #cfd5de',
                                  borderRadius: '4px',
                                }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                              {money.format(item.currentCost * item.quantity)}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeKitItem(item.productId)}
                                style={{
                                  border: 0,
                                  background: 'transparent',
                                  color: '#a32b2b',
                                  cursor: 'pointer',
                                  padding: '2px',
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: '#697386', fontStyle: 'italic', fontSize: '11px', padding: '12px 0' }}>
                    Nenhum item adicionado ao kit. Clique em "Adicionar item do catálogo" para montar a composição.
                  </p>
                )}
              </div>
            </form>
          ) : (
            <div className="editor-empty">
              <Layers3 size={34} />
              <h2>Selecione um kit</h2>
              <p>Consulte itens, custo estimado ou crie novas composições de produtos.</p>
            </div>
          )}
        </section>
      </div>

      {/* Catalog Product Picker Modal */}
      {pickerOpen && (
        <div className="dialog-backdrop">
          <div className="new-proposal-dialog" style={{ width: '680px' }}>
            <header>
              <div>
                <Box size={22} />
                <div>
                  <h2>Adicionar produto ao kit</h2>
                  <p>Pesquise e selecione itens do catálogo cadastrado.</p>
                </div>
              </div>
              <button type="button" className="dialog-close" onClick={() => setPickerOpen(false)}>
                ✕
              </button>
            </header>

            <div style={{ padding: '16px 20px' }}>
              <label className="management-search" style={{ margin: '0 0 14px' }}>
                <Search size={15} />
                <input
                  autoFocus
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Pesquisar código, descrição ou fabricante…"
                />
              </label>

              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e4e6ea', borderRadius: '6px' }}>
                {pickerProducts.map((product) => (
                  <div
                    key={product.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid #f0f2f5',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12px' }}>{product.code} - {product.description}</div>
                      <div style={{ fontSize: '10px', color: '#697386' }}>{product.category} • Un: {product.unit}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 600, fontSize: '11px' }}>{money.format(product.currentCost)}</span>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => addProductToKit(product)}
                        style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                      >
                        <Plus size={13} /> Adicionar
                      </button>
                    </div>
                  </div>
                ))}
                {!pickerLoading && pickerProducts.length === 0 && (
                  <p style={{ padding: '24px', textAlign: 'center', color: '#697386', margin: 0, fontSize: '11px' }}>
                    Nenhum produto ativo encontrado com esse termo.
                  </p>
                )}
              </div>
            </div>

            <footer>
              <button type="button" onClick={() => setPickerOpen(false)}>
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
