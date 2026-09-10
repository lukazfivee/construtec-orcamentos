import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Mail, MessageCircle, Send, Share2, Sparkles, X } from 'lucide-react';
import type { ProposalDetail } from '../shared/contracts';
import {
  commercialLaborTotal,
  commercialMaterialsTotal,
  date,
  documentTotal,
  money,
  parseCommercialConditions,
} from '../documents/proposalDocumentCommon';

interface ProposalShareDialogProps {
  open: boolean;
  proposal: ProposalDetail | null;
  onClose: () => void;
  onNotice: (message: string) => void;
}

export function sanitizeWhatsAppPhone(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0055')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.replace(/^0+/, '');
  }
  if (digits.startsWith('550')) {
    digits = `55${digits.slice(3)}`;
  }
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    digits = `55${digits}`;
  }
  return digits;
}

export function isValidEmail(emailAddress: string): boolean {
  if (!emailAddress.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim());
}

export function ProposalShareDialog({
  open,
  proposal,
  onClose,
  onNotice,
}: ProposalShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'full' | 'compact' | 'followup'>('full');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const conditions = useMemo(() => {
    return proposal ? parseCommercialConditions(proposal.scope) : null;
  }, [proposal]);

  const total = useMemo(() => (proposal ? documentTotal(proposal) : 0), [proposal]);
  const laborTotal = useMemo(() => (proposal ? commercialLaborTotal(proposal) : 0), [proposal]);
  const materialsTotal = useMemo(() => (proposal ? commercialMaterialsTotal(proposal) : 0), [proposal]);

  const validUntilFormatted = useMemo(() => {
    if (!proposal?.validUntil) return 'A combinar';
    return date.format(new Date(`${proposal.validUntil}T00:00:00Z`));
  }, [proposal]);

  // Generate default message based on mode
  const generatedTemplate = useMemo(() => {
    if (!proposal) return '';
    const greetingName = proposal.responsibleName?.trim() || proposal.clientName;
    const workInfo = proposal.workName ? `\n🏢 *Obra / Local:* ${proposal.workName}` : '';
    const executionInfo = conditions?.executionTerm ? `\n⏱️ *Prazo de Execução:* ${conditions.executionTerm}` : '';
    const paymentInfo = conditions?.paymentTerms ? `\n💳 *Condição de Pagamento:* ${conditions.paymentTerms}` : '';

    if (mode === 'followup') {
      return `Olá, ${greetingName}! Tudo bem?

Estamos acompanhando o andamento do seu projeto e a nossa proposta comercial:
📋 *Proposta:* ${proposal.number} (Rev. ${String(proposal.revision).padStart(2, '0')})${workInfo}
💰 *Valor Global:* ${money.format(total)}
⏳ *Prazo de Validade:* ${validUntilFormatted}

Gostaríamos de saber se você teve a oportunidade de avaliar as condições apresentadas. Caso necessite de ajustes no escopo, dúvidas técnicas ou extensão do prazo de validade, estamos à sua inteira disposição!

Atenciosamente,
*LAC CONSTRUTEC CONSTRUTORA EIRELI*
(71) 99294-1099 • supervisao@rcconstrutec.com.br`;
    }

    if (mode === 'compact') {
      return `Olá, ${greetingName}! Tudo bem?

Segue o resumo do orçamento da *Construtec*:
📋 *Proposta:* ${proposal.number} (Rev. ${String(proposal.revision).padStart(2, '0')})${workInfo}
💰 *Valor Total:* ${money.format(total)}
📅 *Validade:* ${validUntilFormatted}${executionInfo}

O documento formal completo em PDF/Word já está disponível para envio.
Ficamos à disposição para quaisquer esclarecimentos!

*LAC CONSTRUTEC CONSTRUTORA EIRELI*
(71) 99294-1099 • supervisao@rcconstrutec.com.br`;
    }

    const laborBreakdown = laborTotal > 0
      ? `\n   • Materiais e Equipamentos: ${money.format(materialsTotal)}\n   • Serviços Técnicos / Montagem: ${money.format(laborTotal)}`
      : '';

    return `Prezado(a) ${greetingName},

Esperamos que este contato o encontre bem!

Apresentamos a proposta técnico-comercial elaborada pela *Construtec* para o seu projeto:

📋 *Identificação:* Proposta Nº ${proposal.number} (Revisão ${String(proposal.revision).padStart(2, '0')})
👤 *Cliente:* ${proposal.clientName}${workInfo}

💰 *Composição Financeira:*${laborBreakdown}
⭐ *Valor Global da Proposta:* ${money.format(total)}

📅 *Validade da Proposta:* ${validUntilFormatted}${executionInfo}${paymentInfo}

Permanecemos à inteira disposição para ajustes de escopo, alinhamento técnico ou esclarecimentos comerciais.

Atenciosamente,
*LAC CONSTRUTEC CONSTRUTORA EIRELI*
Rua Metodio Coelho, 62, Ed. Cidadella Center I, Sala 112, Salvador/BA
Contato: (71) 99294-1099 • supervisao@rcconstrutec.com.br`;
  }, [proposal, conditions, total, laborTotal, materialsTotal, validUntilFormatted, mode]);

  useEffect(() => {
    setCustomText(generatedTemplate);
  }, [generatedTemplate]);

  if (!open || !proposal) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customText);
      setCopied(true);
      onNotice('Mensagem comercial copiada para a área de transferência!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onNotice('Não foi possível copiar automaticamente.');
    }
  };

  const openUrl = (url: string) => {
    if (window.construtec?.openExternal) {
      void window.construtec.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleWhatsApp = () => {
    const cleanPhone = sanitizeWhatsAppPhone(phone);
    if (phone.trim() && cleanPhone.length < 10) {
      onNotice('Por favor, informe um número de telefone com DDD válido (ex: 71 99999-9999).');
      return;
    }
    const baseUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(customText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(customText)}`;
    openUrl(baseUrl);
    onNotice('Abrindo conversa no WhatsApp…');
    onClose();
  };

  const handleEmail = async () => {
    const trimmedEmail = email.trim();
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      onNotice('Por favor, informe um endereço de e-mail válido (ex: contato@empresa.com.br).');
      return;
    }
    const subject = `Proposta Comercial ${proposal.number} - Construtec (${proposal.clientName})`;
    try {
      await navigator.clipboard.writeText(customText);
    } catch {
      // O envio continua com customText mesmo quando a área de transferência não está disponível.
    }

    if (window.construtec?.openWebmail) {
      await window.construtec.openWebmail({
        to: trimmedEmail,
        subject,
        body: customText,
      });
      onNotice('Mensagem copiada! Abrindo UOL Webmail Pro…');
    } else {
      const mailtoUrl = trimmedEmail
        ? `mailto:${trimmedEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(customText)}`
        : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(customText)}`;
      openUrl(mailtoUrl);
      onNotice('Abrindo cliente de e-mail…');
    }
    onClose();
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="proposal-share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="share-dialog-header">
          <div className="title-area">
            <Share2 size={22} className="share-icon" />
            <div>
              <h2 id="share-dialog-title">Compartilhar Proposta Comercial</h2>
              <p>
                <b>{proposal.number}</b> · REV.{String(proposal.revision).padStart(2, '0')} — {proposal.clientName}
              </p>
            </div>
          </div>
          <button type="button" className="dialog-close" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="share-dialog-body">
          {/* Contatos opcionais de destino */}
          <div className="share-contacts-bar">
            <div className="contact-field">
              <label htmlFor="share-phone">WhatsApp / Celular do Cliente:</label>
              <input
                id="share-phone"
                type="tel"
                placeholder="(71) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="contact-field">
              <label htmlFor="share-email">E-mail do Cliente:</label>
              <input
                id="share-email"
                type="email"
                placeholder="responsavel@cliente.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Seletor de Modelo de Mensagem */}
          <div className="share-template-selector">
            <span className="template-label">
              <Sparkles size={14} /> Modelo de Mensagem:
            </span>
            <div className="template-chips">
              <button
                type="button"
                className={`template-chip ${mode === 'full' ? 'active' : ''}`}
                onClick={() => setMode('full')}
              >
                Formal & Completo
              </button>
              <button
                type="button"
                className={`template-chip ${mode === 'compact' ? 'active' : ''}`}
                onClick={() => setMode('compact')}
              >
                Direto / WhatsApp
              </button>
              <button
                type="button"
                className={`template-chip ${mode === 'followup' ? 'active' : ''}`}
                onClick={() => setMode('followup')}
              >
                Follow-up / Validade
              </button>
            </div>
          </div>

          {/* Área de edição do texto */}
          <div className="share-message-wrapper">
            <div className="message-label">
              <span>Texto da Mensagem (editável antes de enviar):</span>
              <button type="button" className="btn-copy-inline" onClick={handleCopy}>
                {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                {copied ? 'Copiado!' : 'Copiar texto'}
              </button>
            </div>
            <textarea
              className="share-textarea"
              rows={11}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
            />
          </div>
        </div>

        <footer className="share-dialog-footer">
          <div className="footer-tip">
            Envie com 1 clique pelo WhatsApp ou pelo UOL Webmail Pro corporativo.
          </div>
          <div className="footer-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-action-email"
              onClick={handleEmail}
              title="Abre o UOL Webmail Pro com login salvo e proposta copiada para envio"
            >
              <Mail size={16} /> Enviar Webmail Pro
            </button>
            <button type="button" className="btn-action-whatsapp" onClick={handleWhatsApp}>
              <MessageCircle size={16} /> Enviar WhatsApp
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
