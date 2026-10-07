import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Copy, FileImage, FileSpreadsheet, Loader2, Plus, X } from 'lucide-react';
import type { CatalogImportItem, CatalogProduct, ExsatBatchPreview, ExsatPageFailure, ExsatSyncInfo } from '../shared/contracts';
import { catalogApi } from './api';
import { CatalogImportExsat } from './CatalogImportExsat';
import { CatalogImportTable } from './CatalogImportTable';
import { exsatErrorMessage, isImportableRow, type ImportMode } from './catalogImportDialogModel';
import { moneyValue, newRow, parseCatalogText, type Row } from './catalogImportHelpers';
import { hasDesktopApp } from './orcDeskUi';
import './catalogImportDialog.css';

export { parseCatalogText, parseExsatQuoteText } from './catalogImportHelpers';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (products: CatalogProduct[], message: string) => void;
  onError: (message: string) => void;
  /** Importacao assistida (planilha no navegador); usada no site, onde o seletor de arquivos do aplicativo nao existe. */
  onOpenWizard?: () => void;
  /** Tela Integracao EXSAT do catalogo. */
  onOpenExsat?: () => void;
};

const TABS: Array<[ImportMode, string]> = [['manual', 'Manual'], ['file', 'Planilha'], ['image', 'Imagem/PDF'], ['exsat', 'Exsat']];
const MANUAL_HEADER = 'Código\tDescrição\tCategoria\tFabricante\tModelo\tUnidade\tValor total\tFonte';

