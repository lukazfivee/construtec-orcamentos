// Conversa com o Gemini pelo Firebase AI Logic. O SDK vem do CDN do Google (import dinamico, sem o
// pacote `firebase` no projeto) e so carrega quando o assistente e usado ou pre-aquecido; a resposta
// aparece enquanto e escrita (streaming). A conversa fica na memoria: nada vai para o disco.
import { appCheckAllowed, FIREBASE_CONFIG, MODELS, RECAPTCHA_KEY, SDK_BASE } from './assistantConfig';
import type { AssistantTools, SchemaBuilder, ToolCall } from './assistantTools';

// Tipos minimos do SDK (so o que o app usa).
type Content = string | Array<{ functionResponse: { name: string; response: unknown } }>;
interface ModelResponse { functionCalls(): ToolCall[] | undefined; text(): string }
interface ChatSession {
  sendMessageStream(content: Content): Promise<{ stream: AsyncIterable<{ text(): string }>; response: Promise<ModelResponse> }>;
  getHistory(): Promise<unknown[]>;
}
interface AiModule {
  getAI(app: unknown, options: { backend: unknown }): unknown;
  GoogleAIBackend: new () => unknown;
  getGenerativeModel(backend: unknown, options: Record<string, unknown>): { startChat(options: { history?: unknown[] }): ChatSession };
  Schema: SchemaBuilder;
}
interface AppModule { getApps(): unknown[]; initializeApp(config: object): unknown }
interface AppCheckModule { initializeAppCheck(app: unknown, options: { provider: unknown; isTokenAutoRefreshEnabled: boolean }): unknown; ReCaptchaV3Provider: new (key: string) => unknown }
type Sdk = { ai: AiModule; backend: unknown };

export interface ChatHooks { onLive(text: string): void; onStep(label: string): void }
export interface AssistantChat {
  /** Texto final da resposta (vazio se o modelo so chamou ferramentas). */
  ask(text: string, hooks: ChatHooks): Promise<string>;
  /** Pre-carrega o SDK para a primeira pergunta nao esperar por ele. */
  warm(): void;
  reset(): void;
}

const PASSOS: Record<string, string> = { listar_propostas: 'Procurando as propostas', ver_proposta: 'Abrindo a proposta', historico_revisoes: 'Lendo as revisões', acompanhamento_obra: 'Consultando a obra no Centro de Custos',
  resumo_comercial: 'Somando o comercial', listar_clientes: 'Procurando os clientes', listar_kits: 'Procurando os kits', buscar_catalogo: 'Procurando no catálogo', abrir_tela: 'Preparando a tela' };
const MAX_ROUNDS = 6;

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

type ErrorLike = { message?: unknown; customErrorData?: { status?: unknown } };
const describe = (e: unknown) => { const x = (e ?? {}) as ErrorLike; return `${String(x.message ?? '')} ${String(x.customErrorData?.status ?? '')}`; };
const quota = (e: unknown) => /\b429\b|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(describe(e));
// Modelo sobrecarregado no Google (500/503 "high demand"): passageiro.
const overloaded = (e: unknown) => /\b50[03]\b|high demand|overloaded|UNAVAILABLE/i.test(describe(e));

export function friendlyError(error: unknown): string {
  const text = describe(error);
  if (isOffline()) return 'O assistente precisa de internet.';
  if (/api-not-enabled|SERVICE_DISABLED/.test(text)) return 'O assistente ainda não foi ativado no Firebase (AI Logic). Avise o administrador.';
  if (/app-check|appcheck|recaptcha|403/i.test(text)) return 'O assistente ainda não foi liberado para este site no Firebase (App Check). Avise o administrador.';
  if (quota(error)) return 'O limite gratuito do assistente acabou por agora. Tente de novo em alguns minutos.';
  if (overloaded(error)) return 'O serviço de IA do Google está sobrecarregado agora. Tente de novo em instantes.';
  if (/import|Failed to fetch|NetworkError|Load failed/i.test(text)) return 'Não foi possível carregar o assistente. Verifique a internet.';
  return 'O assistente não conseguiu responder agora. Tente de novo.';
}

