// Papel da Suite, apps e permissoes da conta central, para o Orcamentos aplicar p10 (ver custo, BDI e
// margem) e p11 (enviar e aprovar propostas). A matriz vem do diretorio central, com cache de 60 s;
// sem ela (Centro antigo ou fora do ar) vale a matriz padrao.
import type { AuthUser } from '../../shared/contracts';
import { SUITE_APPS, defaultSuiteMatrix, isSuiteRole, permissionsFor, suiteRoleFromLegacy, type SuiteMatrix } from '../../shared/suitePermissions';
import { CentroIdentityError, centroPermissions, type CentroUser } from './centroIdentity';

const MATRIX_CACHE_MS = 60 * 1000;
let matrixCache: { matrix: SuiteMatrix; until: number } | null = null;

export const resetSuiteMatrixCache = () => { matrixCache = null; };

const loadMatrix = async (token: string): Promise<SuiteMatrix> => {
  if (matrixCache && matrixCache.until > Date.now()) return matrixCache.matrix;
  try {
    const data = await centroPermissions(token);
    if (data?.matrix?.admin) {
      matrixCache = { matrix: data.matrix, until: Date.now() + MATRIX_CACHE_MS };
      return matrixCache.matrix;
    }
  } catch (error) {
    if (!(error instanceof CentroIdentityError) || error.status !== 404) console.warn('suite_matrix_unavailable');
  }
  return matrixCache?.matrix ?? defaultSuiteMatrix();
};

export const resolveSuiteAccess = async (remote: CentroUser, token: string): Promise<Pick<AuthUser, 'suiteRole' | 'apps' | 'permissions'>> => {
  const suiteRole = isSuiteRole(remote.suiteRole) ? remote.suiteRole : suiteRoleFromLegacy(remote.role);
  const apps = Array.isArray(remote.apps) ? remote.apps.filter((app) => (SUITE_APPS as readonly string[]).includes(app)) : [...SUITE_APPS];
  return { suiteRole, apps, permissions: permissionsFor(suiteRole, await loadMatrix(token)) };
};

// Sessao antiga (sem permissoes no cache) nao perde acesso: cai no papel local.
export const hasPermission = (user: AuthUser, permission: string): boolean =>
  Array.isArray(user.permissions) ? user.permissions.includes(permission) : user.role === 'admin';
