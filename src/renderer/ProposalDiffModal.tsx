import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronRight,
  GitCompare,
  HardHat,
  Loader2,
  Package,
  X,
} from 'lucide-react';
import type { ProposalDetail, ProposalLaborItem, ProposalRevisionSummary } from '../shared/contracts';
import { proposalApi } from './api';
import {
  computeFinancialDelta,
  computeProposalItemsDiff,
  computeProposalLaborDiff,
} from './proposalDiffHelpers';
import { ProposalDiffTables } from './ProposalDiffTables';

interface Props {
  open: boolean;
  currentProposal: ProposalDetail;
  revisions: ProposalRevisionSummary[];
  initialBaseRevisionId?: string;
  onClose: () => void;
  onOpenRevision?: (revisionId: string) => void;
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProposalDiffModal({
  open,
  currentProposal,
  revisions,
  initialBaseRevisionId,
  onClose,
  onOpenRevision,
}: Props) {
  const [revAId, setRevAId] = useState('');
  const [revBId, setRevBId] = useState('');
  const [detailA, setDetailA] = useState<ProposalDetail | null>(null);
  const [detailB, setDetailB] = useState<ProposalDetail | null>(null);
  const [laborA, setLaborA] = useState<ProposalLaborItem[]>([]);
  const [laborB, setLaborB] = useState<ProposalLaborItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'labor'>('items');
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!open || revisions.length === 0) return;
    const targetB = currentProposal.id;
    let targetA = initialBaseRevisionId;

    if (!targetA || targetA === targetB) {
      const sorted = [...revisions].sort((a, b) => b.revision - a.revision);
      const prev = sorted.find((r) => r.id !== targetB);
      targetA = prev ? prev.id : targetB;
    }

