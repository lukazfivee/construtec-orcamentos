import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { installMicrophonePermission, isOwnPage } from '../main/micPermission';
import { composeDictation, createVoice, VOICE_LISTENING, type DictationCallbacks, type DictationEngine, type VoiceState } from './assistant/assistantVoice';

// Ditado ao vivo do assistente (desktop e /m/): o texto aparece no campo enquanto se fala. Tudo com mocks.
const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

test('composeDictation: preserva o que ja estava digitado e respeita o limite do campo', () => {
  assert.equal(composeDictation('Quero saber:', 'quanto gastamos'), 'Quero saber: quanto gastamos');
  assert.equal(composeDictation('  Texto antigo  ', 'dois'), 'Texto antigo dois');
  assert.equal(composeDictation('', 'só o ditado'), 'só o ditado');
  assert.equal(composeDictation('Texto antigo', ''), 'Texto antigo', 'sem fala o campo volta ao digitado');
  assert.equal(composeDictation('a'.repeat(1400), 'b'.repeat(400)).length, 1500);
});

function harness(options: { offline?: boolean; unsupported?: boolean } = {}) {
  const log = { states: [] as VoiceState[], partials: [] as string[], finals: [] as string[], errors: [] as string[], notices: [] as Array<string | null>, started: 0, stopped: 0, cancelled: 0 };
  let cbs: DictationCallbacks | null = null;
  const engine: DictationEngine = {
    suportado: () => !options.unsupported,
    iniciar: (callbacks) => { log.started += 1; cbs = callbacks; callbacks.onEstado('ouvindo'); },
    parar: () => { log.stopped += 1; cbs?.onEstado('finalizando'); },
    cancelar: () => { log.cancelled += 1; },
  };
  const voice = createVoice({ engine: () => engine, isOffline: () => Boolean(options.offline) }, {
    onState: (s) => log.states.push(s), onPartial: (t) => log.partials.push(t), onFinal: (t) => log.finals.push(t),
    onError: (m) => log.errors.push(m), onNotice: (m) => log.notices.push(m),
  });
  return { voice, log, engine: () => cbs as DictationCallbacks };
}

test('ditado: parcial vai chegando enquanto grava, o final assenta ao parar e o campo e liberado', async () => {
  const { voice, log, engine } = harness();
  await voice.toggle();
  assert.equal(voice.state(), 'rec');
  engine().onParcial('preciso'); engine().onParcial('preciso de uma proposta');
  assert.deepEqual(log.partials, ['preciso', 'preciso de uma proposta']);
  await voice.toggle(); // parar
  assert.equal(voice.state(), 'work');
  engine().onFinal('preciso de uma proposta'); engine().onEstado('livre');
  assert.equal(voice.state(), 'idle');
  assert.deepEqual(log.states, ['rec', 'work', 'idle']);
  assert.deepEqual(log.finals, ['preciso de uma proposta']);
  assert.deepEqual(log.errors, []);
  assert.equal(log.stopped, 1);
});

test('ditado: erro do motor devolve o campo ao digitado e mostra o aviso; sem internet nem inicia', async () => {
  const { voice, log, engine } = harness();
  await voice.toggle();
  engine().onErro('Sem acesso ao microfone.');
  assert.deepEqual(log.finals, ['']); assert.deepEqual(log.errors, ['Sem acesso ao microfone.']); assert.equal(voice.state(), 'idle');
  const off = harness({ offline: true }); await off.voice.toggle();
  assert.deepEqual(off.log.errors, ['O ditado precisa de internet.']); assert.equal(off.log.started, 0); assert.equal(off.voice.state(), 'idle');
  const none = createVoice({ engine: () => null, isOffline: () => false }, { onState() { /* nada */ }, onPartial() { /* nada */ }, onFinal() { /* nada */ }, onError() { /* nada */ }, onNotice() { /* nada */ } });
  await none.toggle(); assert.equal(none.state(), 'idle');
});

test('ditado: aviso do motor por trechos chega ao app; fechar o painel descarta e devolve o campo', async () => {
  const { voice, log, engine } = harness();
  await voice.toggle();
  engine().onAviso('Mostrando o texto a cada poucos segundos.');
  assert.equal(log.notices.at(-1), 'Mostrando o texto a cada poucos segundos.');
  engine().onParcial('rascunho');
  voice.cancel();
  assert.equal(log.cancelled, 1); assert.equal(voice.state(), 'idle'); assert.equal(log.finals.at(-1), '');
  assert.deepEqual(log.errors, []);
  const parado = harness(); parado.voice.cancel(); // sem ditado em curso nada muda
  assert.deepEqual(parado.log.finals, []);
});

