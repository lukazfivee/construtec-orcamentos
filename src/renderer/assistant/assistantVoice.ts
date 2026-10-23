// Ditado do assistente: grava pelo microfone, converte para WAV mono 16 kHz (formato que o Gemini aceita em qualquer
// navegador) e pede a transcricao ao mesmo Gemini do assistente. O texto cai no campo para a pessoa conferir e enviar;
// nenhum audio e guardado. Mesma regra do ditado do Centro de Custos (public/m/ia-voz.js) e do /m/ (public/m/ia-voz.js).

export const VOICE_MAX_MS = 120_000;
const MIN_BLOB = 1500; // abaixo disso nao ha fala (toque sem querer)
const RATE = 16000;

export type VoiceState = 'idle' | 'rec' | 'work';

export const voiceSupported = (): boolean => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  && typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined'
  && Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

/** Mistura os canais numa so faixa. */
export function mixToMono(channels: Float32Array[]): Float32Array {
  const mono = new Float32Array(channels[0]?.length ?? 0);
  for (const data of channels) for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / channels.length;
  return mono;
}

/** WAV PCM 16 bits mono a 16 kHz, com reamostragem linear a partir da taxa de origem. */
export function encodeWav(mono: Float32Array, sourceRate: number): ArrayBuffer {
  const n = Math.max(1, Math.floor((mono.length / sourceRate) * RATE));
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i += 1) out.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); text(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, RATE, true); out.setUint32(28, RATE * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); text(36, 'data'); out.setUint32(40, n * 2, true);
  const ratio = sourceRate / RATE;
  const last = Math.max(0, mono.length - 1);
  for (let i = 0; i < n; i += 1) {
    const a = Math.min(last, Math.floor(i * ratio)), b = Math.min(last, a + 1), f = i * ratio - a;
    const v = Math.max(-1, Math.min(1, (mono[a] ?? 0) * (1 - f) + (mono[b] ?? 0) * f));
    out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return out.buffer;
}

export function toBase64(buffer: ArrayBuffer): string {
  let text = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/** Gravacao do navegador (webm/ogg/mp4) para WAV 16 kHz. */
export async function blobToWav(blob: Blob): Promise<ArrayBuffer> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let buffer: AudioBuffer;
  try { buffer = await ctx.decodeAudioData(await blob.arrayBuffer()); } finally { void ctx.close().catch(() => undefined); }
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  return encodeWav(mixToMono(channels), buffer.sampleRate);
}

export interface RecorderLike {
  state: string; mimeType: string;
  addEventListener(type: 'dataavailable' | 'stop', listener: (event: { data?: { size: number } }) => void): void;
  start(): void; stop(): void;
}
export interface StreamLike { getTracks(): Array<{ stop(): void }> }

export interface VoiceDeps {
  isOffline(): boolean;
  getUserMedia(): Promise<StreamLike>;
  createRecorder(stream: StreamLike): RecorderLike;
  makeBlob(chunks: unknown[], type: string): { size: number };
  toWav(blob: { size: number }): Promise<ArrayBuffer>;
  /** WAV em base64 -> texto falado (vazio se nao houve fala). */
  transcribe(wavBase64: string): Promise<string>;
  friendly(error: unknown): string;
}
export interface VoiceHooks {
  onState(state: VoiceState): void;
  /** Texto transcrito para somar ao campo. */
  onText(text: string): void;
  onError(message: string): void;
}

export function createVoice(deps: VoiceDeps, hooks: VoiceHooks) {
  let state: VoiceState = 'idle';
  let rec: RecorderLike | null = null;
  let stream: StreamLike | null = null;
  let chunks: unknown[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let discard = false;
  const set = (next: VoiceState) => { state = next; hooks.onState(next); };
  const clean = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    stream?.getTracks().forEach((track) => track.stop());
    stream = null; rec = null; chunks = [];
  };
  const stop = () => { if (rec && rec.state !== 'inactive') rec.stop(); };

  async function start() {
    if (deps.isOffline()) { hooks.onError('O ditado precisa de internet.'); return; }
    try { stream = await deps.getUserMedia(); } catch (error) {
      hooks.onError((error as { name?: string })?.name === 'NotFoundError'
        ? 'Não encontrei um microfone neste computador.'
        : 'Sem acesso ao microfone. Permita o microfone nas configurações do Windows ou do navegador e tente de novo.');
      return;
    }
    chunks = []; discard = false;
    const recorder = deps.createRecorder(stream);
    rec = recorder;
    recorder.addEventListener('dataavailable', (event) => { if (event.data?.size) chunks.push(event.data); });
    recorder.addEventListener('stop', () => { void finish(recorder); });
    recorder.start();
    set('rec');
    timer = setTimeout(stop, VOICE_MAX_MS);
  }

  async function finish(recorder: RecorderLike) {
    const blob = deps.makeBlob(chunks, recorder.mimeType || 'audio/webm');
    const dropped = discard;
    clean();
    if (dropped || blob.size < MIN_BLOB) { set('idle'); return; }
    set('work');
    try {
      const text = (await deps.transcribe(toBase64(await deps.toWav(blob)))).trim();
      if (text) hooks.onText(text); else hooks.onError('Não entendi nada. Fale mais perto do microfone e tente de novo.');
    } catch (error) { hooks.onError(`Não consegui transcrever. ${deps.friendly(error)}`); }
    set('idle');
  }

  return {
    state: () => state,
    toggle: () => (state === 'rec' ? stop() : state === 'idle' ? start() : undefined),
    /** Fechar o painel com o microfone aberto descarta a gravacao. */
    cancel() { if (rec && rec.state !== 'inactive') { discard = true; rec.stop(); } else if (stream) clean(); },
  };
}

export const browserVoiceDeps = (transcribe: VoiceDeps['transcribe'], friendly: VoiceDeps['friendly'], isOffline: VoiceDeps['isOffline']): VoiceDeps => ({
  isOffline,
  getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }),
  createRecorder: (stream) => new MediaRecorder(stream as MediaStream) as unknown as RecorderLike,
  makeBlob: (parts, type) => new Blob(parts as BlobPart[], { type }),
  toWav: (blob) => blobToWav(blob as Blob),
  transcribe, friendly,
});

/** Instrucao dada ao Gemini (a mesma do Centro). */
export const TRANSCRIBE_PROMPT = 'Transcreva fielmente este áudio em português do Brasil. Responda somente com o texto falado, com pontuação normal, sem comentários e sem aspas. Se não houver fala, responda vazio.';
