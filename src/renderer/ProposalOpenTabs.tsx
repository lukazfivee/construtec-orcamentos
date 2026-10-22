import { useLayoutEffect, useRef, useState } from 'react';
import type { ProposalSummary } from '../shared/contracts';
import { LayoutList, Plus } from './icons';

type Props = {
  proposalTabs: ProposalSummary[];
  selectedId: string;
  loading: boolean;
  onViewList: () => void;
  onOpenProposal: (proposalId: string) => void | Promise<void>;
  onNewProposal: () => void;
};

/* Abas das propostas abertas: mostra so as que cabem inteiras; as demais viram o botao "+N" (abre a lista).
   A aba da proposta aberta sempre aparece. Mede de novo quando a largura muda. */
export function ProposalOpenTabs({ proposalTabs, selectedId, loading, onViewList, onOpenProposal, onNewProposal }: Props) {
  const bar = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null); // null = medir com todas na tela
  const total = proposalTabs.length;

  useLayoutEffect(() => {
    const box = bar.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    let width = box.clientWidth;
    const observer = new ResizeObserver(() => {
      if (Math.abs(box.clientWidth - width) < 1) return;
      width = box.clientWidth;
      setFit(null);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => { setFit(null); }, [total]);

  useLayoutEffect(() => {
    const box = bar.current;
    if (!box || fit !== null) return;
    const style = getComputedStyle(box);
    const gap = parseFloat(style.columnGap) || 0;
    const fixed = [...box.querySelectorAll<HTMLElement>('.view-list-tab, .tab-divider, .new-tab')]
      .reduce((sum, el) => sum + el.offsetWidth + gap, 0);
    const more = 56 + gap; // largura reservada para o "+N"
    const room = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - fixed;
    const widths = [...box.querySelectorAll<HTMLElement>('[data-open-tab]')].map((el) => el.offsetWidth + gap);
    let used = 0;
    let count = 0;
    for (const w of widths) {
      const reserve = count + 1 < widths.length ? more : 0;
      if (used + w + reserve > room) break;
      used += w;
      count += 1;
    }
    setFit(Math.max(1, count));
  }, [fit, proposalTabs]);

  let visible = proposalTabs;
  if (fit !== null && fit < total) {
    visible = proposalTabs.slice(0, fit);
    if (!visible.some((tab) => tab.id === selectedId)) {
      const selected = proposalTabs.find((tab) => tab.id === selectedId);
      if (selected) visible = [...visible.slice(0, fit - 1), selected];
    }
  }
  const hidden = total - visible.length;

  return (
    <div className="proposal-tabs" role="tablist" aria-label="Propostas abertas" ref={bar}>
      <button type="button" className="view-list-tab" onClick={onViewList} title="Ver lista completa de propostas">
        <LayoutList size={15} /> Ver todas ({total})
      </button>
      <span className="tab-divider" />
      {visible.map((tab) => {
        const selected = tab.id === selectedId;
        return (
          <button
            key={tab.id}
            data-open-tab=""
            className={selected ? 'selected' : ''}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={loading}
            title={`${tab.clientName} · ${tab.workName}`}
            onClick={() => void onOpenProposal(tab.id)}
          >
            {tab.number} • REV.{String(tab.revision).padStart(2, '0')}
          </button>
        );
      })}
      {hidden > 0 && (
        <button type="button" className="more-tabs" onClick={onViewList} title={`Mais ${hidden} propostas abertas: ver a lista`} aria-label={`Mais ${hidden} propostas abertas`}>
          +{hidden}
        </button>
      )}
      <button type="button" className="new-tab" onClick={onNewProposal}>
        <Plus size={17} /> Nova proposta
      </button>
    </div>
  );
}
