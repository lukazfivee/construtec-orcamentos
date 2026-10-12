// Kit de conferencia do Orcamentos (ticket O1): um comando captura cada tela do Desktop novo (1440x900 e 1280x800) e do Celular
// (375 de largura), nos temas claro e escuro, mede o que costuma dar defeito e compara com a Referencia.
//   npm run conferencia                      tudo
//   npm run conferencia -- --plataforma celular --tela pdf --temas claro
// Saida: docs/suite-telas-final/conferencia/divergencias.md e .json (versionados) e prints/ (ignorado pelo git).
// Dados: banco temporario e "Centro" falso locais (servidor.ts); nada de conta real, AppData, Neon ou Cloudflare.
// Portas: CONF_PORTA_BASE (padrao 3131) a +3: API, Centro falso, site e DevTools.
import { mkdirSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { AJUDANTES } from './acoes.mjs';
import { abrirNavegador } from './cdp.mjs';
import { subirAmbiente, raiz } from './ambiente.mjs';
import { compararTokens, formatarLista, textosAusentes } from './divergencias.mjs';
import { medir } from './medidas.mjs';
import { gerarReferencia } from './referencia.mjs';
import { TELAS_CELULAR, TELAS_DESKTOP, TEMAS, VIEWPORTS_CELULAR, VIEWPORTS_DESKTOP } from './telas.mjs';

const args = process.argv.slice(2);
const opcao = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : padrao; };
const plataformas = opcao('plataforma', 'todas') === 'todas' ? ['desktop', 'celular'] : [opcao('plataforma')];
const filtroTela = opcao('tela', '');
const temas = opcao('temas', TEMAS.join(',')).split(',');
const base = Number(process.env.CONF_PORTA_BASE || 3131);
const pastaSaida = path.resolve(raiz, opcao('saida', 'docs/suite-telas-final/conferencia'));
const pastaPrints = path.join(pastaSaida, 'prints');
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (m) => console.log(`[conferencia] ${m}`);

// Tokens que a Referencia define e que o app tambem expoe com o mesmo nome (desktop) ou nome equivalente (celular).
const MAPA_CELULAR = { '--color-bg': '--bg', '--color-surface': '--surface', '--color-text': '--text', '--color-divider': '--divider', '--color-neutral-300': '--n300', '--color-neutral-500': '--n500', '--color-neutral-600': '--n600', '--color-neutral-800': '--n800', '--color-accent': '--accent', '--color-accent-300': '--accent-300', '--color-accent-600': '--accent-600', '--color-accent-700': '--accent-700', '--color-accent-900': '--accent-900', '--c-warn': '--warn', '--c-warn-bar': '--warn-bar', '--c-warn-soft': '--warn-soft' };

const referencia = existsSync(path.join(pastaSaida, 'referencia.json')) && !args.includes('--regerar-referencia')
  ? JSON.parse(readFileSync(path.join(pastaSaida, 'referencia.json'), 'utf8'))
  : gerarReferencia(raiz);

const quadrosDe = (chaves) => chaves.flatMap((chave) => {
  const [rodada, inicio] = chave.split(':');
  const r = referencia.rodadas.find((x) => x.rodada === rodada);
  return r ? r.quadros.filter((q) => q.inicio === inicio).map((q) => `${q.id} ${q.titulo.replace(/\.$/, '')}`) : [];
});

async function esperarPronto(aba, plataforma) {
  const teste = plataforma === 'desktop'
    ? `!!document.querySelector('.side') && !document.querySelector('.auth-gate, [data-loading]')`
    : `!!(window.OC && OC.nav > 0)`;
  for (let i = 0; i < 60; i += 1) { if (await aba.avaliar(teste).catch(() => false)) return true; await esperar(250); }
  return false;
}

