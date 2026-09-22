import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { AppSettings, ProposalDetail, ProposalExportOptions } from '../shared/contracts';
import { getProposalFinancials } from '../shared/proposalFinancials';
import {
  BLUE,
  commercialLaborTotal,
  commercialMaterialsTotal,
  date,
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
import {
  buildContinuationHeader,
  buildDocFooter,
  buildFirstPageHeader,
  CONTENT_WIDTH,
} from './proposalDocxHeaderFooter';

const borderLine = { style: BorderStyle.SINGLE, size: 1, color: LINE };
const cellBorders = { top: borderLine, bottom: borderLine, left: borderLine, right: borderLine };

const cell = (
  text: string,
  width: number,
  options: { bold?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType]; fill?: string; color?: string; isMeta?: boolean; columnSpan?: number } = {}
) => {
  const lines = text.split('\n');
  const paragraphs = lines.map((lineText, idx) => {
    const isLabel = options.isMeta && idx === 0 && lines.length > 1;
    return new Paragraph({
      alignment: options.align,
      spacing: { before: idx > 0 ? 30 : 0, after: 0 },
      children: [
        new TextRun({
          text: lineText,
          bold: isLabel ? true : options.bold,
          color: isLabel ? MUTED : (options.color ?? INK),
          size: isLabel ? 14 : 17,
          font: 'Arial',
        }),
      ],
    });
  });

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: options.columnSpan,
    shading: options.fill ? { fill: options.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    borders: cellBorders,
    children: paragraphs,
  });
};

