import { useRef, useState, type DragEvent } from 'react';
import { ArrowDownRight, ArrowUpRight, Camera, Check, CheckCircle2, CircleDot, Download, FileDown, FileSpreadsheet, FileText, Info, KeyRound, Lightbulb, Loader2, Lock, Pencil, ShieldCheck, Table2, Upload, AlertCircle } from 'lucide-react';
import { FIELDS, colLetter, kb, pctText, templateCsv, type ErrRow, type FieldKey } from './catalogImportFlow';
import { EmptyState, PageHead, Seg, brl, downloadText, hasDesktopApp, nfmt, plural } from './orcDeskUi';
import { useCatalogImport, type CatalogImport } from './useCatalogImport';

type Props = {
  canWrite: boolean;
  catalogCount: number;
  supplierHints: string[];
  usedIn?: (code: string) => string[];
  onImported: () => void;
  onBack: () => void;
  onNotice: (message: string) => void;
};

const STEPS = ['Arquivo', 'Colunas', 'Revisar', 'Importar'];
const PAGE = 20;
const usedText = (list: string[]) => (list.length ? list.slice(0, 3).join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '') : '—');

const stepOf = (phase: CatalogImport['phase']) => ({ file: 1, read: 1, vazio: 1, erro: 1, map: 2, conferir: 3, review: 3, run: 4, done: 4, fail: 4 }[phase]);

function Stepper({ phase }: { phase: CatalogImport['phase'] }) {
  const current = stepOf(phase), finished = phase === 'done';
  return <div className="od-card od-steps" role="list" aria-label="Passos da importação">
    {STEPS.map((label, index) => {
      const n = index + 1, done = n < current || (finished && n === 4), cur = n === current && !done;
      return <div key={label} role="listitem" className={`od-step${done ? ' done' : ''}${cur ? ' cur' : ''}`} aria-current={cur ? 'step' : undefined}>
        <span className="od-step-n">{done ? <Check size={15} /> : n}</span><span>{label}</span>
        {n < STEPS.length && <span className="od-step-line" />}
      </div>;
    })}
  </div>;
}

function LoadCard({ imp }: { imp: CatalogImport }) {
  const { load, file } = imp;
  return <>
    <div className="od-card od-load">
      {file && <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="od-row-ic">{file.kind === 'image' ? <Camera size={18} /> : <FileSpreadsheet size={18} />}</span>
        <span className="od-item"><b>{file.name}</b><span>{file.size ? kb(file.size) : 'Reconhecimento de imagem'}</span></span>
      </div>}
      <b role="status">{load.title}</b>
      <span className="od-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={load.pct} style={{ height: 10 }}><span style={{ width: `${load.pct}%` }} /></span>
      <span className="od-small">{load.sub}</span>
      <div className="od-checks">{load.steps.map(([text, threshold], i) => {
        const done = load.pct >= threshold, cur = !done && (i === 0 || load.pct >= load.steps[i - 1][1]);
        return <span key={text} className={done ? 'done' : (cur ? 'cur' : '')}>{done ? <CheckCircle2 size={15} /> : <CircleDot size={15} />}{text}</span>;
      })}</div>
    </div>
    <div><button type="button" className="od-btn s" onClick={imp.cancelLoad}>Cancelar</button></div>
  </>;
}

