// Servidor local de teste do kit de conferencia: o API do Orcamentos sobre um banco temporario (PGlite) e um "Centro" falso
// (contas e avisos de mentira) no lugar do diretorio central. Nada aqui toca AppData, Neon, Cloudflare ou rede.
// Variaveis: CONF_API_PORT, CONF_CENTRO_PORT, CONF_DATA_DIR (diretorio temporario do banco).
import http from 'node:http';
import { defaultSuiteMatrix } from '../../src/shared/suitePermissions';
import { startApiServer } from '../../src/server/startApiServer';

const apiPort = Number(process.env.CONF_API_PORT);
const centroPort = Number(process.env.CONF_CENTRO_PORT);
const dataDir = process.env.CONF_DATA_DIR || '';
if (!apiPort || !centroPort || !dataDir) {
  console.error('Defina CONF_API_PORT, CONF_CENTRO_PORT e CONF_DATA_DIR.');
  process.exit(2);
}

const TOKEN = 'conferencia-sessao-de-teste';
const agora = Date.now();
const iso = (minutos: number) => new Date(agora - minutos * 60000).toISOString();
const usuario = { id: '00000000-0000-4000-8000-000000000001', name: 'Marina Conferência', email: 'conferencia@teste.local', role: 'admin', suiteRole: 'admin', apps: ['centro', 'orcamentos'], active: true };
const equipe = [
  usuario,
  { id: '00000000-0000-4000-8000-000000000002', name: 'Rafael Comercial', email: 'rafael@teste.local', role: 'gestor', suiteRole: 'comercial', apps: ['orcamentos'], active: true },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Paula Consulta', email: 'paula@teste.local', role: 'supervisor', suiteRole: 'tecnico', apps: ['orcamentos'], active: true },
];
const avisos = [
  { id: '10000000-0000-4000-8000-000000000001', type: 'proposta_aprovada', app: 'orcamentos', title: 'Proposta aprovada', body: 'PRP-0001 foi aprovada pelo cliente.', link: null, createdAt: iso(20), read: false },
  { id: '10000000-0000-4000-8000-000000000002', type: 'novo_acesso', app: 'orcamentos', title: 'Novo acesso à proposta', body: 'O cliente abriu o link da PRP-0002.', link: null, createdAt: iso(90), read: false },
  { id: '10000000-0000-4000-8000-000000000003', type: 'conta_vencer', app: 'centro-custos', title: 'Conta a vencer', body: 'Uma conta vence amanhã.', link: null, createdAt: iso(60 * 30), read: true },
];

const json = (response: http.ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
};

const centro = http.createServer((request, response) => {
  const path = (request.url || '').split('?')[0];
  request.resume();
  request.on('end', () => {
    if (path === '/v1/auth/login') return json(response, 200, { sessionToken: TOKEN, expiresAt: Date.now() + 86400000, user: usuario });
    if (path === '/v1/auth/session') return json(response, 200, { user: usuario, expiresAt: Date.now() + 86400000 });
    if (path === '/v1/auth/logout') return json(response, 200, { ok: true });
    if (path === '/v1/permissions') return json(response, 200, { ok: true, matrix: defaultSuiteMatrix() });
    if (path === '/v1/users') return json(response, 200, { users: equipe });
    if (path === '/v1/authorized-emails') return json(response, 200, { emails: [{ email: 'externo@teste.local', note: 'Cliente de teste', authorizedAt: iso(500), authorizedByName: usuario.name }] });
    if (path === '/v1/notifications') return json(response, 200, { items: avisos, unread: avisos.filter((a) => !a.read).length });
    if (path === '/v1/notifications/prefs') return json(response, 200, { prefs: { proposta_aprovada: true, novo_acesso: true } });
    if (path.startsWith('/v1/notifications') || path.startsWith('/v1/internal')) return json(response, 200, { ok: true });
    return json(response, 404, { error: 'Rota não encontrada.', code: 'ROUTE_NOT_FOUND' });
  });
});

const iniciar = async () => {
  await new Promise<void>((resolve) => centro.listen(centroPort, '127.0.0.1', resolve));
  process.env.CENTRO_CUSTOS_IDENTITY_URL = `http://127.0.0.1:${centroPort}`;
  process.env.CONSTRUTEC_API_HOST = '127.0.0.1';
  const runtime = await startApiServer(dataDir, undefined, apiPort);
  console.log(`PRONTO ${runtime.url} centro=${centroPort}`);

  let fechando = false;
  const encerrar = async () => {
    if (fechando) return;
    fechando = true;
    try { await runtime.close(); } catch { /* ja fechado */ }
    centro.close();
    process.exit(0);
  };
  process.once('SIGTERM', encerrar);
  process.once('SIGINT', encerrar);
  // O orquestrador avisa pelo stdin fechado (Windows nao entrega SIGTERM ao processo filho).
  process.stdin.on('end', encerrar);
  process.stdin.resume();
};

iniciar().catch((erro) => { console.error(erro); process.exit(1); });
