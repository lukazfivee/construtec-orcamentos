import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight, Building2, Check, RotateCw, CircleAlert, Eye, EyeOff, FileText, History, KeyRound, LoaderCircle, LockKeyhole, LogOut, Mail, MailOpen, Moon, Send, ShieldCheck, Sun, WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { version as appVersion } from '../../package.json';
import { getCentroCustosUrl, isCloudRuntime } from './api';
import { openExternalUrl } from './proposalPdfActions';
import { useTheme } from './theme';

const brandLogoDark = new URL('../assets/logo-branca.png', import.meta.url).href;

// Avisos fixos da tela de entrar, os mesmos do Centro (public/d/login.js): sessao terminada, saiu e sem internet.
export type LoginNotice = 'exp' | 'sair' | '';
type Tone = 'ok' | 'warn' | 'bad' | 'info';
type Aviso = { tone: Tone; icon: LucideIcon; title: string; text: string };
const AVISOS: Record<Exclude<LoginNotice, ''> | 'off', Aviso> = {
  exp: { tone: 'info', icon: History, title: 'Sua sessão terminou', text: 'Entre de novo: nada do que você salvou se perdeu.' },
  sair: { tone: 'ok', icon: LogOut, title: 'Você saiu do Orçamentos', text: 'Para entrar de novo, use o mesmo e-mail e senha.' },
  off: { tone: 'warn', icon: WifiOff, title: 'Sem internet', text: 'O Orçamentos no computador precisa de conexão para entrar, porque a conta é validada pelo Centro de Custos.' },
};
const CARDS: Array<[LucideIcon, string, string]> = [
  [FileText, 'Propostas com revisão', 'Itens do catálogo, mão de obra e BDI, com o histórico de cada revisão.'],
  [Send, 'PDF e link para o cliente', 'O mesmo documento no computador e no celular, com aprovação pelo link.'],
  [Building2, 'Direto para a obra', 'A proposta aprovada vira o orçado da obra no Centro de Custos.'],
];

type Props = {
  email: string;
  onEmailChange: (value: string) => void;
  rememberMe: boolean;
  onRememberChange: (value: boolean) => void;
  /** Lógica de entrar do Orçamentos (AuthGate): devolve a mensagem de erro, ou '' quando entrou. */
  onSubmit: (password: string) => Promise<string>;
  notice: LoginNotice;
  /** Erro vindo de fora (entrada pelo aplicativo que falhou). */
  initialError?: string;
  /** App Suite Construtec: a entrada e do app (suite://entrar), sem formulario. */
  inApp?: boolean;
};

