// Paginas da pre-visualizacao do PDF no computador. Seguem o documento do servidor (GET /api/proposals/:id/document, o mesmo do
// celular): capa, quadro de identificacao, corpo montado ou o texto padrao (Prezados Senhores e Apresentacao), planilha de itens,
// condicoes, fechamento e aviso de validade. As opcoes sao as mesmas do celular (public/m/pdf-corpo.js) e vao na mesma query.
// So leva precos de venda. Custo, BDI e margem nunca entram, com ou sem a permissao p10.
import type { AppSettings, ProposalDetail, ProposalExportOptions } from '../shared/contracts';
import { resolveBodyParts, type BodyPart } from '../shared/proposalBody';
import { commercialLaborTotal, escapeHtml, groupItemsByCategory, proposalFileBaseName } from '../documents/proposalDocumentCommon';
import { proposalPresentation } from '../documents/proposalPresentation';
import { CONSTRUTEC_LOGO_SMALL_BASE64 } from '../assets/previewImagesBase64';
import { bodyTextAtoms } from './proposalPdfBodyPages';
import { flowPages, type FlowAtom, type FlowWrap } from './proposalPdfFlow';

// Escolhas do documento, iguais no computador e no celular. marca: marca d'agua deste PDF; null vale o padrao da empresa.
// obs: observacoes das condicoes e as notas deste documento (notas); mao: a linha da mao de obra.
export type PdfChoices = {
  capa: boolean; condicoes: boolean; obs: boolean; notas: string; validade: boolean; mao: boolean;
  agrupar: boolean; codigos: boolean; marca: boolean | null;
};
export type PdfPage = { label: 'Capa' | 'Itens' | 'Condições' | 'Texto'; html: string };

export const PDF_NOTES_MAX = 1000;

// Proposta com carta de abertura ja comeca no texto da carta: a capa fica desligada ate a pessoa ligar.
export const defaultPdfChoices = (proposal?: ProposalDetail): PdfChoices => ({
  capa: !proposal?.bodyBlocks?.some((block) => block.type === 'carta' && block.enabled),
  condicoes: true, obs: true, notas: '', validade: true, mao: true, agrupar: false, codigos: false, marca: null,
});

// Logo esmaecida ao fundo da pagina de pre-visualizacao (o PDF real usa .watermark do documento do servidor).
export const watermarkOverlayHtml = () => `<div style="position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.1;background:url(data:image/png;base64,${CONSTRUTEC_LOGO_SMALL_BASE64}) center / 78% auto no-repeat"></div>`;

export const PDF_PAGE_WIDTH = 396;
export const PDF_PAGE_HEIGHT = 560;
export const ROWS_PER_PAGE = 14;
// Descricao longa quebra em varias linhas: cada linha extra conta como uma linha da pagina.
const CHARS_PER_LINE = 34;
const LAST_PAGE_RESERVE = 3;
export const rowWeight = (description: string) => Math.max(1, Math.ceil(description.length / CHARS_PER_LINE));

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numberFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const formatIsoDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '');
export const revLabel = (revision: number) => `REV ${String(revision || 0).padStart(2, '0')}`;

// Venda da mao de obra como uma linha so (como no PDF do servidor). Sem p10 o servidor zera custo e BDI;
// ai vale o que sobra do valor final depois dos itens.
export const laborSale = (proposal: ProposalDetail) => {
  if (!(proposal.laborItems ?? []).length) return 0;
  const direct = commercialLaborTotal(proposal);
  if (direct > 0) return direct;
  const itemsSale = proposal.items.reduce((sum, item) => sum + (item.totalSale || 0), 0);
  const final = proposal.totals.finalValue ?? 0;
  return Math.max(0, cents(final - itemsSale));
};

export const hasPdfContent = (proposal: ProposalDetail) => proposal.items.length > 0 || laborSale(proposal) > 0;

// Validade so conta se a proposta tem data.
export const effectiveChoices = (choices: PdfChoices, proposal: ProposalDetail): PdfChoices => ({ ...choices, validade: choices.validade && Boolean(proposal.validUntil) });

const flag = (value: boolean) => (value ? 1 : 0);
const cleanNotes = (choices: PdfChoices) => (choices.obs ? choices.notas.trim().slice(0, PDF_NOTES_MAX) : '');

// Parametros do documento do servidor (HTML e Word), iguais aos do celular (OC.docQuery). marca so vai quando a pessoa mudou.
export const pdfQuery = (choices: PdfChoices) => [
  `modelo=${choices.obs ? 'completo' : 'resumido'}`, `capa=${flag(choices.capa)}`, `condicoes=${flag(choices.condicoes)}`, `validade=${flag(choices.validade)}`,
  `agrupar=${flag(choices.agrupar)}`, `codigos=${flag(choices.codigos)}`, `mao=${flag(choices.mao)}`, `observacoes=${flag(choices.obs)}`,
  ...(choices.marca === null ? [] : [`marca=${flag(choices.marca)}`]),
  ...(cleanNotes(choices) ? [`notas=${encodeURIComponent(cleanNotes(choices))}`] : []),
].join('&');

