// Ditado do assistente (ia-chat.js): liga o campo do chat ao modulo ditado-ao-vivo.js (captura + transcricao ao vivo).
// O texto parcial aparece no campo enquanto a pessoa fala (cor mais fraca); ao parar fica o texto final para conferir.
// Mesma ligacao do ditado do Centro de Custos (public/m/ia-voz.js no repositorio do Centro).
(function (OC) {
  const { icon } = OC;
  const IA = OC.ia = OC.ia || {};
  IA.criarVoz = function ({ state, sdk, paint, quota, busy, friendly }) {
    const voz = { state: 'idle', base: '', motor: null, aviso: '' };
    const D = () => window.DitadoAoVivo;
    const offline = () => navigator.onLine === false;
    function motor() {
      if (!voz.motor) voz.motor = D().criar({ sdk, modeloLive: OC.iaConfig.modeloLive, modelosTexto: OC.iaConfig.modelos, limiteMs: 120000,
        recuperavel: (e) => quota(e) || busy(e), offline, amigavel: friendly });
      return voz.motor;
    }
    const vozSuportada = () => Boolean(D() && motor().suportado());

    function campo(texto, parcial) {
      const q = OC.$('#ia-q');
      if (!q) return;
      q.value = `${voz.base}${voz.base && texto ? ' ' : ''}${texto}`.slice(0, 1500);
      q.classList.toggle('ia-parcial', Boolean(parcial));
      q.readOnly = Boolean(parcial);
      q.dispatchEvent(new Event('input'));
      q.scrollTop = q.scrollHeight;
    }
    function vozPaint() {
      const b = OC.$('#ia-mic');
      if (!b) return;
      const gravando = voz.state === 'rec', trabalhando = voz.state === 'work';
      b.classList.toggle('rec', gravando);
      b.disabled = trabalhando || (state.busy && !gravando);
      b.setAttribute('aria-pressed', gravando ? 'true' : 'false');
      b.setAttribute('aria-label', gravando ? 'Parar o ditado' : trabalhando ? 'Finalizando o ditado' : 'Ditar mensagem');
      b.innerHTML = trabalhando ? '<span class="ia-dots"><i></i><i></i><i></i></span>' : icon(gravando ? 'stop-fill' : 'microphone', 20);
      const note = OC.$('#ia-voz');
      if (note) { note.hidden = voz.state === 'idle'; note.textContent = gravando ? (voz.aviso || 'Ouvindo… o texto aparece enquanto você fala. Use o quadrado para parar.') : trabalhando ? 'Finalizando…' : ''; }
    }
    function vozErro(texto) { state.log.push({ who: 'erro', text: texto }); paint(); }
    function livre() { voz.state = 'idle'; const q = OC.$('#ia-q'); if (q) { q.classList.remove('ia-parcial'); q.readOnly = false; } vozPaint(); }

    function vozIniciar() {
      if (offline()) return vozErro('O ditado precisa de internet.');
      const q = OC.$('#ia-q');
      voz.base = q ? q.value.trim() : ''; voz.aviso = '';
      voz.state = 'rec'; vozPaint();
      motor().iniciar({
        onParcial: (t) => campo(t, true),
        onFinal: (t) => { if (t) campo(t, false); const e = OC.$('#ia-q'); if (e) e.focus(); },
        onErro: (m) => { campo('', false); livre(); vozErro(m); },
        onAviso: (m) => { voz.aviso = `Ouvindo… ${m}`; vozPaint(); },
        onEstado: (x) => { voz.state = x === 'ouvindo' ? 'rec' : x === 'finalizando' ? 'work' : 'idle'; if (x === 'livre') livre(); else vozPaint(); },
      });
    }
    // Fechar a folha com o microfone aberto descarta o ditado (o texto digitado antes continua no campo ate a folha sumir).
    function vozCancelar() { if (voz.motor) voz.motor.cancelar(); voz.state = 'idle'; }
    const toggle = () => (voz.state === 'rec' ? motor().parar() : voz.state === 'idle' ? vozIniciar() : undefined);
    return { suportada: vozSuportada, toggle, cancelar: vozCancelar, ocupado: () => voz.state !== 'idle' };
  };
})(window.OC = window.OC || {});
