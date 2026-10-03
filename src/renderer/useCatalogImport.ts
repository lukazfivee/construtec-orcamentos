// Estado e acoes de "Importar lista de precos" no computador (Rodada 24, telas 24b a 24f e 24r).
// Passos: 1 arquivo, 2 colunas, 3 revisar, 4 importar. Linha com erro nao entra: corrige-se na tabela ou fica de fora.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogImportItem, CatalogImportPreviewItem } from '../shared/contracts';
import { catalogApi } from './api';
import { parseCatalogText } from './catalogImportHelpers';
import {
  CHUNK, MAX_ROWS, ReadError, analyse, brNumber, buildTable, checkCost, classify, colLetter, errorsCsv, readTableFile, suggestColumns, toItem,
  type ColumnMap, type ErrRow, type FieldKey, type Fixes, type RawRow, FIELDS, FIELD_LABEL,
} from './catalogImportFlow';
import { downloadText } from './orcDeskUi';

export type Phase = 'file' | 'read' | 'vazio' | 'erro' | 'map' | 'conferir' | 'review' | 'run' | 'done' | 'fail';
export type FileInfo = { name: string; size: number; kind: 'sheet' | 'image'; lines: number };
export type LoadView = { title: string; sub: string; steps: Array<[string, number]>; pct: number };
export type ImportResult = { created: number; updated: number; fixed: number; same: number; left: ErrRow[] };
export type ErrView = { row: ErrRow; status: 'pending' | 'left' | 'fixed' };

const READ_STEPS: Array<[string, number]> = [['Abrindo o arquivo', 20], ['Encontrando as colunas', 60], ['Separando as linhas', 95]];

