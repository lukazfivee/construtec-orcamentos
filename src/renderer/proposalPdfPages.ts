// Paginas da pre-visualizacao do PDF (Rodada 23, telas 23m a 23p): capa, itens por sistema e condicoes.
// So leva precos de venda. Custo, BDI e margem nunca entram, com ou sem a permissao p10: o arquivo do cliente
// vem do servidor (GET /api/proposals/:id/document), que tambem nao os envia.
import type { AppSettings, ProposalDetail } from '../shared/contracts';
import { commercialLaborTotal, escapeHtml, parseCommercialConditions } from '../documents/proposalDocumentCommon';

export type PdfChoices = { modelo: 'completo' | 'resumido'; capa: boolean; condicoes: boolean; validade: boolean };
export type PdfPage = { label: 'Capa' | 'Itens' | 'Condições'; html: string };

export const defaultPdfChoices = (): PdfChoices => ({ modelo: 'completo', capa: true, condicoes: true, validade: true });

export const PDF_PAGE_WIDTH = 396;
export const PDF_PAGE_HEIGHT = 560;
export const ROWS_PER_PAGE = 14;
// Descricao longa quebra em varias linhas: cada linha extra conta como uma linha da pagina.
const CHARS_PER_LINE = 34;
const LAST_PAGE_RESERVE = 3;
export const rowWeight = (description: string) => Math.max(1, Math.ceil(description.length / CHARS_PER_LINE));

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numberFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const formatIsoDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '');
export const revLabel = (revision: number) => `REV ${String(revision || 0).padStart(2, '0')}`;

// Venda da mao de obra como uma linha so (como no PDF do servidor). Sem p10 o servidor zera custo e BDI;
// ai vale o que sobra do valor final sem impostos depois dos itens.
export const laborSale = (proposal: ProposalDetail) => {
  if (!(proposal.laborItems ?? []).length) return 0;
  const direct = commercialLaborTotal(proposal);
  if (direct > 0) return direct;
  const itemsSale = proposal.items.reduce((sum, item) => sum + (item.totalSale || 0), 0);
  const final = proposal.totals.finalValue ?? 0;
  return Math.max(0, cents(final / (1 + (proposal.taxPercentage ?? 0) / 100) - itemsSale));
};

export const hasPdfContent = (proposal: ProposalDetail) => proposal.items.length > 0 || laborSale(proposal) > 0;

// Validade so conta se a proposta tem data.
export const effectiveChoices = (choices: PdfChoices, proposal: ProposalDetail): PdfChoices => ({ ...choices, validade: choices.validade && Boolean(proposal.validUntil) });

export const pdfQuery = (choices: PdfChoices) =>
  `modelo=${choices.modelo}&capa=${choices.capa ? 1 : 0}&condicoes=${choices.condicoes ? 1 : 0}&validade=${choices.validade ? 1 : 0}`;

export const pdfFileName = (proposal: ProposalDetail) => `${proposal.number}-${revLabel(proposal.revision).replace(' ', '-')}`;

type Row = { weight: number } & ({ cat: string; sum: number } | { item: { description: string; quantity: number; unit: string; unitSale: number; totalSale: number } });

export type PdfBranding = Pick<AppSettings, 'pdfShowLogo' | 'pdfShowSignature'>;

// Quebra as linhas em paginas pelo peso (linhas visuais); a ultima pagina guarda espaco para o total e a validade.
export const paginateRows = <T extends { weight: number }>(rows: T[]): T[][] => {
  const pages: T[][] = [];
  let current: T[] = [];
  let used = 0;
  for (const row of rows) {
    if (current.length > 0 && used + row.weight > ROWS_PER_PAGE) { pages.push(current); current = []; used = 0; }
    current.push(row);
    used += row.weight;
  }
  if (current.length > 0) pages.push(current);
  const lastUsed = (pages[pages.length - 1] ?? []).reduce((sum, row) => sum + row.weight, 0);
  if (lastUsed + LAST_PAGE_RESERVE > ROWS_PER_PAGE && pages.length > 0 && pages[pages.length - 1].length > 1) {
    const last = pages[pages.length - 1];
    const moved = last.pop() as T;
    pages.push([moved]);
  }
  return pages;
};

