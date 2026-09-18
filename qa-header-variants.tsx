import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell, Mail, Menu, ChevronDown, ChevronUp, X, LayoutList, Plus,
  Building2, MapPin, CalendarDays, User, Info, ArrowLeftRight,
} from 'lucide-react';
import '@fontsource-variable/ibm-plex-sans';
import './src/index.css';
import './src/mobile-responsive.css';
import './src/suite-bolder.css';

const proposals = [
  { id: 'a', number: 'PA-1003', rev: '00', active: true },
  { id: 'b', number: 'PA-1002', rev: '00', active: false },
  { id: 'c', number: 'PA-1001', rev: '02', active: false },
];

const meta = {
  cliente: 'Cliente teste',
  obra: 'Cliente teste',
  status: 'Em edição',
  validade: '15/06/2025',
  responsavel: 'QA Local',
};

const style = `
  html, body, #root { height: auto; overflow: visible; }
  body { background: #dfe3e8; padding: 32px; }
  .qa-title { font: 700 20px/1.2 "IBM Plex Sans Variable", sans-serif; color: var(--ink); margin: 0 0 4px; }
  .qa-sub { font: 400 13px/1.5 "IBM Plex Sans Variable", sans-serif; color: var(--muted); margin: 0 0 28px; max-width: 900px; }
  .qa-row { display: flex; gap: 28px; align-items: flex-start; flex-wrap: wrap; }
  .qa-col { width: 380px; flex: none; font-family: "IBM Plex Sans Variable", sans-serif; }
  .qa-col-label { font: 700 13px/1.3 "IBM Plex Sans Variable", sans-serif; color: var(--ink); margin: 0 0 2px; }
  .qa-col-desc { font: 400 11.5px/1.4 "IBM Plex Sans Variable", sans-serif; color: var(--muted); margin: 0 0 10px; min-height: 46px; }
  .qa-phone {
    background: var(--surface); border: 1px solid var(--line-strong); border-radius: 22px;
    box-shadow: 0 14px 34px rgba(18,32,54,.16); overflow: hidden;
  }
  .qa-scroll { max-height: 560px; overflow-y: auto; background: var(--surface); position: relative; }

  /* topbar comum */
  .hv-topbar { background: var(--nav); display: flex; align-items: center; gap: 8px; padding: 10px 12px; }
  .hv-logo { width: 30px; height: 30px; border-radius: 7px; background: var(--blue); display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 13px; flex: none; }
  .hv-suite { display: flex; align-items: center; gap: 4px; height: 30px; padding: 0 10px; background: #1c2c45; color: #fff; border-radius: 7px; font-size: 11px; font-weight: 700; margin-left: 4px; }
  .hv-topbar-icons { display: flex; align-items: center; gap: 6px; margin-left: auto; color: #cfd8e6; }
  .hv-topbar-icons svg { width: 17px; height: 17px; }

  .hv-pill { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; color: var(--status-draft-text); background: var(--status-draft-bg); flex: none; }

  /* ============ VARIANT A: folha unica (abas + detalhes) ============ */
  .va-bar { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--line); background: #fff; }
  .va-bar b { font-size: 14px; color: var(--ink); }
  .va-bar-chevron { margin-left: auto; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: var(--surface-subtle); color: var(--muted); flex: none; }
  .va-body { padding: 16px; color: var(--muted); font-size: 12px; }
  .va-sheet-backdrop { position: absolute; inset: 0; background: rgba(10,20,35,.45); display: flex; align-items: flex-end; z-index: 5; }
  .va-sheet { background: #fff; width: 100%; border-radius: 16px 16px 0 0; padding: 14px; max-height: 82%; overflow-y: auto; }
  .va-sheet-handle { width: 34px; height: 4px; background: var(--line-strong); border-radius: 2px; margin: 0 auto 12px; }
  .va-sheet h3 { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: 0 0 8px; }
  .va-tab-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 8px; border-radius: 8px; border: 0; background: transparent; text-align: left; margin-bottom: 2px; }
  .va-tab-row.active { background: var(--blue-soft); }
  .va-tab-row b { font-size: 13px; color: var(--ink); }
  .va-tab-row .hv-pill { margin-left: auto; }
  .va-new-tab { color: var(--blue); }
  .va-hr { height: 1px; background: var(--line); border: 0; margin: 14px 0; }
  .va-field { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-bottom: 1px dashed var(--line); }
  .va-field svg { color: var(--muted); flex: none; }
  .va-field span { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; display: block; }
  .va-field b { font-size: 13px; color: var(--ink); font-weight: 600; }

  /* ============ VARIANT B: chips leves + expandir ============ */
  .vb-tabs-row { display: flex; gap: 6px; padding: 10px 14px; overflow-x: auto; background: #fff; border-bottom: 1px solid var(--line); position: relative; }
  .vb-chip { flex: none; padding: 7px 13px; border-radius: 20px; font-size: 11.5px; font-weight: 700; border: 1px solid var(--line-strong); background: #fff; color: var(--muted); }
  .vb-chip.active { background: var(--blue); border-color: var(--blue); color: #fff; }
  .vb-chip.add { color: var(--blue); border-style: dashed; }
  .vb-summary { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: #fff; border-bottom: 1px solid var(--line); }
  .vb-summary b { font-size: 13px; color: var(--ink); }
  .vb-summary button { margin-left: auto; display: flex; align-items: center; gap: 4px; color: var(--blue); background: transparent; border: 0; font-size: 11.5px; font-weight: 700; }
  .vb-details { padding: 4px 14px 14px; background: #fff; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
  .vb-details-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
  .vb-details-row b { color: var(--ink); font-weight: 600; }
  .vb-details-row svg { color: var(--muted); flex: none; }
  .vb-body { padding: 16px; color: var(--muted); font-size: 12px; }

  /* ============ VARIANT C: barra minima + icones ============ */
  .vc-bar { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #fff; border-bottom: 1px solid var(--line); }
  .vc-bar b { font-size: 14px; color: var(--ink); }
  .vc-bar-icons { display: flex; align-items: center; gap: 6px; margin-left: auto; }
  .vc-bar-icons button { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface-subtle); color: var(--ink); flex: none; }
  .vc-body { padding: 16px; color: var(--muted); font-size: 12px; }
`;