    setRevAId(targetA);
    setRevBId(targetB);
  }, [open, revisions, currentProposal.id, initialBaseRevisionId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !revAId || !revBId) return;
    let active = true;
    setLoading(true);

    const loadProposalData = async (id: string) => {
      if (id === currentProposal.id) {
        const laborRes = await proposalApi.labor(id).catch(() => ({ items: [] }));
        return { detail: currentProposal, labor: laborRes.items };
      }
      const [pRes, lRes] = await Promise.all([
        proposalApi.byId(id),
        proposalApi.labor(id).catch(() => ({ items: [] })),
      ]);
      return { detail: pRes.proposal, labor: lRes.items };
    };

    Promise.all([loadProposalData(revAId), loadProposalData(revBId)])
      .then(([resA, resB]) => {
        if (!active) return;
        setDetailA(resA.detail);
        setLaborA(resA.labor);
        setDetailB(resB.detail);
        setLaborB(resB.labor);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, revAId, revBId, currentProposal]);

  const itemsDiffData = useMemo(() => {
    if (!detailA || !detailB) return { diffs: [], stats: { addedCount: 0, removedCount: 0, changedCount: 0, unchangedCount: 0 } };
    return computeProposalItemsDiff(detailA.items, detailB.items);
  }, [detailA, detailB]);

  const laborDiffData = useMemo(() => {
    return computeProposalLaborDiff(laborA, laborB);
  }, [laborA, laborB]);

  const financialDelta = useMemo(() => {
    if (!detailA || !detailB) return null;
    return computeFinancialDelta(detailA, detailB);
  }, [detailA, detailB]);

  const filteredItems = useMemo(() => {
    return itemsDiffData.diffs.filter((it) => {
      if (onlyChanges && it.status === 'unchanged') return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        it.description.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
      );
    });
  }, [itemsDiffData.diffs, onlyChanges, searchTerm]);

  if (!open) return null;

  const handleSwap = () => {
    setRevAId(revBId);
    setRevBId(revAId);
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="proposal-diff-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diff-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="diff-header">
          <div className="diff-title-box">
            <GitCompare size={22} className="diff-icon" />
            <div>
              <h2 id="diff-dialog-title">Comparativo de Revisões</h2>
              <p>Orçamento <b>{currentProposal.number}</b> • Análise de alterações entre versões</p>
            </div>
          </div>

          <div className="diff-selectors-box">
            <div className="selector-group">
              <small>Revisão Base (A):</small>
              <select value={revAId} onChange={(e) => setRevAId(e.target.value)} disabled={loading}>
                {revisions.map((r) => (
                  <option key={r.id} value={r.id}>
                    REV.{String(r.revision).padStart(2, '0')} ({r.itemCount} itens - {money.format(r.totalSale)})
                  </option>
                ))}
              </select>
            </div>

            <button type="button" className="swap-btn" title="Inverter comparação" onClick={handleSwap} disabled={loading}>
              <ArrowLeftRight size={14} />
            </button>

            <div className="selector-group">
              <small>Revisão Alvo (B):</small>
              <select value={revBId} onChange={(e) => setRevBId(e.target.value)} disabled={loading}>
                {revisions.map((r) => (
                  <option key={r.id} value={r.id}>
                    REV.{String(r.revision).padStart(2, '0')} ({r.itemCount} itens - {money.format(r.totalSale)})
                  </option>
                ))}
              </select>
            </div>

            <button type="button" className="dialog-close" aria-label="Fechar" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="diff-loading-state">
            <Loader2 className="spinning" size={24} />
            <span>Comparando composições de propostas…</span>
          </div>
        ) : (
          <div className="diff-body">
            {financialDelta && (
              <div className="diff-summary-row">
                <div className="diff-metric-card primary">
                  <span className="metric-label">Valor Total Orçado (Rev B)</span>
                  <div className="metric-main">
                    <strong>{money.format(financialDelta.saleB)}</strong>
                    <span className={`delta-badge ${financialDelta.deltaSale >= 0 ? 'pos' : 'neg'}`}>
                      {financialDelta.deltaSale >= 0 ? '+' : ''}{money.format(financialDelta.deltaSale)}
                      {' '}({financialDelta.percentSale >= 0 ? '+' : ''}{financialDelta.percentSale.toFixed(1)}%)
                    </span>
                  </div>
                  <span className="metric-sub">Base (Rev A): {money.format(financialDelta.saleA)}</span>
                </div>

                <div className="diff-metric-card">
                  <span className="metric-label">Balanço de Itens</span>
                  <div className="stat-chips">
                    <span className="chip-added">+{itemsDiffData.stats.addedCount} novos</span>
                    <span className="chip-removed">-{itemsDiffData.stats.removedCount} removidos</span>
                    <span className="chip-changed">{itemsDiffData.stats.changedCount} alterados</span>
                    <span className="chip-same">{itemsDiffData.stats.unchangedCount} iguais</span>
                  </div>
                  <span className="metric-sub">
                    {financialDelta.itemCountA} itens na Rev A → {financialDelta.itemCountB} itens na Rev B
                  </span>
                </div>

                <div className="diff-metric-card">
                  <span className="metric-label">Parâmetros & Margem</span>
                  <div className="metric-main">
                    <span>BDI: <b>{financialDelta.bdiA}x</b> → <b>{financialDelta.bdiB}x</b></span>
                  </div>
                  <span className="metric-sub">
                    Custo total: {money.format(financialDelta.costB)} (Δ {money.format(financialDelta.deltaCost)})
                  </span>
                </div>
              </div>
            )}

            <div className="diff-toolbar">
              <div className="diff-tabs">
                <button
                  type="button"
                  className={activeTab === 'items' ? 'active' : ''}
                  onClick={() => setActiveTab('items')}
                >
                  <Package size={14} /> Itens de Materiais ({itemsDiffData.diffs.length})
                </button>
                <button
                  type="button"
                  className={activeTab === 'labor' ? 'active' : ''}
                  onClick={() => setActiveTab('labor')}
                >
                  <HardHat size={14} /> Mão de Obra ({laborDiffData.length})
                </button>
              </div>

              {activeTab === 'items' && (
                <div className="diff-filters">
                  <input
                    type="search"
                    placeholder="Filtrar por código ou descrição…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={onlyChanges}
                      onChange={(e) => setOnlyChanges(e.target.checked)}
                    />
                    <span>Ocultar inalterados</span>
                  </label>
                </div>
              )}
            </div>

            <ProposalDiffTables
              activeTab={activeTab}
              filteredItems={filteredItems}
              laborDiffData={laborDiffData}
            />
          </div>
        )}

        <footer className="diff-footer">
          <span>Revisão A ({detailA?.number} rev.{detailA?.revision}) vs Revisão B ({detailB?.number} rev.{detailB?.revision})</span>
          <div className="footer-actions">
            {onOpenRevision && revAId !== currentProposal.id && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  onClose();
                  onOpenRevision(revAId);
                }}
              >
                Abrir Revisão {revisions.find((r) => r.id === revAId)?.revision} <ChevronRight size={14} />
              </button>
            )}
            <button type="button" className="primary" onClick={onClose}>
              Fechar Comparativo
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
