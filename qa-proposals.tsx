import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutList, Plus, Building2, ChevronDown, ChevronUp, ChevronRight,
  MoreHorizontal, Filter, Trash2, Copy, Upload, Eye, FilePlus2, Share2,
  Save, X, Search, LockKeyhole, Menu, GripVertical,
} from 'lucide-react';
import '@fontsource-variable/ibm-plex-sans';
import './src/index.css';
import './src/mobile-responsive.css';
import './src/suite-bolder.css';

const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const laborTotal = 4200;
const bdi = 1.28;
const taxPct = 6;

const withTotals = (list) => list.map((it) => ({ ...it, totalCost: it.quantity * it.unitCost, totalSale: it.quantity * it.unitSale }));

const items = withTotals([
  { id: '1', code: 'MAT-001', description: 'Cimento CP-II 50kg', unit: 'sc', quantity: 120, unitCost: 32.5, unitSale: 42.0 },
  { id: '2', code: 'MAT-014', description: 'Bloco cerâmico estrutural 14×19×29', unit: 'un', quantity: 2400, unitCost: 2.85, unitSale: 3.9 },
  { id: '3', code: 'SRV-007', description: 'Instalação elétrica — ponto simples', unit: 'pt', quantity: 48, unitCost: 65, unitSale: 98 },
]);

const catalogMock = [
  { code: 'MAT-022', description: 'Areia média lavada', unit: 'm³', unitCost: 78, unitSale: 105 },
  { code: 'MAT-031', description: 'Tinta acrílica branca 18L', unit: 'un', unitCost: 210, unitSale: 289 },
  { code: 'SRV-014', description: 'Mão de obra especializada — hora', unit: 'h', unitCost: 45, unitSale: 68 },
];

function computeTotals(list) {
  const totalCost = list.reduce((s, i) => s + i.totalCost, 0);
  const totalSale = list.reduce((s, i) => s + i.totalSale, 0);
  const baseCost = totalCost + laborTotal;
  const subtotalWithBdi = baseCost * bdi;
  const bdiAdditions = subtotalWithBdi - baseCost;
  const taxAmount = subtotalWithBdi * (taxPct / 100);
  const finalValue = subtotalWithBdi + taxAmount;
  return { totalCost, totalSale, baseCost, bdiAdditions, taxAmount, finalValue };
}

const totalCost = computeTotals(items).totalCost;
const totalSale = computeTotals(items).totalSale;
const baseCost = computeTotals(items).baseCost;
const finalValue = computeTotals(items).finalValue;

