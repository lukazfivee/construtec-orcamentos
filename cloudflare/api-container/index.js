import { Container } from '@cloudflare/containers';
export { ContainerProxy } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

// Valores undefined viram a string "undefined" dentro do Container; omitir
// as chaves opcionais nao configuradas mantem os fallbacks do servidor.
function definedEnv(vars) {
  return Object.fromEntries(Object.entries(vars).filter(([, value]) => value !== undefined));
}

// O Container nao alcanca o workers.dev do Centro de Custos (mesma conta
// Cloudflare). As chamadas HTTPS para esse host (login, sessao e
// sincronizacao) sao interceptadas e repassadas pelo service binding CENTRO.
// O Node do Container confia na CA da interceptacao via NODE_EXTRA_CA_CERTS.
const CENTRO_HOST = 'centro-custos-api.construtec-reports.workers.dev';
const INTERCEPT_CA = '/etc/cloudflare/certs/cloudflare-containers-ca.crt';

export class OrcamentosApi extends Container {
  static outboundByHost = {
    [CENTRO_HOST]: (request, bindings) => bindings.CENTRO.fetch(request),
  };

  interceptHttps = true;

  defaultPort = 8080;
  sleepAfter = '5m';
  enableInternet = true;
  envVars = definedEnv({
    DATABASE_URL: env.DATABASE_URL,
    SESSION_SECRET: env.SESSION_SECRET,
    CONSTRUTEC_SETUP_TOKEN: env.CONSTRUTEC_SETUP_TOKEN,
    CONSTRUTEC_ALLOWED_ORIGINS: env.CONSTRUTEC_ALLOWED_ORIGINS,
    CONSTRUTEC_PUBLIC_URL: env.CONSTRUTEC_PUBLIC_URL,
    CONSTRUTEC_INTEGRATION_KEY: env.CONSTRUTEC_INTEGRATION_KEY,
    CENTRO_CUSTOS_API_URL: env.CENTRO_CUSTOS_API_URL,
    CONSTRUTEC_IDENTITY_KEY: env.CONSTRUTEC_IDENTITY_KEY,
    CENTRO_CUSTOS_IDENTITY_URL: env.CENTRO_CUSTOS_IDENTITY_URL,
    NODE_EXTRA_CA_CERTS: INTERCEPT_CA,
  });
}

export default {
  async fetch(request, bindings) {
    const path = new URL(request.url).pathname;
    if (path === '/health' || path.startsWith('/api/')) {
      if (!bindings.DATABASE_URL || !bindings.SESSION_SECRET
        || !bindings.CONSTRUTEC_SETUP_TOKEN || !bindings.CONSTRUTEC_ALLOWED_ORIGINS) {
        return Response.json({ error: 'Serviço aguardando configuração.' }, { status: 503 });
      }
      return bindings.API.getByName('production').fetch(request);
    }
    return bindings.ASSETS.fetch(request);
  },

  // Reenvio da outbox para o Centro de Custos mesmo com o Container dormindo
  // (sleepAfter): o Cron acorda o Container e dispara uma passada.
  async scheduled(_controller, bindings, ctx) {
    if (!bindings.DATABASE_URL || !bindings.CONSTRUTEC_INTEGRATION_KEY) return;
    ctx.waitUntil(bindings.API.getByName('production').fetch('http://container/internal/outbox/retry', {
      method: 'POST',
      // Sem BOM/espacos: o Headers recusa o U+FEFF e o Container compara a chave limpa.
      headers: { 'X-Construtec-Integration-Key': String(bindings.CONSTRUTEC_INTEGRATION_KEY).replace(/^\uFEFF/, '').trim() },
    }));
  },
};