function FileStep({ imp, hints, onBack }: { imp: CatalogImport; hints: string[]; onBack: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const desktop = hasDesktopApp() && !!window.construtec?.selectCatalogImport;
  const pick = (files: FileList | null) => { const f = files?.[0]; if (f) void imp.openFile(f); };
  const drop = (event: DragEvent) => { event.preventDefault(); setOver(false); pick(event.dataTransfer.files); };
  return <div className="od-two">
    <div className="od-card" style={{ paddingBottom: 4 }}>
      <div className="od-sect-head"><b>Arquivo</b><span>Planilha .xlsx ou .csv, PDF ou foto da lista de preços</span></div>
      <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="od-fld"><span>De qual fornecedor? (opcional)</span>
          <input className="od-inp" value={imp.supplier} maxLength={100} placeholder="Ex.: Seg Distribuidora" onChange={(event) => imp.setSupplier(event.target.value.trimStart())} />
        </label>
        {hints.length > 0 && <Seg<string> label="Fornecedores já usados" value={imp.supplier} onChange={imp.setSupplier} options={hints.map((h) => [h, h] as const)} />}
        <span className="od-small">Fica gravado como origem dos itens. Em branco, itens novos entram como IMPORTAÇÃO e os que já existem mantêm a origem.</span>
      </div>
      <button type="button" className={`od-drop${over ? ' over' : ''}`} onClick={() => input.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
        <Upload size={26} /><b>Arraste o arquivo para cá</b><span>ou clique para escolher uma planilha (XLSX, CSV, TSV ou TXT, até {kb(12 * 1024 * 1024)})</span>
      </button>
      <input ref={input} type="file" hidden accept=".xlsx,.xlsm,.csv,.tsv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { pick(event.target.files); event.target.value = ''; }} />
      <div className="od-row">
        <span className="od-row-ic"><Camera size={18} /></span>
        <span className="od-grow"><b style={{ fontSize: 13.5 }}>PDF ou foto da lista impressa</b>
          <span>{desktop ? 'Lemos a tabela com o reconhecimento de imagem do aplicativo; confira as colunas no passo seguinte.' : 'O reconhecimento de imagem roda só no aplicativo do computador. Aqui, use planilha XLSX ou CSV.'}</span></span>
        <button type="button" className="od-btn s" disabled={!desktop} onClick={() => void imp.openImage()}>Escolher PDF ou foto</button>
      </div>
    </div>
    <div className="od-card">
      <div className="od-sect-head"><b>O que dá para importar</b></div>
      {[[FileSpreadsheet, 'Planilha .xlsx ou .csv', 'Uma linha por item, com código, descrição, unidade e custo'],
        [FileText, 'PDF da lista de preços', 'Lemos a tabela do PDF no aplicativo; confira as colunas no passo seguinte'],
        [Camera, 'Foto da lista impressa', 'No aplicativo do computador, ou pelo celular em Menu, Catálogo, Importar']].map(([Icon, title, sub]) => {
        const I = Icon as typeof Camera;
        return <div className="od-row" key={title as string}><span className="od-row-ic"><I size={18} /></span><span className="od-grow"><b style={{ fontSize: 13.5 }}>{title as string}</b><span>{sub as string}</span></span></div>;
      })}
      <div style={{ padding: '14px 20px 18px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="od-btn s" onClick={() => downloadText('modelo-catalogo.csv', templateCsv())}><FileDown size={17} />Baixar o modelo de planilha</button>
        <button type="button" className="od-btn g" onClick={onBack}>Voltar ao catálogo</button>
      </div>
    </div>
  </div>;
}

function MapStep({ imp }: { imp: CatalogImport }) {
  const { table, map, suggested, mapUser, file } = imp;
  const example = (index: number) => table.rows.find((row) => row.cells[index])?.cells[index] ?? '';
  const used = Object.values(map).filter((v): v is number => v !== undefined && v >= 0);
  const unused = table.header.map((h, i) => [h, i] as const).filter(([, i]) => !used.includes(i));
  const rows = table.rows.slice(0, 5);
  const fieldOfCol = (index: number) => FIELDS.find((f) => map[f.key] === index)?.label;
  return <>
    <div className="od-two">
      <div className="od-card">
        <div className="od-sect-head"><b>Ligar as colunas</b><span>Sugerimos uma coluna para cada campo. Confira as marcadas e troque se precisar.</span></div>
        {file && <div className="od-row"><span className="od-row-ic">{file.kind === 'image' ? <Camera size={18} /> : <FileSpreadsheet size={18} />}</span><span className="od-item"><b>{file.name}</b><span>{file.size ? `${kb(file.size)} · ` : ''}{nfmt(table.rows.length)} linhas</span></span></div>}
        {imp.mapError && <div className="od-note bad" role="alert" style={{ margin: '0 20px 12px' }}><AlertCircle size={17} /><span>{imp.mapError}</span></div>}
        <div>{FIELDS.map((field) => {
          const idx = map[field.key], has = idx !== undefined && idx >= 0;
          const mine = field.key in mapUser && has;
          const badge = !has ? (field.required ? 'Falta' : '') : (mine ? 'Você escolheu' : (suggested.conf[field.key] ? 'Confira' : 'Sugerido'));
          const tone = !has ? 'bad' : mine ? 'info' : (suggested.conf[field.key] ? 'warn' : 'ok');
          return <div className={`od-field-row${!has && field.required && imp.mapError ? ' bad' : ''}`} key={field.key}>
            <span><b style={{ fontSize: 13.5 }}>{field.label}</b><span>{field.required ? 'obrigatório' : 'opcional'}</span></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <select className="od-inp" aria-label={`Coluna para ${field.label}`} value={has ? String(idx) : ''}
                onChange={(event) => imp.setColumn(field.key as FieldKey, event.target.value === '' ? undefined : Number(event.target.value))}>
                <option value="">{field.required ? 'Escolha a coluna' : 'Sem coluna (entra como Materiais)'}</option>
                {table.header.map((h, i) => <option key={i} value={i}>Coluna {colLetter(i)} · {h}</option>)}
              </select>
              {has && <span className="od-small">ex.: {example(idx!) || '(vazio)'}</span>}
            </span>
            <span>{badge && <span className={`od-chip ${tone}`}>{badge}</span>}</span>
          </div>;
        })}</div>
        <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" role="switch" aria-checked={imp.hasHeader} className="od-switch" onClick={() => imp.setHasHeader(!imp.hasHeader)}>
            <span><b>A primeira linha é o cabeçalho</b><small>Desligue se a planilha já começa pelos itens.</small></span><span className="od-knob" />
          </button>
          {unused.length > 0 && <div className="od-note"><Info size={17} /><span>{unused.map(([h, i]) => `Coluna ${colLetter(i)} · ${h}`).join(', ')} {unused.length > 1 ? 'não entram' : 'não entra'} no catálogo.</span></div>}
        </div>
      </div>
      <div className="od-card" style={{ overflow: 'hidden' }}>
        <div className="od-sect-head"><b>Primeiras linhas do arquivo</b><span>Como o arquivo vai ser lido com essa ligação</span></div>
        <div className="od-prev"><table>
          <thead><tr>{table.header.map((h, i) => <th key={i}>{h}<small>{fieldOfCol(i) ? `vira ${fieldOfCol(i)}` : 'não entra'}</small></th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.ln}>{table.header.map((_, i) => <td key={i} title={row.cells[i]}>{row.cells[i] || ' '}</td>)}</tr>)}</tbody>
        </table></div>
      </div>
    </div>
    <div className="od-card od-foot-bar">
      <button type="button" className="od-btn s" onClick={() => imp.goPhase('file')}>Voltar</button>
      <button type="button" className="od-btn p" onClick={() => void imp.nextFromMap()}>Revisar {nfmt(table.rows.length)} linhas</button>
    </div>
  </>;
}

type Tab = 'novos' | 'atu' | 'err';

function FixCell({ imp, row }: { imp: CatalogImport; row: ErrRow }) {
  const [value, setValue] = useState(row.sug ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const field = row.fx as FieldKey;
  const save = async () => {
    setBusy(true);
    const problem = await imp.saveFix(row.id, field, value);
    setBusy(false);
    setMessage(problem);
  };
  return <span className="od-fix">
    {field === 'un'
      ? <Seg<string> label="Unidade" value={value} onChange={setValue} options={imp.units.slice(0, 6).map((u) => [u, u] as const)} />
      : <input className="od-inp" value={value} onChange={(event) => setValue(event.target.value)} inputMode={field === 'custo' ? 'decimal' : undefined}
        placeholder={field === 'custo' ? 'Custo, ex.: 1.200,00' : (field === 'desc' ? 'Descrição do item' : 'Código')} aria-label={field === 'custo' ? 'Custo' : (field === 'desc' ? 'Descrição' : 'Código')} autoFocus />}
    {row.sug && value !== row.sug && <button type="button" className="od-btn sm g" onClick={() => setValue(row.sug!)}>Usar {row.sug}</button>}
    <button type="button" className="od-btn sm g" onClick={() => imp.undo(row.id)}>Cancelar</button>
    <button type="button" className="od-btn sm p" disabled={busy} onClick={() => void save()}><Check size={14} />Salvar</button>
    {message && <span role="alert" style={{ flexBasis: '100%', textAlign: 'right', fontSize: 12, color: 'var(--od-bad-fg)' }}>{message}</span>}
  </span>;
}

function ReviewStep({ imp, usedIn }: { imp: CatalogImport; usedIn?: (code: string) => string[] }) {
  const [tab, setTab] = useState<Tab>('novos');
  const [shown, setShown] = useState({ novos: PAGE, atu: PAGE, err: 50 });
  const [editing, setEditing] = useState<string | null>(null);
  const { groups, errView, importN, file } = imp;
  const outN = imp.leftRows.length;
  const tabs: Array<[Tab, string, number]> = [['novos', 'Novos', groups.novos.length], ['atu', 'Atualizados', groups.atu.length], ['err', 'Com erro', errView.length]];
  const more = (key: Tab, step: number) => setShown((s) => ({ ...s, [key]: s[key] + step }));
  const fixedN = errView.filter((e) => e.status === 'fixed').length;
  return <>
    <div className="od-tabs" role="tablist">{tabs.map(([key, label, n]) =>
      <button key={key} type="button" role="tab" aria-selected={tab === key} className={`od-card od-tab${key === 'err' && n ? ' bad' : ''}`} onClick={() => setTab(key)}><b>{nfmt(n)}</b><span>{label}</span></button>)}</div>
    <span className="od-small">{file?.name}{imp.supplier ? ` · ${imp.supplier}` : ''} · {nfmt(imp.table.rows.length)} linhas · {nfmt(groups.same.length)} {groups.same.length === 1 ? 'linha igual ao catálogo fica' : 'linhas iguais ao catálogo ficam'} como estão.</span>

    {tab === 'novos' && <div className="od-card" style={{ overflow: 'hidden' }}>
      {groups.novos.length === 0 ? <EmptyState icon={Table2} title="Nenhum item novo neste arquivo" /> : <div className="od-scroll"><table className="od-tbl">
        <thead><tr><th>Item novo</th><th>Categoria</th><th>Unid.</th><th className="od-num">Custo</th></tr></thead>
        <tbody>{groups.novos.slice(0, shown.novos).map(({ g }) => <tr key={g.id}><td><span className="od-item"><b>{g.desc}</b><span>{g.code}</span></span></td><td>{g.category || 'Materiais'}</td><td>{g.unit}</td><td className="od-num" style={{ fontWeight: 600 }}>{brl(g.cost)}</td></tr>)}</tbody>
      </table></div>}
      {groups.novos.length > shown.novos && <div className="od-footer"><span>Mostrando {nfmt(shown.novos)} de {nfmt(groups.novos.length)} itens novos</span><button type="button" className="od-btn sm s" onClick={() => more('novos', PAGE)}>Ver mais {Math.min(PAGE, groups.novos.length - shown.novos)}</button></div>}
    </div>}

    {tab === 'atu' && <div className="od-card" style={{ overflow: 'hidden' }}>
      {groups.atu.length === 0 ? <EmptyState icon={Table2} title="Nenhum item existente muda de preço" /> : <div className="od-scroll"><table className="od-tbl">
        <thead><tr><th>Item</th><th className="od-num">Antes</th><th className="od-num">Depois</th><th>Variação</th><th>Usado em</th></tr></thead>
        <tbody>{groups.atu.slice(0, shown.atu).map(({ g, p }) => {
          const before = p?.previous?.currentCost ?? null;
          const same = before !== null && Math.abs(g.cost - before) < 0.005;
          const ratio = before ? g.cost / before - 1 : 0;
          return <tr key={g.id}><td><span className="od-item"><b>{g.desc}</b><span>{g.code}</span></span></td>
            <td className="od-num">{before !== null ? brl(before) : '—'}</td><td className="od-num" style={{ fontWeight: 600 }}>{brl(g.cost)}</td>
            <td>{same ? <span className="od-small">Mesmo preço · outros dados mudaram</span> : <span className={`od-chip ${ratio > 0 ? 'warn' : 'ok'}`}>{ratio > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{pctText(ratio)}</span>}</td>
            <td className="od-small" style={{ fontSize: 12.5 }}>{usedText(usedIn?.(g.code) ?? [])}</td></tr>;
        })}</tbody>
      </table></div>}
      {groups.atu.length > shown.atu && <div className="od-footer"><span>Mostrando {nfmt(shown.atu)} de {nfmt(groups.atu.length)} preços atualizados</span><button type="button" className="od-btn sm s" onClick={() => more('atu', PAGE)}>Ver mais {Math.min(PAGE, groups.atu.length - shown.atu)}</button></div>}
    </div>}

    {tab === 'err' && <>
      <div className="od-note"><Lightbulb size={17} /><span>Linhas com erro não entram no catálogo. Corrija aqui, ou deixe de fora e ajuste depois na planilha.{fixedN ? ` ${plural(fixedN, 'linha corrigida entra', 'linhas corrigidas entram')} na importação.` : ''}</span></div>
      <div className="od-card" style={{ overflow: 'hidden' }}>
        {errView.length === 0 ? <EmptyState icon={CheckCircle2} tone="ok" title="Nenhuma linha com erro" /> : <div className="od-scroll"><table className="od-tbl">
          <thead><tr><th>Linha</th><th>Item</th><th>Problema</th><th /></tr></thead>
          <tbody>{errView.slice(0, shown.err).map(({ row, status }) => <tr key={row.id}>
            <td><span className="od-chip">{row.ln}</span></td>
            <td><span className="od-item"><b>{row.desc || 'Sem descrição'}</b><span>{row.code || 'Sem código'}</span></span></td>
            <td>{status === 'fixed' ? 'Corrigida' : row.prob}</td>
            <td style={{ textAlign: 'right' }}>
              {status === 'pending' && editing !== row.id && <span style={{ display: 'inline-flex', gap: 8 }}>
                {row.fx && <button type="button" className="od-btn sm s" onClick={() => setEditing(row.id)}><Pencil size={14} />Corrigir</button>}
                <button type="button" className="od-btn sm s" onClick={() => imp.leaveOut(row.id)}>Deixar de fora</button>
              </span>}
              {status === 'pending' && editing === row.id && <FixCell imp={imp} row={row} key={`${row.id}-${row.prob}`} />}
              {status !== 'pending' && <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <span className={`od-chip ${status === 'fixed' ? 'ok' : ''}`}>{status === 'fixed' ? <Check size={13} /> : <Lock size={13} />}{status === 'fixed' ? 'Corrigida · entra' : 'Fica de fora'}</span>
                <button type="button" className="od-btn sm g" onClick={() => { imp.undo(row.id); setEditing(null); }}>Desfazer</button>
              </span>}
            </td>
          </tr>)}</tbody>
        </table></div>}
        {errView.length > shown.err && <div className="od-footer"><span>Mostrando {nfmt(shown.err)} de {nfmt(errView.length)} linhas</span><button type="button" className="od-btn sm s" onClick={() => more('err', 50)}>Ver mais</button></div>}
      </div>
      {outN > 0 && <div><button type="button" className="od-btn s" onClick={() => imp.downloadLeft(imp.leftRows.map((e) => e.row))}><Download size={17} />Baixar linhas com erro (.csv)</button></div>}
    </>}

    <div className="od-card od-foot-bar">
      <span>{plural(importN, 'item entra', 'itens entram')}{outN ? ` · ${plural(outN, 'linha com erro fica', 'linhas com erro ficam')} de fora` : ''}</span>
      <button type="button" className="od-btn s" onClick={() => imp.goPhase('map')}>Voltar</button>
      <button type="button" className="od-btn p" disabled={importN === 0} onClick={() => void imp.run()}><Upload size={17} />Importar {plural(importN, 'item', 'itens')}</button>
    </div>
  </>;
}

function RunCard({ imp }: { imp: CatalogImport }) {
  const pct = Math.round((imp.runDone / Math.max(1, imp.runTotal)) * 100);
  return <div className="od-card od-load" role="status">
    <b>Importando {nfmt(imp.runDone)} de {nfmt(imp.runTotal)} itens</b>
    <span className="od-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ height: 10 }}><span style={{ width: `${pct}%` }} /></span>
    <span className="od-small">Pode continuar usando o sistema. Leva menos de um minuto.</span>
  </div>;
}

function DoneStep({ imp, catalogCount, onBack }: { imp: CatalogImport; catalogCount: number; onBack: () => void }) {
  const r = imp.result!;
  const total = r.created + r.updated;
  const cards: Array<[string, number, string, typeof Check]> = [
    ['Itens novos', r.created, 'entraram no catálogo', Check], ['Atualizados', r.updated, 'preço ou dados mudaram', ArrowUpRight],
    ['Corrigidos', r.fixed, 'por você, na própria tabela', Pencil], ['Ficaram de fora', r.left.length, r.left.length ? 'linhas com erro' : 'nenhuma linha', AlertCircle],
  ];
  return <>
    <div className="od-card od-ok-hero">
      <span className="od-empty-ic ok"><CheckCircle2 size={28} /></span>
      <span className="od-item"><b style={{ fontSize: 18 }}>{plural(total, 'item importado', 'itens importados')}</b>
        <span style={{ fontSize: 13 }}>De {imp.file?.name}{imp.supplier ? ` · ${imp.supplier}` : ''}</span></span>
    </div>
    <div className="od-kpis">{cards.map(([label, value, sub, Icon]) => <div className="od-card od-kpi" key={label}>
      <div className="od-kpi-top"><span className="od-lbl">{label}</span><span className="od-kpi-ic od-chip info" style={{ padding: 0, width: 28, height: 28, justifyContent: 'center' }}><Icon size={15} /></span></div>
      <span className="od-kpi-v">{nfmt(value)}</span><span className="od-kpi-s">{sub}</span>
    </div>)}</div>
    <div className="od-note"><Info size={17} /><span>O catálogo agora tem {nfmt(catalogCount)} itens. {nfmt(r.same)} {r.same === 1 ? 'linha igual ao catálogo ficou' : 'linhas iguais ao catálogo ficaram'} como {r.same === 1 ? 'estava' : 'estavam'}. Propostas em edição com itens de preço novo mostram o aviso “Atualizar preços desta proposta?”.</span></div>
    <div className="od-actions" style={{ justifyContent: 'flex-start' }}>
      {r.left.length > 0 && <button type="button" className="od-btn s" onClick={() => imp.downloadLeft(r.left)}><Download size={17} />Baixar as linhas que ficaram de fora</button>}
      <button type="button" className="od-btn s" onClick={imp.reset}>Importar outro arquivo</button>
      <button type="button" className="od-btn p" onClick={onBack}>Ver no catálogo</button>
    </div>
  </>;
}

// Importar lista de precos (24b a 24f e 24r): quatro passos, ligacao das colunas ao lado das primeiras linhas e
// correcao das linhas com erro na propria tabela.
export function CatalogImportPage({ canWrite, catalogCount, supplierHints, usedIn, onImported, onBack, onNotice }: Props) {
  const imp = useCatalogImport(() => { onImported(); onNotice('Catálogo atualizado.'); });
  const { phase, file } = imp;
  if (!canWrite) return <main className="od-page"><div className="od-stack">
    <PageHead eyebrow="Catálogo" title="Importar lista de preços" sub="De um fornecedor para o catálogo, conferindo cada linha antes de entrar" />
    <div className="od-card"><EmptyState icon={ShieldCheck} title="Importar catálogo não está liberado para o seu papel"
      actions={<button type="button" className="od-btn s" onClick={onBack}>Voltar ao catálogo</button>}>O catálogo carrega o custo dos itens; só quem vê custo e edita pode importar.</EmptyState></div>
  </div></main>;

  return <main className="od-page" aria-busy={phase === 'read' || phase === 'conferir' || phase === 'run'}><div className="od-stack">
    <PageHead eyebrow="Catálogo" title="Importar lista de preços" sub="De um fornecedor para o catálogo, conferindo cada linha antes de entrar">
      {phase === 'file' && <button type="button" className="od-btn s" onClick={() => downloadText('modelo-catalogo.csv', templateCsv())}><FileDown size={17} />Baixar modelo</button>}
    </PageHead>
    <Stepper phase={phase} />
    {phase === 'file' && <FileStep imp={imp} hints={supplierHints} onBack={onBack} />}
    {(phase === 'read' || phase === 'conferir') && <LoadCard imp={imp} />}
    {phase === 'map' && <MapStep imp={imp} />}
    {phase === 'review' && <ReviewStep imp={imp} usedIn={usedIn} />}
    {phase === 'run' && <RunCard imp={imp} />}
    {phase === 'done' && imp.result && <DoneStep imp={imp} catalogCount={catalogCount} onBack={onBack} />}
    {phase === 'vazio' && <div className="od-card"><EmptyState icon={Table2} title="Nenhum item no arquivo" actions={<>
      <button type="button" className="od-btn p" onClick={imp.reset}><Upload size={17} />Escolher outro arquivo</button>
      <button type="button" className="od-btn s" onClick={() => downloadText('modelo-catalogo.csv', templateCsv())}><FileDown size={17} />Baixar o modelo de planilha</button></>}>
      {file?.name ?? 'O arquivo'} só tem o cabeçalho. Preencha uma linha por item com código, descrição, unidade e custo e importe de novo.
    </EmptyState></div>}
    {phase === 'erro' && <div className="od-card"><EmptyState icon={imp.fail.locked ? KeyRound : AlertCircle} tone="bad" title={imp.fail.title} actions={<>
      <button type="button" className="od-btn p" onClick={imp.reset}><Upload size={17} />Escolher outro arquivo</button>
      <button type="button" className="od-btn s" onClick={onBack}>Voltar ao catálogo</button></>}>{imp.fail.message}
    </EmptyState></div>}
    {phase === 'fail' && <div className="od-card"><EmptyState icon={AlertCircle} tone="bad" title="A importação parou" actions={<>
      <button type="button" className="od-btn p" onClick={() => void imp.run()}><Loader2 size={17} />Tentar de novo</button>
      <button type="button" className="od-btn s" onClick={() => imp.goPhase('review')}>Voltar à revisão</button></>}>
      {imp.runError}{imp.result && imp.result.created + imp.result.updated > 0 ? ` Já entraram ${nfmt(imp.result.created + imp.result.updated)} itens; importar de novo é seguro, quem já entrou só é atualizado.` : ' Nada foi gravado no catálogo.'}
    </EmptyState></div>}
  </div></main>;
}
