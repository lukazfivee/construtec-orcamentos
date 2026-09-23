import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { AuthUser } from '../shared/contracts';
import { CONSTRUTEC_LOGO_BASE64 } from '../assets/logoBase64';
import { App } from './App';
import { authApi, isCloudRuntime, setAuthSessionToken } from './api';

const SESSION_KEY = 'construtec.auth.session';
const REMEMBERED_EMAIL_KEY = 'construtec.auth.remembered_email';
const REMEMBER_FLAG_KEY = 'construtec.auth.remember_me';
const brandLogo = `data:image/png;base64,${CONSTRUTEC_LOGO_BASE64}`;
const isCloud = isCloudRuntime();
// Login e conta sao do Centro de Custos (identidade compartilhada): nao ha
// mais cadastro de primeiro administrador aqui.
type AuthMode = 'checking' | 'login' | 'ready';

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    return localStorage.getItem(REMEMBER_FLAG_KEY) !== 'false';
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const finishSession = (token: string, nextUser: AuthUser, shouldRemember = rememberMe) => {
    sessionStorage.setItem(SESSION_KEY, token);
    if (shouldRemember) {
      localStorage.setItem(SESSION_KEY, token);
      localStorage.setItem(REMEMBERED_EMAIL_KEY, nextUser.email);
      localStorage.setItem(REMEMBER_FLAG_KEY, 'true');
    } else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      localStorage.setItem(REMEMBER_FLAG_KEY, 'false');
    }
    setAuthSessionToken(token);
    setUser(nextUser);
    setPassword('');
    setError('');
    setMode('ready');
  };

  const clearSession = async (endRemote = false) => {
    if (endRemote) await authApi.logout().catch(() => undefined);
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    setAuthSessionToken(null);
    setUser(null);
    setPassword('');
    setError('');
    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (savedEmail) setEmail(savedEmail);
    setMode('login');
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (savedEmail) setEmail(savedEmail);

      const storedToken = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (storedToken) {
        setAuthSessionToken(storedToken);
        try {
          const result = await authApi.me();
          if (active) {
            const isPersistent = Boolean(localStorage.getItem(SESSION_KEY));
            finishSession(storedToken, result.user, isPersistent);
          }
          return;
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(SESSION_KEY);
          setAuthSessionToken(null);
        }
      }
      if (active) setMode('login');
    };

    const expire = () => { if (active) void clearSession(); };
    window.addEventListener('construtec:session-expired', expire);
    void initialize();
    return () => {
      active = false;
      window.removeEventListener('construtec:session-expired', expire);
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const session = await authApi.login({ email: email.trim(), password, rememberMe });
      finishSession(session.token, session.user, rememberMe);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível entrar no aplicativo.');
    } finally {
      setPending(false);
    }
  };

  if (mode === 'ready' && user) {
    return <App user={user} onLogout={() => void clearSession(true)} />;
  }

  if (mode === 'checking') {
    return (
      <main className="auth-shell auth-loading" aria-busy="true">
        <img src={brandLogo} alt="Construtec Orçamentos" className="auth-loading-logo" />
        <LoaderCircle className="spinning" size={26} />
        <strong>{isCloud ? 'Conectando…' : 'Preparando ambiente local…'}</strong>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-card-brand">
          <img src={brandLogo} alt="Construtec Orçamentos" className="auth-logo" />
        </div>
        <header className="auth-card-header">
          <span className="auth-brand-icon"><LockKeyhole size={22} /></span>
          <div>
            <span className="auth-eyebrow">CONSTRUTEC ORÇAMENTOS</span>
            <h1>Entrar</h1>
            <p>Use a mesma conta do Centro de Custos. Sem conta? Peça a um administrador para criar a sua.</p>
          </div>
        </header>

        <form onSubmit={(event) => void submit(event)}>
          <label>
            <span>E-mail</span>
            <input autoFocus required type="email" maxLength={254} autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@rcconstrutec.com.br" />
          </label>
          <label>
            <span>Senha</span>
            <input required type="password" maxLength={128} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha da sua conta" />
          </label>

          <label className="auth-remember-row">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Lembrar meu acesso neste dispositivo</span>
          </label>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button className="auth-submit" type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="spinning" size={17} /> : <KeyRound size={17} />}
            {pending ? 'Validando…' : 'Entrar'}
          </button>
        </form>

        <footer>
          <ShieldCheck size={15} />
          <span>{isCloud ? 'Sessão protegida por HTTPS.' : 'Entrar exige conexão com o Centro de Custos.'} A senha é validada pelo Centro de Custos.</span>
        </footer>
      </section>
    </main>
  );
}