const style = `
  html, body, #root { height: auto; overflow: visible; }
  body { background: #dfe3e8; padding: 32px; }
  .qa-title { font: 700 20px/1.2 "IBM Plex Sans Variable", sans-serif; color: var(--ink); margin: 0 0 4px; }
  .qa-sub { font: 400 13px/1.5 "IBM Plex Sans Variable", sans-serif; color: var(--muted); margin: 0 0 28px; max-width: 900px; }
  .qa-row { display: flex; gap: 28px; align-items: flex-start; flex-wrap: wrap; }
  .qa-col { width: 400px; flex: none; font-family: "IBM Plex Sans Variable", sans-serif; }
  .qa-col-label { font: 700 13px/1.3 "IBM Plex Sans Variable", sans-serif; color: var(--ink); margin: 0 0 2px; }
  .qa-col-desc { font: 400 11.5px/1.4 "IBM Plex Sans Variable", sans-serif; color: var(--muted); margin: 0 0 10px; min-height: 32px; }
  .qa-phone {
    background: var(--surface-subtle); border: 1px solid var(--line-strong); border-radius: 22px;
    box-shadow: 0 14px 34px rgba(18,32,54,.16); overflow: hidden;
  }
  .qa-phone-bar { background: var(--nav); color: #fff; display: flex; align-items: center; gap: 8px; padding: 10px 14px; font-size: 12px; font-weight: 700; }
  .qa-phone-bar svg { color: #01b7f1; }
  .qa-scroll { max-height: 640px; overflow-y: auto; background: var(--surface); }

  /* shared bits */
  .qa-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 20px; font-size: 10.5px; font-weight: 700; }
  .qa-pill.draft { background: var(--status-draft-bg); color: var(--status-draft-text); }
  .qa-hr { height: 1px; background: var(--line); border: 0; margin: 0; }

  /* ============ VARIANT 1: cards + barra de total fixa ============ */
  .v1-header { padding: 12px 14px 10px; border-bottom: 1px solid var(--line); }
  .v1-switch { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .v1-switch-id { font-size: 14px; font-weight: 700; color: var(--ink); }
  .v1-switch button { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--blue); background: var(--blue-soft); border: 0; border-radius: 6px; padding: 5px 8px; }
  .v1-context { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--surface-subtle); border: 1px solid var(--line); border-radius: 8px; }
  .v1-context b { display: block; font-size: 12.5px; color: var(--ink); }
  .v1-context small { color: var(--muted); font-size: 11px; }
  .v1-context .qa-pill { margin-left: auto; }
  .v1-sections { display: flex; gap: 6px; overflow-x: auto; padding: 8px 14px; -webkit-overflow-scrolling: touch; }
  .v1-sections button { flex: none; font-size: 11.5px; font-weight: 600; color: var(--muted); background: var(--surface-subtle); border: 1px solid var(--line); border-radius: 20px; padding: 6px 12px; }
  .v1-sections button.active { color: #fff; background: var(--blue); border-color: var(--blue); }
  .v1-toolbar { display: flex; align-items: center; gap: 8px; padding: 4px 14px 10px; }
  .v1-insert { display: flex; align-items: center; gap: 6px; background: var(--blue); color: #fff; border: 0; border-radius: 8px; padding: 9px 14px; font-size: 12.5px; font-weight: 700; }
  .v1-iconbtn { display: grid; place-items: center; width: 36px; height: 36px; background: var(--surface-subtle); border: 1px solid var(--line); border-radius: 8px; color: var(--ink); }
  .v1-items { padding: 4px 14px 8px; display: flex; flex-direction: column; gap: 8px; }
  .v1-card { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
  .v1-card-top { display: flex; justify-content: space-between; gap: 8px; }
  .v1-card-desc { font-size: 12.5px; font-weight: 600; color: var(--ink); line-height: 1.3; }
  .v1-card-code { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .v1-card-chevron { color: var(--muted); flex: none; }
  .v1-card-meta { display: flex; align-items: baseline; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); font-size: 11px; color: var(--muted); }
  .v1-card-meta b { color: var(--ink); font-size: 12.5px; font-weight: 700; }
  .v1-sticky-total { position: sticky; bottom: 0; background: #fff; border-top: 1px solid var(--line); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 -6px 16px rgba(18,32,54,.08); }
  .v1-sticky-total > div span { display: block; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .v1-sticky-total > div strong { font-size: 16px; color: var(--blue); }
  .v1-sticky-total button { display: flex; align-items: center; gap: 6px; background: var(--surface-subtle); border: 1px solid var(--line-strong); border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 700; color: var(--ink); }

  /* ============ VARIANT 2: edicao focada em tela cheia ============ */
  .v2-header { padding: 12px 14px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 10px; }
  .v2-header b { font-size: 14px; color: var(--ink); }
  .v2-header small { display: block; font-size: 11px; color: var(--muted); }
  .v2-header .qa-pill { margin-left: auto; }
  .v2-tabbar { display: flex; align-items: center; gap: 0; padding: 0 14px; border-bottom: 1px solid var(--line); }
  .v2-tabbar button { padding: 10px 0; margin-right: 18px; font-size: 12.5px; font-weight: 600; color: var(--muted); border: 0; border-bottom: 2px solid transparent; background: transparent; }
  .v2-tabbar button.active { color: var(--blue); border-color: var(--blue); }
  .v2-tabbar .v2-more { margin-left: auto; margin-right: 0; color: var(--muted); }
  .v2-list { padding: 6px 14px; }
  .v2-row { display: flex; align-items: center; gap: 10px; padding: 12px 2px; border-bottom: 1px solid var(--line); }
  .v2-row-main { flex: 1; min-width: 0; }
  .v2-row-main b { display: block; font-size: 12.5px; color: var(--ink); font-weight: 600; }
  .v2-row-main span { font-size: 11px; color: var(--muted); }
  .v2-row-total { text-align: right; font-size: 12.5px; font-weight: 700; color: var(--ink); }
  .v2-row-total small { display: block; font-weight: 400; font-size: 10px; color: var(--muted); }
  .v2-add { display: flex; align-items: center; justify-content: center; gap: 6px; width: calc(100% - 28px); margin: 12px 14px 4px; padding: 12px; border: 1.5px dashed var(--line-strong); border-radius: 10px; color: var(--blue); font-size: 12.5px; font-weight: 700; background: var(--blue-soft); }
  .v2-editsheet { position: fixed; inset: 0; background: rgba(10,20,35,.45); display: flex; align-items: flex-end; z-index: 5; }
  .v2-editsheet-inner { background: #fff; width: 100%; border-radius: 16px 16px 0 0; padding: 14px; max-height: 80%; overflow-y: auto; }
  .v2-editsheet-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .v2-editsheet-head b { font-size: 14px; }
  .v2-field { margin-bottom: 12px; }
  .v2-field label { display: block; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 5px; }
  .v2-field input { width: 100%; height: 42px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: 8px; font-size: 14px; color: var(--ink); }
  .v2-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .v2-editsheet-actions { display: flex; gap: 8px; margin-top: 6px; }
  .v2-editsheet-actions button { flex: 1; height: 44px; border-radius: 8px; font-size: 13px; font-weight: 700; }
  .v2-editsheet-actions .save { background: var(--blue); color: #fff; border: 0; }
  .v2-editsheet-actions .del { background: #fdeeee; color: var(--status-rejected-text); border: 0; }
  .v2-footer { position: sticky; bottom: 0; background: var(--nav); color: #fff; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; }
  .v2-footer div span { display: block; font-size: 10px; color: var(--nav-muted); text-transform: uppercase; }
  .v2-footer div strong { font-size: 16px; }
  .v2-footer button { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,.12); border: 0; border-radius: 8px; padding: 9px 12px; color: #fff; font-size: 12px; font-weight: 700; }

  /* ============ VARIANT 3: modo operar -- FAB + swipe + chip ============ */
  .v3-appbar { background: var(--nav); color: #fff; padding: 12px 14px; }
  .v3-appbar-top { display: flex; align-items: center; gap: 8px; }
  .v3-appbar-top b { font-size: 14px; }
  .v3-appbar-top .qa-pill { margin-left: auto; background: rgba(255,255,255,.14); color: #fff; }
  .v3-appbar-sub { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 11.5px; color: var(--nav-muted); }
  .v3-segment { display: flex; gap: 4px; padding: 8px 14px; background: var(--surface-subtle); border-bottom: 1px solid var(--line); }
  .v3-segment button { flex: 1; text-align: center; padding: 7px 4px; font-size: 11px; font-weight: 700; color: var(--muted); background: #fff; border: 1px solid var(--line); border-radius: 7px; }
  .v3-segment button.active { color: #fff; background: var(--blue); border-color: var(--blue); }
  .v3-searchbar { display: flex; align-items: center; gap: 8px; margin: 8px 14px; padding: 8px 10px; background: var(--surface-subtle); border: 1px solid var(--line); border-radius: 8px; color: var(--muted); font-size: 12px; }
  .v3-list { padding: 0 14px 90px; position: relative; }
  .v3-swipe-wrap { position: relative; margin-bottom: 8px; border-radius: 10px; overflow: hidden; }
  .v3-swipe-actions { position: absolute; inset: 0; display: flex; justify-content: flex-end; align-items: stretch; }
  .v3-swipe-actions button { width: 56px; display: grid; place-items: center; color: #fff; border: 0; }
  .v3-swipe-actions .dup { background: var(--blue); }
  .v3-swipe-actions .del { background: #d33; }
  .v3-card { position: relative; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; transform: translateX(0); transition: transform 160ms ease; touch-action: pan-y; user-select: none; cursor: grab; }
  .v3-card.dragging { transition: none; cursor: grabbing; }
  .v3-card.peek { transform: translateX(-96px); }
  .v3-card.removing { opacity: 0; transform: translateX(-100%); transition: all 180ms ease; }
  .v3-drag { color: var(--line-strong); flex: none; }
  .v3-swipe-hint { font-size: 9.5px; color: var(--muted); text-align: center; padding: 4px 0 8px; }
  .v3-added-flash { animation: v3-flash 900ms ease; }
  @keyframes v3-flash { from { background: var(--blue-soft); } to { background: #fff; } }

  .v3-sheet-backdrop { position: absolute; inset: 0; background: rgba(10,20,35,.45); display: flex; align-items: flex-end; z-index: 6; }
  .v3-sheet { background: #fff; width: 100%; border-radius: 16px 16px 0 0; padding: 14px; max-height: 86%; overflow-y: auto; }
  .v3-sheet-handle { width: 34px; height: 4px; background: var(--line-strong); border-radius: 2px; margin: 0 auto 10px; }
  .v3-sheet-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .v3-sheet-head b { font-size: 14px; color: var(--ink); }
  .v3-sheet-head button { color: var(--muted); background: transparent; border: 0; }
  .v3-catalog-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; padding: 11px 4px; border: 0; border-top: 1px solid var(--line); background: transparent; text-align: left; }
  .v3-catalog-item:first-child { border-top: 0; }
  .v3-catalog-item b { display: block; font-size: 12.5px; color: var(--ink); font-weight: 600; }
  .v3-catalog-item span { font-size: 10.5px; color: var(--muted); }
  .v3-catalog-item strong { font-size: 12.5px; color: var(--blue); flex: none; }
  .v3-amount { display: flex; align-items: baseline; justify-content: space-between; padding: 7px 2px; font-size: 12px; color: var(--muted); border-bottom: 1px dashed var(--line); }
  .v3-amount b { font-size: 13px; color: var(--ink); font-weight: 700; }
  .v3-amount.final { border-bottom: 0; margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--line); }
  .v3-amount.final b { color: var(--blue); font-size: 16px; }
  .v3-sheet-actions { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
  .v3-sheet-actions button { display: flex; align-items: center; gap: 8px; width: 100%; height: 42px; padding: 0 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--line-strong); background: var(--surface-subtle); color: var(--ink); }
  .v3-sheet-actions button.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
  .v3-sheet-actions button.danger { background: #fdeeee; border-color: #f9bebe; color: var(--status-rejected-text); }
  .v3-card-main { flex: 1; min-width: 0; }
  .v3-card-main b { display: block; font-size: 12.5px; font-weight: 600; color: var(--ink); }
  .v3-card-main span { font-size: 10.5px; color: var(--muted); }
  .v3-card-value { text-align: right; font-size: 12.5px; font-weight: 700; color: var(--ink); flex: none; }
  .v3-fab { position: fixed; }
  .v3-fab-wrap { position: sticky; bottom: 74px; display: flex; justify-content: flex-end; padding: 0 14px; pointer-events: none; }
  .v3-fab-btn { pointer-events: all; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: var(--blue); color: #fff; box-shadow: 0 8px 20px rgba(8,92,229,.4); border: 0; }
  .v3-chip-wrap { position: sticky; bottom: 0; padding: 10px 14px; background: linear-gradient(to top, var(--surface) 60%, transparent); }
  .v3-chip { display: flex; align-items: center; justify-content: space-between; background: var(--ink); color: #fff; border-radius: 30px; padding: 10px 8px 10px 16px; box-shadow: 0 10px 26px rgba(0,0,0,.25); }
  .v3-chip span { font-size: 10px; color: #b8c3d3; display: block; text-transform: uppercase; }
  .v3-chip strong { font-size: 14px; }
  .v3-chip button { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.14); color: #fff; border: 0; }
`;

