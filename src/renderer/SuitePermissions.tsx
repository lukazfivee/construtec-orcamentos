import { createContext, useContext } from 'react';
import type { AuthUser } from '../shared/contracts';

// Permissoes da Suite (p10: ver custo, BDI e margem; p11: enviar e aprovar propostas) vem da conta central.
// A tela so esconde o que nao vale; quem recusa de verdade e o servidor. Sem a lista (sessao antiga), nada some.
const SuiteUserContext = createContext<AuthUser | null>(null);

export const SuiteUserProvider = SuiteUserContext.Provider;

// Fora de hooks (celulas de tabela, textos): a conta nao muda durante a sessao, entao basta guardar a atual.
let currentUser: AuthUser | null = null;
export const setCurrentSuiteUser = (user: AuthUser | null) => { currentUser = user; };
export const isAdminNow = (): boolean => currentUser?.role === 'admin';
export const seesCost = (): boolean => !currentUser || !Array.isArray(currentUser.permissions) || currentUser.permissions.includes('p10');
export const costText = (formatted: string): string => (seesCost() ? formatted : '—');

export const useIsAdmin = (): boolean => useContext(SuiteUserContext)?.role === 'admin';

export const useSuitePermission = (permission: string): boolean => {
  const user = useContext(SuiteUserContext);
  return !user || !Array.isArray(user.permissions) || user.permissions.includes(permission);
};
