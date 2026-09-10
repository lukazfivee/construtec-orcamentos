import type { AppSettings, ProposalDetail, ProposalExportOptions, ProposalLine } from '../shared/contracts';
import { date, documentTitle, escapeHtml, groupItemsByCategory, money, quantity } from './proposalDocumentCommon';
import { proposalLogoBase64, proposalPresentation } from './proposalPresentation';

export { proposalFileBaseName } from './proposalDocumentCommon';
export { buildProposalDocx } from './proposalDocx';

export const proposalPdfOptions = (
  proposal: ProposalDetail,
  settings?: AppSettings,
  options?: ProposalExportOptions
): Record<string, unknown> => {
  const content = proposalPresentation(proposal, settings, options);
  return {
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margins: { top: 14 / 25.4, bottom: 25 / 25.4, left: 14 / 25.4, right: 14 / 25.4 },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;box-sizing:border-box;margin:0;padding:0 14mm;font-size:7pt;font-family:Arial,Helvetica,sans-serif;color:#1e293b;line-height:1.4;">
      <div style="width:100%;height:2px;background:#28539e;margin-bottom:2px;"></div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:1px;font-size:8pt;color:#334155;">
        <span>Pág. <span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
      <div style="font-weight:bold;color:#0f172a;font-size:7.5pt;margin-bottom:1px;letter-spacing:0.2px;">${escapeHtml(content.company)}</div>
      <div style="color:#1e293b;margin-bottom:1px;"><b>Sede:</b> ${escapeHtml(content.address)} Contato: ${escapeHtml(content.phone)}</div>
      <div style="color:#1e293b;"><b>E-mail:</b> ${escapeHtml(content.email)}</div>
    </div>`,
  };
};

export const buildProposalHtml = (
  proposal: ProposalDetail,
  settings?: AppSettings,
  options?: ProposalExportOptions
) => {
  const content = proposalPresentation(proposal, settings, options);
  const logo = proposalLogoBase64();
  let index = 0;
  const showCodes = options?.showProductCodes ?? true;
  const itemRow = (item: ProposalLine) => `<tr>
    <td class="center">${++index}</td><td>${escapeHtml(item.description)}${showCodes && item.code ? `<small>${escapeHtml(item.code)}</small>` : ''}</td>
    <td class="center">${escapeHtml(item.unit)}</td><td class="number">${quantity.format(item.quantity)}</td>
    <td class="number">${money.format(item.unitSale)}</td><td class="number">${money.format(item.totalSale)}</td></tr>`;

  const groupByCategory = options?.groupByCategory ?? true;
  const groups = groupByCategory
    ? groupItemsByCategory(proposal).map(([category, items]) => {
        const [first, ...rest] = items;
        return `<tbody class="category-start"><tr class="category"><td colspan="6">${escapeHtml(category)}</td></tr>${itemRow(first)}</tbody>
          ${rest.length ? `<tbody>${rest.map(itemRow).join('')}</tbody>` : ''}`;
      }).join('')
    : (proposal.items.length ? `<tbody>${proposal.items.map(itemRow).join('')}</tbody>` : '');

  const labor = content.labor > 0 ? `<tbody class="category-start"><tr class="category"><td colspan="6">Serviços</td></tr>
    <tr><td class="center">${++index}</td><td>Serviços técnicos conforme escopo da proposta.</td><td class="center">vb</td><td class="number">1</td><td class="number">${money.format(content.labor)}</td><td class="number">${money.format(content.labor)}</td></tr></tbody>` : '';
  const rows = groups + labor || '<tbody><tr><td colspan="6">Nenhum item incluído nesta revisão.</td></tr></tbody>';
  const summary = content.summary.map(([label, value], i) => `<tr class="${i === content.summary.length - 1 ? 'grand-total' : ''}"><th>${escapeHtml(label)}</th><td class="number">${escapeHtml(value)}</td></tr>`).join('');
  const terms = content.terms.map(([label, value]) => `<p class="term"><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</p>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(documentTitle(proposal))}</title>
  <style>
    @page { size:A4; margin:14mm 14mm 20mm; }
    * { box-sizing:border-box; }
    html,body { margin:0; background:#fff; color:#17252d; }
    body { font:10pt Arial,sans-serif; line-height:1.4; }
    .timbrado-header { display:flex; justify-content:space-between; align-items:center; border-bottom:2.5px solid #12A9D1; padding-bottom:3.5mm; margin-bottom:5mm; break-inside:avoid; page-break-inside:avoid; }
    .timbrado-left { display:flex; align-items:center; gap:4mm; }
    .timbrado-logo { max-height:16mm; max-width:48mm; width:auto; height:auto; object-fit:contain; display:block; }
    .timbrado-company { font-size:7.5pt; color:#485966; line-height:1.35; }
    .timbrado-company-name { font-size:8.5pt; font-weight:bold; color:#163d69; }
    .timbrado-right { text-align:right; font-size:7.5pt; color:#52616b; line-height:1.35; border-left:2px solid #e1edf2; padding-left:3.5mm; }
    .timbrado-badge { font-size:7pt; font-weight:bold; color:#12A9D1; letter-spacing:0.8px; }
    .timbrado-doc-ref { font-size:9.5pt; font-weight:bold; color:#163d69; }
    .identity { margin-bottom:5mm; background:#f4f9fb; border:1px solid #d4e7ee; border-radius:3px; padding:2.5mm 3.5mm; break-inside:avoid; page-break-inside:avoid; }
    .identity-table { width:100%; border-collapse:collapse; }
    .identity-table td { padding:1mm 1.5mm; border:none; font-size:8.5pt; color:#17252d; vertical-align:top; }
    h1 { margin:4mm 0; text-align:center; font-size:12.5pt; color:#163d69; letter-spacing:0.5px; }
    h2 { margin:4mm 0 2mm; font-size:9.5pt; color:#163d69; text-transform:uppercase; border-bottom:1px solid #e8f0f3; padding-bottom:1mm; }
    h1,h2 { break-after:avoid; page-break-after:avoid; }
    p { margin:0 0 2.5mm; orphans:3; widows:3; font-size:9pt; }
    .lead { font-size:9pt; color:#3b4d58; margin-bottom:3.5mm; }
    .copy { white-space:pre-line; overflow-wrap:anywhere; }
    ul { margin:0 0 2.5mm; padding-left:5mm; font-size:9pt; }
    li { margin:1mm 0; break-inside:avoid; overflow-wrap:anywhere; }
    table.pricing { width:100%; border-collapse:collapse; table-layout:fixed; margin-top:2mm; }
    thead { display:table-header-group; break-after:avoid; }
    th,td { padding:2mm 1.5mm; border-bottom:1px solid #d4e2e7; vertical-align:top; font-size:8pt; overflow-wrap:anywhere; }
    thead th { background:#163d69; color:#fff; font-size:7.5pt; text-align:left; font-weight:bold; border-bottom:2px solid #12A9D1; }
    tr { break-inside:avoid; page-break-inside:avoid; }
    .category-start { break-inside:avoid; page-break-inside:avoid; }
    .category td { background:#eaf3f6; color:#163d69; font-weight:bold; padding:1.5mm 2mm; font-size:8pt; border-left:3px solid #12A9D1; }
    .center { text-align:center; }
    .number { text-align:right; font-variant-numeric:tabular-nums; }
    small { display:block; color:#60717a; font-size:6.8pt; margin-top:0.8mm; }
    .summary { width:100%; border-collapse:collapse; margin-top:3mm; break-inside:avoid; }
    .summary th { text-align:left; width:75%; font-weight:normal; padding:1.5mm 2mm; font-size:8.5pt; border-bottom:1px solid #e1edf2; }
    .summary td { width:25%; padding:1.5mm 2mm; font-size:8.5pt; border-bottom:1px solid #e1edf2; }
    .grand-total th,.grand-total td { background:#d9edf3; font-size:9.5pt; font-weight:bold; color:#163d69; border-top:1.5px solid #12A9D1; border-bottom:2px solid #163d69; }
    .commercial { margin-top:4mm; break-inside:avoid; page-break-inside:avoid; }
    .term { margin-bottom:1.5mm; white-space:pre-line; overflow-wrap:anywhere; font-size:8.5pt; }
    .closing { margin-top:4mm; font-size:8.5pt; color:#485966; }
    .document-footer { margin-top:10mm; break-inside:avoid; page-break-inside:avoid; font-family:Arial,Helvetica,sans-serif; }
    .footer-line { height:2px; background:#28539e; margin-bottom:2mm; }
    .footer-top { display:flex; justify-content:flex-end; margin-bottom:1mm; font-size:8pt; color:#334155; }
    .footer-company { font-weight:bold; font-size:7.5pt; color:#0f172a; margin-bottom:1px; letter-spacing:0.2px; }
    .footer-text { font-size:7pt; color:#1e293b; line-height:1.4; margin-bottom:1px; }
    .footer-text b { font-weight:bold; color:#0f172a; }
    @media screen { body { max-width:210mm; padding:14mm; margin:auto; box-shadow:0 0 12px rgba(0,0,0,0.08); } }
    @media print { * { print-color-adjust:exact; -webkit-print-color-adjust:exact; } .document-footer { display:none; } }
  </style></head><body>
    <header class="timbrado-header">
      <div class="timbrado-left">
        <img class="timbrado-logo" src="data:image/png;base64,${logo}" alt="${escapeHtml(content.brand)}">
        <div class="timbrado-company">
          <div class="timbrado-company-name">${escapeHtml(content.company)}</div>
          ${content.cnpj ? `<div>CNPJ: ${escapeHtml(content.cnpj)}</div>` : ''}
          <div>Sede: ${escapeHtml(content.address)}</div>
          <div>Contato: ${escapeHtml(content.phone)} &bull; ${escapeHtml(content.email)}</div>
        </div>
      </div>
      <div class="timbrado-right">
        <div class="timbrado-badge">PROPOSTA COMERCIAL</div>
        <div class="timbrado-doc-ref">${escapeHtml(proposal.number)}</div>
        <div>Revisão ${String(proposal.revision).padStart(2, '0')}</div>
        <div>${date.format(new Date())}</div>
      </div>
    </header>
    <div class="identity">
      <table class="identity-table">
        <tr>
          <td style="width:60%"><b>Cliente:</b> ${escapeHtml(proposal.clientName)}</td>
          <td style="width:40%"><b>A/C:</b> ${escapeHtml(proposal.responsibleName || '-')}</td>
        </tr>
        <tr>
          <td><b>Local / Obra:</b> ${escapeHtml(proposal.workName || '-')}</td>
          <td><b>Referência:</b> ${escapeHtml(proposal.number)} | Rev. ${String(proposal.revision).padStart(2, '0')}</td>
        </tr>
      </table>
    </div>
    <h1>PROPOSTA TÉCNICA COMERCIAL</h1>
    <p class="lead">Prezados Senhores,<br>Apresentamos nossa proposta técnica e comercial para fornecimento de equipamentos, materiais e execução dos serviços descritos a seguir.</p>
    <h2>Apresentação — ${escapeHtml(content.brand)}</h2><p>${escapeHtml(content.presentation)}</p>
    <h2>1. Objetivo</h2><p class="copy">${escapeHtml(content.conditions.scope)}</p>
    <h2>2. Escopo dos serviços</h2>${content.scopeLines.length ? `<ul>${content.scopeLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : `<p class="copy">${escapeHtml(content.conditions.scope)}</p>`}
    <h2>3. Precificação</h2><table class="pricing"><colgroup><col style="width:6%"><col style="width:42%"><col style="width:7%"><col style="width:9%"><col style="width:17%"><col style="width:19%"></colgroup>
      <thead><tr><th class="center">ITEM</th><th>DESCRIÇÃO</th><th class="center">UN.</th><th class="number">QTD.</th><th class="number">VALOR UNIT.</th><th class="number">VALOR TOTAL</th></tr></thead>${rows}</table>
    <table class="summary"><tbody>${summary}</tbody></table>
    <section class="commercial"><h2>4. Condições comerciais</h2>${terms}<p>Valores expressos em moeda corrente nacional (BRL).</p></section>
    <p class="closing">Permanecemos à disposição para quaisquer esclarecimentos técnicos ou comerciais referentes a esta proposta.</p>
    <footer class="document-footer">
      <div class="footer-line"></div>
      <div class="footer-top"><span>Pág. 1 / 1</span></div>
      <div class="footer-company">${escapeHtml(content.company)}</div>
      <div class="footer-text"><b>Sede:</b> ${escapeHtml(content.address)} Contato: ${escapeHtml(content.phone)}</div>
      <div class="footer-text"><b>E-mail:</b> ${escapeHtml(content.email)}</div>
    </footer>
  </body></html>`;
};