async function capturarTela({ aba, plataforma, viewport, tema, tela, ambiente }) {
  const [largura, altura] = viewport.split('x').map(Number);
  const arquivo = path.join(pastaPrints, plataforma, viewport, tema, `${tela.id}.png`);
  mkdirSync(path.dirname(arquivo), { recursive: true });
  const antes = aba.registros.length;
  const falhas = [];
  await aba.ir(plataforma === 'desktop' ? `${ambiente.base}/` : `${ambiente.base}/m/`);
  if (!(await esperarPronto(aba, plataforma))) falhas.push('a tela inicial não carregou em 15 s');
  await esperar(plataforma === 'desktop' ? 1200 : 600);
  for (const passo of tela.passos) {
    if (falhas.length) break;
    let ok = true;
    if (passo.clicar) ok = await aba.avaliar(`window.__conf.clicar(${JSON.stringify(passo.clicar)}, ${JSON.stringify(passo.em || 'body')}, ${passo.n || 0})`);
    else if (passo.linha) ok = await aba.avaliar(`window.__conf.linha(${JSON.stringify(passo.linha)}, ${JSON.stringify(passo.botao || '')})`);
    else if (passo.js) { try { await aba.avaliar(passo.js, { aguardar: false }); } catch (erro) { ok = false; falhas.push(`erro no passo: ${String(erro.message).slice(0, 120)}`); } }
    if (!ok && !passo.js) falhas.push(`controle não encontrado: ${passo.clicar || passo.linha}`);
    await esperar(passo.espera || 900);
  }
  let medidas = null;
  if (!falhas.length) {
    await aba.foto(arquivo);
    const tokens = Object.keys(referencia.desktop.tokens.claro);
    medidas = await aba.avaliar(`(${medir})(${JSON.stringify({ escopo: plataforma === 'desktop' ? 'body' : '#view', respiroMinimo: 8, tokens: [...tokens, ...Object.values(MAPA_CELULAR)] })})`);
    if (plataforma === 'celular' && medidas.alturaPagina > altura + 4) await aba.foto(arquivo.replace(/\.png$/, '-completa.png'), { completa: true });
  }
  const erros = aba.registros.slice(antes).filter((r) => !/favicon|manifest\.webmanifest/.test(r.texto));
  return { tela, plataforma, viewport, tema, largura, altura, falhas, medidas, erros, arquivo: path.relative(pastaSaida, arquivo).replace(/\\/g, '/') };
}

async function principal() {
  rmSync(pastaPrints, { recursive: true, force: true });
  log('subindo o ambiente de teste');
  const ambiente = await subirAmbiente({ portaApi: base, portaCentro: base + 1, portaSite: base + 2, log });
  const navegador = await abrirNavegador({ porta: base + 3 });
  const capturas = [];
  try {
    for (const plataforma of plataformas) {
      const telas = (plataforma === 'desktop' ? TELAS_DESKTOP : TELAS_CELULAR)(ambiente.dados).filter((t) => !filtroTela || t.id === filtroTela);
      const viewports = (opcao('viewports', '') || (plataforma === 'desktop' ? VIEWPORTS_DESKTOP : VIEWPORTS_CELULAR).join(',')).split(',');
      for (const viewport of viewports) for (const tema of temas) {
        log(`${plataforma} ${viewport} ${tema}: ${telas.length} telas`);
        const aba = await navegador.novaAba();
        const [w, h] = viewport.split('x').map(Number);
        await aba.viewport(w, h, plataforma === 'celular');
        await aba.antesDoCarregamento(`${AJUDANTES}
          try { localStorage.setItem('construtec.auth.session', ${JSON.stringify(ambiente.token)}); localStorage.setItem(${JSON.stringify(plataforma === 'desktop' ? 'orc_d_tema' : 'orc_m_tema')}, ${JSON.stringify(tema)}); sessionStorage.setItem('construtec.auth.centro', '1'); sessionStorage.setItem('orc_versao', 'completa'); } catch (e) {}`);
        for (const tela of telas) capturas.push(await capturarTela({ aba, plataforma, viewport, tema, tela, ambiente }));
        await aba.fechar();
      }
    }
  } finally {
    navegador.fechar();
    await ambiente.fechar();
  }
  return capturas;
}

