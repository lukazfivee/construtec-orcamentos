import { createContext, useContext } from 'react';
import type { AuthUser } from '../shared/contracts';

// Permissoes da Suite (p10: ver custo, BDI e margem; p11: enviar e aprovar propostas) vem da conta central.
// A tela so esconde o que nao vale; quem recusa de verdade e o servidor. Sem a lista (sessao antiga), nada some.
const SuiteUserContext = createContext<AuthUser | null>(null);

export const SuiteUserProvider = SuiteUserContext.Provider;

export const useSuitePermission = (permission: string): boolean => {
  const user = useContext(SuiteUserContext);
  return !user || !Array.isArray(user.permissions) || user.permissions.includes(permission);
};
