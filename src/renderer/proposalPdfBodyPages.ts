// Texto do corpo montado da proposta na pre-visualizacao do PDF, quebrado em pedacos (a quebra em paginas e do fluxo).
// Mesma marcacao e mesmas classes da previa do celular (public/m/pdf-corpo.js) e do documento do servidor (proposalBodyHtml):
// titulos pd-h, paragrafos pd-p, listas pd-ul, planilha propria pd-tab com o cabecalho repetido em cada pagina, carta pd-letter
// e o fechamento com a linha de assinatura, o cargo e a empresa.
import type { BodyPart } from '../shared/proposalBody';
import { escapeHtml } from '../documents/proposalDocumentCommon';
import { closingGroupStart } from '../documents/proposalClosingEnd';
import type { FlowAtom, FlowWrap } from './proposalPdfFlow';

export const TEXT_CHARS_PER_LINE = 60;
// Pedacos de ate ~8 linhas: um paragrafo longo continua na pagina seguinte em vez de deixar um vazio no fim da anterior.
export const TEXT_CHUNK_LINES = 8;

export type BodyTextContext = { showSignature: boolean; brand: string; company: string };

type Atom = { kind: 'h' | 'p' | 'li' | 'tr'; html: string; wrap?: FlowWrap };

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

// Planilha propria: uma linha por pedaco, dentro da tabela com o cabecalho; a tabela continua na pagina seguinte com o cabecalho
// de novo, como no celular e no PDF impresso (thead repete em cada pagina).
const gridAtoms = (part: GridPart): Atom[] => {
  const cell = (tag: 'th' | 'td', value: string, column: number) => `<${tag}${part.align[column] === 'right' ? ' class="r"' : ''}>${escapeHtml(value)}</${tag}>`;
  const head = part.headers.some(Boolean) ? `<thead><tr>${part.headers.map((header, column) => cell('th', header, column)).join('')}</tr></thead>` : '';
  const wrap: FlowWrap = { open: `<table class="pd-tab">${head}<tbody>`, close: '</tbody></table>' };
  return part.rows.map((row) => ({ kind: 'tr' as const, wrap, html: `<tr>${row.map((value, column) => cell('td', value, column)).join('')}</tr>` }));
};

const atomsOf = (part: BodyPart, context: BodyTextContext): Atom[] => {
  if (part.kind === 'planilha') return gridAtoms(part);
  if (part.kind === 'heading') return [{ kind: 'h', html: part.sub ? `<h3 class="pd-h sub">${escapeHtml(part.text)}</h3>` : `<h2 class="pd-h">${escapeHtml(part.text)}</h2>` }];
  if (part.kind === 'carta') {
    const att = [part.attention, part.department].filter(Boolean);
    const html = `<div class="pd-letter">${part.dateLine ? `<p>${escapeHtml(part.dateLine)}</p>` : ''}${part.recipient ? `<p class="pd-rec">${escapeHtml(part.recipient)}</p>` : ''}${att.length ? `<p class="pd-att"><b>At.:</b><span>${att.map(escapeHtml).join('<br>')}</span></p>` : ''}${part.reference ? `<p class="pd-ref">REF.: ${escapeHtml(part.reference)}</p>` : ''}<h1>${escapeHtml(part.title)}</h1>${part.greeting ? `<p>${escapeHtml(part.greeting)}</p>` : ''}${part.intro ? `<p class="pd-p">${escapeHtml(part.intro)}</p>` : ''}</div>`;
    return [{ kind: 'p', html }];
  }
  if (part.kind === 'fechamento') {
    const text = part.paragraphs.map((lines) => `<p class="pd-p">${lines.map(escapeHtml).join('<br>')}</p>`).join('');
    const sign = context.showSignature ? `<div class="pd-sign"><i></i><b>${escapeHtml(part.signer || context.brand)}</b>${part.role ? `<span>${escapeHtml(part.role)}</span>` : ''}<span>${escapeHtml(context.company)}</span></div>` : '';
    return [{ kind: 'p', html: text + sign }];
  }
  if (part.kind === 'list') {
    return part.items.flatMap(fitPieces).map((item) => ({ kind: 'li' as const, html: `<li>${escapeHtml(item)}</li>` }));
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
  return chunks.map((chunk, index) => ({ kind: 'p' as const, html: `<p class="pd-p${index > 0 ? ' pd-cont' : ''}">${chunk.map(escapeHtml).join('<br>')}</p>` }));
};

// Pedacos do texto do corpo para o fluxo continuo das paginas (titulo, paragrafo, item de lista, linha de planilha, carta e fechamento).
// Com o fechamento por ultimo no documento inteiro (endsDocument: este e o ultimo trecho de texto, como no PDF), a secao de texto antes dele (ex.: Validade) forma um grupo com ele: vao juntos para a mesma pagina.
export const bodyTextAtoms = (parts: BodyPart[], context: BodyTextContext, endsDocument = true): FlowAtom[] => {
  const start = endsDocument && parts[parts.length - 1]?.kind === 'fechamento' ? closingGroupStart(parts) : parts.length;
  return parts.flatMap((part, index) => atomsOf(part, context).map((atom): FlowAtom => ({
    kind: atom.kind, label: 'Texto', html: atom.html, ...(atom.wrap ? { wrap: atom.wrap } : {}), ...(index >= start ? { group: 'fechamento' } : {}),
  })));
};