function Phone({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="qa-col">
      <p className="qa-col-label">{label}</p>
      <p className="qa-col-desc">{desc}</p>
      <div className="qa-phone">
        <div className="qa-phone-bar"><Building2 size={13} /> Construtec Orçamentos · mobile</div>
        <div className="qa-scroll">{children}</div>
      </div>
    </div>
  );
}

function Variant1() {
  const [active, setActive] = useState('Itens');
  return (
    <div>
      <div className="v1-header">
        <div className="v1-switch">
          <span className="v1-switch-id">PA-1003 · REV.00</span>
          <button type="button"><LayoutList size={13} /> Trocar (3)</button>
        </div>
        <div className="v1-context">
          <Building2 size={16} color="var(--blue)" />
          <div>
            <b>Construtora Horizonte</b>
            <small>Edifício Aurora — Torre B</small>
          </div>
          <span className="qa-pill draft">Em edição</span>
        </div>
      </div>
      <div className="v1-sections">
        {['Itens', 'Mão de obra', 'Kits', 'Condições', 'Histórico'].map((s) => (
          <button key={s} type="button" className={active === s ? 'active' : ''} onClick={() => setActive(s)}>{s}</button>
        ))}
      </div>
      <div className="v1-toolbar">
        <button type="button" className="v1-insert"><Plus size={15} /> Inserir</button>
        <span className="v1-iconbtn"><Filter size={16} /></span>
        <span className="v1-iconbtn"><MoreHorizontal size={16} /></span>
      </div>
      <div className="v1-items">
        {items.map((it) => (
          <div key={it.id} className="v1-card">
            <div className="v1-card-top">
              <div>
                <div className="v1-card-desc">{it.description}</div>
                <div className="v1-card-code">{it.code} · {it.quantity} {it.unit} × R$ {money.format(it.unitCost)}</div>
              </div>
              <ChevronRight size={16} className="v1-card-chevron" />
            </div>
            <div className="v1-card-meta">
              <span>Custo total</span>
              <b>R$ {money.format(it.totalCost)}</b>
            </div>
          </div>
        ))}
      </div>
      <div className="v1-sticky-total">
        <div><span>Valor final</span><strong>R$ {money.format(finalValue)}</strong></div>
        <button type="button"><ChevronUp size={14} /> Resumo</button>
      </div>
    </div>
  );
}

