// Documento do cliente para o celular (/m/, tela "PDF da proposta"). Reaproveita o HTML do PDF da
// versao completa (buildProposalHtml) e acrescenta capa e aviso de validade conforme as escolhas.
// So leva precos de venda: custo, BDI e margem nunca entram, com ou sem a permissao p10.
import type { AppSettings, ProposalDetail, ProposalExportOptions } from '../shared/contracts';
import { getProposalFinancials } from '../shared/proposalFinancials';
import { buildProposalHtml } from './proposalDocument';
import { date, escapeHtml, money } from './proposalDocumentCommon';

export type MobileDocumentChoices = {
  model: 'completo' | 'resumido';
  cover: boolean;
  terms: boolean;
  validity: boolean;
};

const flag = (value: unknown, fallback: boolean) => {
  if (value === undefined || value === null || value === '') return fallback;
  return !['0', 'false', 'nao', 'não'].includes(String(value).toLowerCase());
};

export const parseMobileDocumentChoices = (query: Record<string, unknown>): MobileDocumentChoices => ({
  model: query.modelo === 'resumido' ? 'resumido' : 'completo',
  cover: flag(query.capa, true),
  terms: flag(query.condicoes, true),
  validity: flag(query.validade, true),
});

export const mobileExportOptions = (choices: MobileDocumentChoices): ProposalExportOptions => ({
  format: 'pdf',
  groupByCategory: true,
  showProductCodes: choices.model === 'completo',
  includeLabor: true,
  includeCommercialTerms: choices.terms,
  includeNotes: choices.model === 'completo',
});

const formatDate = (iso?: string | null) => (iso ? date.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '');

export const buildMobileProposalHtml = (proposal: ProposalDetail, settings: AppSettings | undefined, choices: MobileDocumentChoices) => {
  const html = buildProposalHtml(proposal, settings, mobileExportOptions(choices));
  const total = money.format(getProposalFinancials(proposal).finalValue);
  const validUntil = formatDate(proposal.validUntil);
  const validity = choices.validity && validUntil
    ? `<p class="m-validity">Proposta válida até ${escapeHtml(validUntil)}. Depois disso, os preços dos equipamentos podem mudar.</p>`
    : '';
  const cover = choices.cover
    ? `<section class="m-cover">
        <p class="m-kicker">Proposta comercial</p>
        <h1>${escapeHtml(proposal.workName || proposal.clientName || '')}</h1>
        <p class="m-client">${escapeHtml(proposal.clientName || '')}</p>
        <table class="m-facts">
          <tr><td>Proposta</td><td>${escapeHtml(`${proposal.number} · REV ${String(proposal.revision || 0).padStart(2, '0')}`)}</td></tr>
          ${validUntil && choices.validity ? `<tr><td>Válida até</td><td>${escapeHtml(validUntil)}</td></tr>` : ''}
          ${proposal.responsibleName ? `<tr><td>Responsável</td><td>${escapeHtml(proposal.responsibleName)}</td></tr>` : ''}
          <tr><td>Valor total</td><td><b>${escapeHtml(total)}</b></td></tr>
        </table>
      </section>`
    : '';
  const style = `<style>
    .m-cover{page-break-after:always;break-after:page;padding:60mm 0 0;font-family:Arial,Helvetica,sans-serif;color:#0b2530}
    .m-cover .m-kicker{margin:0;font-size:10pt;letter-spacing:.08em;text-transform:uppercase;color:#12a9d1;font-weight:bold}
    .m-cover h1{margin:6mm 0 2mm;font-size:24pt;color:#163d69}
    .m-cover .m-client{margin:0 0 12mm;font-size:13pt;color:#334155}
    .m-facts{border-collapse:collapse;font-size:11pt}.m-facts td{padding:2mm 8mm 2mm 0;border:none}
    .m-facts td:first-child{color:#52616b}
    .m-validity{margin:8mm 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#334155}
  </style>`;
  return html
    .replace('</head>', `${style}</head>`)
    .replace(/<body([^>]*)>/, `<body$1>${cover}`)
    .replace('</body>', `${validity}</body>`);
};
