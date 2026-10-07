import type { AppSettings, ProposalDetail, ProposalExportOptions } from '../shared/contracts';
import { CONSTRUTEC_LOGO_BASE64 } from '../assets/logoBase64';
import { CONSTRUTEC_WATERMARK_BASE64 } from '../assets/watermarkBase64';
import { DEFAULT_PRESENTATION } from '../shared/proposalBody';
import { getProposalFinancials } from '../shared/proposalFinancials';
import {
  commercialLaborTotal,
  date,
  money,
  parseCommercialConditions,
  roundMoney,
} from './proposalDocumentCommon';

export const proposalLogoBase64 = (): string => CONSTRUTEC_LOGO_BASE64;
export const proposalWatermarkBase64 = (): string => CONSTRUTEC_WATERMARK_BASE64;
// A escolha de cada exportacao vale; sem ela, o padrao da empresa.
export const watermarkEnabled = (settings?: AppSettings, options?: ProposalExportOptions): boolean => options?.watermark ?? settings?.pdfWatermark ?? false;
const decodeBase64 = (value: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'base64');
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
export const proposalWatermark = (): Uint8Array => decodeBase64(CONSTRUTEC_WATERMARK_BASE64);
export const proposalLogo = (): Uint8Array => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(CONSTRUTEC_LOGO_BASE64, 'base64');
  }
  const binary = atob(CONSTRUTEC_LOGO_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const proposalPresentation = (
  proposal: ProposalDetail,
  settings?: AppSettings,
  options?: ProposalExportOptions
) => {
  const conditions = parseCommercialConditions(proposal.scope);
  const financials = getProposalFinancials(proposal);
  const total = financials.finalValue;
  const taxPercentage = proposal.taxPercentage ?? 0;
  const taxAmount = financials.taxAmount ?? 0;
  const subtotalBeforeTax = Math.round((total - taxAmount + Number.EPSILON) * 100) / 100;
  const includeLabor = options?.includeLabor ?? true;
  const labor = includeLabor ? commercialLaborTotal(proposal) : 0;
  const materials = labor > 0 ? roundMoney(subtotalBeforeTax - labor) : subtotalBeforeTax;
  const taxEntry: [string, string] | null = taxAmount > 0
    ? [`Impostos (${String(taxPercentage).replace('.', ',')}%)`, money.format(taxAmount)]
    : null;

  const summary: Array<[string, string]> = labor > 0
    ? [
        ['Valor dos materiais e equipamentos', money.format(materials)],
        ['Valor dos serviços técnicos', money.format(labor)],
        ...(taxEntry ? [taxEntry] : []),
        ['Valor total da proposta', money.format(total)],
      ]
    : [
        ['Subtotal dos itens e serviços', money.format(subtotalBeforeTax)],
        ...(taxEntry ? [taxEntry] : []),
        ['Valor total da proposta', money.format(total)],
      ];

  const includeTerms = options?.includeCommercialTerms ?? true;
  const includeNotes = options?.includeNotes ?? true;
  const combinedNotes = [conditions.notes, options?.customNotes?.trim()].filter(Boolean).join('\n\n');

  const terms: Array<[string, string]> = includeTerms
    ? [
        ['Forma de pagamento', conditions.paymentTerms || 'A combinar com o cliente'],
        ['Validade da proposta', proposal.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : '30 dias'],
        ['Prazo de execução', conditions.executionTerm || 'A combinar após o aceite da proposta'],
        ['Garantia', conditions.warranty || 'Conforme normas técnicas aplicáveis'],
        ...(includeNotes && combinedNotes ? [['Observações', combinedNotes] as [string, string]] : []),
      ]
    : includeNotes && combinedNotes
    ? [['Observações', combinedNotes] as [string, string]]
    : [];

  const docNumber = settings?.document?.trim() || '32.992.946/0001-78';
  const address = settings?.address?.trim() || 'Rua Metodio Coelho, 62, Ed. Cidadella Center I, Sala 112, Salvador/BA';
  const phone = settings?.phone?.trim() || '(71) 99294-1099';
  const email = settings?.email?.trim() || 'supervisao@rcconstrutec.com.br';
  const contactParts = [address, phone ? `Contato: ${phone}` : '', email ? `E-mail: ${email}` : ''].filter(Boolean);

  return {
    conditions,
    summary,
    terms,
    labor,
    brand: settings?.tradeName?.trim() || 'CONSTRUTEC',
    company: settings?.companyName?.trim() || 'LAC CONSTRUTEC CONSTRUTORA EIRELI',
    cnpj: docNumber,
    address,
    phone,
    email,
    contact: contactParts.join(' • '),
    presentation: DEFAULT_PRESENTATION,
  };
};
