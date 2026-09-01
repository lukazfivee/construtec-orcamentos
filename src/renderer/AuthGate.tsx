import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { KeyRound, LoaderCircle, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import type { AuthUser } from '../shared/contracts';
import { App } from './App';
import { authApi, setAuthSessionToken } from './api';

const SESSION_KEY = 'construtec.auth.session';
type AuthMode = 'checking' | 'setup' | 'login' | 'ready';

const roleLabels: Record<AuthUser['role'], string> = {
  admin: 'Administrador',
  commercial: 'Comercial',
  viewer: 'Consulta',
};

const initials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() ?? '')
  .join('') || 'CT';

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const finishSession = (token: string, nextUser: AuthUser) => {
    sessionStorage.setItem(SESSION_KEY, token);
    setAuthSessionToken(token);
    setUser(nextUser);
    setPassword('');
    setConfirmPassword('');
    setError('');
    setMode('ready');
  };

  const clearSession = async () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthSessionToken(null);
    setUser(null);
    setPassword('');
    setConfirmPassword('');
    setError('');
    try {
      const status = await authApi.setupStatus();
      setMode(status.requiresSetup ? 'setup' : 'login');
    } catch {
      setMode('login');
    }
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const storedToken = sessionStorage.getItem(SESSION_KEY);
      if (storedToken) {
        setAuthSessionToken(storedToken);
        try {
          const result = await authApi.me();
          if (active) finishSession(storedToken, result.user);
          return;
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
          setAuthSessionToken(null);
        }
      }

      try {
        const status = await authApi.setupStatus();
        if (active) setMode(status.requiresSetup ? 'setup' : 'login');
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
        ? await authApi.setup({ name: name.trim(), email: email.trim(), password })
        : await authApi.login({ email: email.trim(), password });
      finishSession(session.token, session.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível entrar no aplicativo.');
    } finally {
      setPending(false);
    }
  };

  const profile = useMemo(() => user ? {
    initials: initials(user.name),
    role: roleLabels[user.role],
  } : null, [user]);

  if (mode === 'ready' && user && profile) {
    return (
      <>
        <App />
        <div className="auth-session-chip" aria-label={`Sessão de ${user.name}`}>
          <span className="auth-session-avatar">{profile.initials}</span>
          <span className="auth-session-user">
            <b>{user.name}</b>
            <small>{profile.role}</small>
          </span>
          <button type="button" onClick={() => void clearSession()} title="Sair do aplicativo" aria-label="Sair">
            <LogOut size={15} />
          </button>
        </div>
      </>
    );
  }

  if (mode === 'checking') {
    return (
      <main className="auth-shell auth-loading" aria-busy="true">
        <LoaderCircle className="spinning" size={28} />
        <strong>Preparando ambiente local…</strong>
      </main>
    );
  }

  const setup = mode === 'setup';
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <header className="auth-card-header">
          <span className="auth-brand-icon"><LockKeyhole size={24} /></span>
          <div>
            <span className="auth-eyebrow">CONSTRUTEC ORÇAMENTOS</span>
            <h1>{setup ? 'Configurar administrador' : 'Entrar'}</h1>
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

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button className="auth-submit" type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="spinning" size={17} /> : setup ? <ShieldCheck size={17} /> : <KeyRound size={17} />}
            {pending ? 'Validando…' : setup ? 'Criar administrador e entrar' : 'Entrar'}
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
