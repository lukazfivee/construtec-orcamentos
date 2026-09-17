import { Container } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

export class OrcamentosApi extends Container {
  defaultPort = 8080;
  sleepAfter = '5m';
  enableInternet = true;
  envVars = {
    DATABASE_URL: env.DATABASE_URL,
    SESSION_SECRET: env.SESSION_SECRET,
    CONSTRUTEC_SETUP_TOKEN: env.CONSTRUTEC_SETUP_TOKEN,
    CONSTRUTEC_ALLOWED_ORIGINS: env.CONSTRUTEC_ALLOWED_ORIGINS,
  };
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
