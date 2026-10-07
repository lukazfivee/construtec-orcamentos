import type { CatalogImportItem, CatalogProduct } from '../shared/contracts';
import { catalogApi } from './api';
import { CHUNK } from './catalogImportFlow';

// A API aceita ate 500 itens por chamada; varreduras grandes (catalogo inteiro da Exsat) entram em lotes.
export const importInChunks = async (items: CatalogImportItem[], onProgress?: (done: number, total: number) => void) => {
  const totals = { created: 0, updated: 0, ignored: 0 };
  let products: CatalogProduct[] = [];
  for (let index = 0; index < items.length; index += CHUNK) {
    const result = await catalogApi.importBulk(items.slice(index, index + CHUNK));
    totals.created += result.created; totals.updated += result.updated; totals.ignored += result.ignored;
    products = result.products;
    onProgress?.(Math.min(items.length, index + CHUNK), items.length);
  }
  return { ...totals, products };
};

// Compara com o catalogo, em lotes: o que e novo ou mudou de preco entra na conferencia; o resto so e contado.
export const diffAgainstCatalog = async (items: CatalogImportItem[], onProgress?: (done: number, total: number) => void) => {
  const changed: CatalogImportItem[] = [];
  let unchanged = 0;
  for (let index = 0; index < items.length; index += CHUNK) {
    const part = items.slice(index, index + CHUNK);
    const byCode = new Map(part.map((item) => [item.code.toLowerCase(), item]));
    const preview = await catalogApi.previewImport(part);
    for (const row of preview.items) {
      const item = byCode.get(row.code.toLowerCase());
      if ((row.status === 'new' || row.status === 'updated') && item) changed.push(item); else unchanged += 1;
    }
    onProgress?.(Math.min(items.length, index + CHUNK), items.length);
  }
  return { changed, unchanged };
};
