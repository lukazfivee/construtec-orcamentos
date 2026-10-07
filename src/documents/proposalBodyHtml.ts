// Blocos de texto do corpo da proposta em HTML (PDF e documento do cliente). Tudo passa por escapeHtml.
import type { BodyPart } from '../shared/proposalBody';
import { escapeHtml } from './proposalDocumentCommon';

// So entra no documento quando a proposta tem corpo montado; o layout antigo nao recebe nenhuma regra nova.
export const BODY_HTML_CSS = `
    .body-p { margin: 0 0 2mm; }
    table.summary + .body-p, table.summary + ul.body-list { margin-top: 3mm; }
    ul.body-list { margin: 0 0 2mm; padding-left: 5mm; font-size: 8.5pt; }
    ul.body-list li { margin: 0 0 0.8mm; overflow-wrap: anywhere; break-inside: avoid; page-break-inside: avoid; }
    h3.sub { margin: 3mm 0 1.5mm; font-size: 8.8pt; color: #163d69; break-after: avoid; page-break-after: avoid; }
    table.pricing { break-after: avoid; page-break-after: avoid; }
    table.pricing tbody:last-of-type tr:last-child { break-after: avoid; page-break-after: avoid; }
    table.summary { break-before: avoid; page-break-before: avoid; }
    .pricing-caption { margin: 1.5mm 0 0; padding: 1.6mm 2mm; background: #eaf3f6; border-left: 3px solid #12A9D1; color: #163d69; font-weight: bold; font-size: 8pt; text-align: center; break-after: avoid; page-break-after: avoid; }`;

// Texto de uma propriedade `content` do CSS: aspas, barra e quebra de linha escapadas.
const cssText = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\A ')}"`;

export type LetterCssInput = { logoBase64: string | null; brand: string; reference: string; footer: string };

// Proposta com carta de abertura: formato de carta (texto maior, titulos sem filete). Cabecalho com logo e rodape com
// pagina saem em todas as paginas pelas caixas de margem do @page; na tela o cabecalho fica no topo do documento.
export const letterHtmlCss = (input: LetterCssInput): string => {
  const rule = '2px solid #163d69';
  const logo = input.logoBase64 ? 'var(--run-logo) no-repeat left bottom 2mm / auto 15mm' : 'none';
  return `
    :root { ${input.logoBase64 ? `--run-logo: url(data:image/png;base64,${input.logoBase64});` : ''} }
    @page {
      margin: 38mm 16mm 24mm;
      @top-left { margin-bottom: 4mm; content: ${input.logoBase64 ? '""' : cssText(input.brand)}; width: 60%; background: ${logo}; border-bottom: ${rule}; font: bold 13pt Arial, sans-serif; color: #163d69; vertical-align: bottom; padding-bottom: 2mm; }
      @top-right { margin-bottom: 4mm; content: ${cssText(input.reference)}; width: 40%; border-bottom: ${rule}; font: 7.5pt Arial, sans-serif; color: #52616b; text-align: right; vertical-align: bottom; padding-bottom: 2mm; }
      @bottom-left { margin-top: 3mm; content: ${cssText(input.footer)}; width: 82%; border-top: 2px solid #12A9D1; font: 7pt/1.35 Arial, sans-serif; color: #334155; white-space: pre-line; vertical-align: top; padding-top: 1.5mm; }
      @bottom-right { margin-top: 3mm; content: "Pág. " counter(page) " / " counter(pages); width: 18%; border-top: 2px solid #12A9D1; font: 7.5pt Arial, sans-serif; color: #334155; text-align: right; vertical-align: top; padding-top: 1.5mm; }
    }
    body { font-size: 10pt; line-height: 1.5; }
    .run-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; border-bottom: ${rule}; padding-bottom: 2mm; margin: 0 0 7mm; }
    .run-logo { height: 15mm; width: 60mm; background: ${logo}; }
    .run-brand { font-size: 13pt; font-weight: bold; color: #163d69; }
    .run-ref { text-align: right; font-size: 7.5pt; color: #52616b; line-height: 1.3; }
    .letter p { margin: 0 0 2.5mm; font-size: 10pt; }
    .letter .l-date { margin-bottom: 5mm; }
    .letter .l-recipient { font-weight: bold; margin-bottom: 5mm; text-transform: uppercase; }
    .letter .l-att { display: flex; gap: 3mm; margin-bottom: 4mm; }
    .letter .l-att span { display: block; }
    .letter .l-ref { margin-bottom: 4mm; font-weight: bold; text-align: justify; }
    .letter h1 { margin: 9mm 0 7mm; font-size: 15pt; color: #163d69; text-decoration: underline; text-underline-offset: 1mm; }
    h2 { font-size: 10.5pt; border-bottom: none; margin: 5mm 0 2mm; padding: 0; }
    h3.sub { font-size: 10pt; margin: 4mm 0 2mm; }
    .body-p { margin: 0 0 2.5mm; font-size: 10pt; text-align: justify; orphans: 3; widows: 3; }
    ul.body-list { font-size: 10pt; padding-left: 6mm; margin: 0 0 3mm; }
    ul.body-list li { margin: 0 0 1.2mm; text-align: justify; }
    .closing-block { margin-top: 4mm; break-inside: avoid; page-break-inside: avoid; }
    .closing-block .signature { margin-top: 14mm; font-size: 9pt; }
    .document-footer { margin-top: 10mm; }
    @media print { .run-header { display: none; } }`;
};

