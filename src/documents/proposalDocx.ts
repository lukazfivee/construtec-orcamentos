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
import type { AppSettings, ProposalDetail } from '../shared/contracts';
import {
  BLUE,
  commercialLaborTotal,
  commercialMaterialsTotal,
  date,
  documentTotal,
  groupItemsByCategory,
  INK,
  LIGHT_BLUE,
  LINE,
  money,
  MUTED,
  NAVY,
  parseCommercialConditions,
  quantity,
  WHITE,
} from './proposalDocumentCommon';

const cell = (
  text: string,
  width: number,
  options: { bold?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType]; fill?: string; color?: string } = {},
) => new TableCell({
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

export const buildProposalDocx = async (proposal: ProposalDetail, settings?: AppSettings) => {
  const validUntil = proposal.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : 'A definir';
  const conditions = parseCommercialConditions(proposal.scope);
  const materialsTotal = commercialMaterialsTotal(proposal);
  const laborTotal = commercialLaborTotal(proposal);
  const total = documentTotal(proposal);
  const conditionParagraph = (label: string, value: string) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value || 'A definir')] });
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
  const categoryHeaderCell = (label: string, categoryTotal: number) => new TableCell({
    columnSpan: 6,
    shading: { fill: LIGHT_BLUE, type: ShadingType.CLEAR },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: BLUE },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: LINE },
      left: { style: BorderStyle.SINGLE, size: 1, color: LINE },
      right: { style: BorderStyle.SINGLE, size: 1, color: LINE },
    },
    children: [new Paragraph({ children: [new TextRun({ text: `${label.toUpperCase()} — ${money.format(categoryTotal)}`, bold: true, color: NAVY, size: 18, font: 'Arial' })] })],
  });
  const grouped = groupItemsByCategory(proposal);
  let docxIndex = 0;
  const groupedRows: TableRow[] = [];
  for (const [category, items] of grouped) {
    const categoryTotal = items.reduce((sum, item) => sum + item.totalSale, 0);
    groupedRows.push(new TableRow({ children: [categoryHeaderCell(category, categoryTotal)] }));
    for (const item of items) {
      docxIndex += 1;
      groupedRows.push(new TableRow({ children: [
        cell(String(docxIndex), 650, { align: AlignmentType.CENTER }),
        cell(`${item.code}\n${item.description}`, 3530),
        cell(item.unit, 630, { align: AlignmentType.CENTER }),
        cell(quantity.format(item.quantity), 810, { align: AlignmentType.RIGHT }),
        cell(money.format(item.unitSale), 1370, { align: AlignmentType.RIGHT }),
        cell(money.format(item.totalSale), 1510, { bold: true, align: AlignmentType.RIGHT }),
      ] }));
    }
  }
  const laborRows: TableRow[] = [];
  if (laborTotal > 0) {
    groupedRows.push(new TableRow({ children: [categoryHeaderCell('Mão de obra', laborTotal)] }));
    docxIndex += 1;
    laborRows.push(new TableRow({ children: [
      cell(String(docxIndex), 650, { align: AlignmentType.CENTER }),
      cell('Mão de obra\nServiços técnicos conforme escopo da proposta.', 3530),
      cell('vb', 630, { align: AlignmentType.CENTER }),
      cell('1', 810, { align: AlignmentType.RIGHT }),
      cell(money.format(laborTotal), 1370, { align: AlignmentType.RIGHT }),
      cell(money.format(laborTotal), 1510, { bold: true, align: AlignmentType.RIGHT }),
    ] }));
  }
  const itemRows = [...groupedRows, ...laborRows];
  const docRows = itemRows.length > 0 ? [headerRow, ...itemRows] : [headerRow, new TableRow({ children: [new TableCell({ columnSpan: 6, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nenhum item incluído nesta revisão.', color: MUTED, size: 18 })] })] })] })];

  const brandText = (settings?.tradeName || 'CONSTRUTEC ENGENHARIA').toUpperCase();
  const companyFooter = settings?.companyName?.trim() || 'Construtec Engenharia';

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 21, color: INK }, paragraph: { spacing: { after: 120, line: 276 } } } },
      paragraphStyles: [
        { id: 'ProposalTitle', name: 'Proposal Title', basedOn: 'Normal', run: { font: 'Arial', size: 42, bold: true, color: '173F73', allCaps: true }, paragraph: { spacing: { before: 220, after: 80 } } },
        { id: 'ProposalHeading', name: 'Proposal Heading', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 25, bold: true, color: '173F73', allCaps: true }, paragraph: { spacing: { before: 300, after: 100 }, keepNext: true } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, right: 800, bottom: 900, left: 800 } } },
      headers: { default: new Header({ children: [
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: BLUE, space: 8 } }, children: [
          new TextRun({ text: `${brandText} `, bold: true, size: 30, color: BLUE, font: 'Arial' }),
          new TextRun({ text: `                                      ${proposal.number} | REV.${String(proposal.revision).padStart(2, '0')}`, bold: true, size: 18, color: MUTED, font: 'Arial' }),
        ] }),
      ] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 5 } }, children: [new TextRun({ text: `${companyFooter} - ${proposal.number} - Página `, color: MUTED, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 })] })] }) },
      children: [
        new Paragraph({ style: 'ProposalTitle', text: 'Proposta Técnica-Comercial' }),
        new Paragraph({ children: [new TextRun({ text: 'Apresentamos nossa composição comercial para o escopo descrito abaixo.', color: MUTED, size: 20 })] }),
        new Table({ width: { size: 8550, type: WidthType.DXA }, columnWidths: [4275, 4275], rows: [
          new TableRow({ children: [cell(`CLIENTE\n${proposal.clientName}`, 4275, { fill: LIGHT_BLUE }), cell(`OBRA\n${proposal.workName}`, 4275, { fill: LIGHT_BLUE })] }),
          new TableRow({ children: [cell(`ESCOPO\n${conditions.scope}`, 4275, { fill: LIGHT_BLUE }), cell(`RESPONSÁVEL\n${proposal.responsibleName}`, 4275, { fill: LIGHT_BLUE })] }),
        ] }),
        new Paragraph({ style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: 'Composição da proposta' }),
        new Table({ width: { size: 8500, type: WidthType.DXA }, columnWidths: [650, 3530, 630, 810, 1370, 1510], rows: docRows }),
        new Table({
          width: { size: 8500, type: WidthType.DXA },
          columnWidths: [4250, 4250],
          rows: [
            new TableRow({ children: [cell(`Total de Materiais\n${money.format(materialsTotal)}`, 4250, { fill: LIGHT_BLUE }), cell(`Total de Mão de Obra\n${money.format(laborTotal)}`, 4250, { fill: LIGHT_BLUE })] }),
          ],
        }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 220, after: 260 }, shading: { fill: BLUE, type: ShadingType.CLEAR }, children: [new TextRun({ text: `VALOR TOTAL   ${money.format(total)}`, bold: true, color: WHITE, size: 28, font: 'Arial' })] }),
        new Paragraph({ style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: 'Condições comerciais' }),
        conditionParagraph('Validade da proposta', validUntil),
        conditionParagraph('Prazo de execução', conditions.executionTerm || 'A definir'),
        conditionParagraph('Forma de pagamento', conditions.paymentTerms || 'A definir'),
        conditionParagraph('Garantia', conditions.warranty || 'A definir'),
        conditionParagraph('Valores', 'expressos em reais (BRL).'),
        ...(conditions.notes ? [conditionParagraph('Observações', conditions.notes)] : []),
        new Paragraph({ spacing: { before: 220 }, children: [new TextRun({ text: `Esta proposta corresponde à revisão ${String(proposal.revision).padStart(2, '0')} e foi emitida com os dados comerciais preservados nessa versão. Alterações de escopo ou quantitativos poderão exigir uma nova revisão.`, color: MUTED, size: 17 })] }),
      ],
    }],
  });
  return Packer.toBuffer(doc);
};