function analisar(capturas) {
  const resultados = [];
  const uniaoTextos = new Map(); // desktop: texto visivel somado por tela da Referencia, resolucao e tema
  for (const c of capturas.filter((x) => x.plataforma === 'desktop' && x.medidas && x.tela.ref)) {
    const chave = `${c.tela.ref}|${c.viewport}|${c.tema}`;
    uniaoTextos.set(chave, `${uniaoTextos.get(chave) || ''}\n${c.medidas.texto}`);
  }
  const jaComentadas = new Set();
  const tokensVistos = new Set();
  for (const c of capturas) {
    const itens = [];
    for (const f of c.falhas) itens.push({ tipo: 'kit', descricao: `não foi possível capturar: ${f}` });
    if (c.medidas) {
      for (const p of c.medidas.problemas) itens.push(p);
      for (const e of c.erros) itens.push({ tipo: 'console', descricao: `${e.tipo}: ${e.texto.slice(0, 140)}` });
      // Tokens de cor valem para o app inteiro: comparados uma vez por plataforma e tema, nao por tela.
      if (!tokensVistos.has(`${c.plataforma}|${c.tema}`)) {
        tokensVistos.add(`${c.plataforma}|${c.tema}`);
        const tokensRef = referencia.desktop.tokens[c.tema];
        const pares = Object.entries(c.plataforma === 'desktop' ? Object.fromEntries(Object.keys(tokensRef).map((t) => [t, t])) : MAPA_CELULAR).filter(([ref]) => tokensRef[ref]);
        const diferencas = compararTokens(Object.fromEntries(pares.map(([ref]) => [ref, tokensRef[ref]])), Object.fromEntries(pares.map(([ref, local]) => [ref, c.medidas.tokens[local]])));
        resultados.push({
          tela: 'Tokens de cor', referencia: 'DesktopOrc.dc.html (:root e [data-theme="escuro"])', resolucao: c.plataforma === 'desktop' ? 'desktop' : 'celular', tema: c.tema, c: { arquivo: '' },
          itens: diferencas.map((d) => ({ tipo: 'cor', descricao: `${c.plataforma === 'desktop' ? d.token : `${MAPA_CELULAR[d.token]} (${d.token})`} é ${d.real}, a Referência pede ${d.referencia}` })),
        });
      }
      if (c.plataforma === 'desktop') {
        if (c.tela.ref && !jaComentadas.has(`${c.tela.ref}|${c.viewport}|${c.tema}`)) {
          jaComentadas.add(`${c.tela.ref}|${c.viewport}|${c.tema}`);
          const ausentes = textosAusentes(referencia.desktop.telas[c.tela.ref] || [], uniaoTextos.get(`${c.tela.ref}|${c.viewport}|${c.tema}`) || '');
          const total = (referencia.desktop.telas[c.tela.ref] || []).length;
          for (const texto of ausentes) itens.push({ tipo: 'texto', descricao: `texto da Referência (${c.tela.ref}) que não aparece em nenhum estado capturado: "${texto}"` });
          if (total && ausentes.length) itens.push({ tipo: 'texto-resumo', descricao: `${ausentes.length} de ${total} textos fixos de ${c.tela.ref} ausentes` });
        }
      }
    }
    const quadros = quadrosDe(c.tela.quadros || []);
    const refTxt = [c.tela.ref, quadros.length ? `quadros ${quadros.join('; ')}` : ''].filter(Boolean).join(' · ');
    resultados.push({ tela: `${c.plataforma === 'desktop' ? 'Desktop novo' : 'Celular'}: ${c.tela.nome}`, referencia: refTxt, resolucao: c.viewport, tema: c.tema, itens, c });
  }
  return resultados;
}

