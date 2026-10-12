// Ajudantes de navegacao dentro da pagina, instalados antes de cada carregamento como window.__conf.
// Achar o controle pelo texto visivel (e nao por classe) mantem o kit valido quando o CSS muda.

export const AJUDANTES = `(() => {
  const N = (s) => String(s || '').trim().replace(/\\s+/g, ' ').toLowerCase();
  const visivel = (e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed';
  const rotulo = (e) => N(e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || '');
  window.__conf = {
    // Clica no n-esimo controle visivel cujo rotulo comeca com o texto (dentro de um escopo CSS).
    clicar(texto, escopo, n) {
      const base = document.querySelector(escopo || 'body') || document.body;
      const achados = [...base.querySelectorAll('button, a, [role=tab], summary, label, [role=button]')].filter((e) => visivel(e) && rotulo(e).startsWith(N(texto)));
      const alvo = achados[n || 0];
      if (!alvo) return false;
      alvo.click();
      return true;
    },
    // Linha (tr, li, cartao) que contem o texto: clica no botao pedido dentro dela, ou nela mesma.
    linha(texto, botao) {
      const linhas = [...document.querySelectorAll('tr, li, article, .card')].filter((e) => visivel(e) && N(e.innerText).includes(N(texto)));
      const linha = linhas[linhas.length - 1];
      if (!linha) return false;
      const b = botao && [...linha.querySelectorAll('button, a')].find((x) => rotulo(x).startsWith(N(botao)));
      (b || linha).click();
      return true;
    },
    tem(texto) { return N(document.body.innerText).includes(N(texto)); },
  };
})();`;
