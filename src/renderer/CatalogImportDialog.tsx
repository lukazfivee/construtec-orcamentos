import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, FileImage, FileSpreadsheet, Globe2, Import, LogIn, LogOut, Plus, Trash2, X } from 'lucide-react';
import type { CatalogImportItem, CatalogImportStatus, CatalogProduct, ExsatBatchPreview, ExsatPageFailure, ExsatSyncInfo } from '../shared/contracts';
import { catalogApi } from './api';
import {
  formatMoney,
  formatSyncDate,
  moneyValue,
  newRow,
  parseCatalogText,
  type Row,
} from './catalogImportHelpers';

export { parseCatalogText, parseExsatQuoteText } from './catalogImportHelpers';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (products: CatalogProduct[], message: string) => void;
  onError: (message: string) => void;
};

const fields: Array<{ key: keyof CatalogImportItem; label: string; width?: string }> = [
  { key: 'code', label: 'Código', width: '115px' }, { key: 'description', label: 'Descrição', width: '270px' },
  { key: 'category', label: 'Categoria', width: '130px' }, { key: 'manufacturer', label: 'Fabricante', width: '120px' },
  { key: 'model', label: 'Modelo', width: '110px' }, { key: 'unit', label: 'Unid.', width: '70px' },
  { key: 'currentCost', label: 'Valor total', width: '120px' }, { key: 'source', label: 'Fonte', width: '100px' },
];
const statusLabel: Record<CatalogImportStatus, string> = {
  new: 'Novo', updated: 'Atualizar', unchanged: 'Sem alteração', no_price: 'Sem preço',
  confirmed: 'Confirmado', divergent: 'Divergente', unavailable: 'Indisponível', error: 'Erro',
};

