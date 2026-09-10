import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
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
import type { AppSettings, ProposalDetail, ProposalExportOptions } from '../shared/contracts';
import { proposalLogo } from './proposalPresentation';
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

export const buildProposalDocx = async (
  proposal: ProposalDetail,
  settings?: AppSettings,
  options?: ProposalExportOptions
) => {
  const validUntil = proposal.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : 'A definir';
  const conditions = parseCommercialConditions(proposal.scope);
  const includeLabor = options?.includeLabor ?? true;
  const materialsTotal = commercialMaterialsTotal(proposal);
  const laborTotal = includeLabor ? commercialLaborTotal(proposal) : 0;
  const total = documentTotal(proposal);
  const showCodes = options?.showProductCodes ?? true;
  const groupByCategory = options?.groupByCategory ?? true;
  const includeTerms = options?.includeCommercialTerms ?? true;
  const includeNotes = options?.includeNotes ?? true;
  const combinedNotes = [conditions.notes, options?.customNotes?.trim()].filter(Boolean).join('\n\n');
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
  let docxIndex = 0;
  const groupedRows: TableRow[] = [];

  const createItemRow = (item: typeof proposal.items[0]) => {
    docxIndex += 1;
    const descText = showCodes && item.code ? `${item.code}\n${item.description}` : item.description;
    return new TableRow({ children: [
      cell(String(docxIndex), 650, { align: AlignmentType.CENTER }),
      cell(descText, 3530),
      cell(item.unit, 630, { align: AlignmentType.CENTER }),
      cell(quantity.format(item.quantity), 810, { align: AlignmentType.RIGHT }),
      cell(money.format(item.unitSale), 1370, { align: AlignmentType.RIGHT }),
      cell(money.format(item.totalSale), 1510, { bold: true, align: AlignmentType.RIGHT }),
    ] });
  };

  if (groupByCategory) {
    const grouped = groupItemsByCategory(proposal);
    for (const [category, items] of grouped) {
      const categoryTotal = items.reduce((sum, item) => sum + item.totalSale, 0);
      groupedRows.push(new TableRow({ children: [categoryHeaderCell(category, categoryTotal)] }));
      for (const item of items) {
        groupedRows.push(createItemRow(item));
      }
    }
  } else {
    for (const item of proposal.items) {
      groupedRows.push(createItemRow(item));
    }
  }

  const laborRows: TableRow[] = [];
  if (laborTotal > 0) {
    if (groupByCategory) {
      groupedRows.push(new TableRow({ children: [categoryHeaderCell('Mão de obra', laborTotal)] }));
    }
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

  const brandText = (settings?.tradeName?.trim() || 'CONSTRUTEC').toUpperCase();
  const companyName = settings?.companyName?.trim() || 'LAC CONSTRUTEC CONSTRUTORA EIRELI';
  const companyDoc = settings?.document?.trim() || '32.992.946/0001-78';
  const companyAddress = settings?.address?.trim() || 'Rua Metodio Coelho, 62, EDIFICIO CIDADELLA CENTER  I, Sala 112/ PARQUE BELA VISTA/ Salvador BA /40050-450';
  const companyPhone = settings?.phone?.trim() || '(71) 99294-1099';
  const companyEmail = settings?.email?.trim() || 'supervisao@rcconstrutec.com.br / engenharia@rcconstrutec.com.br';
  const logoBuffer = proposalLogo();

  const headerTable = new Table({
    width: { size: 8550, type: WidthType.DXA },
    columnWidths: [5550, 3000],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 5550, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.SINGLE, size: 18, color: BLUE },
            },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [new ImageRun({ data: logoBuffer, transformation: { width: 125, height: 40 }, type: 'png' })],
              }),
              new Paragraph({
                spacing: { after: 20 },
                children: [new TextRun({ text: companyName, bold: true, size: 15, color: NAVY, font: 'Arial' })],
              }),
              new Paragraph({
                spacing: { after: 20 },
                children: [new TextRun({ text: `CNPJ: ${companyDoc} • Sede: ${companyAddress}`, size: 13, color: MUTED, font: 'Arial' })],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [new TextRun({ text: `Contato: ${companyPhone} • ${companyEmail}`, size: 13, color: MUTED, font: 'Arial' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3000, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.SINGLE, size: 18, color: BLUE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'PROPOSTA COMERCIAL', bold: true, size: 14, color: BLUE, font: 'Arial' })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 20, after: 20 },
                children: [new TextRun({ text: proposal.number, bold: true, size: 20, color: NAVY, font: 'Arial' })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `Revisão ${String(proposal.revision).padStart(2, '0')}`, size: 14, color: MUTED, font: 'Arial' })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: date.format(new Date()), size: 14, color: MUTED, font: 'Arial' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 21, color: INK }, paragraph: { spacing: { after: 120, line: 276 } } } },
      paragraphStyles: [
        { id: 'ProposalTitle', name: 'Proposal Title', basedOn: 'Normal', run: { font: 'Arial', size: 38, bold: true, color: '163D69', allCaps: true }, paragraph: { spacing: { before: 180, after: 60 } } },
        { id: 'ProposalHeading', name: 'Proposal Heading', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 23, bold: true, color: '163D69', allCaps: true }, paragraph: { spacing: { before: 260, after: 80 }, keepNext: true } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, right: 800, bottom: 900, left: 800 } } },
      headers: { default: new Header({ children: [headerTable] }) },
      footers: { default: new Footer({ children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { top: { style: BorderStyle.SINGLE, size: 12, color: '28539E', space: 6 } },
          children: [
            new TextRun({ text: 'Página ', size: 14, color: MUTED, font: 'Arial' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 14, color: MUTED, font: 'Arial' }),
            new TextRun({ text: ' de ', size: 14, color: MUTED, font: 'Arial' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: MUTED, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          spacing: { before: 40, after: 20 },
          children: [
            new TextRun({ text: companyName, bold: true, size: 15, color: INK, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          spacing: { before: 0, after: 20 },
          children: [
            new TextRun({ text: 'Sede: ', bold: true, size: 13, color: INK, font: 'Arial' }),
            new TextRun({ text: `${companyAddress} • Contato: ${companyPhone}`, size: 13, color: INK, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          spacing: { before: 0, after: 40 },
          children: [
            new TextRun({ text: 'E-mail: ', bold: true, size: 13, color: INK, font: 'Arial' }),
            new TextRun({ text: companyEmail, size: 13, color: INK, font: 'Arial' }),
          ],
        }),
      ] }) },
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
        ...(includeTerms ? [
          new Paragraph({ style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: 'Condições comerciais' }),
          conditionParagraph('Validade da proposta', validUntil),
          conditionParagraph('Prazo de execução', conditions.executionTerm || 'A definir'),
          conditionParagraph('Forma de pagamento', conditions.paymentTerms || 'A definir'),
          conditionParagraph('Garantia', conditions.warranty || 'A definir'),
          conditionParagraph('Valores', 'expressos em reais (BRL).'),
          ...(includeNotes && combinedNotes ? [conditionParagraph('Observações', combinedNotes)] : []),
        ] : (includeNotes && combinedNotes ? [
          new Paragraph({ style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: 'Observações' }),
          conditionParagraph('Observações', combinedNotes),
        ] : [])),
        new Paragraph({ spacing: { before: 220 }, children: [new TextRun({ text: `Esta proposta corresponde à revisão ${String(proposal.revision).padStart(2, '0')} e foi emitida com os dados comerciais preservados nessa versão. Alterações de escopo ou quantitativos poderão exigir uma nova revisão.`, color: MUTED, size: 17 })] }),
      ],
    }],
  });
  return Packer.toBuffer(doc);
};
