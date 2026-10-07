// Blocos de texto do corpo da proposta no Word: titulo de secao, paragrafos (quebras de linha preservadas) e lista com marcadores.
import { HeadingLevel, Paragraph, TextRun } from 'docx';
import type { BodyPart } from '../shared/proposalBody';
import { INK } from './proposalDocumentCommon';

const run = (text: string, extra: { break?: number } = {}) => new TextRun({ text, size: 18, color: INK, font: 'Arial', ...extra });

export const bodyTextParagraphs = (part: BodyPart): Paragraph[] => {
  if (part.kind === 'heading') return [new Paragraph({ style: 'ProposalHeading', heading: HeadingLevel.HEADING_1, text: part.text })];
  if (part.kind === 'paragraph') {
    return [new Paragraph({ spacing: { after: 100 }, children: part.lines.map((line, index) => run(line, index > 0 ? { break: 1 } : {})) })];
  }
  if (part.kind === 'list') return part.items.map((item) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [run(item)] }));
  return [];
};
