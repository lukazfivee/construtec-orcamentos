// Acoes de arquivo do PDF no computador: salvar o PDF, imprimir/salvar como PDF e abrir links externos.
import type { ProposalDetail } from '../shared/contracts';
import { proposalFileBaseName } from '../documents/proposalDocumentCommon';

// O navegador sugere o nome do arquivo pelo titulo da pagina: durante a impressao o app e o documento ficam com o nome da proposta.
const printWithTitle = (frame: HTMLIFrameElement, title: string, after: () => void) => {
  const appTitle = document.title;
  const restore = () => { document.title = appTitle; };
  document.title = title;
  try {
    frame.contentWindow?.addEventListener('afterprint', restore);
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  } finally {
    window.setTimeout(() => { restore(); after(); }, 60000);
  }
};

// Abre a impressao: "Salvar como PDF" gera o arquivo. Mesmo caminho do dialogo de exportacao.
export const printDocument = (html: string, title: string) => {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  frame.onload = () => {
    window.setTimeout(() => printWithTitle(frame, title, () => frame.remove()), 200);
  };
  frame.srcdoc = html;
};

// No app do Windows o PDF e gerado pelo proprio app (timbrado completo, nome Proposta_Construtec_...) e salvo onde a pessoa escolher;
// no navegador cai na impressao. Devolve o caminho salvo, ou null se a pessoa cancelou ou foi para a impressao.
export const savePdfDocument = async (proposal: ProposalDetail, html: string): Promise<{ saved: string | null }> => {
  const title = proposalFileBaseName(proposal);
  if (window.construtec?.savePdf) {
    const result = await window.construtec.savePdf(proposal, html, `${title}.pdf`);
    return { saved: result.canceled ? null : result.filePath ?? null };
  }
  printDocument(html, title);
  return { saved: null };
};

export const openExternalUrl = (url: string) => {
  if (window.construtec?.openExternal) void window.construtec.openExternal(url);
  else window.open(url, '_blank', 'noopener');
};

// Word (.docx) do documento do servidor: baixa com o nome da proposta (no app do Windows abre a janela de salvar).
export const saveWordDocument = (proposal: ProposalDetail, bytes: Uint8Array) => {
  const name = `${proposalFileBaseName(proposal)}.docx`;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  return name;
};

// Contatos do envio (Enviar ao cliente): WhatsApp com DDI 55 e e-mail opcional.
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
