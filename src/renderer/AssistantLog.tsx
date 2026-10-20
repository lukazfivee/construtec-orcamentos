import { useEffect, useRef } from 'react';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { parseMarkdown } from './assistant/assistantMarkdown';
import type { Inline } from './assistant/assistantMarkdown';
import type { PendingNav } from './assistant/assistantTools';
import { summary } from './assistant/proposalDraft';
import type { ProposalDraft } from './assistant/proposalDraft';
import { describePlan } from './assistant/proposalEdit';
import type { EditPlan } from './assistant/proposalEdit';

/** Cartao de confirmacao da proposta montada pela IA: so o botao cria (a IA nao grava nada). */
export type DraftCard = { draft?: ProposalDraft; plan?: EditPlan; state: 'open' | 'busy' | 'done' | 'dismissed'; note?: string };
export type AssistantMsg = { who: 'eu' | 'ia' | 'erro'; text: string; go?: PendingNav; card?: DraftCard };

// Texto da IA vira elementos do React (que escapam sozinhos); nunca HTML cru.
function Parts({ parts }: { parts: Inline[] }) {
  return <>{parts.map((part, i) => (part.bold ? <b key={i}>{part.text}</b> : part.text))}</>;
}

function EditCardView({ card, onCreate, onDismiss }: { card: DraftCard; onCreate: () => void; onDismiss: () => void }) {
  const plan = card.plan as EditPlan;
  const open = card.state === 'open' || card.state === 'busy';
  return (
    <div className={`assistant-card ${card.state}`}>
      <b>Alterações na proposta {plan.base.number} · REV {String(plan.base.revision).padStart(2, '0')}</b>
      <ul>{describePlan(plan).map((line, index) => <li key={index}>{line}</li>)}</ul>
      <small>Nada foi alterado ainda. Os valores seguem as regras do editor (BDI e imposto da proposta).</small>
      {card.note && <p className="assistant-card-note">{card.note}</p>}
      {open && (
        <div className="assistant-card-actions">
          <button type="button" className="assistant-go" disabled={card.state === 'busy'} onClick={onCreate}><Check size={15} aria-hidden="true" />{card.state === 'busy' ? 'Aplicando' : 'Aplicar alterações'}</button>
          <button type="button" className="assistant-card-keep" disabled={card.state === 'busy'} onClick={onDismiss}>Continuar conversando</button>
        </div>
      )}
      {card.state === 'done' && <p className="assistant-card-note"><Check size={14} aria-hidden="true" /> Alterações aplicadas.</p>}
    </div>
  );
}

