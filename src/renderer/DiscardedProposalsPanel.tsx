import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { proposalApi, type DiscardedProposalRecord } from './api';

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
    <section className="settings-card" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '20px' }}>
      <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Propostas descartadas</h2>
      <p style={{ margin: '2px 0 12px', fontSize: '10px', color: 'var(--muted)' }}>Só administradores descartam e restauram. Restaurar devolve também a obra ao Centro de Custos, se ela saiu junto. O registro de quem descartou e quando é permanente.</p>
      {items === null ? <p style={{ fontSize: '11px' }}>Carregando…</p> : items.length === 0 ? <p style={{ fontSize: '11px' }}>Nenhuma proposta descartada.</p> : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderTop: '1px solid var(--bd-cool-92)', fontSize: '11px' }}>
              <span>
                <b>{item.proposal_number}</b> · {item.client_name ?? 'Sem cliente'}{item.work_name ? ` · ${item.work_name}` : ''}{item.had_approval ? ' · aprovada' : ''}
                <br /><small style={{ color: 'var(--muted)' }}>
                  {item.restored_at ? `Restaurada em ${dateFormat.format(new Date(item.restored_at))} por ${item.restored_by_name ?? ''}` : `Descartada em ${dateFormat.format(new Date(item.discarded_at))} por ${item.discarded_by_name ?? ''}`}
                  {item.reason ? ` · ${item.reason}` : ''}
                </small>
              </span>
              {!item.restored_at && (
                <button type="button" className="secondary-btn" disabled={pendingId === item.id} onClick={() => void restore(item.id)}>
                  <RotateCcw size={14} /> {pendingId === item.id ? 'Restaurando…' : 'Restaurar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