export const createProposalDocument = (
  proposal: ProposalDetail,
  settings?: AppSettings,
  options?: ProposalExportOptions
): Document => {
  const validUntil = proposal.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : 'A definir';
  const conditions = parseCommercialConditions(proposal.scope);
  const includeLabor = options?.includeLabor ?? true;
  const materialsTotal = commercialMaterialsTotal(proposal);
  const laborTotal = includeLabor ? commercialLaborTotal(proposal) : 0;
  const financials = getProposalFinancials(proposal);
  const total = financials.finalValue;
  const taxPercentage = proposal.taxPercentage ?? 0;
  const taxAmount = financials.taxAmount ?? 0;
  const showCodes = options?.showProductCodes ?? true;
  const groupByCategory = options?.groupByCategory ?? true;
  const includeTerms = options?.includeCommercialTerms ?? true;
  const includeNotes = options?.includeNotes ?? true;
  const combinedNotes = [conditions.notes, options?.customNotes?.trim()].filter(Boolean).join('\n\n');

  const conditionParagraph = (label: string, value: string) =>
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 17, color: NAVY, font: 'Arial' }),
        new TextRun({ text: value || 'A definir', size: 17, color: INK, font: 'Arial' }),
      ],
    });

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell('ITEM', 700, { bold: true, align: AlignmentType.CENTER, fill: NAVY, color: WHITE }),
      cell('DESCRIÇÃO', 4638, { bold: true, fill: NAVY, color: WHITE }),
      cell('UN.', 650, { bold: true, align: AlignmentType.CENTER, fill: NAVY, color: WHITE }),
      cell('QTD.', 850, { bold: true, align: AlignmentType.RIGHT, fill: NAVY, color: WHITE }),
      cell('VALOR UNIT.', 1350, { bold: true, align: AlignmentType.RIGHT, fill: NAVY, color: WHITE }),
      cell('VALOR TOTAL', 1450, { bold: true, align: AlignmentType.RIGHT, fill: NAVY, color: WHITE }),
    ],
  });

  const categoryHeaderCell = (label: string, categoryTotal: number) =>
    new TableCell({
      columnSpan: 6,
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      shading: { fill: LIGHT_BLUE, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 110, right: 110 },
      borders: { top: { style: BorderStyle.SINGLE, size: 6, color: BLUE }, bottom: borderLine, left: borderLine, right: borderLine },
      children: [new Paragraph({ children: [new TextRun({ text: `${label.toUpperCase()} — ${money.format(categoryTotal)}`, bold: true, color: NAVY, size: 17, font: 'Arial' })] })],
    });

  let docxIndex = 0;
  const groupedRows: TableRow[] = [];

  const createItemRow = (item: typeof proposal.items[0]) => {
    docxIndex += 1;
    const descText = showCodes && item.code ? `${item.code}\n${item.description}` : item.description;
    return new TableRow({
      children: [
        cell(String(docxIndex), 700, { align: AlignmentType.CENTER }),
        cell(descText, 4638, { isMeta: Boolean(showCodes && item.code) }),
        cell(item.unit, 650, { align: AlignmentType.CENTER }),
        cell(quantity.format(item.quantity), 850, { align: AlignmentType.RIGHT }),
        cell(money.format(item.unitSale), 1350, { align: AlignmentType.RIGHT }),
        cell(money.format(item.totalSale), 1450, { bold: true, align: AlignmentType.RIGHT }),
      ],
    });
  };

  if (groupByCategory) {
    for (const [category, items] of groupItemsByCategory(proposal)) {
      const categoryTotal = items.reduce((sum, item) => sum + item.totalSale, 0);
      groupedRows.push(new TableRow({ children: [categoryHeaderCell(category, categoryTotal)] }));
      for (const item of items) groupedRows.push(createItemRow(item));
    }
  } else {
    for (const item of proposal.items) groupedRows.push(createItemRow(item));
  }

  const laborRows: TableRow[] = [];
  if (laborTotal > 0) {
    if (groupByCategory) groupedRows.push(new TableRow({ children: [categoryHeaderCell('Mão de obra', laborTotal)] }));
    docxIndex += 1;
    laborRows.push(
      new TableRow({
        children: [
          cell(String(docxIndex), 700, { align: AlignmentType.CENTER }),
          cell('Mão de obra técnica\nServiços técnicos e operacionais conforme escopo.', 4638, { isMeta: true }),
          cell('vb', 650, { align: AlignmentType.CENTER }),
          cell('1', 850, { align: AlignmentType.RIGHT }),
          cell(money.format(laborTotal), 1350, { align: AlignmentType.RIGHT }),
          cell(money.format(laborTotal), 1450, { bold: true, align: AlignmentType.RIGHT }),
        ],
      })
    );
  }

  const itemRows = [...groupedRows, ...laborRows];
  const docRows = itemRows.length > 0 ? [headerRow, ...itemRows] : [
    headerRow,
    new TableRow({
      children: [new TableCell({ columnSpan: 6, width: { size: CONTENT_WIDTH, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nenhum item incluído nesta revisão.', color: MUTED, size: 17 })] })] })],
    }),
  ];

  const summaryRows: TableRow[] = [
    laborTotal > 0
      ? new TableRow({ children: [cell(`Total de Materiais\n${money.format(materialsTotal)}`, 4819, { fill: LIGHT_BLUE, isMeta: true }), cell(`Total de Mão de Obra\n${money.format(laborTotal)}`, 4819, { fill: LIGHT_BLUE, isMeta: true })] })
      : new TableRow({ children: [cell(`Subtotal de Itens e Serviços\n${money.format(materialsTotal)}`, CONTENT_WIDTH, { fill: LIGHT_BLUE, isMeta: true })] }),
    ...(taxAmount > 0
      ? [new TableRow({ children: [cell(`Impostos (${String(taxPercentage).replace('.', ',')}%)\n${money.format(taxAmount)}`, CONTENT_WIDTH, { fill: LIGHT_BLUE, isMeta: true, columnSpan: laborTotal > 0 ? 2 : undefined })] })]
      : []),
  ];

  return new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20, color: INK }, paragraph: { spacing: { after: 100, line: 260 } } } },
      paragraphStyles: [
        { id: 'ProposalTitle', name: 'Proposal Title', basedOn: 'Normal', run: { font: 'Arial', size: 30, bold: true, color: '163D69', allCaps: true }, paragraph: { spacing: { before: 140, after: 50 } } },
        { id: 'ProposalHeading', name: 'Proposal Heading', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 21, bold: true, color: '163D69', allCaps: true }, paragraph: { spacing: { before: 200, after: 60 }, keepNext: true } },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
        headers: { default: buildContinuationHeader(proposal, settings) },
        footers: { default: buildDocFooter(settings) },
        children: [
          buildFirstPageHeader(proposal, settings),
          new Paragraph({ style: 'ProposalTitle', text: 'Proposta Técnica-Comercial' }),
          new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: 'Apresentamos nossa composição comercial para o escopo descrito a seguir.', color: MUTED, size: 18 })] }),
          new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            columnWidths: [4819, 4819],
            rows: [
              new TableRow({ children: [cell(`CLIENTE\n${proposal.clientName}`, 4819, { fill: LIGHT_BLUE, isMeta: true }), cell(`OBRA / LOCAL\n${proposal.workName || '—'}`, 4819, { fill: LIGHT_BLUE, isMeta: true })] }),
              new TableRow({ children: [cell(`ESCOPO\n${conditions.scope || 'A definir'}`, 4819, { fill: LIGHT_BLUE, isMeta: true }), cell(`RESPONSÁVEL\n${proposal.responsibleName || '—'}`, 4819, { fill: LIGHT_BLUE, isMeta: true })] }),
            ],
          }),
          new Paragraph({ style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: 'Composição da proposta' }),
          new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: [700, 4638, 650, 850, 1350, 1450], rows: docRows }),
          new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: laborTotal > 0 ? [4819, 4819] : [CONTENT_WIDTH], rows: summaryRows }),
          new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                    shading: { fill: BLUE, type: ShadingType.CLEAR },
                    margins: { top: 120, bottom: 120, left: 160, right: 160 },
                    borders: { top: borderLine, bottom: borderLine, left: borderLine, right: borderLine },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({ text: 'VALOR TOTAL DA PROPOSTA:   ', bold: true, color: WHITE, size: 21, font: 'Arial' }),
                          new TextRun({ text: money.format(total), bold: true, color: WHITE, size: 25, font: 'Arial' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          ...(includeTerms
            ? [
                new Paragraph({ style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: 'Condições comerciais' }),
                conditionParagraph('Validade da proposta', validUntil),
                conditionParagraph('Prazo de execução', conditions.executionTerm || 'A combinar'),
                conditionParagraph('Forma de pagamento', conditions.paymentTerms || 'A combinar'),
                conditionParagraph('Garantia', conditions.warranty || 'Conforme normas técnicas vigentes'),
                conditionParagraph('Moeda', 'Valores expressos em reais (BRL).'),
                ...(includeNotes && combinedNotes ? [conditionParagraph('Observações', combinedNotes)] : []),
              ]
            : includeNotes && combinedNotes
            ? [
                new Paragraph({ style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: 'Observações' }),
                conditionParagraph('Observações', combinedNotes),
              ]
            : []),
          new Paragraph({
            spacing: { before: 180 },
            children: [
              new TextRun({
                text: `Esta proposta corresponde à revisão ${String(proposal.revision).padStart(2, '0')} e foi emitida com os dados comerciais preservados nesta versão.`,
                color: MUTED,
                size: 15,
                font: 'Arial',
              }),
            ],
          }),
        ],
      },
    ],
  });
};

export const buildProposalDocx = async (
  proposal: ProposalDetail,
  settings?: AppSettings,
  options?: ProposalExportOptions
): Promise<Buffer> => {
  return Packer.toBuffer(createProposalDocument(proposal, settings, options));
};

export const buildProposalDocxBlob = async (
  proposal: ProposalDetail,
  settings?: AppSettings,
  options?: ProposalExportOptions
): Promise<Blob> => {
  return Packer.toBlob(createProposalDocument(proposal, settings, options));
};
