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

export type ExsatValidationStatus = 'confirmed' | 'divergent' | 'unavailable' | 'error';
export type CatalogImportItem = Omit<CatalogProduct, 'id' | 'updatedAt'> & { validationStatus?: ExsatValidationStatus };
export type CatalogImportStatus = 'new' | 'updated' | 'unchanged' | 'no_price' | ExsatValidationStatus;
export type CatalogImportPreviewItem = CatalogImportItem & { status: CatalogImportStatus };
export type CatalogImportPreview = { items: CatalogImportPreviewItem[]; summary: { new: number; updated: number; unchanged: number; noPrice: number } };
export type ExsatPageFailure = {
  url: string;
  stage: 'http' | 'electron' | 'parser' | 'validation' | 'unknown';
  code: string;
  message: string;
};
export type ExsatValidationSummary = {
  confirmed: number;
  divergent: number;
  unavailable: number;
  error: number;
};
export type ExsatBatchPreview = {
  items: CatalogImportItem[];
  connected: boolean;
  sourceCount: number;
  ignored: number;
  failures: ExsatPageFailure[];
  validationSummary?: ExsatValidationSummary;
};
export type ExsatSyncHistoryEntry = { id: string; startedAt: string; completedAt: string; mode: 'full' | 'incremental' | 'manual'; pagesRead: number; itemsFound: number; created: number; updated: number; ignored: number; failedPages: number };
export type ExsatSyncInfo = { lastSyncAt?: string; lastFullSyncAt?: string; history: ExsatSyncHistoryEntry[] };
export type CatalogImportFile = { canceled: boolean; kind?: 'table' | 'image'; name?: string; text?: string; ocrEngine?: 'cloudflare' | 'windows' };

export type ProposalLine = {
  id: string;
  code: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  unitSale: number;
  totalSale: number;
  catalogCurrentCost?: number | null;
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
  /** Horas por profissional, preservado para compatibilidade. */
  plannedHours: number;
  plannedHoursPerProfessional?: number;
  plannedTeamHours?: number;
  monthlyCost: number;
  hourlyRate: number;
  totalCost: number;
};

export type ProposalLaborInput = Omit<ProposalLaborItem, 'id' | 'monthlyCost' | 'hourlyRate' | 'totalCost' | 'plannedHoursPerProfessional' | 'plannedTeamHours'>;

export type ProposalDetail = {
  id: string;
  seriesId?: string;
  clientId: string;
  workId: string | null;
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
  isLatest: boolean;
  hasApprovedRevision?: boolean;
  items: ProposalLine[];
  laborItems?: ProposalLaborItem[];
  standardMonthlyHours?: number;
  totals: {
    /** @deprecated Subtotal de materiais. Para custo completo use baseCost. */
    cost: number;
    /** @deprecated Venda dos materiais. Para contrato completo use finalValue. */
    sale: number;
    grossResult: number;
    marginPercent: number;
    materials?: number;
    labor?: number;
    baseCost?: number;
    additions?: number;
    finalValue?: number;
  };
};

export type WorkRecord = { id: string; clientId: string; name: string; address: string | null; active: boolean; updatedAt: string };
export type ClientRecord = { id: string; legalName: string; tradeName: string | null; document: string | null; updatedAt: string; works: WorkRecord[] };
export type ProposalRevisionSummary = { id: string; number: string; revision: number; status: ProposalDetail['status']; itemCount: number; totalSale: number; responsibleName: string; updatedAt: string; isLatest: boolean };
export type ProposalSummary = { id: string; number: string; revision: number; clientName: string; workName: string; status: ProposalDetail['status']; itemCount: number; totalSale: number; updatedAt: string; validUntil?: string | null; isLatest?: boolean; hasApprovedRevision?: boolean };
export type ApiErrorPayload = { error: string; details?: unknown };

export type AuthRole = 'admin' | 'commercial' | 'viewer';
export type AuthUser = { id: string; name: string; email: string; role: AuthRole };
export type AuthSession = { token: string; user: AuthUser };
export type AuthSetupStatus = { requiresSetup: boolean };
export type UserRecord = AuthUser & { active: boolean; updatedAt: string };

export type KitItemSummary = {
  id: string;
  productId: string;
  code: string;
  description: string;
  category: string;
  unit: string;
  currentCost: number;
  quantity: number;
  totalCost: number;
  position: number;
};

export type KitSummary = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  active: boolean;
  itemCount: number;
  totalEstimatedCost: number;
  updatedAt: string;
};

export type KitDetail = KitSummary & {
  items: KitItemSummary[];
};

export type KitInput = {
  name: string;
  description?: string | null;
  category: string;
  active?: boolean;
  items: Array<{ productId: string; quantity: number }>;
};

export type AppSettings = {
  companyName: string;
  tradeName: string;
  document: string;
  phone: string;
  email: string;
  address: string;
  defaultResponsible: string;
  defaultBdi: number;
  defaultStandardHours: number;
  defaultValidityDays: number;
};

export type CommercialPipelineStage = {
  status: ProposalDetail['status'];
  label: string;
  count: number;
  totalValue: number;
  percentage: number;
};

export type AbcItem = {
  code: string;
  description: string;
  unit: string;
  category: string;
  totalQuantity: number;
  totalValue: number;
  proposalsCount: number;
  cumulativePercentage: number;
  abcClass: 'A' | 'B' | 'C';
};

export type TopClientMetric = {
  clientName: string;
  proposalsCount: number;
  approvedValue: number;
  inNegotiationValue: number;
  totalValue: number;
};

export type CommercialIntelligenceMetrics = {
  conversionRate: number;
  averageTicketApproved: number;
  averageTicketNegotiation: number;
  pipeline: CommercialPipelineStage[];
  topItems: AbcItem[];
  topClients: TopClientMetric[];
};

export type DashboardMetrics = {
  activeProposalsCount: number;
  approvedProposalsCount: number;
  totalInNegotiation: number;
  totalApproved: number;
  totalClientsCount: number;
  totalProductsCount: number;
  totalKitsCount: number;
  recentProposals: ProposalSummary[];
  intelligence?: CommercialIntelligenceMetrics;
};

export type ProposalExportOptions = {
  format?: 'pdf' | 'docx' | 'both';
  groupByCategory?: boolean;
  showProductCodes?: boolean;
  includeLabor?: boolean;
  includeCommercialTerms?: boolean;
  includeNotes?: boolean;
  customNotes?: string;
};

