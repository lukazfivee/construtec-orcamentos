import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Layers3, PackagePlus } from 'lucide-react';
import type { CatalogProduct, KitInput, KitSummary, ProposalDetail } from '../shared/contracts';
import { kitsApi } from './api';
import { KitEditorHeader } from './KitEditorHeader';
import { KitFormFields, emptyKitDraft, type KitFormDraft } from './KitFormFields';
import { KitItemsTable } from './KitItemsTable';
import { KitProductPickerModal } from './KitProductPickerModal';
import { KitSidebar } from './KitSidebar';

type KitsWorkspaceProps = {
  activeProposal: ProposalDetail | null;
  onApplyKitToProposal?: (kitId: string) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

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
  const [pickerOpen, setPickerOpen] = useState(false);

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

    return () => {
      active = false;
    };
  }, [selectedKitId, creating, onError]);

  const beginCreate = () => {
    setCreating(true);
    setSelectedKitId(null);
    setDraft(emptyKitDraft);
  };

  const addProductToKit = (product: CatalogProduct) => {
    setDraft((current) => {
      const idx = current.items.findIndex((item) => item.productId === product.id);
      if (idx >= 0) {
        const items = [...current.items];
        items[idx] = { ...items[idx], quantity: items[idx].quantity + 1 };
        return { ...current, items };
      }
      return {
        ...current,
        items: [
          ...current.items,
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
      };
    });
  };

  const addProductsBatchToKit = (products: CatalogProduct[]) => {
    setDraft((current) => {
      const updated = [...current.items];
      for (const product of products) {
        const idx = updated.findIndex((it) => it.productId === product.id);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        } else {
          updated.push({
            productId: product.id,
            code: product.code,
            description: product.description,
            category: product.category,
            unit: product.unit,
            currentCost: product.currentCost,
            quantity: 1,
          });
        }
      }
      return { ...current, items: updated };
    });
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
    if (saving) return;

    const trimmedName = draft.name.trim();
    if (trimmedName.length < 2) {
      onError('O nome do kit deve ter no mínimo 2 caracteres.');
      return;
    }

    if (draft.items.length === 0) {
      onError('Adicione pelo menos um item ao kit.');
      return;
    }

    const hasInvalidItem = draft.items.some(
      (it) => !it.productId || Number.isNaN(Number(it.quantity)) || Number(it.quantity) <= 0,
    );
    if (hasInvalidItem) return onError('Todos os itens do kit devem ter quantidade válida maior que zero.');

    const itemMap = new Map<string, number>();
    for (const item of draft.items) {
      if (!item.productId) continue;
      itemMap.set(item.productId, (itemMap.get(item.productId) ?? 0) + (Number(item.quantity) || 0));
    }

    const sanitizedItems = Array.from(itemMap.entries())
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    if (sanitizedItems.length === 0) return onError('Adicione pelo menos um item válido ao kit.');

    setSaving(true);
    const payload: KitInput = {
      name: trimmedName,
      description: draft.description.trim() || null,
      category: draft.category.trim() || 'Geral',
      active: draft.active,
      items: sanitizedItems,
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
        <KitSidebar
          kits={kits}
          selectedKitId={selectedKitId}
          creating={creating}
          query={query}
          loading={loading}
          onQueryChange={setQuery}
          onSelectKit={(id) => {
            setCreating(false);
            setSelectedKitId(id);
          }}
        />

        <section className="client-editor">
          {creating || selectedKitId ? (
            <form className="client-form kit-form" onSubmit={(e) => void saveKit(e)}>
              <KitEditorHeader
                creating={creating}
                draftName={draft.name}
                totalEstimatedCost={totalEstimatedCost}
                itemsCount={draft.items.length}
                selectedKitId={selectedKitId}
                activeProposal={activeProposal}
                applying={applying}
                saving={saving}
                onApplyToActiveProposal={() => void handleApplyToActiveProposal()}
                onDeleteKit={() => void deleteKit()}
              />

              <KitFormFields
                draft={draft}
                onChange={(updated) => setDraft({ ...draft, ...updated })}
              />

              <KitItemsTable
                items={draft.items}
                onOpenPicker={() => setPickerOpen(true)}
                onUpdateQuantity={updateItemQuantity}
                onRemoveItem={removeKitItem}
              />
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

      <KitProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAddProduct={addProductToKit}
        onAddProductsBatch={addProductsBatchToKit}
        onError={onError}
      />
    </main>
  );
}
