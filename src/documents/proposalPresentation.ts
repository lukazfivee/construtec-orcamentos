import type { AppSettings, ProposalDetail, ProposalExportOptions } from '../shared/contracts';
import { CONSTRUTEC_LOGO_BASE64 } from '../assets/logoBase64';
import { commercialLaborTotal, commercialMaterialsTotal, date, documentTotal, money, parseCommercialConditions, roundMoney } from './proposalDocumentCommon';

export const proposalLogoBase64 = (): string => CONSTRUTEC_LOGO_BASE64;
export const proposalLogo = (): Buffer => Buffer.from(CONSTRUTEC_LOGO_BASE64, 'base64');

export const proposalPresentation = (
  proposal: ProposalDetail,
  settings?: AppSettings,
  options?: ProposalExportOptions
) => {
  const conditions = parseCommercialConditions(proposal.scope);
  const total = documentTotal(proposal);
  const includeLabor = options?.includeLabor ?? true;
  const labor = includeLabor ? commercialLaborTotal(proposal) : 0;
  const materials = labor > 0 ? roundMoney(total - labor) : total;

  const summary: Array<[string, string]> = [
    ['Valor dos materiais e equipamentos', money.format(materials)],
    ...(labor > 0 ? [['Valor dos serviços', money.format(labor)] as [string, string]] : []),
    ['Valor total da proposta', money.format(total)],
  ];

  const includeTerms = options?.includeCommercialTerms ?? true;
  const includeNotes = options?.includeNotes ?? true;
  const combinedNotes = [conditions.notes, options?.customNotes?.trim()].filter(Boolean).join('\n\n');

  const terms: Array<[string, string]> = includeTerms
    ? [
        ['Forma de pagamento', conditions.paymentTerms || 'A definir'],
        ['Validade da proposta', proposal.validUntil ? date.format(new Date(`${proposal.validUntil}T00:00:00Z`)) : 'A definir'],
        ['Prazo de execução', conditions.executionTerm || 'A definir'],
        ['Garantia', conditions.warranty || 'A definir'],
        ...(includeNotes && combinedNotes ? [['Observações', combinedNotes] as [string, string]] : []),
      ]
    : includeNotes && combinedNotes
    ? [['Observações', combinedNotes] as [string, string]]
    : [];

  const docNumber = settings?.document?.trim() || '32.992.946/0001-78';
  const address = settings?.address?.trim() || 'Rua Metodio Coelho, 62, EDIFICIO CIDADELLA CENTER  I, Sala 112/ PARQUE BELA VISTA/ Salvador BA /40050-450';
  const phone = settings?.phone?.trim() || '(71) 99294-1099';
  const email = settings?.email?.trim() || 'supervisao@rcconstrutec.com.br / engenharia@rcconstrutec.com.br';
  const contactParts = [address, phone ? `Contato: ${phone}` : '', email ? `E-mail: ${email}` : ''].filter(Boolean);

  return {
    conditions, summary, terms, labor,
    brand: settings?.tradeName?.trim() || 'CONSTRUTEC',
    company: settings?.companyName?.trim() || 'LAC CONSTRUTEC CONSTRUTORA EIRELI',
    cnpj: docNumber,
    address,
    phone,
    email,
    contact: contactParts.join(' • '),
    presentation: 'A CONSTRUTEC atua no desenvolvimento de soluções de engenharia e tecnologia, automação, elétrica, combate a incêndio, infraestrutura de dados e telecomunicações. Apresentamos nossa proposta técnica e comercial para o atendimento ao escopo descrito a seguir.',
    scopeLines: [
      ...proposal.items.map((item) => `Fornecimento de ${item.description}.`),
      ...(labor > 0 ? ['Execução dos serviços técnicos descritos no objetivo desta proposta.'] : []),
    ],
  };
};
