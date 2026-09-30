// Papeis e permissoes da Suite (D6 do Centro de Custos). A matriz vem do diretorio central;
// esta copia padrao vale quando o Centro ainda nao a oferece. Igual a
// centro-custos-construtec-v3/services/permissions.js.
export const SUITE_ROLES = ['admin', 'gestor', 'financeiro', 'engenharia', 'tecnico', 'comercial'] as const;
export type SuiteRole = (typeof SUITE_ROLES)[number];
export type SuiteMatrix = Record<string, Record<string, boolean>>;
export const SUITE_APPS = ['centro', 'orcamentos'] as const;

const MATRIX: Record<string, SuiteRole[]> = {
  p1: ['admin', 'gestor', 'financeiro', 'engenharia'],
  p2: ['admin', 'gestor', 'financeiro', 'engenharia', 'tecnico'],
  p3: ['admin', 'gestor', 'financeiro'],
  p4: ['admin', 'gestor', 'financeiro'],
  p5: ['admin', 'gestor'],
  p6: ['admin', 'gestor', 'financeiro'],
  p7: ['admin', 'gestor'],
  p8: ['admin'],
  p9: ['admin'],
  p10: ['admin', 'gestor', 'engenharia', 'comercial'],
  p11: ['admin', 'gestor', 'comercial'],
  p12: ['admin', 'gestor', 'engenharia', 'tecnico'],
};
export const SUITE_PERMISSIONS = Object.keys(MATRIX);

export const defaultSuiteMatrix = (): SuiteMatrix => {
  const out: SuiteMatrix = {};
  for (const role of SUITE_ROLES) {
    out[role] = {};
    for (const permission of SUITE_PERMISSIONS) out[role][permission] = MATRIX[permission].includes(role);
  }
  return out;
};

export const isSuiteRole = (value: unknown): value is SuiteRole => SUITE_ROLES.includes(value as SuiteRole);

// Conta sem papel novo no diretorio: admin e gestor seguem o papel antigo; o resto e tecnico.
export const suiteRoleFromLegacy = (role: string | undefined): SuiteRole => (role === 'admin' || role === 'gestor' ? role : 'tecnico');

export const permissionsFor = (role: SuiteRole, matrix: SuiteMatrix = defaultSuiteMatrix()): string[] =>
  SUITE_PERMISSIONS.filter((permission) => role === 'admin' || matrix[role]?.[permission] === true);
