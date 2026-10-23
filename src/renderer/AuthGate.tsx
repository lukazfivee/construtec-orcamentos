import { useEffect, useState } from 'react';
import type { AuthUser } from '../shared/contracts';
import { CONSTRUTEC_LOGO_BASE64 } from '../assets/logoBase64';
import { App } from './App';
import { LoginScreen, type LoginNotice } from './LoginScreen';
import { authApi, isCloudRuntime, setAuthSessionToken } from './api';
import { useTheme } from './theme';
import { centroEntryUrl, claimCentroEntry, isFramed, skipCentroEntry, suiteSessionFromHash } from './suiteSession';
import { proposalFromHash } from './useProposalDeepLink';

const SESSION_KEY = 'construtec.auth.session';
const REMEMBERED_EMAIL_KEY = 'construtec.auth.remembered_email';
const REMEMBER_FLAG_KEY = 'construtec.auth.remember_me';
const brandLogoLight = `data:image/png;base64,${CONSTRUTEC_LOGO_BASE64}`;
const brandLogoDark = new URL('../assets/logo-branca.png', import.meta.url).href;
const isCloud = isCloudRuntime();
// Login e conta sao do Centro de Custos (identidade compartilhada): nao ha
// mais cadastro de primeiro administrador aqui.
type AuthMode = 'checking' | 'login' | 'ready';
// Dentro do app Suite Construtec a entrada e a saida sao do app (suite://).
const inApp = typeof navigator !== 'undefined' && /SuiteConstrutec\//.test(navigator.userAgent);

export function AuthGate() {
  const theme = useTheme();
  const brandLogo = theme.resolved === 'escuro' ? brandLogoDark : brandLogoLight;
  const [mode, setMode] = useState<AuthMode>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    return localStorage.getItem(REMEMBER_FLAG_KEY) !== 'false';
  });
  const [error, setError] = useState('');
  // Aviso da tela de entrar (igual ao Centro): saiu ou a sessao terminou.
  const [notice, setNotice] = useState<LoginNotice>('');

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
    setError('');
    setMode('ready');
  };

  const clearSession = async (endRemote = false) => {
    setNotice(endRemote ? 'sair' : 'exp');
    if (endRemote) {
      await authApi.logout().catch(() => undefined);
      skipCentroEntry(sessionStorage);
    }
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    setAuthSessionToken(null);
    setUser(null);
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

      // Tira do endereco o que e de entrada (#handoff=, #sessao=, #centro=); um #proposta= junto continua para o App abrir.
      const arrivedHash = window.location.hash;
      const arrived = new URLSearchParams(arrivedHash.slice(1));
      if (['handoff', 'sessao', 'centro'].some((key) => arrived.has(key))) {
        const proposta = proposalFromHash(arrivedHash);
        window.history.replaceState(null, '', window.location.pathname + window.location.search + (proposta ? `#proposta=${proposta}` : ''));
      }

      const handoff = arrived.get('handoff');
      if (handoff) {
        try {
          const session = await authApi.handoff(handoff);
          if (active) finishSession(session.token, session.user, false);
          return;
        } catch (handoffError) {
          if (active) setError(handoffError instanceof Error ? handoffError.message : 'Não foi possível entrar pelo aplicativo.');
        }
      }

      const suiteToken = suiteSessionFromHash(arrivedHash);
      if (suiteToken && (await window.construtec?.runtime().catch(() => undefined))?.suite === true) {
        setAuthSessionToken(suiteToken);
        try {
          const result = await authApi.me();
          if (active) finishSession(suiteToken, result.user, false);
          return;
        } catch (sessionError) {
          setAuthSessionToken(null);
          if (active) setError(sessionError instanceof Error ? sessionError.message : 'Não foi possível entrar pelo aplicativo.');
        }
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
      // Sem sessao no navegador: pergunta uma vez ao Centro de Custos (mesma conta), que devolve #handoff= ou #centro=0.
      const centro = inApp || isFramed(window) ? null : centroEntryUrl(window.location.origin, arrivedHash);
      if (active && centro && claimCentroEntry(sessionStorage)) {
        window.location.replace(centro);
        return;
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

  // Mesma logica de antes (POST /api/auth/login, validado pelo Centro); a tela so mostra o resultado.
  const submit = async (password: string) => {
    try {
      const session = await authApi.login({ email: email.trim(), password, rememberMe });
      finishSession(session.token, session.user, rememberMe);
      return '';
    } catch (submitError) {
      return submitError instanceof Error ? submitError.message : 'Não foi possível entrar no aplicativo.';
    }
  };

  if (mode === 'ready' && user) {
    return <App user={user} onLogout={() => void clearSession(true).then(() => { if (inApp) window.location.href = 'suite://sair'; })} />;
  }

  if (mode === 'checking') {
    return (
      <main className="auth-shell auth-loading" aria-busy="true">
        <img src={brandLogo} alt="Construtec Orçamentos" className="auth-loading-logo" />
        <div className="auth-loading-bar" aria-hidden="true"><i /></div>
        <strong>{isCloud ? 'Abrindo Orçamentos' : 'Preparando o Orçamentos local'}</strong>
        <small className="auth-loading-lenta" aria-hidden="true">A conexão está lenta. Continuamos tentando.</small>
      </main>
    );
  }

  return (
    <LoginScreen
      key={`${notice}-${error}`}
      email={email}
      onEmailChange={setEmail}
      rememberMe={rememberMe}
      onRememberChange={setRememberMe}
      onSubmit={submit}
      notice={notice}
      initialError={error}
      inApp={inApp}
    />
  );
}
