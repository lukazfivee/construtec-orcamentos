import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, UserPlus } from 'lucide-react';
import type { AuthUser } from '../shared/contracts';
import { CONSTRUTEC_LOGO_BASE64 } from '../assets/logoBase64';
import { App } from './App';
import { authApi, setAuthSessionToken } from './api';

const SESSION_KEY = 'construtec.auth.session';
const REMEMBERED_EMAIL_KEY = 'construtec.auth.remembered_email';
const REMEMBER_FLAG_KEY = 'construtec.auth.remember_me';
const brandLogo = `data:image/png;base64,${CONSTRUTEC_LOGO_BASE64}`;
type AuthMode = 'checking' | 'setup' | 'login' | 'ready';

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    setConfirmPassword('');
    setError('');
    setMode('ready');
  };

  const clearSession = async () => {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    setAuthSessionToken(null);
    setUser(null);
    setPassword('');
    setConfirmPassword('');
    setError('');
    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
    }
    try {
      const status = await authApi.setupStatus();
      setRequiresSetup(status.requiresSetup);
      setMode(status.requiresSetup ? 'setup' : 'login');
    } catch {
      setMode('login');
    }
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
      }

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

      try {
        const status = await authApi.setupStatus();
        if (active) {
          setRequiresSetup(status.requiresSetup);
          setMode(status.requiresSetup ? 'setup' : 'login');
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível iniciar a autenticação local.');
          setMode('login');
        }
      }
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
    if (mode === 'setup' && password !== confirmPassword) {
      setError('As senhas informadas não são iguais.');
      return;
    }

    setPending(true);
    setError('');
    try {
      const session = mode === 'setup'
        ? await authApi.setup({
            name: name.trim(),
            email: email.trim(),
            password,
            rememberMe,
          })
        : await authApi.login({
            email: email.trim(),
            password,
            rememberMe,
          });
      finishSession(session.token, session.user, rememberMe);
    } catch (submitError) {
      if (submitError instanceof Error && submitError.message.includes('AUTH_SETUP_COMPLETE')) {
        setError('O primeiro acesso já foi configurado neste computador. Por favor, faça login com seu e-mail e senha.');
      } else {
        setError(submitError instanceof Error ? submitError.message : 'Não foi possível entrar no aplicativo.');
      }
    } finally {
      setPending(false);
    }
  };

  if (mode === 'ready' && user) {
    return <App user={user} onLogout={() => void clearSession()} />;
  }

  if (mode === 'checking') {
    return (
      <main className="auth-shell auth-loading" aria-busy="true">
        <img src={brandLogo} alt="Construtec Orçamentos" className="auth-loading-logo" />
        <LoaderCircle className="spinning" size={26} />
        <strong>Preparando ambiente local…</strong>
      </main>
    );
  }

  const setup = mode === 'setup';
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-card-brand">
          <img src={brandLogo} alt="Construtec Orçamentos" className="auth-logo" />
        </div>
        <header className="auth-card-header">
          <span className="auth-brand-icon">
            {setup ? <UserPlus size={22} /> : <LockKeyhole size={22} />}
          </span>
          <div>
            <span className="auth-eyebrow">{setup ? 'PRIMEIRO ACESSO' : 'CONSTRUTEC ORÇAMENTOS'}</span>
            <h1>{setup ? 'Cadastro de administrador' : 'Entrar'}</h1>
            <p>{setup
              ? 'Crie o primeiro acesso administrativo deste computador. Os dados continuam armazenados localmente.'
              : 'Use sua conta interna para acessar os orçamentos deste computador.'}</p>
          </div>
        </header>

        <form onSubmit={(event) => void submit(event)}>
          {setup && (
            <label>
              <span>Nome completo</span>
              <input autoFocus required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do responsável" />
            </label>
          )}
          <label>
            <span>E-mail</span>
            <input autoFocus={!setup} required type="email" maxLength={200} autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@construtec.com.br" />
          </label>
          <label>
            <span>Senha</span>
            <input required type="password" minLength={10} maxLength={128} autoComplete={setup ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 10 caracteres" />
          </label>
          {setup && (
            <label>
              <span>Confirmar senha</span>
              <input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a senha" />
            </label>
          )}

          <label className="auth-remember-row">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Lembrar meu acesso neste computador</span>
          </label>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button className="auth-submit" type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="spinning" size={17} /> : setup ? <ShieldCheck size={17} /> : <KeyRound size={17} />}
            {pending ? 'Validando…' : setup ? 'Cadastrar administrador e entrar' : 'Entrar'}
          </button>
          <button className="auth-switch" type="button" disabled={pending} onClick={() => {
            setPassword('');
            setConfirmPassword('');
            setError('');
            setMode(setup ? 'login' : 'setup');
          }}>
            {setup ? 'Voltar para o login' : 'Configurar primeiro acesso / Cadastro'}
          </button>
        </form>

        <footer>
          <ShieldCheck size={15} />
          <span>Sessão local protegida. Senhas são armazenadas somente como hash.</span>
        </footer>
      </section>
    </main>
  );
}
