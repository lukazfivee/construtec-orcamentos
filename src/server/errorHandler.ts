import type express from 'express';
import { ZodError } from 'zod';
import { CentroIdentityError } from './services/centroIdentity';

// Codigo do erro (SQLSTATE do PostgreSQL ou codigo de rede do Node) para
// diagnostico na nuvem, onde a mensagem fica generica; nunca inclui dados.
const errorReference = (error: Error) => {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^[A-Z0-9_]{2,40}$/.test(code) ? ` (código ${code})` : '';
};

// Erros de regra lancados pelos servicos (error.message): status e texto mostrado ao usuario.
const KNOWN_ERRORS: Record<string, [status: number, message: string]> = {
  AUTH_HANDOFF_INVALID: [400, 'Código de acesso do aplicativo inválido ou expirado.'],
  AUTH_INVALID_CREDENTIALS: [401, 'E-mail ou senha inválidos.'],
  AUTH_SETUP_COMPLETE: [409, 'O administrador inicial já foi configurado.'],
  USER_EMAIL_DUPLICATE: [409, 'Já existe um usuário com esse e-mail.'],
  USER_SELF_LOCKOUT: [409, 'Você não pode desativar ou remover o perfil administrativo da própria conta.'],
  USER_ROLE_FROM_CENTRO: [409, 'Esta conta é administradora no Centro de Custos. O perfil dela só muda lá.'],
  USER_LAST_ADMIN: [409, 'É necessário manter pelo menos um administrador ativo.'],
  DISCARD_CONFIRMATION: [400, 'Digite o número da proposta exatamente como aparece para confirmar o descarte.'],
  DISCARD_CENTER_HAS_MOVEMENT: [409, 'A obra desta proposta no Centro de Custos já tem lançamentos, notas ou medições. Só proposta sem movimento pode ser descartada (a obra sai junto do Centro).'],
  DISCARD_CENTER_UNAVAILABLE: [503, 'Não foi possível falar com o Centro de Custos agora. Nada foi alterado; tente de novo em instantes.'],
  RESTORE_CENTER_CONFLICT: [409, 'O Centro de Custos não conseguiu devolver a obra desta proposta (ela foi alterada ou recriada lá). Nada foi restaurado; confira a obra no Centro de Custos.'],
  DISCARD_ALREADY_RESTORED: [409, 'Esta proposta já foi restaurada.'],
  DISCARD_NUMBER_IN_USE: [409, 'Já existe uma proposta com este número. Exclua ou renumere a existente antes de restaurar.'],
  PROPOSAL_LOCKED: [409, 'Esta revisão está bloqueada para alterações.'],
  WORK_DUPLICATE: [409, 'Já existe uma obra com esse nome para o cliente.'],
  ITEM_ALREADY_IN_CATALOG: [409, 'Este item já está no catálogo.'],
  PRODUCT_DUPLICATE: [409, 'Já existe um item com esse código no catálogo.'],
  KIT_NAME_DUPLICATE: [409, 'Já existe um kit com esse nome.'],
  KIT_EMPTY: [422, 'O kit selecionado não possui itens.'],
};

// Erros reconhecidos pelo formato da mensagem, na ordem em que sao testados.
const ERROR_PATTERNS: Array<[pattern: RegExp, status: number, message: string]> = [
  [/_NOT_FOUND$/, 404, 'Registro não encontrado.'],
  [/^FINANCIAL_/, 422, 'Valor financeiro inválido ou acima do limite suportado.'],
  [/unique constraint.*(?:kits_name|name)/i, 409, 'Já existe um kit com esse nome.'],
  [/violates not-null constraint/i, 422, 'Preencha todos os campos obrigatórios.'],
  [/violates foreign key constraint/i, 422, 'Um dos produtos vinculados não foi encontrado no catálogo.'],
  [/duplicate key/i, 409, 'Registro já cadastrado com os mesmos dados.'],
];

export const createErrorHandler = (cloud: boolean) => (error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  void _next;
  if (error instanceof ZodError || (error as { name?: string })?.name === 'ZodError' || Array.isArray((error as { issues?: unknown })?.issues)) {
    const issues = (error as { issues?: Array<{ message: string; path: (string | number)[] }> }).issues;
    const details = issues && issues.length > 0
      ? issues.map((i) => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`).join(', ')
      : 'Dados inválidos.';
    response.status(400).json({ error: `Dados inválidos: ${details}` });
    return;
  }
  // Erro ao ler o corpo (JSON invalido ou grande demais): o erro traz o corpo cru, que pode ter senha. Nao vai a log nem a tela.
  const bodyErrorType = (error as { type?: unknown } | null)?.type;
  if (typeof bodyErrorType === 'string' && bodyErrorType.startsWith('entity.')) {
    response.status(bodyErrorType === 'entity.too.large' ? 413 : 400).json({ error: 'Corpo da requisição inválido.' });
    return;
  }
  if (error instanceof CentroIdentityError) {
    const messages: Record<string, string> = {
      EMAIL_NOT_AUTHORIZED: 'E-mail não autorizado. Autorize o e-mail externo antes de criar a conta.',
      IDENTITY_UNAVAILABLE: error.message,
      IDENTITY_NOT_CONFIGURED: error.message,
    };
    const status = [400, 401, 403, 404, 409, 429].includes(error.status) ? error.status : 503;
    response.status(status).json({ error: messages[error.code] || error.message });
    return;
  }
  if (error instanceof Error) {
    const byPattern = ERROR_PATTERNS.find(([pattern]) => pattern.test(error.message));
    const known = Object.hasOwn(KNOWN_ERRORS, error.message) ? KNOWN_ERRORS[error.message] : byPattern && [byPattern[1], byPattern[2]] as const;
    if (known) {
      response.status(known[0]).json({ error: known[1] });
      return;
    }
    console.error(error);
    response.status(500).json({ error: cloud ? `Não foi possível concluir a operação.${errorReference(error)}` : (error.message || 'Não foi possível concluir a operação local.') });
    return;
  }
  console.error(error);
  response.status(500).json({ error: cloud ? 'Não foi possível concluir a operação.' : 'Não foi possível concluir a operação local.' });
};
