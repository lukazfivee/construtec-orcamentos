const hasConfig = (bindings) => Boolean(
  bindings.DATABASE_URL && bindings.SESSION_SECRET
  && bindings.CONSTRUTEC_SETUP_TOKEN && bindings.CONSTRUTEC_ALLOWED_ORIGINS,
);

export async function routeRequest(request, bindings) {
  const path = new URL(request.url).pathname;
  // Liveness na borda: monitor externo não acorda o Container nem o Neon.
  if (path === '/health') {
    const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    }
    const ok = hasConfig(bindings);
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({ ok, scope: 'worker' }), {
      status: ok ? 200 : 503, headers,
    });
  }
  if (path.startsWith('/api/')) {
    if (!hasConfig(bindings)) return Response.json({ error: 'Serviço aguardando configuração.' }, { status: 503 });
    return bindings.API.getByName('production').fetch(request);
  }
  return bindings.ASSETS.fetch(request);
}
