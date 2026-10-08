// Texto do corpo montado da proposta na pre-visualizacao do PDF, quebrado em pedacos (a quebra em paginas e do fluxo).
import type { BodyPart } from '../shared/proposalBody';
import { escapeHtml } from '../documents/proposalDocumentCommon';
import type { FlowAtom } from './proposalPdfFlow';

export const TEXT_CHARS_PER_LINE = 60;
// Pedacos de ate ~8 linhas: um paragrafo longo continua na pagina seguinte em vez de deixar um vazio no fim da anterior.
export const TEXT_CHUNK_LINES = 8;

type Atom = { kind: 'h' | 'p' | 'li'; weight: number; html: string };

const lineWeight = (text: string) => Math.max(1, Math.ceil(text.length / TEXT_CHARS_PER_LINE));

// Pedaco de texto que nunca passa de uma pagina inteira: quebra em palavras quando uma linha e enorme.
const fitPieces = (text: string): string[] => {
  const limit = TEXT_CHUNK_LINES * TEXT_CHARS_PER_LINE;
  if (text.length <= limit) return [text];
  const pieces: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const cut = rest.lastIndexOf(' ', limit);
    const at = cut > limit / 2 ? cut : limit;
    pieces.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
};

type GridPart = Extract<BodyPart, { kind: 'planilha' }>;
// Linhas por pedaco da planilha propria: tabelas longas continuam na pagina seguinte; o cabecalho vai so no primeiro pedaco.
export const GRID_CHUNK_ROWS = 5;

const gridAtoms = (part: GridPart): Atom[] => {
  const cell = (tag: 'th' | 'td', value: string, column: number) => `<${tag}${part.align[column] === 'right' ? ' class="r"' : ''}>${escapeHtml(value)}</${tag}>`;
  const head = part.headers.some(Boolean) ? `<thead><tr>${part.headers.map((header, column) => cell('th', header, column)).join('')}</tr></thead>` : '';
  const rows = part.rows.map((row) => ({ html: `<tr>${row.map((value, column) => cell('td', value, column)).join('')}</tr>`, weight: Math.max(...row.map(lineWeight), 1) }));
  const chunks: Array<typeof rows> = [];
  for (let at = 0; at < rows.length; at += GRID_CHUNK_ROWS) chunks.push(rows.slice(at, at + GRID_CHUNK_ROWS));
  if (chunks.length === 0) chunks.push([]);
  return chunks.map((chunk, index) => ({
    kind: 'p' as const, weight: chunk.reduce((sum, row) => sum + row.weight, 0) + (index === 0 && head ? 1 : 0),
    html: `<table class="pg-grid">${index === 0 ? head : ''}<tbody>${chunk.map((row) => row.html).join('')}</tbody></table>`,
  }));
};

const atomsOf = (part: BodyPart, showSignature: boolean): Atom[] => {
  if (part.kind === 'planilha') return gridAtoms(part);
  if (part.kind === 'heading') return [{ kind: 'h', weight: 2, html: `<h4 class="${part.sub ? 'pg-h2' : 'pg-h'}">${escapeHtml(part.text)}</h4>` }];
  if (part.kind === 'carta') {
    const att = [part.attention, part.department].filter(Boolean);
    const html = `<div class="pg-letter">${part.dateLine ? `<p>${escapeHtml(part.dateLine)}</p>` : ''}${part.recipient ? `<p class="pg-to">${escapeHtml(part.recipient)}</p>` : ''}${att.length ? `<p><b>At.:</b> ${att.map(escapeHtml).join(' / ')}</p>` : ''}${part.reference ? `<p class="pg-ref">REF.: ${escapeHtml(part.reference)}</p>` : ''}<div class="pg-letter-title">${escapeHtml(part.title)}</div>${part.greeting ? `<p>${escapeHtml(part.greeting)}</p>` : ''}${part.intro ? `<p>${escapeHtml(part.intro)}</p>` : ''}</div>`;
    return [{ kind: 'p', weight: 7 + lineWeight(part.reference) + lineWeight(part.intro), html }];
  }
  if (part.kind === 'fechamento') {
    const text = part.paragraphs.map((lines) => `<p class="pg-p">${escapeHtml(lines.join('\n'))}</p>`).join('');
    const sign = showSignature ? `<p class="pg-sign">${escapeHtml(part.signer)}${part.role ? `<br>${escapeHtml(part.role)}` : ''}</p>` : '';
    return [{ kind: 'p', weight: part.paragraphs.reduce((sum, lines) => sum + lineWeight(lines.join(' ')), 0) + (showSignature ? 5 : 1), html: text + sign }];
  }
  if (part.kind === 'list') {
    return part.items.flatMap(fitPieces).map((item) => ({ kind: 'li' as const, weight: lineWeight(item), html: `<li>${escapeHtml(item)}</li>` }));
  }
  if (part.kind !== 'paragraph') return [];
  const lines = part.lines.flatMap(fitPieces);
  const chunks: string[][] = [[]];
  let used = 0;
  for (const line of lines) {
    const weight = lineWeight(line);
    if (used + weight > TEXT_CHUNK_LINES && chunks[chunks.length - 1].length) { chunks.push([]); used = 0; }
    chunks[chunks.length - 1].push(line);
    used += weight;
  }
  return chunks.map((chunk, index) => ({ kind: 'p' as const, weight: chunk.reduce((sum, line) => sum + lineWeight(line), 0) + 0.5, html: `<p class="pg-p${index > 0 ? ' pg-cont' : ''}">${escapeHtml(chunk.join('\n'))}</p>` }));
};

// Pedacos do texto do corpo para o fluxo continuo das paginas (titulo, paragrafo, item de lista, carta e fechamento).
export const bodyTextAtoms = (parts: BodyPart[], showSignature = true): FlowAtom[] =>
  parts.flatMap((part) => atomsOf(part, showSignature)).map((atom) => ({ kind: atom.kind, label: 'Texto' as const, html: atom.html }));