test('Electron: so audio e so da propria pagina; camera e outros sites negados', () => {
  assert.ok(isOwnPage('file:///C:/app/index.html')); assert.ok(isOwnPage('http://127.0.0.1:4010/m/')); assert.ok(isOwnPage('suite://entrar'));
  assert.ok(!isOwnPage('https://exemplo.com/')); assert.ok(!isOwnPage('http://127.0.0.1.exemplo.com/')); assert.ok(!isOwnPage(undefined));
  type Req = (c: unknown, p: string, cb: (g: boolean) => void, d: Record<string, unknown>) => void;
  type Chk = (c: unknown, p: string, o: string, d: Record<string, unknown>) => boolean;
  const handlers: { request?: Req; check?: Chk } = {};
  installMicrophonePermission({ setPermissionRequestHandler: (h) => { handlers.request = h as Req; }, setPermissionCheckHandler: (h) => { handlers.check = h as Chk; } });
  const ask = (permission: string, details: Record<string, unknown>) => { let out = false; handlers.request?.(null, permission, (g) => { out = g; }, details); return out; };
  assert.equal(ask('media', { mediaTypes: ['audio'], requestingUrl: 'file:///x/index.html' }), true);
  assert.equal(ask('media', { mediaTypes: ['audio', 'video'], requestingUrl: 'file:///x/index.html' }), false);
  assert.equal(ask('media', { mediaTypes: ['audio'], requestingUrl: 'https://exemplo.com/' }), false);
  assert.equal(ask('clipboard-sanitized-write', {}), true, 'demais permissoes seguem o padrao');
  assert.equal(handlers.check?.(null, 'media', 'file://', { mediaType: 'audio', requestingUrl: 'file:///x/index.html' }), true);
  assert.equal(handlers.check?.(null, 'media', 'file://', { mediaType: 'video', requestingUrl: 'file:///x/index.html' }), false);
});

test('fiacao: o campo mostra o parcial mais fraco e travado, nos dois apps, com os mesmos textos do Centro', () => {
  const fab = read('src/renderer/AssistantFab.tsx');
  assert.match(fab, /name=\{voiceState === 'rec' \? 'stop-fill' : 'microphone'\}/);
  assert.match(fab, /className=\{partial \? 'ia-parcial' : undefined\} readOnly=\{partial\}/);
  assert.match(fab, /onPartial: \(text\) => \{ setPartial\(true\); setDraft\(composeDictation\(voiceBase\.current, text\)\)/, 'texto digitado antes e preservado');
  assert.match(fab, /voice\.current\?\.cancel\(\)/, 'fechar descarta o ditado');
  assert.equal(VOICE_LISTENING, 'Ouvindo… o texto aparece enquanto você fala. Use o quadrado para parar.');
  assert.match(read('src/renderer/assistant/assistantChat.ts'), /sdk: getSdk/, 'o ditado usa o mesmo SDK do assistente');
  assert.match(read('src/renderer/assistant/dictationEngine.ts'), /public\/m\/ditado-captura\.js[\s\S]*ditado-motores\.js[\s\S]*ditado-ao-vivo\.js/, 'mesmos tres arquivos do celular, nessa ordem');
  assert.match(read('src/renderer/assistant/assistantConfig.ts'), /LIVE_MODEL = 'gemini-3\.1-flash-live-preview'/);
  const css = read('src/assistant.css');
  assert.match(css, /\.assistant-input textarea\.ia-parcial \{[^}]*var\(--c-warn\)/);
  const chat = read('public/m/ia-chat.js');
  assert.match(chat, /IA\.voz = IA\.criarVoz\(/); assert.match(chat, /id="ia-mic"/); assert.match(chat, /IA\.voz\.cancelar\(\)/);
  const html = read('public/m/index.html');
  assert.match(html, /ditado-captura\.js[\s\S]*ditado-motores\.js[\s\S]*ditado-ao-vivo\.js[\s\S]*ia-voz\.js[\s\S]*ia-chat\.js/, 'o modulo carrega antes do adaptador e do chat');
  const voz = read('public/m/ia-voz.js');
  for (const text of [VOICE_LISTENING, 'Finalizando…', "'stop-fill' : 'microphone'", 'modeloLive: OC.iaConfig.modeloLive', 'ia-parcial']) assert.ok(voz.includes(text), text);
  assert.match(read('public/m/ia-config.js'), /modeloLive: 'gemini-3\.1-flash-live-preview'/);
  assert.match(read('public/m/m.css'), /\.ia-input textarea\.ia-parcial \{[^}]*var\(--warn-text\)/);
  assert.match(read('public/_headers'), /Permissions-Policy: microphone=\(self\)/);
  const csp = read('index.html').match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
  assert.match(csp, /connect-src[^;]*wss:\/\/firebasevertexai\.googleapis\.com/, 'a Live API fala por WebSocket');
});
