import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { decryptSecret, encryptSecret, ExsatCryptoError, hasCredentialKey, loadCredentialKey, maskUsername } from './exsatCrypto';
import { requireKey } from './exsatCredentials';
import { ExsatServerError } from './exsatErrors';

const key = randomBytes(32);

test('criptografia da conta Exsat: ida e volta com AES-256-GCM, IV novo a cada vez e sem texto claro', () => {
  const secret = JSON.stringify({ u: 'lucas@construtec.com.br', p: 'Senh@ com acentuação ç ~' });
  const a = encryptSecret(secret, key);
  const b = encryptSecret(secret, key);
  assert.notEqual(a, b, 'IV aleatorio: dois cifrados do mesmo texto diferem');
  assert.match(a, /^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.equal(decryptSecret(a, key), secret);
  assert.equal(decryptSecret(b, key), secret);
  assert.ok(!a.includes('Senh') && !a.includes('construtec') && !Buffer.from(a.split('.')[3], 'base64url').includes('Senh'), 'texto claro vazou');
  assert.equal(decryptSecret(encryptSecret('', key), key), '');
});

test('criptografia da conta Exsat: texto adulterado, formato quebrado ou chave errada nao abrem', () => {
  const payload = encryptSecret('segredo', key);
  const [version, iv, tag, body] = payload.split('.');
  const flip = (text: string) => { const bytes = Buffer.from(text, 'base64url'); bytes[0] ^= 1; return bytes.toString('base64url'); };
  for (const tampered of [
    [version, iv, tag, flip(body)].join('.'),
    [version, flip(iv), tag, body].join('.'),
    [version, iv, flip(tag), body].join('.'),
    ['v2', iv, tag, body].join('.'),
    [version, iv, tag].join('.'),
    'lixo', '',
  ]) {
    assert.throws(() => decryptSecret(tampered, key), (error) => error instanceof ExsatCryptoError && error.code === 'EXSAT_CREDENTIAL_UNREADABLE');
  }
  assert.throws(() => decryptSecret(payload, randomBytes(32)), (error) => error instanceof ExsatCryptoError && error.code === 'EXSAT_CREDENTIAL_UNREADABLE');
  assert.throws(() => encryptSecret('x', randomBytes(16)), (error) => error instanceof ExsatCryptoError && error.code === 'EXSAT_KEY_INVALID');
});

test('chave EXSAT_CREDENTIAL_KEY: ausente ou invalida falha fechado; hex, base64 e BOM valem', () => {
  assert.throws(() => loadCredentialKey({}), (error) => error instanceof ExsatCryptoError && error.code === 'EXSAT_KEY_MISSING');
  assert.throws(() => loadCredentialKey({ EXSAT_CREDENTIAL_KEY: '   ' }), (error) => error instanceof ExsatCryptoError && error.code === 'EXSAT_KEY_MISSING');
  for (const bad of ['curta', 'z'.repeat(64), randomBytes(16).toString('hex'), randomBytes(31).toString('base64'), randomBytes(33).toString('base64')]) {
    assert.throws(() => loadCredentialKey({ EXSAT_CREDENTIAL_KEY: bad }), (error) => error instanceof ExsatCryptoError && error.code === 'EXSAT_KEY_INVALID', bad);
  }
  assert.ok(loadCredentialKey({ EXSAT_CREDENTIAL_KEY: key.toString('hex') }).equals(key));
  assert.ok(loadCredentialKey({ EXSAT_CREDENTIAL_KEY: key.toString('base64') }).equals(key));
  assert.ok(loadCredentialKey({ EXSAT_CREDENTIAL_KEY: key.toString('base64url') }).equals(key));
  assert.ok(loadCredentialKey({ EXSAT_CREDENTIAL_KEY: `\uFEFF ${key.toString('hex')} \n` }).equals(key), 'BOM e espacos do segredo do Worker');
  assert.equal(hasCredentialKey({}), false);
  assert.equal(hasCredentialKey({ EXSAT_CREDENTIAL_KEY: key.toString('hex') }), true);
  // O servico traduz para o erro de negocio, que a rota mostra em portugues.
  assert.throws(() => requireKey({}), (error) => error instanceof ExsatServerError && error.code === 'EXSAT_KEY_MISSING');
  assert.throws(() => requireKey({ EXSAT_CREDENTIAL_KEY: 'x' }), (error) => error instanceof ExsatServerError && error.code === 'EXSAT_KEY_INVALID');
});

test('usuario mascarado nunca mostra o e-mail inteiro', () => {
  assert.equal(maskUsername('lucas@construtec.com.br'), 'l***@construtec.com.br');
  assert.equal(maskUsername('  ab@x.com '), 'a***@x.com');
  assert.equal(maskUsername('semarroba'), 's***');
});
