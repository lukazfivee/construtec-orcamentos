import { useEffect, useMemo, useState } from 'react';
import { Layers3, Search, Send } from 'lucide-react';
import type { KitDetail, KitSummary } from '../shared/contracts';
import { costText } from './SuitePermissions';
import { kitsApi } from './api';

type ProposalKitsPanelProps = {
  proposalId: string;
  proposalNumber: string;
  bdiMultiplier: number;
  editable: boolean;
  onApplied: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProposalKitsPanel({
  proposalId,
  proposalNumber,
  bdiMultiplier,
  editable,
  onApplied,
  onError,
  onNotice,
}: ProposalKitsPanelProps) {
  const [kits, setKits] = useState<KitSummary[]>([]);
  const [query, setQuery] = useState('');
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [selectedKitDetail, setSelectedKitDetail] = useState<KitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await kitsApi.list(query);
        if (!active) return;
        const activeKits = result.kits.filter((k) => k.active);
        setKits(activeKits);
        if (activeKits.length > 0 && !selectedKitId) {
          setSelectedKitId(activeKits[0].id);
        }
      } catch (error) {
        if (active) onError(error instanceof Error ? error.message : 'Erro ao listar kits.');
      } finally {
        if (active) setLoading(false);
      }
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!selectedKitId) {
      setSelectedKitDetail(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const result = await kitsApi.get(selectedKitId);
        if (active) setSelectedKitDetail(result.kit);
      } catch (error) {
        if (active) onError(error instanceof Error ? error.message : 'Erro ao carregar detalhes do kit.');
      }
    })();
    return () => { active = false; };
  }, [selectedKitId]);

  const estimatedSaleTotal = useMemo(() => {
    if (!selectedKitDetail) return 0;
    return Math.round((selectedKitDetail.totalEstimatedCost * bdiMultiplier + Number.EPSILON) * 100) / 100;
  }, [selectedKitDetail, bdiMultiplier]);

  const handleApply = async () => {
    if (!selectedKitId || !editable || applying) return;
    setApplying(true);
    try {
      await kitsApi.applyToProposal(selectedKitId, proposalId);
      onNotice(`Kit "${selectedKitDetail?.name ?? ''}" inserido na proposta ${proposalNumber}.`);
      onApplied();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível aplicar o kit na proposta.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="proposal-kits-panel">
      <div className="kp-list-pane">
        <div className="kp-search">
          <label className="management-search">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar kits por nome…" aria-label="Buscar kits por nome" />
          </label>
        </div>
        <div className="client-list product-list kp-list" aria-busy={loading}>
          {kits.map((kit) => (
            <button key={kit.id} type="button" className={kit.id === selectedKitId ? 'selected' : ''} onClick={() => setSelectedKitId(kit.id)}>
              <Layers3 size={17} />
              <span>
                <b>{kit.name}</b>
                <small>{kit.itemCount} itens • {kit.category}</small>
              </span>
              <em>{costText(money.format(kit.totalEstimatedCost))}</em>
            </button>
          ))}
          {!loading && kits.length === 0 && (
            <p className="management-empty">Nenhum kit cadastrado.</p>
          )}
        </div>
      </div>

      <div className="kp-detail">
        {selectedKitDetail ? (
          <div className="kp-card">
            <div className="kp-head">
              <div className="kp-title">
                <h2>{selectedKitDetail.name}</h2>
                <p>
                  Categoria: <b>{selectedKitDetail.category}</b>
                  {selectedKitDetail.description ? ` • ${selectedKitDetail.description}` : ''}
                </p>
              </div>
              <div className="kp-apply">
                <div className="kp-price">
                  <span>Preço de venda estimado (BDI {bdiMultiplier}×)</span>
                  <strong>{costText(money.format(estimatedSaleTotal))}</strong>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void handleApply()}
                  disabled={!editable || applying || selectedKitDetail.items.length === 0}
                >
                  <Send size={16} />
                  {applying ? 'Inserindo…' : 'Inserir kit nesta proposta'}
                </button>
              </div>
            </div>

            <h3 className="kp-sub">Itens incluídos no kit ({selectedKitDetail.items.length})</h3>

            <div className="kp-table">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th className="kp-c">Un.</th>
                    <th className="kp-n">Qtd.</th>
                    <th className="kp-n">Custo un.</th>
                    <th className="kp-n">Custo total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedKitDetail.items.map((item) => (
                    <tr key={item.id}>
                      <td><b>{item.code}</b></td>
                      <td>{item.description}</td>
                      <td className="kp-c">{item.unit}</td>
                      <td className="kp-n">{item.quantity}</td>
                      <td className="kp-n">{costText(money.format(item.currentCost))}</td>
                      <td className="kp-n"><b>{costText(money.format(item.totalCost))}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="kp-note">
              Ao inserir o kit, cada produto será adicionado como uma linha independente na proposta com seu snapshot de custo atual.
            </p>
          </div>
        ) : (
          <div className="editor-empty">
            <Layers3 size={32} />
            <h2>Selecione um kit</h2>
            <p>Escolha um kit na lista ao lado para visualizar a composição e inserir nesta proposta.</p>
          </div>
        )}
      </div>
    </div>
  );
}