export const buildPdfPages = (proposal: ProposalDetail, rawChoices: PdfChoices, branding?: PdfBranding): PdfPage[] => {
  const showLogo = branding?.pdfShowLogo ?? true;
  const showSignature = branding?.pdfShowSignature ?? true;
  const choices = effectiveChoices(rawChoices, proposal);
  const total = proposal.totals.finalValue ?? 0;
  const number = `${proposal.number} · ${revLabel(proposal.revision)}`;
  const validUntil = formatIsoDate(proposal.validUntil);
  const head = (title: string) => `<div class="pg-head"><b>CONSTRUTEC</b><span>${escapeHtml(number)}</span></div><div class="pg-title">${escapeHtml(title)}</div>`;
  const foot = (n: number) => `<div class="pg-foot"><span>Construtec Engenharia · Sistemas especiais</span><span>Página ${n}</span></div>`;
  const labor = laborSale(proposal);
  const systems = [...new Set(proposal.items.map((item) => item.category || 'Itens'))];
  if (labor > 0) systems.push('Mão de obra e serviços técnicos');
  const pages: PdfPage[] = [];

  if (choices.capa) {
    pages.push({
      label: 'Capa',
      html: `<div class="pg-cover">${showLogo ? '<b class="pg-logo">CONSTRUTEC</b>' : ''}<small>Proposta comercial</small><b class="pg-h1">${escapeHtml(proposal.workName || proposal.clientName)}</b><span>${escapeHtml(proposal.clientName)}</span>
        <dl><dt>Proposta</dt><dd>${escapeHtml(number)}</dd>
        ${choices.validade ? `<dt>Válida até</dt><dd>${escapeHtml(validUntil)}</dd>` : ''}
        <dt>Responsável</dt><dd>${escapeHtml(proposal.responsibleName || '')}</dd><dt>Sistemas</dt><dd>${escapeHtml(systems.join(', '))}</dd></dl>
        <div class="pg-total"><small>Valor total</small><b>${escapeHtml(brl.format(total))}</b></div></div>`,
    });
  }

  const rows: Row[] = [];
  systems.forEach((system, index) => {
    const isLabor = labor > 0 && index === systems.length - 1;
    const list = isLabor
      ? [{ description: 'Serviços técnicos e operacionais conforme escopo da proposta.', quantity: 1, unit: 'vb', unitSale: labor, totalSale: labor }]
      : proposal.items.filter((item) => (item.category || 'Itens') === system);
    rows.push({ weight: 1, cat: system, sum: list.reduce((sum, item) => sum + (item.totalSale || 0), 0) });
    if (choices.modelo === 'completo') list.forEach((item) => rows.push({ weight: rowWeight(item.description), item }));
  });
  const completo = choices.modelo === 'completo';
  const chunks = paginateRows(rows);
  chunks.forEach((chunk, chunkIndex) => {
    const last = chunkIndex === chunks.length - 1;
    const body = chunk.map((row) => ('cat' in row
      ? `<tr class="pg-cat"><td colspan="${completo ? 3 : 1}">${escapeHtml(row.cat)}</td><td>${completo ? '' : escapeHtml(brl.format(row.sum))}</td></tr>`
      : `<tr><td>${escapeHtml(row.item.description)}</td><td>${escapeHtml(numberFmt.format(row.item.quantity))} ${escapeHtml(row.item.unit)}</td><td>${escapeHtml(brl.format(row.item.unitSale))}</td><td>${escapeHtml(brl.format(row.item.totalSale))}</td></tr>`)).join('');
    pages.push({
      label: 'Itens',
      html: `${head(completo ? 'Itens da proposta' : 'Resumo por sistema')}<table class="pg-tab"><tbody>${body}</tbody></table>
        ${last ? `<div class="pg-total"><small>Valor total da proposta · impostos inclusos</small><b>${escapeHtml(brl.format(total))}</b></div>${choices.validade ? `<p class="pg-note">Proposta válida até ${escapeHtml(validUntil)}.</p>` : ''}` : ''}`,
    });
  });

  if (choices.condicoes) {
    const terms = parseCommercialConditions(proposal.scope);
    pages.push({
      label: 'Condições',
      html: `${head('Condições comerciais')}
        <dl class="pg-terms"><dt>Pagamento</dt><dd>${escapeHtml(terms.paymentTerms || 'Conforme combinado com o cliente')}</dd><dt>Prazo</dt><dd>${escapeHtml(terms.executionTerm || 'A combinar após o aceite')}</dd><dt>Garantia</dt><dd>${escapeHtml(terms.warranty || 'Conforme normas técnicas aplicáveis')}</dd></dl>
        ${choices.validade ? `<p class="pg-note"><b>Validade:</b> esta proposta vale até ${escapeHtml(validUntil)}. Depois disso, os preços dos equipamentos podem mudar.</p>` : ''}
        ${showSignature ? `<p class="pg-sign">${escapeHtml(proposal.responsibleName || '')}<br>Construtec Engenharia</p>` : ''}`,
    });
  }
  return pages.map((page, index) => ({ ...page, html: `<div class="pg">${page.html}${foot(index + 1)}</div>` }));
};

export const pdfDefaultMessage = (proposal: ProposalDetail) =>
  `Olá! Segue a proposta ${proposal.number} (${revLabel(proposal.revision)}) da Construtec para ${proposal.workName || proposal.clientName}, no valor de ${brl.format(proposal.totals.finalValue ?? 0)}${proposal.validUntil ? `, válida até ${formatIsoDate(proposal.validUntil)}` : ''}.`;