export function CatalogImportDialog({ open, onClose, onImported, onError }: Props) {
  const [mode, setMode] = useState<'manual' | 'file' | 'image' | 'exsat'>('manual');
  const [manual, setManual] = useState('Código\tDescrição\tCategoria\tFabricante\tModelo\tUnidade\tValor total\tFonte');
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
  const validRows = useMemo(() => rows.filter((row) => row.code.trim().length >= 2 && row.description.trim().length >= 3 && row.category.trim().length >= 2 && row.unit.trim()), [rows]);
  const previewSummary = useMemo(() => ({
    new: rows.filter((row) => row.status === 'new').length,
    updated: rows.filter((row) => row.status === 'updated').length,
    unchanged: rows.filter((row) => row.status === 'unchanged').length,
    noPrice: rows.filter((row) => row.status === 'no_price').length,
  }), [rows]);
  const exsatSummary = useMemo(() => ({
    confirmed: rows.filter((row) => row.status === 'confirmed').length,
    divergent: rows.filter((row) => row.status === 'divergent').length,
    unavailable: rows.filter((row) => row.status === 'unavailable').length,
    error: rows.filter((row) => row.status === 'error').length,
  }), [rows]);
  const importableRows = useMemo(() => mode === 'exsat'
    ? validRows.filter((row) => row.status === 'confirmed')
    : validRows, [mode, validRows]);

  useEffect(() => {
    if (open && mode === 'exsat') {
      void window.construtec?.exsatStatus().then((status) => setExsatConnected(status.connected));
      void window.construtec?.exsatSyncInfo?.().then(setSyncInfo);
      const unsubscribe = window.construtec?.onExsatValidationProgress?.((data) => {
        setProgressText(`Validando na Exsat: ${data.current} de ${data.total} (${data.code})…`);
      });
      return () => { unsubscribe?.(); };
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const chooseFile = async (expected: 'file' | 'image') => {
    setLoading(true);
    try {
      const result = await window.construtec?.selectCatalogImport(expected === 'image' ? 'image' : 'table');
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
    setRows(result.items.map((item) => ({
      ...newRow(item),
      status: item.validationStatus ?? 'confirmed',
    })));
    setSourceName(automatic ? `Exsat automática · ${result.sourceCount} páginas lidas` : `Exsat Distribuidora · ${result.sourceCount} fonte${result.sourceCount === 1 ? '' : 's'}`);
    const notes = [
      result.ignored > 0 ? `${result.ignored} duplicado${result.ignored === 1 ? '' : 's'} consolidado${result.ignored === 1 ? '' : 's'}` : '',
      result.failures.length > 0 ? `${result.failures.length} página${result.failures.length === 1 ? '' : 's'} não pôde ser lida` : '',
      automatic ? 'sincronização incremental com varredura completa periódica' : '',
    ].filter(Boolean);
    setBatchInfo(notes.join(' · '));
    if (window.construtec?.exsatSyncInfo) setSyncInfo(await window.construtec.exsatSyncInfo());
  };

  const handleExsatError = (error: unknown, fallback: string) => {
    setProgressText('');
    const message = error instanceof Error ? error.message : '';
    if (message.includes('EXSAT_LOGIN_REQUIRED')) {
      setExsatConnected(false);
      setRows([]);
      setSourceName('');
      setBatchInfo('');
      setExsatFailures([]);
      void window.construtec?.exsatLogout?.();
      onError('Sua sessão da Exsat expirou. Entre novamente para continuar.');
      return;
    }
    onError(message || fallback);
  };

  const loadExsat = async () => {
    setLoading(true);
    setProgressText('Consultando páginas da Exsat…');
    try {
      const urls = exsatUrls.split(/\r?\n|;/).map((url) => url.trim()).filter(Boolean);
      if (!window.construtec?.previewExsatBatch) throw new Error('A atualização em lote da Exsat requer o aplicativo desktop atualizado.');
      await applyExsatPreview(await window.construtec.previewExsatBatch(urls), false);
    } catch (error) { handleExsatError(error, 'Não foi possível consultar a Exsat.'); }
    finally { setLoading(false); setProgressText(''); }
  };

  const loadExsatAuto = async () => {
    setLoading(true);
    setProgressText('Varrendo catálogo da Exsat…');
    try {
      if (!window.construtec?.previewExsatAuto) throw new Error('A atualização automática da Exsat requer o aplicativo desktop atualizado.');
      await applyExsatPreview(await window.construtec.previewExsatAuto(), true);
    } catch (error) { handleExsatError(error, 'Não foi possível varrer o catálogo da Exsat.'); }
    finally { setLoading(false); setProgressText(''); }
  };

  const loginExsat = async () => {
    setLoading(true);
    try {
      const status = await window.construtec?.exsatLogin();
      setExsatConnected(status?.connected ?? false);
      if (!status?.connected) onError('O login da Exsat não foi confirmado. Entre no site e feche a janela somente depois de acessar sua conta.');
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível abrir o login da Exsat.'); }
    finally { setLoading(false); }
  };
  const logoutExsat = async () => {
    setLoading(true);
    try { await window.construtec?.exsatLogout(); setExsatConnected(false); }
    catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível desconectar da Exsat.'); }
    finally { setLoading(false); }
  };

  const importRows = async () => {
    if (importableRows.length === 0 || loading) return;
    setLoading(true);
    try {
      const cleanRows = importableRows.map((row) => {
        const { key, status, ...item } = row;
        void key; void status;
        return item;
      });
      let finalRows = cleanRows;
      if (mode !== 'exsat') {
        const preview = await catalogApi.previewImport(cleanRows);
        const allowedCodes = new Set(preview.items.filter((item) => item.status === 'new' || item.status === 'updated').map((item) => item.code.toLowerCase()));
        finalRows = cleanRows.filter((item) => allowedCodes.has(item.code.toLowerCase()));
      }
      if (finalRows.length === 0) {
        onError('Nenhum item precisa ser atualizado.');
        return;
      }
      const result = await catalogApi.importBulk(finalRows);
      if (mode === 'exsat' && window.construtec?.recordExsatSync) {
        setSyncInfo(await window.construtec.recordExsatSync({ created: result.created, updated: result.updated }));
      }
      onImported(result.products, `${result.created} itens cadastrados, ${result.updated} atualizados${result.ignored ? ` e ${result.ignored} ignorados` : ''}.`);
      setRows([]); setBatchInfo(''); setExsatFailures([]); onClose();
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível importar os itens.'); }
    finally { setLoading(false); setProgressText(''); }
  };
  const updateRow = (key: string, field: keyof CatalogImportItem, value: string) => setRows((current) => current.map((row) => row.key === key ? {
    ...row, status: undefined, [field]: field === 'currentCost' ? moneyValue(value) : value,
  } : row));
  const exportRows = async () => {
    if (rows.length === 0 || loading || !window.construtec?.exportCatalogPreview) return;
    setLoading(true);
    try {
      const result = await window.construtec.exportCatalogPreview(rows.map(({ key, status, ...item }) => {
        void key; void status;
        return item;
      }));
      if (!result.canceled) onError('Planilha exportada. Corrija os valores e importe o CSV pela aba Planilha.');
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível exportar a planilha.'); }
    finally { setLoading(false); }
  };

  return <div className="import-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}><section className={`import-dialog${mode === 'exsat' && rows.length > 0 ? ' has-preview' : ''}`} role="dialog" aria-modal="true" aria-label="Importar catálogo em lote" onClick={(e) => e.stopPropagation()}>
    <header><span><Import size={22} /><div><h2>Importar itens em lote</h2><p>Confira o valor total do item antes de atualizar o catálogo.</p></div></span><button type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button></header>
    <nav>{[
      ['manual', Plus, 'Manual'], ['file', FileSpreadsheet, 'Planilha'], ['image', FileImage, 'Imagem/PDF'], ['exsat', Globe2, 'Exsat'],
    ].map(([value, Icon, label]) => <button key={String(value)} type="button" className={mode === value ? 'active' : ''} onClick={() => { setMode(value as typeof mode); setRows([]); setBatchInfo(''); setExsatFailures([]); }}><Icon size={16} />{String(label)}</button>)}</nav>
    <div className="import-source">
      {mode === 'manual' && <><textarea value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Cole linhas separadas por TAB, ponto e vírgula ou CSV." /><button type="button" className="primary" onClick={() => { setRows(parseCatalogText(manual, 'MANUAL')); setSourceName('Digitação manual'); }}>Interpretar linhas</button>{ocrText && <button type="button" className="ocr-copy" onClick={() => void copyOcrText()}><Copy size={14} /> Copiar OCR</button>}</>}
      {mode === 'file' && <div className="import-picker"><FileSpreadsheet size={28} /><span><b>Planilha XLSX, CSV ou TSV</b><small>A primeira linha deve conter os nomes das colunas.</small></span><button type="button" className="primary" disabled={loading} onClick={() => void chooseFile('file')}>Selecionar planilha</button></div>}
      {mode === 'image' && <div className="import-picker"><FileImage size={28} /><span><b>Imagem, foto, captura de tela ou PDF</b><small>O app tenta reconhecer produtos, materiais e equipamentos com preço, com ou sem código. Confira os itens antes de salvar.</small></span><button type="button" className="primary" disabled={loading} onClick={() => void chooseFile('image')}>Selecionar imagem ou PDF</button></div>}
      {mode === 'exsat' && <div className="exsat-source">
        <div className="exsat-overview">
          <div className={`exsat-session ${exsatConnected ? 'connected' : ''}`}><span>{exsatConnected ? 'Conta conectada' : 'Conta não conectada'}</span>{exsatConnected ? <button type="button" disabled={loading} onClick={() => void logoutExsat()}><LogOut size={14} /> Desconectar</button> : <button type="button" disabled={loading} onClick={() => void loginExsat()}><LogIn size={14} /> Entrar na Exsat</button>}</div>
          <div className="exsat-sync-dates"><span><b>Última sincronização</b>{formatSyncDate(syncInfo.lastSyncAt)}</span><span><b>Varredura completa</b>{formatSyncDate(syncInfo.lastFullSyncAt)}</span></div>
          <div className="exsat-auto-action"><button type="button" className="primary" disabled={loading || !exsatConnected} onClick={() => void loadExsatAuto()}>Atualizar catálogo</button><small>Até 24 páginas no incremental e 60 na varredura completa periódica.</small></div>
        </div>
        <div className="exsat-tools">
          {syncInfo.history.length > 0 && <details><summary>Histórico das últimas sincronizações</summary><div>{syncInfo.history.slice(0, 10).map((entry) => <p key={entry.id}><b>{formatSyncDate(entry.completedAt)}</b> · {entry.mode === 'full' ? 'Completa' : entry.mode === 'incremental' ? 'Incremental' : 'Manual'} · {entry.pagesRead} páginas · {entry.itemsFound} itens · <b>{entry.created} novos</b> · <b>{entry.updated} atualizados</b>{entry.failedPages ? ` · ${entry.failedPages} falhas` : ''}</p>)}</div></details>}
          <details><summary>Modo avançado: informar páginas manualmente</summary><label><span>Endereços de categorias ou buscas — um por linha</span><textarea value={exsatUrls} onChange={(event) => setExsatUrls(event.target.value)} placeholder={'https://exsat.com.br/...\nhttps://exsat.com.br/...'} /></label><button type="button" disabled={loading || !exsatConnected} onClick={() => void loadExsat()}>Buscar somente estas páginas</button></details>
        </div>
      </div>}
    </div>
    {mode === 'exsat' && rows.length > 0 && <div className={`import-summary exsat-preview-summary${exsatFailures.length > 0 ? ' has-warning' : ''}`}><span><b>{exsatSummary.confirmed}</b> confirmados · <b>{exsatSummary.divergent}</b> divergentes · <b>{exsatSummary.unavailable}</b> indisponíveis · <b>{exsatSummary.error}</b> com erro</span><span>{batchInfo || 'Validação individual realizada'}</span>{exsatFailures.length > 0 && <details className="exsat-failures"><summary>Diagnóstico de {exsatFailures.length} falha{exsatFailures.length === 1 ? '' : 's'} por página</summary><ul>{exsatFailures.map((failure) => <li key={`${failure.url}-${failure.stage}-${failure.code}`}><code>{failure.stage} · {failure.code}</code><span>{failure.url}</span><small>{failure.message}</small></li>)}</ul></details>}</div>}
    <div className="import-summary"><span><b>{rows.length}</b> linhas encontradas · <b>{importableRows.length}</b> para importar</span><span>{sourceName || 'Nenhuma fonte carregada'}</span>{rows.length > 0 && <button type="button" disabled={loading} onClick={() => void exportRows()}><Download size={14} /> Exportar planilha</button>}<button type="button" onClick={() => setRows((current) => [...current, newRow({ source: mode === 'exsat' ? 'EXSAT' : 'MANUAL' })])}><Plus size={14} /> Linha</button></div>
    <div className="import-table"><table><thead><tr>{mode === 'exsat' && <th style={{ width: '120px' }}>Situação</th>}{fields.map((field) => <th key={field.key} style={{ width: field.width }}>{field.label}</th>)}<th aria-label="Excluir" /></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className={!row.code || !row.description || row.status === 'no_price' || row.status === 'unavailable' || row.status === 'error' ? 'invalid' : ''}>{mode === 'exsat' && <td><b className={`import-status status-${row.status ?? 'edited'}`}>{row.status ? statusLabel[row.status] : 'Editado'}</b></td>}{fields.map((field) => <td key={field.key}><input value={field.key === 'currentCost' ? formatMoney(row.currentCost) : String(row[field.key] ?? '')} onChange={(event) => updateRow(row.key, field.key, event.target.value)} aria-label={`${field.label} da linha`} /></td>)}<td><button type="button" aria-label="Excluir linha" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}><Trash2 size={14} /></button></td></tr>)}</tbody></table>{rows.length === 0 && <p>Carregue uma fonte ou adicione uma linha manualmente.</p>}</div>
    <footer><span>Use valor total do item; parcelas e condições de pagamento são ignoradas.</span><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="primary" disabled={importableRows.length === 0 || loading} onClick={() => void importRows()}>{loading ? (progressText || 'Processando…') : `Confirmar ${importableRows.length} alterações`}</button></footer>
  </section></div>;
}
