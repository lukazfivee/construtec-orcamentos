import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  ImageRun,
  PageNumber,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalPositionAlign,
  VerticalPositionRelativeFrom,
  WidthType,
} from 'docx';
import type { AppSettings, ProposalDetail } from '../shared/contracts';
import { proposalLogo, proposalWatermark } from './proposalPresentation';
import { BLUE, date, MUTED, NAVY } from './proposalDocumentCommon';

export const CONTENT_WIDTH = 9638; // 170mm (A4 11906 - 2 * 1134 margins)

// Logo esmaecida atras do texto, no centro da pagina; vai dentro de um paragrafo do cabecalho (aparece em todas as paginas).
const watermarkRuns = (on: boolean) => (on ? [new ImageRun({
  type: 'png', data: proposalWatermark(), transformation: { width: 520, height: 190 }, altText: { name: 'Marca dagua', description: 'Logo da Construtec', title: 'Marca dagua' },
  floating: {
    horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
    verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
    wrap: { type: TextWrappingType.NONE }, behindDocument: true, allowOverlap: true,
  },
})] : []);

export const buildFirstPageHeader = (proposal: ProposalDetail, settings?: AppSettings) => {
  const companyName = settings?.companyName?.trim() || 'LAC CONSTRUTEC CONSTRUTORA EIRELI';
  const companyDoc = settings?.document?.trim() || '32.992.946/0001-78';
  const companyAddress = settings?.address?.trim() || 'Rua Metodio Coelho, 62, Sala 112, Salvador/BA';
  const companyPhone = settings?.phone?.trim() || '(71) 99294-1099';
  const companyEmail = settings?.email?.trim() || 'supervisao@rcconstrutec.com.br';
  const logoData = proposalLogo();
  // Mesmo controle do PDF (Configuracoes > Padroes da empresa): sem logo, o cabecalho fica so com os dados da empresa.
  const showLogo = settings?.pdfShowLogo ?? true;
  const bottomBorder = { style: BorderStyle.SINGLE, size: 16, color: BLUE };

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    borders: TableBorders.NONE,
    columnWidths: [6438, 3200],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 6438, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: bottomBorder },
            children: [
              ...(showLogo ? [new Paragraph({ spacing: { after: 50 }, children: [new ImageRun({ data: logoData, transformation: { width: 125, height: 40 }, type: 'png' })] })] : []),
              new Paragraph({ spacing: { after: 15 }, children: [new TextRun({ text: companyName, bold: true, size: 15, color: NAVY, font: 'Arial' })] }),
              new Paragraph({ spacing: { after: 15 }, children: [new TextRun({ text: `CNPJ: ${companyDoc} • Sede: ${companyAddress}`, size: 13, color: MUTED, font: 'Arial' })] }),
              new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: `Contato: ${companyPhone} • ${companyEmail}`, size: 13, color: MUTED, font: 'Arial' })] }),
            ],
          }),
          new TableCell({
            width: { size: 3200, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: bottomBorder },
            children: [
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'PROPOSTA COMERCIAL', bold: true, size: 14, color: BLUE, font: 'Arial' })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 20, after: 15 }, children: [new TextRun({ text: proposal.number, bold: true, size: 21, color: NAVY, font: 'Arial' })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Revisão ${String(proposal.revision).padStart(2, '0')}`, size: 14, color: MUTED, font: 'Arial' })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: date.format(new Date()), size: 14, color: MUTED, font: 'Arial' })] }),
            ],
          }),
        ],
      }),
    ],
  });
};

// Carta de abertura: logo e referencia da proposta em todas as paginas, com filete azul-marinho (como a proposta feita a mao).
export const buildRunningHeader = (proposal: ProposalDetail, settings?: AppSettings, watermark = false) => {
  const showLogo = settings?.pdfShowLogo ?? true;
  const brand = (settings?.tradeName?.trim() || 'CONSTRUTEC').toUpperCase();
  const none = { style: BorderStyle.NONE };
  const bottom = { style: BorderStyle.SINGLE, size: 12, color: '163D69' };
  return new Header({
    children: [
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        borders: TableBorders.NONE,
        columnWidths: [6438, 3200],
        rows: [new TableRow({
          children: [
            new TableCell({
              width: { size: 6438, type: WidthType.DXA }, verticalAlign: 'bottom',
              borders: { top: none, left: none, right: none, bottom },
              margins: { top: 0, bottom: 40, left: 0, right: 0 },
              children: [new Paragraph({ spacing: { after: 0 }, children: showLogo
                ? [new ImageRun({ data: proposalLogo(), transformation: { width: 150, height: 55 }, type: 'png' }), ...watermarkRuns(watermark)]
                : [new TextRun({ text: brand, bold: true, size: 26, color: '163D69', font: 'Arial' }), ...watermarkRuns(watermark)] })],
            }),
            new TableCell({
              width: { size: 3200, type: WidthType.DXA }, verticalAlign: 'bottom',
              borders: { top: none, left: none, right: none, bottom },
              margins: { top: 0, bottom: 40, left: 0, right: 0 },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [new TextRun({ text: `${proposal.number} • Revisão ${String(proposal.revision).padStart(2, '0')}`, size: 15, color: MUTED, font: 'Arial' })] })],
            }),
          ],
        })],
      }),
    ],
  });
};

export const buildContinuationHeader = (proposal: ProposalDetail, settings?: AppSettings, watermark = false) => {
  const brand = (settings?.tradeName?.trim() || 'CONSTRUTEC').toUpperCase();
  const border = { style: BorderStyle.SINGLE, size: 8, color: BLUE };
  return new Header({
    children: [
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        borders: TableBorders.NONE,
        columnWidths: [6438, 3200],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 6438, type: WidthType.DXA },
                borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: border },
                margins: { top: 0, bottom: 40, left: 0, right: 0 },
                children: [new Paragraph({ children: [new TextRun({ text: `${brand} • Proposta Comercial ${proposal.number} (Rev. ${String(proposal.revision).padStart(2, '0')})`, size: 14, color: NAVY, bold: true, font: 'Arial' }), ...watermarkRuns(watermark)] })],
              }),
              new TableCell({
                width: { size: 3200, type: WidthType.DXA },
                borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: border },
                margins: { top: 0, bottom: 40, left: 0, right: 0 },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: proposal.clientName, size: 13, color: MUTED, font: 'Arial' })] })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

export const buildDocFooter = (settings?: AppSettings, detailed = false) => {
  const companyName = settings?.companyName?.trim() || 'LAC CONSTRUTEC CONSTRUTORA EIRELI';
  const companyDoc = settings?.document?.trim() || '32.992.946/0001-78';
  const border = { style: BorderStyle.SINGLE, size: 8, color: BLUE };
  return new Footer({
    children: [
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        borders: TableBorders.NONE,
        columnWidths: [7000, 2638],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 7000, type: WidthType.DXA },
                borders: { top: border, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
                margins: { top: 50, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({ children: [new TextRun({ text: `${companyName} • CNPJ: ${companyDoc}`, size: 13, color: MUTED, font: 'Arial' })] }),
                  ...(detailed ? [new Paragraph({ children: [new TextRun({ text: `Sede: ${settings?.address?.trim() || 'Rua Metodio Coelho, 62, Ed. Cidadella Center I, Sala 112, Salvador/BA'} • Contato: ${settings?.phone?.trim() || '(71) 99294-1099'} • ${settings?.email?.trim() || 'supervisao@rcconstrutec.com.br'}`, size: 13, color: MUTED, font: 'Arial' })] })] : []),
                ],
              }),
              new TableCell({
                width: { size: 2638, type: WidthType.DXA },
                borders: { top: border, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
                margins: { top: 50, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ text: 'Página ', size: 13, color: MUTED, font: 'Arial' }),
                      new TextRun({ children: [PageNumber.CURRENT], size: 13, color: MUTED, font: 'Arial' }),
                      new TextRun({ text: ' de ', size: 13, color: MUTED, font: 'Arial' }),
                      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 13, color: MUTED, font: 'Arial' }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};
