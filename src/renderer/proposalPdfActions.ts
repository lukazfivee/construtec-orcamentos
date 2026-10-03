// Acoes de arquivo do PDF no computador: imprimir/salvar como PDF e abrir links externos.

// Abre a impressao: "Salvar como PDF" gera o arquivo. Mesmo caminho do dialogo de exportacao.
export const printDocument = (html: string) => {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  frame.onload = () => {
    window.setTimeout(() => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } finally { window.setTimeout(() => frame.remove(), 60000); }
    }, 200);
  };
  frame.srcdoc = html;
};

export const openExternalUrl = (url: string) => {
  if (window.construtec?.openExternal) void window.construtec.openExternal(url);
  else window.open(url, '_blank', 'noopener');
};
