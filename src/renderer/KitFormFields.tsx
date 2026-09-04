import type { KitItemDraft } from './KitItemsTable';

export type KitFormDraft = {
  name: string;
  description: string;
  category: string;
  active: boolean;
  items: KitItemDraft[];
};

export const emptyKitDraft: KitFormDraft = {
  name: '',
  description: '',
  category: 'CFTV',
  active: true,
  items: [],
};

type Props = {
  draft: KitFormDraft;
  onChange: (updated: Partial<KitFormDraft>) => void;
};

export function KitFormFields({ draft, onChange }: Props) {
  return (
    <div className="form-grid">
      <label className="wide">
        <span>Nome do kit <b>*</b></span>
        <input
          autoFocus
          value={draft.name}
          maxLength={180}
          placeholder="Ex: Kit CFTV 4 Câmeras Full HD, Kit Infraestrutura 100m…"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>

      <label>
        <span>Categoria <b>*</b></span>
        <input
          value={draft.category}
          maxLength={120}
          placeholder="CFTV, Controle de acesso, Cabeamento, Infraestrutura…"
          onChange={(e) => onChange({ category: e.target.value })}
        />
      </label>

      <label>
        <span>Descrição / Aplicação</span>
        <input
          value={draft.description}
          maxLength={500}
          placeholder="Instalação padrão em escritórios, galpões…"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </label>

      <label className="work-active wide">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => onChange({ active: e.target.checked })}
        />
        <span>Kit ativo e disponível para uso rápido em propostas</span>
      </label>
    </div>
  );
}
