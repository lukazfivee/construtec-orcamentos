// Fluxo continuo da pre-visualizacao do PDF: titulos, textos, tabela de itens e condicoes entram em sequencia e
// cada pagina e preenchida ate o fim antes de abrir a proxima (sem pagina pela metade). No navegador a altura de
// cada pedaco e medida de verdade num quadro escondido com o mesmo CSS; fora dele (testes) vale uma estimativa.
import type { PdfPage } from './proposalPdfPages';

export type FlowAtom = { kind: 'h' | 'p' | 'li' | 'tr' | 'block'; label: PdfPage['label']; html: string };

export const FLOW_PAGE_HEIGHT = 560;
const PAGE_PAD_TOP = 22;
const PAGE_PAD_BOTTOM = 40;
const SAFETY = 6;

let flowCss = '';
// O CSS das paginas (arquivo ?raw) e entregue pela tela; sem ele nao ha medicao real.
export const setPdfFlowCss = (css: string) => { flowCss = css; };

const wrap = (atom: FlowAtom) => (atom.kind === 'tr' ? `<table class="pg-tab"><tbody>${atom.html}</tbody></table>` : atom.kind === 'li' ? `<ul class="pg-ul">${atom.html}</ul>` : atom.html);

// Estimativa (sem navegador): Arial 10px/1,5 em 352 px.
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, 'x').replace(/\s+/g, ' ').trim();
const estimate = (atom: FlowAtom): number => {
  const lines = Math.max(1, Math.ceil(textOf(atom.html).length / 66));
  if (atom.kind === 'h') return 30;
  if (atom.kind === 'li') return lines * 15 + 2;
  if (atom.kind === 'tr') return Math.max(1, Math.ceil(textOf(atom.html).length / 40)) * 14 + 9;
  return lines * 15 + 8;
};

let frame: HTMLIFrameElement | null = null;
const measureFrame = (): Document | null => {
  if (typeof document === 'undefined' || !flowCss) return null;
  try {
    if (!frame || !frame.isConnected) {
      frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:396px;height:560px;border:0;visibility:hidden;pointer-events:none';
      document.body.appendChild(frame);
    }
    const doc = frame.contentDocument;
    if (!doc) return null;
    doc.open();
    doc.write(`<!doctype html><meta charset="utf-8"><style>${flowCss}</style><div class="pg" id="m" style="height:auto;overflow:visible;padding-bottom:0"></div>`);
    doc.close();
    return doc;
  } catch { return null; }
};

const boxHeight = (element: Element, win: Window) => {
  const style = win.getComputedStyle(element);
  return element.getBoundingClientRect().height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
};

// Altura de cada pedaco (e do cabecalho da pagina) no mesmo CSS do PDF.
const measure = (atoms: FlowAtom[], headHtml: string): { heights: number[]; head: number } => {
  const doc = measureFrame();
  const host = doc?.getElementById('m');
  const win = doc?.defaultView;
  if (!doc || !host || !win) return { heights: atoms.map(estimate), head: 50 };
  const heights = atoms.map((atom) => {
    host.innerHTML = wrap(atom);
    const target = atom.kind === 'li' ? host.querySelector('li') : host.firstElementChild;
    return target ? Math.ceil(boxHeight(target, win)) : estimate(atom);
  });
  host.innerHTML = headHtml;
  let head = 0;
  for (const child of Array.from(host.children)) head += boxHeight(child, win);
  return { heights, head: Math.ceil(head) };
};

const renderAtoms = (atoms: FlowAtom[]) => {
  let html = '';
  let open: 'ul' | 'table' | null = null;
  const close = () => { if (open === 'ul') html += '</ul>'; if (open === 'table') html += '</tbody></table>'; open = null; };
  for (const atom of atoms) {
    const want = atom.kind === 'li' ? 'ul' : atom.kind === 'tr' ? 'table' : null;
    if (want !== open) { close(); if (want === 'ul') html += '<ul class="pg-ul">'; if (want === 'table') html += '<table class="pg-tab"><tbody>'; open = want; }
    html += atom.html;
  }
  close();
  return html;
};

// Empacota em paginas: titulo nunca fica sozinho no fim; a primeira linha de cada pagina e sempre aceita.
export const flowPages = (atoms: FlowAtom[], headHtml: string): Array<{ label: PdfPage['label']; html: string }> => {
  if (atoms.length === 0) return [];
  const { heights, head } = measure(atoms, headHtml);
  const capacity = FLOW_PAGE_HEIGHT - PAGE_PAD_TOP - PAGE_PAD_BOTTOM - head - SAFETY;
  const pages: FlowAtom[][] = [];
  let current: FlowAtom[] = [];
  let used = 0;
  atoms.forEach((atom, index) => {
    if (current.length && used + heights[index] > capacity) {
      const orphan = current[current.length - 1].kind === 'h' ? current.pop() : undefined;
      pages.push(current);
      current = orphan ? [orphan] : [];
      used = orphan ? heights[atoms.indexOf(orphan)] : 0;
    }
    current.push(atom);
    used += heights[index];
  });
  if (current.length) pages.push(current);
  // Rotulo da pagina: Itens se tem a tabela, senao Condicoes se tem as condicoes, senao o do primeiro pedaco.
  const labelOf = (page: FlowAtom[]): PdfPage['label'] => (page.some((atom) => atom.kind === 'tr') ? 'Itens' : page.some((atom) => atom.label === 'Condições') ? 'Condições' : page[0].label);
  return pages.map((page) => ({ label: labelOf(page), html: `${headHtml}${renderAtoms(page)}` }));
};
