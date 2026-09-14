import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  ImageRun,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { AppSettings, ProposalDetail } from '../shared/contracts';
import { proposalLogo } from './proposalPresentation';
import { BLUE, date, MUTED, NAVY } from './proposalDocumentCommon';

export const CONTENT_WIDTH = 9638; // 170mm (A4 11906 - 2 * 1134 margins)

export const buildFirstPageHeader = (proposal: ProposalDetail, settings?: AppSettings) => {
  const companyName = settings?.companyName?.trim() || 'LAC CONSTRUTEC CONSTRUTORA EIRELI';
  const companyDoc = settings?.document?.trim() || '32.992.946/0001-78';
  const companyAddress = settings?.address?.trim() || 'Rua Metodio Coelho, 62, Sala 112, Salvador/BA';
  const companyPhone = settings?.phone?.trim() || '(71) 99294-1099';
  const companyEmail = settings?.email?.trim() || 'supervisao@rcconstrutec.com.br';
  const logoData = proposalLogo();
  const bottomBorder = { style: BorderStyle.SINGLE, size: 16, color: BLUE };

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [6438, 3200],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 6438, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: bottomBorder },
            children: [
              new Paragraph({ spacing: { after: 50 }, children: [new ImageRun({ data: logoData, transformation: { width: 125, height: 40 }, type: 'png' })] }),
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

export const buildContinuationHeader = (proposal: ProposalDetail, settings?: AppSettings) => {
  const brand = (settings?.tradeName?.trim() || 'CONSTRUTEC').toUpperCase();
  const border = { style: BorderStyle.SINGLE, size: 8, color: BLUE };
  return new Header({
    children: [
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [6438, 3200],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 6438, type: WidthType.DXA },
                borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: border },
                margins: { top: 0, bottom: 40, left: 0, right: 0 },
                children: [new Paragraph({ children: [new TextRun({ text: `${brand} • Proposta Comercial ${proposal.number} (Rev. ${String(proposal.revision).padStart(2, '0')})`, size: 14, color: NAVY, bold: true, font: 'Arial' })] })],
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

export const buildDocFooter = (settings?: AppSettings) => {
  const companyName = settings?.companyName?.trim() || 'LAC CONSTRUTEC CONSTRUTORA EIRELI';
  const companyDoc = settings?.document?.trim() || '32.992.946/0001-78';
  const border = { style: BorderStyle.SINGLE, size: 8, color: BLUE };
  return new Footer({
    children: [
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [7000, 2638],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 7000, type: WidthType.DXA },
                borders: { top: border, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE } },
                margins: { top: 50, bottom: 0, left: 0, right: 0 },
                children: [new Paragraph({ children: [new TextRun({ text: `${companyName} • CNPJ: ${companyDoc}`, size: 13, color: MUTED, font: 'Arial' })] })],
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
