import { useEffect, useState } from 'react';
import { Archive, RotateCcw } from 'lucide-react';
import { proposalApi, type DiscardedProposalRecord } from './api';
import { SettingsCard } from './SettingsSections';

// Propostas descartadas por administradores: dá para restaurar (volta como estava, inclusive aprovada).
type Props = { onNotice: (message: string) => void; onError: (message: string) => void };

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function DiscardedProposalsPanel({ onNotice, onError }: Props) {
  const [items, setItems] = useState<DiscardedProposalRecord[] | null>(null);
  const [pendingId, setPendingId] = useState('');

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

  return (
    <SettingsCard icon={Archive} title="Propostas descartadas" sub="Só administradores descartam e restauram. Restaurar devolve também a obra ao Centro de Custos, se ela saiu junto. O registro de quem descartou e quando é permanente.">
      {items === null ? <p className="st-empty">Carregando…</p> : items.length === 0 ? <p className="st-empty">Nenhuma proposta descartada.</p> : (
        <div className="st-list">
          {items.map((item) => (
            <div key={item.id} className="st-mail">
              <span className="st-two">
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
