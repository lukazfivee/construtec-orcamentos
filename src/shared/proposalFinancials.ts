import type { ProposalDetail } from './contracts';
import { multiplyDecimal, sumDecimal } from './decimal';

type DecimalInput = number | string;

// Regra do Valor final (decisao do Lucas, 22/10): o Valor final e a soma da venda dos itens, para a soma das linhas
// da tabela e do PDF bater com o total. A mesma regra existe em SQL (proposalTotalsSql.finalValueSql); mude as duas juntas.
// - Item com venda automatica (venda unit. sem imposto = round(custo x BDI) com folga de 0,011): base = custo do item x BDI,
//   sem arredondar, para propostas sem preco digitado manterem o mesmo Valor final de antes, ao centavo.
// - Item com venda digitada a mao: base = quantidade x venda unit. sem imposto.
// - Valor final = round((soma das bases + mao de obra x BDI) x (1 + imposto%), 2).
export type ProposalSaleLine = {
  quantity: DecimalInput;
  unitCost: DecimalInput;
  /** Venda unitaria SEM imposto, como gravada em proposal_items.sale_unit_price. */
  saleUnitPrice: DecimalInput;
};

// Casas usadas nas somas intermediarias: custo (2) x BDI (4) e quantidade (4) x venda (2) cabem em 6, sem perda.
const EXACT = 6;

export const isManualSale = (line: Pick<ProposalSaleLine, 'unitCost' | 'saleUnitPrice'>, bdiMultiplier: DecimalInput) =>
  Math.abs(Number(line.saleUnitPrice) - multiplyDecimal([line.unitCost, bdiMultiplier])) >= 0.011;

/** Base de venda do item, sem imposto e sem arredondar para centavos. */
export const lineSaleBase = (line: ProposalSaleLine, bdiMultiplier: DecimalInput) => (isManualSale(line, bdiMultiplier)
  ? multiplyDecimal([line.quantity, line.saleUnitPrice], 1, EXACT)
  : multiplyDecimal([multiplyDecimal([line.quantity, line.unitCost]), bdiMultiplier], 1, EXACT));

const totalsFromSaleBase = (
  materials: number,
  labor: number,
  itemsSaleBase: number,
  bdiMultiplier: number,
  taxPercentage: number,
) => {
  const baseCost = sumDecimal([materials, labor]);
  const saleBeforeTax = sumDecimal([itemsSaleBase, multiplyDecimal([labor, bdiMultiplier], 1, EXACT)], EXACT);
  const finalValue = multiplyDecimal([saleBeforeTax, sumDecimal([100, taxPercentage], 4)], 100);
  const additions = sumDecimal([finalValue, -baseCost]);

  if (taxPercentage > 0) {
    // Imposto = Valor final - Valor final / (1 + imposto%): subtotal + imposto fecha o Valor final ao centavo.
    const subtotalWithBdi = multiplyDecimal([finalValue, 100], sumDecimal([100, taxPercentage], 4));
    const taxAmount = sumDecimal([finalValue, -subtotalWithBdi]);
    return {
      materials,
      labor,
      baseCost,
      subtotalWithBdi,
      taxPercentage,
      taxAmount,
      finalValue,
      additions,
    };
  }

  return { materials, labor, baseCost, finalValue, additions };
};

/** Totais pela regra da venda dos itens. */
export const calculateProposalTotalsFromLines = (
  lines: ProposalSaleLine[],
  labor: number,
  bdiMultiplier: number,
  taxPercentage = 0,
) => {
  const materials = sumDecimal(lines.map(line => multiplyDecimal([line.quantity, line.unitCost])));
  const itemsSaleBase = sumDecimal(lines.map(line => lineSaleBase(line, bdiMultiplier)), EXACT);
  return totalsFromSaleBase(materials, labor, itemsSaleBase, bdiMultiplier, taxPercentage);
};

export const countManualSales = (lines: ProposalSaleLine[], bdiMultiplier: DecimalInput) =>
  lines.filter(line => isManualSale(line, bdiMultiplier)).length;

/** Totais quando todos os itens tem venda automatica (custo x BDI): mesma regra, sem linhas. */
export const calculateProposalTotals = (
  materials: number,
  labor: number,
  bdiMultiplier: number,
  taxPercentage = 0
) => totalsFromSaleBase(materials, labor, multiplyDecimal([materials, bdiMultiplier], 1, EXACT), bdiMultiplier, taxPercentage);

// Linhas do detalhe para a regra; sem a venda sem imposto (dado antigo), o item conta como venda automatica.
export const proposalSaleLines = (proposal: Pick<ProposalDetail, 'items' | 'bdiMultiplier'>, bdiMultiplier = proposal.bdiMultiplier): ProposalSaleLine[] =>
  proposal.items.map(item => ({
    quantity: item.quantity,
    unitCost: item.unitCost,
    // Mudar o BDI regrava toda venda como custo x BDI novo (updateProposalBdi): a previa com outro BDI trata tudo como automatico.
    saleUnitPrice: item.saleUnitPrice !== undefined && bdiMultiplier === proposal.bdiMultiplier
      ? item.saleUnitPrice
      : multiplyDecimal([item.unitCost, bdiMultiplier]),
  }));

// Os aliases legados cost/sale representam somente materiais.
export const getProposalFinancials = (proposal: ProposalDetail) => {
  const materials = proposal.totals.materials ?? sumDecimal(proposal.items.map(item => item.totalCost));
  const labor = proposal.totals.labor ?? sumDecimal((proposal.laborItems ?? []).map(item => item.totalCost));
  const taxPercentage = proposal.taxPercentage ?? 0;
  const calculated = calculateProposalTotalsFromLines(proposalSaleLines(proposal), labor, proposal.bdiMultiplier, taxPercentage);
  return {
    ...calculated,
    materials,
    baseCost: proposal.totals.baseCost ?? calculated.baseCost,
    finalValue: proposal.totals.finalValue ?? calculated.finalValue,
    additions: proposal.totals.additions ?? calculated.additions,
    taxPercentage,
    taxAmount: proposal.totals.taxAmount ?? calculated.taxAmount ?? 0,
  };
};
