import { useState } from 'react';
import { CheckCircle2, RefreshCw, TrendingUp } from 'lucide-react';
import type { PriceDriftProposal, ProposalDetail } from '../shared/contracts';
import { priceDriftApi } from './api';
import { Drawer, brl, pctSigned, plural, revText, signBrl } from './orcDeskUi';
import { useSuitePermission } from './SuitePermissions';

type Props = {
  drift: PriceDriftProposal;
  onClose: () => void;
  onApplied: (updated: number, proposal: ProposalDetail) => void;
  onError: (message: string) => void;
};

// "Atualizar precos desta proposta?" (24j): item a item, com o efeito no custo e no valor final.
// Sem p10 o custo nao aparece, so o efeito percentual e no valor final.
export function PriceDriftDrawer({ drift, onClose, onApplied, onError }: Props) {
  const p10 = useSuitePermission('p10') && drift.costDelta !== undefined;
  const [busy, setBusy] = useState(false);
  const none = drift.items.length === 0;

  const apply = async () => {
    if (busy || none) return;
    setBusy(true);
    try {
      const result = await priceDriftApi.apply(drift.id);
      onApplied(result.updated, result.proposal);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível atualizar os preços.');
      setBusy(false);
    }
  };

  return <Drawer
    title="Atualizar preços desta proposta?" icon={TrendingUp} onClose={onClose}
    sub={`${drift.number} · ${revText(drift.revision)} · ${drift.workName || drift.clientName}`}
    footer={<>
      <button type="button" className="od-btn s" onClick={onClose}>Agora não</button>
      <button type="button" className="od-btn p" disabled={busy || none} onClick={() => void apply()}>
        <RefreshCw size={17} />{busy ? 'Atualizando…' : `Atualizar ${plural(drift.items.length, 'preço', 'preços')}`}
      </button>
    </>}
  >
    <div>
      {drift.items.map((item) => {
        const delta = p10 ? item.costDelta ?? 0 : item.finalDelta;
        return <div className="od-drift-row" key={item.id}>
          <span className="od-grow"><b style={{ fontSize: 'calc(13px * var(--fs, 1))', fontWeight: 600 }}>{item.description}</b>
            <span style={{ fontSize: 'calc(12px * var(--fs, 1))' }}>{item.quantity.toLocaleString('pt-BR')} {item.unit}{p10 ? ` · custo ${brl(item.fromUnit ?? 0)} → ${brl(item.toUnit ?? 0)}` : ` · ${pctSigned(item.changePercent)} no preço`}</span></span>
          <b className="od-num" style={{ color: delta > 0 ? 'var(--od-warn-fg)' : 'var(--od-ok-fg)' }}>{signBrl(delta)}</b>
        </div>;
      })}
    </div>
    {none && <div className="od-note ok"><CheckCircle2 size={17} /><span>Os preços desta proposta já estão iguais aos do catálogo.</span></div>}
    <div className="od-sum">
      {p10 && <div><span>Custo base</span><b className="od-num">{signBrl(drift.costDelta ?? 0)}</b></div>}
      <div><b>Valor final</b><b className="od-num">{brl(drift.finalBefore)} → {brl(drift.finalAfter)}</b></div>
    </div>
    <span className="od-small">Só muda o preço de custo desses itens. Quantidades, BDI e impostos continuam como estão. Proposta em revisão, enviada ou aprovada mantém os preços; os novos entram na próxima revisão.</span>
  </Drawer>;
}
