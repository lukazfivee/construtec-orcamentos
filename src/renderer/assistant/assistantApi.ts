// Liga as ferramentas do assistente as APIs tipadas do app (as mesmas das telas, com a sessao de quem esta logado).
import { clientsApi, dashboardApi, kitsApi, proposalApi } from '../api';
import type { CommitApi } from './assistantCommit';
import type { EditApi } from './proposalEdit';
import type { AssistantApi } from './assistantTools';

export const liveAssistantApi: AssistantApi = {
  proposals: () => proposalApi.list(),
  proposal: (id) => proposalApi.byId(id),
  history: (id) => proposalApi.history(id),
  tracking: (id) => proposalApi.centerTracking(id),
  dashboard: () => dashboardApi.get(),
  clients: (query) => clientsApi.list(query),
  kits: () => kitsApi.list(),
  catalog: (query) => proposalApi.catalog(query),
};

// Criacao da proposta do rascunho: as mesmas chamadas do formulario Nova proposta e do cadastro de clientes.
export const liveCommitApi: CommitApi = {
  createClient: (input) => clientsApi.create(input),
  createWork: (clientId, input) => clientsApi.createWork(clientId, input),
  createProposal: (input) => proposalApi.create(input),
  updateBdi: (proposalId, bdi) => proposalApi.updateBdi(proposalId, bdi),
  updateTax: (proposalId, tax) => proposalApi.updateTax(proposalId, tax),
  standardMonthlyHours: async (proposalId) => (await proposalApi.labor(proposalId)).standardMonthlyHours,
  addLabor: (proposalId, input) => proposalApi.addLabor(proposalId, input),
  importItems: (proposalId, items) => proposalApi.importBatch(proposalId, items),
};

// Aplicar alteracoes numa proposta existente: as mesmas chamadas do editor.
export const liveEditApi: EditApi = {
  details: (id, input) => proposalApi.updateDetails(id, input),
  updateBdi: (id, bdi) => proposalApi.updateBdi(id, bdi),
  updateTax: (id, tax) => proposalApi.updateTax(id, tax),
  updateItem: (id, itemId, patch) => proposalApi.updateItem(id, itemId, patch),
  removeItems: (id, itemIds) => proposalApi.removeItems(id, itemIds),
  importItems: (id, items) => proposalApi.importBatch(id, items),
  addLabor: (id, input) => proposalApi.addLabor(id, input),
  updateLabor: (id, laborId, input) => proposalApi.updateLabor(id, laborId, input),
  removeLabor: (id, laborId) => proposalApi.removeLabor(id, laborId),
};
