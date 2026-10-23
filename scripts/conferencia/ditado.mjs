// Captura o painel do assistente com o ditado ao vivo (estado "ouvindo" com o texto parcial e o texto final), no computador
// (1280x720) e no celular (/m/, 375x812), nos temas claro e escuro. Mesmo roteiro do Centro de Custos.
// Sem microfone nem Firebase reais: o microfone e um tom gerado pelo navegador e o SDK do Firebase e trocado por um de
// mentira (Fetch do DevTools) cuja Live API devolve a transcricao palavra por palavra. Banco temporario e "Centro" falso locais.
//   node scripts/conferencia/ditado.mjs [pasta-de-saida]      portas: CONF_PORTA_BASE (padrao 3171) a +3
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from './cdp.mjs';
import { subirAmbiente, raiz } from './ambiente.mjs';

const saida = path.resolve(process.argv[2] || path.join(raiz, '..', 'imp-orc-capturas'));
const base = Number(process.env.CONF_PORTA_BASE || 3171);
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const FRASE = 'preciso saber quais propostas estão em negociação e quanto já foi aprovado neste mês para a Palmeiras';

const APP_FALSO = 'export const getApps=()=>[{}];export const initializeApp=()=>({});export const initializeAppCheck=()=>({});export class ReCaptchaV3Provider{}';
const AI_FALSO = `export const getAI=()=>({});export class GoogleAIBackend{}
export const Schema=new Proxy({},{get:()=>()=>({})});export const ResponseModality={AUDIO:'AUDIO'};
export const getGenerativeModel=()=>({startChat:()=>({}),generateContent:async()=>({response:{text:()=>'texto por trechos'}})});
export const getLiveGenerativeModel=()=>({connect:async()=>{
  const fila=[];let acordar=null,fechada=false,n=0,timer=0;const palavras=${JSON.stringify(FRASE.split(' '))};
  const empurrar=(m)=>{fila.push(m);if(acordar){acordar();acordar=null;}};
  return{async sendAudioRealtime(){if(!timer)timer=setInterval(()=>{if(n<palavras.length)empurrar({type:'serverContent',inputTranscription:{text:(n?' ':'')+palavras[n++]}});},420);},
    async*receive(){while(!fechada){if(!fila.length)await new Promise((r)=>{acordar=r;});while(fila.length)yield fila.shift();}},
    async close(){fechada=true;clearInterval(timer);if(acordar)acordar();}};}});`;
const MIC_FALSO = `if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{const c=new AudioContext();const o=c.createOscillator();const g=c.createGain();g.gain.value=.3;
const d=c.createMediaStreamDestination();o.frequency.value=220;o.connect(g);g.connect(d);o.start();return d.stream;};`;

const PLATAFORMAS = {
  desktop: {
    largura: 1280, altura: 720, tema: 'orc_d_tema', url: '/',
    pronto: "!!document.querySelector('.side') && !document.querySelector('.auth-gate, [data-loading]')",
    abrir: "document.getElementById('btn-assistente').click()",
    campo: '.assistant-input textarea', mic: '.assistant-mic', nota: '.assistant-voz', fraco: 'ia-parcial',
  },
  m: {
    largura: 375, altura: 812, tema: 'orc_m_tema', url: '/m/',
    pronto: '!!(window.OC && OC.nav > 0)',
    abrir: 'OC.ia.open()',
    campo: '#ia-q', mic: '#ia-mic', nota: '#ia-voz', fraco: 'ia-parcial',
  },
};

async function ate(aba, expressao, ms) {
  for (let i = 0; i < ms / 150; i += 1) { if (await aba.avaliar(expressao).catch(() => false)) return true; await esperar(150); }
  return false;
}

