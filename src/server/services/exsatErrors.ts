// Erros da Exsat no servidor e as mensagens em portugues que o site mostra. A mensagem nunca ecoa a resposta da Exsat,
// o usuario nem a senha: so um codigo fixo e um texto escrito aqui.
export type ExsatErrorCode =
  | 'EXSAT_KEY_MISSING' | 'EXSAT_KEY_INVALID' | 'EXSAT_NOT_CONFIGURED' | 'EXSAT_CREDENTIAL_UNREADABLE'
  | 'EXSAT_LOGIN_REJECTED' | 'EXSAT_LOGIN_BLOCKED' | 'EXSAT_CHALLENGE' | 'EXSAT_LOGIN_CHANGED' | 'EXSAT_LOGIN_UNVERIFIED'
  | 'EXSAT_LOGIN_REQUIRED' | 'EXSAT_LOGIN_PAUSED' | 'EXSAT_UNAVAILABLE' | 'EXSAT_NO_PRICES' | 'EXSAT_INTERRUPTED'
  | 'EXSAT_JOB_RUNNING' | 'EXSAT_INTERNAL';

const MESSAGES: Record<ExsatErrorCode, string> = {
  EXSAT_KEY_MISSING: 'O servidor ainda não tem a chave de criptografia da conta Exsat (EXSAT_CREDENTIAL_KEY). Nada foi salvo. Peça ao responsável pelo servidor para cadastrá-la.',
  EXSAT_KEY_INVALID: 'A chave de criptografia da conta Exsat no servidor (EXSAT_CREDENTIAL_KEY) é inválida. Ela precisa ter 32 bytes. Nada foi salvo.',
  EXSAT_NOT_CONFIGURED: 'Nenhuma conta da Exsat foi cadastrada. Informe o e-mail e a senha e use Salvar e conectar.',
  EXSAT_CREDENTIAL_UNREADABLE: 'Não foi possível ler a conta Exsat guardada (a chave do servidor mudou ou o registro foi alterado). Cadastre a conta de novo.',
  EXSAT_LOGIN_REJECTED: 'A Exsat recusou o e-mail ou a senha. Confira os dados e tente de novo mais tarde, para não bloquear a conta.',
  EXSAT_LOGIN_BLOCKED: 'A Exsat avisou que a conta foi limitada ou bloqueada por tentativas. Aguarde e confira a conta no site da Exsat antes de tentar de novo.',
  EXSAT_CHALLENGE: 'A Exsat pediu uma verificação (captcha ou desafio de segurança) que o servidor não pode fazer, e não vamos contorná-la. Use o aplicativo do computador para sincronizar; o catálogo atualizado aparece aqui no site.',
  EXSAT_LOGIN_CHANGED: 'A página de login da Exsat mudou e o servidor não conseguiu entrar. Nada foi salvo. Avise o suporte para ajustar a leitura.',
  EXSAT_LOGIN_UNVERIFIED: 'A Exsat aceitou o login, mas o servidor não conseguiu confirmar a sessão (a página inicial pode ter mudado). Nada foi importado.',
  EXSAT_LOGIN_REQUIRED: 'A sessão da Exsat caiu durante a leitura e não foi possível entrar de novo. Use Salvar e conectar e retome a varredura.',
  EXSAT_LOGIN_PAUSED: 'Para não bloquear a conta, o servidor espera um pouco depois de uma falha de login. Tente de novo mais tarde.',
  EXSAT_UNAVAILABLE: 'A Exsat está fora do ar ou não respondeu. Tente de novo em alguns minutos.',
  EXSAT_NO_PRICES: 'O servidor entrou na conta, mas nenhuma página mostrou preço de revendedor. A Exsat pode ter mudado as páginas. Nada foi importado.',
  EXSAT_INTERRUPTED: 'A varredura foi interrompida (o servidor reiniciou ou dormiu). Retome de onde parou.',
  EXSAT_JOB_RUNNING: 'Já existe uma varredura da Exsat em andamento.',
  EXSAT_INTERNAL: 'Não foi possível concluir a leitura da Exsat. Tente retomar a varredura.',
};

export class ExsatServerError extends Error {
  constructor(readonly code: ExsatErrorCode, readonly retryAfterSeconds = 0) {
    super(code);
    this.name = 'ExsatServerError';
  }
}

export const exsatMessage = (code: string | null | undefined): string | null => (
  code && code in MESSAGES ? MESSAGES[code as ExsatErrorCode] : null
);

// Estado HTTP de cada erro quando a rota responde a uma acao do usuario.
export const exsatHttpStatus = (code: ExsatErrorCode): number => {
  if (code === 'EXSAT_KEY_MISSING' || code === 'EXSAT_KEY_INVALID' || code === 'EXSAT_INTERNAL') return 503;
  if (code === 'EXSAT_NOT_CONFIGURED') return 409;
  if (code === 'EXSAT_JOB_RUNNING') return 409;
  if (code === 'EXSAT_LOGIN_PAUSED') return 429;
  if (code === 'EXSAT_UNAVAILABLE') return 502;
  return 422;
};
