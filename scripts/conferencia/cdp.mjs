// Cliente minimo do DevTools Protocol (sem dependencia): abre o Chrome (ou o Edge) sem janela, com perfil temporario proprio, e
// conversa por WebSocket (WebSocket global do Node 22). So fecha o processo que ele mesmo abriu.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CANDIDATOS = [
  process.env.ORC_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export const acharNavegador = () => CANDIDATOS.find((item) => item && existsSync(item)) || '';

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function abrirNavegador({ porta }) {
  const exe = acharNavegador();
  if (!exe) throw new Error('Chrome ou Edge não encontrado. Defina ORC_BROWSER com o caminho do executável.');
  const perfil = mkdtempSync(path.join(tmpdir(), 'conferencia-perfil-'));
  const filho = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
    '--hide-scrollbars=false', '--force-color-profile=srgb', '--font-render-hinting=none',
    // Nada sai do computador: so o 127.0.0.1 resolve.
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  let versao;
  for (let i = 0; i < 100 && !versao; i += 1) {
    try { versao = await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json(); } catch { await esperar(150); }
  }
  if (!versao) { fechar(); throw new Error('O navegador não respondeu ao DevTools.'); }

  const socket = new WebSocket(versao.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('Falha ao ligar no DevTools.')); });
  let proximo = 1;
  const pendentes = new Map();
  const ouvintes = new Set();
  socket.onmessage = (evento) => {
    const msg = JSON.parse(evento.data);
    if (msg.id && pendentes.has(msg.id)) {
      const { resolve, reject } = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`)); else resolve(msg.result);
    } else if (msg.method) {
      for (const ouvinte of ouvintes) ouvinte(msg);
    }
  };
  const enviar = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = proximo++;
    pendentes.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });

  function fechar() {
    try { socket.close(); } catch { /* ja fechado */ }
    // taskkill /T derruba o navegador e os processos filhos dele; so o PID que abrimos.
    if (filho.pid) { if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(filho.pid), '/T', '/F'], { stdio: 'ignore' }); else { try { filho.kill('SIGKILL'); } catch { /* ja saiu */ } } }
    setTimeout(() => { try { rmSync(perfil, { recursive: true, force: true }); } catch { /* perfil preso: o SO limpa o temp */ } }, 500);
  }

  async function novaAba() {
    const { targetId } = await enviar('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true });
    const cmd = (method, params) => enviar(method, params, sessionId);
    await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Network.enable');
    const registros = [];
    const ouvinte = (msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Runtime.exceptionThrown') registros.push({ tipo: 'excecao', texto: msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || '' });
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') registros.push({ tipo: 'console', texto: msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ') });
      if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) registros.push({ tipo: 'http', texto: `${msg.params.response.status} ${msg.params.response.url}` });
      if (msg.method === 'Network.loadingFailed' && !msg.params.canceled) registros.push({ tipo: 'rede', texto: `${msg.params.errorText} ${msg.params.requestId}` });
    };
    ouvintes.add(ouvinte);
    return {
      cmd, registros,
      async avaliar(expressao, { aguardar = true } = {}) {
        const r = await cmd('Runtime.evaluate', { expression: expressao, awaitPromise: aguardar, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      async ir(url) {
        const carregou = new Promise((resolve) => {
          const quando = (msg) => { if (msg.sessionId === sessionId && msg.method === 'Page.loadEventFired') { ouvintes.delete(quando); resolve(); } };
          ouvintes.add(quando);
          setTimeout(() => { ouvintes.delete(quando); resolve(); }, 20000);
        });
        await cmd('Page.navigate', { url });
        await carregou;
      },
      async foto(arquivo, { completa = false } = {}) {
        const { data } = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: completa, ...(completa ? { fromSurface: true } : {}) });
        const { writeFileSync } = await import('node:fs');
        writeFileSync(arquivo, Buffer.from(data, 'base64'));
      },
      async viewport(largura, altura, celular) {
        await cmd('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: Boolean(celular) });
        if (celular) await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        else await cmd('Emulation.setTouchEmulationEnabled', { enabled: false });
      },
      async antesDoCarregamento(script) { await cmd('Page.addScriptToEvaluateOnNewDocument', { source: script }); },
      async clicar(x, y) {
        for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      },
      async fechar() { ouvintes.delete(ouvinte); await enviar('Target.closeTarget', { targetId }).catch(() => undefined); },
    };
  }

  return { novaAba, fechar, exe, esperar };
}
