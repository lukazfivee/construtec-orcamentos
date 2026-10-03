import { useEffect, useState } from 'react';
import { FileText, Loader2, Send } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import { proposalApi } from './api';
import { openExternalUrl, printDocument } from './proposalPdfActions';
import { isValidEmail, sanitizeWhatsAppPhone } from './ProposalShareDialog';
import { pdfDefaultMessage, pdfFileName, revLabel, type PdfChoices } from './proposalPdfPages';

type SendProps = {
  proposal: ProposalDetail;
  choices: PdfChoices;
  fetchDocument: () => Promise<string>;
  onClose: () => void;
  onSent: (proposal: ProposalDetail) => void;
  showNotice: (message: string) => void;
};

// Enviar ao cliente (tela 23o): contatos, mensagem e anexo. Marca a proposta como Enviada.
export function ProposalSendDrawer({ proposal, choices, fetchDocument, onClose, onSent, showNotice }: SendProps) {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(() => pdfDefaultMessage(proposal));
  const [mark, setMark] = useState(true);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState('');
  const canMark = proposal.status !== 'sent';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sending, onClose]);

  const send = async () => {
    const cleanPhone = sanitizeWhatsAppPhone(phone);
    if (phone.trim() && cleanPhone.length < 10) { setProblem('Informe o WhatsApp com DDD (ex.: 71 99999-9999).'); return; }
    if (email.trim() && !isValidEmail(email)) { setProblem('Confira o e-mail digitado.'); return; }
    setSending(true);
    setProblem('');
    try {
      const html = await fetchDocument();
      printDocument(html);
      if (cleanPhone) openExternalUrl(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`);
      if (email.trim()) {
        const subject = `Proposta ${proposal.number} · Construtec`;
        const body = `${message}\n\nO arquivo da proposta segue em anexo.`;
        if (window.construtec?.openWebmail) await window.construtec.openWebmail({ to: email.trim(), subject, body });
        else openExternalUrl(`mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      }
      if (canMark && mark) {
        const result = await proposalApi.updateStatus(proposal.id, 'sent');
        onSent(result.proposal);
      } else {
        showNotice('Envio preparado. A situação da proposta não mudou.');
        onClose();
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Não foi possível enviar agora.');
      setSending(false);
    }
  };

  return (
    <div className="side-drawer-layer">
      <button type="button" className="side-drawer-scrim" aria-label="Fechar painel" disabled={sending} onClick={onClose} />
      <aside className="side-drawer" role="dialog" aria-modal="true" aria-label="Enviar ao cliente">
        <header>
          <span className="side-drawer-icon" aria-hidden="true"><Send size={18} /></span>
          <div><h2>{proposal.status === 'sent' ? 'Reenviar ao cliente' : 'Enviar ao cliente'}</h2><p>{proposal.number} · {revLabel(proposal.revision)} · {proposal.workName || proposal.clientName}</p></div>
        </header>
        <div className="side-drawer-body">
          {proposal.status === 'draft' && (
            <div className="drawer-warn" role="note">Esta revisão ainda não passou pela revisão interna. Dá para enviar, mas o ideal é revisar antes.</div>
          )}
          <div className="kv-line"><span>Cliente</span><b>{proposal.clientName}</b></div>
          <label className="drawer-field"><span>WhatsApp do cliente (opcional)</span>
            <input type="tel" inputMode="tel" value={phone} placeholder="71 99999-9999" onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="drawer-field"><span>E-mail do cliente (opcional)</span>
            <input type="email" value={email} placeholder="contato@empresa.com.br" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="drawer-field"><span>Mensagem</span>
            <textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <div className="drawer-attach"><FileText size={20} /><span><b>{pdfFileName(proposal)}</b><small>Proposta {choices.modelo === 'completo' ? 'completa' : 'resumida'} · só preços de venda</small></span></div>
          {canMark && (
            <button type="button" className="drawer-switch" role="switch" aria-checked={mark} onClick={() => setMark((v) => !v)}>
              <span><b>Marcar a proposta como Enviada</b><small>Registra o envio na proposta e no histórico</small></span><i className="switch" />
            </button>
          )}
          <p className="side-drawer-note">O PDF abre na janela de impressão: escolha Salvar como PDF e anexe na conversa. A proposta só muda de situação aqui, ao confirmar.</p>
          {problem && <p className="drawer-problem" role="alert">{problem}</p>}
        </div>
        <footer>
          <button type="button" className="flow-btn" disabled={sending} onClick={onClose}>Cancelar</button>
          <button type="button" className="flow-btn primary" disabled={sending} onClick={() => void send()}>
            {sending ? <Loader2 size={16} className="spinning" /> : <Send size={16} />} Enviar
          </button>
        </footer>
      </aside>
    </div>
  );
}
