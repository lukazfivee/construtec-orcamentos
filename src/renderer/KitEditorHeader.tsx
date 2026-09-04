import { Save, Send, Trash2 } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Props = {
  creating: boolean;
  draftName: string;
  totalEstimatedCost: number;
  itemsCount: number;
  selectedKitId: string | null;
  activeProposal: ProposalDetail | null;
  applying: boolean;
  saving: boolean;
  onApplyToActiveProposal: () => void;
  onDeleteKit: () => void;
};

export function KitEditorHeader({
  creating,
  draftName,
  totalEstimatedCost,
  itemsCount,
  selectedKitId,
  activeProposal,
  applying,
  saving,
  onApplyToActiveProposal,
  onDeleteKit,
}: Props) {
  return (
    <div
      className="editor-heading"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <h2 style={{ overflowWrap: 'anywhere' }}>{creating ? 'Novo kit' : draftName}</h2>
        <p style={{ overflowWrap: 'anywhere' }}>
          Composição estimada: <b>{money.format(totalEstimatedCost)}</b> ({itemsCount} itens)
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {selectedKitId && !creating && activeProposal && (
          <button
            type="button"
            onClick={onApplyToActiveProposal}
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
            onClick={onDeleteKit}
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
  );
}
