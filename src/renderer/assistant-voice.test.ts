import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { installMicrophonePermission, isOwnPage } from '../main/micPermission';
import { createVoice, encodeWav, mixToMono, toBase64, VOICE_MAX_MS, type RecorderLike, type VoiceDeps, type VoiceState } from './assistant/assistantVoice';

// Ditado por voz do assistente (desktop e /m/): gravacao -> WAV 16 kHz -> Gemini -> texto no campo. Tudo com mocks.
const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

test('encodeWav: cabecalho RIFF mono 16 kHz e reamostragem de 48 kHz', () => {
  const sec = new Float32Array(48000).fill(0.5); // 1 s a 48 kHz
  const wav = new DataView(encodeWav(sec, 48000));
  const tag = (o: number) => String.fromCharCode(wav.getUint8(o), wav.getUint8(o + 1), wav.getUint8(o + 2), wav.getUint8(o + 3));
  assert.equal(tag(0), 'RIFF'); assert.equal(tag(8), 'WAVE'); assert.equal(tag(36), 'data');
  assert.equal(wav.getUint16(22, true), 1, 'mono');
  assert.equal(wav.getUint32(24, true), 16000, 'taxa');
  assert.equal(wav.getUint32(40, true), 16000 * 2, '1 s de PCM 16 bits');
  assert.equal(wav.byteLength, 44 + 32000);
  assert.ok(Math.abs(wav.getInt16(44 + 200, true) - 0.5 * 0x7fff) < 2, 'amostra preservada');
});

test('mixToMono e toBase64', () => {
  const mono = mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]);
  assert.deepEqual(Array.from(mono), [0.5, 0.5]);
  assert.equal(toBase64(new Uint8Array([104, 105]).buffer), 'aGk=');
});

type Fake = RecorderLike & { emit(type: string, data?: { size: number }): void; stopped: number };
function harness(options: { text?: string; offline?: boolean; denied?: string; blobSize?: number; fail?: boolean } = {}) {
  const log: { states: VoiceState[]; texts: string[]; errors: string[]; tracksStopped: number; sent: string[] } = { states: [], texts: [], errors: [], tracksStopped: 0, sent: [] };
  const listeners: Record<string, Array<(e: { data?: { size: number } }) => void>> = {};
  const recorder: Fake = {
    state: 'inactive', mimeType: 'audio/webm', stopped: 0,
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    start() { this.state = 'recording'; },
    stop() { this.state = 'inactive'; this.stopped += 1; this.emit('stop'); },
    emit(type, data) { for (const fn of listeners[type] ?? []) fn({ data }); },
  };
  const deps: VoiceDeps = {
    isOffline: () => Boolean(options.offline),
    getUserMedia: async () => { if (options.denied) throw Object.assign(new Error('x'), { name: options.denied }); return { getTracks: () => [{ stop: () => { log.tracksStopped += 1; } }] }; },
    createRecorder: () => recorder,
    makeBlob: () => ({ size: options.blobSize ?? 5000 }),
    toWav: async () => new Uint8Array([1, 2, 3]).buffer,
    transcribe: async (wav) => { log.sent.push(wav); if (options.fail) throw new Error('429 quota'); return options.text ?? ' preciso de uma proposta '; },
    friendly: () => 'Tente de novo.',
  };
  const voice = createVoice(deps, { onState: (s) => log.states.push(s), onText: (t) => log.texts.push(t), onError: (m) => log.errors.push(m) });
  return { voice, recorder, log };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

test('ditado: grava, para, transcreve e entrega o texto aparado; libera o microfone', async () => {
  const { voice, recorder, log } = harness();
  await voice.toggle();
  assert.equal(voice.state(), 'rec');
  recorder.emit('dataavailable', { size: 4000 });
  await voice.toggle(); // parar
  await settle();
  assert.deepEqual(log.states, ['rec', 'work', 'idle']);
  assert.deepEqual(log.texts, ['preciso de uma proposta']);
  assert.deepEqual(log.sent, ['AQID']);
  assert.equal(log.tracksStopped, 1);
  assert.deepEqual(log.errors, []);
});

test('ditado: sem internet, microfone negado ou ausente, silencio e falha da IA viram avisos', async () => {
  const off = harness({ offline: true }); await off.voice.toggle();
  assert.deepEqual(off.log.errors, ['O ditado precisa de internet.']);
  const denied = harness({ denied: 'NotAllowedError' }); await denied.voice.toggle();
  assert.match(denied.log.errors[0], /Sem acesso ao microfone/);
  const absent = harness({ denied: 'NotFoundError' }); await absent.voice.toggle();
  assert.match(absent.log.errors[0], /Não encontrei um microfone/);
  const silent = harness({ text: '  ' }); await silent.voice.toggle(); await silent.voice.toggle(); await settle();
  assert.match(silent.log.errors[0], /Não entendi nada/);
  const broken = harness({ fail: true }); await broken.voice.toggle(); await broken.voice.toggle(); await settle();
  assert.equal(broken.log.errors[0], 'Não consegui transcrever. Tente de novo.');
  assert.equal(broken.voice.state(), 'idle');
});

test('ditado: gravacao curta demais e gravacao descartada ao fechar o painel nao chamam a IA', async () => {
  const curta = harness({ blobSize: 100 }); await curta.voice.toggle(); await curta.voice.toggle(); await settle();
  assert.deepEqual(curta.log.sent, []); assert.equal(curta.voice.state(), 'idle');
  const fechado = harness(); await fechado.voice.toggle(); fechado.voice.cancel(); await settle();
  assert.deepEqual(fechado.log.sent, []); assert.deepEqual(fechado.log.texts, []);
  assert.equal(fechado.voice.state(), 'idle'); assert.equal(fechado.log.tracksStopped, 1);
});

test('ditado: para sozinho em 120 s', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { voice, recorder } = harness();
  await voice.toggle();
  assert.equal(VOICE_MAX_MS, 120000);
  t.mock.timers.tick(VOICE_MAX_MS);
  assert.equal(recorder.stopped, 1);
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

test('fiacao: o botao existe no painel do computador e no /m/, com os mesmos avisos do Centro', () => {
  const fab = read('src/renderer/AssistantFab.tsx');
  assert.match(fab, /name=\{voiceState === 'rec' \? 'stop-fill' : 'microphone'\}/);
  assert.match(fab, /Ouvindo… toque no quadrado para parar\./); assert.match(fab, /Transcrevendo…/);
  assert.match(fab, /voice\.current\?\.cancel\(\)/, 'fechar descarta a gravacao');
  assert.match(read('src/renderer/assistant/assistantChat.ts'), /async function transcribe\(/);
  const chat = read('public/m/ia-chat.js');
  assert.match(chat, /IA\.voz = IA\.criarVoz\(/); assert.match(chat, /id="ia-mic"/); assert.match(chat, /IA\.voz\.cancelar\(\)/);
  assert.match(read('public/m/index.html'), /ia-voz\.js[\s\S]*ia-chat\.js/, 'ia-voz.js carrega antes do ia-chat.js');
  const voz = read('public/m/ia-voz.js');
  for (const text of ['Ouvindo… toque no quadrado para parar.', 'Transcrevendo…', 'VOZ_MAX_MS = 120000', "'stop-fill' : 'microphone'", 'audio/wav']) assert.ok(voz.includes(text), text);
  assert.match(read('public/_headers'), /Permissions-Policy: microphone=\(self\)/);
});
