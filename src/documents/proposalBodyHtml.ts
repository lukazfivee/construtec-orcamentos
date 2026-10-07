// Blocos de texto do corpo da proposta em HTML (PDF e documento do cliente). Tudo passa por escapeHtml.
import type { BodyPart } from '../shared/proposalBody';
import { escapeHtml } from './proposalDocumentCommon';

// So entra no documento quando a proposta tem corpo montado; o layout antigo nao recebe nenhuma regra nova.
export const BODY_HTML_CSS = `
    .body-p { margin: 0 0 2mm; }
    table.summary + .body-p, table.summary + ul.body-list { margin-top: 3mm; }
    ul.body-list { margin: 0 0 2mm; padding-left: 5mm; font-size: 8.5pt; }
    ul.body-list li { margin: 0 0 0.8mm; overflow-wrap: anywhere; break-inside: avoid; page-break-inside: avoid; }`;

export const bodyTextPartHtml = (part: BodyPart): string => {
  if (part.kind === 'heading') return `<h2>${escapeHtml(part.text)}</h2>`;
  if (part.kind === 'paragraph') return `<p class="copy body-p">${escapeHtml(part.lines.join('\n'))}</p>`;
  if (part.kind === 'list') return `<ul class="body-list">${part.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  return '';
};