// URL montada em tempo de execucao: o Vite nao empacota o SDK, o navegador busca no CDN.
const load = (file: string): Promise<unknown> => import(/* @vite-ignore */ `${SDK_BASE}${file}`);

async function loadSdk(): Promise<Sdk> {
  const [app, ai] = await Promise.all([load('firebase-app.js') as Promise<AppModule>, load('firebase-ai.js') as Promise<AiModule>]);
  const fb = app.getApps()[0] || app.initializeApp(FIREBASE_CONFIG);
  if (typeof location !== 'undefined' && appCheckAllowed(location)) {
    try {
      const check = await load('firebase-app-check.js') as AppCheckModule;
      check.initializeAppCheck(fb, { provider: new check.ReCaptchaV3Provider(RECAPTCHA_KEY), isTokenAutoRefreshEnabled: true });
    } catch { /* App Check e opcional (o Firebase AI nao o exige hoje): a conversa segue sem ele */ }
  }
  return { ai, backend: ai.getAI(fb, { backend: new ai.GoogleAIBackend() }) };
}

export function createAssistantChat(options: { tools: AssistantTools; prompt: () => string; screen: () => string }): AssistantChat {
  let sdk: Promise<Sdk> | null = null;
  let chat: ChatSession | null = null;
  let model = 0;
  let screen = '';

  const getSdk = () => {
    if (!sdk) sdk = loadSdk().catch((error: unknown) => { sdk = null; throw error; });
    return sdk;
  };

  async function newChat(history?: unknown[]) {
    const { ai, backend } = await getSdk();
    const m = MODELS[model];
    chat = ai.getGenerativeModel(backend, {
      model: m.nome, systemInstruction: options.prompt(), tools: options.tools.declarations(ai.Schema),
      generationConfig: { temperature: 0.3, maxOutputTokens: 1200, thinkingConfig: { thinkingLevel: m.pensar } },
    }).startChat({ history: history || [] });
    screen = options.screen();
  }

  // Texto parcial vai para a bolha ao vivo; devolve a resposta completa (com as chamadas de ferramenta).
  async function stream(content: Content, hooks: ChatHooks, seen: { text: string }) {
    seen.text = '';
    const r = await (chat as ChatSession).sendMessageStream(content);
    for await (const chunk of r.stream) {
      let t = '';
      try { t = chunk.text(); } catch { t = ''; } // pedaco so com chamada de ferramenta nao tem texto
      if (t) { seen.text += t; hooks.onLive(seen.text); }
    }
    return { response: await r.response };
  }

  // Limite gratuito ou modelo sobrecarregado: segue no reserva com a mesma conversa;
  // no ultimo modelo, tenta mais uma vez depois de uma pausa curta.
  async function send(content: Content, hooks: ChatHooks) {
    if (!chat) await newChat();
    else if (screen !== options.screen()) await newChat(await chat.getHistory()); // a instrucao conta a tela aberta agora
    const seen = { text: '' };
    try {
      return await stream(content, hooks, seen);
    } catch (error) {
      if (seen.text || (!quota(error) && !overloaded(error))) throw error;
      if (model + 1 < MODELS.length) {
        model += 1;
        await newChat(await (chat as ChatSession).getHistory());
      } else if (overloaded(error)) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } else throw error;
      return stream(content, hooks, seen);
    }
  }

  return {
    warm() { if (!isOffline()) getSdk().catch(() => undefined); },
    reset() { chat = null; model = 0; },
    async ask(text, hooks) {
      let result = await send(text, hooks);
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const calls = result.response.functionCalls() || [];
        if (!calls.length) break;
        hooks.onLive(''); // texto antes da consulta ("vou verificar") sai
        hooks.onStep(PASSOS[calls[0].name] || 'Consultando');
        const parts: Array<{ functionResponse: { name: string; response: unknown } }> = [];
        for (const call of calls) parts.push({ functionResponse: { name: call.name, response: await options.tools.run(call) } });
        result = await send(parts, hooks);
      }
      try { return result.response.text(); } catch { return ''; }
    },
  };
}
