import { useEffect, useState } from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { proposalApi, type DiscardedProposalRecord } from './api';
import { SettingsCard } from './SettingsSections';

// Propostas descartadas por administradores: dá para restaurar (volta como estava, inclusive aprovada).
type Props = { onNotice: (message: string) => void; onError: (message: string) => void };

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function DiscardedProposalsPanel({ onNotice, onError }: Props) {
  const [items, setItems] = useState<DiscardedProposalRecord[] | null>(null);
  const [pendingId, setPendingId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try { setItems((await proposalApi.discarded()).discarded); }
    catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível carregar as propostas descartadas.'); }
  };
  useEffect(() => { void load(); }, []);

  const restore = async (id: string) => {
    setPendingId(id);
    try {
      const result = await proposalApi.restoreDiscarded(id);
      onNotice(`Proposta ${result.proposalNumber} restaurada.`);
      await load();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível restaurar a proposta.');
    } finally { setPendingId(''); }
  };

  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (!next.delete(id)) next.add(id); return next; });
  const allSelected = !!items && items.length > 0 && selected.size === items.length;
  const remove = async (ids: string[]) => {
    const message = ids.length === 1
      ? 'Excluir permanentemente esta proposta descartada? Ela some da lista e não poderá mais ser restaurada. Não é possível desfazer.'
      : `Excluir permanentemente ${ids.length} propostas descartadas? Elas somem da lista e não poderão mais ser restauradas. Não é possível desfazer.`;
    if (!window.confirm(message)) return;
    setDeleting(true);
    try {
      const result = await proposalApi.deleteDiscarded(ids);
      onNotice(result.deleted === 1 ? 'Proposta descartada excluída para sempre.' : `${result.deleted} propostas descartadas excluídas para sempre.`);
      setSelected(new Set());
      await load();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível excluir as propostas descartadas.');
    } finally { setDeleting(false); }
  };

  return (
    <SettingsCard icon={Archive} title="Propostas descartadas" sub="Só administradores descartam e restauram. Restaurar devolve também a obra ao Centro de Custos, se ela saiu junto. Excluir permanentemente apaga a proposta guardada de vez; só o registro de auditoria fica.">
      {items === null ? <p className="st-empty">Carregando…</p> : items.length === 0 ? <p className="st-empty">Nenhuma proposta descartada.</p> : (
        <div className="st-list">
          <div className="st-mail">
            <label className="st-two" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={allSelected} disabled={deleting} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))} aria-label="Selecionar todas" />
              <b>{selected.size ? `${selected.size} selecionada${selected.size > 1 ? 's' : ''}` : 'Selecionar todas'}</b>
            </label>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="od-btn s sm danger" disabled={deleting || !selected.size} onClick={() => void remove([...selected])}>
                <Trash2 size={15} strokeWidth={1.5} /> Excluir selecionadas
              </button>
              <button type="button" className="od-btn s sm danger" disabled={deleting} onClick={() => void remove(items.map((item) => item.id))}>
                <Trash2 size={15} strokeWidth={1.5} /> Excluir todas
              </button>
            </span>
          </div>
          {items.map((item) => (
            <div key={item.id} className="st-mail">
              <input type="checkbox" checked={selected.has(item.id)} disabled={deleting} onChange={() => toggle(item.id)} aria-label={`Selecionar ${item.proposal_number}`} />
              <span className="st-two" style={{ flex: 1 }}>
                <b>{item.proposal_number} · {item.client_name ?? 'Sem cliente'}{item.work_name ? ` · ${item.work_name}` : ''}{item.had_approval ? ' · aprovada' : ''}</b>
                <small>
                  {item.restored_at ? `Restaurada em ${dateFormat.format(new Date(item.restored_at))} por ${item.restored_by_name ?? ''}` : `Descartada em ${dateFormat.format(new Date(item.discarded_at))} por ${item.discarded_by_name ?? ''}`}
                  {item.reason ? ` · ${item.reason}` : ''}
                </small>
              </span>
              {!item.restored_at && (
                <button type="button" className="od-btn s sm" disabled={pendingId === item.id} onClick={() => void restore(item.id)}>
                  <RotateCcw size={15} strokeWidth={1.5} /> {pendingId === item.id ? 'Restaurando…' : 'Restaurar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}
