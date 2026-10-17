// Comparacao entre a Referencia e a tela real, e o texto da lista de divergencias. Funcoes puras (testadas em conferencia.test.mjs).

export const normalizarTexto = (texto) => String(texto).toLowerCase().replace(/\s+/g, ' ').replace(/[.:;,\s]+$/g, '').trim();

// Textos fixos da Referencia que nao aparecem em lugar nenhum do texto visivel da tela.
export function textosAusentes(textosReferencia, textoDaTela) {
  const tela = normalizarTexto(textoDaTela);
  return textosReferencia.filter((texto) => !tela.includes(normalizarTexto(texto)));
}

export function corParaHex(cor) {
  const texto = String(cor).trim().toLowerCase();
  const curto = /^#([0-9a-f]{3})$/.exec(texto);
  if (curto) return `#${[...curto[1]].map((c) => c + c).join('')}`;
  if (/^#[0-9a-f]{6}$/.test(texto)) return texto;
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(texto);
  if (rgb) {
    const alfa = rgb[4] === undefined ? 1 : Number(rgb[4]);
    if (alfa === 1) return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
    return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${rgb[4]})`;
  }
  return texto;
}

const ehCor = (valor) => /^(#[0-9a-f]{3,6}|rgba?\()/i.test(valor.trim());

// So compara tokens cujo valor na Referencia e uma cor simples; sombras e fontes ficam de fora.
export function compararTokens(referencia, real) {
  const diferencas = [];
  for (const [token, esperado] of Object.entries(referencia)) {
    if (!ehCor(esperado) || !real[token]) continue;
    if (corParaHex(esperado) !== corParaHex(real[token])) diferencas.push({ token, referencia: esperado, real: real[token] });
  }
  return diferencas;
}

// resultados: [{ tela, referencia, resolucao, tema, itens: [{ tipo, descricao }] }]
export function formatarLista(resultados) {
  const porTela = new Map();
  for (const r of resultados) {
    if (!porTela.has(r.tela)) porTela.set(r.tela, []);
    porTela.get(r.tela).push(r);
  }
  const linhas = [];
  for (const [tela, grupo] of porTela) {
    linhas.push(`## ${tela}`, '');
    const ref = [...new Set(grupo.map((g) => g.referencia).filter(Boolean))].join(', ');
    linhas.push(`Referência: ${ref || 'sem quadro equivalente no repositório (só medidas)'}`, '');
    const comItens = grupo.filter((g) => g.itens.length);
    if (!comItens.length) linhas.push('- sem divergência encontrada pelo kit', '');
    else {
      // Mesma divergencia em varias resolucoes ou temas vira uma linha so.
      const unicas = new Map();
      for (const g of comItens) for (const item of g.itens) {
        const chave = `${item.tipo}|${item.descricao}`;
        if (!unicas.has(chave)) unicas.set(chave, { item, onde: [] });
        unicas.get(chave).onde.push(`${g.tema} ${g.resolucao}`);
      }
      for (const { item, onde } of unicas.values()) linhas.push(`- [${item.tipo}] ${item.descricao} (${onde.join('; ')})`);
      linhas.push('');
    }
  }
  return linhas.join('\n');
}
