// Ambiente de teste do kit: servidor (API + Centro falso) sobre banco temporario, renderer compilado, servidor estatico com proxy
// para /api e dados de teste. Tudo local, em portas da faixa recebida, e tudo encerrado em fechar().
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

export const EMAIL = 'conferencia@teste.local';
export const SENHA = 'senha-de-teste-123';

async function api(base, token, metodo, caminho, corpo) {
  const resposta = await fetch(`${base}/api${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { 'X-Construtec-Session': token } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  if (!resposta.ok) throw new Error(`${metodo} ${caminho}: ${resposta.status} ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : {};
}

// Dados de teste com cara de uso real, mas inventados: cobrem lista cheia, proposta grande, revisoes, descartada, kits e catalogo.
async function semear(base, token) {
  const A = (m, c, b) => api(base, token, m, c, b);
  const cliente = async (legalName, tradeName, document, obras, contato) => {
    const { clientId } = await A('POST', '/clients', { legalName, tradeName, document, contact: contato });
    for (const [name, address] of obras) await A('POST', `/clients/${clientId}/works`, { name, address });
    const lista = (await A('GET', '/clients')).clients.find((c) => c.id === clientId);
    return { id: clientId, works: lista.works };
  };
  const c1 = await cliente('Parque das Palmeiras Empreendimentos Ltda', 'Palmeiras', '12.345.678/0001-95',
    [['Torre A - Controle de acesso, CFTV e interfonia', 'Av. das Palmeiras, 1200, Campinas/SP'], ['Torre B - Cabeamento estruturado', 'Av. das Palmeiras, 1200, Campinas/SP']],
    { name: 'Helena Prado', role: 'Gerente de obras', email: 'helena@teste.local', phone: '(19) 99999-0001' });
  const c2 = await cliente('Indústria Alfa Metalúrgica S.A.', 'Alfa Metalúrgica', '98.765.432/0001-10', [['Galpão 3 - Rede e CFTV', 'Rod. Anhanguera km 98, Sumaré/SP']],
    { name: 'Carlos Menezes', role: 'Compras', email: 'carlos@teste.local', phone: '(19) 99999-0002' });
  const c3 = await cliente('Colégio Horizonte', null, null, [['Bloco novo - Alarme e CFTV', null]], undefined);

  const produtos = [
    ['CAM-IP-4MP', 'Hikvision', 'DS-2CD2143', 'Câmera IP bullet 4 MP, lente 2,8 mm, PoE', 'CFTV', 'un', 389.9],
    ['CAM-DOME-2MP', 'Intelbras', 'VIP 1230 D', 'Câmera IP dome 2 MP, infravermelho 30 m', 'CFTV', 'un', 279.5],
    ['NVR-16CH', 'Hikvision', 'DS-7616NI', 'Gravador NVR 16 canais, 4K, 2 baias de HD', 'CFTV', 'un', 2150],
    ['HD-4TB', 'Seagate', 'SkyHawk 4TB', 'HD 4 TB para vigilância 24 h', 'CFTV', 'un', 689],
    ['CAB-CAT6', 'Furukawa', 'GigaLan', 'Cabo UTP Cat6 4 pares, caixa 305 m', 'Cabeamento', 'cx', 845],
    ['SW-24P-POE', 'Intelbras', 'SG 2404 PoE', 'Switch 24 portas gigabit com PoE', 'Rede', 'un', 3290],
    ['CTRL-ACESSO', 'Control iD', 'iDAccess', 'Controladora de acesso facial', 'Controle de acesso', 'un', 2890],
    ['FECH-ELET', 'Intelbras', 'FE 2000', 'Fechadura eletromagnética 300 kg', 'Controle de acesso', 'un', 312],
    ['INTER-VIDEO', 'Intelbras', 'IVR 1010', 'Videoporteiro IP com leitor facial', 'Interfonia', 'un', 1450],
    ['RACK-12U', 'Hikvision', 'Rack 12U', 'Rack de parede 12U com ventilação', 'Infraestrutura', 'un', 980],
    ['ELETRO-20', 'Tigre', 'Eletroduto 3/4', 'Eletroduto corrugado 3/4 pol, rolo 50 m', 'Infraestrutura', 'rl', 118],
    ['PAT-CORD', 'Furukawa', 'Cat6 1,5 m', 'Patch cord Cat6 1,5 m', 'Cabeamento', 'un', 17.5],
  ];
  const ids = [];
  for (const [code, manufacturer, model, description, category, unit, currentCost] of produtos) {
    const r = await A('POST', '/catalog', { code, manufacturer, model, description, category, unit, currentCost, source: 'CONSTRUTEC', active: true });
    ids.push(r.productId);
  }
  const kitDe = async (name, description, category, partes) => A('POST', '/kits', { name, description, category, items: partes.map(([i, quantity]) => ({ productId: ids[i], quantity })) });
  await kitDe('Kit CFTV 8 câmeras', 'Gravador, 8 câmeras, HD e infraestrutura básica', 'CFTV', [[0, 8], [2, 1], [3, 1], [4, 1], [11, 8]]);
  await kitDe('Kit controle de acesso facial', 'Controladora facial com fechadura e fonte', 'Controle de acesso', [[6, 1], [7, 1]]);
  await kitDe('Kit rack de telecom', 'Rack, switch PoE e organização', 'Rede', [[9, 1], [5, 1], [11, 24]]);

  const proposta = async (cli, obra, escopo, validade) => (await A('POST', '/proposals', { clientId: cli.id, workId: cli.works[obra].id, scope: escopo, validUntil: validade })).proposal;
  const itens = (n, base = 0) => Array.from({ length: n }, (_, i) => ({ code: `COD-${base + i + 1}`, description: `Item de teste ${base + i + 1} para conferência de tabela longa`, category: ['CFTV', 'Cabeamento', 'Rede', 'Infraestrutura'][i % 4], unit: 'un', quantity: i + 1, unitCost: 10 + i, unitSale: 30 + i }));
  const mao = (id, n) => Promise.all(Array.from({ length: n }, (_, i) => A('POST', `/proposals/${id}/labor`, { description: `Instalador ${i + 1}`, professionalCount: i + 1, monthlySalary: 3200, monthlyFood: 600, monthlyTransport: 300, monthlyOtherCosts: 100, standardMonthlyHours: 176, plannedHours: 320 })));

  const longa = await proposta(c1, 0, 'Fornecimento e instalação de controle de acesso, CFTV e interfonia da Torre A', '2026-12-20');
  await A('POST', `/proposals/${longa.id}/items/import-batch`, { items: itens(40) });
  await mao(longa.id, 6);
  for (const i of [0, 1, 2]) await A('POST', `/proposals/${longa.id}/items`, { productId: ids[i], quantity: 3 });

  const comRevisoes = await proposta(c2, 0, 'Rede estruturada e CFTV do galpão 3', '2026-11-30');
  await A('POST', `/proposals/${comRevisoes.id}/items/import-batch`, { items: itens(30, 100) });
  await A('PATCH', `/proposals/${comRevisoes.id}/status`, { status: 'review' });
  await A('PATCH', `/proposals/${comRevisoes.id}/status`, { status: 'sent' });
  const rev = (await A('POST', `/proposals/${comRevisoes.id}/revisions`, {})).proposal;
  await A('POST', `/proposals/${rev.id}/items`, { productId: ids[5], quantity: 2 });

  const aprovada = await proposta(c3, 0, 'Alarme e CFTV do bloco novo', '2026-11-15');
  await A('POST', `/proposals/${aprovada.id}/items/import-batch`, { items: itens(6, 200) });
  await A('PATCH', `/proposals/${aprovada.id}/status`, { status: 'review' });
  await A('PATCH', `/proposals/${aprovada.id}/status`, { status: 'sent' });
  await A('PATCH', `/proposals/${aprovada.id}/status`, { status: 'approved' });

  const emRevisao = await proposta(c1, 1, 'Cabeamento estruturado da Torre B', '2026-10-30');
  await A('POST', `/proposals/${emRevisao.id}/items/import-batch`, { items: itens(12, 300) });
  await A('PATCH', `/proposals/${emRevisao.id}/status`, { status: 'review' });

  const vazia = await proposta(c2, 0, 'Proposta recém criada, ainda sem itens', null);

  const descartada = await proposta(c3, 0, 'Proposta que foi descartada', '2026-11-01');
  await A('POST', `/proposals/${descartada.id}/items/import-batch`, { items: itens(3, 400) });
  const numeroDescartada = (await A('GET', '/proposals')).proposals.find((p) => p.id === descartada.id).number;
  await A('POST', `/proposals/${descartada.id}/discard`, { confirmNumber: numeroDescartada, reason: 'Cliente desistiu' });

  const lista = (await A('GET', '/proposals')).proposals;
  const numero = (p) => lista.find((x) => x.id === p.id)?.number;
  const kitId = (await A('GET', '/kits')).kits[0]?.id;
  const descartadaId = (await A('GET', '/proposals/discarded')).discarded[0]?.id;
  return { kitId, descartadaId, longa: { id: longa.id, numero: numero(longa) }, revisoes: { id: rev.id, numero: numero(rev) }, aprovada: { id: aprovada.id, numero: numero(aprovada) }, emRevisao: { id: emRevisao.id, numero: numero(emRevisao) }, vazia: { id: vazia.id, numero: numero(vazia) } };
}

export async function subirAmbiente({ portaApi, portaCentro, portaSite, log = () => undefined, pularBuild = false }) {
  const temp = mkdtempSync(path.join(tmpdir(), 'conferencia-orc-'));
  const filhos = [];
  let site;
  const saidaServidor = path.join(raiz, '.vite', 'conferencia', `servidor-${process.pid}.cjs`);
  const fechar = async () => {
    if (site) await new Promise((resolve) => site.close(resolve));
    for (const filho of filhos) {
      try { filho.stdin.end(); } catch { /* ja fechado */ }
      await new Promise((resolve) => { const t = setTimeout(resolve, 4000); filho.once('exit', () => { clearTimeout(t); resolve(); }); });
      if (filho.exitCode === null && filho.pid) spawnSync('taskkill', ['/PID', String(filho.pid), '/T', '/F'], { stdio: 'ignore' });
    }
    try { rmSync(temp, { recursive: true, force: true }); rmSync(saidaServidor, { force: true }); } catch { /* pasta presa: fica no temp */ }
  };
  try {
    log('compilando o servidor de teste');
    // Dentro do repositorio (.vite/ e ignorado pelo git) para o Node achar o node_modules ao resolver os pacotes externos.
    mkdirSync(path.join(raiz, '.vite', 'conferencia'), { recursive: true });
    const saida = saidaServidor;
    await build({ absWorkingDir: raiz, entryPoints: ['scripts/conferencia/servidor.ts'], outfile: saida, bundle: true, platform: 'node', format: 'cjs', packages: 'external', logLevel: 'error' });

    // CONF_DIST: pasta de um build ja feito (ou onde guardar o desta vez) para repetir a conferencia sem recompilar (30 s).
    const dist = process.env.CONF_DIST ? path.resolve(process.env.CONF_DIST) : path.join(temp, 'dist');
    if (!existsSync(path.join(dist, 'index.html'))) {
      if (!pularBuild) {
        log('compilando o desktop (vite build)');
        const vite = spawnSync(process.execPath, [path.join(raiz, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite.renderer.config.mjs', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], { cwd: raiz, encoding: 'utf8' });
        if (vite.status !== 0) throw new Error(`vite build falhou:\n${vite.stdout}\n${vite.stderr}`);
      }
    }

    log('iniciando o servidor de teste');
    const dados = path.join(temp, 'dados');
    mkdirSync(dados);
    const servidor = spawn(process.execPath, [saida], {
      cwd: raiz, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
      env: { ...process.env, CONF_API_PORT: String(portaApi), CONF_CENTRO_PORT: String(portaCentro), CONF_DATA_DIR: dados, DATABASE_URL: '', CONSTRUTEC_API_TOKEN: 'conferencia-token-local', CONSTRUTEC_IDENTITY_KEY: 'chave-de-servico-so-de-teste-0123456789' },
    });
    filhos.push(servidor);
    await new Promise((resolve, reject) => {
      let saidaTexto = '';
      const t = setTimeout(() => reject(new Error(`o servidor de teste não ficou pronto:\n${saidaTexto}`)), 90000);
      const ler = (d) => { saidaTexto += d.toString(); if (saidaTexto.includes('PRONTO')) { clearTimeout(t); resolve(); } };
      servidor.stdout.on('data', ler); servidor.stderr.on('data', ler);
      servidor.once('exit', (code) => { clearTimeout(t); reject(new Error(`o servidor de teste saiu (${code}):\n${saidaTexto}`)); });
    });
    const baseApi = `http://127.0.0.1:${portaApi}`;
    const sessao = await api(baseApi, '', 'POST', '/auth/login', { email: EMAIL, password: SENHA });
    log('criando dados de teste');
    const dadosTeste = await semear(baseApi, sessao.token);

    // Site: arquivos do renderer compilado (inclui /m e /c, copiados de public/) e proxy de /api para o servidor.
    site = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://x');
      if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
        const proxy = (async () => {
          const corpo = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise((ok) => { const partes = []; req.on('data', (d) => partes.push(d)); req.on('end', () => ok(Buffer.concat(partes))); });
          const headers = { ...req.headers }; delete headers.host; delete headers.origin;
          const r = await fetch(`${baseApi}${url.pathname}${url.search}`, { method: req.method, headers, body: corpo });
          const saidaBuf = Buffer.from(await r.arrayBuffer());
          const h = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) h[k] = v; });
          res.writeHead(r.status, h); res.end(saidaBuf);
        })();
        proxy.catch(() => { res.writeHead(502); res.end('proxy'); });
        return;
      }
      let relativo;
      try { relativo = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end(); return; }
      if (relativo.endsWith('/')) relativo += 'index.html';
      let arquivo = path.join(dist, relativo);
      if (arquivo !== dist && !arquivo.startsWith(dist + path.sep)) { res.writeHead(403); res.end(); return; }
      if (!existsSync(arquivo) || !statSync(arquivo).isFile()) {
        if (/^\/(m|c)(\/|$)/.test(url.pathname)) { res.writeHead(404); res.end(); return; }
        arquivo = path.join(dist, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      createReadStream(arquivo).pipe(res);
    });
    await new Promise((resolve, reject) => { site.once('error', reject); site.listen(portaSite, '127.0.0.1', resolve); });
    return { base: `http://127.0.0.1:${portaSite}`, token: sessao.token, user: sessao.user, dados: dadosTeste, fechar, temp };
  } catch (erro) {
    await fechar();
    throw erro;
  }
}

export { raiz };


