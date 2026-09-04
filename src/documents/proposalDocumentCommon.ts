import type { ProposalDetail } from '../shared/contracts';

export const NAVY = '031F29';
export const BLUE = '12A9D1';
export const LIGHT_BLUE = 'E8F8FC';
export const LINE = 'D6E4E9';
export const MUTED = '5D7480';
export const WHITE = 'FFFFFF';
export const INK = '0B2530';

export const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
export const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

export type CommercialConditions = {
  scope: string;
  executionTerm: string;
  paymentTerms: string;
  warranty: string;
  notes: string;
};

export const emptyConditions = (scope = ''): CommercialConditions => ({
  scope: scope.trim() || 'A definir',
  executionTerm: '',
  paymentTerms: '',
  warranty: '',
  notes: '',
});

const fieldFromLines = (lines: string[], names: string[]) => {
  const prefixes = names.map((name) => `${name}:`.toLowerCase());
  const found = lines.find((line) => prefixes.some((prefix) => line.toLowerCase().startsWith(prefix)));
  return found ? found.slice(found.indexOf(':') + 1).trim() : '';
};

export const parseCommercialConditions = (scope: string): CommercialConditions => {
  try {
    const parsed = JSON.parse(scope) as Partial<CommercialConditions>;
    if (parsed && typeof parsed === 'object' && typeof parsed.scope === 'string') {
      return {
        scope: parsed.scope.trim() || 'A definir',
        executionTerm: typeof parsed.executionTerm === 'string' ? parsed.executionTerm.trim() : '',
        paymentTerms: typeof parsed.paymentTerms === 'string' ? parsed.paymentTerms.trim() : '',
        warranty: typeof parsed.warranty === 'string' ? parsed.warranty.trim() : '',
        notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
      };
    }
  } catch {
    const lines = scope.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const lineScope = fieldFromLines(lines, ['escopo', 'scope']);
    if (lineScope) {
      return {
        scope: lineScope,
        executionTerm: fieldFromLines(lines, ['prazo', 'prazo de execução', 'execução']),
        paymentTerms: fieldFromLines(lines, ['pagamento', 'forma de pagamento']),
        warranty: fieldFromLines(lines, ['garantia']),
        notes: fieldFromLines(lines, ['observações', 'observacao', 'observacoes', 'notas']),
      };
    }
  }
  return emptyConditions(scope);
};

export const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const documentTitle = (proposal: ProposalDetail) =>
  `${proposal.number}-REV-${String(proposal.revision).padStart(2, '0')}`;

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const documentTotal = (proposal: ProposalDetail) => proposal.totals.finalValue ?? proposal.totals.sale;

export const commercialMaterialsTotal = (proposal: ProposalDetail) =>
  roundMoney(proposal.items.reduce((total, item) => total + item.totalSale, 0));

export const commercialLaborTotal = (proposal: ProposalDetail) => {
  const laborCost = proposal.totals.labor ?? 0;
  return laborCost > 0 ? roundMoney(laborCost * proposal.bdiMultiplier) : 0;
};

export const proposalFileBaseName = (proposal: ProposalDetail) =>
  `Proposta-${documentTitle(proposal)}`.replace(/[^a-zA-Z0-9._-]/g, '-');

export const groupItemsByCategory = (proposal: ProposalDetail) => {
  const grouped = new Map<string, typeof proposal.items>();
  for (const item of proposal.items) {
    const key = (item.category ?? 'Outros').trim() || 'Outros';
    const existing = grouped.get(key);
    if (existing) existing.push(item);
    else grouped.set(key, [item]);
  }
  return [...grouped.entries()];
};
