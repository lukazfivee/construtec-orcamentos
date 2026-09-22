import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveIntegrationKey } from './proposalSync';

const PUBLIC_DEFAULT = 'construtec-internal-integration-secret-2026';

const withEnv = (vars: Record<string, string | undefined>, fn: () => void) => {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try { fn(); } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
};

test('chave de integração: desktop usa padrão local, nuvem exige segredo forte', () => {
  withEnv({ DATABASE_URL: undefined, CONSTRUTEC_INTEGRATION_KEY: undefined }, () => {
    assert.equal(resolveIntegrationKey(), PUBLIC_DEFAULT);
  });
  withEnv({ DATABASE_URL: 'postgres://x', CONSTRUTEC_INTEGRATION_KEY: undefined }, () => {
    assert.equal(resolveIntegrationKey(), null);
  });
  withEnv({ DATABASE_URL: 'postgres://x', CONSTRUTEC_INTEGRATION_KEY: PUBLIC_DEFAULT }, () => {
    assert.equal(resolveIntegrationKey(), null);
  });
  withEnv({ DATABASE_URL: 'postgres://x', CONSTRUTEC_INTEGRATION_KEY: 'curta' }, () => {
    assert.equal(resolveIntegrationKey(), null);
  });
  withEnv({ DATABASE_URL: 'postgres://x', CONSTRUTEC_INTEGRATION_KEY: 'k'.repeat(31) }, () => {
    assert.equal(resolveIntegrationKey(), null);
  });
  withEnv({ DATABASE_URL: 'postgres://x', CONSTRUTEC_INTEGRATION_KEY: 'k'.repeat(32) }, () => {
    assert.equal(resolveIntegrationKey(), 'k'.repeat(32));
  });
  const strong = 'k'.repeat(48);
  withEnv({ DATABASE_URL: 'postgres://x', CONSTRUTEC_INTEGRATION_KEY: strong }, () => {
    assert.equal(resolveIntegrationKey(), strong);
  });
});