function DraftCardView({ card, onCreate, onDismiss }: { card: DraftCard; onCreate: () => void; onDismiss: () => void }) {
  if (card.plan) return <EditCardView card={card} onCreate={onCreate} onDismiss={onDismiss} />;
  const view = summary(card.draft as ProposalDraft);
  const open = card.state === 'open' || card.state === 'busy';
  return (
    <div className={`assistant-card ${card.state}`}>
      <b>Proposta para conferir</b>
      <dl>
        <dt>Cliente</dt><dd>{view.cliente?.nome}{view.cliente?.situacao === 'novo cadastro' && <em> (novo cadastro)</em>}</dd>
        <dt>Obra</dt><dd>{view.obra?.nome}{view.obra?.situacao === 'nova obra' && <em> (nova)</em>}</dd>
        <dt>Escopo</dt><dd>{view.escopo}</dd>
        {view.prazo_execucao && <><dt>Prazo</dt><dd>{view.prazo_execucao}</dd></>}
        {view.pagamento && <><dt>Pagamento</dt><dd>{view.pagamento}</dd></>}
        {view.garantia && <><dt>Garantia</dt><dd>{view.garantia}</dd></>}
        {view.validade_dias && <><dt>Validade</dt><dd>{view.validade_dias} dias</dd></>}
        {view.bdi != null && <><dt>BDI</dt><dd>{String(view.bdi).replace('.', ',')}</dd></>}
        {view.imposto_pct != null && <><dt>Imposto</dt><dd>{String(view.imposto_pct).replace('.', ',')}%</dd></>}
      </dl>
      {view.mao_de_obra.length > 0 && (
        <ul>{view.mao_de_obra.map((l) => <li key={l.numero}>Mão de obra: {l.profissionais} {l.descricao} · {l.horas_por_profissional} h cada</li>)}</ul>
      )}
      {view.itens.length > 0 && (
        <ul>{view.itens.map((item) => <li key={item.numero}>{item.quantidade} {item.unidade} · {item.descricao}{item.custo_unitario != null && <em> (custo {item.custo_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</em>}{item.preco === 'sem preço (avulso)' && <em> (sem preço)</em>}</li>)}</ul>
      )}
      <small>Itens do catálogo usam o custo do catálogo; BDI e imposto, os padrões da empresa (ou o que você informou). Itens sem preço você completa no editor.</small>
      {card.note && <p className="assistant-card-note">{card.note}</p>}
      {open && (
        <div className="assistant-card-actions">
          <button type="button" className="assistant-go" disabled={card.state === 'busy'} onClick={onCreate}><Check size={15} aria-hidden="true" />{card.state === 'busy' ? 'Criando' : 'Criar proposta'}</button>
          <button type="button" className="assistant-card-keep" disabled={card.state === 'busy'} onClick={onDismiss}>Continuar conversando</button>
        </div>
      )}
      {card.state === 'done' && <p className="assistant-card-note"><Check size={14} aria-hidden="true" /> Proposta criada.</p>}
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <>
      {parseMarkdown(text).map((block, i) => (block.kind === 'ul'
        ? <ul key={i}>{block.items.map((item, j) => <li key={j}><Parts parts={item} /></li>)}</ul>
        : <p key={i}><Parts parts={block.parts} /></p>))}
    </>
  );
}

interface Props {
  log: AssistantMsg[];
  busy: boolean;
  live: string;
  step: string;
  suggestions: string[];
  onAsk: (text: string) => void;
  onGo: (go: PendingNav) => void;
  onCreate: (index: number) => void;
  onDismiss: (index: number) => void;
}

export function AssistantLog({ log, busy, live, step, suggestions, onAsk, onGo, onCreate, onDismiss }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [log, live, busy, step]);
  return (
    <div className="assistant-log" ref={box} aria-live="polite">
      {log.length === 0 && (
        <div className="assistant-hello">
          <Sparkles size={28} aria-hidden="true" />
          <b>Como posso ajudar?</b>
          <span>Pergunte sobre propostas, clientes, kits, catálogo e a obra de cada proposta, ou peça para abrir uma tela.</span>
          <div className="assistant-suggestions">
            {suggestions.map((text) => <button key={text} type="button" onClick={() => onAsk(text)}>{text}</button>)}
          </div>
        </div>
      )}
      {log.map((msg, i) => (
        <div key={i} className={`assistant-msg ${msg.who}`}>
          {msg.who === 'ia' ? <Markdown text={msg.text} /> : msg.text}
          {msg.card && msg.card.state !== 'dismissed' && <DraftCardView card={msg.card} onCreate={() => onCreate(i)} onDismiss={() => onDismiss(i)} />}
          {msg.go && <button type="button" className="assistant-go" onClick={() => msg.go && onGo(msg.go)}><ArrowRight size={15} aria-hidden="true" />Ir para {msg.go.label}</button>}
        </div>
      ))}
      {busy && live && <div className="assistant-msg ia"><Markdown text={live} /></div>}
      {busy && !live && (
        <div className="assistant-msg ia busy" role="status">
          <span className="assistant-dots" aria-hidden="true"><i /><i /><i /></span>
          <small>{step}</small>
        </div>
      )}
    </div>
  );
}
