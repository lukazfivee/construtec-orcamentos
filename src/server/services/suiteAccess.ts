// Papel da Suite, apps e permissoes da conta central, para o Orcamentos aplicar p10 (ver custo, BDI e
// margem) e p11 (enviar e aprovar propostas). A matriz vem do diretorio central, com cache de 60 s;
// sem ela (Centro fora do ar e sem cache de ate 10 min) o acesso falha fechado: sem p10 e p11.
import type { AuthUser } from '../../shared/contracts';
import { SUITE_APPS, defaultSuiteMatrix, isSuiteRole, permissionsFor, suiteRoleFromLegacy, type SuiteMatrix } from '../../shared/suitePermissions';
import { CentroIdentityError, centroPermissions, type CentroUser } from './centroIdentity';

const MATRIX_CACHE_MS = 60 * 1000;
// Se o Centro cair, a ultima matriz vale por no maximo 10 min; depois disso falha fechado.
const MATRIX_STALE_MAX_MS = 10 * 60 * 1000;
let matrixCache: { matrix: SuiteMatrix; fetchedAt: number } | null = null;

export const resetSuiteMatrixCache = () => { matrixCache = null; };

const loadMatrix = async (token: string): Promise<SuiteMatrix | null> => {
  if (matrixCache && matrixCache.fetchedAt + MATRIX_CACHE_MS > Date.now()) return matrixCache.matrix;
  try {
    const data = await centroPermissions(token);
    if (data?.matrix?.admin) {
      matrixCache = { matrix: data.matrix, fetchedAt: Date.now() };
      return matrixCache.matrix;
    }
  } catch (error) {
    if (!(error instanceof CentroIdentityError) || error.status !== 404) console.warn('suite_matrix_unavailable');
  }
  return matrixCache && matrixCache.fetchedAt + MATRIX_STALE_MAX_MS > Date.now() ? matrixCache.matrix : null;
};

export const resolveSuiteAccess = async (remote: CentroUser, token: string): Promise<Pick<AuthUser, 'suiteRole' | 'apps' | 'permissions'>> => {
  const suiteRole = isSuiteRole(remote.suiteRole) ? remote.suiteRole : suiteRoleFromLegacy(remote.role);
  const apps = Array.isArray(remote.apps) ? remote.apps.filter((app) => (SUITE_APPS as readonly string[]).includes(app)) : [...SUITE_APPS];
  const matrix = await loadMatrix(token);
  // Sem matriz valida e sem cache recente: falha fechado, sem ver custo (p10) nem enviar/aprovar (p11).
  const permissions = matrix ? permissionsFor(suiteRole, matrix) : permissionsFor(suiteRole, defaultSuiteMatrix()).filter((permission) => permission !== 'p10' && permission !== 'p11');
  return { suiteRole, apps, permissions };
};

// Sessao antiga (sem permissoes no cache) nao perde acesso: cai no papel local.
export const hasPermission = (user: AuthUser, permission: string): boolean =>
  Array.isArray(user.permissions) ? user.permissions.includes(permission) : user.role === 'admin';
