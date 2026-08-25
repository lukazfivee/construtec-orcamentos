import { useEffect, useMemo, useState } from 'react';
import { FileImage, FileSpreadsheet, Globe2, Import, LogIn, LogOut, Plus, Trash2, X } from 'lucide-react';
import type { CatalogImportItem, CatalogImportStatus, CatalogProduct } from '../shared/contracts';
import { catalogApi } from './api';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (products: CatalogProduct[], message: string) => void;
  onError: (message: string) => void;
};
type Row = CatalogImportItem & { key: string; status?: CatalogImportStatus };

const aliases: Record<string, keyof CatalogImportItem> = {
  codigo: 'code', cód: 'code', cod: 'code', sku: 'code', code: 'code',
  descricao: 'description', descrição: 'description', produto: 'description', item: 'description', description: 'description',
  categoria: 'category', grupo: 'category', category: 'category', fabricante: 'manufacturer', marca: 'manufacturer',
  modelo: 'model', model: 'model', unidade: 'unit', unid: 'unit', und: 'unit', unit: 'unit',
  custo: 'currentCost', preco: 'currentCost', preço: 'currentCost', valor: 'currentCost',
  fonte: 'source', fornecedor: 'source', source: 'source', ativo: 'active', active: 'active',
};

const normalizeHeader = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const moneyValue = (value: string | number) => {
  if (typeof value === 'number') return value;
  const clean = value.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean.replace(/\.(?=.*\.)/g, '');
  const result = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(result) && result >= 0 ? result : 0;
};
const splitLine = (line: string, delimiter: string) => {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { values.push(value.trim()); value = ''; }
    else value += char;
  }
  values.push(value.trim());
  return values;
};
const newRow = (partial: Partial<CatalogImportItem> & { status?: CatalogImportStatus } = {}): Row => ({
  key: crypto.randomUUID(), code: '', description: '', category: 'Importado', manufacturer: null,
  model: null, unit: 'un', currentCost: 0, source: 'IMPORTAÇÃO', active: true, ...partial,
});

const categoryFromDescription = (description: string) => {
  if (/c[aâ]mera|dvr|nvr|gravador|cftv/i.test(description)) return 'CFTV';
  if (/fechadura|controle de acesso|controlador de acesso|porteiro|videoporteiro|catraca/i.test(description)) return 'Controle de acesso';
  if (/cabo|conector|switch|roteador|rack|patch/i.test(description)) return 'Redes e cabeamento';
  if (/detector|sirene|inc[eê]ndio|alarme/i.test(description)) return 'Segurança eletrônica';
  return 'Exsat';
};

const isAdministrativeExsatText = (description: string) => (
  /\b(?:cliente|construtora|construtec|engenharia|ltda|cnpj|cpf|endere[cç]o|or[cç]amento|vendedor|comprador|representante|telefone|email)\b/i.test(description)
);

export const parseExsatQuoteText = (text: string): Row[] => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const productPattern = /(\d{6,14})\s+(\d{3,10})\s+(.+?)\s+(\d+(?:[.,]\d{3})?)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})(?=\s+\d{6,14}\s+\d{3,10}\s+|\s+(?:Total|Condi[cç][oõ]es|Tipo de Frete|Cobran[cç]a|Plano de Pag)|$)/gi;
  const rows = [...normalized.matchAll(productPattern)].map((match) => {
    const [, manufacturerCode, supplierCode, description, , , , netPrice] = match;
    if (isAdministrativeExsatText(description)) return null;
    return newRow({
      code: manufacturerCode,
      description,
      category: categoryFromDescription(description),
      manufacturer: /intelbras|\b(?:VHL|VIP|MHDX|IMHDX|SS|IVP|AMT|XAS|EFM)\b/i.test(description) ? 'Intelbras' : null,
      model: null,
      unit: 'un',
      currentCost: moneyValue(netPrice),
      source: `EXSAT COD. ${supplierCode}`,
      active: true,
    });
  }).filter((row): row is Row => Boolean(row));
  if (rows.length > 0) return rows;

  const looseProductPattern = /(\d{5,14})\s+(\d{2,10})\s+(.+?)(?=\s+\d{5,14}\s+\d{2,10}\s+|\s+(?:Total|Condi[cç][oõ]es|Tipo de Frete|Cobran[cç]a|Plano de Pag|Observa[cç][oõ]es)|$)/gi;
  const pricePattern = /(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{2})/g;
  return [...normalized.matchAll(looseProductPattern)].map((match) => {
    const [, manufacturerCode, supplierCode, productText] = match;
    const prices = productText.match(pricePattern) ?? [];
    const firstPrice = prices[0] ? productText.indexOf(prices[0]) : -1;
    const descriptionSource = firstPrice >= 0 ? productText.slice(0, firstPrice) : productText;
    const description = descriptionSource
      .replace(/\b\d+(?:[,.]\d{1,4})?\b\s*$/g, '')
      .replace(/\b(?:un|und|pc|p[cç])\b\s*$/i, '')
      .trim();
    if (!description || prices.length === 0 || isAdministrativeExsatText(description)) return null;
    return newRow({
      code: manufacturerCode,
      description,
      category: categoryFromDescription(description),
      manufacturer: /intelbras|\b(?:VHL|VIP|MHDX|IMHDX|SS|IVP|AMT|XAS|EFM)\b/i.test(description) ? 'Intelbras' : null,
      model: null,
      unit: 'un',
      currentCost: moneyValue(prices.at(-1) ?? '0'),
      source: `EXSAT COD. ${supplierCode}`,
      active: true,
    });
  }).filter((row): row is Row => Boolean(row));
};