// As mesmas escolhas no formato do gerador oficial (proposalPresentation / buildProposalHtml).
export const pdfExportOptions = (choices: PdfChoices): ProposalExportOptions => ({
  groupByCategory: choices.agrupar, showProductCodes: choices.codigos, includeLabor: choices.mao, includeCommercialTerms: choices.condicoes,
  includeNotes: choices.obs, ...(cleanNotes(choices) ? { customNotes: cleanNotes(choices) } : {}), ...(choices.marca === null ? {} : { watermark: choices.marca }),
});

export const pdfFileName = (proposal: ProposalDetail) => proposalFileBaseName(proposal);

export type PdfBranding = Partial<Pick<AppSettings, 'pdfShowLogo' | 'pdfShowSignature' | 'pdfWatermark' | 'tradeName' | 'companyName' | 'address' | 'phone' | 'email' | 'document'>>;

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

// Planilha de itens com o cabecalho do documento; continua com o cabecalho na pagina seguinte.
const ITEMS_WRAP: FlowWrap = { open: '<table class="pd-items"><thead><tr><th>Item</th><th>Descrição</th><th>Qtd.</th><th>Unit.</th><th>Total</th></tr></thead><tbody>', close: '</tbody></table>' };
const LEGACY_LEAD = 'Prezados Senhores,\nApresentamos nossa proposta técnica e comercial para fornecimento de equipamentos, materiais e execução dos serviços descritos a seguir.';

