// Fluxo continuo da pre-visualizacao do PDF: titulos, textos, tabela de itens e condicoes entram em sequencia e
// cada pagina e preenchida ate o fim antes de abrir a proxima (sem pagina pela metade). No navegador a altura de
// cada pedaco e medida de verdade num quadro escondido com o mesmo CSS; fora dele (testes) vale uma estimativa.
import type { PdfPage } from './proposalPdfPages';

// group: pedacos do mesmo grupo (ex.: a planilha inteira) ficam na mesma pagina quando cabem; se nao cabem, fluem normalmente.
// wrap: tabela propria das linhas (ex.: a planilha de itens com cabecalho); o cabecalho se repete em cada pagina onde a tabela continua,
// como no documento do servidor e na previa do celular.
export type FlowWrap = { open: string; close: string };
export type FlowAtom = { kind: 'h' | 'p' | 'li' | 'tr' | 'block'; label: PdfPage['label']; html: string; group?: string; wrap?: FlowWrap };

const TABLE_WRAP: FlowWrap = { open: '<table class="pg-tab"><tbody>', close: '</tbody></table>' };
const wrapOf = (atom: FlowAtom) => atom.wrap ?? TABLE_WRAP;

export const FLOW_PAGE_HEIGHT = 560;
const PAGE_PAD_TOP = 22;
const PAGE_PAD_BOTTOM = 40;
const SAFETY = 6;

let flowCss = '';
// O CSS das paginas (arquivo ?raw) e entregue pela tela; sem ele nao ha medicao real.
export const setPdfFlowCss = (css: string) => { flowCss = css; };

const wrap = (atom: FlowAtom) => (atom.kind === 'tr' ? `${wrapOf(atom).open}${atom.html}${wrapOf(atom).close}` : atom.kind === 'li' ? `<ul class="pd-ul">${atom.html}</ul>` : atom.html);

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
// tableHeads: altura do cabecalho de cada tabela de linhas (o que a tabela ocupa vazia), somada quando ela comeca numa pagina.
const measure = (atoms: FlowAtom[], headHtml: string): { heights: number[]; head: number; tableHeads: Map<string, number> } => {
  const opens = [...new Set(atoms.filter((atom) => atom.kind === 'tr').map((atom) => wrapOf(atom)))];
  const doc = measureFrame();
  const host = doc?.getElementById('m');
  const win = doc?.defaultView;
  if (!doc || !host || !win) {
    return { heights: atoms.map(estimate), head: headHtml ? 50 : 0, tableHeads: new Map(opens.map((w) => [w.open, /<thead/.test(w.open) ? 16 : 0])) };
  }
  const tableHeads = new Map(opens.map((w): [string, number] => {
    host.innerHTML = `${w.open}${w.close}`;
    const table = host.firstElementChild;
    return [w.open, table ? Math.ceil(boxHeight(table, win)) : 0];
  }));
  const heights = atoms.map((atom) => {
    host.innerHTML = wrap(atom);
    const target = atom.kind === 'li' ? host.querySelector('li') : atom.kind === 'tr' ? host.querySelector('tbody')?.lastElementChild : host.firstElementChild;
    return target ? Math.ceil(boxHeight(target, win)) : estimate(atom);
  });
  host.innerHTML = headHtml;
  let head = 0;
  for (const child of Array.from(host.children)) head += boxHeight(child, win);
  return { heights, head: Math.ceil(head), tableHeads };
};

const renderAtoms = (atoms: FlowAtom[]) => {
  let html = '';
  let open: FlowWrap | 'ul' | null = null;
  const close = () => { if (open === 'ul') html += '</ul>'; else if (open) html += open.close; open = null; };
  for (const atom of atoms) {
    const want = atom.kind === 'li' ? 'ul' : atom.kind === 'tr' ? wrapOf(atom) : null;
    if (want !== open) { close(); if (want === 'ul') html += '<ul class="pd-ul">'; else if (want) html += want.open; open = want; }
    html += atom.html;
  }
  close();
  return html;
};

// Linha que abre uma tabela na pagina (pagina nova, ou o pedaco anterior nao e linha da mesma tabela) leva o cabecalho junto.
const opensTable = (atom: FlowAtom, previous: FlowAtom | undefined) => atom.kind === 'tr' && !(previous?.kind === 'tr' && wrapOf(previous) === wrapOf(atom));

// Empacota em paginas: titulo nunca fica sozinho no fim; a primeira linha de cada pagina e sempre aceita.
export const flowPages = (atoms: FlowAtom[], headHtml: string): Array<{ label: PdfPage['label']; html: string }> => {
  if (atoms.length === 0) return [];
  const { heights, head, tableHeads } = measure(atoms, headHtml);
  const capacity = FLOW_PAGE_HEIGHT - PAGE_PAD_TOP - PAGE_PAD_BOTTOM - head - SAFETY;
  const pages: FlowAtom[][] = [];
  let current: FlowAtom[] = [];
  let used = 0;
  let index = 0;
  const cost = (at: number, previous: FlowAtom | undefined) => heights[at] + (opensTable(atoms[at], previous) ? tableHeads.get(wrapOf(atoms[at]).open) ?? 0 : 0);
  const span = (from: number, to: number, previous: FlowAtom | undefined) => {
    let total = 0;
    for (let at = from; at <= to; at += 1) total += cost(at, at === from ? previous : atoms[at - 1]);
    return total;
  };
  while (index < atoms.length) {
    const atom = atoms[index];
    if (atom.group) {
      let end = index;
      while (end + 1 < atoms.length && atoms[end + 1].group === atom.group) end += 1;
      if (span(index, end, undefined) <= capacity) {
        if (current.length && used + span(index, end, current[current.length - 1]) > capacity) { pages.push(current); current = []; used = 0; }
        used += span(index, end, current[current.length - 1]);
        current.push(...atoms.slice(index, end + 1));
        index = end + 1;
        continue;
      }
    }
    if (current.length && used + cost(index, current[current.length - 1]) > capacity) {
      const orphan = current[current.length - 1].kind === 'h' ? current.pop() : undefined;
      pages.push(current);
      current = orphan ? [orphan] : [];
      used = orphan ? heights[atoms.indexOf(orphan)] : 0;
    }
    used += cost(index, current[current.length - 1]);
    current.push(atom);
    index += 1;
  }
  if (current.length) pages.push(current);
  // Rotulo da pagina, a mesma regra do celular (pdf-corpo.js): Itens se tem a planilha de itens, senao Condicoes, senao Texto.
  const labelOf = (page: FlowAtom[]): PdfPage['label'] => (page.some((atom) => atom.label === 'Itens') ? 'Itens' : page.some((atom) => atom.label === 'Condições') ? 'Condições' : 'Texto');
  return pages.map((page) => ({ label: labelOf(page), html: `${headHtml}${renderAtoms(page)}` }));
};
