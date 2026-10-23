// Liga o modulo de janela do ditado ao vivo (public/m/ditado-*.js, o mesmo do celular) ao assistente do computador.
// Os tres arquivos sao importados pelo empacotador e criam `window.DitadoAoVivo`, nessa ordem.
import '../../../public/m/ditado-captura.js';
import '../../../public/m/ditado-motores.js';
import '../../../public/m/ditado-ao-vivo.js';
import type { DictationEngine } from './assistantVoice';

interface DitadoModule {
  criar(config: {
    sdk: () => Promise<unknown>; modeloLive: string; modelosTexto: Array<{ nome: string }>;
    recuperavel?: (error: unknown) => boolean; offline?: () => boolean; amigavel?: (error: unknown) => string; limiteMs?: number; intervaloMs?: number; motor?: 'trechos';
  }): DictationEngine;
}
declare global { interface Window { DitadoAoVivo?: DitadoModule } }

export interface EngineOptions {
  sdk: () => Promise<unknown>;
  liveModel: string;
  models: Array<{ nome: string }>;
  recoverable: (error: unknown) => boolean;
  isOffline: () => boolean;
  friendly: (error: unknown) => string;
  limitMs: number;
}

/** Criado so quando o painel pede (o modulo precisa de janela, microfone e Web Audio). */
export function createDictationEngine(options: EngineOptions): DictationEngine | null {
  const module = typeof window === 'undefined' ? undefined : window.DitadoAoVivo;
  if (!module) return null;
  return module.criar({ sdk: options.sdk, modeloLive: options.liveModel, modelosTexto: options.models, recuperavel: options.recoverable,
    offline: options.isOffline, amigavel: options.friendly, limiteMs: options.limitMs });
}
