// Paginas de texto do corpo montado da proposta na pre-visualizacao do PDF: titulos, paragrafos e listas fluem em
// paginas pelo peso (linhas visuais estimadas). A tabela de itens e as condicoes tem as proprias paginas.
import type { BodyPart } from '../shared/proposalBody';
import { escapeHtml } from '../documents/proposalDocumentCommon';

export const TEXT_CHARS_PER_LINE = 60;
export const TEXT_LINES_PER_PAGE = 26;

type Atom = { kind: 'h' | 'p' | 'li'; weight: number; html: string };

const lineWeight = (text: string) => Math.max(1, Math.ceil(text.length / TEXT_CHARS_PER_LINE));

// Pedaco de texto que nunca passa de uma pagina inteira: quebra em palavras quando uma linha e enorme.
const fitPieces = (text: string): string[] => {
  const limit = (TEXT_LINES_PER_PAGE - 3) * TEXT_CHARS_PER_LINE;
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

const atomsOf = (part: BodyPart, showSignature: boolean): Atom[] => {
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
    if (used + weight > TEXT_LINES_PER_PAGE - 3 && chunks[chunks.length - 1].length) { chunks.push([]); used = 0; }
    chunks[chunks.length - 1].push(line);
    used += weight;
  }
  return chunks.map((chunk) => ({ kind: 'p' as const, weight: chunk.reduce((sum, line) => sum + lineWeight(line), 0) + 0.5, html: `<p class="pg-p">${escapeHtml(chunk.join('\n'))}</p>` }));
};

const paginate = (atoms: Atom[]): Atom[][] => {
  const pages: Atom[][] = [];
  let current: Atom[] = [];
  let used = 0;
  for (const atom of atoms) {
    if (current.length && used + atom.weight > TEXT_LINES_PER_PAGE) {
      // Titulo nunca fica sozinho no fim da pagina.
      const orphan = current[current.length - 1].kind === 'h' ? current.pop() : undefined;
      pages.push(current);
      current = orphan ? [orphan] : [];
      used = current.reduce((sum, item) => sum + item.weight, 0);
    }
    current.push(atom);
    used += atom.weight;
  }
  if (current.length) pages.push(current);
  return pages;
};

const renderAtoms = (atoms: Atom[]) => {
  let html = '';
  let open = false;
  for (const atom of atoms) {
    if (atom.kind === 'li' && !open) { html += '<ul class="pg-ul">'; open = true; }
    if (atom.kind !== 'li' && open) { html += '</ul>'; open = false; }
    html += atom.html;
  }
  return open ? `${html}</ul>` : html;
};

export const bodyTextPagesHtml = (parts: BodyPart[], showSignature = true): string[] => paginate(parts.flatMap((part) => atomsOf(part, showSignature))).map(renderAtoms);