async function main() {
  mkdirSync(saida, { recursive: true });
  const ambiente = await subirAmbiente({ portaApi: base, portaCentro: base + 1, portaSite: base + 2, log: (m) => console.log(`[ditado] ${m}`) });
  const navegador = await abrirNavegador({ porta: base + 3, extra: ['--autoplay-policy=no-user-gesture-required'] });
  let status = 0;
  try {
    const aba = await navegador.novaAba();
    await aba.cmd('Network.setBypassServiceWorker', { bypass: true }); // o service worker do site pediria o SDK por fora desta aba
    await aba.cmd('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    aba.aoEvento((m) => {
      if (m.method !== 'Fetch.requestPaused') return;
      if (!m.params.request.url.includes('gstatic.com/firebasejs/')) { aba.cmd('Fetch.continueRequest', { requestId: m.params.requestId }).catch(() => undefined); return; }
      const corpo = /firebase-ai\.js/.test(m.params.request.url) ? AI_FALSO : APP_FALSO;
      aba.cmd('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/javascript' }, { name: 'access-control-allow-origin', value: '*' }],
        body: Buffer.from(corpo).toString('base64') }).catch(() => undefined);
    });
    await aba.antesDoCarregamento(MIC_FALSO);
    for (const [nome, p] of Object.entries(PLATAFORMAS)) {
      for (const tema of ['claro', 'escuro']) {
        await aba.viewport(p.largura, p.altura, nome === 'm');
        await aba.antesDoCarregamento(`try { localStorage.setItem('construtec.auth.session', ${JSON.stringify(ambiente.token)}); localStorage.setItem('${p.tema}', '${tema}'); sessionStorage.setItem('construtec.auth.centro', '1'); sessionStorage.setItem('orc_versao', 'completa'); } catch (e) {}`);
        await aba.ir('about:blank');
        await aba.ir(`${ambiente.base}${p.url}`);
        if (!(await ate(aba, p.pronto, 15000))) { console.log(`${nome} ${tema}: a tela inicial nao carregou`); status = 1; continue; }
        await esperar(900);
        await aba.avaliar(`${p.abrir}; 0`);
        if (!(await ate(aba, `!!document.querySelector('${p.mic}')`, 8000))) { console.log(`${nome} ${tema}: sem botao de microfone`); status = 1; continue; }
        // Texto que a pessoa ja tinha digitado: tem que ser preservado.
        await aba.avaliar(`(() => { const q = document.querySelector('${p.campo}'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(q, 'Quero saber:'); q.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await esperar(200);
        await aba.avaliar(`document.querySelector('${p.mic}').click()`);
        const chegou = await ate(aba, `document.querySelector('${p.campo}').value.includes('negociação')`, 15000);
        const parcial = await aba.avaliar(`({ valor: document.querySelector('${p.campo}').value, fraco: document.querySelector('${p.campo}').classList.contains('${p.fraco}'), travado: document.querySelector('${p.campo}').readOnly, nota: document.querySelector('${p.nota}').textContent, rolagemH: document.documentElement.scrollWidth > innerWidth + 1 })`);
        await aba.foto(path.join(saida, `${nome === 'm' ? 'm' : 'd'}-${tema}-ouvindo.png`));
        await aba.avaliar(`document.querySelector('${p.mic}').click()`);
        const final = await ate(aba, `!document.querySelector('${p.campo}').classList.contains('${p.fraco}') && document.querySelector('${p.nota}').hidden`, 10000);
        await esperar(300);
        await aba.foto(path.join(saida, `${nome === 'm' ? 'm' : 'd'}-${tema}-final.png`));
        const valorFinal = await aba.avaliar(`document.querySelector('${p.campo}').value`);
        console.log(`${nome} ${tema}: parcial ${chegou ? 'ok' : 'FALHOU'} (${JSON.stringify(parcial)}); final ${final ? 'ok' : 'FALHOU'}: ${valorFinal}`);
        if (!chegou || !final || !parcial.fraco || !parcial.travado || !valorFinal.startsWith('Quero saber:')) status = 1;
      }
    }
    const erros = aba.registros.filter((r) => !/favicon|manifest\.webmanifest|gstatic|ERR_NAME_NOT_RESOLVED/.test(r.texto));
    if (erros.length) { console.log('Erros na pagina:', erros.slice(0, 6)); status = 1; }
    await aba.fechar();
  } finally {
    navegador.fechar();
    await ambiente.fechar();
  }
  console.log(`Capturas em ${saida}`);
  process.exit(status);
}
main().catch((e) => { console.error(e); process.exit(1); });
