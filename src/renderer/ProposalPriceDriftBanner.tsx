import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, X } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { proposalApi, type PriceDrift } from './api';
import { useCanEdit, useSuitePermission } from './SuitePermissions';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const qty = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const signBrl = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${brl.format(Math.abs(value))}`;
const pctText = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const plural = (count: number, one: string, many: string) => `${count.toLocaleString('pt-BR')} ${count === 1 ? one : many}`;

// "Agora não" vale para esta sessao do app; ao voltar a proposta o aviso reaparece se o preco ainda diferir.
const dismissed = new Set<string>();

type Props = {
  proposal: ProposalDetail;
  onProposalUpdate: (proposal: ProposalDetail) => void;
  showNotice: (message: string) => void;
  setError: (error: string) => void;
};

// Aviso de preco novo no catalogo/EXSAT dentro da proposta em edicao (Rodada 23, telas 23e e 23f).
// Sem p10 o servidor nao manda o custo, so o efeito no valor final.
export function ProposalPriceDriftBanner({ proposal, onProposalUpdate, showNotice, setError }: Props) {
  const canEdit = useCanEdit();
  const p10 = useSuitePermission('p10');
  const [drift, setDrift] = useState<PriceDrift | null>(null);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [, setTick] = useState(0);
  const editing = proposal.status === 'draft' && proposal.isLatest && canEdit;

  useEffect(() => {
    setOpen(false);
    if (!editing) { setDrift(null); return undefined; }
    let active = true;
    void proposalApi.priceDrift(proposal.id)
      .then((result) => { if (active) setDrift(result.drift && !result.drift.frozen && result.drift.items.length ? result.drift : null); })
      .catch(() => { if (active) setDrift(null); });
    return () => { active = false; };
  }, [editing, proposal.id, proposal.updatedAt]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !applying) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, applying]);

  if (!drift || (dismissed.has(proposal.id) && !open)) return null;
  const withCost = p10 && drift.costDelta !== undefined;

  const apply = async () => {
    setApplying(true);
    setError('');
    try {
      const result = await proposalApi.applyPriceDrift(proposal.id);
      setOpen(false);
      setDrift(null);
      onProposalUpdate(result.proposal);
      showNotice(`${plural(result.updated, 'preço atualizado', 'preços atualizados')} na ${proposal.number} · valor final ${brl.format(drift.finalAfter)}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível atualizar os preços.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      {!dismissed.has(proposal.id) && (
        <div className="drift-banner" role="status">
          <span className="drift-banner-icon" aria-hidden="true"><TrendingUp size={18} /></span>
          <div>
            <b>Atualizar preços desta proposta?</b>
            <span>
              {plural(drift.items.length, 'item mudou', 'itens mudaram')} de preço no catálogo desde que {drift.items.length === 1 ? 'entrou' : 'entraram'} aqui.{' '}
              {withCost ? `Custo ${signBrl(drift.costDelta ?? 0)}, ` : ''}valor final {signBrl(drift.finalDelta)}.
            </span>
          </div>
          <button type="button" className="flow-btn" onClick={() => { dismissed.add(proposal.id); setTick((value) => value + 1); showNotice('Os preços ficam como estão · dá para atualizar item a item.'); }}>Agora não</button>
          <button type="button" className="flow-btn primary" onClick={() => setOpen(true)}><TrendingUp size={16} /> Ver e atualizar</button>
        </div>
      )}

      {open && (
        <div className="side-drawer-layer">
          <button type="button" className="side-drawer-scrim" aria-label="Fechar painel" disabled={applying} onClick={() => setOpen(false)} />
          <aside className="side-drawer" role="dialog" aria-modal="true" aria-label="Atualizar preços desta proposta?">
            <header>
              <span className="side-drawer-icon" aria-hidden="true"><TrendingUp size={18} /></span>
              <div>
                <h2>Atualizar preços desta proposta?</h2>
                <p>{drift.number} · REV {String(drift.revision).padStart(2, '0')} · {drift.workName || drift.clientName}</p>
              </div>
              <button type="button" className="dialog-close" aria-label="Fechar" disabled={applying} onClick={() => setOpen(false)}><X size={16} /></button>
            </header>
            <div className="side-drawer-body">
              {drift.items.map((item) => {
                const delta = withCost ? item.costDelta ?? 0 : item.finalDelta;
                return (
                  <div className="drift-row" key={item.id}>
                    <div>
                      <b>{item.description}</b>
                      <span>{qty.format(item.quantity)} {item.unit}{withCost ? ` · custo ${brl.format(item.fromUnit ?? 0)} → ${brl.format(item.toUnit ?? 0)}` : ` · ${pctText(item.changePercent)} no preço`}</span>
                    </div>
                    <b className={`delta ${delta > 0 ? 'up' : 'down'}`}>{signBrl(delta)}</b>
                  </div>
                );
              })}
              <div className="drift-sum">
                {withCost && <div><span>Custo base</span><b>{signBrl(drift.costDelta ?? 0)}</b></div>}
                <div className="strong"><span>Valor final</span><b>{brl.format(drift.finalBefore)} → {brl.format(drift.finalAfter)}</b></div>
              </div>
              <p className="side-drawer-note">Os itens passam a usar o preço atual do catálogo. Quantidades, BDI e impostos continuam como estão. Proposta em revisão, enviada ou aprovada mantém os preços; os novos entram na próxima revisão.</p>
            </div>
            <footer>
              <button type="button" className="flow-btn" disabled={applying} onClick={() => setOpen(false)}>Agora não</button>
              <button type="button" className="flow-btn primary" disabled={applying} onClick={() => void apply()}>
                {applying && <Loader2 size={16} className="spinning" />} Atualizar {plural(drift.items.length, 'preço', 'preços')}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