export type BodyHtmlContext = { showSignature: boolean; company: string; brand: string };

const letterHtml = (part: Extract<BodyPart, { kind: 'carta' }>): string => {
  const hasAttention = Boolean(part.attention || part.department);
  return `<section class="letter">
  ${part.dateLine ? `<p class="l-date">${escapeHtml(part.dateLine)}</p>` : ''}
  ${part.recipient ? `<p class="l-recipient">${escapeHtml(part.recipient)}</p>` : ''}
  ${hasAttention ? `<p class="l-att"><b>At.:</b><span>${[part.attention, part.department].filter(Boolean).map(escapeHtml).join('<br>')}</span></p>` : ''}
  ${part.reference ? `<p class="l-ref">REF.: ${escapeHtml(part.reference)}</p>` : ''}
  <h1>${escapeHtml(part.title)}</h1>
  ${part.greeting ? `<p>${escapeHtml(part.greeting)}</p>` : ''}
  ${part.intro ? `<p class="body-p">${escapeHtml(part.intro)}</p>` : ''}
</section>`;
};

const closingHtml = (part: Extract<BodyPart, { kind: 'fechamento' }>, context: BodyHtmlContext): string => `<div class="closing-block">
  ${part.paragraphs.map((lines) => `<p class="copy body-p">${escapeHtml(lines.join('\n'))}</p>`).join('')}
  ${context.showSignature ? `<div class="signature"><div class="signature-line"></div><b>${escapeHtml(part.signer || context.brand)}</b>${part.role ? `<span>${escapeHtml(part.role)}</span>` : ''}<span>${escapeHtml(context.company)}</span></div>` : ''}
</div>`;

export const bodyTextPartHtml = (part: BodyPart, context: BodyHtmlContext): string => {
  if (part.kind === 'heading') return part.sub ? `<h3 class="sub">${escapeHtml(part.text)}</h3>` : `<h2>${escapeHtml(part.text)}</h2>`;
  if (part.kind === 'paragraph') return `<p class="copy body-p">${escapeHtml(part.lines.join('\n'))}</p>`;
  if (part.kind === 'list') return `<ul class="body-list">${part.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  if (part.kind === 'carta') return letterHtml(part);
  if (part.kind === 'fechamento') return closingHtml(part, context);
  return '';
};
