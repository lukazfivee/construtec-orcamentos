import { useEffect, useMemo, useState } from 'react';
import { FileImage, FileSpreadsheet, Globe2, Import, LogIn, LogOut, Plus, Trash2, X } from 'lucide-react';
import type { CatalogImportItem, CatalogProduct } from '../shared/contracts';
import { catalogApi } from './api';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (products: CatalogProduct[], message: string) => void;
  onError: (message: string) => void;
};
type Row = CatalogImportItem & { key: string };

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
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
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
const newRow = (partial: Partial<CatalogImportItem> = {}): Row => ({
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

export const parseExsatQuoteText = (text: string): Row[] => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const productPattern = /(\d{6,14})\s+(\d{3,10})\s+(.+?)\s+(\d+(?:[.,]\d{3})?)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})(?=\s+\d{6,14}\s+\d{3,10}\s+|\s+(?:Total|Condi[cç][oõ]es|Tipo de Frete|Cobran[cç]a|Plano de Pag)|$)/gi;
  return [...normalized.matchAll(productPattern)].map((match) => {
    const [, manufacturerCode, supplierCode, description, , , , netPrice] = match;
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
  });
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

export function CatalogImportDialog({ open, onClose, onImported, onError }: Props) {
  const [mode, setMode] = useState<'manual' | 'file' | 'image' | 'exsat'>('manual');
  const [manual, setManual] = useState('Código\tDescrição\tCategoria\tFabricante\tModelo\tUnidade\tCusto\tFonte');
  const [exsatUrl, setExsatUrl] = useState('https://exsat.com.br/');
  const [rows, setRows] = useState<Row[]>([]);
  const [sourceName, setSourceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [exsatConnected, setExsatConnected] = useState(false);
  const validRows = useMemo(() => rows.filter((row) => row.code.trim().length >= 2 && row.description.trim().length >= 3 && row.category.trim().length >= 2 && row.unit.trim()), [rows]);
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
      setRows(parsedRows); setSourceName(result.name ?? 'Arquivo importado');
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.'); }
    finally { setLoading(false); }
  };
  const loadExsat = async () => {
    setLoading(true);
    try {
      const result = window.construtec
        ? await window.construtec.previewExsat(exsatUrl)
        : await catalogApi.previewExsat(exsatUrl).then((fallback) => ({ ...fallback, connected: false }));
      setExsatConnected(result.connected);
      setRows(result.items.map((item) => newRow(item))); setSourceName('Exsat Distribuidora');
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
    if (validRows.length === 0 || loading) return;
    setLoading(true);
    try {
      const result = await catalogApi.importBulk(validRows.map((row) => {
        const { key, ...item } = row;
        void key;
        return item;
      }));
      onImported(result.products, `${result.created} itens cadastrados e ${result.updated} atualizados.`);
      setRows([]); onClose();
    } catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível importar os itens.'); }
    finally { setLoading(false); }
  };
  const updateRow = (key: string, field: keyof CatalogImportItem, value: string) => setRows((current) => current.map((row) => row.key === key ? {
    ...row, [field]: field === 'currentCost' ? moneyValue(value) : value,
  } : row));

  return <div className="import-overlay" role="presentation"><section className="import-dialog" role="dialog" aria-modal="true" aria-label="Importar catálogo em lote">
    <header><span><Import size={22} /><div><h2>Importar itens em lote</h2><p>Confira os dados antes de atualizar o catálogo.</p></div></span><button type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button></header>
    <nav>{[
      ['manual', Plus, 'Manual'], ['file', FileSpreadsheet, 'Planilha'], ['image', FileImage, 'Imagem'], ['exsat', Globe2, 'Exsat'],
    ].map(([value, Icon, label]) => <button key={String(value)} type="button" className={mode === value ? 'active' : ''} onClick={() => setMode(value as typeof mode)}><Icon size={16} />{String(label)}</button>)}</nav>
    <div className="import-source">
      {mode === 'manual' && <><textarea value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Cole linhas separadas por TAB, ponto e vírgula ou CSV." /><button type="button" className="primary" onClick={() => { setRows(parseCatalogText(manual, 'MANUAL')); setSourceName('Digitação manual'); }}>Interpretar linhas</button></>}
      {mode === 'file' && <div className="import-picker"><FileSpreadsheet size={28} /><span><b>Planilha XLSX, CSV ou TSV</b><small>A primeira linha deve conter os nomes das colunas.</small></span><button type="button" className="primary" disabled={loading} onClick={() => void chooseFile('file')}>Selecionar planilha</button></div>}
      {mode === 'image' && <div className="import-picker"><FileImage size={28} /><span><b>Foto, captura de tela ou orçamento da Exsat</b><small>Nos orçamentos Exsat, o app usa Fab. como código e Vl. Líq. como custo unitário. Confira os itens antes de salvar.</small></span><button type="button" className="primary" disabled={loading} onClick={() => void chooseFile('image')}>Selecionar imagem</button></div>}
      {mode === 'exsat' && <div className="exsat-source"><label><span>Endereço de uma categoria ou busca da Exsat</span><input value={exsatUrl} onChange={(event) => setExsatUrl(event.target.value)} /></label><div className={`exsat-session ${exsatConnected ? 'connected' : ''}`}><span>{exsatConnected ? 'Conta conectada' : 'Conta não conectada'}</span>{exsatConnected ? <button type="button" disabled={loading} onClick={() => void logoutExsat()}><LogOut size={14} /> Desconectar</button> : <button type="button" disabled={loading} onClick={() => void loginExsat()}><LogIn size={14} /> Entrar na Exsat</button>}</div><button type="button" className="primary" disabled={loading} onClick={() => void loadExsat()}>Consultar produtos e preços</button></div>}
    </div>
    <div className="import-summary"><span><b>{rows.length}</b> linhas encontradas · <b>{validRows.length}</b> prontas</span><span>{sourceName || 'Nenhuma fonte carregada'}</span><button type="button" onClick={() => setRows((current) => [...current, newRow({ source: mode === 'exsat' ? 'EXSAT' : 'MANUAL' })])}><Plus size={14} /> Linha</button></div>
    <div className="import-table"><table><thead><tr>{fields.map((field) => <th key={field.key} style={{ width: field.width }}>{field.label}</th>)}<th aria-label="Excluir" /></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className={!row.code || !row.description ? 'invalid' : ''}>{fields.map((field) => <td key={field.key}><input value={field.key === 'currentCost' ? String(row.currentCost).replace('.', ',') : String(row[field.key] ?? '')} onChange={(event) => updateRow(row.key, field.key, event.target.value)} aria-label={`${field.label} da linha`} /></td>)}<td><button type="button" aria-label="Excluir linha" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}><Trash2 size={14} /></button></td></tr>)}</tbody></table>{rows.length === 0 && <p>Carregue uma fonte ou adicione uma linha manualmente.</p>}</div>
    <footer><span>Códigos existentes serão atualizados; propostas antigas permanecerão intactas.</span><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="primary" disabled={validRows.length === 0 || loading} onClick={() => void importRows()}>{loading ? 'Processando…' : `Importar ${validRows.length} itens`}</button></footer>
  </section></div>;
}
