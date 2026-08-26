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
  active: boolean;
  updatedAt: string;
};

export type CatalogImportItem = Omit<CatalogProduct, 'id' | 'updatedAt'>;

export type CatalogImportStatus = 'new' | 'updated' | 'unchanged' | 'no_price';

export type CatalogImportPreviewItem = CatalogImportItem & {
  status: CatalogImportStatus;
};

export type CatalogImportPreview = {
  items: CatalogImportPreviewItem[];
  summary: {
    new: number;
    updated: number;
    unchanged: number;
    noPrice: number;
  };
};

export type ExsatBatchPreview = {
  items: CatalogImportItem[];
  connected: boolean;
  sourceCount: number;
  ignored: number;
  failedUrls: string[];
};

export type ExsatSyncHistoryEntry = {
  id: string;
  startedAt: string;
  completedAt: string;
  mode: 'full' | 'incremental' | 'manual';
  pagesRead: number;
  itemsFound: number;
  created: number;
  updated: number;
  ignored: number;
  failedPages: number;
};

export type ExsatSyncInfo = {
  lastSyncAt?: string;
  lastFullSyncAt?: string;
  history: ExsatSyncHistoryEntry[];
};

export type CatalogImportFile = {
  canceled: boolean;
  kind?: 'table' | 'image';
  name?: string;
  text?: string;
  ocrEngine?: 'cloudflare' | 'windows';
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

export type ProposalLaborItem = {
  id: string;
  description: string;
  professionalCount: number;
  monthlySalary: number;
  monthlyFood: number;
  monthlyTransport: number;
  monthlyOtherCosts: number;
  standardMonthlyHours: number;
  plannedHours: number;
  monthlyCost: number;
  hourlyRate: number;
  totalCost: number;
};

export type ProposalLaborInput = Omit<ProposalLaborItem, 'id' | 'monthlyCost' | 'hourlyRate' | 'totalCost'>;

export type ProposalDetail = {
  id: string;
  clientId: string;
  workId: string | null;
  number: string;
  revision: number;
  clientName: string;
  workName: string;
  scope: string;
  status: 'draft' | 'review' | 'sent' | 'approved' | 'rejected';
  bdiMultiplier: number;
  standardMonthlyHours: number;
  validUntil: string | null;
  responsibleName: string;
  updatedAt: string;
  isLatest: boolean;
  items: ProposalLine[];
  laborItems: ProposalLaborItem[];
  totals: {
    materials: number;
    labor: number;
    baseCost: number;
    additions: number;
    finalValue: number;
    cost: number;
    sale: number;
    grossResult: number;
    marginPercent: number;
  };
};

export type WorkRecord = {
  id: string;
  clientId: string;
  name: string;
  address: string | null;
  active: boolean;
  updatedAt: string;
};

export type ClientRecord = {
  id: string;
  legalName: string;
  tradeName: string | null;
  document: string | null;
  updatedAt: string;
  works: WorkRecord[];
};

export type ProposalRevisionSummary = {
  id: string;
  number: string;
  revision: number;
  status: ProposalDetail['status'];
  itemCount: number;
  totalSale: number;
  responsibleName: string;
  updatedAt: string;
  isLatest: boolean;
};

export type ProposalSummary = {
  id: string;
  number: string;
  revision: number;
  clientName: string;
  workName: string;
  status: ProposalDetail['status'];
  itemCount: number;
  totalSale: number;
  updatedAt: string;
};

export type ApiErrorPayload = {
  error: string;
  details?: unknown;
};
