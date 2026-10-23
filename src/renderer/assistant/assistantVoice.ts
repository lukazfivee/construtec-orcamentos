// Ditado do assistente: o texto aparece no campo enquanto a pessoa fala (motor Live do Gemini; se nao conectar, por
// trechos) e ao parar fica o texto final para conferir. A captura e os motores sao o modulo portatil de janela
// public/m/ditado-*.js (o mesmo do celular /m/ e do Centro de Custos); aqui ficam so a maquina de estados e a
// composicao do texto, testaveis com um motor de mentira. Nenhum audio e guardado.

export const VOICE_MAX_MS = 120_000;
export const VOICE_LISTENING = 'Ouvindo… o texto aparece enquanto você fala. Use o quadrado para parar.';
export const VOICE_FINISHING = 'Finalizando…';
export const VOICE_OFFLINE = 'O ditado precisa de internet.';
const FIELD_MAX = 1500;

export type VoiceState = 'idle' | 'rec' | 'work';
type EngineState = 'ouvindo' | 'finalizando' | 'livre';

export interface DictationCallbacks {
  onParcial(text: string): void;
  onFinal(text: string): void;
  onErro(message: string): void;
  onEstado(state: EngineState): void;
  onAviso(message: string): void;
}
/** O que o app usa do modulo `window.DitadoAoVivo` (ver o cabecalho de public/m/ditado-ao-vivo.js). */
export interface DictationEngine {
  suportado(): boolean;
  iniciar(callbacks: DictationCallbacks): Promise<void> | void;
  parar(): Promise<void> | void;
  cancelar(): void;
}

export interface VoiceDeps {
  /** Motor do ditado; null quando o modulo nao esta carregado. */
  engine(): DictationEngine | null;
  isOffline(): boolean;
}
export interface VoiceHooks {
  onState(state: VoiceState): void;
  /** Texto que ainda pode mudar (aparece mais fraco, com o campo travado). */
  onPartial(text: string): void;
  /** Texto assentado; vazio quando nao houve fala (o campo volta ao que estava digitado). */
  onFinal(text: string): void;
  onError(message: string): void;
  /** Aviso curto durante a gravacao (ex.: troca para o motor por trechos); null limpa. */
  onNotice(message: string | null): void;
}

/** Texto ja digitado + texto ditado, no limite do campo. */
export function composeDictation(base: string, text: string): string {
  const head = base.trim();
  return `${head}${head && text ? ' ' : ''}${text}`.slice(0, FIELD_MAX);
}

export const voiceSupported = (engine: DictationEngine | null): boolean => Boolean(engine && engine.suportado());

export function createVoice(deps: VoiceDeps, hooks: VoiceHooks) {
  let state: VoiceState = 'idle';
  const set = (next: VoiceState) => { if (next === state) return; state = next; hooks.onState(next); };

  function start() {
    const engine = deps.engine();
    if (!engine) return;
    if (deps.isOffline()) { hooks.onError(VOICE_OFFLINE); return; }
    hooks.onNotice(null);
    set('rec');
    void engine.iniciar({
      onParcial: (text) => hooks.onPartial(text),
      onFinal: (text) => hooks.onFinal(text),
      onErro: (message) => { hooks.onFinal(''); set('idle'); hooks.onError(message); },
      onAviso: (message) => hooks.onNotice(message),
      onEstado: (next) => set(next === 'ouvindo' ? 'rec' : next === 'finalizando' ? 'work' : 'idle'),
    });
  }

  return {
    state: () => state,
    toggle() {
      if (state === 'rec') return deps.engine()?.parar();
      if (state === 'idle') start();
      return undefined;
    },
    /** Fechar o painel com o microfone aberto descarta o ditado: o que foi digitado antes continua no campo. */
    cancel() { deps.engine()?.cancelar(); if (state !== 'idle') { hooks.onFinal(''); set('idle'); } },
  };
}
