// Blocos de texto do corpo da proposta no Word: titulos de secao e de subsecao, paragrafos (quebras de linha preservadas),
// lista com marcadores, carta de abertura e fechamento com assinatura.
import { AlignmentType, BorderStyle, HeadingLevel, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from 'docx';
import type { BodyPart } from '../shared/proposalBody';
import { INK, LINE, MUTED, NAVY, WHITE } from './proposalDocumentCommon';
import { CONTENT_WIDTH } from './proposalDocxHeaderFooter';

export type DocxBodyContext = { showSignature: boolean; company: string; brand: string; letter: boolean };

const SIZE = (letter: boolean) => (letter ? 20 : 18);
const run = (text: string, size: number, extra: { break?: number; bold?: boolean; color?: string; underline?: boolean } = {}) => {
  const { underline, ...rest } = extra;
  return new TextRun({ text, size, color: INK, font: 'Arial', ...(underline ? { underline: {} } : {}), ...rest });
};

// Legenda da planilha (titulo da tabela de itens): faixa clara acima da tabela, como na proposta feita a mao.
export const captionParagraph = (caption: string) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 }, keepNext: true,
  shading: { fill: 'EAF3F6', type: ShadingType.CLEAR },
  children: [run(caption, 17, { bold: true, color: NAVY })],
});

const tableLine = { style: BorderStyle.SINGLE, size: 1, color: LINE };

// Planilha propria: colunas de largura igual, cabecalho azul repetido a cada pagina, colunas numericas a direita.
const tableBlock = (part: Extract<BodyPart, { kind: 'planilha' }>): Table => {
  const columns = Math.max(1, part.headers.length);
  const base = Math.floor(CONTENT_WIDTH / columns);
  const widths = part.headers.map((_, index) => (index === columns - 1 ? CONTENT_WIDTH - base * (columns - 1) : base));
  const cell = (text: string, column: number, options: { head?: boolean; fill?: string } = {}) => new TableCell({
    width: { size: widths[column], type: WidthType.DXA },
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    borders: { top: tableLine, bottom: tableLine, left: tableLine, right: tableLine },
    ...(options.fill ? { shading: { fill: options.fill, type: ShadingType.CLEAR } } : {}),
    children: [new Paragraph({
      alignment: part.align[column] === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT, spacing: { after: 0, line: 264 },
      children: [new TextRun({ text, size: 17, font: 'Arial', bold: options.head, color: options.head ? WHITE : INK })],
    })],
  });
  const head = part.headers.some(Boolean)
    ? [new TableRow({ tableHeader: true, cantSplit: true, children: part.headers.map((header, column) => cell(header, column, { head: true, fill: NAVY })) })]
    : [];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: widths,
    rows: [...head, ...part.rows.map((row, index) => new TableRow({ cantSplit: true, children: row.map((value, column) => cell(value, column, index % 2 ? { fill: 'F4F9FB' } : {})) }))],
  });
};

const letterParagraphs = (part: Extract<BodyPart, { kind: 'carta' }>): Paragraph[] => {
  const out: Paragraph[] = [];
  if (part.dateLine) out.push(new Paragraph({ spacing: { after: 200 }, children: [run(part.dateLine, 20)] }));
  if (part.recipient) out.push(new Paragraph({ spacing: { after: 200 }, children: [run(part.recipient.toUpperCase(), 20, { bold: true })] }));
  if (part.attention || part.department) {
    out.push(new Paragraph({
      spacing: { after: 160 }, indent: { left: 600, hanging: 600 }, tabStops: [{ type: 'left', position: 600 }],
      children: [run('At.:', 20, { bold: true }), run('\t', 20), ...[part.attention, part.department].filter(Boolean).flatMap((line, index) => run(line, 20, index > 0 ? { break: 1 } : {}))],
    }));
  }
  if (part.reference) out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 }, children: [run(`REF.: ${part.reference}`, 20, { bold: true })] }));
  out.push(new Paragraph({ style: 'ProposalTitle', alignment: AlignmentType.CENTER, spacing: { before: 360, after: 280 }, children: [run(part.title.toUpperCase(), 30, { bold: true, color: '163D69', underline: true })] }));
  if (part.greeting) out.push(new Paragraph({ spacing: { after: 100 }, children: [run(part.greeting, 20)] }));
  if (part.intro) out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: [run(part.intro, 20)] }));
  return out;
};

const closingParagraphs = (part: Extract<BodyPart, { kind: 'fechamento' }>, context: DocxBodyContext): Paragraph[] => [
  ...part.paragraphs.map((lines) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 120, after: 100 }, keepNext: context.showSignature, children: lines.map((line, index) => run(line, SIZE(context.letter), index > 0 ? { break: 1 } : {})) })),
  ...(context.showSignature
    ? [
        new Paragraph({ spacing: { before: 720, after: 0 }, keepNext: true, border: { top: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } }, indent: { right: 5400 }, children: [run(part.signer || context.brand, 20, { bold: true, color: NAVY })] }),
        ...(part.role ? [new Paragraph({ keepNext: true, spacing: { after: 0 }, children: [run(part.role, 17, { color: MUTED })] })] : []),
        new Paragraph({ children: [run(context.company, 16, { color: MUTED })] }),
      ]
    : []),
];

export const bodyTextParagraphs = (part: BodyPart, context: DocxBodyContext): Array<Paragraph | Table> => {
  const size = SIZE(context.letter);
  const justify = context.letter ? AlignmentType.JUSTIFIED : undefined;
  if (part.kind === 'heading') {
    return [new Paragraph(part.sub
      ? { style: 'ProposalSubheading', heading: HeadingLevel.HEADING_2, text: part.text }
      : { style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: part.text })];
  }
  if (part.kind === 'paragraph') {
    return [new Paragraph({ alignment: justify, spacing: { after: 100 }, children: part.lines.map((line, index) => run(line, size, index > 0 ? { break: 1 } : {})) })];
  }
  if (part.kind === 'list') return part.items.map((item) => new Paragraph({ bullet: { level: 0 }, alignment: justify, spacing: { after: 40 }, children: [run(item, size)] }));
  if (part.kind === 'planilha') return [tableBlock(part), new Paragraph({ spacing: { after: 100 }, children: [] })];
  if (part.kind === 'carta') return letterParagraphs(part);
  if (part.kind === 'fechamento') return closingParagraphs(part, context);
  return [];
};
