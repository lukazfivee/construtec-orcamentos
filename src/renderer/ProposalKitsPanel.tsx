import { useEffect, useMemo, useState } from 'react';
import { Layers3, Search, Send } from 'lucide-react';
import type { KitDetail, KitSummary } from '../shared/contracts';
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
    <div className="proposal-kits-panel" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100%', minHeight: 0, background: '#fff' }}>
      {/* Kits List */}
      <div style={{ borderRight: '1px solid #e4e6ea', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #e4e6ea' }}>
          <label className="management-search" style={{ margin: 0, height: '32px' }}>
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar kits por nome…"
              style={{ fontSize: '11px' }}
            />
          </label>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }} className="client-list product-list" aria-busy={loading}>
          {kits.map((kit) => (
            <button
              key={kit.id}
              type="button"
              className={kit.id === selectedKitId ? 'selected' : ''}
              onClick={() => setSelectedKitId(kit.id)}
              style={{ minHeight: '52px', padding: '6px 12px' }}
            >
              <Layers3 size={15} />
              <span>
                <b style={{ fontSize: '11px' }}>{kit.name}</b>
                <small style={{ fontSize: '9px' }}>{kit.itemCount} itens • {kit.category}</small>
              </span>
              <em style={{ fontSize: '10px' }}>{money.format(kit.totalEstimatedCost)}</em>
            </button>
          ))}
          {!loading && kits.length === 0 && (
            <p className="management-empty">Nenhum kit cadastrado.</p>
          )}
        </div>
      </div>

      {/* Kit Detail & Apply Action */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, padding: '20px', overflowY: 'auto' }}>
        {selectedKitDetail ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f0f2f5', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#122036' }}>
                  {selectedKitDetail.name}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#697386' }}>
                  Categoria: <b>{selectedKitDetail.category}</b>
                  {selectedKitDetail.description ? ` • ${selectedKitDetail.description}` : ''}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: '10px', color: '#697386' }}>Preço de venda estimado (BDI {bdiMultiplier}×)</span>
                  <strong style={{ fontSize: '16px', color: '#085ce5' }}>{money.format(estimatedSaleTotal)}</strong>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void handleApply()}
                  disabled={!editable || applying || selectedKitDetail.items.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    height: '36px',
                    padding: '0 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <Send size={15} />
                  {applying ? 'Inserindo…' : 'Inserir Kit nesta proposta'}
                </button>
              </div>
            </div>

            <h3 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 600 }}>
              Itens incluídos no Kit ({selectedKitDetail.items.length})
            </h3>

            <div style={{ border: '1px solid #e4e6ea', borderRadius: '6px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead style={{ background: '#f8f9fb' }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left', width: '90px' }}>Código</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Descrição</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '50px' }}>Un.</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Qtd.</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Custo un.</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Custo total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedKitDetail.items.map((item) => (
                    <tr key={item.id} style={{ borderTop: '1px solid #e4e6ea' }}>
                      <td style={{ padding: '6px 10px' }}><b>{item.code}</b></td>
                      <td style={{ padding: '6px 10px' }}>{item.description}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>{item.unit}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{item.quantity}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>{money.format(item.currentCost)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                        {money.format(item.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: '12px', fontSize: '10px', color: '#697386' }}>
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