function escreverRelatorios(resultados, capturas) {
  const total = resultados.reduce((n, r) => n + r.itens.length, 0);
  const comProblema = new Set(resultados.filter((r) => r.itens.length).map((r) => r.tela)).size;
  const cabecalho = [
    '# Lista de divergências (kit de conferência do Orçamentos)', '',
    `Gerada por \`npm run conferencia\` em ${new Date().toISOString().slice(0, 10)} (ticket O1, #183). Não edite à mão: rode o comando de novo depois de corrigir.`, '',
    `Telas capturadas: ${new Set(resultados.map((r) => r.tela)).size}. Telas com algum achado: ${comProblema}. Achados no total (por tela, tema e resolução): ${total}.`, '',
    'Como ler: **[cortado]**, **[coberto]**, **[rolagem-aninhada]**, **[rolagem-horizontal]**, **[texto-cortado]** e **[sem-respiro]** são medidas do kit (valem para a regra "sem corte e sem rolagem aninhada"). **[cor]** compara os tokens com os de `DesktopOrc.dc.html`. **[texto]** lista textos fixos da Referência que não aparecem na tela (podem ser só palavras diferentes; confira o quadro citado). **[console]** são erros do navegador. **[kit]** é falha do próprio kit em chegar na tela.', '',
    'Limite: os protótipos `.dc.html` só abrem no canvas do design (faltam `support.js` e `/_blob/`), então a comparação é por tokens, textos e lista de quadros, não por imagem lado a lado. Os quadros citados (ex.: 23c) são os da Rodada indicada em `docs/suite-desktop/prototipo-orcamentos/` e `docs/suite-mobile/prototipo/`. O Celular do Orçamentos só tem Referência para PDF, comparativo, importar e EXSAT (Rodadas 21 e 22); as demais telas do Celular só recebem medidas.', '',
    'Prints em `docs/suite-telas-final/conferencia/prints/` (pasta ignorada pelo git; `prints/index.html` mostra tudo).', '',
  ];
  // Rodada parcial (uma tela ou uma plataforma) nao sobrescreve a lista completa.
  const parcial = filtroTela || plataformas.length < 2 || args.includes('--temas') || args.includes('--viewports') ? '-parcial' : '';
  writeFileSync(path.join(pastaSaida, `divergencias${parcial}.md`), `${cabecalho.join('\n')}\n${formatarLista(resultados)}\n`);
  writeFileSync(path.join(pastaSaida, `divergencias${parcial}.json`), `${JSON.stringify(resultados.map(({ c, ...r }) => ({ ...r, print: c.arquivo })), null, 2)}\n`);

  const porTela = new Map();
  for (const r of resultados) { if (!porTela.has(r.tela)) porTela.set(r.tela, []); porTela.get(r.tela).push(r); }
  const html = ['<!doctype html><meta charset="utf-8"><title>Conferência do Orçamentos</title><style>body{font:14px system-ui;margin:20px;background:#f2f8fa;color:#0b2530}h2{margin:28px 0 6px}.g{display:flex;gap:12px;flex-wrap:wrap}figure{margin:0;background:#fff;padding:8px;border:1px solid #d6e4e9;border-radius:8px;max-width:420px}figure img{max-width:100%;display:block}figcaption{font-size:12px;margin-top:6px}li{font-size:12px}.bad{color:#b8452c}</style><h1>Conferência do Orçamentos</h1>'];
  for (const [tela, grupo] of porTela) {
    html.push(`<h2>${tela}</h2><div class="g">`);
    for (const r of grupo) html.push(`<figure>${r.c.arquivo ? `<a href="${r.c.arquivo}"><img loading="lazy" src="${r.c.arquivo}" alt=""></a>` : ''}<figcaption><b>${r.tema} ${r.resolucao}</b>${r.itens.length ? `<ul class="bad">${r.itens.slice(0, 8).map((i) => `<li>[${i.tipo}] ${i.descricao.replace(/</g, '&lt;')}</li>`).join('')}</ul>` : ' sem achados'}</figcaption></figure>`);
    html.push('</div>');
  }
  writeFileSync(path.join(pastaPrints, 'index.html'), html.join('\n'));
  return { total, comProblema };
}

const capturas = await principal();
const resultados = analisar(capturas);
mkdirSync(pastaPrints, { recursive: true });
const { total, comProblema } = escreverRelatorios(resultados, capturas);
const falhasKit = capturas.filter((c) => c.falhas.length).length;
log(`${capturas.length} capturas, ${total} achados em ${comProblema} telas, ${falhasKit} falhas do kit. Lista: ${path.relative(raiz, path.join(pastaSaida, 'divergencias.md'))}`);
process.exit(falhasKit ? 1 : 0);