export const parseCatalogText = (text: string, source: string): Row[] => {
  const exsatQuoteRows = parseExsatQuoteText(text);
  if (exsatQuoteRows.length > 0) return exsatQuoteRows;
  if (source === 'IMAGEM' && /(?:Print\s*Preview|Num\.?\s*Or[cç]amento|Vl\.?\s*L[ií]q|Condi[cç][oõ]es\s+de\s+Pagamento)/i.test(text)) return [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const first = splitLine(lines[0], delimiter);
  const mappedHeaders = first.map((header) => aliases[normalizeHeader(header)]);
  const hasHeader = mappedHeaders.includes('code') && mappedHeaders.includes('description');

  if (hasHeader) {
    return lines.slice(1).map((line) => {
      const values = splitLine(line, delimiter);
      const partial: Partial<CatalogImportItem> = { source, active: true };
      mappedHeaders.forEach((field, index) => {
        if (!field) return;
        const value = values[index] ?? '';
        if (field === 'currentCost') partial.currentCost = moneyValue(value);
        else if (field === 'active') partial.active = !/^(nao|não|0|false|inativo)$/i.test(value);
        else if (field === 'manufacturer' || field === 'model') partial[field] = value || null;
        else partial[field] = value;
      });
      return newRow(partial);
    }).filter((row) => row.code || row.description);
  }

  return lines.map((line) => {
    const values = splitLine(line, delimiter);
    if (values.length >= 2) return newRow({
      code: values[0], description: values[1], category: values[2] || 'Importado',
      manufacturer: values[3] || (/intelbras/i.test(values[1]) ? 'Intelbras' : null), model: values[4] || null,
      unit: values[5] || 'un', currentCost: moneyValue(values[6] ?? values.at(-1) ?? '0'), source,
    });
    const code = line.match(/^([A-Za-z0-9_-]{3,60})\s+/)?.[1] ?? '';
    const price = line.match(/R\$\s*[\d.]+,\d{2}|[\d.]+,\d{2}\s*$/)?.[0] ?? '0';
    const description = line.replace(code, '').replace(price, '').trim().replace(/^[-–—|;]+|[-–—|;]+$/g, '').trim();
    return newRow({ code, description, manufacturer: /intelbras/i.test(description) ? 'Intelbras' : null, currentCost: moneyValue(price), source });
  }).filter((row) => row.code || row.description);
};

const fields: Array<{ key: keyof CatalogImportItem; label: string; width?: string }> = [
  { key: 'code', label: 'Código', width: '115px' }, { key: 'description', label: 'Descrição', width: '270px' },
  { key: 'category', label: 'Categoria', width: '130px' }, { key: 'manufacturer', label: 'Fabricante', width: '120px' },
  { key: 'model', label: 'Modelo', width: '110px' }, { key: 'unit', label: 'Unid.', width: '70px' },
  { key: 'currentCost', label: 'Custo', width: '105px' }, { key: 'source', label: 'Fonte', width: '100px' },
];
const statusLabel: Record<CatalogImportStatus, string> = {
  new: 'Novo', updated: 'Atualizar', unchanged: 'Sem alteração', no_price: 'Sem preço',
};

export function CatalogImportDialog({ open, onClose, onImported, onError }: Props) {
  const [mode, setMode] = useState<'manual' | 'file' | 'image' | 'exsat'>('manual');
  const [manual, setManual] = useState('Código\tDescrição\tCategoria\tFabricante\tModelo\tUnidade\tCusto\tFonte');
  const [exsatUrls, setExsatUrls] = useState('https://exsat.com.br/');
  const [rows, setRows] = useState<Row[]>([]);
  const [sourceName, setSourceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [exsatConnected, setExsatConnected] = useState(false);
  const [batchInfo, setBatchInfo] = useState('');
  const validRows = useMemo(() => rows.filter((row) => row.code.trim().length >= 2 && row.description.trim().length >= 3 && row.category.trim().length >= 2 && row.unit.trim()), [rows]);
  const previewSummary = useMemo(() => ({
    new: rows.filter((row) => row.status === 'new').length,
    updated: rows.filter((row) => row.status === 'updated').length,
    unchanged: rows.filter((row) => row.status === 'unchanged').length,
    noPrice: rows.filter((row) => row.status === 'no_price').length,
  }), [rows]);
  const importableRows = useMemo(() => mode === 'exsat'
    ? validRows.filter((row) => row.status === 'new' || row.status === 'updated')
    : validRows.filter((row) => row.currentCost > 0), [mode, validRows]);

  useEffect(() => {
    if (open && mode === 'exsat') void window.construtec?.exsatStatus().then((status) => setExsatConnected(status.connected));
  }, [open, mode]);
  if (!open) return null;

  const chooseFile = async (expected: 'file' | 'image') => {
    setLoading(true);
    try {
      const result = await window.construtec?.selectCatalogImport(expected === 'image' ? 'image' : 'table');
      if (!result || result.canceled) return;
      if (result.kind !== (expected === 'image' ? 'image' : 'table')) {
        throw new Error(expected === 'image' ? 'Selecione uma imagem PNG, JPG ou BMP.' : 'Selecione uma planilha XLSX, CSV ou TSV.');
      }
      const source = expected === 'image' ? 'IMAGEM' : result.name?.replace(/\.[^.]+$/, '').toUpperCase() || 'PLANILHA';
      const parsedRows = parseCatalogText(result.text ?? '', source);
      if (expected === 'image' && parsedRows.length === 0) throw new Error('Nenhum item foi reconhecido na imagem. Use a imagem original em boa resolução, sem a barra do Print Preview, e tente novamente.');
      setRows(parsedRows); setSourceName(result.name ?? 'Arquivo importado'); setBatchInfo('');
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.'); }
    finally { setLoading(false); }
  };

  const loadExsat = async () => {
    setLoading(true);
    try {
      const urls = exsatUrls.split(/\r?\n|;/).map((url) => url.trim()).filter(Boolean);
      if (!window.construtec?.previewExsatBatch) throw new Error('A atualização em lote da Exsat requer o aplicativo desktop atualizado.');
      const result = await window.construtec.previewExsatBatch(urls);
      setExsatConnected(result.connected);
      const preview = await catalogApi.previewImport(result.items);
      setRows(preview.items.map((item) => newRow(item)));
      setSourceName(`Exsat Distribuidora · ${result.sourceCount} fonte${result.sourceCount === 1 ? '' : 's'}`);
      const notes = [
        result.ignored > 0 ? `${result.ignored} duplicado${result.ignored === 1 ? '' : 's'} consolidado${result.ignored === 1 ? '' : 's'}` : '',
        result.failedUrls.length > 0 ? `${result.failedUrls.length} fonte${result.failedUrls.length === 1 ? '' : 's'} não pôde ser lida` : '',
      ].filter(Boolean);
      setBatchInfo(notes.join(' · '));
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível consultar a Exsat.'); }
    finally { setLoading(false); }
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
      const preview = await catalogApi.previewImport(cleanRows);
      const allowedCodes = new Set(preview.items.filter((item) => item.status === 'new' || item.status === 'updated').map((item) => item.code.toLowerCase()));
      const finalRows = cleanRows.filter((item) => allowedCodes.has(item.code.toLowerCase()));
      if (finalRows.length === 0) {
        onError('Nenhum item precisa ser atualizado.');
        return;
      }
      const result = await catalogApi.importBulk(finalRows);
      onImported(result.products, `${result.created} itens cadastrados, ${result.updated} atualizados${result.ignored ? ` e ${result.ignored} ignorados` : ''}.`);
      setRows([]); setBatchInfo(''); onClose();
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível importar os itens.'); }
    finally { setLoading(false); }
  };
  const updateRow = (key: string, field: keyof CatalogImportItem, value: string) => setRows((current) => current.map((row) => row.key === key ? {
    ...row, status: undefined, [field]: field === 'currentCost' ? moneyValue(value) : value,
  } : row));

  return <div className="import-overlay" role="presentation"><section className="import-dialog" role="dialog" aria-modal="true" aria-label="Importar catálogo em lote">
    <header><span><Import size={22} /><div><h2>Importar itens em lote</h2><p>Confira os dados antes de atualizar o catálogo.</p></div></span><button type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button></header>
    <nav>{[
      ['manual', Plus, 'Manual'], ['file', FileSpreadsheet, 'Planilha'], ['image', FileImage, 'Imagem'], ['exsat', Globe2, 'Exsat'],
    ].map(([value, Icon, label]) => <button key={String(value)} type="button" className={mode === value ? 'active' : ''} onClick={() => { setMode(value as typeof mode); setRows([]); setBatchInfo(''); }}><Icon size={16} />{String(label)}</button>)}</nav>
    <div className="import-source">
      {mode === 'manual' && <><textarea value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Cole linhas separadas por TAB, ponto e vírgula ou CSV." /><button type="button" className="primary" onClick={() => { setRows(parseCatalogText(manual, 'MANUAL')); setSourceName('Digitação manual'); }}>Interpretar linhas</button></>}
      {mode === 'file' && <div className="import-picker"><FileSpreadsheet size={28} /><span><b>Planilha XLSX, CSV ou TSV</b><small>A primeira linha deve conter os nomes das colunas.</small></span><button type="button" className="primary" disabled={loading} onClick={() => void chooseFile('file')}>Selecionar planilha</button></div>}
      {mode === 'image' && <div className="import-picker"><FileImage size={28} /><span><b>Foto, captura de tela ou orçamento da Exsat</b><small>Nos orçamentos Exsat, o app usa Fab. como código e Vl. Líq. como custo unitário. Confira os itens antes de salvar.</small></span><button type="button" className="primary" disabled={loading} onClick={() => void chooseFile('image')}>Selecionar imagem</button></div>}
      {mode === 'exsat' && <div className="exsat-source"><label><span>Endereços de categorias ou buscas da Exsat — um por linha</span><textarea value={exsatUrls} onChange={(event) => setExsatUrls(event.target.value)} placeholder={'https://exsat.com.br/...\nhttps://exsat.com.br/...'} /></label><div className={`exsat-session ${exsatConnected ? 'connected' : ''}`}><span>{exsatConnected ? 'Conta conectada' : 'Conta não conectada'}</span>{exsatConnected ? <button type="button" disabled={loading} onClick={() => void logoutExsat()}><LogOut size={14} /> Desconectar</button> : <button type="button" disabled={loading} onClick={() => void loginExsat()}><LogIn size={14} /> Entrar na Exsat</button>}</div><button type="button" className="primary" disabled={loading || !exsatConnected} onClick={() => void loadExsat()}>Buscar lote e comparar catálogo</button></div>}
    </div>
    {mode === 'exsat' && rows.length > 0 && <div className="import-summary"><span><b>{previewSummary.new}</b> novos · <b>{previewSummary.updated}</b> atualizar · <b>{previewSummary.unchanged}</b> sem alteração · <b>{previewSummary.noPrice}</b> sem preço</span><span>{batchInfo || 'Prévia comparada com o catálogo local'}</span></div>}
    <div className="import-summary"><span><b>{rows.length}</b> linhas encontradas · <b>{importableRows.length}</b> para importar</span><span>{sourceName || 'Nenhuma fonte carregada'}</span><button type="button" onClick={() => setRows((current) => [...current, newRow({ source: mode === 'exsat' ? 'EXSAT' : 'MANUAL' })])}><Plus size={14} /> Linha</button></div>
    <div className="import-table"><table><thead><tr>{mode === 'exsat' && <th style={{ width: '100px' }}>Situação</th>}{fields.map((field) => <th key={field.key} style={{ width: field.width }}>{field.label}</th>)}<th aria-label="Excluir" /></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className={!row.code || !row.description || row.status === 'no_price' ? 'invalid' : ''}>{mode === 'exsat' && <td><b>{row.status ? statusLabel[row.status] : 'Editado'}</b></td>}{fields.map((field) => <td key={field.key}><input value={field.key === 'currentCost' ? String(row.currentCost).replace('.', ',') : String(row[field.key] ?? '')} onChange={(event) => updateRow(row.key, field.key, event.target.value)} aria-label={`${field.label} da linha`} /></td>)}<td><button type="button" aria-label="Excluir linha" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}><Trash2 size={14} /></button></td></tr>)}</tbody></table>{rows.length === 0 && <p>Carregue uma fonte ou adicione uma linha manualmente.</p>}</div>
    <footer><span>Sem preço e sem alteração não são importados; propostas antigas permanecem intactas.</span><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="primary" disabled={importableRows.length === 0 || loading} onClick={() => void importRows()}>{loading ? 'Processando…' : `Confirmar ${importableRows.length} alterações`}</button></footer>
  </section></div>;
}
