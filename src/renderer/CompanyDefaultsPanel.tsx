import { useEffect, useState } from 'react';
import { Check, EyeOff, Info, Minus, Plus, ShieldCheck } from 'lucide-react';
import type { AppSettings } from '../shared/contracts';
import { settingsApi } from './api';
import { Seg } from './orcDeskUi';
import { useSuitePermission } from './SuitePermissions';

type Draft = Pick<AppSettings, 'defaultBdi' | 'defaultTaxPercentage' | 'defaultValidityDays' | 'pdfShowLogo' | 'pdfShowSignature'>;

type Props = {
  settings: AppSettings;
  loading: boolean;
  isAdmin: boolean;
  onSaved: (settings: AppSettings) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

const VALIDITY = [15, 30, 45, 60];
const round2 = (value: number) => Math.round(value * 100) / 100;
const fromSettings = (s: AppSettings): Draft => ({
  defaultBdi: s.defaultBdi, defaultTaxPercentage: s.defaultTaxPercentage, defaultValidityDays: s.defaultValidityDays,
  pdfShowLogo: s.pdfShowLogo, pdfShowSignature: s.pdfShowSignature,
});

function Stepper({ label, value, text, step, min, max, disabled, onChange }: {
  label: string; value: number; text: string; step: number; min: number; max: number; disabled: boolean; onChange: (next: number) => void;
}) {
  const move = (delta: number) => onChange(Math.min(max, Math.max(min, round2(value + delta))));
  return <div className="od-stepper">
    <button type="button" className="od-stp" aria-label={`Diminuir ${label}`} disabled={disabled || value <= min} onClick={() => move(-step)}><Minus size={18} /></button>
    <b aria-live="polite">{text}</b>
    <button type="button" className="od-stp" aria-label={`Aumentar ${label}`} disabled={disabled || value >= max} onClick={() => move(step)}><Plus size={18} /></button>
  </div>;
}

// Padroes da empresa (24n): BDI, impostos e validade das proximas propostas, e o que sai em todo PDF.
// Propostas que ja existem mantem os valores delas. Sem p10 o BDI nao aparece (o servidor tambem o esconde).
export function CompanyDefaultsPanel({ settings, loading, isAdmin, onSaved, onNotice, onError }: Props) {
  const seesBdi = useSuitePermission('p10');
  const [draft, setDraft] = useState<Draft>(() => fromSettings(settings));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(fromSettings(settings)); }, [settings]);
  const base = fromSettings(settings);
  const dirty = (Object.keys(draft) as Array<keyof Draft>).some((key) => (key === 'defaultBdi' && !seesBdi ? false : draft[key] !== base[key]));
  const off = loading || !isAdmin || saving;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const days = VALIDITY.includes(draft.defaultValidityDays) ? VALIDITY : [...VALIDITY, draft.defaultValidityDays].sort((a, b) => a - b);

  const save = async () => {
    if (!dirty || off) return;
    setSaving(true);
    try {
      const input: Partial<AppSettings> = {
        defaultTaxPercentage: draft.defaultTaxPercentage, defaultValidityDays: draft.defaultValidityDays,
        pdfShowLogo: draft.pdfShowLogo, pdfShowSignature: draft.pdfShowSignature,
        ...(seesBdi ? { defaultBdi: draft.defaultBdi } : {}),
      };
      const result = await settingsApi.update(input);
      onSaved(result.settings);
      onNotice('Padrões salvos. Valem para as próximas propostas.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível salvar os padrões.');
    } finally { setSaving(false); }
  };

  const toggle = (key: 'pdfShowLogo' | 'pdfShowSignature', title: string, sub: string) => <button type="button" role="switch" aria-checked={draft[key]} disabled={off} className="od-switch" onClick={() => set(key, !draft[key])}>
    <span><b>{title}</b><small>{sub}</small></span><span className="od-knob" />
  </button>;

  return <section className="od-scope" aria-label="Padrões da empresa" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="od-eyebrow">Administração</span>
      <h2 style={{ margin: 0, font: '600 20px/1.2 "IBM Plex Sans", "Segoe UI", system-ui, sans-serif' }}>Padrões da empresa</h2>
      <span className="od-sub">Valem para as próximas propostas; as que já existem mantêm os valores delas</span>
    </div>
    {!loading && !isAdmin && <div className="od-note"><ShieldCheck size={17} /><span>Padrões em modo de consulta. Apenas administradores podem alterar.</span></div>}
    <div className="od-grid-2">
      <div className="od-card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="od-grow"><b>Preço</b><span>BDI e impostos que toda proposta nova recebe</span></span>
        {seesBdi ? <>
          <span className="od-lbl" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>BDI · multiplicador sobre o custo</span>
          <Stepper label="BDI" value={draft.defaultBdi} text={`${draft.defaultBdi.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ×`} step={0.05} min={1} max={10} disabled={off} onChange={(v) => set('defaultBdi', v)} />
        </> : <div className="od-note"><EyeOff size={17} /><span>Seu perfil não vê BDI. O restante dos padrões funciona igual.</span></div>}
        <span className="od-lbl" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>Impostos · % sobre o valor com BDI</span>
        <Stepper label="impostos" value={draft.defaultTaxPercentage} text={`${draft.defaultTaxPercentage.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`} step={0.5} min={0} max={100} disabled={off} onChange={(v) => set('defaultTaxPercentage', v)} />
        <div className="od-fld"><span>Validade da proposta</span>
          <Seg<string> label="Validade" value={String(draft.defaultValidityDays)} disabled={off} onChange={(v) => set('defaultValidityDays', Number(v))} options={days.map((d) => [String(d), `${d} dias`] as const)} />
        </div>
      </div>
      <div className="od-card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="od-grow"><b>PDF da proposta</b><span>O que sai em todo PDF enviado ao cliente</span></span>
        {toggle('pdfShowLogo', 'Logo da Construtec na capa', 'Versão branca sobre o azul-marinho')}
        {toggle('pdfShowSignature', 'Assinatura de quem envia', 'Nome e cargo no fim das condições')}
        <div className="od-note"><Info size={17} /><span>Custo, BDI e margem nunca entram no PDF, qualquer que seja o padrão.</span></div>
      </div>
    </div>
    <div className="od-card od-saverow">
      <span>{dirty ? 'Alterações ainda não salvas · valem para as próximas propostas' : 'Propostas já criadas mantêm os valores delas'}</span>
      <button type="button" className="od-btn s" disabled={!dirty || off} onClick={() => setDraft(fromSettings(settings))}>Descartar</button>
      <button type="button" className="od-btn p" disabled={!dirty || off} onClick={() => void save()}><Check size={17} />{saving ? 'Salvando…' : 'Salvar padrões'}</button>
    </div>
  </section>;
}
