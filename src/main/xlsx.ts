import JSZip from 'jszip';

const xmlText = (value: string) => value
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const columnIndex = (reference: string) => {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? 'A';
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
};

export const xlsxToTsv = async (buffer: Buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('text');
  const sharedStrings = sharedXml
    ? [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/gi)].map((match) =>
      [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gi)].map((part) => xmlText(part[1])).join(''))
    : [];
  const sheetName = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort()[0];
  if (!sheetName) throw new Error('A planilha não possui uma aba legível.');
  const sheet = await zip.file(sheetName)?.async('text');
  if (!sheet) throw new Error('Não foi possível ler a primeira aba da planilha.');

  return [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/gi)].map((row) => {
    const values: string[] = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const reference = cell[1].match(/\br="([A-Z]+\d+)"/i)?.[1] ?? 'A1';
      const type = cell[1].match(/\bt="([^"]+)"/i)?.[1];
      const raw = cell[2].match(/<v[^>]*>([\s\S]*?)<\/v>/i)?.[1]
        ?? cell[2].match(/<t[^>]*>([\s\S]*?)<\/t>/i)?.[1] ?? '';
      values[columnIndex(reference)] = type === 's' ? sharedStrings[Number(raw)] ?? '' : xmlText(raw);
    }
    return values.map((value) => value ?? '').join('\t');
  }).join('\n');
};
