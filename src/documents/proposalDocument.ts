import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AppSettings, ProposalDetail } from '../shared/contracts';
import {
  commercialLaborTotal,
  commercialMaterialsTotal,
  date,
  documentTitle,
  documentTotal,
  escapeHtml,
  groupItemsByCategory,
  money,
  parseCommercialConditions,
} from './proposalDocumentCommon';

export { proposalFileBaseName } from './proposalDocumentCommon';
export { buildProposalDocx } from './proposalDocx';

const logoDataUri = () => {
  const candidates = [
    path.join(process.cwd(), 'src', 'assets', 'logo-preta.png'),
    path.join(process.resourcesPath ?? '', 'assets', 'logo-preta.png'),
  ];
  const logoPath = candidates.find((candidate) => existsSync(candidate));
  return logoPath ? `data:image/png;base64,${readFileSync(logoPath).toString('base64')}` : '';
};

export const buildProposalHtml = (proposal: ProposalDetail, settings?: AppSettings) => {
  const validUntil = proposal.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : 'A definir';
  const conditions = parseCommercialConditions(proposal.scope);
  const materialsTotal = commercialMaterialsTotal(proposal);
  const laborTotal = commercialLaborTotal(proposal);
  const total = documentTotal(proposal);
  const grouped = groupItemsByCategory(proposal);
  let itemIndex = 0;
  const categorySections = grouped.map(([category, items]) => {
    const categoryTotal = items.reduce((sum, item) => sum + item.totalSale, 0);
    const rows = items.map((item) => {
      itemIndex += 1;
      return `
    <tr>
      <td class="center">${itemIndex}</td>
      <td><strong>${escapeHtml(item.code)}</strong><br><span>${escapeHtml(item.description)}</span></td>
      <td class="center">${escapeHtml(item.unit)}</td>
      <td class="number">${Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(item.quantity)}</td>
      <td class="number">${money.format(item.unitSale)}</td>
      <td class="number strong">${money.format(item.totalSale)}</td>
    </tr>`;
    }).join('');
    return `
    <tr class="category-row"><td colspan="6"><strong>${escapeHtml(category)}</strong> — ${money.format(categoryTotal)}</td></tr>
    ${rows}`;
  }).join('');
  const laborSection = laborTotal > 0 ? `
    <tr class="category-row"><td colspan="6"><strong>Mão de obra</strong> — ${money.format(laborTotal)}</td></tr>
    <tr>
      <td class="center">${itemIndex + 1}</td>
      <td><strong>Mão de obra</strong><br><span>Serviços técnicos conforme escopo da proposta.</span></td>
      <td class="center">vb</td>
      <td class="number">1</td>
      <td class="number">${money.format(laborTotal)}</td>
      <td class="number strong">${money.format(laborTotal)}</td>
    </tr>` : '';
  const tableRows = (categorySections + laborSection) || '<tr><td colspan="6" class="center">Nenhum item incluído nesta revisão.</td></tr>';
  const conditionCards: Array<[string, string]> = [
    ['Validade da proposta', validUntil],
    ['Prazo de execução', conditions.executionTerm || 'A definir'],
    ['Forma de pagamento', conditions.paymentTerms || 'A definir'],
    ['Garantia', conditions.warranty || 'A definir'],
    ['Valores', 'Expressos em reais (BRL).'],
    ...(conditions.notes ? [['Observações', conditions.notes] as [string, string]] : []),
  ];
  const conditionRows = conditionCards.map(([label, value]) => `<div class="condition"><b>${escapeHtml(label)}</b>${escapeHtml(value)}</div>`).join('');

  const tradeName = settings?.tradeName?.trim() || 'CONSTRUTEC ENGENHARIA';
  const companyName = settings?.companyName?.trim() || 'Construtec Engenharia Ltda.';
  const logo = logoDataUri();
  const presentation = 'A CONSTRUTEC é uma empresa especializada no desenvolvimento de soluções tecnológicas aplicadas e na execução de serviços nas áreas de automação, elétrica, incêndio, dados, voz e imagem, oferecendo soluções integradas para ambientes corporativos e de alta criticidade.';
  const scopeItems = proposal.items.map((item) => `<li>Fornecimento de ${escapeHtml(item.description)}.</li>`).join('')
    || '<li>Fornecimento, instalação, configuração e comissionamento conforme o escopo desta proposta.</li>';

  return `<!doctype html>
  <html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(documentTitle(proposal))}</title>
  <style>
    @page { size: A4; margin: 16mm 14mm 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0b2530; font: 10.5pt "Segoe UI", Arial, sans-serif; }
    header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 9mm; border-bottom: 2px solid #173f73; }
    .brand { color: #031f29; font-size: 20pt; font-weight: 800; letter-spacing: -.4px; }
    .brand-logo { display: block; width: 48mm; height: auto; }
    .tagline { margin-top: 2mm; color: #5d7480; font-size: 8.5pt; }
    .doc-id { text-align: right; }
    .doc-id b { display: block; color: #173f73; font-size: 12pt; }
    .doc-id span { color: #5d7480; font-size: 8.5pt; }
    h1 { margin: 10mm 0 2mm; color: #173f73; font-size: 21pt; line-height: 1.1; text-transform: uppercase; }
    .subtitle { margin: 0 0 8mm; color: #5d7480; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 9mm; }
    .meta div { padding: 4mm; background: #f2f8fa; border-left: 3px solid #12a9d1; }
    .meta label { display: block; margin-bottom: 1.5mm; color: #5d7480; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
    .meta strong { color: #0b2530; font-size: 10.5pt; }
    h2 { margin: 8mm 0 3mm; color: #173f73; font-size: 12pt; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead { display: table-header-group; }
    th { padding: 3mm 2mm; color: white; background: #2d94a3; font-size: 7.5pt; text-align: left; text-transform: uppercase; letter-spacing: .25px; }
    td { padding: 3mm 2mm; border-bottom: 1px solid #d6e4e9; vertical-align: middle; font-size: 8.5pt; overflow-wrap: anywhere; }
    td span { color: #4d596b; }
    .center { text-align: center; }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    .strong { font-weight: 700; }
    .category-row td { background: #e8f8fc; color: #173f73; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: .3px; border-top: 2px solid #12a9d1; }
    .total { display: flex; justify-content: flex-end; align-items: center; gap: 10mm; margin: 5mm 0 9mm auto; padding: 5mm; width: 78mm; color: white; background: #2d94a3; }
    .total span { font-size: 9pt; font-weight: 600; }
    .total strong { font-size: 15pt; font-variant-numeric: tabular-nums; }
    .breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin: 4mm 0; }
    .breakdown div { display: flex; justify-content: space-between; padding: 2.5mm 3mm; background: #f2f8fa; border-left: 3px solid #12a9d1; font-size: 8.5pt; }
    .breakdown span { color: #5d7480; }
    .breakdown strong { color: #0b2530; font-variant-numeric: tabular-nums; }
    .conditions { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
    .condition { padding: 4mm; border: 1px solid #d6e4e9; }
    .condition b { display: block; margin-bottom: 1.5mm; color: #173f73; }
    .note { margin-top: 7mm; color: #5d7480; font-size: 8pt; line-height: 1.5; }
    footer { position: fixed; right: 0; bottom: -11mm; left: 0; padding-top: 3mm; color: #5d7480; border-top: 1px solid #2bb673; font-size: 7.5pt; text-align: center; }
    .template-header { display:grid; grid-template-columns:47mm 1fr; min-height:28mm; margin-bottom:6mm; border:1px solid #d6e4e9; }
    .template-brand { display:flex; align-items:center; padding:5mm; background:#031f29; }
    .template-brand .brand-logo { width:37mm; filter:brightness(0) invert(1); }
    .template-title { display:flex; flex-direction:column; justify-content:center; padding:4mm 5mm; color:#173f73; text-transform:uppercase; }
    .template-title b { font-size:13pt; }
    .template-title span { margin-top:1mm; color:#0b2530; font-size:9pt; }
    body > h1 { margin:6mm 0 2mm; color:#173f73; font-size:11pt; }
    .identity { width:100%; margin-bottom:7mm; border-collapse:collapse; font-size:9pt; }
    .identity th,.identity td { padding:2.2mm 3mm; border:1px solid #d6e4e9; text-align:left; vertical-align:top; }
    .identity th { width:25mm; color:#173f73; background:#e8f8fc; font-size:8pt; text-transform:uppercase; }
    .template-section { margin:6mm 0 2mm; color:#173f73; font-size:11pt; text-transform:uppercase; }
    .template-copy { margin:0 0 3mm; line-height:1.42; }
    .scope-list { margin:0; padding-left:5mm; }
    .scope-list li { margin:1.2mm 0; }
    .summary { width:100%; margin:0; border-collapse:collapse; font-size:8.5pt; }
    .summary th,.summary td { padding:2.4mm 3mm; border:1px solid #d6e4e9; }
    .summary th { width:72%; color:#173f73; background:#e8f8fc; text-align:right; }
    .summary td { font-weight:700; text-align:right; }
  </style></head><body>
    <header class="template-header">
      <div class="template-brand">
        ${logo ? `<img class="brand-logo" src="${logo}" alt="${escapeHtml(tradeName)}">` : `<div class="brand">${escapeHtml(tradeName)}</div>`}
      </div>
      <div class="template-title">
        <b>Proposta Técnica-Comercial</b>
        <span>${escapeHtml(conditions.scope)} · ${escapeHtml(proposal.number)} · REV.${String(proposal.revision).padStart(2, '0')}</span>
      </div>
    </header>
    <table class="identity"><tbody><tr><th>Data</th><td>${date.format(new Date())}</td></tr><tr><th>Cliente</th><td>${escapeHtml(proposal.clientName)}</td></tr><tr><th>Solicitante</th><td>${escapeHtml(proposal.responsibleName)}</td></tr><tr><th>Local</th><td>${escapeHtml(proposal.workName)}</td></tr><tr><th>Objeto</th><td>${escapeHtml(conditions.scope)}</td></tr></tbody></table>
    <h1>Apresentação – Construtec</h1><p class="template-copy">${presentation}</p>
    <h2 class="template-section">1. Objetivo</h2><p class="template-copy">${escapeHtml(conditions.scope)}</p>
    <h2 class="template-section">2. Escopo dos serviços</h2><ul class="scope-list">${scopeItems}</ul>
    <h2 class="template-section">3. Precificação</h2>
    <table><colgroup><col style="width:6%"><col style="width:42%"><col style="width:8%"><col style="width:10%"><col style="width:16%"><col style="width:18%"></colgroup><thead><tr><th class="center">Item</th><th>Descrição</th><th class="center">Un.</th><th class="number">Qtd.</th><th class="number">Valor unit.</th><th class="number">Valor total</th></tr></thead><tbody>${tableRows}</tbody></table>
    <table class="summary"><tbody><tr><th>Subtotal - equipamentos e materiais</th><td>${money.format(materialsTotal)}</td></tr>${laborTotal > 0 ? `<tr><th>Mão de obra - instalação, configuração, programação, testes e comissionamento</th><td>${money.format(laborTotal)}</td></tr>` : ''}</tbody></table>
    <div class="total"><span>VALOR TOTAL</span><strong>${money.format(total)}</strong></div>
    <h2 class="template-section">4. Condições comerciais</h2><section class="conditions">${conditionRows}</section>
    <p class="note">${escapeHtml(companyName)} | Proposta ${escapeHtml(proposal.number)} | Revisão ${String(proposal.revision).padStart(2, '0')}</p>
    <footer>${escapeHtml(companyName)} · Documento gerado automaticamente</footer>
  </body></html>`;
};
