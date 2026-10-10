import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { SendHorizontal, Sparkles, X } from 'lucide-react';
import type { AuthUser } from '../shared/contracts';
import { liveAssistantApi } from './assistant/assistantApi';
import { createAssistantChat, friendlyError, isOffline } from './assistant/assistantChat';
import { appCheckAllowed, buildPrompt } from './assistant/assistantConfig';
import { createAssistantTools } from './assistant/assistantTools';
import type { AssistantNav, PendingNav } from './assistant/assistantTools';
import { AssistantLog } from './AssistantLog';
import type { AssistantMsg } from './AssistantLog';
import { seesCost, useCanEdit } from './SuitePermissions';

// Assistente de IA: botao flutuante em todas as telas depois do login (o App so monta depois dele) e
// painel de conversa. A conversa fica neste componente: sair da conta desmonta tudo e ela some.
interface Props extends AssistantNav {
  user?: AuthUser | null;
  /** Tela aberta agora, em texto: entra nas instrucoes da IA. */
  screen: string;
}

const NAV_DELAY = 900; // a tela abre depois que a pessoa le a resposta curta
const LONG_REPLY = 160; // resposta longa fica para ler, com o botao da tela
const SUGGESTIONS = ['Quais propostas estão em andamento?', 'Quanto temos aprovado e em negociação?', 'Quais propostas vencem a validade esta semana?', 'Como crio uma nova proposta?'];
const COST_SUGGESTION = 'Como está a obra da proposta aprovada mais recente?';

export function AssistantFab(props: Props) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<AssistantMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  const [step, setStep] = useState('Pensando');
  const [draft, setDraft] = useState('');
  const canEdit = useCanEdit();
  // Os callbacks do App mudam a cada render; a IA sempre chama os mais novos.
  const latest = useRef({ props, canEdit });
  useEffect(() => { latest.current = { props, canEdit }; });
  const engine = useRef<ReturnType<typeof makeEngine> | null>(null);
  if (!engine.current) engine.current = makeEngine(latest);
  const { tools, chat } = engine.current;
  const working = useRef(false);
  const navTimer = useRef<number | undefined>(undefined);
  const fab = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const warm = window.setTimeout(() => chat.warm(), 2500);
    return () => { window.clearTimeout(warm); window.clearTimeout(navTimer.current); chat.reset(); tools.clearPending(); };
  }, [chat, tools]);

  useEffect(() => {
    if (open) input.current?.focus();
    else if (wasOpen.current) fab.current?.focus();
    wasOpen.current = open;
    if (!open) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => { // a caixa de texto cresce com o que e digitado, ate 120 px
    const box = input.current;
    if (box) { box.style.height = 'auto'; box.style.height = `${Math.min(120, box.scrollHeight + box.offsetHeight - box.clientHeight)}px`; }
  }, [draft, open]);

  const push = (msg: AssistantMsg) => setLog((list) => [...list, msg]);
  const go = (target: PendingNav) => { setOpen(false); target.run(); };

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || working.current) return;
    push({ who: 'eu', text: question });
    if (isOffline()) { push({ who: 'erro', text: 'O assistente precisa de internet.' }); return; }
    working.current = true;
    window.clearTimeout(navTimer.current);
    tools.clearPending();
    setBusy(true); setStep('Pensando'); setLive('');
    try {
      const answer = await chat.ask(question, { onLive: setLive, onStep: setStep });
      let pending = tools.takePending();
      const reply: AssistantMsg = { who: 'ia', text: answer || (pending ? 'Abrindo.' : 'Não tenho uma resposta para isso. Pode explicar de outro jeito?') };
      if (pending && reply.text.length > LONG_REPLY) { reply.go = pending; pending = null; }
      push(reply);
      if (pending) { const target = pending; navTimer.current = window.setTimeout(() => go(target), NAV_DELAY); }
    } catch (error) {
      tools.clearPending();
      push({ who: 'erro', text: friendlyError(error) });
    } finally {
      working.current = false;
      setBusy(false); setLive('');
    }
  };

  const submit = (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (working.current || !draft.trim()) return;
    const text = draft;
    setDraft('');
    void ask(text);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  };
  const newChat = () => {
    if (working.current) return;
    setLog([]); chat.reset(); input.current?.focus();
  };
  const suggestions = seesCost() ? [...SUGGESTIONS.slice(0, 2), COST_SUGGESTION, ...SUGGESTIONS.slice(2)] : SUGGESTIONS;

  if (!open) {
    return <button ref={fab} type="button" className="assistant-fab" aria-label="Abrir o assistente" title="Assistente" onClick={() => setOpen(true)}><Sparkles size={24} aria-hidden="true" /></button>;
  }
  return (
    <>
      <div className="assistant-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <section className="assistant-panel" role="dialog" aria-labelledby="assistant-title">
        <div className="assistant-handle" aria-hidden="true" />
        <header className="assistant-head">
          <b id="assistant-title"><Sparkles size={16} aria-hidden="true" />Assistente</b>
          <button type="button" className="assistant-new" onClick={newChat} disabled={busy || log.length === 0}>Nova conversa</button>
          <button type="button" className="assistant-x" aria-label="Fechar" onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button>
        </header>
        <AssistantLog log={log} busy={busy} live={live} step={step} suggestions={suggestions} onAsk={(text) => void ask(text)} onGo={go} />
        <form className="assistant-input" onSubmit={submit}>
          <textarea ref={input} rows={1} maxLength={1500} value={draft} placeholder="Pergunte ou peça uma tela" aria-label="Mensagem para o assistente"
            onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} />
          <button type="submit" className="assistant-send" aria-label="Enviar" disabled={busy || !draft.trim()}><SendHorizontal size={18} aria-hidden="true" /></button>
        </form>
        <small className="assistant-note">
          A IA pode errar. Confira os valores nas telas.
          {appCheckAllowed(window.location) && <> Protegido pelo reCAPTCHA (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacidade</a>, <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Termos</a>).</>}
        </small>
      </section>
    </>
  );
}

type Latest = { current: { props: Props; canEdit: boolean } };

function makeEngine(latest: Latest) {
  const nav = (): AssistantNav => ({
    openProposal: (id) => latest.current.props.openProposal(id),
    navigate: (section) => latest.current.props.navigate(section),
    newProposal: () => latest.current.props.newProposal(),
    openCentroCustos: (obraId) => latest.current.props.openCentroCustos(obraId),
  });
  const tools = createAssistantTools({ api: liveAssistantApi, seesCost, canEdit: () => latest.current.canEdit, nav });
  const chat = createAssistantChat({
    tools,
    screen: () => latest.current.props.screen,
    prompt: () => buildPrompt({ name: latest.current.props.user?.name, role: latest.current.props.user?.role, screen: latest.current.props.screen, seesCost: seesCost() }),
  });
  return { tools, chat };
}