// Tela de entrar do computador igual a do Centro (Desktop novo /d/, login.js + login.css): marca a esquerda, formulario a direita.
export function LoginScreen({ email, onEmailChange, rememberMe, onRememberChange, onSubmit, notice, initialError = '', inApp = false }: Props) {
  const theme = useTheme();
  const escuro = theme.resolved === 'escuro';
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [aviso, setAviso] = useState<Aviso | null>(() => (initialError ? { tone: 'bad', icon: CircleAlert, title: 'Não foi possível entrar', text: initialError } : notice ? AVISOS[notice] : null));
  const [bad, setBad] = useState({ email: false, password: false });
  const [shake, setShake] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const seguro = typeof location !== 'undefined' && (location.protocol === 'https:' || /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname) || !isCloudRuntime());

  useEffect(() => { document.title = 'Entrar · Orçamentos'; }, []);
  useEffect(() => { (email ? passwordRef : emailRef).current?.focus(); }, []);
  useEffect(() => {
    const online = () => { setOffline(false); setAviso((current) => (current === AVISOS.off ? null : current)); };
    const off = () => { setOffline(true); setAviso(AVISOS.off); };
    if (offline) setAviso(AVISOS.off);
    window.addEventListener('online', online);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', off); };
  }, []);

  const tremer = () => { setShake(false); window.requestAnimationFrame(() => setShake(true)); window.setTimeout(() => setShake(false), 450); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const value = email.trim();
    if (!value || !password) {
      setAviso({ tone: 'bad', icon: CircleAlert, title: 'Falta preencher', text: !value && !password ? 'Digite o e-mail e a senha.' : !value ? 'Digite o e-mail.' : 'Digite a senha.' });
      setBad({ email: !value, password: !password });
      tremer();
      (value ? passwordRef : emailRef).current?.focus();
      return;
    }
    if (navigator.onLine === false) { setOffline(true); setAviso(AVISOS.off); return; }
    setPending(true);
    setAviso(null);
    setBad({ email: false, password: false });
    const problem = await onSubmit(password);
    setPending(false);
    if (!problem) return;
    setPassword('');
    if (/failed to fetch|network|load failed|conex/i.test(problem)) { setOffline(true); setAviso(AVISOS.off); return; }
    if (/bloque|muitas tentativas/i.test(problem)) {
      setAviso({ tone: 'bad', icon: LockKeyhole, title: 'Acesso bloqueado por alguns minutos', text: problem });
      setBad({ email: false, password: true });
      return;
    }
    if (/senha|credenc|inv[aá]lid|n[aã]o confere/i.test(problem)) {
      setAviso({ tone: 'bad', icon: CircleAlert, title: 'E-mail ou senha não conferem', text: `Confira e tente de novo. ${problem}`.trim() });
      setBad({ email: false, password: true });
      tremer();
      passwordRef.current?.focus();
      return;
    }
    setAviso({ tone: 'warn', icon: CircleAlert, title: 'Não foi possível entrar', text: problem });
  };
  const esqueci = () => { void getCentroCustosUrl().then((url) => openExternalUrl(`${url.replace(/\/$/, '')}/d/`)); };
  const clear = (field: 'email' | 'password') => {
    setBad((current) => ({ ...current, [field]: false }));
    setAviso((current) => (current && (current.tone === 'bad' || current.tone === 'warn') && !offline ? null : current));
  };

  const AvisoIcon = aviso?.icon;
  const version = /^\d+\.\d+/.test(appVersion) ? ` · v${appVersion.split('.').slice(0, 2).join('.')}` : '';

  return (
    <main className="lg" aria-label="Entrar no Orçamentos">
      <section className="lg-marca" aria-label="Orçamentos Construtec">
        <div className="lg-fundo" aria-hidden="true"><span className="b1" /><span className="b2" /><span className="b3" /><span className="pontos" /></div>
        <div className="lg-topo"><img src={brandLogoDark} alt="Construtec" /><span className="lg-chip">Orçamentos</span></div>
        <div className="lg-meio">
          <h1>Cada proposta com o preço certo e o histórico na mão.</h1>
          <p>Do catálogo ao PDF aprovado pelo cliente, com o mesmo login do Centro de Custos.</p>
          <div className="lg-cards">
            {CARDS.map(([Icon, title, text]) => (
              <div className="lg-card" key={title}><span className="lg-card-ic"><Icon size={21} strokeWidth={1.75} /></span><span><b>{title}</b>{text}</span></div>
            ))}
          </div>
        </div>
        <div className="lg-rodape">
          <span>{seguro && <><ShieldCheck size={16} strokeWidth={1.75} />Conexão segura · </>}Construtec Engenharia</span>
          <span>Suíte Construtec{version}</span>
        </div>
      </section>

      <section className="lg-lado">
        <div className="lg-tema">
          <button type="button" className="lg-btn g" onClick={theme.toggle}>
            {escuro ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}{escuro ? 'Tema claro' : 'Tema escuro'}
          </button>
        </div>
        <div className="lg-rolar">
          <div className="lg-caixa">
            {inApp ? (
              <div className="lg-vista">
                <div className="lg-titulo"><h2>Entrar</h2><p>Sua sessão terminou. Entre de novo no aplicativo para continuar.</p></div>
                {aviso && AvisoIcon && <div className={`lg-aviso ${aviso.tone}`} role="alert"><AvisoIcon size={20} strokeWidth={1.75} /><span><b>{aviso.title}</b>{aviso.text}</span></div>}
                <a className="lg-btn p lg-ir" href="suite://entrar"><KeyRound size={18} strokeWidth={1.75} /><span>Entrar pelo aplicativo</span></a>
              </div>
            ) : (
              <form className="lg-vista" noValidate onSubmit={(event) => void submit(event)}>
                <div className="lg-titulo"><h2>Entrar</h2><p>Use o e-mail da Construtec. A mesma conta vale para o Centro de Custos.</p></div>
                {aviso && AvisoIcon && <div className={`lg-aviso ${aviso.tone}`} role="alert"><AvisoIcon size={20} strokeWidth={1.75} /><span><b>{aviso.title}</b>{aviso.text}</span></div>}
                <div className={`lg-campos${shake ? ' tremer' : ''}`}>
                  <label className="lg-fld">
                    <span>E-mail</span>
                    <span className="lg-inp">
                      <Mail size={18} strokeWidth={1.75} />
                      <input ref={emailRef} className={bad.email ? 'ruim' : ''} type="email" name="email" maxLength={254} autoComplete="username" autoCapitalize="off" spellCheck={false}
                        placeholder="nome@rcconstrutec.com.br" value={email} disabled={pending} onChange={(event) => { onEmailChange(event.target.value); clear('email'); }} />
                    </span>
                  </label>
                  <label className="lg-fld">
                    <span>Senha</span>
                    <span className="lg-inp">
                      <LockKeyhole size={18} strokeWidth={1.75} />
                      <input ref={passwordRef} className={`com-olho${bad.password ? ' ruim' : ''}`} type={showPassword ? 'text' : 'password'} name="senha" maxLength={128} autoComplete="current-password"
                        placeholder="Sua senha" value={password} disabled={pending} onChange={(event) => { setPassword(event.target.value); clear('password'); }} />
                      <button type="button" className="lg-olho" aria-label={showPassword ? 'Esconder a senha' : 'Mostrar a senha'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
                        {showPassword ? <EyeOff size={19} strokeWidth={1.75} /> : <Eye size={19} strokeWidth={1.75} />}
                      </button>
                    </span>
                  </label>
                </div>
                <div className="lg-linha">
                  <label className="lg-manter">
                    <input type="checkbox" name="manter" checked={rememberMe} onChange={(event) => onRememberChange(event.target.checked)} />
                    <span className="marca-caixa" aria-hidden="true"><Check size={13} strokeWidth={2.5} /></span>Manter conectado neste computador
                  </label>
                  <button type="button" className="lg-btn g" onClick={esqueci} title="Abre a tela de entrar do Centro de Custos, que cria a senha nova para os dois apps">Esqueci a senha</button>
                </div>
                <button type="submit" className={`lg-btn p lg-ir${pending ? ' ocupado' : ''}`}>
                  {pending ? <LoaderCircle size={18} strokeWidth={1.75} /> : offline ? <RotateCw size={18} strokeWidth={1.75} /> : <ArrowRight size={18} strokeWidth={1.75} />}
                  <span>{pending ? 'Entrando…' : offline ? 'Tentar de novo' : 'Entrar'}</span>
                </button>
                <div className="lg-primeiro"><MailOpen size={18} strokeWidth={1.75} /><span><b>Primeiro acesso?</b> Abra o convite que chegou no seu e-mail. Sem convite, peça a um administrador do Centro de Custos.</span></div>
              </form>
            )}
          </div>
        </div>
        <div className="lg-ajuda"><span>Precisa de ajuda? Fale com um administrador do Centro de Custos.</span></div>
      </section>
    </main>
  );
}
