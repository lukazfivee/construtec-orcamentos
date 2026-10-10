// Liga as ferramentas do assistente as APIs tipadas do app (as mesmas das telas, com a sessao de quem esta logado).
import { clientsApi, dashboardApi, kitsApi, proposalApi } from '../api';
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