export function useCatalogImport(onImported: () => void) {
  const [phase, setPhase] = useState<Phase>('file');
  const [supplier, setSupplier] = useState('');
  const [file, setFile] = useState<FileInfo | null>(null);
  const [raw, setRaw] = useState<RawRow[]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapUser, setMapUser] = useState<ColumnMap>({});
  const [mapError, setMapError] = useState('');
  const [fix, setFix] = useState<Fixes>({});
  const [out, setOut] = useState<Record<string, boolean>>({});
  const [units, setUnits] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Map<string, CatalogImportPreviewItem>>(new Map());
  const [load, setLoad] = useState<LoadView>({ title: '', sub: '', steps: READ_STEPS, pct: 0 });
  const [fail, setFail] = useState({ title: '', message: '', locked: false });
  const [runDone, setRunDone] = useState(0);
  const [runTotal, setRunTotal] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [runError, setRunError] = useState('');
  const token = useRef(0);

  const table = useMemo(() => buildTable(raw, hasHeader), [raw, hasHeader]);
  const suggested = useMemo(() => suggestColumns(table.header), [table.header]);
  const map: ColumnMap = useMemo(() => ({ ...suggested.map, ...mapUser }), [suggested, mapUser]);
  const analysis = useMemo(() => (phase === 'review' || phase === 'run' || phase === 'done' || phase === 'fail' ? analyse({ table, map, units, fix, out }) : { good: [], errs: [] }), [phase, table, map, units, fix, out]);
  const base = useMemo(() => (phase === 'review' || phase === 'run' || phase === 'done' || phase === 'fail' ? analyse({ table, map, units, fix: {}, out: {} }).errs : []), [phase, table, map, units]);
  const groups = useMemo(() => classify(analysis.good, previews), [analysis.good, previews]);
  const errView: ErrView[] = useMemo(() => {
    const goodIds = new Set(analysis.good.map((g) => g.id));
    const current = new Map(analysis.errs.map((e) => [e.id, e]));
    return base.map((row) => {
      if (out[row.id]) return { row: current.get(row.id) ?? row, status: 'left' as const };
      if (goodIds.has(row.id)) return { row, status: 'fixed' as const };
      return { row: current.get(row.id) ?? row, status: 'pending' as const };
    });
  }, [analysis, base, out]);
  const importN = groups.novos.length + groups.atu.length;
  const leftRows = errView.filter((e) => e.status !== 'fixed');

  useEffect(() => () => { token.current += 1; }, []);

  const begin = (title: string, subOf: (pct: number) => string, steps: Array<[string, number]>) => {
    token.current += 1;
    const mine = token.current;
    return {
      alive: () => token.current === mine,
      tick: (pct: number) => { if (token.current === mine) setLoad({ title, sub: subOf(pct), steps, pct }); },
    };
  };

  const fillFromRaw = (rows: RawRow[], info: FileInfo) => {
    setRaw(rows); setHasHeader(true); setMapUser({}); setFix({}); setOut({}); setPreviews(new Map()); setMapError('');
    setFile({ ...info, lines: Math.max(0, rows.length - 1) });
    setPhase('map');
  };

  const openFile = useCallback(async (picked: File) => {
    const job = begin('Lendo a planilha', (p) => `Encontrando código, descrição, unidade e custo em cada linha · ${p}%`, READ_STEPS);
    setFile({ name: picked.name, size: picked.size, kind: 'sheet', lines: 0 });
    setPhase('read'); job.tick(5);
    try {
      const rows = await readTableFile(picked, job.tick);
      if (!job.alive()) return;
      if (rows.length > MAX_ROWS + 1) throw new ReadError('big', `A planilha tem ${(rows.length - 1).toLocaleString('pt-BR')} linhas. O limite é ${MAX_ROWS.toLocaleString('pt-BR')}; divida o arquivo.`);
      job.tick(100);
      if (rows.length < 2) { setFile({ name: picked.name, size: picked.size, kind: 'sheet', lines: 0 }); setPhase('vazio'); return; }
      fillFromRaw(rows, { name: picked.name, size: picked.size, kind: 'sheet', lines: 0 });
    } catch (error) {
      if (!job.alive()) return;
      if (error instanceof ReadError && error.kind === 'locked') setFail({ title: 'Não deu para abrir o arquivo', message: `${picked.name} está protegido por senha. Abra no Excel, salve uma cópia sem senha e importe de novo.`, locked: true });
      else if (error instanceof ReadError) setFail({ title: 'Não deu para abrir o arquivo', message: error.message, locked: false });
      else setFail({ title: 'Não deu para abrir o arquivo', message: `${picked.name} não abriu. Confira se é uma planilha válida (XLSX ou CSV) e tente de novo.`, locked: false });
      setPhase('erro');
    }
  }, []);

  // Foto ou PDF: o reconhecimento de imagem roda no aplicativo do computador (Electron).
  const openImage = useCallback(async () => {
    if (!window.construtec?.selectCatalogImport) return;
    const job = begin('Lendo a tabela do PDF ou da foto', (p) => `Reconhecendo o texto · ${p}%`, READ_STEPS);
    setPhase('read'); setFile({ name: 'Foto ou PDF', size: 0, kind: 'image', lines: 0 }); job.tick(10);
    try {
      const picked = await window.construtec.selectCatalogImport('image');
      if (!job.alive()) return;
      if (picked.canceled) { setPhase('file'); setFile(null); return; }
      const name = picked.name ?? 'Foto ou PDF';
      job.tick(80);
      const parsed = parseCatalogText(picked.text ?? '', 'IMAGEM');
      if (parsed.length === 0) { setFile({ name, size: 0, kind: 'image', lines: 0 }); setPhase('vazio'); return; }
      const rows: RawRow[] = [{ ln: 1, cells: ['Código', 'Descrição', 'Unidade', 'Custo', 'Categoria'] }, ...parsed.map((row, i) => ({
        ln: i + 2, cells: [row.code, row.description, row.unit || 'un', row.currentCost > 0 ? brNumber(row.currentCost) : '', row.category === 'Importado' ? '' : row.category],
      }))];
      fillFromRaw(rows, { name, size: 0, kind: 'image', lines: 0 });
    } catch (error) {
      if (!job.alive()) return;
      setFail({ title: 'Não deu para ler a imagem', message: error instanceof Error ? error.message : 'O reconhecimento de imagem falhou.', locked: false });
      setPhase('erro');
    }
  }, []);

  const setColumn = (key: FieldKey, index: number | undefined) => {
    setMapUser((current) => ({ ...current, [key]: index === undefined ? -1 : index }));
    setMapError('');
  };

  const previewItems = async (items: CatalogImportItem[]) => {
    const rows: CatalogImportPreviewItem[] = [];
    for (let i = 0; i < items.length; i += CHUNK) rows.push(...(await catalogApi.previewImport(items.slice(i, i + CHUNK))).items);
    return rows;
  };
  // Previa em duas passadas: a primeira acha quem ja existe; a segunda repete com fabricante, modelo, categoria e origem
  // do que ja esta no catalogo (como a importacao grava), para o "igual ao catalogo" ser verdadeiro.
  const previewSmart = async (goods: ReturnType<typeof analyse>['good']) => {
    const first = await previewItems(goods.map((g) => toItem(g, null, supplier)));
    const byCode = new Map(goods.map((g) => [g.code.toLowerCase(), g]));
    const again = first.filter((r) => r.previous);
    const second = again.length ? await previewItems(again.map((r) => toItem(byCode.get(r.code.toLowerCase())!, r.previous!, supplier))) : [];
    const merged = new Map(first.map((r) => [r.code.toLowerCase(), r]));
    second.forEach((r) => merged.set(r.code.toLowerCase(), r));
    return [...merged.values()];
  };

  const nextFromMap = async () => {
    const missing = FIELDS.filter((f) => f.required && !((map[f.key] ?? -1) >= 0));
    if (missing.length) { setMapError(`Escolha a coluna de ${missing.map((m) => m.label).join(' e ')} para continuar.`); return; }
    const used = FIELDS.filter((f) => (map[f.key] ?? -1) >= 0).map((f) => [f.key, map[f.key]!] as const);
    const dup = used.find(([, v], i) => used.findIndex(([, w]) => w === v) !== i);
    if (dup) {
      const names = used.filter(([, v]) => v === dup[1]).map(([k]) => FIELD_LABEL[k]);
      setMapError(`A coluna ${colLetter(dup[1])} está ligada a ${names.join(' e ')}. Cada coluna vale para um campo só.`); return;
    }
    setMapError('');
    const n = table.rows.length;
    const job = begin('Conferindo com o catálogo', (p) => `Comparando ${n.toLocaleString('pt-BR')} linhas com o catálogo · ${p}%`,
      [['Procurando códigos iguais', 30], ['Comparando preços', 70], ['Checando erros', 95]]);
    setPhase('conferir'); job.tick(10);
    try {
      let list = units;
      if (!list.length) { list = (await catalogApi.units()).units.map((u) => u.unit); if (!job.alive()) return; setUnits(list); }
      job.tick(35);
      const { good } = analyse({ table, map, units: list, fix, out });
      const merged = new Map<string, CatalogImportPreviewItem>();
      let done = 0;
      for (let i = 0; i < good.length; i += CHUNK) {
        const res = await previewSmart(good.slice(i, i + CHUNK));
        if (!job.alive()) return;
        res.forEach((r) => merged.set(r.code.toLowerCase(), r));
        done += Math.min(CHUNK, good.length - i);
        job.tick(35 + Math.round((done / Math.max(1, good.length)) * 55));
      }
      job.tick(100);
      setPreviews(merged);
      setPhase('review');
    } catch (error) {
      if (!job.alive()) return;
      setFail({ title: 'Não deu para conferir com o catálogo', message: error instanceof Error ? error.message : 'O servidor não respondeu.', locked: false });
      setPhase('erro');
    }
  };

  // Corrige uma linha com erro: valida, confere so essa linha no servidor e ela passa a entrar na importacao.
  const saveFix = async (id: string, field: FieldKey, value: string): Promise<string> => {
    const v = value.trim();
    if (!v) return field === 'un' ? 'Escolha a unidade.' : 'Preencha o campo para salvar.';
    if (field === 'custo') { const c = checkCost(v); if ('prob' in c) return 'Digite um custo maior que zero, como 1.200,00.'; }
    const nextFix: Fixes = { ...fix, [id]: { ...(fix[id] ?? {}), [field]: v } };
    const probe = analyse({ table, map, units, fix: nextFix, out }).good.find((g) => g.id === id);
    if (!probe) {
      const still = analyse({ table, map, units, fix: nextFix, out }).errs.find((e) => e.id === id);
      return still ? `Ainda falta acertar: ${still.prob}.` : 'Não deu para aplicar a correção.';
    }
    try {
      const [res] = await previewSmart([probe]);
      setPreviews((current) => new Map(current).set(res.code.toLowerCase(), res));
    } catch (error) { return error instanceof Error ? error.message : 'O servidor não respondeu.'; }
    setFix(nextFix);
    setOut((current) => { const copy = { ...current }; delete copy[id]; return copy; });
    return '';
  };
  const leaveOut = (id: string) => setOut((current) => ({ ...current, [id]: true }));
  const undo = (id: string) => {
    setOut((current) => { const copy = { ...current }; delete copy[id]; return copy; });
    setFix((current) => { const copy = { ...current }; delete copy[id]; return copy; });
  };

  const run = async () => {
    const items = [...groups.novos, ...groups.atu].map(({ g, p }) => toItem(g, p?.previous ?? null, supplier));
    if (!items.length) return;
    token.current += 1;
    const mine = token.current;
    setRunDone(0); setRunTotal(items.length); setRunError(''); setPhase('run');
    const totals = { created: 0, updated: 0 };
    try {
      for (let i = 0; i < items.length; i += CHUNK) {
        const part = items.slice(i, i + CHUNK);
        const res = await catalogApi.importBulk(part);
        totals.created += res.created; totals.updated += res.updated;
        if (token.current === mine) setRunDone(Math.min(items.length, i + part.length));
      }
      setResult({ ...totals, fixed: analysis.good.filter((g) => g.fixed).length, same: groups.same.length, left: errView.filter((e) => e.status !== 'fixed').map((e) => e.row) });
      setPhase('done');
      onImported();
    } catch (error) {
      setResult({ created: totals.created, updated: totals.updated, fixed: 0, same: 0, left: [] });
      setRunError(error instanceof Error ? error.message : 'O servidor não respondeu.');
      setPhase('fail');
    }
  };

  const cancelLoad = () => {
    token.current += 1;
    setPhase(phase === 'conferir' ? 'map' : 'file');
    if (phase !== 'conferir') setFile(null);
  };
  const reset = () => {
    token.current += 1;
    setPhase('file'); setFile(null); setRaw([]); setMapUser({}); setFix({}); setOut({}); setPreviews(new Map()); setResult(null); setMapError(''); setRunError('');
  };
  const goPhase = (next: Phase) => { token.current += 1; setPhase(next); };
  const downloadLeft = (rows: ErrRow[]) => downloadText('linhas-com-erro.csv', errorsCsv(rows));

  return {
    phase, supplier, setSupplier, file, table, map, mapUser, suggested, mapError, hasHeader, setHasHeader: (value: boolean) => { setHasHeader(value); setMapUser({}); setMapError(''); },
    fix, out, units, load, fail, runDone, runTotal, result, runError, analysis, errView, groups, importN, leftRows,
    openFile, openImage, setColumn, nextFromMap, saveFix, leaveOut, undo, run, cancelLoad, reset, goPhase, downloadLeft,
  };
}

export type CatalogImport = ReturnType<typeof useCatalogImport>;