function WebOnly({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return <section className="cid-card">
    <div className="cid-status">
      <span className="cid-ico">{title.includes('imagem') ? <FileImage size={20} aria-hidden="true" /> : <FileSpreadsheet size={20} aria-hidden="true" />}</span>
      <span className="cid-grow"><b>{title}</b><span>{text}</span></span>
    </div>
    <div className="cid-actions">{children}</div>
  </section>;
}

export function CatalogImportDialog({ open, onClose, onImported, onError, onOpenWizard, onOpenExsat }: Props) {
  const [mode, setMode] = useState<ImportMode>('manual');
  const [manual, setManual] = useState(MANUAL_HEADER);
  const [exsatUrls, setExsatUrls] = useState('https://exsat.com.br/');
  const [rows, setRows] = useState<Row[]>([]);
  const [sourceName, setSourceName] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [exsatConnected, setExsatConnected] = useState(false);
  const [batchInfo, setBatchInfo] = useState('');
  const [exsatFailures, setExsatFailures] = useState<ExsatPageFailure[]>([]);
  const [syncInfo, setSyncInfo] = useState<ExsatSyncInfo>({ history: [] });
  const app = hasDesktopApp() ? window.construtec : undefined;
  const canPick = !!app?.selectCatalogImport;
  const canExsat = !!app?.previewExsatAuto;
  const importableRows = useMemo(() => rows.filter((row) => isImportableRow(mode, row)), [mode, rows]);
  const exsatSummary = useMemo(() => ({
    confirmed: rows.filter((row) => row.status === 'confirmed').length,
    divergent: rows.filter((row) => row.status === 'divergent').length,
    unavailable: rows.filter((row) => row.status === 'unavailable').length,
    error: rows.filter((row) => row.status === 'error').length,
  }), [rows]);

  useEffect(() => {
    if (!open || mode !== 'exsat' || !canExsat) return;
    void app?.exsatStatus().then((status) => setExsatConnected(status.connected)).catch(() => setExsatConnected(false));
    void app?.exsatSyncInfo?.().then(setSyncInfo).catch(() => undefined);
    const unsubscribe = app?.onExsatValidationProgress?.((data) => {
      setProgressText(`Validando na Exsat: ${data.current} de ${data.total} (${data.code})`);
    });
    return () => { unsubscribe?.(); };
  }, [open, mode, canExsat, app]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const switchMode = (next: ImportMode) => {
    setMode(next); setRows([]); setBatchInfo(''); setExsatFailures([]); setSourceName('');
  };

  const chooseFile = async (expected: 'file' | 'image') => {
    setLoading(true);
    try {
      const result = await app?.selectCatalogImport(expected === 'image' ? 'image' : 'table');
      if (!result || result.canceled) return;
      if (result.kind !== (expected === 'image' ? 'image' : 'table')) {
        throw new Error(expected === 'image' ? 'Selecione uma imagem ou PDF.' : 'Selecione uma planilha XLSX, CSV ou TSV.');
      }
      const source = expected === 'image' ? 'IMAGEM' : result.name?.replace(/\.[^.]+$/, '').toUpperCase() || 'PLANILHA';
      const parsedRows = parseCatalogText(result.text ?? '', source);
      if (expected === 'image' && parsedRows.length === 0) {
        const recognizedText = (result.text ?? '').trim();
        setRows([]);
        setSourceName(result.name ?? 'Imagem lida pelo OCR');
        setOcrText(recognizedText);
        setManual(recognizedText || 'O Windows OCR não retornou texto para esta imagem.');
        setMode('manual');
        onError(recognizedText
          ? 'O OCR leu texto, mas não encontrou itens. O texto reconhecido foi aberto na aba Manual para conferência.'
          : 'O Windows OCR não encontrou texto nesta imagem. Tente recortar só a tabela do orçamento e importar novamente.');
        return;
      }
      setOcrText('');
      setRows(parsedRows); setSourceName(result.name ?? 'Arquivo importado'); setBatchInfo('');
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.'); }
    finally { setLoading(false); }
  };

  const copyOcrText = async () => {
    if (!ocrText) return;
    try {
      await navigator.clipboard.writeText(ocrText);
      onError('Texto reconhecido pelo OCR copiado para a área de transferência.');
    } catch {
      onError('Não foi possível copiar automaticamente. Selecione o texto da aba Manual e copie com Ctrl+C.');
    }
  };

  const applyExsatPreview = async (result: ExsatBatchPreview, automatic: boolean) => {
    setProgressText('');
    setExsatConnected(result.connected);
    setExsatFailures(result.failures);
    setRows(result.items.map((item) => ({ ...newRow(item), status: item.validationStatus ?? 'confirmed' })));
    setSourceName(automatic ? `Exsat automática · ${result.sourceCount} páginas lidas` : `Exsat Distribuidora · ${result.sourceCount} fonte${result.sourceCount === 1 ? '' : 's'}`);
    const notes = [
      result.ignored > 0 ? `${result.ignored} duplicado${result.ignored === 1 ? '' : 's'} consolidado${result.ignored === 1 ? '' : 's'}` : '',
      result.failures.length > 0 ? `${result.failures.length} página${result.failures.length === 1 ? '' : 's'} não pôde ser lida` : '',
    ].filter(Boolean);
    setBatchInfo(notes.join(' · '));
    if (app?.exsatSyncInfo) setSyncInfo(await app.exsatSyncInfo());
  };

  const handleExsatError = (error: unknown, fallback: string) => {
    setProgressText('');
    const message = error instanceof Error ? error.message : '';
    if (message.includes('EXSAT_LOGIN_REQUIRED')) {
      setExsatConnected(false); setRows([]); setSourceName(''); setBatchInfo(''); setExsatFailures([]);
      void app?.exsatLogout?.();
    }
    onError(exsatErrorMessage(error, fallback));
  };

  const loadExsat = async (automatic: boolean) => {
    if (!app) return;
    setLoading(true);
    setProgressText(automatic ? 'Varrendo o catálogo da Exsat…' : 'Consultando as páginas da Exsat…');
    try {
      if (automatic) {
        if (!app.previewExsatAuto) throw new Error('A atualização automática da Exsat requer o aplicativo desktop atualizado.');
        await applyExsatPreview(await app.previewExsatAuto(), true);
      } else {
        const urls = exsatUrls.split(/\r?\n|;/).map((url) => url.trim()).filter(Boolean);
        if (!app.previewExsatBatch) throw new Error('A atualização em lote da Exsat requer o aplicativo desktop atualizado.');
        await applyExsatPreview(await app.previewExsatBatch(urls), false);
      }
    } catch (error) { handleExsatError(error, 'Não foi possível consultar a Exsat.'); }
    finally { setLoading(false); setProgressText(''); }
  };

  const loginExsat = async () => {
    setLoading(true);
    try {
      const status = await app?.exsatLogin();
      setExsatConnected(status?.connected ?? false);
      if (!status?.connected) onError('O login da Exsat não foi confirmado. Entre no site e feche a janela somente depois de acessar sua conta.');
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível abrir o login da Exsat.'); }
    finally { setLoading(false); }
  };
  const logoutExsat = async () => {
    setLoading(true);
    try { await app?.exsatLogout(); setExsatConnected(false); }
    catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível desconectar da Exsat.'); }
    finally { setLoading(false); }
  };

  const stripRow = ({ key, status, ...item }: Row): CatalogImportItem => { void key; void status; return item; };

  const importRows = async () => {
    if (importableRows.length === 0 || loading) return;
    setLoading(true);
    try {
      const cleanRows = importableRows.map(stripRow);
      let finalRows = cleanRows;
      if (mode !== 'exsat') {
        const preview = await catalogApi.previewImport(cleanRows);
        const allowedCodes = new Set(preview.items.filter((item) => item.status === 'new' || item.status === 'updated').map((item) => item.code.toLowerCase()));
        finalRows = cleanRows.filter((item) => allowedCodes.has(item.code.toLowerCase()));
      }
      if (finalRows.length === 0) { onError('Nenhum item precisa ser atualizado.'); return; }
      const result = await catalogApi.importBulk(finalRows);
      if (mode === 'exsat' && app?.recordExsatSync) setSyncInfo(await app.recordExsatSync({ created: result.created, updated: result.updated }));
      onImported(result.products, `${result.created} itens cadastrados, ${result.updated} atualizados${result.ignored ? ` e ${result.ignored} ignorados` : ''}.`);
      setRows([]); setBatchInfo(''); setExsatFailures([]); onClose();
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível importar os itens.'); }
    finally { setLoading(false); setProgressText(''); }
  };
  const updateRow = (key: string, field: keyof CatalogImportItem, value: string) => setRows((current) => current.map((row) => row.key === key ? {
    ...row, status: undefined, [field]: field === 'currentCost' ? moneyValue(value) : value,
  } : row));
  const exportRows = async () => {
    if (rows.length === 0 || loading || !app?.exportCatalogPreview) return;
    setLoading(true);
    try {
      const result = await app.exportCatalogPreview(rows.map(stripRow));
      if (!result.canceled) onError('Planilha exportada. Corrija os valores e importe o CSV pela aba Planilha.');
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível exportar a planilha.'); }
    finally { setLoading(false); }
  };

  const picker = (kind: 'file' | 'image') => {
    const image = kind === 'image';
    const Icon = image ? FileImage : FileSpreadsheet;
    if (canPick) {
      return <section className="cid-card">
        <div className="cid-status">
          <span className="cid-ico"><Icon size={20} aria-hidden="true" /></span>
          <span className="cid-grow"><b>{image ? 'Imagem, foto, captura de tela ou PDF' : 'Planilha XLSX, CSV ou TSV'}</b>
            <span>{image ? 'O aplicativo reconhece produtos e preços, com ou sem código. Confira os itens antes de salvar.' : 'A primeira linha deve conter os nomes das colunas.'}</span></span>
          <button type="button" className="od-btn p" disabled={loading} onClick={() => void chooseFile(kind)}>
            {loading ? <Loader2 size={16} className="od-spin" /> : <Icon size={16} />}{image ? 'Selecionar imagem ou PDF' : 'Selecionar planilha'}</button>
        </div>
      </section>;
    }
    return image
      ? <WebOnly title="Reconhecimento de imagem e PDF" text="Ler fotos e PDFs roda só no aplicativo do computador. No site, importe por planilha XLSX ou CSV.">
        <button type="button" className="od-btn p" onClick={() => switchMode('file')}><FileSpreadsheet size={16} />Importar por planilha</button>
      </WebOnly>
      : <WebOnly title="Planilha XLSX, CSV ou TSV" text="No site, o assistente de importação lê a planilha, liga as colunas e mostra o que muda antes de salvar.">
        {onOpenWizard
          ? <button type="button" className="od-btn p" onClick={() => { onClose(); onOpenWizard(); }}><FileSpreadsheet size={16} />Abrir o assistente de importação</button>
          : <button type="button" className="od-btn s" onClick={() => switchMode('manual')}><Plus size={16} />Colar as linhas na aba Manual</button>}
      </WebOnly>;
  };

  const footerHint = mode === 'exsat' ? 'Entram só os itens confirmados na página do produto e os que você editar.' : 'Use o valor total do item; parcelas e condições de pagamento são ignoradas.';
  const count = importableRows.length;
  return <div className="cid-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
    <section className="cid" role="dialog" aria-modal="true" aria-labelledby="cid-title">
      <header className="cid-head">
        <span className="cid-grow"><span className="od-eyebrow">Catálogo</span><h2 id="cid-title">Importar itens em lote</h2>
          <p>Confira o valor total do item antes de atualizar o catálogo.</p></span>
        <button type="button" className="od-ibtn" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="cid-tabs" role="tablist" aria-label="Origem dos itens">
        {TABS.map(([value, label]) => <button key={value} type="button" role="tab" id={`cid-tab-${value}`} aria-selected={mode === value} aria-controls="cid-panel"
          className="cid-tab" onClick={() => switchMode(value)}>{label}</button>)}
      </div>
      <div className="cid-body" role="tabpanel" id="cid-panel" aria-labelledby={`cid-tab-${mode}`}>
        {mode === 'manual' && <section className="cid-card cid-manual">
          <label className="od-fld"><span>Linhas do orçamento ou da planilha</span>
            <textarea className="cid-area" value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Cole linhas separadas por TAB, ponto e vírgula ou CSV." /></label>
          <div className="cid-actions">
            <button type="button" className="od-btn p" onClick={() => { setRows(parseCatalogText(manual, 'MANUAL')); setSourceName('Digitação manual'); }}>Interpretar linhas</button>
            {ocrText && <button type="button" className="od-btn s" onClick={() => void copyOcrText()}><Copy size={15} />Copiar texto do OCR</button>}
          </div>
        </section>}
        {(mode === 'file' || mode === 'image') && picker(mode)}
        {mode === 'exsat' && <CatalogImportExsat desktop={canExsat} connected={exsatConnected} busy={loading} progress={progressText} info={syncInfo} urls={exsatUrls}
          onUrls={setExsatUrls} onLogin={() => void loginExsat()} onLogout={() => void logoutExsat()} onAuto={() => void loadExsat(true)} onManual={() => void loadExsat(false)}
          onOpenExsat={onOpenExsat ? () => { onClose(); onOpenExsat(); } : undefined} onUseSheet={() => switchMode('file')} />}
        {mode === 'exsat' && rows.length > 0 && <div className="cid-chips" aria-label="Resultado da validação">
          <span className="od-chip ok">{exsatSummary.confirmed} confirmados</span>
          {exsatSummary.divergent > 0 && <span className="od-chip warn">{exsatSummary.divergent} divergentes</span>}
          {exsatSummary.unavailable > 0 && <span className="od-chip bad">{exsatSummary.unavailable} indisponíveis</span>}
          {exsatSummary.error > 0 && <span className="od-chip bad">{exsatSummary.error} com erro</span>}
          {batchInfo && <span className="cid-note">{batchInfo}</span>}
        </div>}
        {exsatFailures.length > 0 && <details className="od-note warn cid-failures">
          <summary><AlertTriangle size={15} aria-hidden="true" />Diagnóstico de {exsatFailures.length} falha{exsatFailures.length === 1 ? '' : 's'} por página</summary>
          <ul>{exsatFailures.map((failure) => <li key={`${failure.url}-${failure.stage}-${failure.code}`}>
            <code>{failure.stage} · {failure.code}</code><span>{failure.url}</span><small>{failure.message}</small></li>)}</ul>
        </details>}
        {(rows.length > 0 || mode === 'manual' || (mode === 'exsat' ? canExsat : canPick)) && <CatalogImportTable mode={mode} rows={rows} importable={count} sourceName={sourceName} busy={loading}
          onChange={updateRow} onRemove={(key) => setRows((current) => current.filter((item) => item.key !== key))}
          onAdd={() => setRows((current) => [...current, newRow({ source: mode === 'exsat' ? 'EXSAT' : 'MANUAL' })])}
          onExport={app?.exportCatalogPreview ? () => void exportRows() : undefined} />}
      </div>
      <footer className="cid-foot">
        <span className="cid-grow">{footerHint}</span>
        <button type="button" className="od-btn s" onClick={onClose}>Cancelar</button>
        <button type="button" className="od-btn p" disabled={count === 0 || loading} onClick={() => void importRows()}>
          {loading && <Loader2 size={16} className="od-spin" />}{loading ? (progressText || 'Processando…') : `Confirmar ${count} ${count === 1 ? 'alteração' : 'alterações'}`}</button>
      </footer>
    </section>
  </div>;
}
