// Medidas feitas DENTRO da pagina (Chrome headless), uma tela por vez. Evoluida de scripts/audit-rolagem.mjs: alem do ultimo
// elemento cortado e da rolagem aninhada, confere estouro horizontal, texto cortado por overflow e conteudo coberto por botao
// flutuante ou barra fixa. `medir` precisa ser autocontida: ela e serializada e enviada ao navegador.

export function medir(opcoes) {
  const vh = innerHeight; const vw = innerWidth;
  const desc = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? `.${e.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '');
  const trecho = (e) => { const t = (e.innerText || e.getAttribute('aria-label') || e.placeholder || '').trim().replace(/\s+/g, ' '); return t ? `"${t.slice(0, 40)}"` : ''; };
  const visivel = (e) => {
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let n = e; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || n.getAttribute?.('aria-hidden') === 'true') return false;
    }
    return true;
  };
  const oy = (e) => getComputedStyle(e).overflowY; const ox = (e) => getComputedStyle(e).overflowX;
  const rolaveis = [...document.querySelectorAll('body *')].filter((e) => visivel(e) && (oy(e) === 'auto' || oy(e) === 'scroll') && e.scrollHeight > e.clientHeight + 1);
  const escopo = document.querySelector(opcoes.escopo) || document.body;
  const semIcone = (e) => !(e.closest('svg') && e.tagName.toLowerCase() !== 'svg') && !e.closest('.sr, .toast, [aria-hidden="true"]');
  const textual = (e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) || e.matches('button,input,select,textarea,a[href],img,table,tr,svg');
  const emFixo = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return n; return null; };

  const problemas = [];
  const achado = (tipo, descricao) => { if (problemas.length < 40 && !problemas.some((p) => p.tipo === tipo && p.descricao === descricao)) problemas.push({ tipo, descricao }); };

  // Agrupa achados repetidos (uma tabela inteira cortada vira uma linha, nao trinta).
  const grupos = new Map();
  const agrupar = (tipo, chave, exemplo, detalhe) => {
    if (!grupos.has(`${tipo}|${chave}`)) grupos.set(`${tipo}|${chave}`, { tipo, chave, exemplos: [], total: 0, pior: 0, detalhe });
    const g = grupos.get(`${tipo}|${chave}`); g.total += 1; if (g.exemplos.length < 3) g.exemplos.push(exemplo);
    return g;
  };

  // 1) Cobertura por elementos fixos permanentes (botao do assistente, barra de abas), com a rolagem no fim.
  //    Menus, janelas e gavetas abertos ficam de fora: cobrir a tela e o papel deles.
  const cobertura = () => {
    const fixos = [...document.querySelectorAll('body *')].filter((f) => {
      if (getComputedStyle(f).position !== 'fixed' || !visivel(f) || f.closest('.sr')) return false;
      const r = f.getBoundingClientRect();
      if (r.width * r.height > vw * vh * 0.5) return false;
      if (f.matches('.toast, [role="status"], [role="dialog"], [role="menu"], [role="listbox"], [class*="popover"], [class*="drawer"], [class*="modal"], [class*="dialog"], [class*="sheet"]') || f.closest('.toast, [role="dialog"], [class*="popover"], [class*="drawer"], [class*="modal"], [class*="sheet"]')) return false;
      return true;
    });
    for (const f of fixos) {
      const fr = f.getBoundingClientRect();
      for (const e of escopo.querySelectorAll('*')) {
        if (!semIcone(e) || !textual(e) || !visivel(e) || f.contains(e) || e.contains(f) || emFixo(e)) continue;
        const r = e.getBoundingClientRect();
        const w = Math.min(r.right, fr.right) - Math.max(r.left, fr.left); const h = Math.min(r.bottom, fr.bottom) - Math.max(r.top, fr.top);
        if (w < 6 || h < 6) continue;
        const topo = document.elementFromPoint(Math.max(r.left, fr.left) + w / 2, Math.max(r.top, fr.top) + h / 2);
        if (topo && (f === topo || f.contains(topo))) agrupar('coberto', desc(f), `${desc(e)} ${trecho(e)}`);
      }
    }
  };
  // 2) Rola tudo ate o fim e mede o que ainda ficou cortado ou fora da janela.
  for (let k = 0; k < 2; k += 1) for (const s of rolaveis) s.scrollTop = s.scrollHeight;
  document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
  cobertura();

  const corte = (e) => {
    const r = e.getBoundingClientRect(); let pior = 0; let por = null; let eixo = '';
    for (let n = e.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const sy = oy(n); const sx = ox(n);
      const b = n.getBoundingClientRect();
      if (sy !== 'visible') { const cut = r.bottom - b.bottom; if (cut > pior + 0.5) { pior = cut; por = n; eixo = 'vertical'; } }
      if (sx !== 'visible' && sx !== 'auto' && sx !== 'scroll') { const cut = r.right - b.right; if (cut > pior + 0.5) { pior = cut; por = n; eixo = 'horizontal'; } }
    }
    return { pior, por, eixo };
  };
  let ultimo = null;
  for (const e of escopo.querySelectorAll('*')) {
    if (!semIcone(e) || getComputedStyle(e).position === 'fixed' || emFixo(e) || !visivel(e) || !textual(e)) continue;
    const r = e.getBoundingClientRect(); const c = corte(e);
    if (c.pior > 1) { const g = agrupar('cortado', `cortado por ${desc(c.por)} (${c.eixo})`, `${desc(e)} ${trecho(e)}`); g.pior = Math.max(g.pior, Math.round(c.pior)); }
    else if (r.right > vw + 1 && !rolaveis.some((s) => s.contains(e))) { const g = agrupar('fora-da-janela', 'passa da borda direita da janela', `${desc(e)} ${trecho(e)}`); g.pior = Math.max(g.pior, Math.round(r.right - vw)); }
    if (!ultimo || r.bottom > ultimo.bottom) ultimo = { el: e, bottom: r.bottom, r };
  }

  // 3) Texto cortado sem reticencias (overflow escondido, sem rolagem).
  for (const e of escopo.querySelectorAll('*')) {
    if (!semIcone(e) || !visivel(e)) continue;
    const s = getComputedStyle(e);
    if (s.overflowX === 'hidden' && s.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 2 && e.children.length === 0 && (e.innerText || '').trim()) agrupar('texto-cortado', 'texto sem reticências cortado pelo contêiner', `${desc(e)} ${trecho(e)}`);
  }

  // 3b) Fonte fora da familia da Suite (IBM Plex Sans): texto que caiu na fonte padrao do navegador.
  for (const e of escopo.querySelectorAll('*')) {
    if (!semIcone(e) || !visivel(e) || ![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    if (e.closest('.pg, [class*="page-frame"], [class*="proposal-page"], [class*="pdf-page"]')) continue; // a folha do documento tem fonte propria
    const familia = getComputedStyle(e).fontFamily.split(',')[0].trim().replace(/["']/g, '');
    if (!/^IBM Plex Sans/i.test(familia)) agrupar('fonte', `texto em "${familia}" em vez de IBM Plex Sans`, `${desc(e)} ${trecho(e)}`);
  }

  // 4) Rolagem aninhada e estouro horizontal da pagina.
  const aninhadas = rolaveis.filter((a) => rolaveis.some((b) => b !== a && b.contains(a)));
  for (const a of aninhadas) achado('rolagem-aninhada', `${desc(a)} rola dentro de outra area que rola`);
  const largura = document.scrollingElement.scrollWidth;
  if (largura > vw + 1) achado('rolagem-horizontal', `a página rola na horizontal (${largura} > ${vw})`);

  // 5) Respiro depois do ultimo elemento.
  let respiro = null;
  if (ultimo) {
    let sc = null; for (let n = ultimo.el.parentElement; n && !sc; n = n.parentElement) if ((oy(n) === 'auto' || oy(n) === 'scroll') && n.scrollHeight > n.clientHeight + 1) sc = n;
    const limite = sc ? sc.getBoundingClientRect().bottom : vh;
    respiro = Math.round(Math.min(vh, limite) - ultimo.bottom);
    if (opcoes.respiroMinimo && respiro < opcoes.respiroMinimo) achado('sem-respiro', `só ${respiro} px entre o último elemento e a borda (mínimo ${opcoes.respiroMinimo})`);
  }

  for (const g of grupos.values()) achado(g.tipo, `${g.chave}: ${g.total} elemento(s)${g.pior ? `, até ${g.pior} px` : ''}, ex.: ${g.exemplos.join('; ')}`);

  // Texto visivel completo (para comparar com a Referencia) e tokens atuais.
  const partes = [document.body.innerText];
  for (const e of document.querySelectorAll('[placeholder],[aria-label],[title]')) for (const a of ['placeholder', 'aria-label', 'title']) if (e.getAttribute(a)) partes.push(e.getAttribute(a));
  for (const o of document.querySelectorAll('option')) partes.push(o.textContent || '');
  const css = getComputedStyle(document.documentElement);
  const tokens = {}; for (const t of opcoes.tokens || []) tokens[t] = css.getPropertyValue(t).trim();
  const titulo = (document.querySelector('h1') || {}).innerText || '';
  return { problemas, respiro, texto: partes.join('\n'), tokens, titulo: titulo.trim(), rolaveis: rolaveis.map((s) => `${desc(s)} ${s.scrollHeight}/${s.clientHeight}`), alturaPagina: document.scrollingElement.scrollHeight };
}
