import { useEffect, useState } from 'react';
import { ChevronRight, FileText, Layers, PackagePlus, Plus, RefreshCw } from 'lucide-react';
import type { KitDetail, KitSummary, ProposalSummary } from '../shared/contracts';
import { kitsApi, proposalApi } from './api';
import { Drawer, EmptyState, PageHead, brl, plural, revText } from './orcDeskUi';
import { useCanEdit, useSuitePermission } from './SuitePermissions';

type Props = {
  onEdit: () => void;
  onOpenProposal?: (proposalId: string) => void;
  onNewProposalWithKit?: (kitId: string) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

// Kits (24k) e Usar kit (24l): lista de kits, itens do escolhido e "Usar em proposta" (adiciona tudo de uma vez).
export function KitsOverview({ onEdit, onOpenProposal, onNewProposalWithKit, onNotice, onError }: Props) {
  const seesCost = useSuitePermission('p10');
  const canEdit = useCanEdit();
  const [kits, setKits] = useState<KitSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<KitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setFailed('');
    void kitsApi.list().then((result) => {
      if (!active) return;
      const list = result.kits.filter((kit) => kit.active);
      setKits(list);
      setSelected((current) => (list.some((kit) => kit.id === current) ? current : list[0]?.id ?? null));
    }).catch((error) => { if (active) setFailed(error instanceof Error ? error.message : 'Não foi possível carregar os kits.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    let active = true;
    void kitsApi.get(selected).then((result) => { if (active) setDetail(result.kit); })
      .catch((error) => { if (active) onError(error instanceof Error ? error.message : 'Não foi possível abrir o kit.'); });
    return () => { active = false; };
  }, [selected]);

  const head = <PageHead eyebrow="Comercial" title="Kits" sub="Conjuntos de itens que entram de uma vez na proposta">
    <button type="button" className="od-btn s" onClick={onEdit}><PackagePlus size={17} />Cadastrar kits</button>
    {canEdit && <button type="button" className="od-btn p" disabled={!detail || detail.items.length === 0} onClick={() => setDrawer(true)}><Layers size={17} />Usar em proposta</button>}
  </PageHead>;

  if (failed) return <main className="od-page"><div className="od-stack">{head}<div className="od-card"><EmptyState icon={RefreshCw} tone="bad" title="Não deu para carregar os kits"
    actions={<button type="button" className="od-btn p" onClick={() => setAttempt((n) => n + 1)}>Tentar de novo</button>}>{failed}</EmptyState></div></div></main>;

  return <main className="od-page" aria-busy={loading}><div className="od-stack">
    {head}
    {!loading && kits.length === 0 ? <div className="od-card"><EmptyState icon={Layers} title="Nenhum kit cadastrado"
      actions={<button type="button" className="od-btn p" onClick={onEdit}><Plus size={17} />Cadastrar o primeiro kit</button>}>Kits agrupam materiais e serviços que costumam entrar juntos na proposta.</EmptyState></div> : <div className="od-kit-grid">
      <div className="od-list" role="radiogroup" aria-label="Kits">
        {loading && [0, 1, 2].map((i) => <div key={i} className="od-skel" style={{ height: 66 }} />)}
        {kits.map((kit) => <button key={kit.id} type="button" role="radio" aria-checked={kit.id === selected} className="od-card od-radio" onClick={() => setSelected(kit.id)}>
          <Layers size={20} style={{ color: 'var(--od-accent-300)' }} />
          <span className="od-grow"><b>{kit.name}</b><span>{plural(kit.itemCount, 'item', 'itens')} · {kit.category}</span></span>
          {seesCost && <b className="od-num" style={{ fontSize: 13 }}>{brl(kit.totalEstimatedCost)}</b>}
        </button>)}
      </div>
      <div className="od-card" style={{ overflow: 'hidden' }}>
        {detail ? <>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
            <span className="od-item"><b style={{ fontSize: 15 }}>{detail.name}</b>
              <span style={{ fontSize: 12.5 }}>{plural(detail.items.length, 'item', 'itens')} · {detail.category} · {seesCost ? `custo ${brl(detail.totalEstimatedCost)}` : 'preços de custo só com permissão'}{detail.description ? ` · ${detail.description}` : ''}</span></span>
          </div>
          <div className="od-scroll"><table className="od-tbl">
            <thead><tr><th>Item</th><th>Quantidade</th><th className="od-num">Custo unit.</th><th className="od-num">Total</th></tr></thead>
            <tbody>{detail.items.map((item) => <tr key={item.id}>
              <td><span className="od-item"><b>{item.description}</b><span>{item.code}</span></span></td>
              <td>{item.quantity.toLocaleString('pt-BR')} {item.unit}</td>
              <td className="od-num">{seesCost ? brl(item.currentCost) : '—'}</td>
              <td className="od-num" style={{ fontWeight: 600 }}>{seesCost ? brl(item.totalCost) : '—'}</td>
            </tr>)}</tbody>
          </table></div>
          {detail.items.length === 0 && <div className="od-empty">Este kit ainda não tem itens. Adicione em Cadastrar kits.</div>}
        </> : <div className="od-skel" style={{ height: 220, margin: 16 }} />}
      </div>
    </div>}
    {drawer && detail && <UseKitDrawer kit={detail} onClose={() => setDrawer(false)} onOpenProposal={onOpenProposal} onNewProposalWithKit={onNewProposalWithKit} onNotice={onNotice} onError={onError} />}
  </div></main>;
}

function UseKitDrawer({ kit, onClose, onOpenProposal, onNewProposalWithKit, onNotice, onError }: {
  kit: KitDetail; onClose: () => void; onOpenProposal?: (id: string) => void; onNewProposalWithKit?: (kitId: string) => void;
  onNotice: (message: string) => void; onError: (message: string) => void;
}) {
  const [proposals, setProposals] = useState<ProposalSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void proposalApi.list().then((result) => { if (active) setProposals(result.proposals.filter((p) => p.status === 'draft' && p.isLatest !== false)); })
      .catch((error) => { if (active) { setProposals([]); onError(error instanceof Error ? error.message : 'Não foi possível listar as propostas.'); } });
    return () => { active = false; };
  }, []);

  const apply = async (proposal: ProposalSummary) => {
    if (busy) return;
    setBusy(proposal.id);
    try {
      await kitsApi.applyToProposal(kit.id, proposal.id);
      onNotice(`${kit.name} · ${plural(kit.items.length, 'item adicionado', 'itens adicionados')} na ${proposal.number}`);
      onClose();
      onOpenProposal?.(proposal.id);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível adicionar o kit.');
      setBusy(null);
    }
  };

  return <Drawer title="Usar kit em proposta" icon={Layers} onClose={onClose} sub={`${kit.name} · ${plural(kit.items.length, 'item', 'itens')}`}
    footer={<button type="button" className="od-btn s" onClick={onClose}>Fechar</button>}>
    <span className="od-small">Escolha a proposta em edição que recebe os itens do kit, ou comece uma nova com ele.</span>
    {proposals === null && [0, 1].map((i) => <div key={i} className="od-skel" style={{ height: 58 }} />)}
    {proposals?.map((proposal) => <button key={proposal.id} type="button" className="od-pick" disabled={!!busy} onClick={() => void apply(proposal)}>
      <FileText size={18} style={{ color: 'var(--od-accent-300)' }} />
      <span className="od-item" style={{ flex: 1 }}><b>{proposal.workName || proposal.clientName}</b><span>{proposal.number} · {revText(proposal.revision)} · {proposal.clientName}</span></span>
      {busy === proposal.id ? <RefreshCw size={16} className="od-spin" /> : <ChevronRight size={16} style={{ color: 'var(--muted)' }} />}
    </button>)}
    {proposals?.length === 0 && <div className="od-note"><Layers size={17} /><span>Nenhuma proposta em edição agora. Comece uma nova com este kit.</span></div>}
    {onNewProposalWithKit && <button type="button" className="od-pick" disabled={!!busy} onClick={() => { onClose(); onNewProposalWithKit(kit.id); }}>
      <Plus size={18} style={{ color: 'var(--od-accent-300)' }} /><b style={{ flex: 1 }}>Nova proposta com este kit</b><ChevronRight size={16} style={{ color: 'var(--muted)' }} />
    </button>}
  </Drawer>;
}
