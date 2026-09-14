import type { AppSettings, ProposalDetail, ProposalExportOptions, ProposalLine } from '../shared/contracts';
import { documentTitle, escapeHtml, groupItemsByCategory, money, quantity } from './proposalDocumentCommon';
import { proposalLogoBase64, proposalPresentation } from './proposalPresentation';

export { proposalFileBaseName } from './proposalDocumentCommon';
export { buildProposalDocx, buildProposalDocxBlob } from './proposalDocx';

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
    margins: { top: 12 / 25.4, bottom: 18 / 25.4, left: 14 / 25.4, right: 14 / 25.4 },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;box-sizing:border-box;margin:0;padding:0 14mm;font-size:7pt;font-family:Arial,Helvetica,sans-serif;color:#1e293b;line-height:1.4;-webkit-print-color-adjust:exact;">
      <div style="width:100%;height:2px;background:#12A9D1;margin-bottom:3px;-webkit-print-color-adjust:exact;"></div>
      <table style="width:100%;border-collapse:collapse;border:none;">
        <tr>
          <td style="font-weight:bold;color:#163d69;font-size:7.5pt;letter-spacing:0.2px;padding:0;">${escapeHtml(content.company)} • CNPJ: ${escapeHtml(content.cnpj)}</td>
          <td style="text-align:right;color:#334155;font-size:7.5pt;padding:0;">Pág. <span class="pageNumber"></span> / <span class="totalPages"></span></td>
        </tr>
        <tr>
          <td colspan="2" style="color:#52616b;font-size:6.8pt;padding-top:1px;">Sede: ${escapeHtml(content.address)} &bull; Contato: ${escapeHtml(content.phone)} &bull; ${escapeHtml(content.email)}</td>
        </tr>
      </table>
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
    <td class="center">${++index}</td>
    <td>
      <span class="item-desc">${escapeHtml(item.description)}</span>
      ${showCodes && item.code ? `<small class="item-code">${escapeHtml(item.code)}</small>` : ''}
    </td>
    <td class="center">${escapeHtml(item.unit)}</td>
    <td class="number">${quantity.format(item.quantity)}</td>
    <td class="number">${money.format(item.unitSale)}</td>
    <td class="number bold">${money.format(item.totalSale)}</td>
  </tr>`;

  const groupByCategory = options?.groupByCategory ?? true;
  const groups = groupByCategory
    ? groupItemsByCategory(proposal)
        .map(([category, items]) => {
          const rowsHtml = items.map(itemRow).join('');
          return `<tbody><tr class="category"><td colspan="6">${escapeHtml(category)}</td></tr>${rowsHtml}</tbody>`;
        })
        .join('')
    : proposal.items.length
    ? `<tbody>${proposal.items.map(itemRow).join('')}</tbody>`
    : '';

  const labor =
    content.labor > 0
      ? `<tbody><tr class="category"><td colspan="6">Mão de Obra e Serviços Técnicos</td></tr>
    <tr>
      <td class="center">${++index}</td>
      <td><span class="item-desc">Serviços técnicos e operacionais conforme escopo da proposta.</span></td>
      <td class="center">vb</td>
      <td class="number">1</td>
      <td class="number">${money.format(content.labor)}</td>
      <td class="number bold">${money.format(content.labor)}</td>
    </tr></tbody>`
      : '';

  const tableBody = groups + labor || '<tbody><tr><td colspan="6" class="center muted">Nenhum item incluído nesta revisão.</td></tr></tbody>';
  const summary = content.summary
    .map(
      ([label, value], i) =>
        `<tr class="${i === content.summary.length - 1 ? 'grand-total' : ''}"><th>${escapeHtml(label)}</th><td class="number">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  const terms = content.terms
    .map(([label, value]) => `<p class="term"><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</p>`)
    .join('');

  const todayFormatted = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(documentTitle(proposal))}</title>
  <style>
    @page { size: A4; margin: 12mm 14mm 18mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #17252d; }
    body { font: 9.5pt Arial, Helvetica, sans-serif; line-height: 1.35; -webkit-font-smoothing: antialiased; }
    
    .timbrado-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #12A9D1; padding-bottom: 3.5mm; margin-bottom: 4mm; break-inside: avoid; page-break-inside: avoid; }
    .timbrado-left { display: flex; align-items: center; gap: 4mm; }
    .timbrado-logo { max-height: 15mm; max-width: 48mm; width: auto; height: auto; object-fit: contain; display: block; }
    .timbrado-company { font-size: 7.5pt; color: #485966; line-height: 1.3; }
    .timbrado-company-name { font-size: 8.5pt; font-weight: bold; color: #163d69; }
    .timbrado-right { text-align: right; font-size: 7.5pt; color: #52616b; line-height: 1.3; border-left: 2px solid #e1edf2; padding-left: 3.5mm; min-width: 38mm; }
    .timbrado-badge { font-size: 7pt; font-weight: bold; color: #12A9D1; letter-spacing: 0.8px; }
    .timbrado-doc-ref { font-size: 9.5pt; font-weight: bold; color: #163d69; margin: 1px 0; }
    
    .identity { margin-bottom: 4mm; background: #f4f9fb; border: 1px solid #d4e7ee; border-radius: 3px; padding: 2.5mm 3.5mm; break-inside: avoid; page-break-inside: avoid; }
    .identity-table { width: 100%; border-collapse: collapse; }
    .identity-table td { padding: 1mm 1.5mm; border: none; font-size: 8.5pt; color: #17252d; vertical-align: top; }
    
    h1 { margin: 3mm 0 2mm; text-align: center; font-size: 12pt; color: #163d69; letter-spacing: 0.5px; text-transform: uppercase; break-after: avoid; page-break-after: avoid; }
    h2 { margin: 3.5mm 0 1.5mm; font-size: 9pt; color: #163d69; text-transform: uppercase; border-bottom: 1px solid #e8f0f3; padding-bottom: 1mm; break-after: avoid; page-break-after: avoid; }
    
    p { margin: 0 0 2mm; orphans: 3; widows: 3; font-size: 8.5pt; }
    .lead { font-size: 8.5pt; color: #3b4d58; margin-bottom: 3mm; }
    .copy { white-space: pre-line; overflow-wrap: anywhere; }
    
    table.pricing { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 1.5mm; }
    thead { display: table-header-group; break-after: avoid; }
    th, td { padding: 1.8mm 1.5mm; border-bottom: 1px solid #d4e2e7; vertical-align: top; font-size: 8pt; overflow-wrap: anywhere; }
    thead th { background: #163d69; color: #fff; font-size: 7.5pt; text-align: left; font-weight: bold; border-bottom: 2px solid #12A9D1; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .category td { background: #eaf3f6; color: #163d69; font-weight: bold; padding: 1.5mm 2mm; font-size: 8pt; border-left: 3px solid #12A9D1; }
    .center { text-align: center; }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    .bold { font-weight: bold; }
    .item-desc { display: block; }
    .item-code { display: block; color: #60717a; font-size: 6.8pt; margin-top: 0.5mm; }
    .muted { color: #5D7480; }
    
    .summary { width: 100%; border-collapse: collapse; margin-top: 2.5mm; break-inside: avoid; page-break-inside: avoid; }
    .summary th { text-align: left; width: 70%; font-weight: normal; padding: 1.5mm 2mm; font-size: 8.5pt; border-bottom: 1px solid #e1edf2; }
    .summary td { width: 30%; padding: 1.5mm 2mm; font-size: 8.5pt; border-bottom: 1px solid #e1edf2; }
    .grand-total th, .grand-total td { background: #d9edf3; font-size: 9pt; font-weight: bold; color: #163d69; border-top: 1.5px solid #12A9D1; border-bottom: 2px solid #163d69; }
    
    .commercial-box { margin-top: 3.5mm; break-inside: avoid; page-break-inside: avoid; }
    .term { margin-bottom: 1.2mm; font-size: 8.5pt; }
    .closing { margin-top: 3mm; font-size: 8pt; color: #485966; }
    
    .document-footer { margin-top: 6mm; break-inside: avoid; page-break-inside: avoid; font-family: Arial, Helvetica, sans-serif; }
    .footer-line { height: 2px; background: #12A9D1; margin-bottom: 1.5mm; }
    .footer-top { display: flex; justify-content: flex-end; margin-bottom: 1mm; font-size: 7.5pt; color: #334155; }
    .footer-company { font-weight: bold; font-size: 7.5pt; color: #0f172a; margin-bottom: 1px; letter-spacing: 0.2px; }
    .footer-text { font-size: 6.8pt; color: #1e293b; line-height: 1.35; margin-bottom: 1px; }
    .footer-text b { font-weight: bold; color: #0f172a; }
    
    @media screen {
      body { max-width: 210mm; margin: 15px auto; padding: 14mm; background: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.12); border-radius: 3px; }
    }
    @media print {
      * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .document-footer { display: none; }
    }
  </style>
</head>
<body>
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
      <div>${todayFormatted}</div>
    </div>
  </header>

  <div class="identity">
    <table class="identity-table">
      <tr>
        <td style="width: 60%"><b>Cliente:</b> ${escapeHtml(proposal.clientName)}</td>
        <td style="width: 40%"><b>A/C:</b> ${escapeHtml(proposal.responsibleName || '—')}</td>
      </tr>
      <tr>
        <td><b>Local / Obra:</b> ${escapeHtml(proposal.workName || '—')}</td>
        <td><b>Referência:</b> ${escapeHtml(proposal.number)} | Rev. ${String(proposal.revision).padStart(2, '0')}</td>
      </tr>
      ${content.conditions.scope ? `<tr><td colspan="2"><b>Escopo:</b> ${escapeHtml(content.conditions.scope)}</td></tr>` : ''}
    </table>
  </div>

  <h1>PROPOSTA TÉCNICA COMERCIAL</h1>
  <p class="lead">Prezados Senhores,<br>Apresentamos nossa proposta técnica e comercial para fornecimento de equipamentos, materiais e execução dos serviços descritos a seguir.</p>

  <h2>Apresentação — ${escapeHtml(content.brand)}</h2>
  <p>${escapeHtml(content.presentation)}</p>

  <h2>1. Composição e Precificação</h2>
  <table class="pricing">
    <colgroup>
      <col style="width: 7%">
      <col style="width: 45%">
      <col style="width: 8%">
      <col style="width: 10%">
      <col style="width: 15%">
      <col style="width: 15%">
    </colgroup>
    <thead>
      <tr>
        <th class="center">ITEM</th>
        <th>DESCRIÇÃO</th>
        <th class="center">UN.</th>
        <th class="number">QTD.</th>
        <th class="number">VALOR UNIT.</th>
        <th class="number">VALOR TOTAL</th>
      </tr>
    </thead>
    ${tableBody}
  </table>

  <table class="summary">
    <tbody>${summary}</tbody>
  </table>

  <section class="commercial-box">
    <h2>2. Condições Comerciais</h2>
    ${terms}
    <p>Valores expressos em moeda corrente nacional (BRL).</p>
  </section>

  <p class="closing">Permanecemos à disposição para quaisquer esclarecimentos técnicos ou comerciais referentes a esta proposta.</p>

  <footer class="document-footer">
    <div class="footer-line"></div>
    <div class="footer-top"><span>Pág. 1 / 1</span></div>
    <div class="footer-company">${escapeHtml(content.company)}</div>
    <div class="footer-text"><b>Sede:</b> ${escapeHtml(content.address)} &bull; Contato: ${escapeHtml(content.phone)}</div>
    <div class="footer-text"><b>E-mail:</b> ${escapeHtml(content.email)}</div>
  </footer>
</body>
</html>`;
};
