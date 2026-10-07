import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Criptografia em repouso da conta da Exsat: AES-256-GCM, chave so em variavel de ambiente/secret do servidor
// (EXSAT_CREDENTIAL_KEY), nunca no banco. Sem chave valida o servidor recusa gravar e ler (falha fechado).
// Formato guardado: v1.<iv>.<tag>.<texto cifrado>, tudo em base64url. O cabecalho v1 entra como dado autenticado (AAD).
export const EXSAT_KEY_ENV = 'EXSAT_CREDENTIAL_KEY';
const AAD = Buffer.from('construtec-orcamentos:exsat-credential:v1');

export class ExsatCryptoError extends Error {
  constructor(readonly code: 'EXSAT_KEY_MISSING' | 'EXSAT_KEY_INVALID' | 'EXSAT_CREDENTIAL_UNREADABLE') {
    super(code);
    this.name = 'ExsatCryptoError';
  }
}

// Aceita 32 bytes em hexadecimal (64 caracteres) ou em base64 (43 a 44 caracteres). Tira BOM e espacos: o segredo do
// Worker ja chegou com BOM (U+FEFF) uma vez e derrubou o login.
export const loadCredentialKey = (env: NodeJS.ProcessEnv = process.env): Buffer => {
  const raw = (env[EXSAT_KEY_ENV] ?? '').replace(/^\uFEFF/, '').trim();
  if (!raw) throw new ExsatCryptoError('EXSAT_KEY_MISSING');
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex')
    : /^[A-Za-z0-9+/_-]{43}=?$/.test(raw) ? Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
      : null;
  if (!key || key.length !== 32) throw new ExsatCryptoError('EXSAT_KEY_INVALID');
  return key;
};

export const hasCredentialKey = (env: NodeJS.ProcessEnv = process.env) => {
  try { loadCredentialKey(env); return true; } catch { return false; }
};

export const encryptSecret = (plain: string, key: Buffer): string => {
  if (key.length !== 32) throw new ExsatCryptoError('EXSAT_KEY_INVALID');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
};

// Qualquer problema (formato, chave trocada, texto adulterado) vira o mesmo erro, sem detalhe do que falhou.
export const decryptSecret = (payload: string, key: Buffer): string => {
  if (key.length !== 32) throw new ExsatCryptoError('EXSAT_KEY_INVALID');
  try {
    const [version, iv, tag, body] = payload.split('.');
    if (version !== 'v1' || !iv || !tag || body === undefined) throw new Error('format');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new ExsatCryptoError('EXSAT_CREDENTIAL_UNREADABLE');
  }
};

export const maskUsername = (username: string): string => {
  const value = username.trim();
  const at = value.indexOf('@');
  if (at <= 0) return `${value.slice(0, 1)}***`;
  return `${value.slice(0, 1)}***${value.slice(at)}`;
};