export const buildPdfPages = (proposal: ProposalDetail, rawChoices: PdfChoices, branding?: PdfBranding): PdfPage[] => {
  const showSignature = branding?.pdfShowSignature ?? true;
  const choices = effectiveChoices(rawChoices, proposal);
  const content = proposalPresentation(proposal, branding as AppSettings | undefined, pdfExportOptions(choices));
  const total = proposal.totals.finalValue ?? 0;
  const ref = `${proposal.number} • Revisão ${String(proposal.revision).padStart(2, '0')}`;
  const validUntil = formatIsoDate(proposal.validUntil);
  const labor = choices.mao ? laborSale(proposal) : 0;
  const text = (value: string) => escapeHtml(value).replace(/\n/g, '<br>');
  // Cabecalho com o nome da marca em texto, como no timbrado do documento e na previa do celular.
  const brand = `<b>${escapeHtml(content.brand)}</b>`;
  const block = (label: PdfPage['label'], html: string, group?: string): FlowAtom => ({ kind: 'block', label, html: `<div class="pd-piece">${html}</div>`, ...(group ? { group } : {}) });

  // Planilha: titulo, legenda, linhas, totais e a faixa do valor total formam um bloco so (como o pricing-block do documento).
  const pricing = (title: string, caption = ''): FlowAtom[] => {
    let n = 0;
    const row = (item: { description: string; code?: string | null; quantity: number; unit: string; unitSale: number; totalSale: number }): FlowAtom => ({
      kind: 'tr', label: 'Itens', wrap: ITEMS_WRAP,
      html: `<tr><td>${++n}</td><td>${escapeHtml(item.description)}${choices.codigos && item.code ? `<small>${escapeHtml(item.code)}</small>` : ''}</td><td>${escapeHtml(numberFmt.format(item.quantity))} ${escapeHtml(item.unit)}</td><td>${escapeHtml(brl.format(item.unitSale))}</td><td>${escapeHtml(brl.format(item.totalSale))}</td></tr>`,
    });
    const cat = (name: string): FlowAtom => ({ kind: 'tr', label: 'Itens', wrap: ITEMS_WRAP, html: `<tr class="pg-cat"><td colspan="5">${escapeHtml(name)}</td></tr>` });
    const rows: FlowAtom[] = [];
    if (choices.agrupar) groupItemsByCategory(proposal).forEach(([name, list]) => { rows.push(cat(name)); list.forEach((item) => rows.push(row(item))); });
    else proposal.items.forEach((item) => rows.push(row(item)));
    if (labor > 0) {
      if (choices.agrupar) rows.push(cat('Mão de Obra e Serviços Técnicos'));
      rows.push(row({ description: 'Mão de obra', unit: 'vb', quantity: 1, unitSale: labor, totalSale: labor }));
    }
    if (!rows.length) rows.push({ kind: 'tr', label: 'Itens', wrap: ITEMS_WRAP, html: '<tr><td colspan="5" class="pd-muted">Nenhum item incluído nesta revisão.</td></tr>' });
    const sums = content.summary.slice(0, -1).map(([label, value]) => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('');
    const heading: FlowAtom = { kind: 'h', label: 'Itens', html: `<h2 class="pd-h">${escapeHtml(title)}</h2>${caption ? `<div class="pd-cap">${escapeHtml(caption)}</div>` : ''}` };
    return [
      heading,
      ...rows,
      block('Itens', `<div class="pd-sum">${sums}<div class="pg-total"><small>Valor total da proposta</small><b>${escapeHtml(brl.format(total))}</b></div></div>`),
    ].map((atom) => ({ ...atom, group: 'planilha' }));
  };
  // Condicoes: as clausulas do documento (forma de pagamento, validade, prazo, garantia e observacoes com as notas deste documento).
  const conditions = (title: string): FlowAtom[] => (content.terms.length ? [
    { kind: 'h', label: 'Condições', html: `<h2 class="pd-h">${escapeHtml(title)}</h2>` },
    block('Condições', `<dl class="pg-terms">${content.terms.map(([dt, dd]) => `<dt>${escapeHtml(dt)}</dt><dd>${text(dd)}</dd>`).join('')}</dl><p class="pd-p">Valores expressos em moeda corrente nacional (BRL).</p>`),
  ] : []);

  const bodyParts = proposal.bodyBlocks ? resolveBodyParts(proposal, proposal.bodyBlocks) : null;
  const letter = Boolean(bodyParts?.some((part) => part.kind === 'carta'));
  const flow: FlowAtom[] = [];
  // Sem carta: quadro de identificacao na primeira pagina (como o timbrado do documento); com carta, cabecalho em todas as paginas.
  if (!letter) {
    flow.push(block('Texto', `<div class="pg-head">${brand}<span>Proposta comercial · ${escapeHtml(ref)}</span></div>
      <div class="pd-id"><span><b>Cliente:</b> ${escapeHtml(proposal.clientName)}</span><span><b>Local / Obra:</b> ${escapeHtml(proposal.workName || '—')}</span><span><b>Referência:</b> ${escapeHtml(proposal.number)} | Rev. ${String(proposal.revision).padStart(2, '0')}</span></div>
      <div class="pg-title pd-center">Proposta técnica comercial</div>`));
  }
  let pending: BodyPart[] = [];
  const flushText = (endsDocument = false) => { flow.push(...bodyTextAtoms(pending, showSignature, endsDocument)); pending = []; };
  if (!bodyParts) {
    // Texto padrao do documento sem corpo montado: abertura e apresentacao da empresa antes da planilha.
    flow.push(block('Texto', `<p class="pd-p pd-lead">${text(LEGACY_LEAD)}</p>`));
    flow.push({ kind: 'h', label: 'Texto', html: `<h2 class="pd-h">Apresentação — ${escapeHtml(content.brand)}</h2>` });
    flow.push(block('Texto', `<p class="pd-p">${escapeHtml(content.presentation)}</p>`));
    flow.push(...pricing('1. Composição e Precificação'));
    flow.push(...conditions('2. Condições Comerciais'));
  } else {
    for (const part of bodyParts) {
      if (part.kind === 'itens') { flushText(); flow.push(...pricing(part.title, part.caption)); }
      else if (part.kind === 'condicoes') { flushText(); flow.push(...conditions(part.title)); }
      else pending.push(part);
    }
    flushText(true);
  }
  // Fechamento padrao do documento quando o corpo nao tem um.
  if (!bodyParts?.some((part) => part.kind === 'fechamento')) {
    const signature = showSignature ? `<div class="pd-sign pg-sign"><i></i><b>${escapeHtml(proposal.responsibleName || content.brand)}</b><span>${escapeHtml(content.company)}</span></div>` : '';
    flow.push(block('Texto', `<p class="pd-p pd-close">Permanecemos à disposição para quaisquer esclarecimentos técnicos ou comerciais referentes a esta proposta.</p>${signature}`, 'fim'));
  }
  if (choices.validade) flow.push(block('Texto', `<p class="pg-note">Proposta válida até ${escapeHtml(validUntil)}. Depois disso, os preços dos equipamentos podem mudar.</p>`, 'fim'));

  const pages: PdfPage[] = [];
  if (choices.capa) {
    pages.push({
      label: 'Capa',
      html: `<div class="pg-cover"><small>Proposta comercial</small><b class="pg-h1">${escapeHtml(proposal.workName || proposal.clientName || '')}</b><span>${escapeHtml(proposal.clientName || '')}</span>
        <dl><dt>Proposta</dt><dd>${escapeHtml(`${proposal.number} · ${revLabel(proposal.revision)}`)}</dd>
        ${choices.validade ? `<dt>Válida até</dt><dd>${escapeHtml(validUntil)}</dd>` : ''}
        ${proposal.responsibleName ? `<dt>Responsável</dt><dd>${escapeHtml(proposal.responsibleName)}</dd>` : ''}<dt>Valor total</dt><dd><b>${escapeHtml(brl.format(total))}</b></dd></dl></div>`,
    });
  }
  pages.push(...flowPages(flow, letter ? `<div class="pg-head">${brand}<span>${escapeHtml(ref)}</span></div>` : ''));
  return pages.map((page, index) => ({ ...page, html: `<div class="pg">${page.html}<div class="pg-foot"><span>${escapeHtml(content.company)}</span><span>Pág. ${index + 1} / ${pages.length}</span></div></div>` }));
};

export const pdfDefaultMessage = (proposal: ProposalDetail) =>
  `Olá! Segue a proposta ${proposal.number} (${revLabel(proposal.revision)}) da Construtec para ${proposal.workName || proposal.clientName}, no valor de ${brl.format(proposal.totals.finalValue ?? 0)}${proposal.validUntil ? `, válida até ${formatIsoDate(proposal.validUntil)}` : ''}.`;
