import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dialog } from 'electron';
import type { CatalogImportFile, CatalogImportItem } from '../shared/contracts';
import {
  recognizeImage,
  recognizePdf,
  STRUCTURED_MARKER,
} from './catalogOcr';
import { xlsxToTsv } from './xlsx';

export { runPowerShellScript } from './catalogOcr';

const normalizeStructuredOcr = (text: string) => {
  const rows = text.split(/\r?\n/).filter((line) => line.startsWith(`${STRUCTURED_MARKER}\t`));
  if (rows.length === 0) return text;
  const normalizedRows = rows
    .map((row) => row.split('\t').slice(1).join('\t'))
    .filter((row) => row.trim().length > 0);
  return ['Código\tDescrição\tCategoria\tFabricante\tModelo\tUnidade\tValor total\tFonte', ...normalizedRows].join('\n');
};

export const selectCatalogImport = async (kind: 'table' | 'image'): Promise<CatalogImportFile> => {
  const selection = await dialog.showOpenDialog({
    title: 'Importar itens para o catálogo', properties: ['openFile'],
    filters: [
      kind === 'image' ? { name: 'Imagens e PDF', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'pdf'] } : { name: 'Planilhas', extensions: ['xlsx', 'csv', 'tsv', 'txt'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });
  const filePath = selection.filePaths[0];
  if (selection.canceled || !filePath) return { canceled: true };
  const extension = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);
  if (extension === '.pdf') {
    const result = await recognizePdf(filePath);
    return { canceled: false, kind: 'image', name, text: normalizeStructuredOcr(result.text), ocrEngine: result.engine };
  }
  if (['.png', '.jpg', '.jpeg', '.bmp'].includes(extension)) {
    const result = await recognizeImage(filePath);
    return { canceled: false, kind: 'image', name, text: normalizeStructuredOcr(result.text), ocrEngine: result.engine };
  }
  const buffer = await readFile(filePath);
  const text = extension === '.xlsx' ? await xlsxToTsv(buffer) : buffer.toString('utf8').replace(/^\uFEFF/, '');
  return { canceled: false, kind: 'table', name, text };
};

const csvCell = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const exportCatalogImport = async (items: CatalogImportItem[]) => {
  const selection = await dialog.showSaveDialog({
    title: 'Exportar prévia do catálogo',
    defaultPath: path.join(process.env.USERPROFILE ?? '', 'Documents', `catalogo-${new Date().toISOString().slice(0, 10)}.csv`),
    buttonLabel: 'Exportar planilha',
    filters: [{ name: 'Planilha CSV', extensions: ['csv'] }],
  });
  if (selection.canceled || !selection.filePath) return { canceled: true };
  const header = ['Código', 'Descrição', 'Categoria', 'Fabricante', 'Modelo', 'Unidade', 'Valor total', 'Fonte'];
  const rows = items.map((item) => [item.code, item.description, item.category, item.manufacturer, item.model, item.unit, item.currentCost.toFixed(2).replace('.', ','), item.source]);
  await writeFile(selection.filePath, `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}`, 'utf8');
  return { canceled: false, filePath: selection.filePath };
};
