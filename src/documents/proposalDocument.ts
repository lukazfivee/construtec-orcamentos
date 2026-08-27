import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ProposalDetail } from '../shared/contracts';

const NAVY = '122036';
const BLUE = '085CE5';
const LIGHT_BLUE = 'EFF5FF';
const LINE = 'D9DEE7';
const MUTED = '697386';
const WHITE = 'FFFFFF';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const documentTitle = (proposal: ProposalDetail) =>
  `${proposal.number}-REV-${String(proposal.revision).padStart(2, '0')}`;

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const documentTotal = (proposal: ProposalDetail) => proposal.totals.finalValue ?? proposal.totals.sale;

const commercialLaborTotal = (proposal: ProposalDetail) => {
  const laborCost = proposal.totals.labor ?? 0;
  return laborCost > 0 ? roundMoney(laborCost * proposal.bdiMultiplier) : 0;
};

export const proposalFileBaseName = (proposal: ProposalDetail) =>
  `Proposta-${documentTitle(proposal)}`.replace(/[^a-zA-Z0-9._-]/g, '-');

export const buildProposalHtml = (proposal: ProposalDetail) => {
  const validUntil = proposal.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : 'A definir';
  const laborTotal = commercialLaborTotal(proposal);
  const total = documentTotal(proposal);
  const rows = proposal.items.map((item, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td><strong>${escapeHtml(item.code)}</strong><br><span>${escapeHtml(item.description)}</span></td>
      <td class="center">${escapeHtml(item.unit)}</td>
      <td class="number">${quantity.format(item.quantity)}</td>
      <td class="number">${money.format(item.unitSale)}</td>
      <td class="number strong">${money.format(item.totalSale)}</td>
    </tr>`).join('');
  const laborRow = laborTotal > 0 ? `
    <tr>
      <td class="center">${proposal.items.length + 1}</td>
      <td><strong>Mão de obra</strong><br><span>Serviços técnicos conforme escopo da proposta.</span></td>
      <td class="center">vb</td>
      <td class="number">1</td>
      <td class="number">${money.format(laborTotal)}</td>
      <td class="number strong">${money.format(laborTotal)}</td>
    </tr>` : '';
  const tableRows = rows + laborRow || '<tr><td colspan="6" class="center">Nenhum item incluído nesta revisão.</td></tr>';

  return `<!doctype html>
  <html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(documentTitle(proposal))}</title>
  <style>
    @page { size: A4; margin: 16mm 14mm 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; font: 10.5pt "Segoe UI", Arial, sans-serif; }
    header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 9mm; border-bottom: 2px solid #085ce5; }
    .brand { color: #122036; font-size: 20pt; font-weight: 800; letter-spacing: -.4px; }
    .brand span { color: #085ce5; }
    .tagline { margin-top: 2mm; color: #697386; font-size: 8.5pt; }
    .doc-id { text-align: right; }
    .doc-id b { display: block; color: #122036; font-size: 12pt; }
    .doc-id span { color: #697386; font-size: 8.5pt; }
    h1 { margin: 10mm 0 2mm; color: #122036; font-size: 21pt; line-height: 1.1; }
    .subtitle { margin: 0 0 8mm; color: #697386; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 9mm; }
    .meta div { padding: 4mm; background: #f7f8fa; border-left: 3px solid #085ce5; }
    .meta label { display: block; margin-bottom: 1.5mm; color: #697386; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
    .meta strong { color: #172033; font-size: 10.5pt; }
    h2 { margin: 8mm 0 3mm; color: #122036; font-size: 12pt; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead { display: table-header-group; }
    th { padding: 3mm 2mm; color: white; background: #122036; font-size: 7.5pt; text-align: left; text-transform: uppercase; letter-spacing: .25px; }
    td { padding: 3mm 2mm; border-bottom: 1px solid #d9dee7; vertical-align: middle; font-size: 8.5pt; overflow-wrap: anywhere; }
    td span { color: #4d596b; }
    .center { text-align: center; }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    .strong { font-weight: 700; }
    .total { display: flex; justify-content: flex-end; align-items: center; gap: 10mm; margin: 5mm 0 9mm auto; padding: 5mm; width: 78mm; color: white; background: #085ce5; }
    .total span { font-size: 9pt; font-weight: 600; }
    .total strong { font-size: 15pt; font-variant-numeric: tabular-nums; }
    .conditions { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
    .condition { padding: 4mm; border: 1px solid #d9dee7; }
    .condition b { display: block; margin-bottom: 1.5mm; color: #122036; }
    .note { margin-top: 7mm; color: #697386; font-size: 8pt; line-height: 1.5; }
    footer { position: fixed; right: 0; bottom: -11mm; left: 0; padding-top: 3mm; color: #697386; border-top: 1px solid #d9dee7; font-size: 7.5pt; text-align: center; }
  </style></head><body>
    <header><div><div class="brand">CONSTRUTEC <span>ENGENHARIA</span></div><div class="tagline">Soluções técnicas com segurança, qualidade e compromisso.</div></div><div class="doc-id"><b>${escapeHtml(proposal.number)}</b><span>Revisão ${String(proposal.revision).padStart(2, '0')}</span></div></header>
    <h1>Proposta Comercial</h1><p class="subtitle">Apresentamos nossa composição comercial para o escopo descrito abaixo.</p>
    <section class="meta"><div><label>Cliente</label><strong>${escapeHtml(proposal.clientName)}</strong></div><div><label>Obra</label><strong>${escapeHtml(proposal.workName)}</strong></div><div><label>Escopo</label><strong>${escapeHtml(proposal.scope)}</strong></div><div><label>Responsável</label><strong>${escapeHtml(proposal.responsibleName)}</strong></div></section>
    <h2>Composição da proposta</h2>
    <table><colgroup><col style="width:6%"><col style="width:42%"><col style="width:8%"><col style="width:10%"><col style="width:16%"><col style="width:18%"></colgroup><thead><tr><th class="center">Item</th><th>Descrição</th><th class="center">Un.</th><th class="number">Qtd.</th><th class="number">Valor unit.</th><th class="number">Valor total</th></tr></thead><tbody>${tableRows}</tbody></table>
    <div class="total"><span>VALOR TOTAL</span><strong>${money.format(total)}</strong></div>
    <h2>Condições comerciais</h2><section class="conditions"><div class="condition"><b>Validade da proposta</b>${validUntil}</div><div class="condition"><b>Valores</b>Expressos em reais (BRL).</div></section>
    <p class="note">Esta proposta corresponde à revisão ${String(proposal.revision).padStart(2, '0')} e foi emitida com os dados comerciais preservados nessa versão. Alterações de escopo ou quantitativos poderão exigir uma nova revisão.</p>
    <footer>Construtec Engenharia - ${escapeHtml(proposal.number)} - REV.${String(proposal.revision).padStart(2, '0')}</footer>
  </body></html>`;
};

const cell = (text: string, width: number, options: { bold?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType]; fill?: string; color?: string } = {}) => new TableCell({
  width: { size: width, type: WidthType.DXA },
  shading: options.fill ? { fill: options.fill, type: ShadingType.CLEAR } : undefined,
  margins: { top: 100, bottom: 100, left: 100, right: 100 },
  borders: {
    top: { style: BorderStyle.SINGLE, size: 1, color: LINE },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: LINE },
    left: { style: BorderStyle.SINGLE, size: 1, color: LINE },
    right: { style: BorderStyle.SINGLE, size: 1, color: LINE },
  },
  children: [new Paragraph({ alignment: options.align, children: [new TextRun({ text, bold: options.bold, color: options.color, size: 18, font: 'Arial' })] })],
});

export const buildProposalDocx = async (proposal: ProposalDetail) => {
  const validUntil = proposal.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : 'A definir';
  const laborTotal = commercialLaborTotal(proposal);
  const total = documentTotal(proposal);
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell('ITEM', 650, { bold: true, align: AlignmentType.CENTER, fill: NAVY, color: WHITE }),
      cell('DESCRIÇÃO', 3530, { bold: true, fill: NAVY, color: WHITE }),
      cell('UN.', 630, { bold: true, align: AlignmentType.CENTER, fill: NAVY, color: WHITE }),
      cell('QTD.', 810, { bold: true, align: AlignmentType.RIGHT, fill: NAVY, color: WHITE }),
      cell('VALOR UNIT.', 1370, { bold: true, align: AlignmentType.RIGHT, fill: NAVY, color: WHITE }),
      cell('VALOR TOTAL', 1510, { bold: true, align: AlignmentType.RIGHT, fill: NAVY, color: WHITE }),
    ],
  });
  const itemRows = proposal.items.map((item, index) => new TableRow({ children: [
    cell(String(index + 1), 650, { align: AlignmentType.CENTER }),
    cell(`${item.code}\n${item.description}`, 3530),
    cell(item.unit, 630, { align: AlignmentType.CENTER }),
    cell(quantity.format(item.quantity), 810, { align: AlignmentType.RIGHT }),
    cell(money.format(item.unitSale), 1370, { align: AlignmentType.RIGHT }),
    cell(money.format(item.totalSale), 1510, { bold: true, align: AlignmentType.RIGHT }),
  ] }));
  const laborRows = laborTotal > 0 ? [new TableRow({ children: [
    cell(String(proposal.items.length + 1), 650, { align: AlignmentType.CENTER }),
    cell('Mão de obra\nServiços técnicos conforme escopo da proposta.', 3530),
    cell('vb', 630, { align: AlignmentType.CENTER }),
    cell('1', 810, { align: AlignmentType.RIGHT }),
    cell(money.format(laborTotal), 1370, { align: AlignmentType.RIGHT }),
    cell(money.format(laborTotal), 1510, { bold: true, align: AlignmentType.RIGHT }),
  ] })] : [];

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 21, color: '172033' }, paragraph: { spacing: { after: 120, line: 276 } } } },
      paragraphStyles: [
        { id: 'ProposalTitle', name: 'Proposal Title', basedOn: 'Normal', run: { font: 'Arial', size: 42, bold: true, color: NAVY }, paragraph: { spacing: { before: 220, after: 80 } } },
        { id: 'ProposalHeading', name: 'Proposal Heading', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 25, bold: true, color: NAVY }, paragraph: { spacing: { before: 300, after: 100 }, keepNext: true } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, right: 800, bottom: 900, left: 800 } } },
      headers: { default: new Header({ children: [
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: BLUE, space: 8 } }, children: [
          new TextRun({ text: 'CONSTRUTEC ', bold: true, size: 30, color: NAVY, font: 'Arial' }),
          new TextRun({ text: 'ENGENHARIA', bold: true, size: 30, color: BLUE, font: 'Arial' }),
          new TextRun({ text: `                                      ${proposal.number} | REV.${String(proposal.revision).padStart(2, '0')}`, bold: true, size: 18, color: MUTED, font: 'Arial' }),
        ] }),
      ] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 5 } }, children: [new TextRun({ text: `Construtec Engenharia - ${proposal.number} - Página `, color: MUTED, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 })] })] }) },
      children: [
        new Paragraph({ style: 'ProposalTitle', text: 'Proposta Comercial' }),
        new Paragraph({ children: [new TextRun({ text: 'Apresentamos nossa composição comercial para o escopo descrito abaixo.', color: MUTED, size: 20 })] }),
        new Table({ width: { size: 8550, type: WidthType.DXA }, columnWidths: [4275, 4275], rows: [
          new TableRow({ children: [cell(`CLIENTE\n${proposal.clientName}`, 4275, { fill: LIGHT_BLUE }), cell(`OBRA\n${proposal.workName}`, 4275, { fill: LIGHT_BLUE })] }),
          new TableRow({ children: [cell(`ESCOPO\n${proposal.scope}`, 4275, { fill: LIGHT_BLUE }), cell(`RESPONSÁVEL\n${proposal.responsibleName}`, 4275, { fill: LIGHT_BLUE })] }),
        ] }),
        new Paragraph({ style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: 'Composição da proposta' }),
        new Table({ width: { size: 8500, type: WidthType.DXA }, columnWidths: [650, 3530, 630, 810, 1370, 1510], rows: [headerRow, ...itemRows, ...laborRows] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 220, after: 260 }, shading: { fill: BLUE, type: ShadingType.CLEAR }, children: [new TextRun({ text: `VALOR TOTAL   ${money.format(total)}`, bold: true, color: WHITE, size: 28, font: 'Arial' })] }),
        new Paragraph({ style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: 'Condições comerciais' }),
        new Paragraph({ children: [new TextRun({ text: 'Validade da proposta: ', bold: true }), new TextRun(validUntil)] }),
        new Paragraph({ children: [new TextRun({ text: 'Valores: ', bold: true }), new TextRun('expressos em reais (BRL).')] }),
        new Paragraph({ spacing: { before: 220 }, children: [new TextRun({ text: `Esta proposta corresponde à revisão ${String(proposal.revision).padStart(2, '0')} e foi emitida com os dados comerciais preservados nessa versão. Alterações de escopo ou quantitativos poderão exigir uma nova revisão.`, color: MUTED, size: 17 })] }),
      ],
    }],
  });
  return Packer.toBuffer(doc);
};