function Phone({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="qa-col">
      <p className="qa-col-label">{label}</p>
      <p className="qa-col-desc">{desc}</p>
      <div className="qa-phone">
        <div className="hv-topbar">
          <div className="hv-logo">C</div>
          <div className="hv-suite">Suíte <ChevronDown size={12} /></div>
          <div className="hv-topbar-icons">
            <Bell />
            <Mail />
            <Menu />
          </div>
        </div>
        <div className="qa-scroll">{children}</div>
      </div>
    </div>
  );
}

function VariantA() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="va-bar" onClick={() => setOpen(true)} style={{ width: '100%', border: 0, cursor: 'pointer' }}>
        <b>PA-1003 · REV.00</b>
        <span className="hv-pill">Em edição</span>
        <span className="va-bar-chevron"><ChevronDown size={16} /></span>
      </button>
      <div className="va-body">Conteúdo da proposta (Itens, Mão de obra…) começa aqui, sem nenhuma faixa de scroll horizontal acima.</div>
      {open && (
        <div className="va-sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="va-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="va-sheet-handle" />
            <h3>Abas abertas</h3>
            {proposals.map((p) => (
              <button key={p.id} type="button" className={`va-tab-row ${p.active ? 'active' : ''}`}>
                <LayoutList size={16} color="var(--muted)" />
                <b>{p.number} · REV.{p.rev}</b>
                {p.active && <span className="hv-pill">Aberta</span>}
              </button>
            ))}
            <button type="button" className="va-tab-row va-new-tab"><Plus size={16} /><b>Nova proposta</b></button>
            <hr className="va-hr" />
            <h3>Detalhes da proposta</h3>
            <div className="va-field"><Building2 size={16} /><div><span>Cliente</span><b>{meta.cliente}</b></div></div>
            <div className="va-field"><MapPin size={16} /><div><span>Obra</span><b>{meta.obra}</b></div></div>
            <div className="va-field"><CalendarDays size={16} /><div><span>Validade</span><b>{meta.validade}</b></div></div>
            <div className="va-field"><User size={16} /><div><span>Responsável</span><b>{meta.responsavel}</b></div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function VariantB() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div className="vb-tabs-row">
        {proposals.map((p) => (
          <span key={p.id} className={`vb-chip ${p.active ? 'active' : ''}`}>{p.number}·{p.rev}</span>
        ))}
        <span className="vb-chip add">+ Nova</span>
      </div>
      <div className="vb-summary">
        <b>{meta.cliente}</b>
        <span className="hv-pill">{meta.status}</span>
        <button type="button" onClick={() => setExpanded((v) => !v)}>
          Detalhes {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      {expanded && (
        <div className="vb-details">
          <div className="vb-details-row"><MapPin size={14} /> Obra <b>{meta.obra}</b></div>
          <div className="vb-details-row"><CalendarDays size={14} /> Validade <b>{meta.validade}</b></div>
          <div className="vb-details-row"><User size={14} /> Responsável <b>{meta.responsavel}</b></div>
        </div>
      )}
      <div className="vb-body">Itens da proposta aparecem aqui. Abas ficam sempre visíveis (rolam), detalhes ficam a um toque.</div>
    </div>
  );
}

function VariantC() {
  const [sheet, setSheet] = useState<'switch' | 'info' | null>(null);
  return (
    <div style={{ position: 'relative' }}>
      <div className="vc-bar">
        <b>PA-1003 · REV.00</b>
        <span className="hv-pill">Em edição</span>
        <div className="vc-bar-icons">
          <button type="button" onClick={() => setSheet('switch')} title="Trocar de proposta"><ArrowLeftRight size={16} /></button>
          <button type="button" onClick={() => setSheet('info')} title="Detalhes da proposta"><Info size={16} /></button>
        </div>
      </div>
      <div className="vc-body">Barra minima: so numero, revisao e status. Trocar de proposta e ver Cliente/Obra/Validade/Responsavel ficam atras de 2 icones.</div>
      {sheet && (
        <div className="va-sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="va-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="va-sheet-handle" />
            {sheet === 'switch' ? (
              <>
                <h3>Trocar de proposta</h3>
                {proposals.map((p) => (
                  <button key={p.id} type="button" className={`va-tab-row ${p.active ? 'active' : ''}`}>
                    <LayoutList size={16} color="var(--muted)" />
                    <b>{p.number} · REV.{p.rev}</b>
                    {p.active && <span className="hv-pill">Aberta</span>}
                  </button>
                ))}
                <button type="button" className="va-tab-row va-new-tab"><Plus size={16} /><b>Nova proposta</b></button>
              </>
            ) : (
              <>
                <h3>Detalhes da proposta</h3>
                <div className="va-field"><Building2 size={16} /><div><span>Cliente</span><b>{meta.cliente}</b></div></div>
                <div className="va-field"><MapPin size={16} /><div><span>Obra</span><b>{meta.obra}</b></div></div>
                <div className="va-field"><CalendarDays size={16} /><div><span>Validade</span><b>{meta.validade}</b></div></div>
                <div className="va-field"><User size={16} /><div><span>Responsável</span><b>{meta.responsavel}</b></div></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('root not found');

createRoot(rootElement).render(
  <>
    <style>{style}</style>
    <h1 className="qa-title">Cabeçalho mobile — 3 propostas de reinvenção</h1>
    <p className="qa-sub">
      Impeccable · adapt · mobile-only (desktop intocado). Problema atacado: a faixa de abas abertas e a faixa de Cliente/Obra/Status/Validade/Responsável
      forçam scroll horizontal duplo logo no topo da tela. As 3 direções abaixo resolvem isso com níveis diferentes de consolidação.
    </p>
    <div className="qa-row">
      <Phone label="Variante A — Folha única (abas + detalhes)" desc="Uma linha só (número + status) sempre visível; toque abre uma folha com as abas abertas em cima e todos os detalhes (Cliente/Obra/Validade/Responsável) empilhados embaixo.">
        <VariantA />
      </Phone>
      <Phone label="Variante B — Chips leves + expandir" desc="Abas continuam sempre visíveis como chips arredondados e leves (rolagem óbvia); Cliente + status numa linha, um toque expande Obra/Validade/Responsável abaixo, sem modal.">
        <VariantB />
      </Phone>
      <Phone label="Variante C — Barra mínima + 2 ícones" desc="Só número, revisão e status ficam na barra. Trocar de proposta e ver detalhes completos vivem atrás de 2 ícones dedicados — máxima consolidação, mesmo padrão do FAB de Itens.">
        <VariantC />
      </Phone>
    </div>
  </>,
);
