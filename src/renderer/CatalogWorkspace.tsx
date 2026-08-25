import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Box, CircleDollarSign, PackagePlus, Save, Search } from 'lucide-react';
import type { CatalogProduct } from '../shared/contracts';
import { catalogApi } from './api';

type Props = { onNotice: (message: string) => void; onError: (message: string) => void };
type Draft = { code: string; manufacturer: string; model: string; description: string; category: string; unit: string; currentCost: string; source: string; active: boolean };
const emptyDraft: Draft = { code: '', manufacturer: '', model: '', description: '', category: '', unit: 'un', currentCost: '0,00', source: 'CONSTRUTEC', active: true };

const toDraft = (product: CatalogProduct): Draft => ({
  code: product.code, manufacturer: product.manufacturer ?? '', model: product.model ?? '', description: product.description,
  category: product.category, unit: product.unit, currentCost: product.currentCost.toFixed(2).replace('.', ','), source: product.source, active: product.active,
});

export function CatalogWorkspace({ onNotice, onError }: Props) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const selected = useMemo(() => products.find((product) => product.id === selectedId) ?? null, [products, selectedId]);

  const applyProducts = (next: CatalogProduct[], preferredId?: string | null) => {
    setProducts(next);
    const nextId = preferredId ?? selectedId ?? next[0]?.id ?? null;
    setSelectedId(next.some((product) => product.id === nextId) ? nextId : next[0]?.id ?? null);
  };

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try { const result = await catalogApi.list(query); if (active) applyProducts(result.products); }
      catch (error) { if (active) onError(error instanceof Error ? error.message : 'Não foi possível carregar o catálogo.'); }
      finally { if (active) setLoading(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  useEffect(() => { if (selected && !creating) setDraft(toDraft(selected)); }, [creating, selected]);

  const beginCreate = () => { setCreating(true); setSelectedId(null); setDraft(emptyDraft); };
  const parseCost = (value: string) => Number(value.trim().replace(/\./g, '').replace(',', '.'));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const currentCost = parseCost(draft.currentCost);
    if (!draft.code.trim() || !draft.description.trim() || !draft.category.trim() || !draft.unit.trim() || !Number.isFinite(currentCost) || currentCost < 0 || saving) return;
    setSaving(true);
    const input = { code: draft.code.trim(), manufacturer: draft.manufacturer.trim() || null, model: draft.model.trim() || null,
      description: draft.description.trim(), category: draft.category.trim(), unit: draft.unit.trim(), currentCost,
      source: draft.source.trim() || 'CONSTRUTEC', active: draft.active };
    try {
      if (creating) {
        const result = await catalogApi.create(input);
        applyProducts(result.products, result.productId); setCreating(false); onNotice('Item cadastrado no catálogo local.');
      } else if (selected) {
        const result = await catalogApi.update(selected.id, input);
        applyProducts(result.products, selected.id); onNotice('Item e preço atualizados. Propostas existentes foram preservadas.');
      }
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível salvar o item.'); }
    finally { setSaving(false); }
  };

  return <main className="management-workspace catalog-workspace">
    <header className="management-header"><div><Box size={25} /><span><h1>Catálogo</h1><p>Materiais, serviços, preços e fontes salvos localmente.</p></span></div><button type="button" className="primary" onClick={beginCreate}><PackagePlus size={17} /> Novo item</button></header>
    <div className="management-body">
      <aside className="client-list-pane"><label className="management-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, descrição, fabricante…" /></label><div className="client-list product-list" aria-busy={loading}>{products.map((product) => <button key={product.id} type="button" className={product.id === selectedId ? 'selected' : ''} onClick={() => { setCreating(false); setSelectedId(product.id); }}><Box size={17} /><span><b>{product.code}</b><small>{product.description}</small></span><em className={product.active ? '' : 'inactive-label'}>{product.active ? `R$ ${product.currentCost.toFixed(2).replace('.', ',')}` : 'Inativo'}</em></button>)}{!loading && products.length === 0 && <p className="management-empty">Nenhum item encontrado.</p>}</div></aside>
      <section className="client-editor">{creating || selected ? <form className="client-form product-form" onSubmit={(event) => void save(event)}><div className="editor-heading"><span><h2>{creating ? 'Novo item' : selected?.description}</h2><p>Alterações no catálogo não modificam propostas já existentes.</p></span><button type="submit" className="primary" disabled={saving}><Save size={16} /> {saving ? 'Salvando…' : 'Salvar item'}</button></div><div className="form-grid">
        <label><span>Código <b>*</b></span><input autoFocus value={draft.code} maxLength={60} onChange={(event) => setDraft({ ...draft, code: event.target.value })} /></label>
        <label><span>Categoria <b>*</b></span><input value={draft.category} maxLength={120} placeholder="Material, serviço, CFTV…" onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
        <label className="wide"><span>Descrição <b>*</b></span><input value={draft.description} maxLength={400} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <label><span>Fabricante</span><input value={draft.manufacturer} maxLength={120} onChange={(event) => setDraft({ ...draft, manufacturer: event.target.value })} /></label>
        <label><span>Modelo</span><input value={draft.model} maxLength={120} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></label>
        <label><span>Unidade <b>*</b></span><input value={draft.unit} maxLength={20} placeholder="un, m, cj, sv" onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></label>
        <label><span><CircleDollarSign size={14} /> Custo atual <b>*</b></span><input value={draft.currentCost} inputMode="decimal" onChange={(event) => setDraft({ ...draft, currentCost: event.target.value })} /></label>
        <label><span>Fonte</span><input value={draft.source} maxLength={120} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label>
        <label className="work-active"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span>Item ativo e disponível para novas propostas</span></label>
      </div></form> : <div className="editor-empty"><Box size={34} /><h2>Selecione um item</h2><p>Consulte ou altere os dados comerciais do catálogo.</p></div>}</section>
    </div>
  </main>;
}
