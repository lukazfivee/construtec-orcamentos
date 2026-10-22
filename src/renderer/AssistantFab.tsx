import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { AuthUser, ProposalDetail } from '../shared/contracts';
import { Ph } from './Ph';
import { proposalApi } from './api';
import { liveAssistantApi, liveCommitApi, liveEditApi } from './assistant/assistantApi';
import { commitDraft } from './assistant/assistantCommit';
import { applyPlan } from './assistant/proposalEdit';
import { createAssistantChat, friendlyError, isOffline } from './assistant/assistantChat';
import { appCheckAllowed, buildPrompt } from './assistant/assistantConfig';
import { createAssistantTools } from './assistant/assistantTools';
import type { AssistantNav, PendingNav } from './assistant/assistantTools';
import { AssistantLog } from './AssistantLog';
import type { AssistantMsg, DraftCard } from './AssistantLog';
import { seesCost, useCanEdit } from './SuitePermissions';
import { useIsMobile } from './useIsMobile';

// Assistente de IA: painel de conversa aberto pelo botao "Assistente" da barra do topo (desktop) ou pelo botao
// flutuante (celular), em todas as telas depois do login (o App so monta depois dele). A conversa fica neste componente: sair da conta desmonta tudo e ela some.
interface Props extends AssistantNav {
  /** Aberto/fechado fica no App: o botao do topo (desktop) e o flutuante (celular) mexem no mesmo estado. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: AuthUser | null;
  /** Tela aberta agora, em texto: entra nas instrucoes da IA. */
  screen: string;
  /** Proposta criada pelo cartao do assistente: o App abre o editor e atualiza as abas. */
  onProposalCreated: (created: ProposalDetail) => void;
}

const NAV_DELAY = 900; // a tela abre depois que a pessoa le a resposta curta
const LONG_REPLY = 160; // resposta longa fica para ler, com o botao da tela
const SUGGESTIONS = ['Quais propostas estão em andamento?', 'Quanto temos aprovado e em negociação?', 'Quais propostas vencem a validade esta semana?', 'Quero criar uma proposta'];
const COST_SUGGESTION = 'Como está a obra da proposta aprovada mais recente?';

export function AssistantFab(props: Props) {
  const { open, onOpenChange: setOpen } = props;
  const mobile = useIsMobile();
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
    else if (wasOpen.current) (fab.current ?? document.getElementById('btn-assistente'))?.focus();
    wasOpen.current = open;
    if (!open) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

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
      const confirm = tools.takeConfirm();
      const editConfirm = tools.takeEditConfirm();
      if (editConfirm || confirm) {
        reply.card = editConfirm ? { plan: editConfirm, state: 'open' } : { draft: { ...(confirm as NonNullable<typeof confirm>), items: (confirm as NonNullable<typeof confirm>).items.map((item) => ({ ...item })) }, state: 'open' };
        pending = null; // com o cartao na tela a IA nao abre outra tela por cima
        // So o cartao mais novo vale: os anteriores nao podem criar uma proposta ja superada.
        setLog((list) => [...list.map((msg) => (msg.card?.state === 'open' ? { ...msg, card: { ...msg.card, state: 'dismissed' as const } } : msg)), reply]);
      } else push(reply);
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
  const setCard = (index: number, patch: Partial<DraftCard>) => setLog((list) => list.map((msg, i) => (i === index && msg.card ? { ...msg, card: { ...msg.card, ...patch } } : msg)));
  const dismissCard = (index: number) => { if (!working.current) setCard(index, { state: 'dismissed' }); };
  const createFromCard = async (index: number) => {
    const card = log[index]?.card;
    if (!card || card.state !== 'open' || working.current) return;
    working.current = true;
    setCard(index, { state: 'busy', note: undefined });
    try {
      if (card.plan) {
        // Alterar proposta existente: grava na ordem do editor; se parar no meio, o cartao guarda so o que falta (nova tentativa nao repete).
        const applied = await applyPlan(liveEditApi, card.plan);
        if (applied.erro) { tools.setPlan(applied.plan); setCard(index, { state: 'open', plan: applied.plan, note: applied.erro }); return; }
        tools.setPlan(null, true);
        setCard(index, { state: 'done' });
        setOpen(false);
        latest.current.props.openProposal(card.plan.base.id);
        return;
      }
      const result = await commitDraft(liveCommitApi, card.draft as NonNullable<typeof card.draft>);
      if (!result.proposalId) { tools.setDraft(result.draft); setCard(index, { state: 'open', draft: result.draft, note: result.erro ?? 'Não consegui criar a proposta.' }); return; }
      // Daqui em diante a proposta existe: o cartao nunca volta a "aberta" (outro clique criaria uma segunda proposta).
      tools.setDraft(result.draft, true);
      setCard(index, { state: 'done', note: result.aviso });
      try {
        const created = await proposalApi.byId(result.proposalId);
        setOpen(false);
        latest.current.props.onProposalCreated(created.proposal);
      } catch {
        setCard(index, { state: 'done', note: [result.aviso, 'Não consegui abrir a proposta agora; ela está na lista de Propostas.'].filter(Boolean).join(' ') });
      }
    } catch (error) {
      setCard(index, { state: 'open', note: friendlyError(error) });
    } finally {
      working.current = false;
    }
  };
  const newChat = () => {
    if (working.current) return;
    setLog([]); chat.reset(); tools.setDraft({ items: [] }, true); tools.resetEdit(); input.current?.focus();
  };
  const suggestions = seesCost() ? [...SUGGESTIONS.slice(0, 2), COST_SUGGESTION, ...SUGGESTIONS.slice(2)] : SUGGESTIONS;

  if (!open) {
    if (!mobile) return null; // no desktop o assistente abre pelo botao da barra do topo
    return <button ref={fab} type="button" className="assistant-fab" aria-label="Abrir o assistente" title="Assistente" onClick={() => setOpen(true)}><Ph name="sparkle-fill" size={24} /></button>;
  }
  return (
    <>
      <div className="assistant-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <section className="assistant-panel" role="dialog" aria-labelledby="assistant-title">
        <div className="assistant-handle" aria-hidden="true" />
        <header className="assistant-head">
          <b id="assistant-title"><Ph name="sparkle" size={18} />Assistente</b>
          <button type="button" className="assistant-new" onClick={newChat} disabled={busy || log.length === 0}>Nova conversa</button>
          <button type="button" className="assistant-x" aria-label="Fechar" onClick={() => setOpen(false)}><Ph name="x" size={20} /></button>
        </header>
        <AssistantLog log={log} busy={busy} live={live} step={step} suggestions={suggestions} onAsk={(text) => void ask(text)} onGo={go} onCreate={(index) => void createFromCard(index)} onDismiss={dismissCard} />
        <form className="assistant-input" onSubmit={submit}>
          <textarea ref={input} rows={1} maxLength={1500} value={draft} placeholder="Pergunte, peça uma tela ou uma proposta" aria-label="Mensagem para o assistente"
            onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} />
          <button type="submit" className="assistant-send" aria-label="Enviar" disabled={busy || !draft.trim()}><Ph name="paper-plane-right" size={20} /></button>
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
    prompt: () => buildPrompt({ name: latest.current.props.user?.name, role: latest.current.props.user?.role, screen: latest.current.props.screen, seesCost: seesCost(), canEdit: latest.current.canEdit }),
  });
  return { tools, chat };
}
