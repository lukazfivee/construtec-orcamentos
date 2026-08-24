export type CatalogProduct = {
  id: string;
  code: string;
  manufacturer: string | null;
  model: string | null;
  description: string;
  category: string;
  unit: string;
  currentCost: number;
  source: string;
};

export type ProposalLine = {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  unitSale: number;
  totalSale: number;
};

export type ProposalDetail = {
  id: string;
  number: string;
  revision: number;
  clientName: string;
  workName: string;
  scope: string;
  status: 'draft' | 'review' | 'sent' | 'approved' | 'rejected';
  bdiMultiplier: number;
  validUntil: string | null;
  responsibleName: string;
  updatedAt: string;
  items: ProposalLine[];
  totals: {
    cost: number;
    sale: number;
    grossResult: number;
    marginPercent: number;
  };
};

export type ApiErrorPayload = {
  error: string;
  details?: unknown;
};
