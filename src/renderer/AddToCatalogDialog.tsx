import { useState, type FormEvent } from 'react';
import { BookmarkPlus, X } from 'lucide-react';
import type { ProposalLine } from '../shared/contracts';

type Props = {
  item: ProposalLine;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (code: string, category: string) => void;
};

// Leva uma linha avulsa da proposta para o catalogo: descricao, unidade e custo saem da linha; falta so o codigo e a categoria.
export function AddToCatalogDialog({ item, busy, onCancel, onConfirm }: Props) {
  const [code, setCode] = useState(item.code);
  const [category, setCategory] = useState(item.category || 'Outros');
  const submit = (event: FormEvent) => { event.preventDefault(); if (code.trim() && !busy) onConfirm(code.trim(), category.trim()); };
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="new-proposal-dialog" role="dialog" aria-modal="true" aria-labelledby="add-catalog-title">
        <header>
          <div>
            <BookmarkPlus size={22} />
            <span><h2 id="add-catalog-title">Adicionar ao catálogo</h2><p>{item.description}</p></span>
          </div>
          <button type="button" className="dialog-close" aria-label="Fechar" disabled={busy} onClick={onCancel}><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <label><span>Código no catálogo <b>*</b></span><input autoFocus required maxLength={60} value={code} onChange={(event) => setCode(event.target.value)} /></label>
          <label><span>Categoria</span><input maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} /></label>
          <p className="dialog-warning">Entram no catálogo a descrição, a unidade ({item.unit}) e o custo desta linha. A proposta passa a usar o produto do catálogo.</p>
          <footer>
            <button type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
            <button type="submit" className="primary" disabled={busy || !code.trim()}>{busy ? 'Adicionando…' : 'Adicionar ao catálogo'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
