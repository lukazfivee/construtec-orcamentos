// Extrai da Referencia (os prototipos .dc.html em docs/) o que da para conferir por maquina: tokens de cor, textos fixos de cada tela e
// a lista de quadros (estados) de cada rodada. Os prototipos nao abrem fora do canvas do design (faltam support.js e /_blob/),
// por isso a conferencia usa estes dados em vez de uma imagem lado a lado.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const entidades = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decodificar = (texto) => texto.replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => entidades[m] ?? m);
const limpar = (texto) => decodificar(texto).replace(/\s+/g, ' ').trim();

function lerBloco(css, seletor) {
  const inicio = css.indexOf(seletor);
  if (inicio < 0) return {};
  const abre = css.indexOf('{', inicio);
  const fecha = css.indexOf('}', abre);
  const tokens = {};
  for (const par of css.slice(abre + 1, fecha).split(';')) {
    const i = par.indexOf(':');
    if (i > 0 && par.trim().startsWith('--')) tokens[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }
  return tokens;
}

export function extrairTokens(html) {
  const estilos = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  return { claro: lerBloco(estilos, ':root{'), escuro: lerBloco(estilos, '[data-theme="escuro"]{') };
}

// Textos que aparecem na tela sem depender de dados: texto entre tags, placeholder, aria-label e title, na ordem do documento.
export function textosEstaticos(fragmento) {
  const html = fragmento.replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  const saida = [];
  const adiciona = (bruto) => {
    const texto = limpar(bruto);
    if (texto.length >= 2 && /\p{L}/u.test(texto) && !texto.includes('{{') && !saida.includes(texto)) saida.push(texto);
  };
  const tag = /<[^>]*>/g;
  let ultimo = 0;
  for (const m of html.matchAll(tag)) {
    adiciona(html.slice(ultimo, m.index));
    for (const a of m[0].matchAll(/\s(?:placeholder|aria-label|title)="([^"]*)"/g)) adiciona(a[1]);
    ultimo = m.index + m[0].length;
  }
  adiciona(html.slice(ultimo));
  return saida;
}

const MARCADOR = /<sc-if value="\{\{ (s[A-Z]\w*|d[A-Z]\w*) \}\}"/g;

export function extrairTelas(html) {
  const marcas = [...html.matchAll(MARCADOR)].map((m) => ({ chave: m[1], indice: m.index }));
  const telas = {};
  marcas.forEach((marca, i) => {
    if (marca.chave === 'dOn' || marca.chave in telas) return;
    const fim = i + 1 < marcas.length ? marcas[i + 1].indice : html.length;
    telas[marca.chave] = textosEstaticos(html.slice(marca.indice, fim));
  });
  return telas;
}

export function extrairEstados(html) {
  const rodada = /<a class="dv-tid"[^>]*>([^<]*)<\/a>/.exec(html)?.[1] ?? '';
  const titulo = limpar(/<span class="dv-tname">([^<]*)<\/span>/.exec(html)?.[1] ?? '');
  const quadros = [];
  for (const pedaco of html.split('<div class="dv-opt" id="').slice(1)) {
    const id = pedaco.slice(0, pedaco.indexOf('"'));
    const rotulo = /<div class="dv-olabel"[\s\S]*?<span>([\s\S]*?)<\/span><\/div>/.exec(pedaco)?.[1] ?? '';
    const negrito = /<b[^>]*>([\s\S]*?)<\/b>/.exec(rotulo)?.[1] ?? '';
    const texto = rotulo.replace(/<b[^>]*>[\s\S]*?<\/b>/, '').replace(/<[^>]+>/g, '');
    const inicio = /<dc-import[^>]*\sstart="([^"]*)"/.exec(pedaco)?.[1] ?? '';
    quadros.push({ id, titulo: limpar(negrito), texto: limpar(texto), inicio });
  }
  return { rodada, titulo, quadros };
}

export const ARQUIVOS = {
  desktop: 'docs/suite-desktop/prototipo-orcamentos/DesktopOrc.dc.html',
  rodadas: [
    'docs/suite-mobile/prototipo/Rodada21.dc.html',
    'docs/suite-mobile/prototipo/Rodada22.dc.html',
    'docs/suite-desktop/prototipo-orcamentos/Rodada23.dc.html',
    'docs/suite-desktop/prototipo-orcamentos/Rodada24.dc.html',
  ],
};

export function gerarReferencia(raiz) {
  const ler = (arquivo) => readFileSync(path.join(raiz, arquivo), 'utf8');
  const desktop = ler(ARQUIVOS.desktop);
  return {
    gerado: 'por scripts/conferencia/referencia.mjs; nao edite a mao',
    desktop: { arquivo: ARQUIVOS.desktop, tokens: extrairTokens(desktop), telas: extrairTelas(desktop) },
    rodadas: ARQUIVOS.rodadas.map((arquivo) => ({ arquivo, ...extrairEstados(ler(arquivo)) })),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const saida = path.join(raiz, 'docs', 'suite-telas-final', 'conferencia', 'referencia.json');
  const ref = gerarReferencia(raiz);
  writeFileSync(saida, `${JSON.stringify(ref, null, 2)}\n`);
  console.log(`Referência gravada em ${path.relative(raiz, saida)}: ${Object.keys(ref.desktop.telas).length} telas, ${ref.rodadas.reduce((n, r) => n + r.quadros.length, 0)} quadros.`);
}
