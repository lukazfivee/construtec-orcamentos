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
  };

  const addProductsBatchToKit = (products: CatalogProduct[]) => {
    const updated = [...draft.items];
    for (const product of products) {
      const idx = updated.findIndex((it) => it.productId === product.id);
      if (idx >= 0) updated[idx].quantity += 1;
      else {
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
    setDraft({ ...draft, items: updated });
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
