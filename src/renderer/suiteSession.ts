import { CENTRO_CUSTOS_CLOUD_URL } from './api';
import { proposalFromHash } from './useProposalDeepLink';

// Sessao corporativa entregue pelo app Suite Construtec do Windows em #sessao=<token>. O Centro de Custos
// so troca codigos de uso unico (#handoff=) com a chave de servico, que e segredo do servidor e nao existe
// no instalador; dentro da Suite o app entrega a propria sessao da conta, que o servidor local valida no Centro.
// So vale com `runtime.suite === true`: no navegador um link com #sessao= nao pode trocar a conta de quem abre.
const SESSION_TOKEN = /^[A-Za-z0-9+/_=-]{20,200}$/;

export const suiteSessionFromHash = (hash: string) => {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('sessao');
  return token && SESSION_TOKEN.test(token) ? token : null;
};

// Navegador: o Orcamentos sem sessao pergunta uma vez por aba ao Centro de Custos (mesma conta). Com a conta
// logada la, o Centro devolve um codigo de uso unico (#handoff=); sem ela, devolve #centro=0 e vale o login daqui.
// Mesma regra em public/m/app.js. A pagina do Centro e public/entrar-orcamentos.js, no repositorio do Centro.
export const ORCAMENTOS_WEB = 'https://construtec-orcamentos-cloud.construtec-reports.workers.dev';
export const CENTRO_ENTRADA = `${CENTRO_CUSTOS_CLOUD_URL}/entrar-orcamentos.html`;
const ASKED_KEY = 'construtec.auth.centro';

export const centroEntryUrl = (origin: string, hash: string) => {
  if (origin !== ORCAMENTOS_WEB) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (['handoff', 'sessao', 'centro'].some((key) => params.has(key))) return null;
  const proposta = proposalFromHash(hash);
  return `${CENTRO_ENTRADA}${proposta ? `#proposta=${proposta}` : ''}`;
};

// Dentro de uma moldura (iframe de outro site) nao pergunta: a pagina do Centro so aceita ser embutida pelo
// proprio Centro e pelo Orcamentos (frame-ancestors), entao o navegador bloquearia e a moldura ficaria vazia.
export const isFramed = (w: { readonly self: unknown; readonly top: unknown }) => {
  try { return w.self !== w.top; } catch { return true; }
};

// Marca a pergunta desta aba. Sem como guardar a marca (armazenamento bloqueado) nao pergunta: evita ida e volta sem fim.
export const claimCentroEntry = (storage: Pick<Storage, 'getItem' | 'setItem'>) => {
  try {
    if (storage.getItem(ASKED_KEY)) return false;
    storage.setItem(ASKED_KEY, '1');
    return true;
  } catch {
    return false;
  }
};

// Depois de "Sair", recarregar a aba nao entra de novo pelo Centro.
export const skipCentroEntry = (storage: Pick<Storage, 'setItem'>) => {
  try { storage.setItem(ASKED_KEY, '1'); } catch { /* sem armazenamento: o Centro nao e perguntado mesmo */ }
};