function Variant2() {
  const [editing, setEditing] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <div className="v2-header">
        <div>
          <b>PA-1003 · REV.00</b>
          <small>Construtora Horizonte · Torre B</small>
        </div>
        <span className="qa-pill draft">Em edição</span>
      </div>
      <div className="v2-tabbar">
        <button type="button" className="active">Itens</button>
        <button type="button" className="v2-more"><Menu size={16} /></button>
      </div>
      <div className="v2-list">
        {items.map((it) => (
          <div key={it.id} className="v2-row" onClick={() => setEditing(true)}>
            <div className="v2-row-main">
              <b>{it.description}</b>
              <span>{it.quantity} {it.unit} · {it.code}</span>
            </div>
            <div className="v2-row-total">
              R$ {money.format(it.totalCost)}
              <small>venda R$ {money.format(it.totalSale)}</small>
            </div>
          </div>
        ))}
        <button type="button" className="v2-add" onClick={() => setEditing(true)}><Plus size={16} /> Adicionar item do catálogo</button>
      </div>
      <div className="v2-footer">
        <div><span>Valor final</span><strong>R$ {money.format(finalValue)}</strong></div>
        <button type="button"><ChevronUp size={14} /> Resumo &amp; ações</button>
      </div>

      {editing && (
        <div className="v2-editsheet" onClick={() => setEditing(false)}>
          <div className="v2-editsheet-inner" onClick={(e) => e.stopPropagation()}>
            <div className="v2-editsheet-head">
              <b>Editar item</b>
              <X size={18} onClick={() => setEditing(false)} />
            </div>
            <div className="v2-field"><label>Descrição</label><input defaultValue={items[0].description} /></div>
            <div className="v2-field-row">
              <div className="v2-field"><label>Quantidade</label><input defaultValue={String(items[0].quantity)} /></div>
              <div className="v2-field"><label>Unidade</label><input defaultValue={items[0].unit} /></div>
            </div>
            <div className="v2-field-row">
              <div className="v2-field"><label>Custo unit.</label><input defaultValue={money.format(items[0].unitCost)} /></div>
              <div className="v2-field"><label>Venda unit.</label><input defaultValue={money.format(items[0].unitSale)} /></div>
            </div>
            <div className="v2-editsheet-actions">
              <button type="button" className="del"><Trash2 size={15} /> Excluir</button>
              <button type="button" className="save"><Save size={15} /> Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SwipeCard({ item, peeked, onOpen, onClose, onDuplicate, onDelete, flash }) {
  const dragRef = useRef({ startX: 0, dragging: false, moved: false });
  const [dragX, setDragX] = useState(null);

  const onPointerDown = (e) => {
    dragRef.current = { startX: e.clientX, dragging: true, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.dragging) return;
    const delta = e.clientX - dragRef.current.startX;
    if (Math.abs(delta) > 4) dragRef.current.moved = true;
    const base = peeked ? -96 : 0;
    const next = Math.min(0, Math.max(-96, base + delta));
    setDragX(next);
  };
  const endDrag = () => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    if (dragX !== null) {
      if (dragX < -48) onOpen(); else onClose();
    } else if (!dragRef.current.moved) {
      peeked ? onClose() : onOpen();
    }
    setDragX(null);
  };

  const transform = dragX !== null ? `translateX(${dragX}px)` : undefined;

  return (
    <div className="v3-swipe-wrap">
      <div className="v3-swipe-actions">
        <button type="button" className="dup" onClick={onDuplicate}><Copy size={15} /></button>
        <button type="button" className="del" onClick={onDelete}><Trash2 size={15} /></button>
      </div>
      <div
        className={`v3-card ${peeked ? 'peek' : ''} ${dragX !== null ? 'dragging' : ''} ${flash ? 'v3-added-flash' : ''}`}
        style={transform ? { transform } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <GripVertical size={14} className="v3-drag" />
        <div className="v3-card-main">
          <b>{item.description}</b>
          <span>{item.quantity} {item.unit} · {item.code}</span>
        </div>
        <div className="v3-card-value">R$ {money.format(item.totalCost)}</div>
      </div>
    </div>
  );
}

let v3IdSeq = 100;

function Variant3() {
  const [list, setList] = useState(items);
  const [peekId, setPeekId] = useState(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [flashId, setFlashId] = useState(null);

  const totals = computeTotals(list);

  const duplicate = (id) => {
    const src = list.find((i) => i.id === id);
    if (!src) return;
    const copy = { ...src, id: String(v3IdSeq++) };
    const idx = list.findIndex((i) => i.id === id);
    const next = [...list.slice(0, idx + 1), copy, ...list.slice(idx + 1)];
    setList(next);
    setPeekId(null);
    setFlashId(copy.id);
    setTimeout(() => setFlashId(null), 900);
  };

  const remove = (id) => {
    setList((curr) => curr.filter((i) => i.id !== id));
    setPeekId(null);
  };

  const addFromCatalog = (entry) => {
    const newItem = withTotals([{ id: String(v3IdSeq++), code: entry.code, description: entry.description, unit: entry.unit, quantity: 1, unitCost: entry.unitCost, unitSale: entry.unitSale }])[0];
    setList((curr) => [...curr, newItem]);
    setInsertOpen(false);
    setFlashId(newItem.id);
    setTimeout(() => setFlashId(null), 900);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div className="v3-appbar">
        <div className="v3-appbar-top">
          <b>PA-1003 · REV.00</b>
          <span className="qa-pill">Em edição</span>
        </div>
        <div className="v3-appbar-sub"><Building2 size={13} /> Construtora Horizonte · Torre B</div>
      </div>
      <div className="v3-segment">
        {['Itens', 'M.obra', 'Kits', 'Condições', 'Histórico'].map((s, i) => (
          <button key={s} type="button" className={i === 0 ? 'active' : ''}>{s}</button>
        ))}
      </div>
      <div className="v3-searchbar"><Search size={14} /> Buscar item ou código…</div>
      <div className="v3-list">
        <p className="v3-swipe-hint">arraste um item pra esquerda para duplicar/excluir</p>
        {list.map((it) => (
          <SwipeCard
            key={it.id}
            item={it}
            peeked={peekId === it.id}
            flash={flashId === it.id}
            onOpen={() => setPeekId(it.id)}
            onClose={() => setPeekId((curr) => (curr === it.id ? null : curr))}
            onDuplicate={() => duplicate(it.id)}
            onDelete={() => remove(it.id)}
          />
        ))}
        {list.length === 0 && <p className="v3-swipe-hint">Nenhum item — toque no + para inserir.</p>}
      </div>
      <div className="v3-fab-wrap"><button type="button" className="v3-fab-btn" onClick={() => setInsertOpen(true)}><Plus size={22} /></button></div>
      <div className="v3-chip-wrap">
        <div className="v3-chip" onClick={() => setSummaryOpen(true)} style={{ cursor: 'pointer' }}>
          <div><span>Valor final</span><strong>R$ {money.format(totals.finalValue)}</strong></div>
          <button type="button" onClick={(e) => { e.stopPropagation(); setSummaryOpen(true); }}><ChevronUp size={16} /></button>
        </div>
      </div>

      {insertOpen && (
        <div className="v3-sheet-backdrop" onClick={() => setInsertOpen(false)}>
          <div className="v3-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="v3-sheet-handle" />
            <div className="v3-sheet-head"><b>Inserir do catálogo</b><button type="button" onClick={() => setInsertOpen(false)}><X size={18} /></button></div>
            {catalogMock.map((entry) => (
              <button key={entry.code} type="button" className="v3-catalog-item" onClick={() => addFromCatalog(entry)}>
                <span>
                  <b>{entry.description}</b>
                  <span>{entry.code} · un. {entry.unit}</span>
                </span>
                <strong>R$ {money.format(entry.unitCost)}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      {summaryOpen && (
        <div className="v3-sheet-backdrop" onClick={() => setSummaryOpen(false)}>
          <div className="v3-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="v3-sheet-handle" />
            <div className="v3-sheet-head"><b>Resumo & ações</b><button type="button" onClick={() => setSummaryOpen(false)}><X size={18} /></button></div>
            <div className="v3-amount"><span>Total de materiais</span><b>R$ {money.format(totals.totalCost)}</b></div>
            <div className="v3-amount"><span>Total de mão de obra</span><b>R$ {money.format(laborTotal)}</b></div>
            <div className="v3-amount"><span>Custo base</span><b>R$ {money.format(totals.baseCost)}</b></div>
            <div className="v3-amount"><span>BDI / acréscimos</span><b>R$ {money.format(totals.bdiAdditions)}</b></div>
            <div className="v3-amount"><span>Impostos ({taxPct}%)</span><b>R$ {money.format(totals.taxAmount)}</b></div>
            <div className="v3-amount final"><span>Valor final da proposta</span><b>R$ {money.format(totals.finalValue)}</b></div>
            <div className="v3-sheet-actions">
              <button type="button"><Save size={15} /> Criar revisão</button>
              <button type="button"><Copy size={15} /> Clonar proposta</button>
              <button type="button"><Eye size={15} /> Pré-visualizar</button>
              <button type="button" className="primary"><FilePlus2 size={15} /> Gerar PDF + Word</button>
              <button type="button"><Share2 size={15} /> Compartilhar</button>
              <button type="button" className="danger"><Trash2 size={15} /> Excluir orçamento</button>
            </div>
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
    <h1 className="qa-title">Tela de Propostas — 3 propostas de reinvenção mobile</h1>
    <p className="qa-sub">
      Impeccable · adapt · mobile-only (desktop intocado). Problemas atacados: tabela de itens com scroll horizontal forçado (min-width 900px),
      linha Cliente/Obra/Status cortada, abas de propostas truncadas, barra de ferramentas e resumo comercial competindo por espaço.
      As 3 direções abaixo resolvem os 3 pontos com paradigmas de interação diferentes — a identidade visual (cores, tipografia, raios) é a mesma do app.
    </p>
    <div className="qa-row">
      <Phone label="Variante 1 — Cartões + barra de total fixa" desc="Evolução direta: itens viram cartões (mesmo padrão já usado na lista de propostas), sem scroll horizontal. Resumo comercial vira barra fixa embaixo, expande sob demanda.">
        <Variant1 />
      </Phone>
      <Phone label="Variante 2 — Edição focada em painel" desc="Lista enxuta (só leitura); tocar um item abre um painel de edição em tela cheia com campos grandes. Reduz erro de toque, prioriza precisão de digitação.">
        <Variant2 />
      </Phone>
      <Phone label="Variante 3 — Modo operar (gestos nativos)" desc="Padrão de app nativo: busca inline, cartões com swipe para duplicar/excluir, botão flutuante (+) para inserir, chip de total arrastável. Mais rápido para quem já conhece o fluxo.">
        <Variant3 />
      </Phone>
    </div>
  </>,
);
