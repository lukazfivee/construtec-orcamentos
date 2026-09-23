import { Container } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

// Valores undefined viram a string "undefined" dentro do Container; omitir
// as chaves opcionais nao configuradas mantem os fallbacks do servidor.
function definedEnv(vars) {
  return Object.fromEntries(Object.entries(vars).filter(([, value]) => value !== undefined));
}

export class OrcamentosApi extends Container {
  defaultPort = 8080;
  sleepAfter = '5m';
  enableInternet = true;
  envVars = definedEnv({
    DATABASE_URL: env.DATABASE_URL,
    SESSION_SECRET: env.SESSION_SECRET,
    CONSTRUTEC_SETUP_TOKEN: env.CONSTRUTEC_SETUP_TOKEN,
    CONSTRUTEC_ALLOWED_ORIGINS: env.CONSTRUTEC_ALLOWED_ORIGINS,
    CONSTRUTEC_INTEGRATION_KEY: env.CONSTRUTEC_INTEGRATION_KEY,
    CENTRO_CUSTOS_API_URL: env.CENTRO_CUSTOS_API_URL,
    CONSTRUTEC_IDENTITY_KEY: env.CONSTRUTEC_IDENTITY_KEY,
    CENTRO_CUSTOS_IDENTITY_URL: env.CENTRO_CUSTOS_IDENTITY_URL,
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
};
