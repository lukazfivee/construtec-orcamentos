import { useEffect, useRef } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { parseMarkdown } from './assistant/assistantMarkdown';
import type { Inline } from './assistant/assistantMarkdown';
import type { PendingNav } from './assistant/assistantTools';

export type AssistantMsg = { who: 'eu' | 'ia' | 'erro'; text: string; go?: PendingNav };

// Texto da IA vira elementos do React (que escapam sozinhos); nunca HTML cru.
function Parts({ parts }: { parts: Inline[] }) {
  return <>{parts.map((part, i) => (part.bold ? <b key={i}>{part.text}</b> : part.text))}</>;
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
}

export function AssistantLog({ log, busy, live, step, suggestions, onAsk, onGo }: Props) {
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
